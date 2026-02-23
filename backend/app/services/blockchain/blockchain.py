import datetime
import time
import threading
import logging
from typing import List, Dict, Any

from app.services.blockchain.block import Block
from app.services.blockchain.mining import proof_of_work
from app.services.blockchain.storage import save_chain_to_file, load_chain_from_file
from app.services.blockchain.validation import is_chain_valid

logger = logging.getLogger(__name__)

class Blockchain:
    def __init__(self):
        self.pending_transactions: List[Dict[str, Any]] = []
        self.difficulty: int = 2
        self.lock = threading.RLock()
        
        loaded_chain = load_chain_from_file()
        if loaded_chain:
            self.chain = loaded_chain
        else:
            self.chain = []
            self.create_genesis_block()

    def create_genesis_block(self) -> None:
        block = Block(
            index=0,
            timestamp="2026-01-01T00:00:00+00:00",
            transactions=[{
                "type": "GENESIS",
                "message": "RationShield Blockchain Started",
                "version": "1.0",
                "network": "private-permissioned"
            }],
            previous_hash="0",
            nonce=0,
            mining_time=0.0
        )
        # Deterministic genesis hash calculation based on hardcoded constants
        block.hash = block.calculate_hash()
        self.chain.append(block)
        save_chain_to_file(self.chain)

    def get_chain_fingerprint(self) -> dict:
        import hashlib
        all_hashes = "".join([b.hash for b in self.chain])
        chain_hash = hashlib.sha256(all_hashes.encode()).hexdigest()
        return {
            "latest_block": self.get_latest_block().index,
            "chain_hash": chain_hash
        }

    def add_transaction(self, transaction: Dict[str, Any]) -> None:
        with self.lock:
            self.pending_transactions.append(transaction)

    def mine_pending_transactions(self, simulate: bool = False) -> Block:
        with self.lock:
            if not self.pending_transactions:
                raise ValueError("No pending transactions to mine")

            last_block = self.get_latest_block()
            
            # Copy pending to avoid mutating shared state during simulation/mining
            pending_copy = self.pending_transactions.copy()
            new_index = len(self.chain)

        new_block = Block(
            index=new_index,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            transactions=pending_copy,
            previous_hash=last_block.hash
        )

        start_time = time.time()
        # Run proof of work
        proof_of_work(new_block, self.difficulty)
        mining_time = time.time() - start_time
        new_block.mining_time = round(mining_time, 4)
        
        # Step 3 Multi-Node Signature Injection using canonical header bounds
        from app.services.blockchain.crypto import sign_block_header
        
        header_dict = new_block.get_header_dict()
        sig_node_1 = sign_block_header(header_dict, "NODE_1")
        sig_node_2 = sign_block_header(header_dict, "NODE_2")
        
        new_block.validator_signatures = [sig_node_1, sig_node_2]
        
        if simulate:
            logger.info("Blockchain simulation called. Returning block without committing.")
            return new_block
            
        # Append and clean up natively
        self.commit_block(new_block)
        return new_block
        
    def commit_block(self, block: Block) -> None:
        """Phase 2 Commit: finalize execution and disk persistence."""
        with self.lock:
            # Re-verify index to prevent race conditions during concurrent mining
            if block.index != len(self.chain):
                raise ValueError("Block index mismatch, chain was modified during mining")
            self.chain.append(block)
            self.pending_transactions = []
        
        # Disk write outside of lock
        save_chain_to_file(self.chain)
        
        fingerprint = self.get_chain_fingerprint()["chain_hash"]
        signers = [sig.get("signed_by") for sig in getattr(block, "validator_signatures", [])]
        logger.info(f"[BLOCK_COMMIT] index={block.index} signers={signers} fingerprint={fingerprint[:10]}")
        
    def discard_pending(self) -> None:
        """Phase 2 Rollback: Abort current buffered memory safely."""
        with self.lock:
            count = len(self.pending_transactions)
            self.pending_transactions = []
            if count > 0:
                logger.warning(f"Atomic rollback triggered: DISCARDED {count} pending transactions.")

    def is_chain_valid(self) -> bool:
        return is_chain_valid(self.chain, self.difficulty)

    def get_latest_block(self) -> Block:
        with self.lock:
            return self.chain[-1]

# Singleton instance
blockchain = Blockchain()
