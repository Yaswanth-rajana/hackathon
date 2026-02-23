from fastapi import APIRouter, Depends, Request, Response, Cookie, HTTPException
from sqlalchemy.orm import Session
import redis as sync_redis
import os
from app.database import get_db
from app.schemas.user_schema import UserLogin, Token, UserResponse
from app.schemas.citizen_schema import CitizenLoginRequest
from app.services.auth_service import authenticate_dealer, authenticate_user, authenticate_citizen
from app.core.dependencies import get_current_user, require_role, require_any_role
from app.models.user import User, UserRole
from app.core.rate_limiter import limiter
from app.core.security import decode_token, create_access_token, create_refresh_token

router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"]
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis_client = None

def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = sync_redis.Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client

def blacklist_token(token: str, exp: int):
    """Store token in blacklist until its natural expiry."""
    import time
    ttl = max(int(exp - time.time()), 1)
    get_redis().setex(f"revoked:{token[:32]}", ttl, "1")

def is_token_blacklisted(token: str) -> bool:
    return get_redis().exists(f"revoked:{token[:32]}") == 1


@router.post("/dealer-login", response_model=Token)
@limiter.limit("5/minute")
def dealer_login(request: Request, response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    token, refresh_token = authenticate_dealer(db, login_data)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    return token

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    """General login — works for admin, dealer, inspector."""
    token, refresh_token = authenticate_user(db, login_data)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    return token

@router.post("/citizen-login", response_model=Token)
@limiter.limit("5/minute")
def citizen_login(request: Request, response: Response, login_data: CitizenLoginRequest, db: Session = Depends(get_db)):
    token, refresh_token = authenticate_citizen(db, login_data.ration_card, login_data.password)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    return token

@router.post("/refresh", response_model=Token)
@limiter.limit("5/minute")
def refresh(request: Request, response: Response, refresh_token: str = Cookie(None), db: Session = Depends(get_db)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    # Reuse detection — reject blacklisted tokens immediately
    if is_token_blacklisted(refresh_token):
        raise HTTPException(status_code=401, detail="Refresh token already used or revoked")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Immediately revoke the old refresh token before issuing new one
    blacklist_token(refresh_token, payload.get("exp", 0))

    new_access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value, "district": user.district}
    )
    new_refresh_token = create_refresh_token(
        data={"sub": user.id, "role": user.role.value}
    )

    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )

    return Token(
        access_token=new_access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=user.id
    )

@router.post("/logout")
def logout(response: Response, refresh_token: str = Cookie(None)):
    if refresh_token:
        payload = decode_token(refresh_token)
        if payload:
            blacklist_token(refresh_token, payload.get("exp", 0))
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/admin-only")
def admin_only_route(current_user: User = Depends(require_role(UserRole.admin))):
    return {"message": "Welcome Admin"}
