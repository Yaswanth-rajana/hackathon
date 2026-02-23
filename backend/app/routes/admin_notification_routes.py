from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime

from app.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.user import User, UserRole
from app.models.notification import Notification

router = APIRouter(
    prefix="/api/admin/notifications",
    tags=["Admin Notifications"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

@router.get("", response_model=Dict[str, Any])
def get_notifications(
    unread_only: bool = False,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Notification).filter(Notification.district == current_user.district)
    
    if unread_only:
        query = query.filter(Notification.read == False)

    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": notifications,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.put("/{id}/read", response_model=Dict[str, Any])
def mark_notification_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(Notification.id == id, Notification.district == current_user.district).first()
    if not notification:
        raise HTTPException(404, "Notification not found")
        
    notification.read = True
    db.commit()
    db.refresh(notification)
    
    return {"id": notification.id, "read": notification.read, "message": "Notification marked as read"}
