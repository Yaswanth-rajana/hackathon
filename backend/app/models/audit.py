from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Audit(Base):
    __tablename__ = "audits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(String, ForeignKey("shops.id"), index=True)
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    priority = Column(String, default="medium")  # low, medium, high
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    completed_date = Column(DateTime(timezone=True), nullable=True) # changed to nullable if scheduled
    auditor_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="scheduled") # scheduled, completed, cancelled
    notes = Column(String, nullable=True)
    findings = Column(String, nullable=True)
