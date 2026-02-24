import asyncio
import json
import httpx
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

def create_tokens():
    db = next(get_db())
    admin_user = db.query(User).filter(User.role == UserRole.admin).first()
    dealer_user = db.query(User).filter(User.role == UserRole.dealer).first()
    
    admin_token = None
    if admin_user:
        admin_token = create_access_token(data={"sub": admin_user.id, "role": admin_user.role.value})
    
    dealer_token = None
    if dealer_user:
        dealer_token = create_access_token(data={"sub": dealer_user.id, "role": dealer_user.role.value})
        
    return admin_token, dealer_token

def get_row_counts():
    db = next(get_db())
    from app.models.anomaly import Anomaly
    from app.models.blockchain_ledger import BlockchainLedger
    from app.models.risk_score import RiskScore
    
    anomaly_count = db.query(Anomaly).count()
    ledger_count = db.query(BlockchainLedger).count()
    risk_count = db.query(RiskScore).count()
    return anomaly_count, ledger_count, risk_count

async def run_tests():
    admin_token, dealer_token = create_tokens()
    
    if not admin_token:
        print("Error: Could not find admin user for token generation")
        return
        
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    dealer_headers = {"Authorization": f"Bearer {dealer_token}"} if dealer_token else {}
    
    async with httpx.AsyncClient() as client:
        print("🟢 Test 1 — Unauthorized Access")
        # No JWT -> 401
        res = await client.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 50})
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"
        print("  ✅ No JWT -> 401 Unauthorized")
        
        # Dealer JWT -> 403
        if dealer_token:
            res = await client.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 50}, headers=dealer_headers)
            assert res.status_code == 403, f"Expected 403, got {res.status_code}"
            print("  ✅ Dealer JWT -> 403 Forbidden")
            
        print("\n🟡 Pre-flight counts for Test 5")
        pre_anom, pre_ledg, pre_risk = get_row_counts()
        print(f"  Anomalies: {pre_anom}, Ledger: {pre_ledg}, RiskScores: {pre_risk}")
            
        print("\n🟢 Test 2 — Ghost Injection")
        res = await client.post(f"{BASE_URL}/api/admin/simulate/ghost/DEMO_001", json={"count": 50}, headers=admin_headers)
        if res.status_code == 200:
            print("  ✅ Ghost injection successful")
            print(f"  Response: {json.dumps(res.json(), indent=2)}")
        else:
            print(f"  ❌ Ghost injection failed with {res.status_code}: {res.text}")
            
        print("\n🟢 Test 3 — Wrong Shop")
        res = await client.post(f"{BASE_URL}/api/admin/simulate/ghost/PROD_123", json={"count": 50}, headers=admin_headers)
        assert res.status_code in [400, 403, 404], f"Expected error for wrong shop, got {res.status_code}"
        print(f"  ✅ Wrong shop rejected with {res.status_code}: {res.text}")
        
        print("\n🟢 Test 5 — ML Isolation Confirmation")
        post_anom, post_ledg, post_risk = get_row_counts()
        print(f"  Anomalies: {post_anom}, Ledger: {post_ledg}, RiskScores: {post_risk}")
        assert pre_anom == post_anom, "Anomaly count changed!"
        assert pre_ledg == post_ledg, "Ledger count changed!"
        assert pre_risk == post_risk, "Risk score count changed!"
        print("  ✅ Complete isolation confirmed")
        
        print("\n🟢 Test 4 — Reset via API")
        res1 = await client.post(f"{BASE_URL}/api/admin/simulate/reset/DEMO_001", headers=admin_headers)
        if res1.status_code == 200:
             print("  Reset 1 response:", json.dumps(res1.json(), indent=2))
        else:
             print("  Reset 1 error:", res1.text)
        res2 = await client.post(f"{BASE_URL}/api/admin/simulate/reset/DEMO_001", headers=admin_headers)
        if res2.status_code == 200:
             print("  Reset 2 response:", json.dumps(res2.json(), indent=2))
             data2 = res2.json()
             assert data2.get("deleted_beneficiaries", -1) == 0, "Second reset should have 0 deletions"
             print("  ✅ Reset idempotency confirmed")
        else:
             print("  Reset 2 error:", res2.text)

if __name__ == "__main__":
    asyncio.run(run_tests())
