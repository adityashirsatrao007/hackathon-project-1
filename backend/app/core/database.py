from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings
from loguru import logger


# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,          # 10 persistent connections (was 5)
    max_overflow=20,       # up to 30 total under burst (was 10)
    pool_pre_ping=True,    # detect dead connections before use
    pool_recycle=300,      # recycle idle connections every 5 min
    pool_timeout=10,       # fail fast if pool exhausted (was infinite)
    connect_args={
        # ssl=require is already in DATABASE_URL query string — asyncpg picks it up.
        # statement/prepared cache must be 0 for Neon’s PgBouncer pooler.
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        # Reduce TCP connect timeout from default 60s
        "timeout": 10,
    },
)

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Base ──────────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Lifecycle helpers ─────────────────────────────────────────────────────────
async def init_db() -> None:
    """Create all tables if they don't exist (dev only). Use Alembic in prod."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialised")


async def check_db_connection() -> bool:
    """Ping the database."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error(f"❌ DB connection failed: {exc}")
        return False


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
