from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.sql import func
from app.database import Base

class MonthlyAnalytics(Base):
    __tablename__ = "monthly_analytics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    district = Column(String(100), index=True, nullable=False)
    month = Column(String(7), nullable=False) # Format: YYYY-MM
    
    fraud_count = Column(Integer, default=0, nullable=False)
    avg_risk_score = Column(Float, default=0.0, nullable=False)
    
    complaint_count = Column(Integer, default=0, nullable=False)
    resolved_count = Column(Integer, default=0, nullable=False)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_monthly_analytics_district_month', 'district', 'month', unique=True),
    )
