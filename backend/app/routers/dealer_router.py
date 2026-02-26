from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.database import get_db
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.core.dependencies import require_role
from app.core.rate_limiter import limiter
from fastapi import Request

from app.schemas.dealer_schema import (
    BeneficiaryResponse,
    LinkMobileRequest,
    SetPinRequest,
    MessageResponse,
    DashboardResponse,
    EntitlementResponse,
    ReceivedResponse,
    DistributeRequest,
    DistributeResponse,
    StockResponse,
    ComplaintResponse,
    ResolveComplaintRequest,
    PerformanceResponse,
    AuditTraceResponse
)

from app.services.dealer_service import lookup_beneficiary, link_mobile, set_pin
from app.services.dealer_dashboard_service import get_dashboard
from app.services.dealer_entitlement_service import get_current_entitlement, get_already_received, get_beneficiary_history
from app.services.dealer_distribution_service import distribute_ration
from app.services.dealer_analytics_service import get_weekly_performance

router = APIRouter(
    prefix="/api/dealer",
    tags=["Dealer"],
    dependencies=[Depends(require_role(UserRole.dealer))],
)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dealer_dashboard(
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Get dealer dashboard summary."""
    return get_dashboard(db, current_user)


@router.get("/beneficiary/{ration_card}", response_model=BeneficiaryResponse)
def get_beneficiary(
    ration_card: str,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db),
):
    """Lookup beneficiary by ration card. Enforces shop ownership."""
    return lookup_beneficiary(db, ration_card, current_user)


@router.patch("/beneficiary/{ration_card}/link-mobile", response_model=MessageResponse)
def patch_link_mobile(
    ration_card: str,
    payload: LinkMobileRequest,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db),
):
    """Link mobile number to a beneficiary and mark as verified."""
    link_mobile(db, ration_card, payload.mobile, current_user)
    return MessageResponse(message="Mobile linked successfully", ration_card=ration_card)


@router.post("/set-pin", response_model=MessageResponse)
def post_set_pin(
    payload: SetPinRequest,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db),
):
    """Set PIN and activate beneficiary account."""
    set_pin(db, payload.ration_card, payload.pin, current_user)
    return MessageResponse(message="PIN set and account activated", ration_card=payload.ration_card)


@router.get("/entitlement/{ration_card}", response_model=EntitlementResponse)
def get_entitlement(
    ration_card: str,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Get beneficiary's entitlement for the current month."""
    entitlement = get_current_entitlement(db, ration_card)
    return {
        "wheat": entitlement.wheat,
        "rice": entitlement.rice,
        "sugar": entitlement.sugar
    }


@router.get("/received/{ration_card}", response_model=ReceivedResponse)
def get_received(
    ration_card: str,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Get already received ration for beneficiary for the current month."""
    received = get_already_received(db, ration_card)
    return received


@router.post("/distribute", response_model=DistributeResponse)
@limiter.limit("10/minute")
def post_distribute(
    request: Request,
    payload: DistributeRequest,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Distribute ration securely via local stock deduction and blockchain integration."""
    idempotency_key = request.headers.get("Idempotency-Key")
    client_ip = request.client.host if request.client else "0.0.0.0"
    return distribute_ration(db, current_user, payload.model_dump(), idempotency_key, client_ip)


@router.get("/stock", response_model=StockResponse)
def get_stock(
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Fetch shop's current available stock."""
    shop = db.query(Shop).filter(Shop.id == current_user.shop_id).first()
    if not shop:
        return {
            "wheat": 0.0,
            "rice": 0.0,
            "sugar": 0.0,
            "kerosene": 0.0
        }
        
    return {
        "wheat": shop.stock_wheat,
        "rice": shop.stock_rice,
        "sugar": shop.stock_sugar,
        "kerosene": shop.stock_kerosene
    }


@router.get("/complaints", response_model=List[ComplaintResponse])
def get_complaints(
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Get all complaints against dealer's shop."""
    complaints = db.query(Complaint).filter(Complaint.shop_id == current_user.shop_id).order_by(Complaint.created_at.desc()).all()
    return complaints


@router.patch("/complaints/{id}/resolve", response_model=MessageResponse)
def resolve_complaint(
    id: str,
    payload: ResolveComplaintRequest,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Resolve a complaint against dealer's shop."""
    complaint = db.query(Complaint).filter(
        Complaint.id == id,
        Complaint.shop_id == current_user.shop_id
    ).first()
    
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    complaint.status = "RESOLVED"
    complaint.resolution_notes = payload.resolution_notes
    complaint.resolved_at = datetime.utcnow()
    db.commit()
    
    return MessageResponse(message="Complaint resolved successfully")


@router.get("/performance", response_model=PerformanceResponse)
def get_performance(
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Get dealer's weekly performance and mandal average comparison."""
    return get_weekly_performance(db, current_user)


@router.get("/history/{ration_card}", response_model=AuditTraceResponse)
def get_history(
    ration_card: str,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db)
):
    """Fetch beneficiary's transaction history."""
    # Enforce shop ownership check (security)
    from app.services.dealer_service import lookup_beneficiary
    lookup_beneficiary(db, ration_card, current_user)
    
    history = get_beneficiary_history(db, ration_card)
    return {"history": history}
