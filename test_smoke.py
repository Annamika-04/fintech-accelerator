"""
Quick end-to-end smoke test.
Run AFTER docker-compose up --build

Usage:
    pip install httpx
    python test_smoke.py
"""

import httpx
import json

BASE = "http://localhost:8000"
API  = f"{BASE}/api/v1"


def check(label: str, resp: httpx.Response, expect: int = 200):
    status = "✅" if resp.status_code == expect else "❌"
    print(f"{status} [{resp.status_code}] {label}")
    if resp.status_code not in (200, 201, 202):
        print(f"   → {resp.text[:200]}")
    return resp.status_code == expect


def main():
    print("\n=== KYC Platform Smoke Test ===\n")

    # 1. Health check
    r = httpx.get(f"{BASE}/health")
    check("Health endpoint", r)

    # 2. Docs available (DEBUG=true)
    r = httpx.get(f"{BASE}/docs")
    check("Swagger UI", r)

    # 3. Auth — register without token should fail with 403/422 not 500
    r = httpx.post(f"{API}/auth/register", json={})
    ok = r.status_code in (401, 403, 422)
    print(f"{'✅' if ok else '❌'} [{ r.status_code}] Auth register rejects bad input")

    # 4. Documents — no token should return 403
    r = httpx.get(f"{API}/documents/")
    ok = r.status_code in (401, 403)
    print(f"{'✅' if ok else '❌'} [{r.status_code}] Documents requires auth")

    # 5. Risk — no token should return 403
    r = httpx.get(f"{API}/risk/history/some-user-id")
    ok = r.status_code in (401, 403)
    print(f"{'✅' if ok else '❌'} [{r.status_code}] Risk requires auth")

    # 6. AML — no token should return 403
    r = httpx.post(f"{API}/aml/screen", json={"full_name": "Test User"})
    ok = r.status_code in (401, 403)
    print(f"{'✅' if ok else '❌'} [{r.status_code}] AML requires auth")

    print("\n=== Done ===")
    print("Next: Open http://localhost:8000/docs and test with a real Cognito token")
    print("      Open http://localhost:5555 to see Celery workers")


if __name__ == "__main__":
    main()
