import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta

from app.main import app
from app.database import Base, get_db
from app.models.beneficiary import Beneficiary
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.core.security import get_password_hash
from app.core.rate_limiter import limiter

# Disable rate limiter for testing
limiter.enabled = False

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture
def db():
    db_session = TestingSessionLocal()
    # Reset DB before each test
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield db_session
    db_session.close()

@pytest.fixture(autouse=True)
def flush_redis():
    import redis as sync_redis
    import os
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    client = sync_redis.Redis.from_url(REDIS_URL)
    client.flushdb()

@pytest.fixture
def setup_test_data(db):
    pwd_hash = get_password_hash("password123")
    
    # Create shop at specific coordinates (e.g. Origin)
    shop1 = Shop(id="shp-1", name="Shop 1", latitude=0.0, longitude=0.0)
    # Create shop far away (approx 111km per degree lat)
    shop2 = Shop(id="shp-2", name="Shop 2", latitude=0.1, longitude=0.1) # > 11km
    db.add_all([shop1, shop2])
    
    ben = Beneficiary(
        ration_card="RC123",
        name="Test User",
        shop_id="shp-1",
        account_status="active",
        password_hash=pwd_hash,
        is_active=True,
    )
    db.add(ben)
    db.commit()
    return ben

def test_failed_login_lockout(db, setup_test_data):
    # 5 failed attempts
    for _ in range(5):
        resp = client.post("/api/auth/citizen-login", json={"ration_card": "RC123", "password": "wrongpassword"})
        assert resp.status_code == 401
        
    # 6th attempt should be 403 locked
    resp = client.post("/api/auth/citizen-login", json={"ration_card": "RC123", "password": "password123"})
    assert resp.status_code == 403
    assert "Account locked" in resp.json()["detail"]
    
    # Simulate time passing
    ben = db.query(Beneficiary).filter_by(ration_card="RC123").first()
    ben.lockout_until = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    
    # After lockout expires, should succeed
    resp = client.post("/api/auth/citizen-login", json={"ration_card": "RC123", "password": "password123"})
    assert resp.status_code == 200

def test_complaint_rate_limit(db, setup_test_data):
    # Enable limiter specifically for this test
    limiter.enabled = True
    try:
        # Login to get token
        resp = client.post("/api/auth/citizen-login", json={"ration_card": "RC123", "password": "password123"})
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # File 3 complaints
        for _ in range(3):
            res = client.post("/api/citizen/complaint", json={"complaint_type": "quality", "description": "test"}, headers=headers)
            assert res.status_code == 200
            
        # 4th complaint should fail
        res = client.post("/api/citizen/complaint", json={"complaint_type": "quality", "description": "test"}, headers=headers)
        assert res.status_code == 429
        assert "Maximum of 3" in res.json()["detail"]
    finally:
        limiter.enabled = False

def test_nearby_shop_radius(db, setup_test_data):
    # Login to get token
    resp = client.post("/api/auth/citizen-login", json={"ration_card": "RC123", "password": "password123"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Nearby shops from origin
    res = client.get("/api/citizen/nearby-shops?lat=0.0&lng=0.0", headers=headers)
    assert res.status_code == 200
    shops = res.json()
    assert len(shops) == 1
    assert shops[0]["id"] == "shp-1"
    
    # Move to exactly shop 2
    res2 = client.get("/api/citizen/nearby-shops?lat=0.1&lng=0.1", headers=headers)
    assert res2.status_code == 200
    shops2 = res2.json()
    assert len(shops2) == 1
    assert shops2[0]["id"] == "shp-2"
