from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    district = Column(String, index=True, nullable=False)
    report_type = Column(String, nullable=False) # monthly, shop, excel
    frequency = Column(String, nullable=False)   # weekly, monthly
    next_run = Column(DateTime(timezone=True), nullable=False)
    last_run = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    recipient_email = Column(String, nullable=False)
    format = Column(String, default="pdf")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
