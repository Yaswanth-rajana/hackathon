from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class BlockchainLedger(Base):
    __tablename__ = "blockchain_ledger"

    block_index = Column(Integer, primary_key=True)
    block_hash = Column(String, unique=True, nullable=False)
    previous_hash = Column(String, nullable=False)
    transaction_id = Column(String, nullable=True)   # NULL for genesis block
    payload_hash = Column(String(64), nullable=True)  # NULL for genesis block
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_valid = Column(Boolean, default=True)
