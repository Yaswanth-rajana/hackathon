import os
import sys

# Add the backend directory to sys.path so 'app' can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from app.models.monthly_analytics import MonthlyAnalytics

print("Creating monthly_analytics table...")
MonthlyAnalytics.__table__.create(engine, checkfirst=True)
print("Table created.")

print("Migration 3.1 complete.")
