from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    admin = "admin"
    dealer = "dealer"
    inspector = "inspector"
    citizen = "citizen"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    mobile = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    role = Column(Enum(UserRole), nullable=False)
    district = Column(String, nullable=True)
    shop_id = Column(String(20), nullable=True, index=True)  # Links dealer → shop → beneficiaries
    ration_card = Column(String(20), nullable=True, index=True)  # Links citizen → beneficiary
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ── Dealer management fields ───────────────────────────────────────────────
    dealer_status = Column(String, default="active", nullable=True)
    # DB-level: CHECK (dealer_status IN ('active','suspended','expired','under_review'))
    # DB-level: PARTIAL INDEX (dealer_status, district) WHERE role='dealer'
    license_valid_until = Column(DateTime(timezone=True), nullable=True, index=True)
    created_by_admin_id = Column(String, ForeignKey("users.id"), nullable=True)
    last_password_reset = Column(DateTime(timezone=True), nullable=True)
    must_change_password = Column(Boolean, default=False)  # Force change after admin reset

    # ── Soft delete (enterprise: never hard-delete users) ─────────────────────
    is_deleted = Column(Boolean, default=False, index=True)

