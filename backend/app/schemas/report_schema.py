from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class ScheduledReportCreate(BaseModel):
    district: str
    report_type: str  # monthly, shop, excel
    frequency: str    # weekly, monthly
    recipient_email: EmailStr
    format: str = "pdf"

class ScheduledReportResponse(BaseModel):
    id: int
    district: str
    report_type: str
    frequency: str
    next_run: datetime
    last_run: Optional[datetime]
    is_active: bool
    recipient_email: str
    format: str
    created_at: datetime
    
    class Config:
        orm_mode = True
