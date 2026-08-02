#!/usr/bin/env python3
"""
Auto-fetch DSN from the backend and patch test.py automatically.
Run: python3 setup_test.py <email> <password>
"""
import sys
import json
import requests
import re

BASE = "http://localhost:8000"

def main():
    if len(sys.argv) < 3:
        print("\nUsage:  python3 setup_test.py <email> <password>\n")
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]
    print(f"\n🔑 Logging in as {email}...")

    # 1. Login
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        error = r.json().get("detail", r.text)
        print(f"❌ Login failed: {error}")
        sys.exit(1)

    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Logged in")

    # 2. Get orgs
    orgs = requests.get(f"{BASE}/orgs/", headers=headers).json()
    if not orgs:
        print("❌ No organizations found. Open the dashboard first to auto-create one.")
        sys.exit(1)

    org = orgs[0]
    print(f"🏢 Using org: {org['name']}")

    # 3. Get projects
    projects = requests.get(f"{BASE}/orgs/{org['id']}/projects/", headers=headers).json()
    if not projects:
        print("❌ No projects found. Open the dashboard first to auto-create one.")
        sys.exit(1)

    project = projects[0]
    print(f"📁 Using project: {project['name']} ({project['platform']})")

    # 4. Get DSN keys
    keys = requests.get(f"{BASE}/projects/{project['id']}/dsn", headers=headers).json()
    if not keys:
        print("❌ No DSN keys found for this project.")
        sys.exit(1)

    key = keys[0]
    dsn = key["dsn"]
    print(f"🔑 DSN: {dsn}")

    # 5. Patch test.py with the real DSN
    with open("test.py", "r") as f:
        content = f.read()

    # Replace any existing dsn="..." value
    new_content = re.sub(
        r'dsn\s*=\s*"[^"]*"',
        f'dsn="{dsn}"',
        content,
        count=1,
    )

    with open("test.py", "w") as f:
        f.write(new_content)

    print(f"\n✅ test.py updated with real DSN!")
    print(f"\nNow run:\n  python3 test.py\n")

if __name__ == "__main__":
    main()
