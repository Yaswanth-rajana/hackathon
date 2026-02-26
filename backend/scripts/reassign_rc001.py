import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.beneficiary import Beneficiary

def reassign_rc001():
    db = SessionLocal()
    try:
        print("--- Reassigning RC_001 to TPt123 ---")
        beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == "RC_001").first()
        
        if beneficiary:
            beneficiary.shop_id = "TPt123"
            db.commit()
            print(f"✅ Beneficiary RC_001 reassigned to shop TPt123.")
        else:
            print(f"❌ Beneficiary RC_001 not found.")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error during reassignment: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    reassign_rc001()
