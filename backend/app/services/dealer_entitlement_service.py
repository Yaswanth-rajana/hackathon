from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.models.entitlement import Entitlement
from app.models.transaction import Transaction
from app.models.beneficiary import Beneficiary
from fastapi import HTTPException

def get_current_entitlement(db: Session, ration_card: str, current_month: str = None) -> Entitlement:
    if not current_month:
        current_month = datetime.utcnow().strftime("%Y-%m")
        
    entitlement = db.query(Entitlement).filter(
        Entitlement.ration_card == ration_card,
        Entitlement.month_year == current_month
    ).first()
    
    if not entitlement:
        # For hackathon/demo, we might want to auto-create or return zero if not found
        # but spec says "If not found -> return 400"
        raise HTTPException(status_code=400, detail="Entitlement not found for the current month")
        
    return entitlement

def get_already_received(db: Session, ration_card: str, current_month: str = None) -> dict:
    if not current_month:
        current_month = datetime.utcnow().strftime("%Y-%m")
        
    # Transaction timestamp is used to filter by current month
    start_date = datetime.strptime(f"{current_month}-01", "%Y-%m-%d")
    
    # Calculate sum of items from JSONB
    result = db.query(
        func.coalesce(func.sum(Transaction.items["wheat"].as_float()), 0).label("wheat"),
        func.coalesce(func.sum(Transaction.items["rice"].as_float()), 0).label("rice"),
        func.coalesce(func.sum(Transaction.items["sugar"].as_float()), 0).label("sugar")
    ).filter(
        Transaction.ration_card == ration_card,
        Transaction.transaction_type == "distribution",
        Transaction.timestamp >= start_date
    ).first()

    return {
        "wheat": result.wheat,
        "rice": result.rice,
        "sugar": result.sugar
    }
