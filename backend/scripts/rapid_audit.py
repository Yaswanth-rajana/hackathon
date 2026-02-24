import sys
import os
import requests
import json
from datetime import datetime
import asyncio
import httpx

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import SessionLocal
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.models.transaction import Transaction
from app.models.anomaly import Anomaly
from app.models.complaint import Complaint
from app.models.user import User

def seed_fraud_shops():
    db = SessionLocal()
    try:
        print("Creating 5 High-Risk Fraud Shops...")
        for i in range(1, 6):
            shop_id = f"FRAUD_{i}"
            
            # Clean
            db.query(Transaction).filter(Transaction.shop_id == shop_id).delete()
            db.query(Entitlement).filter(
                Entitlement.ration_card.in_(
                    db.query(Beneficiary.ration_card).filter(Beneficiary.shop_id == shop_id)
                )
            ).delete(synchronize_session=False)
            db.query(Complaint).filter(Complaint.shop_id == shop_id).delete()
            db.query(Anomaly).filter(Anomaly.shop_id == shop_id).delete()
            db.query(Beneficiary).filter(Beneficiary.shop_id == shop_id).delete()
            db.query(Shop).filter(Shop.id == shop_id).delete()
            db.commit()

            # Shop
            shop = Shop(id=shop_id, name=f"Bad FPS {i}", stock_wheat=10, address="N/A")
            db.add(shop)

            # 5 Ghost beneficiaries
            for b in range(1, 6):
                rc = f"FRC_{i}_{b}"
                ben = Beneficiary(ration_card=rc, name="Ghost", shop_id=shop_id, family_members=5, is_active=True, district="Demo District")
                db.add(ben)
                
                ent = Entitlement(ration_card=rc, month_year=datetime.utcnow().strftime("%Y-%m"), wheat=5.0)
                db.add(ent)
            
            # Massive over-distribution at midnight
            dt = datetime(2026, 2, 23, 2, 0)
            txn = Transaction(
                id=f"FTXN_{i}",
                block_index=1000000 + i,
                shop_id=shop_id,
                ration_card=f"FRC_{i}_1",
                block_hash=f"bad_hash_{i}",
                previous_hash=f"bad_hash_{i-1}",
                items={"wheat": 500.0}, # Over distributed
                timestamp=dt
            )
            db.add(txn)
            
            # Complaint
            comp = Complaint(id=f"FCMP_{i}", shop_id=shop_id, citizen_name="Angry", ration_card=f"FRC_{i}_1", complaint_type="Did not receive")
            db.add(comp)

        db.commit()
        print("✅ Seeded 5 Fraud Shops.")
    except Exception as e:
        db.rollback()
        print(e)
    finally:
        db.close()

async def trigger_audits():
    from app.core.security import get_password_hash
    db = SessionLocal()
    admin_user = db.query(User).filter(User.role == 'admin').first()
    
    if not admin_user:
        print("No admin user found in DB!")
        db.close()
        return
        
    admin_user.hashed_password = get_password_hash("adminpassword")
    admin_email = admin_user.email
    db.commit()
    db.close()
        
    # Login as admin to get token
    login_data = {"username": admin_email, "password": "adminpassword"}
    try:
        r = requests.post("http://localhost:8000/api/v1/auth/login", data=login_data)
        token = r.json().get("access_token")
        if not token:
            print(f"Failed to login to Uvicorn. Status: {r.status_code}, Response: {r.text}")
            return
            
        headers = {"Authorization": f"Bearer {token}"}
        
        print("Triggering Rapid Audits via API for WebSocket broadcast...")
        async with httpx.AsyncClient() as client:
            tasks = []
            for i in range(1, 6):
                tasks.append(client.post(f"http://localhost:8000/api/v1/admin/audit/shop/FRAUD_{i}", headers=headers))
            
            results = await asyncio.gather(*tasks)
            for res in results:
                if res.status_code == 200:
                    data = res.json()
                    print(f"Shop {data.get('shop_id')} -> {data.get('risk_level')} Risk. Anomaly: {data.get('anomaly_created')}")
                else:
                    print(f"Failed: {res.status_code} - {res.text}")
                    
        print("\n✅ Admin Dashboard UI Resilience triggered. Please check UI to ensure it handled 5 rapid anomalous WebSocket events smoothly without glitches or duplicate rows.")
    except Exception as e:
        print(f"Error querying local server: {e}")

if __name__ == "__main__":
    seed_fraud_shops()
    asyncio.run(trigger_audits())
