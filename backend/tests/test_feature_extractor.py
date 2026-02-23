import pytest
from datetime import datetime
import time
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.transaction import Transaction
from app.models.complaint import Complaint
from app.models.entitlement import Entitlement
from app.models.user import User
from app.services.ml.feature_extractor import extract_shop_features

@pytest.fixture(scope="module")
def db_session():
    # Setup test environment DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_extract_shop_features_clean_and_edge(db_session: Session):
    shop_id = "TEST_SHOP_ML_99"
    
    # 0. Clean previous test data
    db_session.query(Transaction).filter(Transaction.shop_id == shop_id).delete()
    db_session.query(Entitlement).filter(
        Entitlement.ration_card.in_(
            db_session.query(Beneficiary.ration_card).filter(Beneficiary.shop_id == shop_id)
        )
    ).delete(synchronize_session=False)
    db_session.query(Beneficiary).filter(Beneficiary.shop_id == shop_id).delete()
    db_session.query(Complaint).filter(Complaint.shop_id == shop_id).delete()
    db_session.query(Shop).filter(Shop.id == shop_id).delete()
    db_session.commit()
    
    # 1. Create mock shop
    shop = Shop(id=shop_id, name="Test ML Shop")
    db_session.add(shop)
    
    # 2. Add 50 beneficiaries
    for i in range(50):
        ben = Beneficiary(ration_card=f"CARD_ML_{i}", name=f"Ben {i}", shop_id=shop_id)
        db_session.add(ben)
        ent = Entitlement(ration_card=f"CARD_ML_{i}", month_year="2026-02", wheat=10, rice=10, sugar=5)
        db_session.add(ent)
        
    db_session.commit()
    
    # 3. Edge Case: 0 transactions, 50 beneficiaries
    start_time = time.time()
    features1 = extract_shop_features(db_session, shop_id)
    duration_ms = (time.time() - start_time) * 1000
    
    assert features1["night_ratio"] == 0.0
    assert features1["mismatch_ratio"] == 0.0
    assert features1["complaint_rate"] == 0.0
    assert features1["weekend_ratio"] == 0.0
    assert features1["ghost_ratio"] == 1.0
    # The consistency score default is simply max(0, 1/0.01) = 100.0 without transactions
    
    print(f"Empty Shop Execution Time: {duration_ms:.2f}ms")
    assert duration_ms < 50.0  # Should be < 20-30ms
    
    # 4. Add transactions (10 night, 10 weekend day)
    for i in range(10):
        # 10 PM (Night)
        dt = datetime(2026, 2, 10, 22, 30)
        txn = Transaction(
            id=f"txn_ml_n_{i}", block_index=1000+i, shop_id=shop_id, ration_card=f"CARD_ML_0",
            block_hash="xyz", previous_hash="xyz",
            items={"wheat": 10, "rice": 10}, timestamp=dt
        )
        db_session.add(txn)
    
    for i in range(10):
        # 2 PM, weekend (Saturday, Feb 14, 2026)
        dt = datetime(2026, 2, 14, 14, 0)
        txn = Transaction(
            id=f"txn_ml_w_{i}", block_index=2000+i, shop_id=shop_id, ration_card=f"CARD_ML_1",
            block_hash="xyz", previous_hash="xyz",
            items={"wheat": 10, "rice": 10}, timestamp=dt
        )
        db_session.add(txn)
        
    db_session.commit()
    
    start_time = time.time()
    features2 = extract_shop_features(db_session, shop_id)
    duration_ms2 = (time.time() - start_time) * 1000
    print(f"20 Txns Execution Time: {duration_ms2:.2f}ms")
    
    assert features2["night_ratio"] == 0.5  # 10 out of 20
    assert features2["weekend_ratio"] == 0.5 # 10 out of 20
    # Total allocated = 50 Bens * 25 = 1250. Distributed = 20 * 20 = 400. Mismatch = 400/1250 = 0.32
    assert features2["mismatch_ratio"] == (400.0 / 1250.0)
    assert duration_ms2 < 50.0
    
    # 5. Add complaint spike
    for i in range(5):
        comp = Complaint(id=f"comp_ml_{i}", shop_id=shop_id, citizen_name=f"Ben {i}", ration_card=f"CARD_ML_{i}", complaint_type="Quality")
        db_session.add(comp)
    db_session.commit()
    
    features3 = extract_shop_features(db_session, shop_id)
    assert features3["complaint_rate"] == 10.0 # 5 / 50 * 100
    
    # 6. Safe defaults on non-existent shop (empty result sets)
    features4 = extract_shop_features(db_session, "NON_EXIST_SHOP")
    assert features4["ghost_ratio"] == 1.0
    assert features4["mismatch_ratio"] == 1.0
    assert features4["night_ratio"] == 0.0
