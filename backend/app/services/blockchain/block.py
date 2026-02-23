import json
import hashlib
from typing import Dict, Any

class Block:
    def __init__(self, index: int, timestamp: str, transactions: list[Dict[str, Any]], previous_hash: str, 
                 nonce: int = 0, hash: str = "", payload_hash: str = "", 
                 validator: str = "Node-1", network: str = "RationShield-Private", 
                 mining_time: float = 0.0, validator_signatures: list[Dict[str, str]] = None):
        self.index = index
        self.timestamp = timestamp
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.validator = validator
        self.network = network
        self.mining_time = mining_time
        self.validator_signatures = validator_signatures or []
        
        # Calculate payload hash explicitly based on transactions
        if not payload_hash:
            tx_string = json.dumps(self.transactions, sort_keys=True)
            self.payload_hash = hashlib.sha256(tx_string.encode()).hexdigest()
        else:
            self.payload_hash = payload_hash
            
        self.hash = hash or self.calculate_hash()

    def get_header_dict(self) -> dict:
        """Returns canonical block header metadata safely excluding mutable signatures."""
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "payload_hash": self.payload_hash,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "validator": self.validator,
            "network": self.network
        }

    def calculate_hash(self) -> str:
        # We strictly exclude `hash` preventing recursive invalidation.
        # We strictly exclude `mining_time` because time is only known post-PoW runtime.
        block_data = self.get_header_dict()
        block_string = json.dumps(block_data, sort_keys=True)
        return hashlib.sha256(block_string.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "payload_hash": self.payload_hash,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "validator": self.validator,
            "network": self.network,
            "mining_time": self.mining_time,
            "hash": self.hash,
            "validator_signatures": self.validator_signatures
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Block":
        return cls(
            index=data["index"],
            timestamp=data["timestamp"],
            transactions=data["transactions"],
            previous_hash=data["previous_hash"],
            nonce=data.get("nonce", 0),
            hash=data.get("hash", ""),
            payload_hash=data.get("payload_hash", ""),
            validator=data.get("validator", "Node-1"),
            network=data.get("network", "RationShield-Private"),
            mining_time=data.get("mining_time", 0.0),
            validator_signatures=data.get("validator_signatures", [])
        )
