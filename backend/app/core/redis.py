from __future__ import annotations

import redis.asyncio as aioredis
from app.core.config import settings
from loguru import logger
from redis.exceptions import TimeoutError as RedisTimeoutError

_redis_pool: aioredis.Redis | None = None
_redis_disabled: bool = False


async def get_redis_pool() -> aioredis.Redis | None:
    """Return (or create) the shared Redis connection pool.

    Returns None when Redis is unavailable (graceful degradation).
    """
    global _redis_pool, _redis_disabled

    if _redis_disabled:
        return None

    if _redis_pool is None:
        # Use explicit params for Redis Cloud (ACL username + password)
        _redis_pool = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            username=settings.REDIS_USERNAME,
            password=settings.REDIS_PASSWORD,
            ssl=settings.REDIS_SSL,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
            socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
            retry_on_timeout=True,
        )
        try:
            await _redis_pool.ping()
            logger.info(
                f"✅ Redis connected → {settings.REDIS_HOST}:{settings.REDIS_PORT}"
            )
        except Exception as exc:
            logger.warning(
                f"⚠️ Redis unavailable ({exc}) — running without event queue"
            )
            await _redis_pool.aclose()
            _redis_pool = None
            _redis_disabled = True

    return _redis_pool


async def close_redis_pool() -> None:
    """Close the Redis connection pool on shutdown."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("🔌 Redis pool closed")


async def push_to_queue(data: str) -> None:
    """Push a JSON string to the Redis event queue (RPUSH)."""
    pool = await get_redis_pool()
    if pool is None:
        return
    await pool.rpush(settings.REDIS_QUEUE_KEY, data)


async def pop_from_queue(timeout: int = 5) -> str | None:
    """
    Block-pop from the Redis event queue (BLPOP).
    Returns the raw JSON string or None on timeout.
    Returns None immediately when Redis is unavailable.
    """
    pool = await get_redis_pool()
    if pool is None:
        return None
    try:
        result = await pool.blpop(settings.REDIS_QUEUE_KEY, timeout=timeout)
    except RedisTimeoutError:
        return None
    if result:
        _, value = result
        return value
    return None
