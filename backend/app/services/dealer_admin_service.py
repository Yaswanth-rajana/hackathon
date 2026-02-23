"""Modular dealer management service for admin operations."""
from __future__ import annotations

import secrets
import string
import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.activity_log import ActivityLog
from app.models.notification import Notification
from app.schemas.dealer_admin_schema import (
    CreateDealerRequest, UpdateDealerRequest, DealerResponse, DealerListResponse
)

logger = logging.getLogger(__name__)


# ─── Temp password generator ───────────────────────────────────────────────────

def _generate_temp_password(length: int = 12) -> str:
    """Generate a random alphanumeric temp password."""
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ─── Internal validators ───────────────────────────────────────────────────────

def _validate_shop_assignment(db: Session, shop_id: str, admin_district: str, mandal: str) -> Shop:
    """Verify shop exists, belongs to admin's district, and has no existing dealer.
    For hackathon purposes, auto-creates the shop if it's missing."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        shop = Shop(
            id=shop_id,
            name=f"FP Shop {shop_id}",
            district=admin_district,
            mandal=mandal,
            stock_wheat=500,
            stock_rice=1500,
            stock_sugar=200,
            stock_kerosene=100
        )
        db.add(shop)
        db.flush()

    if shop.district and admin_district and shop.district != admin_district:
        raise HTTPException(
            status_code=403,
            detail="Shop does not belong to your district"
        )

    if shop.dealer_id:
        raise HTTPException(
            status_code=400,
            detail=f"Shop '{shop_id}' already has an assigned dealer"
        )
    return shop


def _validate_unique_dealer(db: Session, email: str, mobile: str) -> None:
    """Ensure email and mobile are not already registered."""
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail=f"Email '{email}' is already registered")
    if db.query(User).filter(User.mobile == mobile).first():
        raise HTTPException(status_code=400, detail=f"Mobile '{mobile}' is already registered")


def _check_license_on_create(license_date) -> None:
    """Reject dealer creation if the license is already expired."""
    # Convert date to timezone-aware datetime for comparison
    if hasattr(license_date, 'year'):  # it's a date object
        license_dt = datetime(license_date.year, license_date.month, license_date.day,
                              tzinfo=timezone.utc)
    else:
        license_dt = license_date.replace(tzinfo=timezone.utc) if license_date.tzinfo is None else license_date

    if license_dt < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=422,
            detail="License valid-until date is already expired. Provide a future date."
        )


def _build_dealer_response(user: User, shop_name: Optional[str]) -> DealerResponse:
    """Build a DealerResponse with server-side expiry calculations."""
    now = datetime.now(timezone.utc)
    days_to_expiry: Optional[int] = None
    is_expiring_soon = False
    expiry_urgency = "normal"

    if user.license_valid_until:
        lic = user.license_valid_until
        if lic.tzinfo is None:
            lic = lic.replace(tzinfo=timezone.utc)
        delta = (lic - now).days
        days_to_expiry = delta
        if delta <= 30:
            is_expiring_soon = True
            expiry_urgency = "critical" if delta < 7 else "warning"

    return DealerResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        mobile=user.mobile,
        district=user.district,
        mandal=user.shop_id,       # mandal comes from shop — using fallback
        shop_id=user.shop_id,
        shop_name=shop_name,
        dealer_status=user.dealer_status,
        license_valid_until=user.license_valid_until,
        days_to_expiry=days_to_expiry,
        is_expiring_soon=is_expiring_soon,
        expiry_urgency=expiry_urgency,
        last_login=user.last_login,
        must_change_password=bool(user.must_change_password),
        created_at=user.created_at,
    )


def _log_action(
    db: Session,
    admin_id: str,
    action: str,
    target_id: str,
    district: Optional[str],
    ip_address: Optional[str] = None,
    extra: Optional[dict] = None,
) -> None:
    """Write a structured activity log entry."""
    log = ActivityLog(
        admin_id=admin_id,
        action=action,           # e.g. dealer.created, dealer.suspended
        target_type="dealer",
        target_id=target_id,
        district=district,
        metadata_info=extra or {},
        ip_address=ip_address,
    )
    db.add(log)


def _create_notification(
    db: Session,
    district: Optional[str],
    message: str,
    notif_type: str = "SYSTEM",
    severity: str = "info",
) -> None:
    notif = Notification(
        district=district,
        type=notif_type,
        message=message,
        severity=severity,
    )
    db.add(notif)


# ─── Public service functions ──────────────────────────────────────────────────

def create_dealer(
    db: Session,
    payload: CreateDealerRequest,
    admin_user: User,
) -> Tuple[User, str]:
    """
    Create a dealer account and assign them to a shop.
    Returns (User, temp_password) — caller is responsible for not logging temp_password.
    """
    _check_license_on_create(payload.license_valid_until)
    _validate_unique_dealer(db, payload.email, payload.mobile)
    shop = _validate_shop_assignment(db, payload.shop_id, admin_user.district or "", payload.mandal)

    temp_password = _generate_temp_password()
    hashed = get_password_hash(temp_password)

    # Build unique dealer ID
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    dealer_id = f"DLR_{ts}_{secrets.token_hex(3).upper()}"

    # Convert license date → timezone-aware datetime
    ld = payload.license_valid_until
    license_dt = datetime(ld.year, ld.month, ld.day, tzinfo=timezone.utc)

    dealer = User(
        id=dealer_id,
        name=payload.name,
        email=payload.email,
        mobile=payload.mobile,
        role=UserRole.dealer,
        district=admin_user.district,
        shop_id=payload.shop_id,
        password_hash=hashed,
        is_active=True,
        dealer_status="active",
        license_valid_until=license_dt,
        created_by_admin_id=admin_user.id,
        must_change_password=True,       # Force change on first login
    )
    db.add(dealer)
    db.flush()  # Get ID before commit

    # Assign dealer to shop
    shop.dealer_id = dealer_id

    _log_action(db, admin_user.id, "dealer.created", dealer_id, admin_user.district,
                extra={"shop_id": payload.shop_id, "mandal": payload.mandal})
    _create_notification(
        db, admin_user.district,
        f"New dealer '{payload.name}' created and assigned to shop {payload.shop_id}.",
        "SYSTEM", "info",
    )

    db.commit()
    db.refresh(dealer)
    logger.info("Dealer created", extra={"dealer_id": dealer_id, "admin_id": admin_user.id})
    return dealer, temp_password  # temp_password returned to caller ONLY


def list_dealers(
    db: Session,
    admin_user: User,
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    mandal_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> DealerListResponse:
    """Paginated list of dealers with shop name join."""
    query = (
        db.query(User, Shop.name.label("shop_name"), Shop.mandal.label("shop_mandal"))
        .outerjoin(Shop, Shop.id == User.shop_id)
        .filter(User.role == UserRole.dealer)
    )

    # District scope
    if admin_user.district:
        query = query.filter(User.district == admin_user.district)

    if status_filter:
        query = query.filter(User.dealer_status == status_filter)

    if mandal_filter:
        query = query.filter(Shop.mandal.ilike(f"%{mandal_filter}%"))

    if search:
        like = f"%{search}%"
        query = query.filter(
            (User.name.ilike(like)) |
            (User.mobile.ilike(like)) |
            (User.email.ilike(like))
        )

    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()

    dealers = []
    for user, shop_name, shop_mandal in rows:
        # Override mandal from shop join
        dr = _build_dealer_response(user, shop_name)
        dr.mandal = shop_mandal
        dealers.append(dr)

    return DealerListResponse(total=total, page=page, limit=limit, dealers=dealers)


def get_dealer(db: Session, dealer_id: str, admin_user: User) -> DealerResponse:
    row = (
        db.query(User, Shop.name.label("shop_name"))
        .outerjoin(Shop, Shop.id == User.shop_id)
        .filter(User.id == dealer_id, User.role == UserRole.dealer)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Dealer not found")
    user, shop_name = row
    if admin_user.district and user.district != admin_user.district:
        raise HTTPException(status_code=403, detail="Dealer not in your district")
    return _build_dealer_response(user, shop_name)


def update_dealer(
    db: Session,
    dealer_id: str,
    payload: UpdateDealerRequest,
    admin_user: User,
) -> DealerResponse:
    user = _get_dealer_or_404(db, dealer_id, admin_user)

    if payload.mobile and payload.mobile != user.mobile:
        if db.query(User).filter(User.mobile == payload.mobile, User.id != dealer_id).first():
            raise HTTPException(status_code=400, detail="Mobile already in use")
        user.mobile = payload.mobile

    if payload.license_valid_until:
        ld = payload.license_valid_until
        user.license_valid_until = datetime(ld.year, ld.month, ld.day, tzinfo=timezone.utc)
        # If admin extends license, restore active status from expired
        if user.dealer_status == "expired":
            user.dealer_status = "active"

    if payload.dealer_status:
        user.dealer_status = payload.dealer_status

    _log_action(db, admin_user.id, "dealer.updated", dealer_id, admin_user.district)
    db.commit()
    db.refresh(user)
    shop_name = db.query(Shop.name).filter(Shop.id == user.shop_id).scalar()
    return _build_dealer_response(user, shop_name)


def suspend_dealer(db: Session, dealer_id: str, admin_user: User) -> dict:
    user = _get_dealer_or_404(db, dealer_id, admin_user)

    if user.dealer_status == "suspended":
        return {"message": "Dealer is already suspended (idempotent)", "dealer_id": dealer_id}

    user.dealer_status = "suspended"
    _log_action(db, admin_user.id, "dealer.suspended", dealer_id, admin_user.district)
    _create_notification(
        db, admin_user.district,
        f"Dealer '{user.name}' (ID: {dealer_id}) has been suspended by admin.",
        "SYSTEM", "warning",
    )
    db.commit()
    return {"message": "Dealer suspended successfully", "dealer_id": dealer_id}


def reactivate_dealer(db: Session, dealer_id: str, admin_user: User) -> dict:
    user = _get_dealer_or_404(db, dealer_id, admin_user)

    # Block reactivation if license is expired and not updated
    if user.license_valid_until:
        lic = user.license_valid_until
        if lic.tzinfo is None:
            lic = lic.replace(tzinfo=timezone.utc)
        if lic < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=422,
                detail="Cannot reactivate: dealer's license has expired. Extend license_valid_until first."
            )

    user.dealer_status = "active"
    _log_action(db, admin_user.id, "dealer.reactivated", dealer_id, admin_user.district)
    _create_notification(
        db, admin_user.district,
        f"Dealer '{user.name}' (ID: {dealer_id}) has been reactivated.",
        "SYSTEM", "info",
    )
    db.commit()
    return {"message": "Dealer reactivated successfully", "dealer_id": dealer_id}


def reset_password(db: Session, dealer_id: str, admin_user: User) -> str:
    """
    Reset a dealer's password.
    Returns temp_password — NEVER store this in logs or notifications.
    """
    user = _get_dealer_or_404(db, dealer_id, admin_user)

    temp_password = _generate_temp_password()
    user.password_hash = get_password_hash(temp_password)
    user.must_change_password = True
    user.last_password_reset = datetime.now(timezone.utc)

    # Log the action — but NEVER log the password itself
    _log_action(
        db, admin_user.id, "dealer.password_reset", dealer_id, admin_user.district,
        extra={"note": "Password reset by admin. Temp password not stored."}
    )
    # No notification created to avoid info leakage about the reset
    db.commit()
    logger.info("Password reset for dealer", extra={"dealer_id": dealer_id, "by_admin": admin_user.id})
    return temp_password


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_dealer_or_404(db: Session, dealer_id: str, admin_user: User) -> User:
    user = db.query(User).filter(User.id == dealer_id, User.role == UserRole.dealer).first()
    if not user:
        raise HTTPException(status_code=404, detail="Dealer not found")
    if admin_user.district and user.district != admin_user.district:
        raise HTTPException(status_code=403, detail="Dealer not in your district")
# ─── New Phase 2 Helpers ────────────────────────────────────────────────────────

def allocate_stock(db: Session, shop_id: str, admin_user: User, payload: dict) -> dict:
    """Admin manually overriding inventory enforcing Blockchain ALLOCATION trace."""
    
    # 1. Fetch target shop.
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
        
    wheat_alloc = payload.get("stock_wheat", 0)
    rice_alloc = payload.get("stock_rice", 0)
    sugar_alloc = payload.get("stock_sugar", 0)
    kerosene_alloc = payload.get("stock_kerosene", 0)
    
    # Allocation ID string identifier for trace logs
    import uuid
    allocation_id = f"ALLOC_{uuid.uuid4().hex[:10].upper()}"

    # Generate blockchain ALLOCATION block with atomicity wrappers
    blockchain_payload = {
        "type": "ALLOCATION",
        "allocation_id": allocation_id,
        "shop_id": shop.id,
        "admin_id": admin_user.id,
        "items": {
            "wheat": wheat_alloc,
            "rice": rice_alloc,
            "sugar": sugar_alloc,
            "kerosene": kerosene_alloc
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    from app.services.blockchain.crypto import sign_transaction
    sign_transaction(blockchain_payload, "ADMIN")
    
    from app.services.blockchain.blockchain import blockchain
    # Step 1: Simulate the mine for hash logic safety locking.
    blockchain.add_transaction(blockchain_payload)
    block = blockchain.mine_pending_transactions(simulate=True)
    
    if db.in_transaction():
        db.commit()
        
    try:
        with db.begin():
            # Step 2: Inject updates to DB Inventory.
            shop.stock_wheat += wheat_alloc
            shop.stock_rice += rice_alloc
            shop.stock_sugar += sugar_alloc
            shop.stock_kerosene += kerosene_alloc
            
            # Step 3: Record Audit Entry logging trace hash logic if required.
            _log_action(db, admin_user.id, "shop.allocated", shop.id, admin_user.district, extra={
                "allocation_id": allocation_id,
                "block_hash": block.hash,
                "added": {
                    "wheat": wheat_alloc,
                    "rice": rice_alloc,
                    "sugar": sugar_alloc,
                    "kerosene": kerosene_alloc
                }
            })
            
    except Exception as e:
        # Step 4: Discard blockchain buffered state and rollback
        blockchain.discard_pending()
        raise e
        
    # Step 5: Persist successful buffer natively to chain json
    blockchain.commit_block(block)
    
    return {
        "message": "Stock manually allocated with Blockchain proof",
        "allocation_id": allocation_id,
        "block_index": block.index,
        "block_hash": block.hash
    }
