import sys
import os

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def run_migration():
    print("Running POS Enhancements Database Migration...")
    
    with engine.begin() as conn:
        # Transactions table updates
        print("Updating transactions table...")
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cash_collected FLOAT DEFAULT 0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;"))
        
        # Constraints for transactions
        print("Updating transaction constraints...")
        # Drop if exists (PG specific syntax for constraints can be tricky, we'll try to add them if they don't exist)
        try:
            conn.execute(text("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS check_payment_mode;"))
            conn.execute(text("ALTER TABLE transactions ADD CONSTRAINT check_payment_mode CHECK (payment_mode IN ('free', 'subsidized', 'cash_compensation'));"))
        except Exception as e:
            print(f"Payment mode constraint note: {e}")

        try:
            conn.execute(text("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS check_transaction_type;"))
            conn.execute(text("ALTER TABLE transactions ADD CONSTRAINT check_transaction_type CHECK (transaction_type IN ('DISTRIBUTION', 'ALLOCATION', 'COMPLAINT', 'CASH_TRANSFER', 'distribution', 'allocation', 'complaint'));"))
        except Exception as e:
            print(f"Transaction type constraint note: {e}")

        # Beneficiaries table updates
        print("Updating beneficiaries table...")
        conn.execute(text("ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'inactive';"))
        conn.execute(text("ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);"))
        
        print("POS Enhancements Migration Complete ✅")

if __name__ == "__main__":
    run_migration()
