from app.database import SessionLocal
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.models.shop import Shop
from app.models.user import User, UserRole
from app.core.security import get_password_hash
import uuid

def setup_test_citizen():
    db = SessionLocal()
    try:
        # 1. Ensure Shop EG001 exists
        shop = db.query(Shop).filter(Shop.id == "EG001").first()
        if not shop:
            print("Creating Shop EG001...")
            shop = Shop(
                id="EG001",
                name="Test Shop EG001",
                district="East Godavari",
                mandal="Rajahmundry",
                stock_wheat=100.0,
                stock_rice=100.0,
                stock_sugar=50.0
            )
            db.add(shop)
            db.commit()
            db.refresh(shop)

        # 2. Create/Update Beneficiary APTEST123456
        beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == "APTEST123456").first()
        hashed_pwd = get_password_hash("password123")
        
        if beneficiary:
            print("Updating Beneficiary APTEST123456...")
            beneficiary.mobile = "8106837557"
            beneficiary.mobile_verified = True
            beneficiary.account_status = "active"
            beneficiary.district = "East Godavari"
            beneficiary.shop_id = "EG001"
            beneficiary.password_hash = hashed_pwd
        else:
            print("Creating Beneficiary APTEST123456...")
            beneficiary = Beneficiary(
                ration_card="APTEST123456",
                name="Test Citizen",
                mobile="8106837557",
                mobile_verified=True,
                district="East Godavari",
                mandal="Rajahmundry",
                shop_id="EG001",
                family_members=4,
                account_status="active",
                password_hash=hashed_pwd
            )
            db.add(beneficiary)

        # 3. Ensure Entitlement exists for the month
        entitlement = db.query(Entitlement).filter(Entitlement.ration_card == "APTEST123456").first()
        if not entitlement:
            print("Creating Entitlement for APTEST123456...")
            entitlement = Entitlement(
                ration_card="APTEST123456",
                wheat=5.0,
                rice=20.0,
                sugar=1.0,
                month_year="2026-02"
            )
            db.add(entitlement)
            
        # 4. Create/Update Dealer for EG001
        dealer = db.query(User).filter(User.shop_id == "EG001", User.role == UserRole.dealer).first()
        if not dealer:
            print("Creating Dealer for EG001...")
            dealer = User(
                id="dealer_eg_001",
                name="Test Dealer EG001",
                mobile="9999999999",
                password_hash=get_password_hash("dealer123"),
                role=UserRole.dealer,
                district="East Godavari",
                shop_id="EG001",
                dealer_status="active",
                is_active=True
            )
            db.add(dealer)
        else:
            print("Updating Dealer for EG001...")
            dealer.password_hash = get_password_hash("dealer123")
            dealer.dealer_status = "active"
            dealer.is_active = True
        
        db.commit()
        print("\n" + "="*30)
        print("  TEST LOGIN CREDENTIALS")
        print("="*30)
        print("CITIZEN LOGIN:")
        print("  Ration Card: APTEST123456")
        print("  Password:    password123")
        print("-" * 30)
        print("DEALER LOGIN:")
        print("  Mobile or Shop ID: 9999999999 or EG001")
        print("  Password:    dealer123")
        print("="*30)
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_test_citizen()
