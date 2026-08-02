"""
=============================================================
  Tracelify API Test Suite
  Tests ALL endpoints in sequence:
    Health → Auth → Orgs → Projects → Events (SDK) → Issues
=============================================================
Run with:
    python test_apis.py
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
from typing import Optional
import httpx

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL = "http://localhost:8000"
TIMEOUT = 15.0  # seconds per request

# Test user credentials (will be registered + logged in)
TEST_EMAIL = f"test_{uuid.uuid4().hex[:6]}@tracelify-test.io"
TEST_PASSWORD = "Test@1234!"
TEST_NAME = "API Tester"

# ── Colours ───────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"
DIM    = "\033[2m"

# ── State (filled as tests run) ───────────────────────────────────────────────

state: dict = {
    "token": None,
    "org_id": None,
    "project_id": None,
    "dsn_public_key": None,
    "issue_id": None,
}

pass_count = 0
fail_count = 0
results: list[dict] = []

# ── Helpers ───────────────────────────────────────────────────────────────────

def _log(label: str, status: int, ok: bool, data=None, note: str = ""):
    global pass_count, fail_count

    icon  = f"{GREEN}✅{RESET}" if ok else f"{RED}❌{RESET}"
    color = GREEN if ok else RED
    ts    = datetime.now().strftime("%H:%M:%S")

    print(f"  {icon} [{ts}] {color}{BOLD}{label}{RESET}  HTTP {status}  {DIM}{note}{RESET}")

    if data and not ok:
        # Pretty-print error body
        try:
            pretty = json.dumps(data, indent=4)
        except Exception:
            pretty = str(data)
        print(f"     {RED}Response:{RESET} {pretty[:600]}")

    if ok:
        pass_count += 1
    else:
        fail_count += 1

    results.append({"label": label, "ok": ok, "status": status, "note": note})


async def _req(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    label: str,
    token: Optional[str] = None,
    json_body=None,
    headers: dict = {},
    expected: int = 200,
    note: str = "",
) -> Optional[dict]:
    """Send a request, log result, return parsed JSON or None on failure."""
    url = f"{BASE_URL}{path}"
    hdrs = dict(headers)
    if token:
        hdrs["Authorization"] = f"Bearer {token}"

    try:
        resp = await client.request(
            method,
            url,
            json=json_body,
            headers=hdrs,
            timeout=TIMEOUT,
        )
    except httpx.ConnectError:
        _log(label, 0, False, note="❗ Connection refused — is the server running?")
        return None
    except httpx.TimeoutException:
        _log(label, 0, False, note="❗ Request timed out")
        return None

    ok = resp.status_code == expected
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    _log(label, resp.status_code, ok, data if not ok else None, note)
    return data if ok else None


# ── Wait for server ───────────────────────────────────────────────────────────

async def wait_for_server(retries: int = 15, delay: float = 2.0) -> bool:
    """Poll /health until server is ready."""
    print(f"\n{CYAN}⏳  Waiting for backend at {BASE_URL} …{RESET}")
    async with httpx.AsyncClient() as c:
        for i in range(retries):
            try:
                r = await c.get(f"{BASE_URL}/health", timeout=3)
                if r.status_code == 200:
                    print(f"{GREEN}✅  Server is up!{RESET}\n")
                    return True
            except Exception:
                pass
            print(f"   attempt {i+1}/{retries} — retrying in {delay}s …")
            await asyncio.sleep(delay)
    return False


# ── Individual test groups ────────────────────────────────────────────────────

async def test_health(client: httpx.AsyncClient):
    section("Health & Root")

    await _req(client, "GET", "/health", label="GET /health", expected=200)
    await _req(client, "GET", "/",       label="GET /",       expected=200)


async def test_auth(client: httpx.AsyncClient):
    section("Auth")

    # 1. Sign up
    data = await _req(
        client, "POST", "/auth/signup",
        label=f"POST /auth/signup  ({TEST_EMAIL})",
        json_body={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME},
        expected=201,
    )
    if data:
        state["token"] = data.get("access_token")

    # 2. Login (should also work)
    data2 = await _req(
        client, "POST", "/auth/login",
        label="POST /auth/login",
        json_body={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        expected=200,
    )
    if data2:
        state["token"] = data2.get("access_token")  # refresh token

    tok = state["token"]

    # 3. GET /auth/me
    await _req(client, "GET", "/auth/me",
               label="GET /auth/me",
               token=tok,
               expected=200)

    # 4. GET /auth/google (just checks we get a URL back)
    await _req(client, "GET", "/auth/google",
               label="GET /auth/google  (OAuth URL)",
               expected=200)

    # 5. Unauthenticated /auth/me should return 401 or 403
    async with httpx.AsyncClient() as c2:
        resp = await c2.get(f"{BASE_URL}/auth/me", timeout=TIMEOUT)
        ok = resp.status_code in (401, 403)
        _log(
            "GET /auth/me  (no token → 401/403)",
            resp.status_code,
            ok,
            None if ok else resp.json(),
            f"Got {resp.status_code} (401 or 403 both OK)",
        )


async def test_orgs(client: httpx.AsyncClient):
    section("Organizations")

    tok = state["token"]
    if not tok:
        print(f"  {YELLOW}⚠  Skipping orgs — no auth token{RESET}")
        return

    slug = f"test-org-{uuid.uuid4().hex[:6]}"

    # 1. Create org
    data = await _req(
        client, "POST", "/orgs/",
        label="POST /orgs/  (create)",
        token=tok,
        json_body={"name": "Test Organization", "slug": slug},
        expected=201,
    )
    if data:
        state["org_id"] = data.get("id")

    # 2. List my orgs
    await _req(client, "GET", "/orgs/",
               label="GET /orgs/  (list mine)",
               token=tok,
               expected=200)

    # 3. Get specific org
    if state["org_id"]:
        await _req(client, "GET", f"/orgs/{state['org_id']}",
                   label="GET /orgs/{org_id}",
                   token=tok,
                   expected=200)

    # 4. List members
    if state["org_id"]:
        await _req(client, "GET", f"/orgs/{state['org_id']}/members",
                   label="GET /orgs/{org_id}/members",
                   token=tok,
                   expected=200)

    # 5. Non-existent org → 404
    fake = uuid.uuid4()
    await _req(client, "GET", f"/orgs/{fake}",
               label="GET /orgs/{fake_id}  → 404",
               token=tok,
               expected=404,
               note="Expected 404")


async def test_projects(client: httpx.AsyncClient):
    section("Projects")

    tok    = state["token"]
    org_id = state["org_id"]

    if not tok or not org_id:
        print(f"  {YELLOW}⚠  Skipping projects — missing token or org_id{RESET}")
        return

    slug = f"test-proj-{uuid.uuid4().hex[:6]}"

    # 1. Create project
    data = await _req(
        client, "POST", f"/orgs/{org_id}/projects/",
        label="POST /orgs/{org_id}/projects/",
        token=tok,
        json_body={"name": "Test Project", "slug": slug, "platform": "python"},
        expected=201,
    )
    if data:
        state["project_id"] = data.get("project", {}).get("id")
        state["dsn_public_key"] = data.get("dsn_key", {}).get("public_key")
        dsn = data.get("dsn_key", {}).get("dsn", "N/A")
        print(f"     {DIM}DSN: {dsn}{RESET}")

    # 2. List projects in org
    await _req(client, "GET", f"/orgs/{org_id}/projects/",
               label="GET /orgs/{org_id}/projects/",
               token=tok,
               expected=200)

    # 3. Get project by ID
    if state["project_id"]:
        await _req(client, "GET", f"/projects/{state['project_id']}",
                   label="GET /projects/{project_id}",
                   token=tok,
                   expected=200)

    # 4. List DSN keys
    if state["project_id"]:
        await _req(client, "GET", f"/projects/{state['project_id']}/dsn",
                   label="GET /projects/{project_id}/dsn",
                   token=tok,
                   expected=200)

    # 5. Generate new DSN key
    if state["project_id"]:
        await _req(client, "POST", f"/projects/{state['project_id']}/dsn",
                   label="POST /projects/{project_id}/dsn  (new key)",
                   token=tok,
                   expected=201)


async def test_events(client: httpx.AsyncClient):
    section("Event Ingest (SDK)")

    project_id = state["project_id"]
    public_key = state["dsn_public_key"]

    if not project_id or not public_key:
        print(f"  {YELLOW}⚠  Skipping event ingest — missing project_id or DSN key{RESET}")
        return

    # Payload must match IngestEventRequest schema exactly:
    # Required: event_id, project_id, timestamp
    # error: { type, message, stacktrace? }
    event_payload = {
        "event_id": str(uuid.uuid4()),
        "project_id": str(project_id),
        "timestamp": datetime.utcnow().isoformat(),
        "level": "error",
        "error": {
            "type": "ZeroDivisionError",
            "message": "division by zero",
            "stacktrace": 'File "app/main.py", line 42, in compute\n    result = 1 / 0',
        },
        "tags": {"version": "1.0.0"},
        "context": {"environment": "test", "test_run": True},
        "client": {"sdk": "tracelify.python"},
    }

    # 1. Valid event via Bearer <public_key>
    data = await _req(
        client, "POST", f"/api/{project_id}/events",
        label="POST /api/{project_id}/events  (Bearer key)",
        headers={"Authorization": f"Bearer {public_key}"},
        json_body=event_payload,
        expected=202,
    )
    if data:
        print(f"     {DIM}event_id: {data.get('event_id')}  status: {data.get('status')}{RESET}")

    # 2. Same event via X-Tracelify-Key header
    await _req(
        client, "POST", f"/api/{project_id}/events",
        label="POST /api/{project_id}/events  (X-Tracelify-Key header)",
        headers={"X-Tracelify-Key": public_key},
        json_body={
            **event_payload,
            "event_id": str(uuid.uuid4()),
            "error": {"type": "KeyError", "message": "'user_id'"},
        },
        expected=202,
    )

    # 3. Missing key → 401
    await _req(
        client, "POST", f"/api/{project_id}/events",
        label="POST /api/{project_id}/events  (no key → 401)",
        json_body=event_payload,
        expected=401,
        note="Expected 401",
    )

    # 4. Wrong key → 401 (backend validates key before DSN lookup)
    bad_key = "totally-invalid-key-12345"
    await _req(
        client, "POST", f"/api/{project_id}/events",
        label="POST /api/{project_id}/events  (bad key → 401)",
        headers={"Authorization": f"Bearer {bad_key}"},
        json_body=event_payload,
        expected=401,
        note="Expected 401 (invalid DSN key)",
    )

    # Give worker a moment to process
    print(f"\n  {DIM}⏳ Waiting 3s for background worker to process events…{RESET}")
    await asyncio.sleep(3)


async def test_issues(client: httpx.AsyncClient):
    section("Issues")

    tok        = state["token"]
    project_id = state["project_id"]

    if not tok or not project_id:
        print(f"  {YELLOW}⚠  Skipping issues — missing token or project_id{RESET}")
        return

    # 1. List issues (open)
    data = await _req(
        client, "GET", f"/projects/{project_id}/issues/?status=open",
        label="GET /projects/{project_id}/issues/  (status=open)",
        token=tok,
        expected=200,
    )
    if data:
        total = data.get("total", 0)
        issues = data.get("issues", [])
        print(f"     {DIM}total={total}  returned={len(issues)}{RESET}")
        if issues:
            state["issue_id"] = issues[0].get("id")

    # 2. List issues (all)
    await _req(
        client, "GET", f"/projects/{project_id}/issues/?status=all&limit=10",
        label="GET /projects/{project_id}/issues/  (status=all)",
        token=tok,
        expected=200,
    )

    # 3. Get issue detail
    if state["issue_id"]:
        await _req(
            client, "GET", f"/projects/{project_id}/issues/{state['issue_id']}",
            label="GET /projects/{project_id}/issues/{issue_id}",
            token=tok,
            expected=200,
        )

    # 4. Get events for issue
    if state["issue_id"]:
        await _req(
            client, "GET", f"/projects/{project_id}/issues/{state['issue_id']}/events",
            label="GET /projects/{project_id}/issues/{issue_id}/events",
            token=tok,
            expected=200,
        )

    # 5. Update issue status → resolved
    if state["issue_id"]:
        await _req(
            client, "PATCH", f"/projects/{project_id}/issues/{state['issue_id']}",
            label="PATCH /projects/{project_id}/issues/{issue_id}  → resolved",
            token=tok,
            json_body={"status": "resolved"},
            expected=200,
        )

    # 6. Invalid status → 400
    if state["issue_id"]:
        await _req(
            client, "PATCH", f"/projects/{project_id}/issues/{state['issue_id']}",
            label="PATCH issue invalid status → 400",
            token=tok,
            json_body={"status": "broken"},
            expected=400,
            note="Expected 400",
        )


# ── Summary ───────────────────────────────────────────────────────────────────

def section(title: str):
    bar = "─" * 52
    print(f"\n{CYAN}{BOLD}{'─'*4} {title} {bar[:max(0,50-len(title))]}{RESET}")


def print_summary():
    total = pass_count + fail_count
    ratio = f"{pass_count}/{total}"
    color = GREEN if fail_count == 0 else (YELLOW if pass_count > fail_count else RED)

    print(f"\n{'═'*60}")
    print(f"{BOLD}  Tracelify API Test Summary{RESET}")
    print(f"{'═'*60}")
    print(f"  {color}{BOLD}{ratio} tests passed{RESET}  |  {RED}{fail_count} failed{RESET}")
    print(f"{'═'*60}")

    if fail_count:
        print(f"\n  {RED}Failed tests:{RESET}")
        for r in results:
            if not r["ok"]:
                print(f"    ❌  {r['label']}  (HTTP {r['status']})  {r['note']}")

    print()


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print(f"\n{'═'*60}")
    print(f"{BOLD}{CYAN}  🐛  Tracelify API Test Suite{RESET}")
    print(f"  Base URL : {BASE_URL}")
    print(f"  Test user: {TEST_EMAIL}")
    print(f"{'═'*60}")

    # Check server is up
    ready = await wait_for_server()
    if not ready:
        print(f"\n{RED}❌  Backend did not become ready in time. Aborting.{RESET}")
        print("   Start it manually:  cd backend && uvicorn main:app --reload\n")
        sys.exit(1)

    async with httpx.AsyncClient() as client:
        await test_health(client)
        await test_auth(client)
        await test_orgs(client)
        await test_projects(client)
        await test_events(client)
        await test_issues(client)

    print_summary()

    # Exit with non-zero code if any test failed
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
