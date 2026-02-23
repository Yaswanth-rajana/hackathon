from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DashboardSummaryResponse(BaseModel):
    total_shops: int
    high_risk_shops: int
    complaints_this_month: int
    compliance_score: int

class AlertResponse(BaseModel):
    id: int
    shop_id: str
    severity: str
    description: str
    risk_score: Optional[int] = None
    detected_at: datetime
    fraud_type: str

class AlertsPaginatedResponse(BaseModel):
    data: List[AlertResponse]
    total: int
    page: int
    limit: int

class HeatmapRegionResponse(BaseModel):
    mandal: str
    avg_score: int
    risk_level: str
    shop_count: int
    top_fraud_type: Optional[str] = None

class HighRiskShopResponse(BaseModel):
    shop_id: str
    shop_name: str
    mandal: str
    risk_score: int
    fraud_type: Optional[str] = None
    last_audit: Optional[str] = None

class HighRiskShopsPaginatedResponse(BaseModel):
    data: List[HighRiskShopResponse]

class BlockchainRecentResponse(BaseModel):
    timestamp: str
    transaction_id: str
    shop_id: str
    type: str
    block_hash: str
    status: str
