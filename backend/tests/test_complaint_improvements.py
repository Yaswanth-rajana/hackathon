import pytest
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.models.anomaly import Anomaly
from app.models.entitlement import Entitlement
from app.models.transaction import Transaction
from app.schemas.citizen_schema import ComplaintCreateRequest
from app.services import citizen_service
from datetime import datetime, timedelta
from sqlalchemy import text
import uuid

@pytest.fixture(scope="module")
def db():
    # Setup - Drop with CASCADE to ensure schema updates
    db = SessionLocal()
    try:
        db.execute(text("DROP TABLE IF EXISTS complaints CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS anomalies CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS transactions CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS entitlements CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS beneficiaries CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS shops CASCADE"))
        db.commit()
    except Exception as e:
        print(f"Cleanup warning: {e}")
        db.rollback()

    Base.metadata.create_all(bind=engine)
    
    # Cleanup any old test data - Order matters for FKs
    db.query(Complaint).delete()
    db.query(Anomaly).delete()
    db.query(Transaction).delete()
    db.query(Entitlement).delete()
    db.query(Beneficiary).delete()
    db.query(Shop).delete()
    db.commit()

    # Seed demo data
    shop = Shop(id="TEST_SHOP_1", name="Test Shop", district="Hyderabad")
    db.add(shop)
    
    ben = Beneficiary(
        ration_card="TEST_RC_123",
        name="Test Citizen",
        shop_id="TEST_SHOP_1",
        district="Cyberabad", # Specific district for testing auto-assignment
        is_active=True
    )
    db.add(ben)
    db.commit()
    
    yield db
    
    # Teardown
    db.close()

def test_complaint_spam_prevention(db: Session):
    ben = db.query(Beneficiary).filter(Beneficiary.ration_card == "TEST_RC_123").first()
    
    req = ComplaintCreateRequest(
        complaint_type="quality",
        description="Testing description that is long enough.",
        severity="minor",
        is_anonymous=False
    )
    
    # First submission should pass
    res1 = citizen_service.file_complaint(db, ben, req)
    assert res1["complaint_type"] == "quality"
    
    # Immediate second submission with same type/shop should fail
    with pytest.raises(Exception) as excinfo:
        citizen_service.file_complaint(db, ben, req)
    assert "Duplicate complaint detected" in str(excinfo.value)

    # Submission with DIFFERENT type should pass
    req2 = ComplaintCreateRequest(
        complaint_type="quantity",
        description="Testing another description that is long enough.",
        severity="minor",
        is_anonymous=False
    )
    res2 = citizen_service.file_complaint(db, ben, req2)
    assert res2["complaint_type"] == "quantity"

def test_district_auto_assignment(db: Session):
    ben = db.query(Beneficiary).filter(Beneficiary.ration_card == "TEST_RC_123").first()
    
    req = ComplaintCreateRequest(
        complaint_type="behavior",
        description="Testing behavior description here.",
        severity="major",
        is_anonymous=True
    )
    
    res = citizen_service.file_complaint(db, ben, req)
    
    # Check that district in DB matches beneficiary.district, not random default
    complaint = db.query(Complaint).filter(Complaint.id == res["id"]).first()
    assert complaint.district == "Cyberabad"
    assert complaint.is_anonymous is True

def test_anomaly_bridge_urgent(db: Session):
    # Use a different shop/citizen to avoid interference from previous tests
    shop2 = Shop(id="TEST_SHOP_URGENT", name="Urgent Shop", district="Hyderabad")
    db.add(shop2)
    db.commit()

    ben2 = Beneficiary(
        ration_card="TEST_RC_URGENT",
        name="Urgent Citizen",
        shop_id="TEST_SHOP_URGENT",
        district="Hyderabad",
        is_active=True
    )
    db.add(ben2)
    db.commit()
    
    # Submission with URGENT severity should trigger an anomaly
    req = ComplaintCreateRequest(
        complaint_type="availability",
        description="URGENT: Shop is closed during peak hours.",
        severity="urgent",
        is_anonymous=False,
        shop_id="TEST_SHOP_URGENT"
    )
    
    res = citizen_service.file_complaint(db, ben2, req)
    
    # Check anomaly table
    anomaly = db.query(Anomaly).filter(Anomaly.shop_id == "TEST_SHOP_URGENT").order_by(Anomaly.created_at.desc()).first()
    assert anomaly is not None
    assert anomaly.anomaly_type == "urgent_grievance"
    assert anomaly.severity == "high"

def test_blockchain_consistency(db: Session):
    ben = db.query(Beneficiary).filter(Beneficiary.ration_card == "TEST_RC_123").first()
    
    req = ComplaintCreateRequest(
        complaint_type="other",
        description="Testing blockchain details generation.",
        severity="minor",
        is_anonymous=False
    )
    
    res = citizen_service.file_complaint(db, ben, req)
    
    assert res["block_index"] is not None
    assert res["block_hash"] is not None
    assert res["block_hash"].startswith("0x") or len(res["block_hash"]) > 10
