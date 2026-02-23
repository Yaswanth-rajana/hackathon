from pydantic import BaseModel
from typing import Dict, Any


class DistributeRequest(BaseModel):
    ration_card: str
    items: Dict[str, Any]


class DistributeResponse(BaseModel):
    transaction_id: str
    block_index: int
    block_hash: str


class VerifyResponse(BaseModel):
    valid: bool
    total_blocks: int
