import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.database import get_db
from app.models.inspection import Inspection
from app.models.shop import Shop
from app.models.user import User, UserRole
from app.schemas.inspection_schema import (
    InspectionCreate,
    InspectionResponse,
    InspectionAction,
    InspectionComplete,
    InspectionStats
)
from app.core.dependencies import require_role

router = APIRouter(
    dependencies=[Depends(require_role(UserRole.admin))]
)

@router.get("", response_model=List[InspectionResponse])
def get_inspections(
    status: Optional[str] = None,
    shop_id: Optional[str] = None,
    inspector_id: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Inspection)
    if status:
        query = query.filter(Inspection.status == status)
    if shop_id:
        query = query.filter(Inspection.shop_id == shop_id)
    if inspector_id:
        query = query.filter(Inspection.inspector_id == inspector_id)
    if priority:
        query = query.filter(Inspection.priority == priority)
        
    return query.all()

@router.post("", response_model=InspectionResponse)
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db)
):
    # Auto logic
    new_id = f"INS-{str(uuid.uuid4())[:8].upper()}"
    db_inspection = Inspection(
        id=new_id,
        shop_id=payload.shop_id,
        triggered_by=payload.triggered_by,
        trigger_reference=payload.trigger_reference,
        inspector_id=payload.inspector_id,
        priority=payload.priority,
        status="scheduled"
    )
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)
    return db_inspection

@router.patch("/{id}/start", response_model=InspectionResponse)
def start_inspection(
    id: str,
    db: Session = Depends(get_db)
):
    inspection = db.query(Inspection).filter(Inspection.id == id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
        
    if inspection.status != "scheduled":
        raise HTTPException(status_code=400, detail="Only scheduled inspections can be started")
        
    inspection.status = "in_progress"
    inspection.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inspection)
    return inspection

@router.patch("/{id}/complete", response_model=InspectionResponse)
def complete_inspection(
    id: str,
    payload: InspectionComplete,
    db: Session = Depends(get_db)
):
    inspection = db.query(Inspection).filter(Inspection.id == id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
        
    if inspection.status != "in_progress":
        raise HTTPException(status_code=400, detail="Only in_progress inspections can be completed")
        
    inspection.status = "completed"
    inspection.completed_at = datetime.now(timezone.utc)
    inspection.findings = payload.findings
    inspection.evidence_urls = payload.evidence_urls
    
    # Optional Blockchain Transaction logging mocking
    inspection.blockchain_txn_id = f"TXN-{str(uuid.uuid4())[:12].upper()}"
    
    db.commit()
    db.refresh(inspection)
    return inspection

@router.patch("/{id}/action", response_model=InspectionResponse)
def take_action(
    id: str,
    payload: InspectionAction,
    db: Session = Depends(get_db)
):
    inspection = db.query(Inspection).filter(Inspection.id == id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
        
    inspection.status = "action_taken"
    inspection.action_taken = payload.action_taken
    
    db.commit()
    db.refresh(inspection)
    return inspection

@router.get("/stats", response_model=InspectionStats)
def get_stats(
    db: Session = Depends(get_db)
):
    total = db.query(Inspection).count()
    active = db.query(Inspection).filter(Inspection.status.in_(["scheduled", "in_progress"])).count()
    completed = db.query(Inspection).filter(Inspection.status.in_(["completed", "action_taken"])).count()
    
    confirmed_fraud_count = db.query(Inspection).filter(
        Inspection.findings.ilike("%fraud%") | Inspection.action_taken.isnot(None)
    ).count()
    
    fraud_pct = (confirmed_fraud_count / completed * 100) if completed > 0 else 0
    
    return {
        "total": total,
        "active": active,
        "completed": completed,
        "confirmed_fraud_pct": round(fraud_pct, 1),
        "avg_resolution_time_hours": 24.5  # Mocked/derived logic (for MVP sake)
    }
