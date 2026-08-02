#!/usr/bin/env python3
"""
cannon.py — Tracelify Autocannon (1-minute stress test)
═══════════════════════════════════════════════════════
Fires concurrent requests at the deployed backend for 60 seconds.
Tracks: req/s, avg latency, p50, p95, p99, min, max, errors.

Run:
    python3 cannon.py

Requires:  pip install httpx
"""

import asyncio
import time
import uuid
import sys
import statistics
import httpx
from collections import defaultdict

# ── Config ─────────────────────────────────────────────────────────────────────
BASE          = "http://54.251.156.151:8000"
DURATION_SEC  = 60         
CONCURRENCY   = 20          
TIMEOUT_SEC   = 10.0       

# ── Shared State ───────────────────────────────────────────────────────────────
latencies   = []            
errors      = []           
status_map  = defaultdict(int)
req_count   = 0
start_wall  = 0.0

# Rate display
_last_count  = 0
_last_ts     = 0.0

# ── Bootstrap: create one account + project + DSN once ────────────────────────
token        = None
project_id   = None
dsn_key      = None
headers_auth = {}


async def bootstrap(client: httpx.AsyncClient):
    global token, project_id, dsn_key, headers_auth
    rand = uuid.uuid4().hex[:8]
    email = f"cannon_{rand}@bench.io"
    pw    = "Cannon1234!"

    # Sign up
    r = await client.post(f"{BASE}/auth/signup",
                          json={"email": email, "name": "Cannon Bot", "password": pw},
                          timeout=15)
    if r.status_code not in (200, 201):
        print(f"  ❌ Signup failed: {r.status_code} {r.text[:120]}")
        sys.exit(1)

    # Login
    r = await client.post(f"{BASE}/auth/login",
                          json={"email": email, "password": pw},
                          timeout=15)
    token        = r.json()["access_token"]
    headers_auth = {"Authorization": f"Bearer {token}"}

    # Create org
    slug_org = f"cannon-org-{rand}"
    r = await client.post(f"{BASE}/orgs/",
                          json={"name": "Cannon Org", "slug": slug_org},
                          headers=headers_auth, timeout=15)
    org_id = r.json().get("id")

    # Create project
    r = await client.post(f"{BASE}/orgs/{org_id}/projects/",
                          json={"name": "Cannon Proj",
                                "slug": f"cannon-proj-{rand}",
                                "platform": "python"},
                          headers=headers_auth, timeout=15)
    data       = r.json()
    project_id = data.get("project", {}).get("id")
    dsn_raw    = data.get("dsn_key", {}).get("dsn", "")

    # Parse DSN → public key
    try:
        dsn_key = dsn_raw.split("://")[1].split("@")[0]
    except Exception:
        dsn_key = None

    print(f"  ✅ Bootstrap done | project_id={project_id} | dsn_key={dsn_key[:8]}...")


# ── Request helpers ─────────────────────────────────────────────────────────────

async def fire(client: httpx.AsyncClient, method: str, url: str,
               tag: str, **kwargs):
    global req_count
    t0 = time.perf_counter()
    try:
        resp = await getattr(client, method)(url, timeout=TIMEOUT_SEC, **kwargs)
        lat  = (time.perf_counter() - t0) * 1000
        latencies.append(lat)
        status_map[resp.status_code] += 1
        req_count += 1
    except Exception as e:
        lat = (time.perf_counter() - t0) * 1000
        errors.append((tag, str(e)[:60]))
        req_count += 1


def build_event_payload() -> dict:
    return {
        "event_id": uuid.uuid4().hex,
        "timestamp": "2026-04-05T09:00:00+00:00",
        "level": "error",
        "release": "cannon@1.0.0",
        "error": {
            "type":       "CannonError",
            "message":    f"Load test exception #{uuid.uuid4().hex[:6]}",
            "stacktrace": "File cannon.py, line 42, in fire\n  raise CannonError('load test')",
        },
        "context": {"os": "Linux", "runtime": "python"},
        "tags":    {"env": "load-test"},
    }


# ── Worker: fires a random mix of requests for 60 s ───────────────────────────

async def worker(client: httpx.AsyncClient, worker_id: int):
    deadline = start_wall + DURATION_SEC
    cycle    = 0

    while time.time() < deadline:
        step = cycle % 5

        if step == 0:
            # Health check — cheapest endpoint
            await fire(client, "get", f"{BASE}/health", "GET /health")

        elif step == 1:
            # SDK ingest — the hot path we care most about
            if project_id and dsn_key:
                await fire(client, "post",
                           f"{BASE}/api/{project_id}/events",
                           "POST /api/{id}/events",
                           json=build_event_payload(),
                           headers={"Authorization": f"Bearer {dsn_key}"})

        elif step == 2:
            # List issues (read query, hits GIN index)
            if project_id:
                await fire(client, "get",
                           f"{BASE}/projects/{project_id}/issues/?status=open",
                           "GET /issues/ open",
                           headers=headers_auth)

        elif step == 3:
            # Root endpoint
            await fire(client, "get", f"{BASE}/", "GET /")

        elif step == 4:
            # List projects (authenticated read)
            if project_id:
                await fire(client, "get",
                           f"{BASE}/projects/{project_id}",
                           "GET /projects/{id}",
                           headers=headers_auth)

        cycle += 1
        # tiny yield so we don't pin CPU
        await asyncio.sleep(0)


# ── Live stats printer ─────────────────────────────────────────────────────────

