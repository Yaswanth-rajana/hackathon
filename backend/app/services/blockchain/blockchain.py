import datetime
import time
import threading
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.services.blockchain.block import Block
from app.services.blockchain.mining import proof_of_work
from app.services.blockchain.validation import is_chain_valid_stateless
from app.models.blockchain_ledger import BlockchainLedger

logger = logging.getLogger(__name__)

class Blockchain:
    def __init__(self):
        self.pending_transactions: List[Dict[str, Any]] = []
        self.difficulty: int = 2
        self.lock = threading.RLock()

    def ensure_genesis_exists(self, db: Session) -> None:
        """Ensures index 0 exists in the database ledger."""
        genesis = db.query(BlockchainLedger).filter(BlockchainLedger.block_index == 0).first()
        if not genesis:
            logger.info("Initializing Genesis Block in SQL Ledger...")
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
            block.hash = block.calculate_hash()
            
            db_block = BlockchainLedger(
                block_index=block.index,
                block_hash=block.hash,
                previous_hash=block.previous_hash,
                transaction_id=None,
                payload_hash=block.payload_hash,
                timestamp=block.timestamp,
                nonce=block.nonce,
                validator=block.validator,
                network=block.network,
                mining_time=block.mining_time,
                is_valid=True
            )
            db.add(db_block)
            db.commit()

    def get_latest_block(self, db: Session) -> Optional[Block]:
        """Fetches the highest index block from DB."""
        db_block = db.query(BlockchainLedger).order_by(BlockchainLedger.block_index.desc()).first()
        if not db_block:
            return None
        
        return Block(
            index=db_block.block_index,
            timestamp=db_block.timestamp,
            transactions=[], # In-memory block doesn't need TXs for linkage checks
            previous_hash=db_block.previous_hash,
            hash=db_block.block_hash,
            payload_hash=db_block.payload_hash,
            nonce=db_block.nonce,
            validator=db_block.validator,
            network=db_block.network,
            mining_time=db_block.mining_time
        )

    def add_transaction(self, transaction: Dict[str, Any]) -> None:
        with self.lock:
            self.pending_transactions.append(transaction)

    def mine_pending_transactions(self, db: Session, simulate: bool = False) -> Block:
        with self.lock:
            if not self.pending_transactions:
                raise ValueError("No pending transactions to mine")

            # FETCH SOURCE OF TRUTH FROM DB
            last_block_db = self.get_latest_block(db)
            if not last_block_db:
                # If no blocks, we must ensure genesis exists first
                self.ensure_genesis_exists(db)
                last_block_db = self.get_latest_block(db)

            new_index = last_block_db.index + 1
            previous_hash = last_block_db.hash
            
            pending_copy = self.pending_transactions.copy()

        new_block = Block(
            index=new_index,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            transactions=pending_copy,
            previous_hash=previous_hash
        )

        start_time = time.time()
        proof_of_work(new_block, self.difficulty)
        new_block.mining_time = round(time.time() - start_time, 4)
        
        from app.services.blockchain.crypto import sign_block_header
        header_dict = new_block.get_header_dict()
        new_block.validator_signatures = [
            sign_block_header(header_dict, "NODE_1"),
            sign_block_header(header_dict, "NODE_2")
        ]
        
        if simulate:
            return new_block
            
        self.commit_block(db, new_block)
        return new_block
        
    def commit_block(self, db: Session, block: Block) -> None:
        """Phase 2 Commit: finalize execution into the SQL Ledger."""
        with self.lock:
            # Final integrity check before insertion
            last_block = self.get_latest_block(db)
            expected_index = (last_block.index + 1) if last_block else 0
            
            if block.index != expected_index:
                raise ValueError(f"Sequential Integrity Violation: Block {block.index} attempted, but DB expected {expected_index}")

            try:
                db_block = BlockchainLedger(
                    block_index=block.index,
                    block_hash=block.hash,
                    previous_hash=block.previous_hash,
                    transaction_id=block.transactions[0].get("transaction_id") if block.transactions else None,
                    payload_hash=block.payload_hash,
                    timestamp=block.timestamp,
                    nonce=block.nonce,
                    validator=block.validator,
                    network=block.network,
                    mining_time=block.mining_time,
                    is_valid=True
                )
                db.add(db_block)
                db.flush() # Ensure it's prepared for commit
                self.pending_transactions = []
                logger.info(f"[BLOCK_COMMIT] index={block.index} hash={block.hash[:10]}...")
            except Exception as e:
                logger.error(f"Failed to commit block {block.index}: {e}")
                raise ValueError(f"Blockchain storage failure: {str(e)}")

    def discard_pending(self) -> None:
        with self.lock:
            self.pending_transactions = []

    def is_chain_valid(self, db: Session) -> bool:
        """Stateless validation reading entire DB ledger."""
        return is_chain_valid_stateless(db, self.difficulty)

# Singleton instance for pending TX management (shared memory for single process)
blockchain = Blockchain()

