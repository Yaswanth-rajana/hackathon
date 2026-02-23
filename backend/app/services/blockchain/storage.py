import json
import os
import logging
from typing import List, Optional
from app.services.blockchain.block import Block

logger = logging.getLogger(__name__)

FILE_PATH = "blockchain_backup.json"

def save_chain_to_file(chain: List[Block]) -> None:
    try:
        data = [block.to_dict() for block in chain]
        with open(FILE_PATH, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save blockchain to {FILE_PATH}: {e}")

def load_chain_from_file() -> Optional[List[Block]]:
    if not os.path.exists(FILE_PATH):
        return None
    try:
        with open(FILE_PATH, "r") as f:
            data = json.load(f)
            if not data:
                return None
            return [Block.from_dict(b) for b in data]
    except Exception as e:
        logger.error(f"Failed to load blockchain from {FILE_PATH}: {e}")
        return None
