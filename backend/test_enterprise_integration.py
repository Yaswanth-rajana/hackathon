import asyncio
import json
import httpx
import time
import sys
import os
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.blockchain_ledger import BlockchainLedger
from app.models.anomaly import Anomaly
from app.core.security import create_access_token

BASE_URL = "http://localhost:8000"
SHOP_ID = "DEMO_001"

def get_admin_token():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == UserRole.admin).first()
        if not admin_user:
            return None
        return create_access_token(data={"sub": admin_user.id, "role": admin_user.role.value})
    finally:
        db.close()

def get_db_counts():
    db = SessionLocal()
    try:
        ledger_count = db.query(BlockchainLedger).count()
        anomaly_count = db.query(Anomaly).count()
        return ledger_count, anomaly_count
    finally:
        db.close()

async def run_enterprise_tests():
    token = get_admin_token()
    if not token:
        print("❌ Error: Could not find admin user")
        return

    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("\n🚀 STARTING ENTERPRISE INTEGRATION PROTOCOL")

        # --- SETUP ---
        print("\n🧹 Setup: Cleaning state...")
        await client.post(f"{BASE_URL}/api/admin/simulate/reset/{SHOP_ID}", headers=headers)
        
        # --- LEVEL 2A: Clean Baseline Flow ---
        print("\n🟢 LEVEL 2A: Clean Baseline Flow")
        # First audit will mine Genesis (index 0) and potentially a baseline alert (index 1) if not LOW.
        res = await client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        baseline_data = res.json()
        print(f"  Initial Audit Risk: {baseline_data.get('severity')} (Score: {baseline_data.get('risk_score')})")
        print(f"  Block Index: {baseline_data.get('block_index')}")
        
        pre_ledg, _ = get_db_counts()
        print(f"  Current Ledger Head: {pre_ledg}")
        
        # Idempotency: Running it again should mine NO new blocks
        res2 = await client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        post_ledg, _ = get_db_counts()
        assert post_ledg == pre_ledg, f"❌ Failed: Duplicate block mined on redundant audit! ({post_ledg} vs {pre_ledg})"
        print("  ✅ Baseline Idempotency Confirmed (No new blocks on rerun)")

        # --- LEVEL 2B: Inject Only Flow ---
        print("\n🟢 LEVEL 2B: Inject Only Flow (Phase 4 Separation)")
        await client.post(f"{BASE_URL}/api/admin/simulate/ghost/{SHOP_ID}", json={"count": 200}, headers=headers)
        post_inject_ledg, _ = get_db_counts()
        assert post_inject_ledg == pre_ledg, "❌ Failed: Block mined on injection!"
        print("  ✅ No blocks mined during injection (Isolation verified)")

        # --- LEVEL 2C: Run Audit ---
        print("\n🟢 LEVEL 2C: Run Audit")
        res = await client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        audit_data = res.json()
        print(f"  Mined Block Index: {audit_data.get('block_index')}")
        print(f"  Anomaly Created/Escalated: {audit_data.get('anomaly_created')}")
        print(f"  Severity: {audit_data.get('severity')}")
        
        post_audit_ledg, _ = get_db_counts()
        # pre_ledg was defined in LEVEL 2A/B
        assert audit_data.get('anomaly_created') is True, "❌ Failed: No anomaly created/escalated!"
        assert post_audit_ledg >= pre_ledg + 1, "❌ Failed: Block not mined on fraud audit!"
        print("  ✅ ML_ALERT Block mined sequentially")

        # --- LEVEL 2D: Idempotency ---
        print("\n🟢 LEVEL 2D: Idempotency Check")
        res = await client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        post_idem_ledg, _ = get_db_counts()
        assert post_idem_ledg == post_audit_ledg, "❌ Failed: Duplicate block mined on rerun!"
        print("  ✅ Idempotency confirmed (No duplicate blocks)")

        # --- LEVEL 3: Stress Scenario ---
        print("\n🟢 LEVEL 3: High Impact stress")
        await client.post(f"{BASE_URL}/api/admin/simulate/reset/{SHOP_ID}", headers=headers)
        # 250 ghosts, 60 complaints, 1.7x mismatch
        await client.post(f"{BASE_URL}/api/admin/simulate/ghost/{SHOP_ID}", json={"count": 250}, headers=headers)
        await client.post(f"{BASE_URL}/api/admin/simulate/complaints/{SHOP_ID}", json={"count": 60}, headers=headers)
        await client.post(f"{BASE_URL}/api/admin/simulate/mismatch/{SHOP_ID}", json={"inflation_factor": 1.7, "month_year": "2026-02"}, headers=headers)
        
        pre_stress_ledg, _ = get_db_counts()
        res = await client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        stress_data = res.json()
        print(f"  Stress Severity: {stress_data.get('severity')}")
        post_stress_ledg, _ = get_db_counts()
        assert stress_data.get('severity') in ['high', 'critical'], f"❌ Failed: Stress scenario didn't trigger high/critical (got {stress_data.get('severity')})"
        # If ledger was 0, genesis + alert = 2. If it was already non-zero, it adds 1.
        assert post_stress_ledg >= pre_stress_ledg + 1, "❌ Failed: Wrong block count after stress audit"
        print("  ✅ High Impact Scenario Validated")

        # --- LEVEL 4: Concurrency ---
        print("\n🟢 LEVEL 4: Concurrency Test (Simultaneous Audits)")
        # We trigger two audits at the same time
        task1 = client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        task2 = client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}", headers=headers)
        
        results = await asyncio.gather(task1, task2)
        indices = [r.json().get('block_index') for r in results]
        print(f"  Concurrent audit indices: {indices}")
        # One should succeed or both return same if state didn't change, 
        # but most importantly, Ledger count should only increment by 1 max if no changes happened between them.
        final_ledg, _ = get_db_counts()
        # In our case, since the second call is idempotent, they might both return the same index.
        assert len(set(indices)) == 1, "❌ Failed: Non-deterministic indices during concurrency!"
        print("  ✅ Concurrency safety confirmed")

        # --- LEVEL 5: Negative Testing ---
        print("\n🟢 LEVEL 5: Negative Testing")
        
        # 1. Inflation < 1.0
        res = await client.post(f"{BASE_URL}/api/admin/simulate/mismatch/{SHOP_ID}", json={"inflation_factor": 0.5, "month_year": "2026-02"}, headers=headers)
        assert res.status_code in [400, 422], f"❌ Failed: Accepted invalid inflation factor! ({res.status_code})"
        print(f"  ✅ Invalid inflation rejected ({res.status_code})")

        # 2. Unauthorized
        res = await client.post(f"{BASE_URL}/api/admin/audit/run/{SHOP_ID}")
        assert res.status_code == 401, "❌ Failed: Allowed unauthorized audit!"
        print("  ✅ Unauthorized access rejected (401)")

        print("\n🏆 ENTERPRISE PROTOCOL SUCCESSFUL")

if __name__ == "__main__":
    asyncio.run(run_enterprise_tests())
