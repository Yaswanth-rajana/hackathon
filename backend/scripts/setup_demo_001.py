import sys
import os
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import SessionLocal
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.models.transaction import Transaction
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly
from app.models.complaint import Complaint
from app.models.user import User
from app.services.risk_service import run_ai_audit
from app.services.ml.feature_extractor import extract_shop_features

def setup_demo_shop():
    db = SessionLocal()
    shop_id = "DEMO_001"
    try:
        print(f"Cleaning up existing data for {shop_id}...")
        db.query(Transaction).filter(Transaction.shop_id == shop_id).delete()
        db.query(Entitlement).filter(
            Entitlement.ration_card.in_(
                db.query(Beneficiary.ration_card).filter(Beneficiary.shop_id == shop_id)
            )
        ).delete(synchronize_session=False)
        db.query(Complaint).filter(Complaint.shop_id == shop_id).delete()
        db.query(Anomaly).filter(Anomaly.shop_id == shop_id).delete()
        db.query(RiskScore).filter(RiskScore.shop_id == shop_id).delete()
        db.query(Beneficiary).filter(Beneficiary.shop_id == shop_id).delete()
        db.query(Shop).filter(Shop.id == shop_id).delete()
        
        # Cleanup ALL alerts for demo freshness
        from app.models.alert import Alert, AlertStatus, AlertSeverity
        db.query(Alert).delete()
        db.commit()

        print("Seeding Governance Alerts...")
        historical_alerts = [
            Alert(
                id="ALR-F29D1",
                severity=AlertSeverity.CRITICAL,
                type="ML_FRAUD",
                district="Visakhapatnam",
                entity_id="SHOP_1023",
                description="Ghost beneficiaries detected in morning shift",
                detected_by="ML",
                status=AlertStatus.OPEN,
                created_at=datetime(2026, 2, 24, 12, 3),
                block_index=8
            ),
            Alert(
                id="ALR-C887A",
                severity=AlertSeverity.HIGH,
                type="RULE_COMPLAINT_SPIKE",
                district="Guntur",
                entity_id="SHOP_887",
                description="35 complaints recorded in under 2 hours",
                detected_by="System",
                status=AlertStatus.ACKNOWLEDGED,
                created_at=datetime(2026, 2, 24, 11, 45),
                acknowledged_by="Admin Rajana"
            ),
            Alert(
                id="ALR-S001X",
                severity=AlertSeverity.INFO,
                type="SYSTEM_MAINTENANCE",
                district="Andhra Pradesh (HQ)",
                entity_id="SERVER_01",
                description="ML Prediction model retrained on Jan data",
                detected_by="System",
                status=AlertStatus.RESOLVED,
                created_at=datetime(2026, 2, 24, 10, 10),
                resolved_at=datetime(2026, 2, 24, 10, 30)
            )
        ]
        db.add_all(historical_alerts)
        db.commit()

        print("Setting up Shop...")
        shop = Shop(
            id=shop_id,
            name="Ideal Demo FPS",
            address="Visakhapatnam Central",
            stock_wheat=5000,
            stock_rice=10000,
            stock_sugar=2000,
            stock_kerosene=1000
        )
        db.add(shop)

        print("Creating 20 Beneficiaries & Entitlements...")
        for i in range(1, 21):
            rc = f"DEMO_RC_00{i}" if i < 10 else f"DEMO_RC_0{i}"
            ben = Beneficiary(
                ration_card=rc,
                name=f"Demo User {i}",
                shop_id=shop_id,
                family_members=4,
                account_status="active",
                mobile=f"99988877{i:02d}",
                is_active=True,
                district="Visakhapatnam"
            )
            db.add(ben)
            
            ent_month = datetime.utcnow().strftime("%Y-%m")
            ent = Entitlement(
                ration_card=rc,
                month_year=ent_month,
                wheat=10.0,
                rice=20.0,
                sugar=5.0
            )
            db.add(ent)

        print("Creating regular Transaction History...")
        start_index = 900000
        # Give all of them transactions but with some normal variance
        for i in range(1, 21):
            rc = f"DEMO_RC_00{i}" if i < 10 else f"DEMO_RC_0{i}"
            
            # i=1 -> Night time (23:00)
            if i == 1:
                dt = datetime(2026, 2, 23, 23, 15)
            # i=2,3 -> Weekend (Feb 21, 2026 is Saturday)
            elif i in [2, 3]:
                dt = datetime(2026, 2, 21, 10, i % 60)
            else:
                dt = datetime(2026, 2, 23, 10, i % 60)
                
            txn = Transaction(
                id=f"TXN_DEMO_{i}",
                block_index=start_index + i,
                shop_id=shop_id,
                ration_card=rc,
                block_hash=f"hash_demo_{i}",
                previous_hash=f"hash_demo_{i-1}",
                items={"wheat": 10.0, "rice": 20.0, "sugar": 5.0},
                timestamp=dt
            )
            db.add(txn)

        db.commit()
        print("Demo shop baseline data created successfully.")

        print("Running Audit Pipeline to verify LOW risk baseline...")
        features = extract_shop_features(db, shop_id)
        print(f"Debug Features: {features}")
        
        result = run_ai_audit(db, shop_id)
        
        print("\n--- Audit Result ---")
        print(f"Risk Score: {result.get('risk_score')}")
        print(f"Risk Level: {result.get('risk_level')}")
        print(f"Anomaly Created: {result.get('anomaly_created')}")
        print(f"Features: {result.get('features')}")

        if result.get("risk_level") == "LOW":
            print("\n✅ Baseline Setup Complete and Validated!")
        else:
            print(f"\n❌ Warning: Baseline is not LOW: {result.get('risk_level')}")

    except Exception as e:
        db.rollback()
        print(f"Error during setup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    setup_demo_shop()
