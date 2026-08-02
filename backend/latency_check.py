"""
latency_check.py
────────────────
Tests every Tracelify API endpoint and measures response latency.
Run: python3 latency_check.py

No auth token needed — script signs up/logs in automatically.
"""
import asyncio
import time
import uuid

import httpx

BASE = "http://localhost:8000"
RESULTS = []


def ms(seconds: float) -> str:
    v = seconds * 1000
    return f"{v:6.1f}ms"


async def hit(client: httpx.AsyncClient, method: str, path: str, label: str, **kwargs):
    url = f"{BASE}{path}"
    start = time.perf_counter()
    try:
        resp = await getattr(client, method)(url, **kwargs)
        elapsed = time.perf_counter() - start
        status = resp.status_code
        ok = status < 400
        icon = "✅" if ok else "⚠️ "
        row = (label, elapsed, status, ok)
        RESULTS.append(row)
        print(f"  {icon} {ms(elapsed)}  [{status}]  {label}")
        return resp
    except Exception as e:
        elapsed = time.perf_counter() - start
        print(f"  ❌ {ms(elapsed)}  [ERR]  {label} — {e}")
        RESULTS.append((label, elapsed, 0, False))
        return None


async def main():
    print("=" * 60)
    print("  Tracelify API Latency Check")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:

        # ── Health / Root ─────────────────────────────────────────────────────
        print("\n📡 Health Checks")
        await hit(client, "get", "/",       "GET /  (root)")
        await hit(client, "get", "/health", "GET /health")
        await hit(client, "get", "/docs",   "GET /docs  (Swagger UI)")
        await hit(client, "get", "/report/health", "GET /report/health  (LLM check)")

        # ── Auth — sign up then log in ────────────────────────────────────────
        print("\n🔐 Auth")
        rand = uuid.uuid4().hex[:6]
        email = f"latency_{rand}@test.com"
        password = "Test1234!"

        r = await hit(client, "post", "/auth/signup",
                      "POST /auth/signup",
                      json={"email": email, "name": "Latency Bot", "password": password})

        r2 = await hit(client, "post", "/auth/login",
                       "POST /auth/login",
                       json={"email": email, "password": password})

        if r2 is None or r2.status_code != 200:
            print("\n❌ Login failed — cannot test authenticated endpoints.")
            return

        token = r2.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}

        # ── Organizations ─────────────────────────────────────────────────────
        print("\n🏢 Organizations")
        slug = f"latency-org-{rand}"
        r3 = await hit(client, "post", "/orgs/",
                       "POST /orgs/  (create)",
                       json={"name": "Latency Org", "slug": slug},
                       headers=headers)

        org_id = r3.json().get("id") if r3 and r3.status_code == 201 else None

        await hit(client, "get", "/orgs/",
                  "GET /orgs/  (list my orgs)", headers=headers)

        if org_id:
            await hit(client, "get", f"/orgs/{org_id}",
                      "GET /orgs/{id}", headers=headers)
            await hit(client, "get", f"/orgs/{org_id}/members",
                      "GET /orgs/{id}/members", headers=headers)
            await hit(client, "get", f"/orgs/{org_id}/my-role",
                      "GET /orgs/{id}/my-role", headers=headers)

        # ── Projects ──────────────────────────────────────────────────────────
        print("\n📁 Projects")
        project_id = dsn = None
        if org_id:
            r4 = await hit(client, "post", f"/orgs/{org_id}/projects/",
                           "POST /orgs/{id}/projects/  (create)",
                           json={"name": "Latency Project", "slug": f"latency-proj-{rand}", "platform": "python"},
                           headers=headers)
            if r4 and r4.status_code == 201:
                data = r4.json()
                project_id = data.get("project", {}).get("id")
                dsn = data.get("dsn_key", {}).get("dsn")

            await hit(client, "get", f"/orgs/{org_id}/projects/",
                      "GET /orgs/{id}/projects/  (list)", headers=headers)

            if project_id:
                await hit(client, "get", f"/projects/{project_id}",
                          "GET /projects/{id}", headers=headers)
                await hit(client, "get", f"/projects/{project_id}/dsn",
                          "GET /projects/{id}/dsn", headers=headers)

        # ── Alert Rules ───────────────────────────────────────────────────────
        print("\n🔔 Alert Rules")
        if project_id:
            r5 = await hit(client, "post", f"/projects/{project_id}/alert-rules/",
                           "POST /projects/{id}/alert-rules/  (create)",
                           json={
                               "name": "Latency Test Rule",
                               "condition": {"type": "new_issue"},
                               "action": {"type": "email", "recipients": ["test@test.com"]},
                           },
                           headers=headers)
            if r5 and r5.status_code == 201:
                _alert_id = r5.json().get("id")

            await hit(client, "get", f"/projects/{project_id}/alert-rules/",
                      "GET /projects/{id}/alert-rules/  (list)", headers=headers)

        # ── Event Ingest (SDK path) ───────────────────────────────────────────
        print("\n📥 Event Ingest (SDK path)")
        event_id = uuid.uuid4().hex
        if dsn:
            # Parse DSN: http://<key>@host/api/<project_id>/events
            try:
                key_part = dsn.split("://")[1].split("@")[0]
                path_part = dsn.split("@")[1].replace("localhost:8000", "")
                ingest_headers = {"Authorization": f"Bearer {key_part}"}
                _r6 = await hit(client, "post", path_part,
                               "POST /api/{proj_id}/events  (SDK ingest)",
                               json={
                                   "event_id": event_id,
                                   "timestamp": "2026-04-05T04:00:00+00:00",
                                   "level": "error",
                                   "error": {
                                       "type": "LatencyTestError",
                                       "message": "This is a latency test",
                                       "stacktrace": "File test.py line 1\nLatencyTestError: latency test",
                                   },
                               },
                               headers=ingest_headers)
                # small wait for worker to process
                await asyncio.sleep(2)
            except Exception as e:
                print(f"  ❌ DSN parse error: {e}")

        # ── Issues ────────────────────────────────────────────────────────────
        print("\n🐛 Issues")
        issue_id = None
        if project_id:
            r7 = await hit(client, "get", f"/projects/{project_id}/issues/",
                           "GET /projects/{id}/issues/  (list open)", headers=headers)
            if r7 and r7.status_code == 200:
                issues = r7.json().get("issues", [])
                if issues:
                    issue_id = issues[0]["id"]

            await hit(client, "get", f"/projects/{project_id}/issues/?status=all",
                      "GET /projects/{id}/issues/?status=all", headers=headers)

            if issue_id:
                await hit(client, "get", f"/projects/{project_id}/issues/{issue_id}",
                          "GET /projects/{id}/issues/{issue_id}", headers=headers)
                await hit(client, "get", f"/projects/{project_id}/issues/{issue_id}/events",
                          "GET /issues/{id}/events", headers=headers)

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        total   = len(RESULTS)
        passed  = sum(1 for r in RESULTS if r[3])
        failed  = total - passed
        avg_ms  = sum(r[1] for r in RESULTS) / total * 1000 if total else 0
        slow    = [r for r in RESULTS if r[1] > 0.5]  # >500ms
        fastest = min(RESULTS, key=lambda r: r[1])
        slowest = max(RESULTS, key=lambda r: r[1])

        print(f"  Total endpoints : {total}")
        print(f"  ✅ Passed       : {passed}")
        print(f"  ❌ Failed       : {failed}")
        print(f"  ⏱  Avg latency  : {avg_ms:.1f}ms")
        print(f"  🚀 Fastest      : {ms(fastest[1])}  {fastest[0]}")
        print(f"  🐢 Slowest      : {ms(slowest[1])}  {slowest[0]}")
        if slow:
            print("\n  ⚠️  Slow (>500ms):")
            for r in slow:
                print(f"     {ms(r[1])}  {r[0]}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
