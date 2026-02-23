import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.core.security import get_password_hash
from datetime import datetime

def main():
    db = SessionLocal()
    try:
        ration_card = "WAP123456789"
        password = "password123"
        shop_id = "TPt123"

        ben = db.query(Beneficiary).filter(Beneficiary.ration_card == ration_card).first()
        if not ben:
            ben = Beneficiary(
                ration_card=ration_card,
                name="Demo Citizen Rajahmundry",
                shop_id=shop_id,
                family_members=4,
                account_status="active",
                mobile="9876543210",
                password_hash=get_password_hash(password),
                is_active=True,
                district="East Godavari",
                mandal="Rjy"
            )
            db.add(ben)
            db.commit()
            print(f"✅ Created citizen: {ration_card}")
        else:
            ben.shop_id = shop_id
            ben.password_hash = get_password_hash(password)
            ben.is_active = True
            ben.account_status = "active"
            db.commit()
            print(f"✅ Updated citizen: {ration_card}")

        # month_year format is "YYYY-MM" per model definition
        cur_month = datetime.utcnow().strftime("%Y-%m")
        ent = db.query(Entitlement).filter(
            Entitlement.ration_card == ration_card,
            Entitlement.month_year == cur_month
        ).first()

        if not ent:
            ent = Entitlement(
                ration_card=ration_card,
                month_year=cur_month,
                wheat=5.0,
                rice=10.0,
                sugar=2.0
            )
            db.add(ent)
            db.commit()
            print(f"✅ Created entitlement for {ration_card} in {cur_month}")
        else:
            print(f"ℹ️  Entitlement already exists for {ration_card} in {cur_month}")

        print()
        print("=" * 45)
        print("  DEMO CITIZEN LOGIN CREDENTIALS")
        print("=" * 45)
        print(f"  Ration Card : {ration_card}")
        print(f"  Password    : {password}")
        print(f"  Assigned FPS: {shop_id} (Rjy Mandal)")
        print(f"  Entitlement : Rice 10kg / Wheat 5kg / Sugar 2kg")
        print("=" * 45)

    finally:
        db.close()

if __name__ == "__main__":
    main()
