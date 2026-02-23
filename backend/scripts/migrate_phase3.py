import os
import sys

# Add the backend directory to sys.path so 'app' can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from app.models.scheduled_report import ScheduledReport
from sqlalchemy import text

print("Creating scheduled_reports table...")
ScheduledReport.__table__.create(engine, checkfirst=True)
print("Table created.")

print("Adding composite index to anomalies...")
with engine.connect() as conn:
    try:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_anomaly_created_type ON anomalies(created_at, anomaly_type)"))
        conn.commit()
        print("Index added.")
    except Exception as e:
        print("Index might already exist or failed:", e)

print("Migration complete.")
