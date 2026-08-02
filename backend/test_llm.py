"""
=============================================================
  Tracelify — LLM Test Suite
  Tests:
    1. AWS Bedrock credentials & connectivity
    2. Amazon Nova Pro model invocation (simple ping)
    3. Full report prompt build + LLM call
    4. Report save to disk
    5. (Optional) Full API-data collection if server is up
=============================================================
Run with:
    python test_llm.py
    python test_llm.py --full   # also hits the live API
"""

import sys
import os
import json
import asyncio
import argparse
import time
from datetime import datetime, timezone

# ── Load .env before any imports from the app ─────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

pass_count = 0
fail_count = 0
results: list[dict] = []


def _tick(label: str, ok: bool, note: str = ""):
    global pass_count, fail_count
    icon  = f"{GREEN}✅{RESET}" if ok else f"{RED}❌{RESET}"
    color = GREEN if ok else RED
    ts    = datetime.now().strftime("%H:%M:%S")
    print(f"  {icon} [{ts}] {color}{BOLD}{label}{RESET}  {DIM}{note}{RESET}")
    if ok:
        pass_count += 1
    else:
        fail_count += 1
    results.append({"label": label, "ok": ok, "note": note})


def section(title: str):
    bar = "─" * max(0, 56 - len(title))
    print(f"\n{CYAN}{BOLD}──── {title} {bar}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1 — Environment / AWS credentials
# ─────────────────────────────────────────────────────────────────────────────

def test_env():
    section("AWS Credentials & Environment")

    key = os.getenv("AWS_ACCESS_KEY_ID", "")
    secret = os.getenv("AWS_SECRET_ACCESS_KEY", "")

    _tick("AWS_ACCESS_KEY_ID is set",    bool(key),    f"value: {key[:6]}…" if key else "MISSING")
    _tick("AWS_SECRET_ACCESS_KEY is set", bool(secret), f"value: {secret[:4]}…" if secret else "MISSING")

    try:
        import boto3
        _tick("boto3 import", True, f"version {boto3.__version__}")
    except ImportError as e:
        _tick("boto3 import", False, str(e))

    try:
        import httpx
        _tick("httpx import", True, f"version {httpx.__version__}")
    except ImportError as e:
        _tick("httpx import", False, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2 — Bedrock client creation
# ─────────────────────────────────────────────────────────────────────────────

def test_bedrock_client():
    section("Bedrock Client Creation")
    import boto3

    try:
        client = boto3.client(
            "bedrock-runtime",
            region_name="ap-south-1",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        _tick("boto3 bedrock-runtime client created", True, "region=ap-south-1")
        return client
    except Exception as e:
        _tick("boto3 bedrock-runtime client created", False, str(e))
        return None


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3 — Live LLM ping (simple 1-sentence prompt)
# ─────────────────────────────────────────────────────────────────────────────

def test_llm_ping(bedrock_client):
    section("LLM Live Invocation (Amazon Nova Pro)")

    MODEL_ID = "arn:aws:bedrock:ap-south-1:030537971425:inference-profile/apac.amazon.nova-pro-v1:0"

    if bedrock_client is None:
        _tick("LLM ping", False, "Skipped — no Bedrock client")
        return None

    ping_prompt = (
        "You are a software analyst assistant. "
        "Reply with exactly one sentence confirming you are operational and ready to generate reports."
    )

    body = json.dumps({
        "messages": [{"role": "user", "content": [{"text": ping_prompt}]}],
        "inferenceConfig": {"maxTokens": 60, "temperature": 0.1},
    })

    t0 = time.time()
    try:
        response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        elapsed = round(time.time() - t0, 2)
        result  = json.loads(response["body"].read())
        text    = result["output"]["message"]["content"][0]["text"].strip()
        _tick("Bedrock invoke_model (Nova Pro)", True, f"latency={elapsed}s")
        print(f"\n     {DIM}LLM response:{RESET} {CYAN}\"{text}\"{RESET}\n")
        return text
    except Exception as e:
        elapsed = round(time.time() - t0, 2)
        _tick("Bedrock invoke_model (Nova Pro)", False, f"{e}  [{elapsed}s]")
        print(f"\n     {RED}Full error:{RESET} {e}\n")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4 — call_llm() wrapper from sumarisellm
# ─────────────────────────────────────────────────────────────────────────────

def test_call_llm_wrapper():
    section("call_llm() Wrapper Function")

    try:
        from app.llm.sumarisellm import call_llm
        _tick("import call_llm from app.llm.sumarisellm", True)
    except ImportError as e:
        _tick("import call_llm from app.llm.sumarisellm", False, str(e))
        return

    t0 = time.time()
    result = call_llm(
        "Say 'Tracelify LLM is READY' and nothing else.",
        temperature=0.1,
        max_tokens=30,
    )
    elapsed = round(time.time() - t0, 2)

    ok = bool(result) and not result.startswith("[LLM unavailable")
    _tick("call_llm() returns non-empty string", ok, f"latency={elapsed}s")
    if ok:
        print(f"     {DIM}Output:{RESET} {CYAN}\"{result}\"{RESET}")
    else:
        print(f"     {RED}Output:{RESET} {result!r}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5 — build_report_prompt with mock data
# ─────────────────────────────────────────────────────────────────────────────

def test_prompt_builder():
    section("Report Prompt Builder (Mock Data)")

    try:
        from app.llm.sumarisellm import build_report_prompt
        _tick("import build_report_prompt", True)
    except ImportError as e:
        _tick("import build_report_prompt", False, str(e))
        return None

    mock_data = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "base_url": "http://localhost:8000",
        "health": {"status": 200, "body": {"status": "ok"}},
        "auth": {"name": "Test User", "email": "test@tracelify.io", "role_in_org": "owner"},
        "orgs": [{"id": "org-1", "name": "Acme Corp", "slug": "acme"}],
        "projects": [{"id": "proj-1", "name": "Backend API", "platform": "python", "slug": "backend", "dsn_key_count": 2}],
        "issues": [
            {"id": "iss-1", "title": "ZeroDivisionError: division by zero", "level": "error",
             "status": "open", "event_count": 42, "user_count": 8,
             "first_seen": "2024-01-01T10:00:00Z", "last_seen": "2024-01-05T12:00:00Z"},
            {"id": "iss-2", "title": "KeyError: 'user_id'", "level": "error",
             "status": "open", "event_count": 17, "user_count": 3,
             "first_seen": "2024-01-02T08:00:00Z", "last_seen": "2024-01-05T11:30:00Z"},
            {"id": "iss-3", "title": "ConnectionTimeout: DB connection timed out", "level": "warning",
             "status": "open", "event_count": 5, "user_count": 0,
             "first_seen": "2024-01-03T09:00:00Z", "last_seen": "2024-01-04T16:00:00Z"},
        ],
        "events_sample": [
            {"id": "evt-1", "error_type": "ZeroDivisionError", "message": "division by zero",
             "level": "error", "environment": "production", "received_at": "2024-01-05T12:00:00Z"}
        ],
        "errors": [],
        "summary_counts": {"orgs": 1, "projects": 1, "issues": 3, "events_ingested": 5, "warning": 1, "info": 0},
    }

    try:
        prompt = build_report_prompt(mock_data)
        ok = len(prompt) > 200
        _tick("build_report_prompt returns valid prompt", ok, f"prompt length={len(prompt)} chars")
        if ok:
            preview = prompt[:120].replace("\n", " ")
            print(f"     {DIM}Preview:{RESET} {preview}…")
        return prompt
    except Exception as e:
        _tick("build_report_prompt raises no exception", False, str(e))
        return None


# ─────────────────────────────────────────────────────────────────────────────
# TEST 6 — Full LLM report with mock data (end-to-end)
# ─────────────────────────────────────────────────────────────────────────────

def test_full_report_mock(prompt):
    section("Full LLM Report Generation (Mock Data)")

    if prompt is None:
        _tick("Full report (mock)", False, "Skipped — no prompt from previous test")
        return

    try:
        from app.llm.sumarisellm import call_llm, save_report
    except ImportError as e:
        _tick("import call_llm / save_report", False, str(e))
        return

    t0 = time.time()
    # Use a shorter prompt for speed — truncate to first 1000 chars for the test
    short_prompt = prompt[:1000] + "\n\nGenerate a very brief 3-section health report (max 200 words)."
    report = call_llm(short_prompt, temperature=0.2, max_tokens=400)
    elapsed = round(time.time() - t0, 2)

    got_report = bool(report) and not report.startswith("[LLM unavailable")
    _tick("call_llm returns full report text", got_report, f"latency={elapsed}s | length={len(report)} chars")

    if got_report:
        # Save it
        mock_data = {"collected_at": datetime.now(timezone.utc).isoformat(), "source": "mock_test"}
        try:
            md_path, json_path = save_report(report, mock_data)
            _tick("save_report writes Markdown file",  os.path.exists(md_path),  f"→ {md_path}")
            _tick("save_report writes JSON data file", os.path.exists(json_path), f"→ {json_path}")

            # Print first 400 chars of report
            print(f"\n  {CYAN}{'─'*56}{RESET}")
            print(f"  {BOLD}Report preview (first 400 chars):{RESET}")
            print(f"  {DIM}{report[:400].replace(chr(10), chr(10)+'  ')}{RESET}")
            print(f"  {CYAN}{'─'*56}{RESET}")
        except Exception as e:
            _tick("save_report to disk", False, str(e))
    else:
        print(f"     {RED}LLM returned:{RESET} {report!r}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 7 — (Optional) Full API data collection + LLM report
# ─────────────────────────────────────────────────────────────────────────────

async def test_full_api_report():
    section("Full API-Based Report (Live Server)")

    import httpx

    # Quick server check
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get("http://localhost:8000/health", timeout=5)
            server_up = r.status_code == 200
    except Exception:
        server_up = False

    if not server_up:
        _tick("Backend reachable at localhost:8000", False,
              "Server not running — skipping live API test. Start with: uvicorn main:app --reload")
        return

    _tick("Backend reachable at localhost:8000", True)

    try:
        from app.llm.sumarisellm import collect_api_data, build_report_prompt, call_llm, save_report
    except ImportError as e:
        _tick("Import pipeline functions", False, str(e))
        return

    print(f"\n  {DIM}Collecting live API data (this takes ~15s while events are processed)…{RESET}")
    t0 = time.time()
    async with httpx.AsyncClient() as client:
        api_data = await collect_api_data(client)
    elapsed_collect = round(time.time() - t0, 2)

    _tick("collect_api_data completed", True, f"{elapsed_collect}s | issues={len(api_data.get('issues',[]))} | projects={len(api_data.get('projects',[]))}")

    prompt = build_report_prompt(api_data)
    _tick("build_report_prompt from live data", len(prompt) > 100, f"{len(prompt)} chars")

    print(f"\n  {DIM}Sending to Amazon Nova Pro…{RESET}")
    t0 = time.time()
    report = call_llm(prompt, temperature=0.3, max_tokens=2000)
    elapsed_llm = round(time.time() - t0, 2)

    got = bool(report) and not report.startswith("[LLM unavailable")
    _tick("LLM generated full report", got, f"{elapsed_llm}s | {len(report)} chars")

    if got:
        md_path, json_path = save_report(report, api_data)
        _tick("Report saved to disk", os.path.exists(md_path), md_path)
        print(f"\n  {BOLD}Report saved successfully!{RESET}")
        print(f"  📄 Markdown : {CYAN}{md_path}{RESET}")
        print(f"  📦 JSON data: {CYAN}{json_path}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

def print_summary():
    total = pass_count + fail_count
    color = GREEN if fail_count == 0 else (YELLOW if pass_count > fail_count else RED)
    verdict = "ALL PASS 🎉" if fail_count == 0 else (f"{fail_count} FAILED ⚠️" if fail_count < total else "ALL FAIL 💥")

    print(f"\n{'═'*60}")
    print(f"{BOLD}  Tracelify LLM Test Suite — Results{RESET}")
    print(f"{'═'*60}")
    print(f"  {color}{BOLD}{pass_count}/{total} tests passed  —  {verdict}{RESET}")
    print(f"{'═'*60}")

    if fail_count:
        print(f"\n  {RED}Failed:{RESET}")
        for r in results:
            if not r["ok"]:
                print(f"    ❌  {r['label']}  {DIM}{r['note']}{RESET}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Tracelify LLM Test Suite")
    parser.add_argument("--full", action="store_true",
                        help="Also run the live API report test (requires running backend)")
    parser.add_argument("--skip-llm", action="store_true",
                        help="Skip actual LLM calls (only test credentials + imports)")
    args = parser.parse_args()

    print(f"\n{'═'*60}")
    print(f"{BOLD}{CYAN}  🤖  Tracelify LLM Test Suite{RESET}")
    print(f"  Mode    : {'FULL (live API)' if args.full else 'UNIT (mock data)'}")
    print(f"  Started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═'*60}")

    # Always run these
    test_env()
    bedrock_client = test_bedrock_client()

    if not args.skip_llm:
        test_llm_ping(bedrock_client)
        test_call_llm_wrapper()

    prompt = test_prompt_builder()

    if not args.skip_llm:
        test_full_report_mock(prompt)

    # Optional: full live API test
    if args.full:
        asyncio.run(test_full_api_report())

    print_summary()
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
