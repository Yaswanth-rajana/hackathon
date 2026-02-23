from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class AuditResponse(BaseModel):
    id: int
    shop_id: str
    scheduled_date: Optional[datetime] = None
    priority: str
    created_by: Optional[str] = None
    completed_date: Optional[datetime] = None
    auditor_id: Optional[str] = None
    status: str
    notes: Optional[str] = None
    findings: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AuditListResponse(BaseModel):
    items: List[AuditResponse]
    total: int
    page: int
    limit: int
