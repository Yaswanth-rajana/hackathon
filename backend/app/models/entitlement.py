from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from app.database import Base

class Entitlement(Base):
    __tablename__ = "entitlements"

    id = Column(Integer, primary_key=True)
    ration_card = Column(String, ForeignKey("beneficiaries.ration_card"))
    month_year = Column(String(7), index=True)  # "YYYY-MM"
    wheat = Column(Float, default=0)
    rice = Column(Float, default=0)
    sugar = Column(Float, default=0)

    __table_args__ = (
        UniqueConstraint("ration_card", "month_year", name="unique_entitlement_per_month"),
    )
