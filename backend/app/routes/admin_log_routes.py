from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime

from app.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.user import User, UserRole
from app.models.activity_log import ActivityLog

router = APIRouter(
    prefix="/api/admin/logs",
    tags=["Admin Activity Logs"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

@router.get("", response_model=Dict[str, Any])
def get_activity_logs(
    admin_id: Optional[str] = None,
    action_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only show logs for current admin's district (if district-scoped)
    # The user says "Accountability is critical... Filter: admin, date, action type"
    query = db.query(ActivityLog).filter(ActivityLog.district == current_user.district)
    
    # Actually, a superadmin could see all, but here we scope to district.
    # We could restrict logs to the current user OR allow seeing other admins in the same district.
    if admin_id:
        query = query.filter(ActivityLog.admin_id == admin_id)
    if action_type:
        query = query.filter(ActivityLog.action == action_type)
    if from_date:
        query = query.filter(ActivityLog.timestamp >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.filter(ActivityLog.timestamp <= datetime.fromisoformat(to_date))

    total = query.count()
    logs = query.order_by(ActivityLog.timestamp.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": logs,
        "total": total,
        "page": page,
        "limit": limit
    }
