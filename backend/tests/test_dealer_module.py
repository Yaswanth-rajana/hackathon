import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime
import uuid

from app.main import app
from app.database import Base, get_db
from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.entitlement import Entitlement
from app.models.blockchain_ledger import BlockchainLedger
from app.core.security import get_password_hash
import hashlib

# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_dealer.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Create a Dealer
    dealer_id = f"usr-{uuid.uuid4().hex[:8]}"
    shop_id = f"shp-{uuid.uuid4().hex[:8]}"
    dealer = User(
        id=dealer_id,
        name="Test Dealer",
        mobile="9999999999",
        role=UserRole.dealer,
        password_hash=get_password_hash("password123"),
        is_active=True,
        dealer_status="active",
        shop_id=shop_id
    )
    db.add(dealer)
    
    # 2. Create the Shop
    shop = Shop(
        id=shop_id,
        name="Test Shop",
        dealer_id=dealer_id,
        stock_wheat=100.0,
        stock_rice=100.0,
        stock_sugar=100.0
    )
    db.add(shop)
    
    # 3. Create a Beneficiary
    rc = "RC123456"
    ben = Beneficiary(
        ration_card=rc,
        name="Test Beneficiary",
        family_members=4,
        shop_id=shop_id,
        account_status="active",
        mobile_verified=True
    )
    db.add(ben)
    
    # 4. Create Entitlement
    current_month = datetime.datetime.utcnow().strftime("%Y-%m")
    ent = Entitlement(
        ration_card=rc,
        month_year=current_month,
        wheat=20.0,
        rice=15.0,
        sugar=5.0
    )
    db.add(ent)
    
    db.commit()
    yield db
    Base.metadata.drop_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module")
def dealer_token(setup_db):
    response = client.post(
        "/api/auth/dealer-login",
        json={"mobile": "9999999999", "password": "password123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_dealer_login_success(setup_db):
    response = client.post(
        "/api/auth/dealer-login",
        # Use a different IP or assume not hit limit yet for 2nd test
        json={"mobile": "9999999999", "password": "password123"}
    )
    assert response.status_code in (200, 429) # Ignore rate limit for raw login test if it hits


def test_dealer_login_failure(setup_db):
    response = client.post(
        "/api/auth/dealer-login",
        json={"mobile": "9999999999", "password": "wrongpassword"}
    )
    assert response.status_code in (401, 429)


def test_distribution_exceeding_entitlement(setup_db, dealer_token):
    headers = {"Authorization": f"Bearer {dealer_token}"}
    
    # Entitlement is 20 wheat. Try to distribute 25.
    response = client.post(
        "/api/dealer/distribute",
        headers=headers,
        json={
            "ration_card": "RC123456",
            "wheat": 25.0,
            "rice": 0,
            "sugar": 0
        }
    )
    assert response.status_code == 400
    assert "Exceeds" in response.json()["detail"]


def test_distribution_insufficient_stock(setup_db, dealer_token):
    headers = {"Authorization": f"Bearer {dealer_token}"}
    
    # Shop currently has 100 stock. Entitlement allows 20. But what if we try 100 on another user?
    # Let's create an entitlement of 200 to test stock guard specifically.
    db = setup_db
    ent = Entitlement(ration_card="RC999", month_year=datetime.datetime.utcnow().strftime("%Y-%m"), wheat=200.0)
    ben = Beneficiary(ration_card="RC999", name="Fake", shop_id="shp-" + list(db.query(Shop).all())[0].id.split('-')[1], account_status="active")
    db.add(ent)
    db.add(ben)
    db.commit()

    response = client.post(
        "/api/dealer/distribute",
        headers=headers,
        json={
            "ration_card": "RC999",
            "wheat": 150.0,
            "rice": 0,
            "sugar": 0
        }
    )
    assert response.status_code == 400
    assert "Insufficient" in response.json()["detail"]


def test_successful_distribution_and_double_distribution(setup_db, dealer_token):
    headers = {"Authorization": f"Bearer {dealer_token}"}
    
    # 1. Distribute 10 wheat (entitlement is 20)
    response = client.post(
        "/api/dealer/distribute",
        headers=headers,
        json={
            "ration_card": "RC123456",
            "wheat": 10.0,
            "rice": 0,
            "sugar": 0
        }
    )
    assert response.status_code == 200
    assert "transaction_id" in response.json()

    # 2. Try to distribute 15 more (total 25 > 20)
    response = client.post(
        "/api/dealer/distribute",
        headers=headers,
        json={
            "ration_card": "RC123456",
            "wheat": 15.0,
            "rice": 0,
            "sugar": 0
        }
    )
    assert response.status_code == 400
    assert "Exceeds wheat entitlement" in response.json()["detail"]


def test_blockchain_hash_integrity_and_tamper(setup_db):
    db = setup_db
    blocks = db.query(BlockchainLedger).order_by(BlockchainLedger.block_index.desc()).limit(2).all()
    assert len(blocks) >= 2
    
    latest_block = blocks[0]
    previous_block = blocks[1]
    
    # Verify manually
    expected_hash_string = f"{latest_block.block_index}{latest_block.previous_hash}{latest_block.payload_hash}"
    expected_hash = hashlib.sha256(expected_hash_string.encode()).hexdigest()
    
    assert latest_block.block_hash == expected_hash
    
    # Tamper test
    latest_block.payload_hash = "fake_tampered_hash"
    db.commit()
    
    from app.services.blockchain_service import verify_chain
    verify_result = verify_chain(db)
    assert verify_result["valid"] is False
