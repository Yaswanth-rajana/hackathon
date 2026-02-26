from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class BeneficiaryResponse(BaseModel):
    ration_card: str
    name: str
    family_members: int
    mobile: Optional[str] = None
    mobile_verified: bool
    account_status: str
    shop_id: str

    class Config:
        from_attributes = True

class LinkMobileRequest(BaseModel):
    mobile: str = Field(pattern=r"^\d{10}$")

class SetPinRequest(BaseModel):
    ration_card: str
    pin: str = Field(pattern=r"^\d{4}$")

class MessageResponse(BaseModel):
    message: str
    ration_card: Optional[str] = None

class DashboardResponse(BaseModel):
    total_beneficiaries: int
    stock_available: Dict[str, float]
    today_transactions: int
    compliance_score: float
    status: Optional[str] = None
    shop_id: Optional[str] = None
    dealer_name: Optional[str] = None
    address: Optional[str] = None

class EntitlementResponse(BaseModel):
    wheat: float
    rice: float
    sugar: float

class ReceivedResponse(BaseModel):
    wheat: float
    rice: float
    sugar: float

class DistributeRequest(BaseModel):
    ration_card: str
    wheat: float
    rice: float
    sugar: float
    cash_collected: float = 0.0
    payment_mode: str = "free"
    notes: Optional[str] = None

class DistributeResponse(BaseModel):
    message: str
    transaction_id: str
    block_index: int
    block_hash: str

class StockResponse(BaseModel):
    wheat: float
    rice: float
    sugar: float
    kerosene: float

class ComplaintResponse(BaseModel):
    id: str
    citizen_name: str
    ration_card: str
    complaint_type: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ResolveComplaintRequest(BaseModel):
    resolution_notes: str

class DailyCount(BaseModel):
    date: str
    count: int

class PerformanceResponse(BaseModel):
    daily_counts: List[DailyCount]
    compliance_score: float
    mandal_avg: float
    difference: float

class TransactionHistoryItem(BaseModel):
    transaction_id: str
    timestamp: datetime
    transaction_type: str
    block_index: Optional[int] = None
    notes: Optional[str] = None
    items: Dict[str, float]

class AuditTraceResponse(BaseModel):
    history: List[TransactionHistoryItem]
