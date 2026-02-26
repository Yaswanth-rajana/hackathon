import sys
import os
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models.transaction import Transaction
from app.models.entitlement import Entitlement

def reset_rc001():
    db = SessionLocal()
    try:
        current_month = datetime.utcnow().strftime("%Y-%m")
        start_date = datetime.strptime(f"{current_month}-01", "%Y-%m-%d")
        
        print(f"--- Resetting Entitlement for RC_001 for {current_month} ---")
        
        # 1. Delete distribution transactions for the current month
        deleted_txs = db.query(Transaction).filter(
            Transaction.ration_card == "RC_001",
            Transaction.transaction_type == "DISTRIBUTION",
            Transaction.timestamp >= start_date
        ).delete(synchronize_session=False)
        
        print(f"✅ Deleted {deleted_txs} distribution transactions.")
        
        # 2. Reset or Create Entitlement record
        entitlement = db.query(Entitlement).filter(
            Entitlement.ration_card == "RC_001",
            Entitlement.month_year == current_month
        ).first()
        
        if entitlement:
            entitlement.wheat = 10.0
            entitlement.rice = 25.0
            entitlement.sugar = 2.0
            print(f"✅ Updated existing entitlement for RC_001.")
        else:
            entitlement = Entitlement(
                ration_card="RC_001",
                month_year=current_month,
                wheat=10.0,
                rice=25.0,
                sugar=2.0
            )
            db.add(entitlement)
            print(f"✅ Created new entitlement for RC_001.")
            
        db.commit()
        print("--- Reset Complete ---")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during reset: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_rc001()
