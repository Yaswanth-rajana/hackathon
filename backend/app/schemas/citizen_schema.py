from datetime import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel

class CitizenLoginRequest(BaseModel):
    ration_card: str
    password: str

class CitizenProfileResponse(BaseModel):
    name: str
    ration_card: str
    shop_id: str
    account_status: str


class CitizenTransactionItem(BaseModel):
    transaction_id: str
    items: Dict[str, Any]
    timestamp: datetime
    block_index: int


class CitizenTransactionsResponse(BaseModel):
    transactions: List[CitizenTransactionItem]
    total: int

class EntitlementResponse(BaseModel):
    month_year: str
    wheat_total: float
    wheat_remaining: float
    rice_total: float
    rice_remaining: float
    sugar_total: float
    sugar_remaining: float
    status: str

class ShopDetailsResponse(BaseModel):
    name: str
    dealer_name: Optional[str] = "N/A"
    address: Optional[str] = "N/A"
    timings: str
    rating: float
    risk_score: float

class ComplaintCreateRequest(BaseModel):
    complaint_type: str
    description: Optional[str] = None
    shop_id: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: str
    complaint_type: str
    description: Optional[str]
    status: str
    created_at: datetime
    resolution_notes: Optional[str]

class NotificationResponse(BaseModel):
    id: int
    type: str
    message: str
    severity: str
    read: bool
    created_at: datetime

class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    relation: str
    age: int
    aadhaar_masked: str

class FamilyMemberCreateRequest(BaseModel):
    name: str
    relation: str
    age: int
    aadhaar_masked: str

class NearbyShopResponse(BaseModel):
    id: str
    name: str
    distance_km: float
    timings: str
    rating: float
