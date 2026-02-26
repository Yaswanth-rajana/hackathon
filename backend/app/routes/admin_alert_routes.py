import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.user import User, UserRole
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.schemas.alert_schema import (
    AlertListResponse, AlertResponse, AlertStatsResponse, AlertUpdate
)

router = APIRouter(
    prefix="/api/admin/alerts",
    tags=["Admin Alerts"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

@router.get("", response_model=AlertListResponse)
def get_alerts(
    district: Optional[str] = None,
    severity: Optional[AlertSeverity] = None,
    status: Optional[AlertStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # District Isolation: Non-admin roles (if we expand) would be locked.
    # For now, default to user's district if not specified and not a tech/state admin
    query_district = district or current_user.district
    
    query = db.query(Alert)
    
    if query_district and query_district != "Andhra Pradesh (HQ)":
        query = query.filter(Alert.district == query_district)
    
    if severity:
        query = query.filter(Alert.severity == severity)
    
    if status:
        query = query.filter(Alert.status == status)

    total = query.count()
    items = query.order_by(Alert.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/stats", response_model=AlertStatsResponse)
def get_alert_stats(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_district = district or current_user.district
    query = db.query(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
    
    if query_district and query_district != "Andhra Pradesh (HQ)":
        query = query.filter(Alert.district == query_district)
    
    results = dict(query.all())
    
    return {
        "critical": results.get(AlertSeverity.CRITICAL, 0),
        "high": results.get(AlertSeverity.HIGH, 0),
        "medium": results.get(AlertSeverity.MEDIUM, 0),
        "info": results.get(AlertSeverity.INFO, 0)
    }

@router.get("/{id}", response_model=AlertResponse)
def get_alert_detail(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
        
    # Enforce district isolation
    if current_user.district != "Andhra Pradesh (HQ)" and alert.district != current_user.district:
        raise HTTPException(403, "Access denied to this district's alerts")
        
    return alert

@router.patch("/{id}/status", response_model=AlertResponse)
def update_alert_status(
    id: str,
    update_data: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
        
    # Enforce district isolation
    if current_user.district != "Andhra Pradesh (HQ)" and alert.district != current_user.district:
        raise HTTPException(403, "Action denied for this district's alerts")

    old_status = alert.status
    new_status = update_data.status

    # Governance Lifecycle Rules
    allowed_transitions = {
        AlertStatus.OPEN: [AlertStatus.ACKNOWLEDGED],
        AlertStatus.ACKNOWLEDGED: [AlertStatus.INVESTIGATING],
        AlertStatus.INVESTIGATING: [AlertStatus.RESOLVED, AlertStatus.ESCALATED],
        AlertStatus.ESCALATED: [AlertStatus.INVESTIGATING],
        AlertStatus.RESOLVED: [] # Terminal state for this demo
    }

    if new_status != old_status and new_status not in allowed_transitions.get(old_status, []):
        raise HTTPException(
            400, 
            f"Invalid transition from {old_status} to {new_status}. " 
            "Governance workflow: OPEN -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED/ESCALATED"
        )

    alert.status = new_status
    if new_status == AlertStatus.ACKNOWLEDGED:
        alert.acknowledged_by = update_data.acknowledged_by or current_user.name
    
    if new_status == AlertStatus.RESOLVED:
        alert.resolved_at = datetime.now(timezone.utc)

    alert.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    
    return alert
