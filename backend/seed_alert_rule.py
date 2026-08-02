"""
seed_alert_rule.py
──────────────────
One-time script: inserts a default alert rule into the DB for a project
so emails fire immediately when a new issue is detected.

Usage:
    python3 seed_alert_rule.py

Edit PROJECT_ID and RECIPIENTS below before running.
"""
import asyncio
import os
import sys
import uuid
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ── Config — edit these ────────────────────────────────────────────────────────
PROJECT_ID = "786254c8-c5f8-4566-96c4-6d3503fc275f"   # your project
RECIPIENTS = ["surajyou45@gmail.com"]                  # who gets the alert email
# ──────────────────────────────────────────────────────────────────────────────


async def seed():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import text

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        print("❌ DATABASE_URL not set in .env")
        sys.exit(1)

    # Must add backend/ to path so app.models resolves
    sys.path.insert(0, os.path.dirname(__file__))
    from app.models.event import AlertRule

    engine = create_async_engine(db_url, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # Check existing rules
        existing = await db.execute(
            text("SELECT id, name FROM alert_rules WHERE project_id = :pid"),
            {"pid": PROJECT_ID},
        )
        rows = existing.fetchall()
        if rows:
            print(f"ℹ️  Project already has {len(rows)} alert rule(s):")
            for r in rows:
                print(f"   • {r.name} (id={r.id})")
            print("\nNo new rule inserted. Delete existing rules first if you want to re-seed.")
            await engine.dispose()
            return

        pid = uuid.UUID(PROJECT_ID)

        # Rule 1: fire on every new issue
        rule1 = AlertRule(
            project_id=pid,
            name="New Issue Alert",
            condition={"type": "new_issue"},
            action={"type": "email", "recipients": RECIPIENTS},
            is_active=True,
        )
        db.add(rule1)

        # Rule 2: fire when ≥5 errors in 60 min
        rule2 = AlertRule(
            project_id=pid,
            name="Error Spike Alert (5+ in 60min)",
            condition={"type": "event_count", "threshold": 5, "window_minutes": 60},
            action={"type": "email", "recipients": RECIPIENTS},
            is_active=True,
        )
        db.add(rule2)

        await db.commit()
        print("✅ Alert rules seeded!")
        print(f"   • New Issue Alert           → id={rule1.id}")
        print(f"   • Error Spike Alert (5/60m) → id={rule2.id}")
        print(f"   Recipients: {RECIPIENTS}")
        print(f"\nNext crash event for project {PROJECT_ID} will fire an email to {RECIPIENTS}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
