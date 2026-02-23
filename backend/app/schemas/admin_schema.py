from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_shops: int
    total_transactions: int
    total_beneficiaries: int
    total_anomalies: int
    high_risk_shops: int


class RiskDistributionResponse(BaseModel):
    high: int
    medium: int
    low: int


class AnomalyResponse(BaseModel):
    shop_id: str
    type: str
    severity: str
    description: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True
