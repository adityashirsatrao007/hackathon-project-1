"""
Email/password auth service.
"""
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest

# ── Email / Password Auth ─────────────────────────────────────────────────────

async def signup_with_email(db: AsyncSession, req: SignupRequest) -> User:
    """Register a new user with email + password."""
    result = await db.execute(select(User).where(User.email == req.email))
    existing = result.scalar_one_or_none()
    if existing:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    await db.flush()
    logger.info(f"New user signed up: {req.email}")
    return user


async def login_with_email(db: AsyncSession, req: LoginRequest) -> User:
    """Verify email + password and return the user."""
    from fastapi import HTTPException, status

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if user is None or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return user


def issue_token(user: User) -> str:
    """Create a JWT for the given user."""
    return create_access_token(
        subject=str(user.id),
        extra={"email": user.email, "name": user.name},
    )
