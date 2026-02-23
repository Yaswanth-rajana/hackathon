from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ComplaintNote(BaseModel):
    id: str
    note: str
    timestamp: Optional[datetime] = None

class ComplaintCreate(BaseModel):
    citizen_name: str
    ration_card: str
    shop_id: str
    complaint_type: str
    description: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: str
    citizen_name: str
    ration_card: str
    shop_id: str
    complaint_type: str
    description: Optional[str]
    status: str
    inspector_id: Optional[str]
    notes: List[ComplaintNote] = []
    resolution_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class AssignInspectorRequest(BaseModel):
    inspector_id: str

class AddNoteRequest(BaseModel):
    note: str

class ResolveComplaintRequest(BaseModel):
    resolution_notes: str
