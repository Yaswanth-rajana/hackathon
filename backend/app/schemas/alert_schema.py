from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.alert import AlertStatus, AlertSeverity

class AlertBase(BaseModel):
    severity: AlertSeverity
    type: str
    district: str
    entity_id: str
    description: str
    detected_by: str
    block_index: Optional[int] = None
    anomaly_id: Optional[int] = None

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    status: AlertStatus
    acknowledged_by: Optional[str] = None

class AlertResponse(AlertBase):
    id: str
    status: AlertStatus
    created_at: datetime
    updated_at: datetime
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AlertStatsResponse(BaseModel):
    critical: int
    high: int
    medium: int
    info: int

class AlertListResponse(BaseModel):
    items: List[AlertResponse]
    total: int
    page: int
    limit: int
