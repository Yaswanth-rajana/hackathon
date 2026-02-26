import asyncio
import httpx
import json
import os
import sys

# Add parent directory to path to import app models if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import create_access_token

BASE_URL = "http://localhost:8000"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_admin_token():
    db = next(get_db())
    admin_user = db.query(User).filter(User.role == UserRole.admin).first()
    if not admin_user:
        return None
    return create_access_token(data={"sub": admin_user.id, "role": admin_user.role.value})

async def test_concurrency(headers):
    print("\n⚡ Test: Concurrent Audit (DB Integrity Guard)")
    async with httpx.AsyncClient(timeout=30.0) as client:
        # First Reset
        await client.post(f"{BASE_URL}/api/admin/simulate/reset/DEMO_001", headers=headers)
        
        # Inject something to make audit interesting
        await client.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 50}, headers=headers)

        # Fire two audits simultaneously
        tasks = [
            client.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers),
            client.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers)
        ]
        results = await asyncio.gather(*tasks)
        
        codes = [res.status_code for res in results]
        print(f"  Response codes: {codes}")
        
        for i, r in enumerate(results):
            if r.status_code == 200:
                data = r.json()
                print(f"  Request {i+1} status: {data.get('status')} | risk: {data.get('risk_score')}")
            else:
                print(f"  Request {i+1} failed with {r.status_code}: {r.text}")

async def test_demo_mode_restriction(headers):
    print("\n🚫 Test: Demo Mode Restriction (DEMO_MODE=true)")
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{BASE_URL}/api/admin/simulate/ghost/PROD_999", json={"count": 50}, headers=headers)
        print(f"  Inject into PROD_999 Status: {res.status_code}")
        if res.status_code == 403:
            print("  ✅ Access denied as expected (403 Forbidden)")
        else:
            print(f"  ❌ Expected 403, got {res.status_code}")

async def test_large_injection(headers):
    print("\n📦 Test: Large Injection (300 Ghosts)")
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 300}, headers=headers)
        print(f"  Response: {res.status_code}")
        if res.status_code == 200:
            print("  ✅ 300 ghosts injected successfully")
async def test_memory_drift(headers):
    print("\n🧠 Test: Memory Drift (15 Full Cycles)")
    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(1, 16):
            print(f"  Cycle {i}/15...")
            # Reset
            await client.post(f"{BASE_URL}/api/admin/simulate/reset/DEMO_001", headers=headers)
            # Inject
            tasks = [
                client.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 50}, headers=headers),
                client.post(f"{BASE_URL}/api/admin/simulate/complaints/DEMO_001", json={"count": 20}, headers=headers)
            ]
            await asyncio.gather(*tasks)
            # Audit
            await client.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers)
        print("  ✅ 15 cycles completed without crash.")

async def run_stress_matrix():
    token = create_admin_token()
    if not token:
        print("❌ Admin user not found for token generation.")
        return
    headers = {"Authorization": f"Bearer {token}"}
    
    print("--- STARTING PHASE 6 STRESS TEST MATRIX ---")
    await test_demo_mode_restriction(headers)
    await test_large_injection(headers)
    await test_concurrency(headers)
    await test_memory_drift(headers)
    print("\n--- STRESS TEST MATRIX COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(run_stress_matrix())
