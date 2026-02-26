from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.complaint import Complaint
from datetime import datetime, timezone
import uuid

def get_complaints(db: Session, status: str = None, shop_id: str = None, search: str = None, skip: int = 0, limit: int = 20):
    query = db.query(Complaint)
    
    if status:
        query = query.filter(Complaint.status == status)
    if shop_id:
        query = query.filter(Complaint.shop_id.ilike(f"%{shop_id}%"))
    if search:
        query = query.filter(
            (Complaint.citizen_name.ilike(f"%{search}%")) |
            (Complaint.ration_card.ilike(f"%{search}%")) |
            (Complaint.id.ilike(f"%{search}%"))
        )
        
    total = query.count()
    # Order by newest first
    complaints = query.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "data": complaints,
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "limit": limit
    }

def get_complaint(db: Session, complaint_id: str):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint

def assign_inspector(db: Session, complaint_id: str, inspector_id: str):
    complaint = get_complaint(db, complaint_id)
    complaint.inspector_id = inspector_id
    if complaint.status == "NEW":
        complaint.status = "ASSIGNED"
    db.commit()
    db.refresh(complaint)
    return complaint

def add_note(db: Session, complaint_id: str, note_text: str):
    complaint = get_complaint(db, complaint_id)
    new_note = {
        "id": f"note_{uuid.uuid4().hex[:8]}",
        "note": note_text,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # SQLAlchemy JSON mutation
    current_notes = list(complaint.notes) if complaint.notes else []
    current_notes.append(new_note)
    complaint.notes = current_notes
    
    if complaint.status in ["NEW", "ASSIGNED"]:
        complaint.status = "INVESTIGATING"
        
    db.commit()
    db.refresh(complaint)
    return complaint

def resolve_complaint(db: Session, complaint_id: str, resolution_notes: str):
    complaint = get_complaint(db, complaint_id)
    if complaint.status == "RESOLVED":
        raise HTTPException(status_code=400, detail="Complaint is already resolved")
        
    complaint.status = "RESOLVED"
    complaint.resolution_notes = resolution_notes
    db.commit()
    db.refresh(complaint)
    return complaint
