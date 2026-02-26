import pytest
import datetime
import uuid
import json
import hashlib
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.entitlement import Entitlement
from app.models.blockchain_ledger import BlockchainLedger
from app.core.security import get_password_hash

# Temporal Standardization
def get_current_month():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")

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
        shop_id=shop_id,
        district="HQ"
    )
    db.add(dealer)
    
    # 2. Create the Shop
    shop = Shop(
        id=shop_id,
        name="Test Shop",
        dealer_id=dealer_id,
        stock_wheat=500.0,
        stock_rice=100.0,
        stock_sugar=100.0
    )
    db.add(shop)
    
    # 3. Create Beneficiaries (Pre-Verified)
    rc = "RC123456"
    ben = Beneficiary(
        ration_card=rc,
        name="Test Beneficiary",
        family_members=4,
        shop_id=shop_id,
        account_status="active",
        mobile_verified=True,
        pin_hash=get_password_hash("1234")
    )
    db.add(ben)

    ben2 = Beneficiary(
        ration_card="RC999",
        name="Stock Test Ben",
        family_members=4,
        shop_id=shop_id,
        account_status="active",
        mobile_verified=True,
        pin_hash=get_password_hash("1234")
    )
    db.add(ben2)
    
    # 4. Create Entitlements
    current_month = get_current_month()
    ent = Entitlement(
        ration_card=rc,
        month_year=current_month,
        wheat=20.0,
        rice=15.0,
        sugar=5.0
    )
    db.add(ent)
    
    ent2 = Entitlement(
        ration_card="RC999",
        month_year=current_month,
        wheat=200.0,
        rice=0.0,
        sugar=0.0
    )
    db.add(ent2)
    
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
    return response.json()["access_token"]

@pytest.fixture
def dealer_headers(dealer_token):
    return {"Authorization": f"Bearer {dealer_token}"}


def test_dealer_dashboard(dealer_headers):
    response = client.get("/api/dealer/dashboard", headers=dealer_headers)
    assert response.status_code == 200
    assert "dealer_name" in response.json()


def test_beneficiary_lookup(dealer_headers):
    response = client.get("/api/dealer/beneficiary/RC123456", headers=dealer_headers)
    assert response.status_code == 200
    assert response.json()["ration_card"] == "RC123456"


def test_distribution_exceeding_entitlement(dealer_headers):
    response = client.post(
        "/api/dealer/distribute",
        headers=dealer_headers,
        json={
            "ration_card": "RC123456",
            "wheat": 25.0,
            "rice": 0,
            "sugar": 0
        }
    )
    assert response.status_code == 400
    assert "exceeds" in response.json()["detail"].lower()


def test_distribution_insufficient_stock(dealer_headers, setup_db):
    # Set shop stock to 10 for wheat manually
    db = TestingSessionLocal()
    shop = db.query(Shop).first()
    original_stock = shop.stock_wheat
    shop.stock_wheat = 10.0
    db.commit()

    # Request 15.0 (within RC123456 entitlement of 20.0)
    response = client.post(
        "/api/dealer/distribute",
        headers=dealer_headers,
        json={
            "ration_card": "RC123456",
            "wheat": 15.0,
            "rice": 0,
            "sugar": 0,
            "notes": "Testing stock shortage logic"
        }
    )
    assert response.status_code == 400
    assert "insufficient wheat stock" in response.json()["detail"].lower()
    
    # Revert stock
    shop.stock_wheat = original_stock
    db.commit()


def test_successful_distribution_logic(dealer_headers):
    response = client.post(
        "/api/dealer/distribute",
        headers=dealer_headers,
        json={
            "ration_card": "RC123456",
            "wheat": 10.0,
            "rice": 5.0,
            "sugar": 2.0,
            "notes": "Standard monthly distribution"
        }
    )
    assert response.status_code == 200
    assert "transaction_id" in response.json()


def test_cash_compensation_success(setup_db, dealer_headers):
    db = TestingSessionLocal()
    rc_cash = "RC_CASH_SUCCESS"
    new_ben = Beneficiary(
        ration_card=rc_cash,
        name="Cash Ben",
        family_members=4,
        shop_id=db.query(Shop).first().id,
        account_status="active",
        mobile_verified=True,
        pin_hash=get_password_hash("1234")
    )
    db.add(new_ben)
    db.flush()
    
    ent_cash = Entitlement(
        ration_card=rc_cash,
        month_year=get_current_month(),
        wheat=20.0, rice=15.0, sugar=5.0
    )
    db.add(ent_cash)
    db.commit()

    response = client.post(
        "/api/dealer/distribute",
        headers=dealer_headers,
        json={
            "ration_card": rc_cash,
            "wheat": 0,
            "rice": 0,
            "sugar": 0,
            "payment_mode": "cash_compensation",
            "cash_collected": 540.50,
            "notes": "Direct Benefit Transfer Policy"
        }
    )
    assert response.status_code == 200


def test_blockchain_hash_integrity(setup_db):
    db = TestingSessionLocal()
    latest_block = db.query(BlockchainLedger).order_by(BlockchainLedger.block_index.desc()).first()
    assert latest_block is not None
    
    header = {
        "index": latest_block.block_index,
        "timestamp": latest_block.timestamp,
        "payload_hash": latest_block.payload_hash,
        "previous_hash": latest_block.previous_hash,
        "nonce": latest_block.nonce,
        "validator": latest_block.validator,
        "network": latest_block.network
    }
    expected_hash_string = json.dumps(header, sort_keys=True)
    expected_hash = hashlib.sha256(expected_hash_string.encode()).hexdigest()
    
    assert latest_block.block_hash == expected_hash


# --- Phase 2: Security Hardening Tests ---

def test_empty_distribution_rejection(dealer_headers):
    response = client.post(
        "/api/dealer/distribute",
        json={
            "ration_card": "RC123456",
            "wheat": 0, "rice": 0, "sugar": 0,
            "payment_mode": "free"
        },
        headers=dealer_headers
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_mixed_mode_exploit_protection(dealer_headers):
    # RC123456 already took some groceries in test_successful_distribution_logic
    response = client.post(
        "/api/dealer/distribute",
        json={
            "ration_card": "RC123456",
            "wheat": 0, "rice": 0, "sugar": 0,
            "payment_mode": "cash_compensation",
            "cash_collected": 500,
            "notes": "Exploit attempt"
        },
        headers=dealer_headers
    )
    assert response.status_code == 400
    assert "Cannot switch to Cash Compensation" in response.json()["detail"]


def test_double_settlement_guard(dealer_headers, setup_db):
    # Use RC999 - distribute remaining 200 wheat
    response = client.post(
        "/api/dealer/distribute",
        json={
            "ration_card": "RC999",
            "wheat": 200, "rice": 0, "sugar": 0,
            "payment_mode": "free",
            "notes": "Full distribution for stock test user"
        },
        headers=dealer_headers
    )
    assert response.status_code == 200
    
    # Attempt more (Must fail)
    response = client.post(
        "/api/dealer/distribute",
        json={"ration_card": "RC999", "wheat": 1, "rice": 0, "sugar": 0, "payment_mode": "free"},
        headers=dealer_headers
    )
    assert response.status_code == 400
    assert "already settled" in response.json()["detail"].lower()
