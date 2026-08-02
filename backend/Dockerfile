# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Install dependencies in a separate stage to keep final image lean
FROM python:3.11-slim AS builder

WORKDIR /app

# System deps needed to compile asyncpg, bcrypt, cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Non-root user for security
RUN groupadd -r tracelify && useradd -r -g tracelify tracelify

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Remove dev/test files not needed in production
RUN rm -f test_sdk.py test_email.py latency_check.py seed_alert_rule.py apply_indexes.py && \
    find . -name "*.pyc" -delete && \
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Own files by non-root user
RUN chown -R tracelify:tracelify /app

USER tracelify

# ── Runtime config ─────────────────────────────────────────────────────────────
# These are defaults — override via docker run -e or .env file / Compose
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    WORKERS=2

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import httpx, sys; r=httpx.get('http://localhost:8000/health',timeout=5); sys.exit(0 if r.status_code==200 else 1)"

# ── Entrypoint ─────────────────────────────────────────────────────────────────
CMD ["sh", "-c", "uvicorn main:app --host $HOST --port $PORT --workers $WORKERS --no-access-log"]
