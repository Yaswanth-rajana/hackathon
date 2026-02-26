import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.complaint import Complaint
from app.models.beneficiary import Beneficiary

def fix_complaint_shops():
    db = SessionLocal()
    try:
        print("--- Reassigning RC_001 Complaints to TPt123 ---")
        # Find RC_001's current shop
        beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == "RC_001").first()
        if not beneficiary:
            print("❌ Beneficiary RC_001 not found.")
            return

        current_shop_id = beneficiary.shop_id
        
        # Update all non-resolved complaints for this beneficiary to their current shop
        updated = db.query(Complaint).filter(
            Complaint.ration_card == "RC_001",
            Complaint.status != "RESOLVED"
        ).update({Complaint.shop_id: current_shop_id}, synchronize_session=False)
        
        db.commit()
        print(f"✅ Updated {updated} complaints for RC_001 to shop {current_shop_id}.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during complaint reassignment: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_complaint_shops()
