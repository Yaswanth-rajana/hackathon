from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import UserRole

class UserLogin(BaseModel):
    mobile: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: str
    district: Optional[str] = None

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[UserRole] = None

class UserResponse(BaseModel):
    id: str
    name: str
    mobile: str
    email: Optional[EmailStr] = None
    role: UserRole
    district: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True
