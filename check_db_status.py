import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

DATABASE_URL = "postgresql://yaswanthrajana@localhost:5432/hackathon_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_db():
    db = SessionLocal()
    try:
        print("Checking Shops:")
        shops = db.execute(text("SELECT id, name, district FROM shops")).fetchall()
        for shop in shops:
            print(f"  Shop ID: {shop.id}, Name: {shop.name}, District: {shop.district}")
        
        print("\nChecking RiskScores for DEMO_001:")
        scores = db.execute(text("SELECT id, shop_id, risk_score, risk_level, fraud_type, calculated_at FROM risk_scores WHERE shop_id = 'DEMO_001' ORDER BY calculated_at DESC")).fetchall()
        if not scores:
            print("  No RiskScores found for DEMO_001")
        for score in scores:
            print(f"  ID: {score.id}, Score: {score.risk_score}, Level: {score.risk_level}, Type: {score.fraud_type}, Date: {score.calculated_at}")
            
        print("\nChecking Anomalies for DEMO_001:")
        anomalies = db.execute(text("SELECT id, shop_id, severity, anomaly_type, is_resolved FROM anomalies WHERE shop_id = 'DEMO_001'")).fetchall()
        if not anomalies:
            print("  No Anomalies found for DEMO_001")
        for anomaly in anomalies:
            print(f"  ID: {anomaly.id}, Severity: {anomaly.severity}, Type: {anomaly.anomaly_type}, Resolved: {anomaly.is_resolved}")

    finally:
        db.close()

if __name__ == "__main__":
    check_db()
