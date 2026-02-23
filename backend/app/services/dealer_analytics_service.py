from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.models.user import User
from app.models.transaction import Transaction
from app.models.risk_score import RiskScore
from app.models.shop import Shop

def get_weekly_performance(db: Session, dealer: User) -> dict:
    # 1. Daily Counts (Last 7 Days)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)
    
    daily_counts_raw = db.query(
        func.date(Transaction.timestamp).label("date"),
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.shop_id == dealer.shop_id,
        Transaction.timestamp >= start_date,
        Transaction.transaction_type == "distribution"
    ).group_by(func.date(Transaction.timestamp)).all()
    
    daily_counts = [{"date": str(row.date), "count": row.count} for row in daily_counts_raw]
    
    # 2. Compliance Score
    latest_risk = db.query(RiskScore).filter(
        RiskScore.shop_id == dealer.shop_id
    ).order_by(RiskScore.calculated_at.desc()).first()
    
    risk_val = latest_risk.risk_score if latest_risk and latest_risk.risk_score is not None else 0
    compliance_score = max(0, 100 - risk_val)
    
    # 3. Mandal Average Compute
    shop = db.query(Shop).filter(Shop.id == dealer.shop_id).first()
    mandal_avg = 100
    
    if shop and shop.mandal:
        # Get all shop IDs in the mandal
        mandal_shops = db.query(Shop.id).filter(Shop.mandal == shop.mandal).all()
        mandal_shop_ids = [s.id for s in mandal_shops]
        
        if mandal_shop_ids:
            # Average risk score for these shops
            avg_risk_result = db.query(func.avg(RiskScore.risk_score)).filter(
                RiskScore.shop_id.in_(mandal_shop_ids)
            ).scalar()
            
            avg_risk = float(avg_risk_result) if avg_risk_result is not None else 0
            mandal_avg = max(0, 100 - avg_risk)

    return {
        "daily_counts": daily_counts,
        "compliance_score": compliance_score,
        "mandal_avg": round(mandal_avg, 2),
        "difference": round(compliance_score - mandal_avg, 2)
    }
