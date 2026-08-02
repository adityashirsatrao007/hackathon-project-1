#!/usr/bin/env python3
"""
Tracelify DB Retrieval Benchmark
Connects directly via asyncpg (no ORM overhead) to measure raw query latency.
Run: python3 db_benchmark.py
"""
import asyncio
import time
import statistics

import asyncpg

# ── Config ────────────────────────────────────────────────────────────────────
DSN = (
    "postgresql://neondb_owner:npg_tK8Lj1uMOrRI"
    "@ep-long-fog-a115bxx6-pooler.ap-southeast-1.aws.neon.tech"
    "/neondb?sslmode=require"
)
RUNS = 10


# ── Benchmark helper ──────────────────────────────────────────────────────────
async def bench(label: str, conn, query: str, *args, runs: int = RUNS):
    times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        await conn.fetch(query, *args)
        times.append((time.perf_counter() - t0) * 1000)
    avg = statistics.mean(times)
    p95 = sorted(times)[max(0, int(runs * 0.95) - 1)]
    status = "🟢" if avg < 50 else "🟡" if avg < 150 else "🔴"
    print(f"  {status} {label:<48} avg={avg:>6.1f}ms  p95={p95:>6.1f}ms")


async def main():
    print()
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║            Tracelify — DB Retrieval Benchmark                    ║")
    print(f"║            Runs per query: {RUNS:<38} ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print()

    conn = await asyncpg.connect(DSN)

    # ── Warm up ───────────────────────────────────────────────────────────────
    await conn.fetch("SELECT 1")
    print("  [Connection pool warmed up]\n")

    # ── Sample IDs from DB ────────────────────────────────────────────────────
    users    = await conn.fetch("SELECT id FROM users LIMIT 1")
    orgs     = await conn.fetch("SELECT id FROM organizations LIMIT 1")
    projects = await conn.fetch("SELECT id FROM projects LIMIT 1")

    user_id    = users[0]["id"]    if users    else None
    org_id     = orgs[0]["id"]     if orgs     else None
    project_id = projects[0]["id"] if projects else None

    # ── Queries ───────────────────────────────────────────────────────────────
    await bench("Raw ping (SELECT 1)",
                conn, "SELECT 1")

    if user_id:
        await bench("SELECT user by id (auth hot path)",
                    conn, "SELECT * FROM users WHERE id = $1", user_id)

    if user_id:
        await bench("SELECT orgs for user",
                    conn,
                    """SELECT o.* FROM organizations o
                       JOIN organization_members m ON m.org_id = o.id
                       WHERE m.user_id = $1""",
                    user_id)

    if org_id:
        await bench("SELECT projects for org",
                    conn, "SELECT * FROM projects WHERE org_id = $1", org_id)

    if project_id:
        await bench("COUNT issues (open)",
                    conn,
                    "SELECT COUNT(*) FROM issues WHERE project_id=$1 AND status='open'",
                    project_id)

        await bench("COUNT issues (resolved)",
                    conn,
                    "SELECT COUNT(*) FROM issues WHERE project_id=$1 AND status='resolved'",
                    project_id)

        await bench("SELECT issues (open, limit 5, last_seen DESC)",
                    conn,
                    """SELECT * FROM issues
                       WHERE project_id=$1 AND status='open'
                       ORDER BY last_seen DESC LIMIT 5""",
                    project_id)

    print()
    print("  Legend: 🟢 <50ms (fast)  🟡 50-150ms (acceptable)  🔴 >150ms (slow)")
    print()

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
