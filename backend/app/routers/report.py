"""
LLM Report Router — POST /report/projects/{project_id}/generate
==========================================
Triggers the full LLM-powered project health report via the API.
Requires authentication (Bearer token).
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.core.database import get_db
from app.llm.sumarisellm import collect_project_data, build_report_prompt, call_llm

router = APIRouter(prefix="/report", tags=["LLM Report"])


class ReportResponse(BaseModel):
    status: str
    message: str
    full_report: str
    generated_at: str
    issue_count: int


@router.post(
    "/projects/{project_id}/generate",
    response_model=ReportResponse,
    summary="Generate an AI-powered project health report using live DB data",
)
async def generate_project_report(
    current_user: CurrentUser,
    project_id: uuid.UUID = Path(..., description="The ID of the project to analyze"),
    db: AsyncSession = Depends(get_db),
):
    """
    Collects live data exclusively for the specified project, sends it to
    Amazon Nova Pro (AWS Bedrock), and returns a structured Markdown report.
    """
    
    # 1. Collect project-specific data from PostgreSQL
    api_data = await collect_project_data(
        db=db, 
        project_id=project_id, 
        user_name=current_user.name, 
        user_role="User"  # To properly resolve role requires auth check, but keeping simple
    )

    if not api_data.get("project"):
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    # 2. Construct specific prompt
    prompt = build_report_prompt(api_data)
    
    # 3. Call Amazon Nova Pro — run in thread pool so it doesn't block the event loop
    loop = asyncio.get_event_loop()
    report = await loop.run_in_executor(None, lambda: call_llm(prompt, temperature=0.3, max_tokens=2000))

    if not report or report.startswith("[LLM unavailable"):
        raise HTTPException(status_code=502, detail="LLM service (AWS Bedrock) did not respond. Check AWS credentials.")

    return ReportResponse(
        status="success",
        message="Project Report generated successfully",
        full_report=report,
        generated_at=datetime.now(timezone.utc).isoformat(),
        issue_count=len(api_data.get("issues", [])),
    )


@router.get(
    "/health",
    summary="Check if the LLM report service is configured",
)
async def report_health():
    """Quick check that AWS credentials are set."""
    has_key  = bool(os.getenv("AWS_ACCESS_KEY_ID"))
    has_sec  = bool(os.getenv("AWS_SECRET_ACCESS_KEY"))
    return {
        "status": "ready" if (has_key and has_sec) else "unconfigured",
        "aws_key_set":    has_key,
        "aws_secret_set": has_sec,
        "model": "apac.amazon.nova-pro-v1:0",
        "region": "ap-south-1",
    }
