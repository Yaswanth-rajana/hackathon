from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import uuid

from app.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.user import User, UserRole
from app.models.audit import Audit
from app.models.shop import Shop
from app.models.risk_score import RiskScore
from app.utils.audit_logger import audit_logger
from app.services.event_emitter import manager
from app.services.analytics_aggregator import AnalyticsAggregator
from pydantic import BaseModel
from app.schemas.audit_schema import AuditResponse, AuditListResponse

class ScheduleAuditRequest(BaseModel):
    shop_id: str
    scheduled_date: str
    priority: str
    notes: Optional[str] = None

class CompleteAuditRequest(BaseModel):
    findings: str

router = APIRouter(
    prefix="/api/admin/audits",
    tags=["Admin Audits"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

def _emit(district, event_type, audit_id, background_tasks: BackgroundTasks):
    background_tasks.add_task(manager.emit_event, district, event_type, audit_id, "audit")

@router.post("/schedule", response_model=Dict[str, Any])
@audit_logger(action="SCHEDULE_AUDIT", target_type="audit")
def schedule_audit(
    request_data: ScheduleAuditRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify shop exists and is in admin's district (Skip district check for HQ)
    shop_query = db.query(Shop).filter(Shop.id == request_data.shop_id)
    if current_user.district and current_user.district != "HQ":
        shop_query = shop_query.filter(Shop.district == current_user.district)
    
    shop = shop_query.first()
    if not shop:
        raise HTTPException(404, "Shop not found or outside your district")
        
    audit = Audit(
        shop_id=request_data.shop_id,
        scheduled_date=datetime.fromisoformat(request_data.scheduled_date.replace("Z", "")),
        priority=request_data.priority,
        notes=request_data.notes,
        created_by=current_user.id,
        status="scheduled"
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    
    _emit(shop.district, "AUDIT_SCHEDULED", str(audit.id), background_tasks)
    
    return {"id": audit.id, "message": "Audit scheduled successfully"}

@router.get("", response_model=AuditListResponse)
def get_audits(
    district: Optional[str] = Query(None, description="Filter by district"),
    status: Optional[str] = None,
    shop_id: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_district = district if (current_user.district == "HQ" and district) else current_user.district
    
    query = db.query(Audit).join(Shop, Shop.id == Audit.shop_id)
    if target_district and target_district != "HQ":
        query = query.filter(Shop.district == target_district)
    
    if status:
        query = query.filter(Audit.status == status)
    if shop_id:
        query = query.filter(Audit.shop_id == shop_id)
        
    total = query.count()
    # Handle both scheduled_date and id for sorting
    audits = query.order_by(Audit.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "items": audits,
        "total": total,
        "page": page,
        "limit": limit
    }

def calculate_risk_delta(findings: str) -> tuple[int, bool]:
    """
    Evaluates findings and returns (delta, is_fraud). 
    Centralizing this prevents brittle inline route logic.
    """
    if not findings:
        return (-20, False)
        
    fraud_keywords = ["fraud", "mismatch", "fake", "violation", "short", "steal", "black market", "diverted"]
    findings_lower = findings.lower()
    
    found_fraud = any(kw in findings_lower for kw in fraud_keywords)
    
    if found_fraud:
        return (30, True) # Add 30 points
    elif "warning" in findings_lower or "minor" in findings_lower:
        return (10, False) # Minor infraction adds 10
    else:
        return (-20, False) # Clean audit reduces risk

@router.put("/{id}/complete", response_model=Dict[str, Any])
@audit_logger(action="COMPLETE_AUDIT", target_type="audit")
def complete_audit(
    id: int,
    request_data: CompleteAuditRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Audit).join(Shop).filter(Audit.id == id)
    if current_user.district and current_user.district != "HQ":
        query = query.filter(Shop.district == current_user.district)
        
    audit = query.first()
    if not audit:
        raise HTTPException(404, "Audit not found or unauthorized")
        
    if audit.status == "completed":
        raise HTTPException(400, "Audit is already completed")
        
    audit.status = "completed"
    audit.findings = request_data.findings
    audit.completed_date = datetime.utcnow()
    audit.auditor_id = current_user.id
    
    # Smart Risk Score update
    current_risk = db.query(RiskScore).filter(RiskScore.shop_id == audit.shop_id).order_by(RiskScore.calculated_at.desc()).first()
    
    risk_delta, found_fraud = calculate_risk_delta(request_data.findings)
    
    new_score_val = current_risk.risk_score if current_risk else 50
    new_score_val = max(0, min(100, new_score_val + risk_delta))
        
    # Always append RiskScore history
    new_risk = RiskScore(
        shop_id=audit.shop_id,
        risk_score=new_score_val,
        fraud_type="audit_fraud" if found_fraud else "audit_clear",
        confidence=0.9,
        month=datetime.utcnow().strftime("%Y-%m")
    )
    db.add(new_risk)
    
    db.commit()
    db.refresh(audit)
    
    AnalyticsAggregator.update_monthly_risk_average(db, current_user.district)
    
    _emit(audit.shop.district if hasattr(audit, 'shop') else current_user.district, "AUDIT_COMPLETED", str(audit.id), background_tasks)
    
    return {"id": audit.id, "message": "Audit completed", "new_risk_score": new_score_val}
