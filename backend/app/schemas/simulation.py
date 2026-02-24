from pydantic import BaseModel, Field
from typing import Optional

class GhostInjectionRequest(BaseModel):
    count: int = Field(50, ge=1, le=1000)
    seed: Optional[int] = None

class StockMismatchRequest(BaseModel):
    inflation_factor: float = Field(1.5, gt=1.0)
    month_year: Optional[str] = None

class ComplaintSpikeRequest(BaseModel):
    count: int = Field(20, ge=1, le=500)
    seed: Optional[int] = None
