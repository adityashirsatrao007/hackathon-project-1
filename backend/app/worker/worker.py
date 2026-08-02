"""
Background worker — runs as an asyncio task alongside FastAPI.
Continuously BLPOP from the Redis queue and calls process_event().

Can also be run as a standalone process:
  python -m app.worker.worker
"""
import asyncio
from loguru import logger

from app.core.redis import pop_from_queue, close_redis_pool
from app.worker.processor import process_event


async def run_worker() -> None:
    """
    Infinite loop: block-pop from Redis, process each event.
    Runs as a background task (started in FastAPI lifespan).
    """
    logger.info("🚀 Tracelify worker started — listening on Redis queue...")

    while True:
        try:
            raw = await pop_from_queue(timeout=5)

            if raw is None:
                # Timeout — no events, loop again
                continue

            logger.debug(f"📨 Dequeued event ({len(raw)} bytes)")
            await process_event(raw)

        except asyncio.CancelledError:
            logger.info("🛑 Worker cancelled — shutting down")
            break
        except Exception as exc:
            # Never crash the worker loop
            logger.exception(f"Worker loop error (will continue): {exc}")
            await asyncio.sleep(1)


# ── Standalone entry point ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    import os

    # Allow running from the backend/ directory
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

    async def main() -> None:
        try:
            await run_worker()
        finally:
            await close_redis_pool()

    asyncio.run(main())
