from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import asyncio
import uuid

from app.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.user import User, UserRole
from app.models.complaint import Complaint
from app.models.shop import Shop
from app.schemas.complaint_schema import ComplaintResponse, AssignInspectorRequest, ResolveComplaintRequest
from app.utils.audit_logger import audit_logger
from app.services.event_emitter import manager
from app.services.analytics_aggregator import AnalyticsAggregator
from pydantic import BaseModel

class EscalateComplaintRequest(BaseModel):
    reason: str
    override: bool = False

router = APIRouter(
    prefix="/api/admin/complaints",
    tags=["Admin Operational Complaints"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

@router.get("")
def list_complaints(
    request: Request,
    status: Optional[str] = None, 
    shop_id: Optional[str] = None, 
    district: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1, 
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Complaint)

    # District Security & Filtering
    # If user has a specific district (and it's not HQ), enforce it.
    # Otherwise, allow the 'district' query parameter if provided.
    if current_user.district and current_user.district != "HQ":
        query = query.filter(Complaint.district == current_user.district)
    elif district:
        query = query.filter(Complaint.district == district)

    if status:
        query = query.filter(Complaint.status == status)
    if shop_id:
        query = query.filter(Complaint.shop_id == shop_id)
    if from_date:
        query = query.filter(Complaint.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        # Include the entire day for the end date
        end_date = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59, microsecond=999999)
        query = query.filter(Complaint.created_at <= end_date)

    total = query.count()
    complaints = query.order_by(Complaint.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": complaints, # For standardizing on "items", or "data"
        "total": total,
        "page": page,
        "limit": limit
    }

def _emit(district, event_type, complaint_id, background_tasks: BackgroundTasks):
    background_tasks.add_task(manager.emit_event, district, event_type, complaint_id, "complaint")

@router.put("/{id}/assign")
@audit_logger(action="ASSIGN_COMPLAINT", target_type="complaint")
def assign_complaint(
    id: str, 
    request_data: AssignInspectorRequest, 
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Complaint).filter(Complaint.id == id)
    if current_user.district and current_user.district != "HQ":
        query = query.filter(Complaint.district == current_user.district)
    
    complaint = query.first()
    if not complaint:
        raise HTTPException(404, "Complaint not found or unauthorized")
        
    if complaint.status == "resolved":
        raise HTTPException(400, "Cannot assign already resolved complaint")
        
    if complaint.status == "escalated":
        raise HTTPException(400, "Cannot assign an escalated complaint. Must be resolved via override.")
    
    complaint.status = "in_progress"
    complaint.inspector_id = request_data.inspector_id
    
    notes_list = list(complaint.notes) if complaint.notes else []
    notes_list.append({
        "id": str(uuid.uuid4()),
        "note": f"Assigned to {request_data.inspector_id}",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z"
    })
    complaint.notes = notes_list

    db.commit()
    db.refresh(complaint)
    
    _emit(complaint.district, "COMPLAINT_UPDATED", complaint.id, background_tasks)
    return complaint

@router.put("/{id}/resolve")
@audit_logger(action="RESOLVE_COMPLAINT", target_type="complaint")
def resolve_complaint(
    id: str, 
    request_data: ResolveComplaintRequest, 
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Complaint).filter(Complaint.id == id)
    if current_user.district and current_user.district != "HQ":
        query = query.filter(Complaint.district == current_user.district)
    
    complaint = query.first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")
        
    if complaint.status == "resolved":
        raise HTTPException(400, "Already resolved")
        
    if complaint.status == "escalated":
        raise HTTPException(400, "Cannot resolve escalated complaint without override")

    complaint.status = "resolved"
    complaint.resolution_notes = request_data.resolution_notes
    db.commit()
    db.refresh(complaint)
    
    AnalyticsAggregator.record_complaint_resolution(db, complaint.district)
    
    _emit(complaint.district, "COMPLAINT_UPDATED", complaint.id, background_tasks)
    return complaint

@router.put("/{id}/escalate")
@audit_logger(action="ESCALATE_COMPLAINT", target_type="complaint")
def escalate_complaint(
    id: str, 
    request_data: EscalateComplaintRequest, 
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Complaint).filter(Complaint.id == id)
    if current_user.district and current_user.district != "HQ":
        query = query.filter(Complaint.district == current_user.district)
    
    complaint = query.first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")
        
    if complaint.status == "resolved":
        raise HTTPException(400, "Cannot escalate resolved complaint")

    complaint.status = "escalated"
    notes_list = list(complaint.notes) if complaint.notes else []
    notes_list.append({
        "id": str(uuid.uuid4()),
        "note": f"Escalated: {request_data.reason}",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z"
    })
    complaint.notes = notes_list
    
    db.commit()
    db.refresh(complaint)
    
    _emit(complaint.district, "COMPLAINT_UPDATED", complaint.id, background_tasks)
    return complaint
