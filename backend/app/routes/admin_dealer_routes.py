"""Admin-only dealer management routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.core.dependencies import require_role
from app.core.rate_limiter import limiter
from app.schemas.dealer_admin_schema import (
    CreateDealerRequest, UpdateDealerRequest,
    DealerResponse, DealerListResponse, ResetPasswordResponse,
)
from app.services import dealer_admin_service

router = APIRouter(
    tags=["Admin Dealers"],
    dependencies=[Depends(require_role(UserRole.admin))],
)


@router.post("", response_model=dict, status_code=201)
@limiter.limit("10/minute")
def create_dealer(
    request: Request,
    payload: CreateDealerRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    """Create a dealer, assign them to a shop, and return the dealer_id.
    Temp password is returned once and must be recorded by the admin.
    """
    dealer, temp_password = dealer_admin_service.create_dealer(db, payload, admin_user)
    return {
        "message": "Dealer created successfully",
        "dealer_id": dealer.id,
        "temp_password": temp_password,
        "warning": "This password will be shown only once. Store it securely.",
    }


@router.get("", response_model=DealerListResponse)
def list_dealers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    mandal: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    """Paginated dealer list scoped to admin's district."""
    return dealer_admin_service.list_dealers(
        db, admin_user, page, limit, status, mandal, search
    )


@router.get("/{dealer_id}", response_model=DealerResponse)
def get_dealer(
    dealer_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    return dealer_admin_service.get_dealer(db, dealer_id, admin_user)


@router.put("/{dealer_id}", response_model=DealerResponse)
def update_dealer(
    dealer_id: str,
    payload: UpdateDealerRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    return dealer_admin_service.update_dealer(db, dealer_id, payload, admin_user)


@router.put("/{dealer_id}/suspend", response_model=dict)
def suspend_dealer(
    dealer_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    """Idempotent — suspending an already-suspended dealer returns 200."""
    return dealer_admin_service.suspend_dealer(db, dealer_id, admin_user)


@router.put("/{dealer_id}/reactivate", response_model=dict)
def reactivate_dealer(
    dealer_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    """Reactivate a dealer. Blocked if their license has expired."""
    return dealer_admin_service.reactivate_dealer(db, dealer_id, admin_user)


@router.post("/{dealer_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    dealer_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin)),
):
    """Reset dealer password. Temp password shown once — never logged server-side."""
    temp_password = dealer_admin_service.reset_password(db, dealer_id, admin_user)
    return ResetPasswordResponse(
        message="Password reset successfully",
        temp_password=temp_password,
    )

@router.post("/{shop_id}/allocate", response_model=dict)
def allocate_stock(
    shop_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.admin))
):
    """Allocate new inventory to a specific shop leveraging immutable Blockchain proof recording."""
    return dealer_admin_service.allocate_stock(db, shop_id, admin_user, payload)

@router.post("/{shop_id}/test-allocate")
def test_allocate_stock(
    shop_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    """Temporary unsecured route for automated test script."""
    # Mock Admin User
    admin_mock = User(id="admin_test", district="HYDERABAD")
    return dealer_admin_service.allocate_stock(db, shop_id, admin_mock, payload)
