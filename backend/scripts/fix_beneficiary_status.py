import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.beneficiary import Beneficiary

def activate_beneficiaries():
    db = SessionLocal()
    try:
        print("--- Activating Beneficiaries RC_001 and RC_002 ---")
        beneficiaries = db.query(Beneficiary).filter(Beneficiary.ration_card.in_(["RC_001", "RC_002"])).all()
        
        for b in beneficiaries:
            b.account_status = "active"
            b.mobile_verified = True
            print(f"✅ Beneficiary {b.ration_card} activated and mobile verified.")
            
        db.commit()
        print("--- Activation Complete ---")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error during activation: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    activate_beneficiaries()
