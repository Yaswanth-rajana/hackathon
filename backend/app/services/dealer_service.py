import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.beneficiary import Beneficiary
from app.models.user import User
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)


def _enforce_ownership(beneficiary: Beneficiary, current_user: User) -> None:
    """Enforce shop-level ownership. Dealer can only access their own shop's beneficiaries."""
    if not current_user.shop_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dealer has no shop assigned"
        )
    if beneficiary.shop_id != current_user.shop_id:
        logger.warning(
            f"Dealer {current_user.id} attempted cross-shop access to beneficiary "
            f"{beneficiary.ration_card} (dealer_shop={current_user.shop_id}, "
            f"beneficiary_shop={beneficiary.shop_id})"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: beneficiary does not belong to your shop"
        )


def _get_beneficiary_or_404(db: Session, ration_card: str) -> Beneficiary:
    """Fetch beneficiary or raise 404."""
    beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == ration_card).first()
    if not beneficiary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beneficiary with ration card '{ration_card}' not found"
        )
    return beneficiary


def lookup_beneficiary(db: Session, ration_card: str, current_user: User) -> Beneficiary:
    """Lookup beneficiary with ownership enforcement."""
    beneficiary = _get_beneficiary_or_404(db, ration_card)
    _enforce_ownership(beneficiary, current_user)
    return beneficiary


def link_mobile(db: Session, ration_card: str, mobile: str, current_user: User) -> None:
    """Link mobile number to beneficiary and mark as verified."""
    beneficiary = _get_beneficiary_or_404(db, ration_card)
    _enforce_ownership(beneficiary, current_user)

    beneficiary.mobile = mobile
    beneficiary.mobile_verified = True
    db.commit()

    logger.info(f"Dealer {current_user.id} linked mobile for beneficiary {ration_card}")


def set_pin(db: Session, ration_card: str, pin: str, current_user: User) -> None:
    """Hash PIN and activate beneficiary account. Requires mobile_verified = True."""
    beneficiary = _get_beneficiary_or_404(db, ration_card)
    _enforce_ownership(beneficiary, current_user)

    # Gate: mobile must be verified before activation
    if not beneficiary.mobile_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile must be verified before setting PIN. Link mobile first."
        )

    beneficiary.pin_hash = get_password_hash(pin)
    beneficiary.account_status = "active"
    db.commit()

    logger.info(f"Dealer {current_user.id} activated account for beneficiary {ration_card}")
