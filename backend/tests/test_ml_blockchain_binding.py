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
from app.models.anomaly import Anomaly
from app.services.risk_service import run_ai_audit
from app.services.blockchain.blockchain import blockchain
import copy
import json

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Initialize crypto keys before testing signature functionality
    from app.services.blockchain.crypto import initialize_keys
    initialize_keys()
    
    # Reset blockchain for clean test state
    blockchain.chain = []
    blockchain.pending_transactions = []
    blockchain.create_genesis_block()
    
    try:
        yield db
    finally:
        db.close()

from app.models.risk_score import RiskScore

def setup_shop_data(db_session: Session, shop_id: str, is_fraud: bool):
    # Clean up
    db_session.query(Transaction).filter(Transaction.shop_id == shop_id).delete()
    db_session.query(Entitlement).filter(
        Entitlement.ration_card.in_(
            db_session.query(Beneficiary.ration_card).filter(Beneficiary.shop_id == shop_id)
        )
    ).delete(synchronize_session=False)
    db_session.query(Complaint).filter(Complaint.shop_id == shop_id).delete(synchronize_session=False)
    db_session.query(Anomaly).filter(Anomaly.shop_id == shop_id).delete()
    db_session.query(Beneficiary).filter(Beneficiary.shop_id == shop_id).delete()
    db_session.query(RiskScore).filter(RiskScore.shop_id == shop_id).delete()
    db_session.query(Shop).filter(Shop.id == shop_id).delete()
    db_session.commit()
    
    shop = Shop(id=shop_id, name="Test Shop ML Binding")
    db_session.add(shop)
    
    if not is_fraud:
        # Normal Shop Data
        for i in range(10):
            ben = Beneficiary(ration_card=f"NC_{shop_id}_{i}", name=f"Ben {i}", shop_id=shop_id)
            db_session.add(ben)
            ent = Entitlement(ration_card=f"NC_{shop_id}_{i}", month_year="2026-02", wheat=10, rice=10)
            db_session.add(ent)
            
        for month_offset in [1, 2, 3]:
            for i in range(10):
                dt = datetime(2026, month_offset, 11, 14, 0)
                wheat_qty = 10 if i % 2 == 0 else 9
                txn = Transaction(
                    id=f"nt_{shop_id}_{month_offset}_{i}", block_index=95000+(month_offset*100)+i, shop_id=shop_id, ration_card=f"NC_{shop_id}_{i}",
                    block_hash="xyz", previous_hash="xyz",
                    items={"wheat": wheat_qty, "rice": 10}, timestamp=dt
                )
                db_session.add(txn)
    else:
        # Fraud Shop Data
        for i in range(250):
            ben = Beneficiary(ration_card=f"FC_{shop_id}_{i}", name=f"Ghost {i}", shop_id=shop_id)
            db_session.add(ben)
            ent = Entitlement(ration_card=f"FC_{shop_id}_{i}", month_year="2026-02", wheat=1)
            db_session.add(ent)
            
        for i in range(250):
            dt = datetime(2026, 2, 15, 3, 0)
            txn = Transaction(
                id=f"ft_{shop_id}_{i}", block_index=105000+i, shop_id=shop_id, ration_card=f"FC_{shop_id}_{i}",
                block_hash="xyz", previous_hash="xyz",
                items={"wheat": 100, "rice": 100}, timestamp=dt
            )
            db_session.add(txn)
            comp = Complaint(id=f"fc_{shop_id}_{i}", shop_id=shop_id, citizen_name="Ghost", ration_card=f"FC_{shop_id}_{i}", complaint_type="Fraud")
            db_session.add(comp)
            
    db_session.commit()

def test_ml_binding_normal_shop(db_session: Session):
    shop_id = "N_SHOP"
    setup_shop_data(db_session, shop_id, is_fraud=False)
    
    initial_chain_length = len(blockchain.chain)
    
    result = run_ai_audit(db_session, shop_id)
    
    assert result["risk_level"] == "LOW"
    assert result["anomaly_created"] is False
    
    # Verify blockchain is untouched
    assert len(blockchain.chain) == initial_chain_length
    
    # Verify no pending transactions
    assert len(blockchain.pending_transactions) == 0

def test_ml_binding_fraud_shop(db_session: Session):
    shop_id = "F_SHOP"
    setup_shop_data(db_session, shop_id, is_fraud=True)
    
    initial_chain_length = len(blockchain.chain)
    
    result = run_ai_audit(db_session, shop_id)
    
    assert result["risk_level"] in ["HIGH", "CRITICAL"]
    assert result["anomaly_created"] is True
    
    # 1. Verify ML_ALERT block mined
    assert len(blockchain.chain) == initial_chain_length + 1
    
    latest_block = blockchain.get_latest_block()
    assert len(latest_block.transactions) == 1
    
    tx = latest_block.transactions[0]
    assert tx["type"] == "ML_ALERT"
    assert tx["shop_id"] == shop_id
    assert tx["signed_by"] == "AI_SYSTEM"
    assert "signature" in tx
    
    # 2. Verify Anomaly.block_hash is not null and matches
    anomaly = db_session.query(Anomaly).filter(
        Anomaly.shop_id == shop_id,
        Anomaly.is_resolved == False
    ).first()
    
    assert anomaly is not None
    assert anomaly.block_hash == latest_block.hash
    assert anomaly.block_index == latest_block.index
    
    # 3. Verify chain isValid
    assert blockchain.is_chain_valid() is True

def test_ml_binding_tamper(db_session: Session):
    """
    Simulate manual DB tampering vs Blockchain tampering to prove immutability.
    """
    # 1. Start with a valid chain from the previous test
    assert blockchain.is_chain_valid() is True
    
    latest_block = blockchain.get_latest_block()
    assert latest_block.transactions[0]["type"] == "ML_ALERT"
    
    # 2. Tamper with the in-memory JSON payload of the block (simulating disk tamper)
    # We change the risk_score from e.g. 98.5 to 50.0
    original_tx = latest_block.transactions[0]
    original_score = original_tx["risk_score"]
    
    # Tamper!
    latest_block.transactions[0]["risk_score"] = 50.0
    
    # 3. Verify it's now CORRUPTED
    assert blockchain.is_chain_valid() is False, "Chain should be corrupted after tamper!"
    
    # 4. Restore original state so subsequent tests or runs aren't broken
    latest_block.transactions[0]["risk_score"] = original_score
    assert blockchain.is_chain_valid() is True
