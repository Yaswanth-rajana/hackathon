from datetime import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, field_validator

class CitizenLoginRequest(BaseModel):
    ration_card: str
    password: str

class CitizenProfileResponse(BaseModel):
    name: str
    ration_card: str
    shop_id: str
    account_status: str

class CashCompensation(BaseModel):
    amount: float
    date: datetime
    block: int
    txn_hash: str
    verified: bool


class CitizenTransactionItem(BaseModel):
    transaction_id: str
    items: Dict[str, Any]
    timestamp: datetime
    block_index: int

class LifetimeDistributionSummary(BaseModel):
    total_wheat_received: float
    total_rice_received: float
    total_sugar_received: float
    total_complaints_filed: int
    total_shortfalls_detected: int

class CitizenTransactionsResponse(BaseModel):
    transactions: List[CitizenTransactionItem]
    total: int
    summary: LifetimeDistributionSummary

class EntitlementResponse(BaseModel):
    month_year: str
    wheat_total: float
    wheat_remaining: float
    rice_total: float
    rice_remaining: float
    sugar_total: float
    sugar_remaining: float
    status: str
    is_settled: bool
    last_txn_hash: Optional[str] = None
    last_txn_block: Optional[int] = None
    cash_compensation: Optional[CashCompensation] = None
    short_distribution_reason: Optional[str] = None
    last_distribution_date: Optional[datetime] = None
    shop_risk_level: str = "NORMAL"
    shop_warning: Optional[str] = None
    recent_activity: List[Dict[str, Any]] = []

class ShopDetailsResponse(BaseModel):
    id: Optional[str] = None
    name: str
    dealer_name: Optional[str] = "N/A"
    address: Optional[str] = "N/A"
    timings: str
    rating: float
    risk_score: float
    shop_status: str = "active"
    dealer_status: Optional[str] = None
    shop_risk_level: str = "NORMAL"
    shop_warning: Optional[str] = None
    active_grievances: int = 0

class ComplaintCreateRequest(BaseModel):
    complaint_type: str
    description: Optional[str] = None
    shop_id: Optional[str] = None
    severity: str = "minor"
    is_anonymous: bool = False
    attachment_url: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: str
    complaint_type: str
    description: Optional[str]
    status: str
    severity: str
    is_anonymous: bool
    attachment_url: Optional[str] = None
    district: str
    block_index: Optional[int] = None
    block_hash: Optional[str] = None
    created_at: datetime
    resolution_notes: Optional[str] = None

class NotificationResponse(BaseModel):
    id: int
    type: str
    message: str
    severity: str
    read: bool
    created_at: datetime
    payload: Optional[Dict[str, Any]] = None

class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    relation: str
    age: int
    aadhaar_masked: str
    is_verified: bool

class FamilyMemberCreateRequest(BaseModel):
    name: str
    relation: str
    age: int
    aadhaar_masked: str

    @field_validator("name", "relation")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

class NearbyShopResponse(BaseModel):
    id: str
    name: str
    distance_km: float
    timings: str
    rating: float
