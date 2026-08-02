"""
test_email.py
─────────────
Standalone test to verify Gmail SMTP is working correctly.
Reads credentials directly from .env — no backend server needed.

Run:
    cd Core-4/backend
    python test_email.py [recipient@email.com]

If no recipient is given, it sends to SMTP_USER itself (self-test).
"""

import asyncio
import sys
import os
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# ── Load .env ──────────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# ── Preflight checks ───────────────────────────────────────────────────────────
def preflight():
    print("\n📋 SMTP Configuration")
    print(f"   Host     : {SMTP_HOST}:{SMTP_PORT}")
    print(f"   Username : {SMTP_USER or '⚠️  NOT SET'}")
    print(f"   Password : {'✅ set (' + str(len(SMTP_PASSWORD)) + ' chars)' if SMTP_PASSWORD else '⚠️  NOT SET'}")
    print()

    errors = []
    if not SMTP_USER:
        errors.append("SMTP_USER is empty in .env")
    if not SMTP_PASSWORD:
        errors.append("SMTP_PASSWORD is empty in .env")
    if errors:
        for e in errors:
            print(f"❌ {e}")
        print("\nFix your .env and re-run.")
        sys.exit(1)

    print("✅ Credentials look configured — attempting send...\n")


# ── Send test email ────────────────────────────────────────────────────────────
async def send_test_email(recipient: str) -> None:
    import aiosmtplib

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🧪 Tracelify SMTP Test — {now}"
    msg["From"]    = SMTP_USER          # Must match authenticated account for Gmail
    msg["To"]      = recipient

    html_body = f"""
    <html><body style="font-family: sans-serif; padding: 20px;">
      <h2 style="color:#10b981;">✅ Tracelify Email Test Passed</h2>
      <table style="border-collapse:collapse; width:100%; max-width:500px;">
        <tr><td style="padding:8px; background:#f3f4f6;"><b>Sent at</b></td>
            <td style="padding:8px;">{now}</td></tr>
        <tr><td style="padding:8px; background:#f3f4f6;"><b>SMTP Host</b></td>
            <td style="padding:8px;">{SMTP_HOST}:{SMTP_PORT}</td></tr>
        <tr><td style="padding:8px; background:#f3f4f6;"><b>From</b></td>
            <td style="padding:8px;">{SMTP_USER}</td></tr>
        <tr><td style="padding:8px; background:#f3f4f6;"><b>To</b></td>
            <td style="padding:8px;">{recipient}</td></tr>
      </table>
      <p style="margin-top:20px; color:#6b7280; font-size:13px;">
        This email was sent by the Tracelify test_email.py script.<br>
        If you received this, your Gmail alert pipeline is working correctly.
      </p>
    </body></html>
    """
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        print(f"✅ Email sent successfully to: {recipient}")
        print("   Check your inbox (and spam folder).")

    except aiosmtplib.SMTPAuthenticationError as exc:
        print(f"❌ Authentication failed: {exc}")
        print("\n💡 Fix: The SMTP_PASSWORD in .env must be a Gmail App Password,")
        print("   NOT your regular Gmail password.")
        print("   Generate one at: https://myaccount.google.com/apppasswords")
        print("   (Requires 2-Step Verification to be enabled.)")
        sys.exit(1)

    except aiosmtplib.SMTPConnectError as exc:
        print(f"❌ Connection failed: {exc}")
        print("\n💡 Fix: Check your network / firewall. Port 587 must be reachable.")
        sys.exit(1)

    except aiosmtplib.SMTPRecipientsRefused as exc:
        print(f"❌ Recipient refused: {exc}")
        print(f"\n💡 Fix: Check the recipient address '{recipient}' is valid.")
        sys.exit(1)

    except Exception as exc:
        print(f"❌ Unexpected error: {exc!r}")
        sys.exit(1)


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    recipient = sys.argv[1] if len(sys.argv) > 1 else SMTP_USER

    preflight()
    print(f"📨 Sending test email to: {recipient}")
    asyncio.run(send_test_email(recipient))
