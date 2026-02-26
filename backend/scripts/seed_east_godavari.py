import sys
import os
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.complaint import Complaint
from app.models.entitlement import Entitlement
from app.core.security import get_password_hash

def seed_east_godavari():
    db = SessionLocal()
    try:
        print("--- Seeding East Godavari Test Data ---")
        
        # 1. Create Dealer
        dealer_id = "DEALER_EG_001"
        dealer = db.query(User).filter(User.id == dealer_id).first()
        if not dealer:
            dealer = User(
                id=dealer_id,
                name="EG Dealer One",
                mobile="8888888888",
                email="dealer_eg1@rationshield.gov.in",
                role=UserRole.dealer,
                district="East Godavari",
                password_hash=get_password_hash("123456"),
                is_active=True
            )
            db.add(dealer)
            db.flush() # Ensure ID is available for foreign keys
            print(f"✅ Created Dealer: {dealer_id}")
        else:
            dealer.district = "East Godavari"
            print(f"ℹ️ Dealer {dealer_id} already exists.")

        # 2. Create Shop
        shop_id = "SHOP_EG_001"
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            shop = Shop(
                id=shop_id,
                name="EG Model Shop 001",
                district="East Godavari",
                mandal="Rajamahendravaram",
                address="Main Street, Rajahmundry, East Godavari, AP",
                dealer_id=dealer_id,
                stock_wheat=500.0,
                stock_rice=1000.0,
                stock_sugar=100.0,
                stock_kerosene=50.0
            )
            db.add(shop)
            print(f"✅ Created Shop: {shop_id}")
        else:
            print(f"ℹ️ Shop {shop_id} already exists.")
            shop.dealer_id = dealer_id # Ensure it's linked

        # Link dealer to shop_id in User record
        dealer.shop_id = shop_id

        # 3. Create Beneficiary (Citizen)
        rc_id = "RC_EG_001"
        beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == rc_id).first()
        if not beneficiary:
            beneficiary = Beneficiary(
                ration_card=rc_id,
                name="EG Citizen One",
                mobile="7777777777",
                mobile_verified=True,
                account_status="active",
                password_hash=get_password_hash("123456"),
                district="East Godavari",
                mandal="Rajamahendravaram",
                shop_id=shop_id,
                family_members=4,
                is_active=True
            )
            db.add(beneficiary)
            print(f"✅ Created Beneficiary: {rc_id}")
        else:
            beneficiary.shop_id = shop_id
            beneficiary.account_status = "active"
            beneficiary.district = "East Godavari"
            print(f"ℹ️ Beneficiary {rc_id} already exists.")

        # 4. Create Entitlement
        current_month = datetime.utcnow().strftime("%Y-%m")
        entitlement = db.query(Entitlement).filter(
            Entitlement.ration_card == rc_id,
            Entitlement.month_year == current_month
        ).first()
        if not entitlement:
            entitlement = Entitlement(
                ration_card=rc_id,
                month_year=current_month,
                wheat=5.0,
                rice=20.0,
                sugar=1.0
            )
            db.add(entitlement)
            print(f"✅ Created Entitlement for {rc_id} ({current_month})")
        else:
            print(f"ℹ️ Entitlement for {rc_id} ({current_month}) already exists.")

        # 5. Create a Sample Complaint
        complaint_id = "CMP_EG_001"
        complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if not complaint:
            complaint = Complaint(
                id=complaint_id,
                citizen_name="EG Citizen One",
                ration_card=rc_id,
                shop_id=shop_id,
                complaint_type="quality",
                description="The quality of rice delivered this month is sub-standard.",
                district="East Godavari",
                status="pending",
                created_at=datetime.utcnow()
            )
            db.add(complaint)
            print(f"✅ Created Sample Complaint: {complaint_id}")
        else:
            print(f"ℹ️ Complaint {complaint_id} already exists.")

        db.commit()
        print("--- Seeding Completed Successfully ---")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during seeding: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_east_godavari()
