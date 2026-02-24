import sys
import os

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def run_migration():
    print("Running Phase 1 Simulation Constraints Migration...")
    
    with engine.begin() as conn:
        # Beneficiaries
        print("Migrating beneficiaries table...")
        conn.execute(text("ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;"))
        # Set all existing nulls to false before enforcing NOT NULL
        conn.execute(text("UPDATE beneficiaries SET is_simulated = FALSE WHERE is_simulated IS NULL;"))
        conn.execute(text("ALTER TABLE beneficiaries ALTER COLUMN is_simulated SET NOT NULL;"))
        
        # Complaints
        print("Migrating complaints table...")
        conn.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("UPDATE complaints SET is_simulated = FALSE WHERE is_simulated IS NULL;"))
        conn.execute(text("ALTER TABLE complaints ALTER COLUMN is_simulated SET NOT NULL;"))
        
        # Anomalies
        print("Migrating anomalies table...")
        conn.execute(text("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("UPDATE anomalies SET is_simulated = FALSE WHERE is_simulated IS NULL;"))
        conn.execute(text("ALTER TABLE anomalies ALTER COLUMN is_simulated SET NOT NULL;"))
        
        # Indexes
        print("Creating simulation optimization indexes...")
        
        # Composite Index for Beneficiaries
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_beneficiaries_shop_simulated ON beneficiaries(shop_id, is_simulated);"))
        
        # Individual indexes for complaints and anomalies if needed
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_complaints_simulated ON complaints(is_simulated);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_anomalies_simulated ON anomalies(is_simulated);"))
        
        print("Phase 1 Migration Complete ✅")

if __name__ == "__main__":
    run_migration()
