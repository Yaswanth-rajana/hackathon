from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import UserRole
from app.core.dependencies import require_role
from app.schemas.admin_schema import DashboardSummaryResponse, RiskDistributionResponse, AnomalyResponse
from app.schemas.complaint_schema import ComplaintResponse, AssignInspectorRequest, AddNoteRequest, ResolveComplaintRequest
from app.services import admin_service, complaint_service
from typing import List, Optional

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role(UserRole.admin))],  # 🔐 All routes admin-only
)


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(db: Session = Depends(get_db)):
    """System-wide health overview: shop, transaction, beneficiary,
    anomaly counts and high-risk shop total."""
    return admin_service.get_dashboard_summary(db)


@router.get("/risk-distribution", response_model=RiskDistributionResponse)
def risk_distribution(db: Session = Depends(get_db)):
    """Risk classification breakdown across all dealer shops."""
    return admin_service.get_risk_distribution(db)


@router.get("/anomalies/live", response_model=List[AnomalyResponse])
def live_anomalies(db: Session = Depends(get_db)):
    """Recent unresolved anomalies for the admin dashboard.

    Ordered by severity (high first) then newest first. Limited to 20.
    """
    return admin_service.get_recent_anomalies(db)

# Old complaints endpoints removed in favor of app/routes/admin_complaint_routes.py
