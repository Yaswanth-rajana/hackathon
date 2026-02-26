from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Float, CheckConstraint
from sqlalchemy.sql import func
from app.database import Base
from datetime import datetime

class Shop(Base):
    __tablename__ = "shops"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    district = Column(String, index=True)
    mandal = Column(String, index=True)
    address = Column(Text, nullable=True)
    dealer_id = Column(String, ForeignKey("users.id"))
    
    # --- Stock Details ---
    stock_wheat = Column(Float, default=0)
    stock_rice = Column(Float, default=0)
    stock_sugar = Column(Float, default=0)
    stock_kerosene = Column(Float, default=0)

    # --- Citizen Discovery ---
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timings = Column(String, default="09:00 AM - 05:00 PM")
    rating = Column(Float, default=4.5)
    risk_score = Column(Float, default=0.0)
    status = Column(String(30), default="active", index=True)
    under_review_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("stock_wheat >= 0", name="check_stock_wheat_positive"),
        CheckConstraint("stock_rice >= 0", name="check_stock_rice_positive"),
        CheckConstraint("stock_sugar >= 0", name="check_stock_sugar_positive"),
        CheckConstraint("stock_kerosene >= 0", name="check_stock_kerosene_positive"),
    )
