from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class FraudDistributionResponse(BaseModel):
    distribution: Dict[str, int] = Field(..., description="Count of anomalies by type")
    total_anomalies: int

class MonthlyTrendItem(BaseModel):
    month: str
    cases: int
    avg_risk: float

class MonthlyTrendResponse(BaseModel):
    trends: List[MonthlyTrendItem]

class MandalComplianceItem(BaseModel):
    mandal: str
    compliance_score: float

class MandalComplianceResponse(BaseModel):
    compliance_by_mandal: List[MandalComplianceItem]

class ResolutionMetricsResponse(BaseModel):
    avg_resolution_hours: float
    fastest_resolving_mandal: Optional[str]
    slowest_resolving_mandal: Optional[str]
    backlog_size: int

class AnomalyTrendItem(BaseModel):
    anomaly_type: str
    count: int

class RepeatOffenderItem(BaseModel):
    shop_id: str
    violation_count: int

class AnomalyTrendResponse(BaseModel):
    top_recurring_anomalies: List[AnomalyTrendItem]
    repeat_offenders: List[RepeatOffenderItem]
