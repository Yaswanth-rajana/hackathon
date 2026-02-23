"""Pydantic schemas for admin-facing Dealer management endpoints."""
from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, validator


class CreateDealerRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    mobile: str = Field(..., min_length=10, max_length=15)
    shop_id: str = Field(..., min_length=1, max_length=50)
    mandal: str = Field(..., min_length=1, max_length=100)
    license_valid_until: date  # YYYY-MM-DD


class UpdateDealerRequest(BaseModel):
    mobile: Optional[str] = Field(None, min_length=10, max_length=15)
    license_valid_until: Optional[date] = None
    dealer_status: Optional[str] = Field(None, pattern=r"^(active|suspended|expired|under_review)$")

    class Config:
        # Allow partial updates — all fields optional
        extra = "forbid"


class DealerResponse(BaseModel):
    id: str
    name: str
    email: Optional[str]
    mobile: str
    district: Optional[str]
    mandal: Optional[str]
    shop_id: Optional[str]
    shop_name: Optional[str]
    dealer_status: Optional[str]
    license_valid_until: Optional[datetime]
    days_to_expiry: Optional[int]       # backend-calculated
    is_expiring_soon: bool = False       # True if ≤30 days remaining
    expiry_urgency: str = "normal"       # normal | warning | critical
    last_login: Optional[datetime]
    must_change_password: bool = False
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DealerListResponse(BaseModel):
    total: int
    page: int
    limit: int
    dealers: List[DealerResponse]


class ResetPasswordResponse(BaseModel):
    message: str
    temp_password: str          # Shown once — admin must copy immediately
    warning: str = "This password will be shown only once. Store it securely."
