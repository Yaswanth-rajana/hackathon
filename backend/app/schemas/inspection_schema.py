from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any
from datetime import datetime

class InspectionBase(BaseModel):
    shop_id: str = Field(..., max_length=20)
    triggered_by: str = Field(..., max_length=20)
    trigger_reference: Optional[str] = Field(None, max_length=50)
    inspector_id: str = Field(..., max_length=50)
    priority: str = Field(default="normal", max_length=10)

class InspectionCreate(InspectionBase):
    pass

class InspectionUpdate(BaseModel):
    findings: Optional[str] = None
    evidence_urls: Optional[List[str]] = None
    action_taken: Optional[str] = None

class InspectionAction(BaseModel):
    action_taken: str

class InspectionComplete(BaseModel):
    findings: str
    evidence_urls: Optional[List[str]] = []

class InspectionResponse(InspectionBase):
    id: str
    status: str
    findings: Optional[str] = None
    evidence_urls: Optional[List[str]] = None
    action_taken: Optional[str] = None
    blockchain_txn_id: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class InspectionStats(BaseModel):
    total: int
    active: int
    completed: int
    confirmed_fraud_pct: float
    avg_resolution_time_hours: float
