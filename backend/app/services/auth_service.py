from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import logging
from datetime import datetime, timedelta

from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.schemas.user_schema import UserLogin, Token
from app.core.security import verify_password, create_access_token, create_refresh_token
from typing import Tuple

# Setup logger
logger = logging.getLogger(__name__)

from sqlalchemy import or_

def authenticate_citizen(db: Session, ration_card: str, password: str) -> Tuple[Token, str]:
    beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == ration_card).first()

    if not beneficiary:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect ration card or password",
        )

    # Check lock out
    if beneficiary.lockout_until and beneficiary.lockout_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked due to too many failed attempts. Try again later."
        )

    # If lockout expired, reset
    if beneficiary.lockout_until and beneficiary.lockout_until <= datetime.utcnow():
        beneficiary.failed_attempts = 0
        beneficiary.lockout_until = None
        db.commit()

    if not beneficiary.password_hash or not verify_password(password, beneficiary.password_hash):
        beneficiary.failed_attempts += 1
        if beneficiary.failed_attempts >= 5:
            beneficiary.lockout_until = datetime.utcnow() + timedelta(minutes=30)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect ration card or password",
        )

    if not beneficiary.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive")

    # Success: reset attempts
    beneficiary.failed_attempts = 0
    beneficiary.lockout_until = None
    beneficiary.last_login = datetime.utcnow()
    db.commit()

    # Expires in 1 hour
    access_token = create_access_token(
        data={
            "sub": beneficiary.ration_card,
            "role": "citizen"
        },
        expires_delta=timedelta(hours=1)
    )

    refresh_token = create_refresh_token({"sub": beneficiary.ration_card, "role": "citizen"})

    logger.info(f"Citizen {beneficiary.ration_card} logged in")

    return Token(
        access_token=access_token,
        token_type="bearer",
        role="citizen",
        user_id=beneficiary.ration_card
    ), refresh_token


def authenticate_dealer(db: Session, login_data: UserLogin) -> Tuple[Token, str]:
    """
    Authenticates a dealer using mobile or shop_id, and password.
    """
    user = db.query(User).filter(
        or_(User.mobile == login_data.mobile, User.shop_id == login_data.mobile)
    ).first()
    
    if not user:
        # Prevent user enumeration, but for debug use specific message if needed. keeping generic for security.
        # Actually prompt says "Verify role == dealer", "Verify password".
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.role != UserRole.dealer:
        # Prompt: "Verify role == dealer"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: User is not a dealer"
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Explicit dealer status guard — None is intentionally NOT allowed
    if user.role == UserRole.dealer and user.dealer_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dealer account is suspended or expired. Contact admin."
        )

    # Update last login
    user.last_login = datetime.now()
    db.commit()

    # Generate Token
    # Payload: sub, role, district (from prompt)
    access_token = create_access_token(
        data={
            "sub": user.id,
            "role": user.role.value,
            "district": user.district
        }
    )
    
    # Log login
    logger.info(f"User {user.id} logged in as {user.role.value}")
    
    refresh_token = create_refresh_token({"sub": user.id, "role": user.role.value})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=user.id,
        district=user.district
    ), refresh_token


def authenticate_user(db: Session, login_data: UserLogin) -> Tuple[Token, str]:
    """Authenticates any user (admin, dealer, inspector) using mobile + password."""
    user = db.query(User).filter(User.mobile == login_data.mobile).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Explicit dealer status guard — None is intentionally NOT allowed
    if user.role == UserRole.dealer and user.dealer_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dealer account is suspended or expired. Contact admin."
        )

    user.last_login = datetime.now()
    db.commit()

    access_token = create_access_token(
        data={
            "sub": user.id,
            "role": user.role.value,
            "district": user.district,
        }
    )

    logger.info(f"User {user.id} logged in as {user.role.value}")

    refresh_token = create_refresh_token({"sub": user.id, "role": user.role.value})

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=user.id,
        district=user.district
    ), refresh_token
