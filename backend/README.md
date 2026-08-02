# Tracelify Backend

Production-grade error tracking backend (Sentry-like) built with FastAPI.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn |
| Auth | Google OAuth2 + JWT (python-jose) |
| ORM | SQLAlchemy 2.0 async + asyncpg |
| Database | Neon Cloud (PostgreSQL) |
| Queue | Cloud Redis (asyncio) |
| Worker | asyncio background task (BLPOP) |
| Password | bcrypt (passlib) |
| Alerts | Email (aiosmtplib) + Webhook (httpx) |

## Folder Structure

```
backend/
├── main.py                        ← FastAPI app entry point
├── requirements.txt
├── .env.example                   ← Copy to .env
├── db_schema.sql                  ← Run this on Neon
└── app/
    ├── core/
    │   ├── config.py              ← All env settings (pydantic-settings)
    │   ├── database.py            ← Async SQLAlchemy + Neon
    │   ├── redis.py               ← Redis queue helpers
    │   ├── security.py            ← JWT + bcrypt
    │   └── deps.py                ← FastAPI dependencies
    ├── models/                    ← SQLAlchemy ORM models
    │   ├── user.py
    │   ├── org.py                 ← Organization + OrganizationMember
    │   ├── project.py             ← Project + DsnKey
    │   ├── issue.py
    │   └── event.py               ← Event + AlertRule
    ├── schemas/                   ← Pydantic v2 schemas
    │   ├── auth.py
    │   ├── org.py
    │   ├── project.py
    │   ├── event.py
    │   └── issue.py
    ├── routers/                   ← API route handlers
    │   ├── auth.py                ← signup, login, Google OAuth
    │   ├── orgs.py
    │   ├── projects.py            ← create + DSN generation
    │   ├── events.py              ← SDK ingest endpoint
    │   └── issues.py
    ├── services/
    │   ├── auth_service.py        ← Google OAuth flow + email login
    │   ├── ingest_service.py      ← DSN validation + Redis push
    │   └── alert_service.py       ← Alert rule evaluation
    └── worker/
        ├── worker.py              ← Redis BLPOP loop
        └── processor.py           ← Event → Issue → Alerts pipeline
```

## Setup

### 1. Clone and install

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

Key variables:
- `DATABASE_URL` — Your Neon PostgreSQL connection string (already pre-filled)
- `REDIS_URL` — Your Cloud Redis URL
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — From Google Cloud Console
- `SECRET_KEY` — Random 32+ char string for JWT signing

### 3. Set up the database

Run `db_schema.sql` directly in your Neon SQL editor or:

```bash
psql "postgresql://neondb_owner:...@.../neondb?sslmode=require" -f db_schema.sql
```

### 4. Start the server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit: http://localhost:8000/docs

---

## API Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register with email + password |
| POST | `/auth/login` | Login with email + password |
| GET | `/auth/google` | Get Google OAuth consent URL |
| GET | `/auth/google/callback?code=...` | Handle Google redirect → JWT |
| GET | `/auth/me` | Get current user info |

### Organizations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/orgs/` | Create org |
| GET | `/orgs/` | List my orgs |
| GET | `/orgs/{id}` | Org detail |
| POST | `/orgs/{id}/members` | Add member |
| GET | `/orgs/{id}/members` | List members |

### Projects + DSN

| Method | Path | Description |
|--------|------|-------------|
| POST | `/orgs/{org_id}/projects/` | Create project + generate DSN |
| GET | `/orgs/{org_id}/projects/` | List projects |
| GET | `/projects/{id}` | Project detail |
| GET | `/projects/{id}/dsn` | List DSN keys |
| POST | `/projects/{id}/dsn` | Rotate / add DSN key |

### Event Ingest (SDK → Backend)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/{project_id}/events` | Ingest event from SDK |

**Headers required:**
```
Authorization: Bearer <public_key>
```

### Issues

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{id}/issues/` | List issues (filter by status/level) |
| GET | `/projects/{id}/issues/{issue_id}` | Issue detail |
| PATCH | `/projects/{id}/issues/{issue_id}` | Update status |
| GET | `/projects/{id}/issues/{issue_id}/events` | Events in issue |

---

## DSN Format

```
http://<public_key>@<host>:<port>/api/<project_id>/events
```

Example:
```python
sdk = Tracelify(
    dsn="http://abc123def456@localhost:8000/api/550e8400-e29b-41d4-a716.../events",
    release="1.0.0"
)
```

---

## Event Flow

```
SDK (user app)
    │
    │  POST /api/{project_id}/events
    │  Authorization: Bearer <public_key>
    ▼
FastAPI /routers/events.py
    │
    ├── validate DSN (public_key + project_id in dsn_keys table)
    │
    ▼
Redis Queue  (RPUSH → tracelify:events:queue)
    │
    ▼
Background Worker (BLPOP)
    │
    ▼
processor.py
    ├── compute fingerprint (error_type + stacktrace hash)
    ├── INSERT event row
    ├── UPSERT issue (create new or increment event_count + update last_seen)
    └── evaluate alert rules
            ├── email (aiosmtplib)
            └── webhook (httpx POST)
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web Application)
3. Add authorized redirect URI: `http://localhost:8000/auth/google/callback`
4. Copy Client ID + Secret to `.env`

**Frontend flow:**
```
1. GET /auth/google → { url: "https://accounts.google.com/..." }
2. Redirect user to url
3. Google redirects to: /auth/google/callback?code=...
4. Response: { access_token: "...", user: {...} }
5. Store token, use as: Authorization: Bearer <token>
```

---

## Alert Rules

Create alert rules via DB directly (or add POST route):

```json
{
  "name": "Too many errors",
  "condition": {
    "type": "event_count",
    "threshold": 10,
    "window_minutes": 60
  },
  "action": {
    "type": "email",
    "recipients": ["admin@yourcompany.com"]
  }
}
```

Condition types: `event_count` | `new_issue` | `issue_level`  
Action types: `email` | `webhook`
