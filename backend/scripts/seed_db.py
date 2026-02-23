import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.models.complaint import Complaint
from app.core.security import get_password_hash


def seed():
    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    # ── Dealer 1: SHOP_001 ──
    dealer1 = db.query(User).filter(User.id == "dealer_1").first()
    if dealer1:
        dealer1.shop_id = "SHOP_001"
        db.commit()
        print("✅ Updated dealer_1 with shop_id=SHOP_001")
    else:
        dealer1 = User(
            id="dealer_1",
            name="Ramulu",
            mobile="9876543210",
            email="ramulu@example.com",
            role=UserRole.dealer,
            district="Hyderabad",
            shop_id="SHOP_001",
            password_hash=get_password_hash("password"),
            is_active=True,
        )
        db.add(dealer1)
        db.commit()
        print("✅ Created dealer_1 (SHOP_001)")

    # ── Dealer 2: SHOP_002 (for cross-shop 403 testing) ──
    dealer2 = db.query(User).filter(User.id == "dealer_2").first()
    if not dealer2:
        dealer2 = User(
            id="dealer_2",
            name="Suresh",
            mobile="9876543211",
            email="suresh@example.com",
            role=UserRole.dealer,
            district="Hyderabad",
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
            shop_id="SHOP_001",
        )
        db.add(ben1)
        db.commit()
        print("✅ Created beneficiary RC_001 (SHOP_001)")
    else:
        print("✅ Beneficiary RC_001 already exists")

    # ── Beneficiary 2: belongs to SHOP_002 (for 403 testing) ──
    ben2 = db.query(Beneficiary).filter(Beneficiary.ration_card == "RC_002").first()
    if not ben2:
        ben2 = Beneficiary(
            ration_card="RC_002",
            name="Ravi",
            family_members=3,
            shop_id="SHOP_002",
        )
        db.add(ben2)
        db.commit()
        print("✅ Created beneficiary RC_002 (SHOP_002)")
    else:
        print("✅ Beneficiary RC_002 already exists")

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
            complaint_type="rude behavior",
            description="Dealer was shouting.",
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
