from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Integer, Boolean
from datetime import datetime, timezone
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
    
    # --- Governance Upgrades ---
    severity = Column(String(10), default="minor")  # minor | major | urgent
    is_anonymous = Column(Boolean, default=False)
    attachment_url = Column(String, nullable=True)
    district = Column(String(50), nullable=False) # Mandatory backend-side assignment
    
    block_index = Column(Integer, nullable=True)
    block_hash = Column(String, nullable=True, index=True)
    status = Column(String, default="NEW")  # NEW, ASSIGNED, INVESTIGATING, RESOLVED
    inspector_id = Column(String, nullable=True)
    notes = Column(JSON, default=list)  # List of dicts: {"id": "...", "note": "...", "timestamp": "..."}
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    is_simulated = Column(Boolean, nullable=False, default=False, index=True)
