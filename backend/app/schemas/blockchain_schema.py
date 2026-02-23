from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BlockResponse(BaseModel):
    block_index: int
    block_hash: str
    previous_hash: str
    transaction_id: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
