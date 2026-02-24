from sqlalchemy import Column, String, Integer, Boolean, DateTime
from datetime import datetime
from app.database import Base


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    ration_card = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    family_members = Column(Integer, default=1)

    mobile = Column(String(15), nullable=True)
    mobile_verified = Column(Boolean, default=False)

    account_status = Column(String(20), default="inactive")
    pin_hash = Column(String(255), nullable=True)
    
    # --- Citizen Auth & Profile ---
    password_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    failed_attempts = Column(Integer, default=0)
    last_login = Column(DateTime, nullable=True)
    lockout_until = Column(DateTime, nullable=True)
    
    district = Column(String(50), nullable=True)
    mandal = Column(String(50), nullable=True)

    shop_id = Column(String(20), nullable=False, index=True)
    
    is_simulated = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
