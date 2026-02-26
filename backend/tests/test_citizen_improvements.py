import pytest
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import SessionLocal, engine
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.models.transaction import Transaction
from app.models.shop import Shop
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly
from app.models.activity_log import ActivityLog
from app.models.audit import Audit
from app.services.citizen_service import get_citizen_entitlement

def setup_db():
    db = SessionLocal()
    # Cleanup for clean test - Order matters for FK
    db.query(ActivityLog).delete()
    db.query(Anomaly).delete()
    db.query(RiskScore).delete()
    db.query(Audit).delete()
    db.query(Transaction).delete()
    db.query(Entitlement).delete()
    db.query(Beneficiary).delete()
    db.query(Shop).delete()
    db.commit()
    return db

def test_full_distribution():
    db = setup_db()
    current_month = datetime.utcnow().strftime("%Y-%m")
    
    shop = Shop(id="TEST_SHOP_1", name="Test Shop", risk_score=0.1)
    db.add(shop)
    
    ben = Beneficiary(ration_card="1234567890", name="Test Citizen", shop_id="TEST_SHOP_1")
    db.add(ben)
    
    ent = Entitlement(ration_card="1234567890", month_year=current_month, wheat=10.0, rice=20.0, sugar=2.0)
    db.add(ent)
    
    txn = Transaction(
        id="txn-test-1",
        ration_card="1234567890",
        shop_id="TEST_SHOP_1",
        transaction_type="DISTRIBUTION",
        items={"wheat": 10.0, "rice": 20.0, "sugar": 2.0},
        timestamp=datetime.utcnow(),
        block_hash="hash1",
        previous_hash="prev0",
        block_index=101
    )
    db.add(txn)
    db.commit()
    
    res = get_citizen_entitlement(db, ben)
    assert res["status"] == "completed"
    assert res["is_settled"] is True
    assert res["wheat_remaining"] == 0.0
    assert res["last_txn_hash"] == "hash1"
    db.close()

def test_cash_compensation():
    db = setup_db()
    current_month = datetime.utcnow().strftime("%Y-%m")
    
    shop = Shop(id="TEST_SHOP_2", name="Test Shop", risk_score=0.1)
    db.add(shop)
    
    ben = Beneficiary(ration_card="CASH_123", name="Cash Citizen", shop_id="TEST_SHOP_2")
    db.add(ben)
    
    ent = Entitlement(ration_card="CASH_123", month_year=current_month, wheat=10.0, rice=20.0, sugar=2.0)
    db.add(ent)
    
    # Partial distribution
    txn1 = Transaction(
        id="txn-cash-1",
        ration_card="CASH_123",
        shop_id="TEST_SHOP_2",
        transaction_type="DISTRIBUTION",
        items={"wheat": 5.0},
        timestamp=datetime.utcnow() - timedelta(hours=1),
        block_hash="hash_dist",
        previous_hash="prev1",
        block_index=201
    )
    # Cash compensation
    txn2 = Transaction(
        id="txn-cash-2",
        ration_card="CASH_123",
        shop_id="TEST_SHOP_2",
        transaction_type="CASH_TRANSFER",
        items={},
        cash_collected=450.0,
        timestamp=datetime.utcnow(),
        block_hash="hash_cash",
        previous_hash="hash_dist",
        block_index=202
    )
    db.add(txn1)
    db.add(txn2)
    db.commit()
    
    res = get_citizen_entitlement(db, ben)
    assert res["status"] == "partial"
    assert res["is_settled"] is True
    assert res["cash_compensation"]["amount"] == 450.0
    assert res["cash_compensation"]["txn_hash"] == "hash_cash"
    db.close()

def test_short_distribution_reason():
    db = setup_db()
    current_month = datetime.utcnow().strftime("%Y-%m")
    
    shop = Shop(id="TEST_SHOP_3", name="Test Shop", risk_score=0.1)
    db.add(shop)
    
    ben = Beneficiary(ration_card="SHORT_123", name="Short Citizen", shop_id="TEST_SHOP_3")
    db.add(ben)
    
    ent = Entitlement(ration_card="SHORT_123", month_year=current_month, wheat=10.0, rice=20.0, sugar=2.0)
    db.add(ent)
    
    txn = Transaction(
        id="txn-short-1",
        ration_card="SHORT_123",
        shop_id="TEST_SHOP_3",
        transaction_type="DISTRIBUTION",
        items={"wheat": 2.0},
        notes="Stock outage at shop",
        timestamp=datetime.utcnow(),
        block_hash="hash_short",
        previous_hash="prev2",
        block_index=301
    )
    db.add(txn)
    db.commit()
    
    res = get_citizen_entitlement(db, ben)
    assert res["status"] == "partial"
    assert res["is_settled"] is False
    assert res["short_distribution_reason"] == "Stock outage at shop"
    db.close()

def test_shop_risk_elevated():
    db = setup_db()
    current_month = datetime.utcnow().strftime("%Y-%m")
    
    shop = Shop(id="RISKY_SHOP", name="Risky Shop", risk_score=0.3)
    db.add(shop)
    
    ben = Beneficiary(ration_card="RISK_123", name="Risk Citizen", shop_id="RISKY_SHOP")
    db.add(ben)
    
    # Add multiple short distributions for this shop in last 30 days
    for i in range(3):
        txn = Transaction(
            id=f"txn-risk-{i}",
            ration_card=f"OTHER_{i}",
            shop_id="RISKY_SHOP",
            transaction_type="DISTRIBUTION",
            items={}, # items is mandatory
            notes="Short",
            timestamp=datetime.utcnow() - timedelta(days=1),
            block_hash=f"h{i}",
            previous_hash="prev",
            block_index=500+i
        )
        db.add(txn)
    
    db.commit()
    
    res = get_citizen_entitlement(db, ben)
    assert res["shop_risk_level"] == "ELEVATED"
    assert "multiple short distributions" in res["shop_warning"]
    db.close()

if __name__ == "__main__":
    test_full_distribution()
    test_cash_compensation()
    test_short_distribution_reason()
    test_shop_risk_elevated()
    print("All backend verification tests passed!")
