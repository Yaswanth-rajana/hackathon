from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.transaction import Transaction
from app.models.risk_score import RiskScore
from app.models.user import User

def get_dashboard(db: Session, dealer: User) -> dict:
    if not dealer.shop_id:
        return {
            "total_beneficiaries": 0,
            "stock_available": {"wheat": 0, "rice": 0, "sugar": 0},
            "today_transactions": 0,
            "compliance_score": 100,
            "status": (dealer.dealer_status or "inactive").upper(),
            "shop_id": "N/A",
            "dealer_name": dealer.name,
            "address": "N/A"
        }

    # Total beneficiaries
    total_beneficiaries = db.query(func.count(Beneficiary.ration_card)).filter(
        Beneficiary.shop_id == dealer.shop_id
    ).scalar() or 0

    # Stock available
    shop = db.query(Shop).filter(Shop.id == dealer.shop_id).first()
    stock_available = {
        "wheat": getattr(shop, "stock_wheat", 0),
        "rice": getattr(shop, "stock_rice", 0),
        "sugar": getattr(shop, "stock_sugar", 0)
    }

    # Today's transactions
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_transactions = db.query(func.count(Transaction.id)).filter(
        Transaction.shop_id == dealer.shop_id,
        Transaction.timestamp >= today_start
    ).scalar() or 0

    # Compliance score
    latest_risk = db.query(RiskScore).filter(
        RiskScore.shop_id == dealer.shop_id
    ).order_by(RiskScore.calculated_at.desc()).first()
    
    compliance_score = 100
    if latest_risk and latest_risk.risk_score is not None:
        compliance_score = max(0, 100 - latest_risk.risk_score)

    return {
        "total_beneficiaries": total_beneficiaries,
        "stock_available": stock_available,
        "today_transactions": today_transactions,
        "compliance_score": compliance_score,
        "status": (dealer.dealer_status or "active").upper(),
        "shop_id": dealer.shop_id,
        "dealer_name": dealer.name,
        "address": shop.address if shop and shop.address else "N/A"
    }
