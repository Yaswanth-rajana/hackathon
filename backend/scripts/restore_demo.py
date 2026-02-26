import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.entitlement import Entitlement
from app.models.transaction import Transaction
from app.models.complaint import Complaint
from app.models.anomaly import Anomaly
from app.models.risk_score import RiskScore
from app.models.activity_log import ActivityLog
from app.models.audit import Audit
from app.core.security import get_password_hash
from datetime import datetime

def restore():
    db = SessionLocal()
    
    # ── Demo Shop ──
    shop = db.query(Shop).filter(Shop.id == "DEMO_001").first()
    if not shop:
        shop = Shop(
            id="DEMO_001",
            name="Demo Fair Price Shop",
            address="Hackathon Arena, Hyderabad",
            stock_wheat=1000,
            stock_rice=2000,
            stock_sugar=200,
            risk_score=0.1
        )
        db.add(shop)
        db.commit()
    
    # ── Demo Citizen ──
    ben = db.query(Beneficiary).filter(Beneficiary.ration_card == "1234567890").first()
    if not ben:
        ben = Beneficiary(
            ration_card="1234567890",
            name="Demo Citizen",
            password_hash=get_password_hash("password"),
            shop_id="DEMO_001",
            is_active=True,
            account_status="verified",
            district="Hyderabad"
        )
        db.add(ben)
        db.commit()
    else:
        # Update password just in case
        ben.password_hash = get_password_hash("password")
        ben.shop_id = "DEMO_001"
        db.commit()

    # ── Current Month Entitlement ──
    current_month = datetime.utcnow().strftime("%Y-%m")
    ent = db.query(Entitlement).filter(
        Entitlement.ration_card == "1234567890",
        Entitlement.month_year == current_month
    ).first()
    
    if not ent:
        ent = Entitlement(
            ration_card="1234567890",
            month_year=current_month,
            wheat=10.0,
            rice=20.0,
            sugar=2.0
        )
        db.add(ent)
        db.commit()

    # ── Sample Transaction to show progress ──
    txn = db.query(Transaction).filter(Transaction.ration_card == "1234567890").first()
    if not txn:
        txn = Transaction(
            id="txn-demo-1",
            block_index=1001,
            shop_id="DEMO_001",
            ration_card="1234567890",
            transaction_type="DISTRIBUTION",
            items={"wheat": 2.0, "rice": 5.0},
            timestamp=datetime.utcnow(),
            block_hash="0x7d2f8a1b9c3e4d5f",
            previous_hash="0x0"
        )
        db.add(txn)
        db.commit()

    db.close()
    print("🎯 Demo Citizen (1234567890) restored with standard password 'password'.")

if __name__ == "__main__":
    restore()
