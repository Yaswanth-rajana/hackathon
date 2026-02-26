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

def extract_shop_features(db: Session, shop_id: str, include_simulated: bool = False) -> Dict[str, float]:
    """
    Extract deterministic, fast, database-driven features for a given shop.
    Returns normalized 0-100 scores for behavioral fraud signals.
    """
    try:
        # 1. Total Beneficiaries (for Ghost Score)
        b_query = db.query(func.count(Beneficiary.ration_card)).filter(Beneficiary.shop_id == shop_id)
        if not include_simulated:
            b_query = b_query.filter(Beneficiary.is_simulated == False)
        beneficiaries_count = b_query.scalar() or 0
        
        expected_beneficiaries = db.query(func.count(Beneficiary.ration_card)).filter(
            Beneficiary.shop_id == shop_id, 
            Beneficiary.is_simulated == False
        ).scalar() or 0

        # 2. Transactions (for Timing/Variance)
        transactions = db.query(Transaction.timestamp, Transaction.items)\
            .filter(Transaction.shop_id == shop_id).all()

        total_txns = len(transactions)
        night_txns = 0
        total_distributed = 0.0
        monthly_totals = defaultdict(float)

        for timestamp, items in transactions:
            txn_total = 0.0
            if items:
                for v in items.values():
                    try:
                        txn_total += float(v)
                    except (ValueError, TypeError):
                        pass
            total_distributed += txn_total

            if timestamp:
                dt = timestamp
                if isinstance(timestamp, str):
                    try:
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    except ValueError:
                        pass
                
                if hasattr(dt, 'hour'):
                    # Night window: 10 PM -> 6 AM
                    if dt.hour >= 22 or dt.hour <= 5:
                        night_txns += 1
                    month_key = dt.strftime("%Y-%m")
                    monthly_totals[month_key] += txn_total

        # 3. Allocation (for Stock Score)
        alloc_query = db.query(Entitlement.wheat, Entitlement.rice, Entitlement.sugar)\
            .join(Beneficiary, Entitlement.ration_card == Beneficiary.ration_card)\
            .filter(Beneficiary.shop_id == shop_id)
        if not include_simulated:
            alloc_query = alloc_query.filter(Beneficiary.is_simulated == False)
        allocations = alloc_query.all()
        
        total_allocated = sum(
            float(a.wheat or 0) + float(a.rice or 0) + float(a.sugar or 0) 
            for a in allocations
        )

        # 4. Complaints (for Complaint Score)
        c_query = db.query(func.count(Complaint.id)).filter(Complaint.shop_id == shop_id)
        if not include_simulated:
            c_query = c_query.filter(Complaint.is_simulated == False)
        complaints_count = c_query.scalar() or 0

        # NORMALIZATION LOGIC (0-100)
        
        # Ghost Score: Based on % excess beneficiaries
        # If actual == expected -> 0. If actual == 1.5 * expected -> 100.
        ghost_ratio = float(beneficiaries_count) / float(expected_beneficiaries) if expected_beneficiaries > 0 else 1.0
        ghost_score = max(0.0, min(100.0, (ghost_ratio - 1.0) * 200.0))
        
        # Stock Score: Based on |distributed - allocated| / allocated
        # If mismatch is 0 -> 0. If mismatch is 50% -> 100.
        mismatch_percent = abs(total_distributed - total_allocated) / total_allocated if total_allocated > 0 else 0.0
        stock_score = max(0.0, min(100.0, mismatch_percent * 200.0))
        
        # Complaint Score: Based on complaints per 100 beneficiaries
        # 0 per 100 -> 0. 5 per 100 -> 100.
        rate_per_100 = (float(complaints_count) / float(expected_beneficiaries) * 100.0) if expected_beneficiaries > 0 else 0.0
        complaint_score = max(0.0, min(100.0, rate_per_100 * 20.0))
        
        # Timing Score: % of night transactions
        # 0% -> 0. 20% -> 100.
        night_ratio = (float(night_txns) / float(total_txns)) if total_txns > 0 else 0.0
        timing_score = max(0.0, min(100.0, night_ratio * 500.0))
        
        # Variance Score: Distribution consistency
        # Low variance -> 0. High variance (volatility) -> 100.
        values = list(monthly_totals.values())
        if len(values) > 1:
            mean = sum(values) / len(values)
            std_dev = (sum((x - mean) ** 2 for x in values) / (len(values) - 1)) ** 0.5
            cv = std_dev / mean if mean > 0 else 0.0
            variance_score = max(0.0, min(100.0, cv * 200.0)) # 0.5 CV -> 100
        else:
            variance_score = 0.0

        return {
            "ghost_score": round(ghost_score, 2),
            "stock_score": round(stock_score, 2),
            "complaint_score": round(complaint_score, 2),
            "timing_score": round(timing_score, 2),
            "variance_score": round(variance_score, 2)
        }

    except Exception as e:
        logger.error(f"Error computing features for shop {shop_id}: {e}")
        return {
            "ghost_score": 0.0,
            "stock_score": 0.0,
            "complaint_score": 0.0,
            "timing_score": 0.0,
            "variance_score": 0.0
        }

