from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, CheckConstraint, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)  # txn-<uuid4>
    block_index = Column(Integer, unique=True, index=True, nullable=False)
    shop_id = Column(String, index=True, nullable=False)
    ration_card = Column(String, index=True, nullable=False)
    transaction_type = Column(String, nullable=False, default="distribution")
    
    # Use JSON with variant for SQLite testing support
    items = Column(JSON().with_variant(JSONB, 'postgresql'), nullable=False)
    
    # --- New Dealer Module Columns ---
    otp_verified = Column(Boolean, default=False)
    cash_collected = Column(Float, default=0)
    payment_mode = Column(String(50), nullable=True)  # free / subsidized / cash_compensation
    notes = Column(String, nullable=True)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    block_hash = Column(String, nullable=False, index=True)
    previous_hash = Column(String, nullable=False)

    __table_args__ = (
        CheckConstraint("cash_collected >= 0", name="check_cash_positive"),
        CheckConstraint("payment_mode IN ('free', 'subsidized', 'cash_compensation')", name="check_payment_mode"),
        CheckConstraint("transaction_type IN ('DISTRIBUTION', 'ALLOCATION', 'COMPLAINT', 'CASH_TRANSFER')", name="check_transaction_type"),
    )
