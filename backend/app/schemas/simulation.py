from pydantic import BaseModel, Field
from typing import Optional

class GhostInjectionRequest(BaseModel):
    intensity: str = Field("MEDIUM", description="Simulation intensity: LOW, MEDIUM, or HIGH")
    seed: Optional[int] = None

class StockMismatchRequest(BaseModel):
    intensity: str = Field("MEDIUM", description="Simulation intensity: LOW, MEDIUM, or HIGH")
    month_year: Optional[str] = None

class ComplaintSpikeRequest(BaseModel):
    intensity: str = Field("MEDIUM", description="Simulation intensity: LOW, MEDIUM, or HIGH")
    seed: Optional[int] = None
