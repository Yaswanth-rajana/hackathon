import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from app.database import get_db
from app.core.dependencies import require_admin
from app.services.ml.risk_engine import evaluate_shop
from app.services.ml.explainability_service import explain_risk
from app.services.forecast_service import ForecastService
from app.services.recommendation_service import recommendation_service
from app.models.risk_score import RiskScore
from app.models.shop import Shop
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_admin)])

# In-memory snapshot for "Before vs After" comparison
# Format: { "shop_id": last_risk_score }
risk_snapshots: Dict[str, float] = {}

@router.post("/recalculate")
async def recalculate_risk(shop_id: str = "DEMO_001", db: Session = Depends(get_db)):
    """
    Triggers a fresh AI audit, preserving history and returning deltas.
    """
    # 1. Fetch latest score for 'Before' snapshot
    existing = db.query(RiskScore).filter(RiskScore.shop_id == shop_id).order_by(RiskScore.calculated_at.desc()).first()
    before_score = existing.risk_score if existing else 30.0

    # 2. Run new evaluation
    try:
        from app.services.audit_service import AuditService
        result = AuditService.run_shop_audit(db, shop_id)
    except Exception:
        logger.exception("Audit recalculation failed", extra={"shop_id": shop_id})
        raise HTTPException(status_code=500, detail="Internal server error")
    
    return {
        "shop_id": shop_id,
        "before": before_score,
        "after": result["risk_score"],
        "change": round(result["risk_score"] - before_score, 1),
        "delta_percent": f"{round(result['risk_score'] - before_score, 1)}%",
        "status": "success"
    }

@router.get("/risk-comparison")
async def get_risk_comparison(district: str = None, db: Session = Depends(get_db)):
    """
    Returns a list of shops with their current risk and deltas from history.
    """
    query = db.query(Shop)
    if district:
        query = query.filter(Shop.district == district)
    shops = query.all()
    
    comparison = []
    for shop in shops:
        # Get latest 2 scores to calculate delta
        scores = db.query(RiskScore).filter(
            RiskScore.shop_id == shop.id,
            RiskScore.fraud_type.notlike("projected_%") # Exclude synthetic points
        ).order_by(RiskScore.calculated_at.desc()).limit(2).all()
        
        after = scores[0].risk_score if len(scores) > 0 else 0.0
        before = scores[1].risk_score if len(scores) > 1 else after
        
        comparison.append({
            "shop_id": shop.id,
            "shop_name": shop.name,
            "before": before,
            "after": after,
            "change": round(after - before, 1),
            "level": scores[0].risk_level if len(scores) > 0 else "LOW"
        })
    
    return comparison

@router.get("/shop/{shop_id}/explanation")
async def get_shop_explanation(shop_id: str, db: Session = Depends(get_db)):
    """
    Returns the factor contribution breakdown and latest audit info.
    """
    result = evaluate_shop(db, shop_id)
    contributions = explain_risk(result["features"])
    
    return {
        "shop_id": shop_id,
        "risk_score": result["risk_score"],
        "confidence": result["confidence"],
        "contributions": contributions
    }

@router.get("/shop/{shop_id}/forensic")
async def get_shop_forensic(shop_id: str, db: Session = Depends(get_db)):
    """
    Returns a forensic timeline and financial impact metrics.
    """
    from app.services.forensic_service import ForensicService
    timeline = ForensicService.get_shop_timeline(db, shop_id)
    impact = ForensicService.get_financial_impact(db, shop_id)
    
    return {
        "shop_id": shop_id,
        "timeline": timeline,
        "impact": impact
    }

@router.get("/shop/{shop_id}/forecast")
async def get_shop_forecast(shop_id: str, db: Session = Depends(get_db)):
    """
    Returns risk history plus 7-day risk forecast (including synthetic points).
    """
    # Fetch history including synthetic projections
    history = db.query(RiskScore).filter(
        RiskScore.shop_id == shop_id
    ).order_by(RiskScore.calculated_at.asc()).all()
    
    # Format for chart (e.g., Recharts)
    data = []
    for h in history:
        item = {
            "date": h.calculated_at.strftime("%b %d %H:%M"),
            "risk": h.risk_score,
            "type": "projected" if "projected" in (h.fraud_type or "") else "actual"
        }
        data.append(item)
        
    return {
        "shop_id": shop_id,
        "chart_data": data,
        "forecast": ForecastService.predict_fraud_risk(db, shop_id) # Call original for baseline
    }

@router.get("/shop/{shop_id}/recommendations")
async def get_shop_recommendations(shop_id: str, db: Session = Depends(get_db)):
    """
    Returns predicted recommended actions for a shop based on latest score
    and projected 7-day risk (no-intervention scenario).
    """
    latest = db.query(RiskScore).filter(
        RiskScore.shop_id == shop_id,
        RiskScore.fraud_type.notlike("projected_%")
    ).order_by(RiskScore.calculated_at.desc()).first()
    
    current_score = float(latest.risk_score) if latest else 0.0
    forecast = ForecastService.predict_fraud_risk(db, shop_id)
    projected_score = float(forecast.get("predicted_risk_day_7", current_score) or current_score)
    effective_score = max(current_score, projected_score)
    decision_basis = "projected_7d" if projected_score > current_score else "current"
    
    actions = []
    if effective_score >= 85:
        actions = [
            {"action": "Schedule Immediate Audit", "priority": "CRITICAL"},
            {"action": "Freeze Payouts", "priority": "CRITICAL"},
            {"action": "Notify District Vigilance", "priority": "HIGH"},
            {"action": "Verify Fingerprints (POS)", "priority": "MEDIUM"}
        ]
    elif effective_score >= 70:
        actions = [
            {"action": "Schedule Audit", "priority": "HIGH"},
            {"action": "Flag for Monitoring", "priority": "MEDIUM"}
        ]
    elif effective_score >= 50:
        actions = [
            {"action": "Escalated Monitoring", "priority": "MEDIUM"},
            {"action": "Schedule Preventive Audit", "priority": "MEDIUM"}
        ]
    else:
        actions = [{"action": "Routine Monitoring", "priority": "LOW"}]
        
    return {
        "shop_id": shop_id,
        "current_risk_score": round(current_score, 1),
        "projected_risk_day_7": round(projected_score, 1),
        "decision_risk_score": round(effective_score, 1),
        "decision_basis": decision_basis,
        "recommended_actions": actions
    }
