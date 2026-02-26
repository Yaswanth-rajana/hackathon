from sqlalchemy import Column, Integer, String, Text, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base

class SmsLog(Base):
    __tablename__ = "sms_logs"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(50))
    ration_card = Column(String(20))
    mobile = Column(String(15))
    message = Column(Text)
    status = Column(String(20))
    provider_response = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
