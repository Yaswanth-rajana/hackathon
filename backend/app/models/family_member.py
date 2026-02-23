from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ration_card = Column(String(20), ForeignKey("beneficiaries.ration_card"), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    relation = Column(String(50), nullable=False)
    age = Column(Integer, nullable=False)
    aadhaar_masked = Column(String(14), nullable=False)  # Example: "XXXX-XXXX-1234"
