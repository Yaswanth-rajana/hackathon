from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.user import User, UserRole
from app.services.recommendation_service import recommendation_service

router = APIRouter(
    prefix="/api/admin/recommendations",
    tags=["Admin Recommendations"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

@router.get("", response_model=List[Dict[str, Any]])
def get_recommendations(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns AI-powered audit recommendations based on risk score, complaints, etc.
    """
    return recommendation_service.get_audit_recommendations(db, current_user.district, limit=limit)
