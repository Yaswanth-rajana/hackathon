from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(String(20), primary_key=True, index=True)
    shop_id = Column(String(20), ForeignKey("shops.id"))
    
    triggered_by = Column(String(20))  
    # anomaly | complaint | risk_score | manual

    trigger_reference = Column(String(50), nullable=True)

    inspector_id = Column(String(50), ForeignKey("users.id"))

    priority = Column(String(10), default="normal")
    # normal | high | critical

    status = Column(String(20), default="scheduled")
    # scheduled | in_progress | completed | action_taken | cancelled

    findings = Column(Text, nullable=True)
    evidence_urls = Column(JSON, nullable=True)

    action_taken = Column(Text, nullable=True)

    blockchain_txn_id = Column(String(20), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
