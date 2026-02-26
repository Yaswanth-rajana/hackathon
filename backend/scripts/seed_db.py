import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.core.security import get_password_hash


def seed():
    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    # ── Shops ──
    shop1 = db.query(Shop).filter(Shop.id == "SHOP_001").first()
    if not shop1:
        shop1 = Shop(
            id="SHOP_001",
            name="Visakha Prime FPS",
            district="Visakhapatnam",
            address="MVP Colony, Sector 4",
            stock_wheat=1200,
            stock_rice=4500,
            stock_sugar=300,
            timings="08:00 AM - 08:00 PM"
        )
        db.add(shop1)
        print("✅ Created SHOP_001")
    
    shop2 = db.query(Shop).filter(Shop.id == "SHOP_002").first()
    if not shop2:
        shop2 = Shop(
            id="SHOP_002",
            name="Vizag Central Rations",
            district="Visakhapatnam",
            address="Old Town Market",
            stock_wheat=800,
            stock_rice=3200,
            stock_sugar=150,
            timings="09:00 AM - 06:00 PM"
        )
        db.add(shop2)
        print("✅ Created SHOP_002")

    shop3 = db.query(Shop).filter(Shop.id == "TPt123").first()
    if not shop3:
        shop3 = Shop(
            id="TPt123",
            name="Emergency Response Hub",
            district="Visakhapatnam",
            address="District Collectorate Campus",
            stock_wheat=500,
            stock_rice=2000,
            stock_sugar=100,
            timings="24/7"
        )
        db.add(shop3)
        print("✅ Created TPt123")
    db.commit()

    # ── Dealer 1: SHOP_001 ──
    dealer1 = db.query(User).filter(User.id == "dealer_1").first()
    if dealer1:
        dealer1.shop_id = "SHOP_001"
        dealer1.password_hash = get_password_hash("password")
        dealer1.is_active = True
        print("✅ Updated dealer_1")
    else:
        dealer1 = User(
            id="dealer_1",
            name="Ramulu",
            mobile="9876543210",
            email="ramulu@example.com",
            role=UserRole.dealer,
            district="Visakhapatnam",
            shop_id="SHOP_001",
            password_hash=get_password_hash("password"),
            is_active=True,
        )
        db.add(dealer1)
        print("✅ Created dealer_1 (SHOP_001)")
    db.commit()

    # ── Dealer 2: SHOP_002 (for cross-shop 403 testing) ──
    dealer2 = db.query(User).filter(User.id == "dealer_2").first()
    if not dealer2:
        dealer2 = User(
            id="dealer_2",
            name="Suresh",
            mobile="9876543211",
            email="suresh@example.com",
            role=UserRole.dealer,
            district="Visakhapatnam",
            shop_id="SHOP_002",
            password_hash=get_password_hash("password"),
            is_active=True,
        )
        db.add(dealer2)
        db.commit()
        print("✅ Created dealer_2 (SHOP_002)")
    else:
        print("✅ dealer_2 already exists")

    # ── Beneficiary 1: belongs to SHOP_001 ──
    ben1 = db.query(Beneficiary).filter(Beneficiary.ration_card == "RC_001").first()
    if not ben1:
        ben1 = Beneficiary(
            ration_card="RC_001",
            name="Lakshmi",
            family_members=4,
            shop_id="TPt123",
            district="Visakhapatnam",
            password_hash=get_password_hash("123456"),
            account_status="active",
            mobile_verified=True,
            is_active=True
        )
        db.add(ben1)
        print("✅ Created beneficiary RC_001 (SHOP_001)")
    else:
        ben1.password_hash = get_password_hash("123456")
        ben1.district = "Visakhapatnam"
        ben1.account_status = "active"
        ben1.mobile_verified = True
        ben1.is_active = True
        print("✅ Updated existing beneficiary RC_001 with status and verification")
    db.commit()

    # ── Beneficiary 2: belongs to SHOP_002 (for 403 testing) ──
    ben2 = db.query(Beneficiary).filter(Beneficiary.ration_card == "RC_002").first()
    if not ben2:
        ben2 = Beneficiary(
            ration_card="RC_002",
            name="Ravi",
            family_members=3,
            shop_id="SHOP_002",
            district="Visakhapatnam",
            password_hash=get_password_hash("123456"),
            account_status="active",
            mobile_verified=True,
            is_active=True
        )
        db.add(ben2)
        print("✅ Created beneficiary RC_002 (SHOP_002)")
    else:
        ben2.password_hash = get_password_hash("123456")
        ben2.district = "Visakhapatnam"
        ben2.account_status = "active"
        ben2.mobile_verified = True
        ben2.is_active = True
        print("✅ Updated existing beneficiary RC_002 with status and verification")
    db.commit()

    # ── Complaints ──
    comp1 = db.query(Complaint).filter(Complaint.id == "CMP_001").first()
    if not comp1:
        comp1 = Complaint(
            id="CMP_001",
            citizen_name="Gopal Rao",
            ration_card="RC_999",
            shop_id="SHOP_001",
            complaint_type="underweight",
            description="Dealer gave 2kg less rice.",
            severity="minor",
            is_anonymous=False,
            district="Visakhapatnam",
            status="NEW"
        )
        db.add(comp1)
        
    comp2 = db.query(Complaint).filter(Complaint.id == "CMP_002").first()
    if not comp2:
        comp2 = Complaint(
            id="CMP_002",
            citizen_name="Anita",
            ration_card="RC_888",
            shop_id="SHOP_002",
            complaint_type="behavior",
            description="Dealer was shouting.",
            severity="major",
            is_anonymous=True,
            district="Visakhapatnam",
            status="INVESTIGATING",
            inspector_id="Inspector Kumar",
            notes=[{"id": "note_1", "note": "Visited shop on Tuesday.", "timestamp": "2023-10-01T10:00:00Z"}]
        )
        db.add(comp2)
        
    db.commit()
    print("✅ Created mock complaints")

    db.close()
    print("\n🎯 Seed complete. Ready for dealer sprint verification.")


if __name__ == "__main__":
    seed()
