from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base

class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(String, ForeignKey("shops.id"))
    risk_score = Column(Integer)
    risk_level = Column(String)
    fraud_type = Column(String)
    confidence = Column(Float)
    month = Column(String)  # e.g., '2026-02'
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_risk_shop_month', 'shop_id', 'month'),
    )
