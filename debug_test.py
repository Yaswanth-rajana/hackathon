from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.core.security import get_password_hash
import datetime
import uuid
from sqlalchemy.orm import sessionmaker

# Mock testing session
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = TestClient(app)

def debug_distribute():
    Base.metadata.create_all(bind=engine)
    db = TestSessionLocal()
    
    # Setup
    uid = f"u-{uuid.uuid4().hex[:6]}"
    sid = f"s-{uuid.uuid4().hex[:6]}"
    rc = f"RC-{uuid.uuid4().hex[:6]}"
    
    dealer = User(id=uid, name="D", mobile="1234567890", role=UserRole.dealer, password_hash=get_password_hash("p"), is_active=True, dealer_status="active", shop_id=sid)
    shop = Shop(id=sid, name="S", dealer_id=uid, stock_wheat=100.0, stock_rice=100.0, stock_sugar=100.0)
    # Give shop a district for broadcast
    shop.district = "TEST_DISTRICT"
    
    ben = Beneficiary(ration_card=rc, name="B", shop_id=sid, account_status="active", mobile_verified=True)
    ent = Entitlement(ration_card=rc, month_year=datetime.datetime.utcnow().strftime("%Y-%m"), wheat=20.0, rice=20.0, sugar=20.0)
    
    db.add(dealer); db.add(shop); db.add(ben); db.add(ent)
    db.commit()
    
    # Login
    resp = client.post("/api/auth/dealer-login", json={"mobile": "1234567890", "password": "p"})
    token = resp.json()["access_token"]
    
    # Distribute
    resp = client.post("/api/dealer/distribute", headers={"Authorization": f"Bearer {token}"}, json={
        "ration_card": rc,
        "wheat": 10.0,
        "rice": 0,
        "sugar": 0,
        "notes": "Test"
    })
    print(f"Status: {resp.status_code}")
    print(f"Body: {resp.json()}")

if __name__ == "__main__":
    import os
    os.environ["TESTING"] = "1"
    debug_distribute()
