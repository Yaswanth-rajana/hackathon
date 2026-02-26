import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base

class AlertStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    ESCALATED = "ESCALATED"

class AlertSeverity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    INFO = "info"

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True)  # ALR-XXXXX
    severity = Column(Enum(AlertSeverity), index=True, nullable=False)
    type = Column(String, index=True, nullable=False)  # ML_FRAUD, COMPLAINT_SPIKE, etc.
    district = Column(String, index=True, nullable=False)
    entity_id = Column(String, index=True, nullable=False) # e.g. SHOP_001

    description = Column(Text, nullable=False)
    
    # Metadata for traceability
    block_index = Column(Integer, nullable=True) # Blockchain reference
    anomaly_id = Column(Integer, nullable=True) # Link to anomaly.id if exists
    
    status = Column(Enum(AlertStatus), default=AlertStatus.OPEN, index=True, nullable=False)
    detected_by = Column(String, nullable=False) # ML, Manual, System
    
    # Lifecycle Tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    acknowledged_by = Column(String, nullable=True) # User ID or name
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index('idx_alert_created_at', 'created_at'),
    )
