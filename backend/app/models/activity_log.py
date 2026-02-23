from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(String, ForeignKey("users.id"), index=True)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=False)  # complaint, audit, shop, etc.
    target_id = Column(String, nullable=False)
    district = Column(String, index=True)
    metadata_info = Column(JSON, default=dict)  # "metadata" is reserved word in SQLAlchemy Base
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    ip_address = Column(String, nullable=True)
