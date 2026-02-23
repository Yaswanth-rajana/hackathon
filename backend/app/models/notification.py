from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    district = Column(String, index=True)
    type = Column(String, nullable=False)  # ALERT, SYSTEM, COMPLAINT, AUDIT
    message = Column(String, nullable=False)
    payload = Column(JSON, default=dict)
    severity = Column(String, default="info")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
