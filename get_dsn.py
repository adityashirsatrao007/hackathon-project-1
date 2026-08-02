#!/usr/bin/env python3
"""
Helper script to get your DSN from the local Tracelify backend.
Run: python3 get_dsn.py <email> <password>
"""
import sys
import requests

BASE = "http://localhost:8000"

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 get_dsn.py <email> <password>")
        sys.exit(1)
    
    email, password = sys.argv[1], sys.argv[2]

    # 1. Login
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        print(f"❌ Login failed: {r.text}")
        sys.exit(1)

    data = r.json()
    token = data["access_token"]
    user = data["user"]
    print(f"✅ Logged in as: {user['email']}")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. List orgs
    orgs = requests.get(f"{BASE}/orgs/", headers=headers).json()
    if not orgs:
        print("❌ No organizations found. Create one first via the dashboard.")
        sys.exit(1)

    print(f"\n📁 Found {len(orgs)} org(s):")
    for i, org in enumerate(orgs):
        print(f"  [{i}] {org['name']} (id: {org['id']})")

    org = orgs[0]

    # 3. List projects
    projects = requests.get(f"{BASE}/orgs/{org['id']}/projects/", headers=headers).json()
    if not projects:
        print("❌ No projects found. Create one via the dashboard.")
        sys.exit(1)

    print(f"\n🗂  Found {len(projects)} project(s) in '{org['name']}':")
    for i, p in enumerate(projects):
        print(f"  [{i}] {p['name']} | platform: {p['platform']} | id: {p['id']}")

    project = projects[0]

    # 4. Get DSN keys
    keys = requests.get(f"{BASE}/projects/{project['id']}/dsn", headers=headers).json()
    if not keys:
        print("❌ No DSN keys found for this project.")
        sys.exit(1)

    key = keys[0]
    print(f"\n🔑 DSN Key for '{project['name']}':")
    print(f"  Label:      {key['label']}")
    print(f"  Public Key: {key['public_key']}")
    print(f"  Full DSN:   {key['dsn']}")

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Update your test.py DSN to:

  dsn="{key['dsn']}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

if __name__ == "__main__":
    main()
