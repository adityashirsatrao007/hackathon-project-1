"""
FastAPI dependencies.

Optimisations applied:
  - get_current_user now uses a short-lived in-process LRU cache keyed on
    (user_id, token_iat).  This means a single browser page-load that fires
    3–5 parallel authenticated requests only hits the database ONCE; subsequent
    calls within the 60-second TTL return immediately from memory.
  - Cache is invalidated automatically when the JWT rotates (new iat).
"""
from __future__ import annotations

import time
from typing import Annotated

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

bearer_scheme = HTTPBearer(auto_error=False)

# ── In-process user cache ─────────────────────────────────────────────────────
# Key: (user_id_str, token_iat_int)   Value: (User‑like dict, fetched_at_float)
_user_cache: dict[tuple, tuple] = {}
_USER_CACHE_TTL = 60  # seconds — safe for a single-process dev server


def _cache_get(key: tuple) -> dict | None:
    entry = _user_cache.get(key)
    if entry and (time.monotonic() - entry[1]) < _USER_CACHE_TTL:
        return entry[0]
    _user_cache.pop(key, None)
    return None


def _cache_set(key: tuple, user_data: dict):
    # Keep cache lean — evict oldest entry when size exceeds 1000
    if len(_user_cache) >= 1_000:
        oldest = min(_user_cache, key=lambda k: _user_cache[k][1])
        _user_cache.pop(oldest, None)
    _user_cache[key] = (user_data, time.monotonic())


# ── Dependency ────────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts + validates Bearer JWT, returns the authenticated User.
    Uses a 60-second in-process cache to avoid a DB round-trip on every
    parallel request from the same browser page load.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    token_iat: int = payload.get("iat", 0)
    cache_key = (user_id, token_iat)

    # ── Cache hit ──────────────────────────────────────────────────────────────
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    # ── Cache miss → DB lookup ─────────────────────────────────────────────────
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    _cache_set(cache_key, user)
    return user


# ── Type aliases for cleaner route signatures ─────────────────────────────────
CurrentUser = Annotated[User, Depends(get_current_user)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
