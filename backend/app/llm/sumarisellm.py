"""
Tracelify LLM Report Generator
================================
Uses AWS Bedrock (Amazon Nova Pro) to generate intelligent, structured
project health reports from live database data for a SPECIFIC project.
"""

import json
import os
from datetime import datetime, timezone
import boto3
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from dotenv import load_dotenv

from app.models.project import Project
from app.models.issue import Issue

load_dotenv()

# Bedrock client (AWS Nova Pro via inference profile)
bedrock = boto3.client(
    "bedrock-runtime",
    region_name="ap-south-1",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

MODEL_ID = "arn:aws:bedrock:ap-south-1:030537971425:inference-profile/apac.amazon.nova-pro-v1:0"

def _safe_str(val):
    return str(val) if val is not None else "N/A"

def call_llm(prompt: str, temperature: float = 0.3, max_tokens: int = 2000) -> str:
    """Invoke Amazon Nova Pro via AWS Bedrock. Retries once on failure."""
    body = json.dumps({
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature}
    })

    for attempt in range(2):
        try:
            response = bedrock.invoke_model(
                modelId=MODEL_ID,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            result = json.loads(response["body"].read())
            return result["output"]["message"]["content"][0]["text"].strip()
        except Exception:
            pass
    return "[LLM unavailable — could not generate analysis]"


async def collect_project_data(db: AsyncSession, project_id: str, user_name: str, user_role: str) -> dict:
    """
    Fetch exact data bounded to the provided project_id from the database.
    """
    data = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "auth": {"name": user_name, "role": user_role},
        "project": None,
        "summary_counts": {},
        "issues": []
    }

    # 1. Fetch Project
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return data  # Return empty if project not found
    
    data["project"] = {
        "id": str(project.id),
        "name": project.name,
        "slug": project.slug,
        "platform": project.platform,
        "created_at": project.created_at.isoformat() if project.created_at else "N/A"
    }

    # 2. Fetch Open Issues (Top 15 sorted by last_seen desc)
    issues_result = await db.execute(
        select(Issue)
        .where(Issue.project_id == project_id, Issue.status == "open")
        .order_by(Issue.last_seen.desc())
        .limit(15)
    )
    issues = issues_result.scalars().all()
    
    for iss in issues:
        data["issues"].append({
            "id": str(iss.id),
            "fingerprint": iss.fingerprint,
            "title": iss.title,
            "level": iss.level,
            "status": iss.status,
            "event_count": iss.event_count,
            "user_count": iss.user_count,
            "first_seen": iss.first_seen.isoformat() if iss.first_seen else "N/A",
            "last_seen": iss.last_seen.isoformat() if iss.last_seen else "N/A"
        })

    # 3. Overall Counts
    total_issues = await db.execute(
        select(func.count(Issue.id)).where(Issue.project_id == project_id)
    )
    open_issues = await db.execute(
        select(func.count(Issue.id)).where(Issue.project_id == project_id, Issue.status == "open")
    )
    resolved_issues = await db.execute(
        select(func.count(Issue.id)).where(Issue.project_id == project_id, Issue.status == "resolved")
    )

    data["summary_counts"] = {
        "total_issues": total_issues.scalar() or 0,
        "open_issues": open_issues.scalar() or 0,
        "resolved_issues": resolved_issues.scalar() or 0,
    }

    return data


def build_report_prompt(api_data: dict) -> str:
    """Construct the structured prompt for a SPECIFIC project."""
    project = api_data.get("project")
    if not project:
        return "You are an AI. Say that the project was not found or access was denied."

    counts = api_data.get("summary_counts", {})
    issues = api_data.get("issues", [])
    auth = api_data.get("auth", {})

    # Compact issue list
    issue_lines = []
    for i, iss in enumerate(issues):
        issue_lines.append(
            f"  {i+1}. [{iss.get('level','?').upper()}] \"{iss.get('title','(no title)')}\" "
            f"| events={iss.get('event_count',0)} | affected_users={iss.get('user_count',0)} "
            f"| last_seen={iss.get('last_seen','?')}"
        )
    issues_text = "\n".join(issue_lines) if issue_lines else "  No open issues found. Great job!"

    prompt = f"""You are a senior software engineering analyst generating a professional project health report for a SPECIFIC PROJECT in Tracelify (a Sentry-like error tracking platform).

Below is the LIVE database telemetry for the project being analyzed:

=== AUTHENTICATED REQUESTOR ===
Name: {auth.get('name', 'N/A')} | Role: {auth.get('role', 'N/A')}

=== PROJECT DETAILS ===
Name: {project.get('name')}
Slug: {project.get('slug')}
Platform: {project.get('platform')}
Created At: {project.get('created_at')}
Generated At: {api_data.get('collected_at')}

=== PROJECT AGGREGATES ===
Total Issues Ever Logged: {counts.get('total_issues', 0)}
Open Unresolved Issues: {counts.get('open_issues', 0)}
Resolved Issues: {counts.get('resolved_issues', 0)}

=== TOP OPEN ISSUES (Most Recent) ===
{issues_text}

---

Now generate a comprehensive, professional project health report. Structure it as follows:

# 🛡️ Project Health Report: {project.get('name')}
**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

## 1. Executive Summary
Provide a 3-4 sentence overview of this specific project's health, stability posture, and any critical highlights (e.g., ratio of open vs resolved issues).

## 2. Error Analysis & Issue Breakdown
- Identify the most critical issues currently open.
- Provide a brief hypothesis or likely root cause for the top ones if their titles are descriptive (e.g., 'ZeroDivisionError').
- Highlight impact metrics (e.g., which issue is affecting the most users or producing the most events).

## 3. Risk Assessment
Rate the project's current state on a scale of Low / Medium / High / Critical across these vectors based strictly on the data provided:
| Risk Area              | Level | Justification |
|------------------------|-------|---------------|
| Application Stability  |       |               |
| Tech Debt (Open Bugs)  |       |               |

## 4. Actionable Target List
List 3 to 5 specific, prioritised recommendations for the engineering team to tackle in this project.

## 5. Next Steps
Suggest immediate next steps with clear owners to restore or maintain project health.

Keep the tone professional but clear. Use concrete data from the report wherever possible. Do NOT hallucinate configuration errors or system-wide AWS failures. Focus exclusively on the bug and issue telemetry presented above."""

    return prompt