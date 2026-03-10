from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.models.beneficiary import Beneficiary
from app.schemas.user_schema import TokenData
from typing import List

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/dealer-login") # Focusing on dealer login for now

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    if payload.get("type") != "access":
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    role: str = payload.get("role")
    
    if user_id is None or role is None:
        raise credentials_exception
        
    token_data = TokenData(user_id=user_id, role=UserRole(role))
    
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

def get_current_citizen(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Beneficiary:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    if payload.get("type") != "access":
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    role: str = payload.get("role")
    
    if user_id is None or role != "citizen":
        raise credentials_exception
        
    beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == user_id).first()
    if beneficiary is None:
        raise credentials_exception
        
    if not beneficiary.is_active:
        raise HTTPException(status_code=400, detail="Inactive account")
        
    return beneficiary

def require_role(required_role: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {required_role.value}"
            )
        return current_user
    return role_checker

def require_any_role(*required_roles: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required one of: {[r.value for r in required_roles]}"
            )
        return current_user
    return role_checker

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin" and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required"
        )
    return current_user
