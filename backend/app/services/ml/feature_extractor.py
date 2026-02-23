import logging
from typing import Dict
from datetime import datetime
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.beneficiary import Beneficiary
from app.models.transaction import Transaction
from app.models.complaint import Complaint
from app.models.entitlement import Entitlement

logger = logging.getLogger(__name__)

def extract_shop_features(db: Session, shop_id: str) -> Dict[str, float]:
    """
    Extract deterministic, fast, database-driven features for a given shop.
    Returns structured numeric features used for ML models or risk scoring.
    """
    try:
        # 1. Total Beneficiaries
        beneficiaries_count = db.query(func.count(Beneficiary.ration_card))\
            .filter(Beneficiary.shop_id == shop_id)\
            .scalar() or 0

        # 2., 3., 4., 5., 7. Total, Night, Weekend, Monthly Transactions & Distributed Quantity
        # Optimizing memory by avoiding full ORM object loading
        transactions = db.query(Transaction.timestamp, Transaction.items)\
            .filter(Transaction.shop_id == shop_id).all()

        total_txns = len(transactions)
        night_txns = 0
        weekend_txns = 0
        total_distributed = 0.0
        monthly_totals = defaultdict(float)

        for timestamp, items in transactions:
            # Handle float sum securely
            txn_total = 0.0
            if items:
                # Sum items checking if values are castable to float
                for v in items.values():
                    try:
                        txn_total += float(v)
                    except (ValueError, TypeError):
                        pass
                        
            total_distributed += txn_total

            # Handle portable timestamp parsing
            if timestamp:
                dt = timestamp
                if isinstance(timestamp, str):
                    try:
                        # SQLite might return strings
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    except ValueError:
                        pass
                
                if hasattr(dt, 'hour'):
                    # Night window: 10 PM -> 6 AM (22, 23, 0, 1, 2, 3, 4, 5)
                    if dt.hour >= 22 or dt.hour <= 5:
                        night_txns += 1
                    
                    # Weekend: Saturday (5) or Sunday (6)
                    if dt.weekday() in [5, 6]:
                        weekend_txns += 1
                    
                    # Monthly grouping
                    month_key = dt.strftime("%Y-%m")
                    monthly_totals[month_key] += txn_total

        # 5. Total Allocated
        # We compute this by joining Entitlement across all Beneficiaries for the shop
        allocations = db.query(Entitlement.wheat, Entitlement.rice, Entitlement.sugar)\
            .join(Beneficiary, Entitlement.ration_card == Beneficiary.ration_card)\
            .filter(Beneficiary.shop_id == shop_id).all()
        
        total_allocated = sum(
            float(a.wheat or 0) + float(a.rice or 0) + float(a.sugar or 0) 
            for a in allocations
        )

        # 6. Total Complaints
        complaints_count = db.query(func.count(Complaint.id))\
            .filter(Complaint.shop_id == shop_id)\
            .scalar() or 0

        # 7. Distribution Variance
        values = list(monthly_totals.values())
        if len(values) > 1:
            # Simple sample variance formula to avoid external dependencies like numpy
            mean = sum(values) / len(values)
            variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        else:
            variance = 0.0

        # FEATURE CALCULATIONS
        expected_beneficiaries = beneficiaries_count
        
        ghost_ratio = (
            float(beneficiaries_count) / float(expected_beneficiaries)
            if expected_beneficiaries > 0 else 1.0
        )
        
        mismatch_ratio = (
            float(total_distributed) / float(total_allocated)
            if total_allocated > 0 else 1.0
        )
        
        night_ratio = (
            float(night_txns) / float(total_txns)
            if total_txns > 0 else 0.0
        )
        
        weekend_ratio = (
            float(weekend_txns) / float(total_txns)
            if total_txns > 0 else 0.0
        )
        
        complaint_rate = (
            float(complaints_count) / float(beneficiaries_count) * 100.0
            if beneficiaries_count > 0 else 0.0
        )
        
        consistency_score = 1.0 / (variance + 0.01)

        # Safety Rules & Capping
        return {
            "ghost_ratio": max(0.0, min(ghost_ratio, 5.0)),
            "mismatch_ratio": max(0.0, min(mismatch_ratio, 5.0)),
            "night_ratio": max(0.0, min(night_ratio, 1.0)),
            "weekend_ratio": max(0.0, min(weekend_ratio, 1.0)),
            "complaint_rate": max(0.0, min(complaint_rate, 100.0)),
            "consistency_score": max(0.0, min(consistency_score, 100.0))
        }

    except Exception as e:
        logger.error(f"Error computing features for shop {shop_id}: {e}")
        # Safe Defaults on catastrophic failure
        return {
            "ghost_ratio": 1.0,
            "mismatch_ratio": 1.0,
            "night_ratio": 0.0,
            "weekend_ratio": 0.0,
            "complaint_rate": 0.0,
            "consistency_score": 0.0
        }
