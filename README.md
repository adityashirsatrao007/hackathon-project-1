# 🔍 Tracelify SDK — Multi-Language Error Tracking & Observability

![Python 3.11](https://img.shields.io/badge/python-3.11-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker)
![PyPI](https://img.shields.io/pypi/v/tracelify-sdk?logo=pypi)

## Overview

Tracelify is a cross-platform error tracking and observability SDK that monitors application errors in real-time across Python, Java, Kotlin, Go, C++, and JavaScript runtimes.

### Key Features

- **Multi-language SDK support** — Python, Java, Kotlin, Go, C++, JavaScript
- **Real-time error capture and alerting**
- **LLM-powered error report generation** (AWS Bedrock)
- **Email/SMS alert rules**
- **Interactive dashboard** with charts and trends
- **Mobile app** (React Native)

## SDK Languages

| Language   | Path           | Status         |
|------------|----------------|----------------|
| Python     | `tracelify/`   | ✅ Production  |
| Java       | `java/`        | ✅ Stable      |
| Kotlin     | `kotlin/`      | ✅ Stable      |
| Go         | `go/`          | ✅ Stable      |
| C++        | `cpp/`         | ✅ Stable      |
| JavaScript | `javascript/`  | ✅ Stable      |

## Quick Start

### Python SDK

```bash
pip install tracelify-sdk
```

```python
import tracelify

tracelify.init(dsn="https://key@your-host.com/project")

with tracelify.capture_exceptions():
    1 / 0  # Will be captured automatically
```

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with DATABASE_URL, Redis URL, etc.
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Architecture

Brief description: FastAPI backend → PostgreSQL + Redis, React dashboard, multi-language SDKs sending events via REST API.

## Docker Deployment

```bash
docker-compose up --build
```

## API Endpoints

| Method | Endpoint             | Description          |
|--------|----------------------|----------------------|
| POST   | `/api/auth/register` | Register             |
| POST   | `/api/auth/login`    | Login                |
| POST   | `/api/projects`      | Create project       |
| POST   | `/api/events/ingest` | Ingest error event   |
| GET    | `/api/issues`        | List issues          |
| POST   | `/api/alerts/rules`  | Create alert rule    |

## PyPI Package

Published at: https://pypi.org/project/tracelify-sdk/

## License

MIT — see [LICENSE](LICENSE)