async def print_live():
    global _last_count, _last_ts
    _last_ts    = time.time()
    _last_count = 0
    deadline    = start_wall + DURATION_SEC

    while time.time() < deadline:
        await asyncio.sleep(5)
        now      = time.time()
        elapsed  = now - start_wall
        window   = now - _last_ts
        rps      = (req_count - _last_count) / window if window > 0 else 0
        avg_lat  = statistics.mean(latencies) if latencies else 0
        err_rate = len(errors) / req_count * 100 if req_count else 0
        remaining = max(0, DURATION_SEC - elapsed)

        _last_count = req_count
        _last_ts    = now

        tick = "█" * int(elapsed / DURATION_SEC * 30)
        bar  = f"[{tick:<30}]"
        print(f"  {bar} {elapsed:4.0f}s  "
              f"rps={rps:5.1f}  avg={avg_lat:5.1f}ms  "
              f"total={req_count}  err={err_rate:.1f}%  "
              f"left={remaining:.0f}s")


# ── Final report ───────────────────────────────────────────────────────────────

def print_report(duration: float):
    print()
    print("╔" + "═" * 62 + "╗")
    print("║   TRACELIFY CANNON — 1-MINUTE LOAD TEST RESULTS              ║")
    print("╠" + "═" * 62 + "╣")

    total_req = req_count
    total_err = len(errors)
    ok        = total_req - total_err
    rps       = total_req / duration if duration > 0 else 0

    print(f"║  Duration       : {duration:.1f}s")
    print(f"║  Concurrency    : {CONCURRENCY} workers")
    print(f"║  Total requests : {total_req}")
    print(f"║  Successful     : {ok}  ({ok/total_req*100:.1f}%)" if total_req else "║  Successful     : 0")
    print(f"║  Errors         : {total_err}  ({total_err/total_req*100:.1f}%)" if total_req else "║  Errors         : 0")
    print(f"║  Req/sec        : {rps:.1f}")
    print("╠" + "═" * 62 + "╣")

    if latencies:
        lat_sorted = sorted(latencies)
        p = lambda pct: lat_sorted[int(len(lat_sorted) * pct / 100)]
        print(f"║  Latency (ms):")
        print(f"║    Min   : {min(latencies):.1f} ms")
        print(f"║    Avg   : {statistics.mean(latencies):.1f} ms")
        print(f"║    p50   : {p(50):.1f} ms")
        print(f"║    p75   : {p(75):.1f} ms")
        print(f"║    p95   : {p(95):.1f} ms")
        print(f"║    p99   : {p(99):.1f} ms")
        print(f"║    Max   : {max(latencies):.1f} ms")
        print(f"║    StdDev: {statistics.stdev(latencies):.1f} ms" if len(latencies) > 1 else "")
    else:
        print("║  No successful latency samples recorded.")

    print("╠" + "═" * 62 + "╣")
    print("║  HTTP Status Codes:")
    for code, cnt in sorted(status_map.items()):
        bar = "█" * min(cnt // 5, 30)
        print(f"║    {code}  {cnt:5d}  {bar}")

    if errors:
        print("╠" + "═" * 62 + "╣")
        print("║  Error Sample (first 5):")
        for endpoint, msg in errors[:5]:
            print(f"║    [{endpoint[:20]}] {msg[:38]}")

    print("╠" + "═" * 62 + "╣")

    # Verdict
    avg = statistics.mean(latencies) if latencies else 9999
    p95_val = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 9999
    err_pct = total_err / total_req * 100 if total_req else 100

    if avg < 100 and p95_val < 300 and err_pct < 2:
        verdict = "🟢 EXCELLENT — Backend is fast and stable"
    elif avg < 300 and p95_val < 800 and err_pct < 5:
        verdict = "🟡 GOOD — Minor latency spikes under load"
    elif avg < 800 and err_pct < 15:
        verdict = "🟠 FAIR — Noticeable slowdowns, consider optimizing"
    else:
        verdict = "🔴 DEGRADED — High latency or error rate detected"

    print(f"║  Verdict: {verdict}")
    print("╚" + "═" * 62 + "╝")


# ── Main ────────────────────────────────────────────────────────────────────────

async def main():
    global start_wall

    print()
    print("╔" + "═" * 62 + "╗")
    print("║   🔥 TRACELIFY CANNON — Autocannon Load Tester              ║")
    print("╠" + "═" * 62 + "╣")
    print(f"║  Target      : {BASE}")
    print(f"║  Duration    : {DURATION_SEC}s")
    print(f"║  Concurrency : {CONCURRENCY} workers")
    print("╚" + "═" * 62 + "╝")
    print()
    print("  ⚙️  Bootstrapping test account...")

    limits  = httpx.Limits(max_connections=CONCURRENCY + 5,
                           max_keepalive_connections=CONCURRENCY)
    async with httpx.AsyncClient(limits=limits, follow_redirects=True) as client:
        try:
            await bootstrap(client)
        except Exception as e:
            print(f"  ❌ Bootstrap failed: {e}")
            sys.exit(1)

        print(f"  🚀 Firing {CONCURRENCY} workers for {DURATION_SEC}s...\n")
        start_wall = time.time()

        workers = [asyncio.create_task(worker(client, i))
                   for i in range(CONCURRENCY)]
        printer = asyncio.create_task(print_live())

        await asyncio.gather(*workers)
        printer.cancel()

    actual_duration = time.time() - start_wall
    print_report(actual_duration)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n  ⛔ Interrupted by user.")
        if req_count:
            print_report(time.time() - start_wall)
