from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.sql import func
from app.database import Base


class BlockchainLedger(Base):
    __tablename__ = "blockchain_ledger"

    block_index = Column(Integer, primary_key=True)
    block_hash = Column(String, unique=True, nullable=False)
    previous_hash = Column(String, nullable=False)
    transaction_id = Column(String, nullable=True)   # NULL for genesis block
    payload_hash = Column(String(64), nullable=True)  # NULL for genesis block
    
    # Metadata for full header reconstruction and verification
    timestamp = Column(String, nullable=False)  # ISO string to match Block object
    nonce = Column(Integer, default=0)
    validator = Column(String, default="Node-1")
    network = Column(String, default="RationShield-Private")
    mining_time = Column(Float, default=0.0)
    
    is_valid = Column(Boolean, default=True)
