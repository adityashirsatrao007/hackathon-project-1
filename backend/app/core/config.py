from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_KNOWN_WEAK_SECRETS = {
    "change-me-in-production-use-256-bit-key",
    "change-me-in-production-must-be-32-chars-minimum",
    "super-secret-key-change-in-production",
    "nyaya-secret-key-change-in-production",
    "nyaya-test-secret-key",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "Tracelify"
    APP_ENV: str = "development"
    DEBUG: bool = True
    BACKEND_URL: str = "http://localhost:8000"

    # Security
    SECRET_KEY: str  # No default — must be set via env var

    @field_validator("SECRET_KEY")
    @classmethod
    def reject_weak_secret(cls, v: str) -> str:
        if v in _KNOWN_WEAK_SECRETS:
            raise ValueError(
                "SECRET_KEY is set to a known weak/default value. "
                "Generate a strong key with: openssl rand -base64 48"
            )
        if len(v) < 32:
            raise ValueError(
                f"SECRET_KEY must be at least 32 characters (got {len(v)}). "
                "Generate one with: openssl rand -base64 48"
            )
        return v
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    ALGORITHM: str = "HS256"

    # Database (Neon PostgreSQL) — set via DATABASE_URL env var
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/tracelify"

    @field_validator("DATABASE_URL")
    @classmethod
    def ensure_async_scheme(cls, v: str) -> str:
        url = v
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        # asyncpg uses ?ssl= not ?sslmode=
        url = url.replace("sslmode=require", "ssl=require")
        url = url.replace("sslmode=prefer", "ssl=prefer")
        url = url.replace("sslmode=disable", "ssl=false")
        return url

    # Redis — set via REDIS_HOST / REDIS_PORT / REDIS_PASSWORD env vars
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_USERNAME: str = ""
    REDIS_PASSWORD: str = ""
    REDIS_SSL: bool = False
    REDIS_QUEUE_KEY: str = "tracelify:events:queue"
    REDIS_SOCKET_CONNECT_TIMEOUT: int = 5
    REDIS_SOCKET_TIMEOUT: int = 30

    @property
    def REDIS_URL(self) -> str:  # type: ignore[override]
        """Build redis:// URL from individual fields."""
        return (
            f"redis://{self.REDIS_USERNAME}:{self.REDIS_PASSWORD}"
            f"@{self.REDIS_HOST}:{self.REDIS_PORT}"
        )

    # Frontend (Vite dev server port by default)
    FRONTEND_URL: str = "http://localhost:5173"

    # Email Alerts
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    ALERT_FROM_EMAIL: str = "alerts@tracelify.io"


settings = Settings()
