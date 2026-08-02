"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          Tracelify Python SDK — Error Capture Test Suite                    ║
║                                                                              ║
║  Paste your DSN below, run:  python test_sdk.py                             ║
║  No login / API calls needed — pure SDK capture tests.                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

  Sections
  ────────
  1.  Basic Python exceptions       (12 types)
  2.  Nested / chained exceptions   (5 cases)
  3.  User context, tags, crumbs    (4 cases)
  4.  Custom fingerprint & levels   (4 cases)
  5.  Simulated DB errors           (5 cases)
  6.  Simulated network errors      (4 cases)
  7.  SDK edge cases                (6 cases)
  8.  Global excepthook             (2 cases)
"""

from __future__ import annotations

import math
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

# ─── Add tracelify SDK to path ────────────────────────────────────────────────
SDK_ROOT = Path(__file__).resolve().parent.parent   # Core-4/
sys.path.insert(0, str(SDK_ROOT))

from tracelify import Tracelify  # noqa: E402

# ══════════════════════════════════════════════════════════════════════════════
#   ▶  PASTE YOUR DSN HERE  ◀
#   Format:  http://<public_key>@localhost:8000/api/<project_id>/events
# ══════════════════════════════════════════════════════════════════════════════

DSN     = "http://3c723c2822edd92abb8ed14ff1c306b2@54.251.156.151.nip.io:8000/api/c92d8440-2e9f-41c7-8ea4-90a46b265e26/events"
RELEASE = "sdk-test@1.0.0"

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN   = "\033[92m"
RED     = "\033[91m"
YELLOW  = "\033[93m"
CYAN    = "\033[96m"
BOLD    = "\033[1m"
RESET   = "\033[0m"
DIM     = "\033[2m"

# ── Globals ───────────────────────────────────────────────────────────────────
pass_count = 0
fail_count = 0
results: list[dict] = []

# ── Helpers ───────────────────────────────────────────────────────────────────

def section(title: str) -> None:
    bar = "─" * max(0, 52 - len(title))
    print(f"\n{CYAN}{BOLD}──── {title} {bar}{RESET}")


def log(label: str, ok: bool, note: str = "") -> None:
    global pass_count, fail_count
    icon  = f"{GREEN}✅{RESET}" if ok else f"{RED}❌{RESET}"
    color = GREEN if ok else RED
    ts    = datetime.now().strftime("%H:%M:%S")
    suffix = f"  {DIM}{note}{RESET}" if note else ""
    print(f"  {icon} [{ts}] {color}{BOLD}{label}{RESET}{suffix}")
    if ok:
        pass_count += 1
    else:
        fail_count += 1
    results.append({"label": label, "ok": ok, "note": note})


def capture(sdk: Tracelify, error: Exception, **kwargs) -> bool:
    """Call sdk.capture_exception; return True if no internal exception raised."""
    try:
        sdk.capture_exception(error, **kwargs)
        return True
    except Exception as exc:
        print(f"     {RED}capture_exception raised: {exc}{RESET}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 — Basic Python Exceptions
# ══════════════════════════════════════════════════════════════════════════════

def test_basic_exceptions(sdk: Tracelify) -> None:
    section("1 · Basic Python Exceptions")

    # 1a  ZeroDivisionError
    try:
        _ = 1 / 0
    except ZeroDivisionError as e:
        log("ZeroDivisionError  (1 / 0)", capture(sdk, e))

    # 1b  NameError
    try:
        undefined_variable  # noqa: F821
    except NameError as e:
        log("NameError  (undefined_variable)", capture(sdk, e))

    # 1c  TypeError
    try:
        _ = "text" + 42  # type: ignore[operator]
    except TypeError as e:
        log("TypeError  (str + int)", capture(sdk, e))

    # 1d  IndexError
    try:
        _ = [1, 2, 3][99]
    except IndexError as e:
        log("IndexError  (list index out of range)", capture(sdk, e))

    # 1e  KeyError
    try:
        _ = {"a": 1}["missing_key"]
    except KeyError as e:
        log("KeyError  (missing dict key)", capture(sdk, e))

    # 1f  AttributeError
    try:
        object().does_not_exist  # type: ignore[attr-defined]
    except AttributeError as e:
        log("AttributeError  (.does_not_exist on object)", capture(sdk, e))

    # 1g  ValueError
    try:
        int("not_a_number")
    except ValueError as e:
        log("ValueError  (int('not_a_number'))", capture(sdk, e))

    # 1h  FileNotFoundError
    try:
        open("/tmp/tracelify_missing_xyz_abc.txt")  # noqa
    except FileNotFoundError as e:
        log("FileNotFoundError  (missing file)", capture(sdk, e))

    # 1i  RecursionError
    try:
        def _recurse():
            return _recurse()
        _recurse()
    except RecursionError as e:
        log("RecursionError  (infinite recursion)", capture(sdk, e))

    # 1j  MemoryError  (simulated — we don't actually exhaust RAM)
    ok = capture(sdk, MemoryError("Simulated: out of memory"))
    log("MemoryError  (simulated)", ok)

    # 1k  RuntimeError
    try:
        raise RuntimeError("Background task failed unexpectedly")
    except RuntimeError as e:
        log("RuntimeError  (background task failure)", capture(sdk, e))

    # 1l  OverflowError
    try:
        math.exp(99999)
    except OverflowError as e:
        log("OverflowError  (math.exp overflow)", capture(sdk, e))

    # 1m  UnicodeDecodeError
    try:
        b"\xff\xfe".decode("utf-8")
    except UnicodeDecodeError as e:
        log("UnicodeDecodeError  (invalid UTF-8 bytes)", capture(sdk, e))

    # 1n  OSError / PermissionError
    try:
        open("/root/supersecret", "r")  # noqa
    except (OSError, PermissionError) as e:
        log("OSError/PermissionError  (permission denied)", capture(sdk, e))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 — Nested & Chained Exceptions
# ══════════════════════════════════════════════════════════════════════════════

def test_nested_exceptions(sdk: Tracelify) -> None:
    section("2 · Nested & Chained Exceptions")

    # 2a  ValueError chained from KeyError
    try:
        try:
            _ = {}["no_key"]
        except KeyError as inner:
            raise ValueError("Conversion failed — key missing") from inner
    except ValueError as e:
        log("ValueError chained from KeyError  (__cause__)", capture(sdk, e))

    # 2b  Deep call stack  (3 levels)
    def _level3():
        raise IOError("Disk quota exceeded at level 3")
    def _level2():
        _level3()
    def _level1():
        _level2()

    try:
        _level1()
    except IOError as e:
        log("IOError from 3-level deep call stack", capture(sdk, e))

    # 2c  ValueError inside a list comprehension
    try:
        _ = [int(x) for x in ["1", "two", "3"]]
    except ValueError as e:
        log("ValueError inside list comprehension", capture(sdk, e))

    # 2d  ValueError from a class method
    class PaymentProcessor:
        def charge(self, amount: float) -> float:
            if amount < 0:
                raise ValueError(f"Negative charge amount: {amount}")
            return amount * 1.05

    try:
        PaymentProcessor().charge(-99.99)
    except ValueError as e:
        log("ValueError raised inside a class method", capture(sdk, e))

    # 2e  RuntimeError from generator  (Python 3.7+: StopIteration → RuntimeError)
    def _broken_gen():
        yield 1
        raise RuntimeError("Generator terminated unexpectedly after item 1")

    try:
        for _ in _broken_gen():
            pass
    except RuntimeError as e:
        log("RuntimeError propagated from a generator", capture(sdk, e))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 — User Context, Tags & Breadcrumbs
# ══════════════════════════════════════════════════════════════════════════════

def test_user_context(sdk: Tracelify) -> None:
    section("3 · User Context, Tags & Breadcrumbs")

    # 3a  User context
    sdk.set_user({"id": "usr_001", "email": "alice@example.com", "role": "admin"})
    try:
        raise PermissionError("alice attempted /admin without 2FA")
    except PermissionError as e:
        log("PermissionError — user=alice, role=admin", capture(sdk, e))

    # 3b  Multiple tags
    sdk.set_tag("env",          "production")
    sdk.set_tag("region",       "ap-south-1")
    sdk.set_tag("service",      "payment-gateway")
    sdk.set_tag("build",        "a4f2c91")
    sdk.set_tag("feature_flag", "new_checkout_v2")
    try:
        raise ConnectionError("Payment gateway timeout (ap-south-1)")
    except ConnectionError as e:
        log("ConnectionError — 5 custom tags attached", capture(sdk, e))

    # 3c  Breadcrumbs trail
    sdk.add_breadcrumb("User navigated to /checkout")
    sdk.add_breadcrumb("Cart loaded: 3 items, total=$149.99")
    sdk.add_breadcrumb("Payment method selected: Visa •••• 4242")
    sdk.add_breadcrumb("Submitted payment form")
    sdk.add_breadcrumb("Received HTTP 503 from gateway")
    try:
        raise TimeoutError("Payment gateway did not respond within 5 s")
    except TimeoutError as e:
        log("TimeoutError — 5-step breadcrumb trail", capture(sdk, e))

    # 3d  Update user mid-session
    sdk.set_user({"id": "usr_002", "email": "bob@example.com", "role": "viewer"})
    try:
        raise PermissionError("bob tried to delete resource (read-only)")
    except PermissionError as e:
        log("PermissionError — user updated to bob (viewer)", capture(sdk, e))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 — Custom Fingerprints & Severity Levels
# ══════════════════════════════════════════════════════════════════════════════

def test_fingerprint_and_levels(sdk: Tracelify) -> None:
    section("4 · Custom Fingerprints & Severity Levels")

    # 4a  Same fingerprint → backend groups into one issue
    fp = ["payment", "gateway", "timeout"]
    for i in range(3):
        try:
            raise TimeoutError(f"Attempt {i+1}: gateway timeout")
        except TimeoutError as e:
            ok = capture(sdk, e, fingerprint=fp)
            log(f"TimeoutError attempt {i+1} — fingerprint={fp}", ok,
                "should group as 1 issue")

    # 4b  level=warning
    try:
        raise UserWarning("Deprecated endpoint /v1/users called")
    except UserWarning as e:
        log("UserWarning — level=warning", capture(sdk, e, level="warning"))

    # 4c  level=info
    try:
        raise Exception("Scheduled job finished with 2 skipped records")
    except Exception as e:
        log("Exception — level=info", capture(sdk, e, level="info"))

    # 4d  level=fatal
    try:
        raise SystemExit("CRITICAL: DB connection pool exhausted")
    except SystemExit as e:
        log("SystemExit — level=fatal", capture(sdk, e, level="fatal"))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 5 — Simulated Database Errors
# ══════════════════════════════════════════════════════════════════════════════

def test_database_errors(sdk: Tracelify) -> None:
    section("5 · Simulated Database Errors")

    sdk.set_tag("layer", "database")

    # 5a  Connection refused
    sdk.add_breadcrumb("Connecting to PostgreSQL at db.prod.internal:5432")
    e = Exception("could not connect to server: Connection refused (db.prod.internal:5432)")
    log("DB ConnectionError  (postgres refused)", capture(sdk, e))

    # 5b  Unique constraint violation
    sdk.add_breadcrumb("INSERT INTO orders (user_id, product_id) VALUES (42, 7)")
    e = Exception("duplicate key value violates unique constraint 'orders_pkey'")
    log("DB UniqueConstraintError  (duplicate PK)", capture(sdk, e))

    # 5c  Deadlock
    sdk.add_breadcrumb("BEGIN TRANSACTION")
    sdk.add_breadcrumb("UPDATE inventory SET qty = qty - 1 WHERE id = 42")
    e = Exception("deadlock detected — transaction rolled back")
    log("DB Deadlock  (custom fingerprint=[db,deadlock])",
        capture(sdk, e, level="error", fingerprint=["database", "deadlock"]))

    # 5d  Query timeout
    sdk.add_breadcrumb("SELECT * FROM events ORDER BY received_at DESC")
    e = Exception("canceling statement due to statement timeout (30 s)")
    log("DB QueryTimeout  (statement timeout)", capture(sdk, e))

    # 5e  Foreign key violation
    e = Exception("insert or update violates foreign key constraint 'events_project_id_fkey'")
    log("DB ForeignKeyError  (FK constraint)", capture(sdk, e))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 6 — Simulated Network / API Errors
# ══════════════════════════════════════════════════════════════════════════════

def test_network_errors(sdk: Tracelify) -> None:
    section("6 · Simulated Network & HTTP Errors")

    sdk.set_tag("layer", "http-client")

    # 6a  Upstream HTTP 500
    e = Exception("Upstream API responded HTTP 500 — Internal Server Error")
    log("Upstream HTTP 500", capture(sdk, e))

    # 6b  SSL certificate expired
    e = Exception("SSL: CERTIFICATE_VERIFY_FAILED — certificate expired")
    log("SSL CertificateExpiredError",
        capture(sdk, e, level="error", fingerprint=["ssl", "cert", "expired"]))

    # 6c  DNS resolution failure
    e = Exception("[Errno -2] Name or service not known: api.thirdparty.io")
    log("DNS ResolutionError  (NXDOMAIN)", capture(sdk, e))

    # 6d  HTTP 429 rate limit
    e = Exception("HTTP 429 Too Many Requests — Retry-After: 60")
    log("HTTP 429 RateLimitError",
        capture(sdk, e, level="warning", fingerprint=["rate-limit", "429"]))

    # 6e  Connection reset by peer
    e = Exception("Connection reset by peer (ECONNRESET) — remote=api.partner.io:443")
    log("ECONNRESET  (connection reset mid-stream)", capture(sdk, e))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 7 — SDK Edge Cases
# ══════════════════════════════════════════════════════════════════════════════

def test_edge_cases(sdk: Tracelify) -> None:
    section("7 · SDK Edge Cases")

    # 7a  Exception without __traceback__ (manually constructed, never raised)
    e = ValueError("Constructed manually — never raised")
    log("Exception with no __traceback__  (manual construction)", capture(sdk, e))

    # 7b  Very long message (5 000 chars)
    e = Exception("X" * 5000)
    log("Exception with 5 000-char message", capture(sdk, e))

    # 7c  Unicode / accented characters in message
    try:
        raise ValueError("Erreur: données invalides — clé='utilisateur' manquante (données: {'prénom': 'Ñoño'})")
    except ValueError as e:
        log("ValueError with Unicode / accented chars in message", capture(sdk, e))

    # 7d  Custom exception subclass
    class PaymentDeclinedError(RuntimeError):
        def __init__(self, reason: str, code: int):
            super().__init__(f"Declined [{code}]: {reason}")
            self.code = code

    try:
        raise PaymentDeclinedError("insufficient funds", 4001)
    except PaymentDeclinedError as e:
        log("Custom exception subclass  (PaymentDeclinedError)", capture(sdk, e))

    # 7e  Rapid-fire burst (10 events)
    all_ok = True
    for i in range(10):
        try:
            raise RuntimeError(f"Burst error #{i+1:02d} — high-frequency test")
        except RuntimeError as e:
            if not capture(sdk, e):
                all_ok = False
    log("10 rapid-fire RuntimeErrors  (burst capture)", all_ok)

    # 7f  Empty message
    e = Exception("")
    log("Exception with empty string message", capture(sdk, e))


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 8 — Global excepthook
# ══════════════════════════════════════════════════════════════════════════════

def test_global_handler(sdk: Tracelify) -> None:
    section("8 · Global sys.excepthook")

    hooked = sys.excepthook is not sys.__excepthook__
    log("sys.excepthook replaced by SDK handler", hooked,
        f"hook={sys.excepthook}" if not hooked else "")

    # Invoke the hook directly (raising would kill the process)
    if hooked:
        try:
            raise AssertionError("Simulated unhandled exception via global hook")
        except AssertionError as exc:
            try:
                sys.excepthook(type(exc), exc, exc.__traceback__)
                log("Direct call to sys.excepthook — no crash", True)
            except Exception as hook_exc:
                log("Direct call to sys.excepthook — no crash", False, str(hook_exc))


# ══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

def print_summary() -> None:
    total = pass_count + fail_count
    color = GREEN if fail_count == 0 else (YELLOW if pass_count > fail_count else RED)

    print(f"\n{'═'*66}")
    print(f"{BOLD}  🐛  Tracelify SDK Error Tests — Summary{RESET}")
    print(f"{'═'*66}")
    print(f"  {color}{BOLD}{pass_count}/{total} tests passed{RESET}  |  {RED}{fail_count} failed{RESET}")
    print(f"{'═'*66}")

    if fail_count:
        print(f"\n  {RED}Failed tests:{RESET}")
        for r in results:
            if not r["ok"]:
                note = f"  ({r['note']})" if r["note"] else ""
                print(f"    ❌  {r['label']}{note}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print(f"\n{'═'*66}")
    print(f"{BOLD}{CYAN}  🐛  Tracelify Python SDK — Error Capture Tests{RESET}")
    print(f"  DSN     : {DSN}")
    print(f"  Release : {RELEASE}")
    print(f"  Time    : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═'*66}")

    if "YOUR_PUBLIC_KEY" in DSN:
        print(f"\n{RED}❌  Please paste your real DSN into the DSN variable at the top of this file.{RESET}\n")
        sys.exit(1)

    # Initialise SDK
    try:
        sdk = Tracelify(dsn=DSN, release=RELEASE)
        print(f"\n{GREEN}✅  SDK initialised — project_id={sdk.config.project_id}{RESET}")
    except Exception as exc:
        print(f"\n{RED}❌  SDK init failed: {exc}{RESET}\n")
        sys.exit(1)

    # Run all test sections
    test_basic_exceptions(sdk)
    test_nested_exceptions(sdk)
    test_user_context(sdk)
    test_fingerprint_and_levels(sdk)
    test_database_errors(sdk)
    test_network_errors(sdk)
    test_edge_cases(sdk)
    test_global_handler(sdk)

    # Flush — wait for all events to be sent
    section("Flush")
    print(f"  {DIM}Flushing event queue (up to 10 s) …{RESET}")
    try:
        sdk.flush(timeout=10.0)
        log("sdk.flush(timeout=10) — no exception raised", True)
    except Exception as exc:
        log("sdk.flush(timeout=10) — no exception raised", False, str(exc))

    print_summary()
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
