import sys
import os
import hashlib
import json
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.beneficiary import Beneficiary
from app.models.complaint import Complaint
from app.models.anomaly import Anomaly
from app.models.transaction import Transaction
from app.models.risk_score import RiskScore
from app.models.simulation import SimulationBaseline

DEMO_SHOP_ID = "DEMO_001"

def capture_baseline():
    print(f"Capturing Simulation Baseline for Shop: {DEMO_SHOP_ID}...")
    
    db = SessionLocal()
    try:
        # Calculate counts
        beneficiaries_count = db.query(Beneficiary).filter(
            Beneficiary.shop_id == DEMO_SHOP_ID, 
            Beneficiary.is_simulated == False
        ).count()
        
        complaints_count = db.query(Complaint).filter(
            Complaint.shop_id == DEMO_SHOP_ID,
            Complaint.is_simulated == False
        ).count()
        
        anomaly_count = db.query(Anomaly).filter(
            Anomaly.shop_id == DEMO_SHOP_ID,
            Anomaly.is_simulated == False
        ).count()
        
        total_transactions = db.query(Transaction).filter(
            Transaction.shop_id == DEMO_SHOP_ID
        ).count()
        
        # Get latest risk score
        latest_risk = db.query(RiskScore).filter(
            RiskScore.shop_id == DEMO_SHOP_ID
        ).order_by(RiskScore.calculated_at.desc()).first()
        
        risk_score_val = float(latest_risk.risk_score) if latest_risk else 0.0
        risk_level_val = latest_risk.risk_level if latest_risk else "LOW"
        
        # Generate baseline hash
        baseline_data = {
            "beneficiaries": beneficiaries_count,
            "complaints": complaints_count,
            "anomalies": anomaly_count,
            "transactions": total_transactions,
            "risk_score": risk_score_val
        }
        baseline_str = json.dumps(baseline_data, sort_keys=True)
        hash_val = hashlib.sha256(baseline_str.encode()).hexdigest()
        
        # Store in DB
        existing_baseline = db.query(SimulationBaseline).filter_by(shop_id=DEMO_SHOP_ID).first()
        
        if existing_baseline:
            existing_baseline.beneficiaries_count = beneficiaries_count
            existing_baseline.complaints_count = complaints_count
            existing_baseline.anomaly_count = anomaly_count
            existing_baseline.total_transactions = total_transactions
            existing_baseline.risk_score = risk_score_val
            existing_baseline.risk_level = risk_level_val
            existing_baseline.hash_of_baseline = hash_val
            existing_baseline.snapshot_time = datetime.utcnow()
            print("Updated existing baseline snapshot.")
        else:
            new_baseline = SimulationBaseline(
                shop_id=DEMO_SHOP_ID,
                beneficiaries_count=beneficiaries_count,
                complaints_count=complaints_count,
                anomaly_count=anomaly_count,
                total_transactions=total_transactions,
                risk_score=risk_score_val,
                risk_level=risk_level_val,
                hash_of_baseline=hash_val
            )
            db.add(new_baseline)
            print("Created new baseline snapshot.")
            
        db.commit()
        print("Baseline captured successfully ✅")
        print(f"Result Hash: {hash_val}")
        
    except Exception as e:
        db.rollback()
        print(f"Error capturing baseline: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    capture_baseline()
