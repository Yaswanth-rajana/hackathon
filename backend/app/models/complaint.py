from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Integer, Boolean
from datetime import datetime
import uuid
from app.database import Base

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, default=lambda: f"CMP_{uuid.uuid4().hex[:8].upper()}")
    citizen_name = Column(String, nullable=False)
    ration_card = Column(String, nullable=False)
    shop_id = Column(String, nullable=False)
    complaint_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    block_index = Column(Integer, nullable=True)
    block_hash = Column(String, nullable=True, index=True)
    status = Column(String, default="NEW")  # NEW, ASSIGNED, INVESTIGATING, RESOLVED
    inspector_id = Column(String, nullable=True)
    notes = Column(JSON, default=list)  # List of dicts: {"id": "...", "note": "...", "timestamp": "..."}
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    is_simulated = Column(Boolean, nullable=False, default=False, index=True)
