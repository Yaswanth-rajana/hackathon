from sqlalchemy import Column, Integer, String, DateTime, Float, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class SuspensionRecord(Base):
    __tablename__ = "suspension_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(80), unique=True, index=True, nullable=False)
    shop_id = Column(String(20), index=True, nullable=False)
    shop_name = Column(String(150), nullable=True)
    dealer_id = Column(String(50), nullable=True)
    risk_score_before = Column(Float, nullable=True)
    risk_score_after = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    ai_factors = Column(JSON, default=dict)
    enforcement_txn_id = Column(String(50), nullable=True)
    enforcement_block_index = Column(Integer, nullable=True)
    block_hash = Column(String, nullable=True, index=True)
    previous_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
