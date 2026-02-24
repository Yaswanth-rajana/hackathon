from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Index
from sqlalchemy.sql import func
from app.database import Base


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(String(20), index=True, nullable=False)
    transaction_id = Column(String, nullable=True)
    block_index = Column(Integer, nullable=True)
    block_hash = Column(String, nullable=True, index=True)

    anomaly_type = Column(String(50), nullable=False)   # high_frequency | repeated_partial | daily_spike
    severity = Column(String(10), nullable=False, index=True)       # low | medium | high

    description = Column(String(255), nullable=False)
    confidence = Column(Float, nullable=False)

    is_resolved = Column(Boolean, default=False)
    is_simulated = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_anomaly_created_type', 'created_at', 'anomaly_type'),
    )
