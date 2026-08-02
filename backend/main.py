import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from loguru import logger

from app.core.config import settings
from app.core.database import init_db, check_db_connection
from app.core.redis import get_redis_pool, close_redis_pool

# Import all models so SQLAlchemy sees them before create_all()
import app.models  # noqa: F401

from app.routers import auth, orgs, projects, events, issues, report, alerts
from app.worker.worker import run_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + shutdown lifecycle."""
    logger.info(f"🚀 Starting {settings.APP_NAME} backend [{settings.APP_ENV}]")

    # 1. Check DB
    if await check_db_connection():
        logger.info("✅ PostgreSQL (Neon) connected")
    else:
        logger.error("❌ PostgreSQL connection FAILED — events will still queue")

    # 2. Init tables (no Alembic yet — run create_all in all envs)
    await init_db()

    # 3. Warm Redis pool (graceful — app works without it)
    redis_ok = await get_redis_pool() is not None
    if redis_ok:
        logger.info("✅ Redis connected")

    # 4. Start background worker (only if Redis is available)
    if redis_ok:
        worker_task = asyncio.create_task(run_worker())
        logger.info("✅ Background worker started")
    else:
        worker_task = None
        logger.info("⚠️ Background worker disabled (no Redis)")

    yield  # ── app is running ──

    # Shutdown
    logger.info("🛑 Shutting down...")
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass

    await close_redis_pool()
    logger.info("👋 Tracelify backend stopped")


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Tracelify API",
    description="""
## 🐛 Tracelify — Error Tracking Backend

Production-grade error tracking system (Sentry-like) built with FastAPI.

### Features
- **User Auth** — Google OAuth2 + email/password + JWT
- **Organizations & Projects** — multi-tenant with role-based access
- **DSN Generation** — unique key per project for SDK integration
- **Event Ingest** — SDK posts errors → validated → queued → stored
- **Issue Grouping** — smart fingerprinting groups related errors
- **Alerts** — event count thresholds, new issue triggers, email/webhook
- **LLM Reports** — AI-powered project health reports via Amazon Nova Pro

### SDK DSN format
```
http://<public_key>@<host>/api/<project_id>/events
```
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS ───────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "https://tracelify.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── GZip — compress JSON responses 60-80% (min 500 bytes) ────────────────────
app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(orgs.router)
app.include_router(projects.router)
app.include_router(events.router)
app.include_router(issues.router)
app.include_router(report.router)
app.include_router(alerts.router)


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health():
    db_ok = await check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "db": "connected" if db_ok else "disconnected",
    }


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "health": "/health",
    }
