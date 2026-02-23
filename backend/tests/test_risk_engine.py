import pytest
import time
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.transaction import Transaction
from app.models.user import User
from app.models.entitlement import Entitlement
from app.models.complaint import Complaint
from app.services.ml.risk_engine import evaluate_shop

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_evaluate_normal_shop(db_session: Session):
    shop_id = "TEST_NORMAL_SHOP"
    
    # Clean up
    db_session.query(Transaction).filter(Transaction.shop_id == shop_id).delete()
    db_session.query(Entitlement).filter(
        Entitlement.ration_card.in_(
            db_session.query(Beneficiary.ration_card).filter(Beneficiary.shop_id == shop_id)
        )
    ).delete(synchronize_session=False)
    db_session.query(Complaint).filter(Complaint.shop_id == shop_id).delete(synchronize_session=False)
    db_session.query(Beneficiary).filter(Beneficiary.shop_id == shop_id).delete()
    db_session.query(Shop).filter(Shop.id == shop_id).delete()
    db_session.commit()
    
    shop = Shop(id=shop_id, name="Normal Test Shop")
    db_session.add(shop)
    
    # Add normal expected beneficiaries and entitlements
    for i in range(10):
        ben = Beneficiary(ration_card=f"NORMAL_CARD_{i}", name=f"Ben {i}", shop_id=shop_id)
        db_session.add(ben)
        ent = Entitlement(ration_card=f"NORMAL_CARD_{i}", month_year="2026-02", wheat=10, rice=10)
        db_session.add(ent)
        
    # Add normal daytime transactions across 3 months for normal variance
    for month_offset in [1, 2, 3]:
        for i in range(10):
            dt = datetime(2026, month_offset, 11, 14, 0) # Day time
            # Vary items slightly to induce a normal variance instead of 0 variance
            wheat_qty = 10 if i % 2 == 0 else 9
            txn = Transaction(
                id=f"norm_txn_risk_{month_offset}_{i}", block_index=55000+(month_offset*100)+i, shop_id=shop_id, ration_card=f"NORMAL_CARD_{i}",
                block_hash="xyz", previous_hash="xyz",
                items={"wheat": wheat_qty, "rice": 10}, timestamp=dt
            )
            db_session.add(txn)
        
    db_session.commit()
    
    start = time.perf_counter()
    result = evaluate_shop(db_session, shop_id)
    duration_ms = (time.perf_counter() - start) * 1000
    
    assert result["shop_id"] == shop_id
    assert result["risk_level"] == "LOW"
    assert result["is_fraud_predicted"] is False
    assert duration_ms < 50.0  # Safe threshold for CI, target is < 20ms locally

def test_evaluate_fraud_shop(db_session: Session):
    shop_id = "TEST_FRAUD_SHOP"
    
    # Clean up
    db_session.query(Transaction).filter(Transaction.shop_id == shop_id).delete()
    db_session.query(Entitlement).filter(
        Entitlement.ration_card.in_(
            db_session.query(Beneficiary.ration_card).filter(Beneficiary.shop_id == shop_id)
        )
    ).delete(synchronize_session=False)
    db_session.query(Complaint).filter(Complaint.shop_id == shop_id).delete(synchronize_session=False)
    db_session.query(Beneficiary).filter(Beneficiary.shop_id == shop_id).delete()
    db_session.query(Shop).filter(Shop.id == shop_id).delete()
    db_session.commit()
    
    shop = Shop(id=shop_id, name="Fraud Test Shop")
    db_session.add(shop)
    
    # Add ghost beneficiaries (massive anomaly)
    for i in range(250):
        ben = Beneficiary(ration_card=f"GHOST_CARD_{i}", name=f"Ghost {i}", shop_id=shop_id)
        db_session.add(ben)
        # Small theoretical allocation
        ent = Entitlement(ration_card=f"GHOST_CARD_{i}", month_year="2026-02", wheat=1)
        db_session.add(ent)
        
    # Add malicious night transactions on weekend with huge mismatch
    for i in range(250):
        # 3 AM transactions on a Sunday
        dt = datetime(2026, 2, 15, 3, 0)
        txn = Transaction(
            id=f"fraud_txn_risk_{i}", block_index=85000+i, shop_id=shop_id, ration_card=f"GHOST_CARD_{i}",
            block_hash="xyz", previous_hash="xyz",
            items={"wheat": 100, "rice": 100}, timestamp=dt
        )
        db_session.add(txn)
        
        # Massive complaints
        comp = Complaint(id=f"fraud_comp_risk_{i}", shop_id=shop_id, citizen_name="Ghost", ration_card=f"GHOST_CARD_{i}", complaint_type="Fraud")
        db_session.add(comp)
        
    db_session.commit()
    
    result = evaluate_shop(db_session, shop_id)
    
    assert result["shop_id"] == shop_id
    assert result["risk_level"] in ["CRITICAL", "HIGH"]
    assert result["is_fraud_predicted"] is True
    assert result["top_feature"] is not None

def test_evaluate_nonexistent_shop(db_session: Session):
    # Should not crash
    result = evaluate_shop(db_session, "INVALID_XYZ_123")
    
    assert result["shop_id"] == "INVALID_XYZ_123"
    assert result["risk_level"] == "LOW"
    assert result["is_fraud_predicted"] is False
