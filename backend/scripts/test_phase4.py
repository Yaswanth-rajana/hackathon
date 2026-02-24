import httpx
import time
import sys
import os

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import create_access_token

BASE_URL = "http://localhost:8000"

def get_headers():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == UserRole.admin).first()
        if not admin_user:
            print("Login failed: Admin user not found in DB.")
            return {}
        token = create_access_token(data={"sub": admin_user.id, "role": admin_user.role.value})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()

def run_test():
    headers = get_headers()
    if not headers:
        return

    print("\n--- Phase 4 AI Audit Trigger Verification ---")

    # Test A: Clean State
    print("\n[Test A] Resetting and running clean audit...")
    httpx.post(f"{BASE_URL}/api/admin/simulate/reset/DEMO_001", headers=headers)
    time.sleep(1)
    
    resA = httpx.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers)
    print("Test A Output:", resA.json())
    dataA = resA.json()
    assert dataA["severity"] == "low"
    assert dataA["anomaly_created"] == False

    # Test B: Inject Ghost -> Run Audit
    print("\n[Test B] Injecting ghosts and running audit...")
    httpx.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 200}, headers=headers)
    time.sleep(1)

    resB = httpx.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers)
    print("Test B Output:", resB.json())
    dataB = resB.json()
    assert dataB["severity"] in ["medium", "high", "critical"]
    assert dataB["anomaly_created"] == True
    assert dataB["block_index"] is not None

    # Test C: Re-run Audit Without Changes
    print("\n[Test C] Re-running audit directly...")
    resC = httpx.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers)
    print("Test C Output:", resC.json())
    dataC = resC.json()
    assert dataC["anomaly_created"] == False  # Idempotent!

    # Test D: Reset -> Run Audit
    print("\n[Test D] Resetting and running audit again...")
    httpx.post(f"{BASE_URL}/api/admin/simulate/reset/DEMO_001", headers=headers)
    time.sleep(1)
    
    resD = httpx.post(f"{BASE_URL}/api/admin/audit/run/DEMO_001", headers=headers)
    print("Test D Output:", resD.json())
    dataD = resD.json()
    assert dataD["severity"] == "low"
    assert dataD["anomaly_created"] == False

    print("\n✅ All Phase 4 Verification Tests Passed!")

if __name__ == "__main__":
    run_test()
