import hashlib
import json
import logging
from sqlalchemy.orm import Session
from app.models.blockchain_ledger import BlockchainLedger

logger = logging.getLogger(__name__)


def compute_sha256(data: str) -> str:
    """Compute SHA-256 hex digest of a string."""
    return hashlib.sha256(data.encode()).hexdigest()


def ensure_genesis_block(db: Session) -> None:
    """Idempotently insert the genesis block (block_index=0).

    Only inserts if no blocks exist. Never duplicates.
    """
    existing = db.query(BlockchainLedger).filter(
        BlockchainLedger.block_index == 0
    ).first()

    if existing is not None:
        return  # Genesis already present

    import datetime
    genesis = BlockchainLedger(
        block_index=0,
        block_hash=compute_sha256("GENESIS"),
        previous_hash="0",
        transaction_id=None,
        payload_hash=None,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        is_valid=True,
    )
    db.add(genesis)
    # NOTE: Not committing here — caller owns the transaction boundary
    db.flush()
    logger.info("Genesis block created (block_index=0)")


def get_last_block(db: Session) -> BlockchainLedger:
    """Return the block with the highest block_index."""
    return (
        db.query(BlockchainLedger)
        .order_by(BlockchainLedger.block_index.desc())
        .first()
    )


def get_block(db: Session, block_index: int) -> BlockchainLedger:
    """Return a specific block by index for citizen verification."""
    block = db.query(BlockchainLedger).filter(BlockchainLedger.block_index == block_index).first()
    if not block:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Block not found")
    return block


def create_block(
    db: Session,
    transaction_id: str,
    payload: dict,
    previous_hash: str,
    block_index: int,
) -> BlockchainLedger:
    """Create a new block in the ledger.

    Hash rule (deterministic):
        payload_hash = sha256(json.dumps(payload, sort_keys=True))
        block_hash = sha256(f"{block_index}{previous_hash}{payload_hash}".encode())
    """
    payload_string = json.dumps(payload, sort_keys=True)
    payload_hash = compute_sha256(payload_string)
    
    block_hash_string = f"{block_index}{previous_hash}{payload_hash}"
    block_hash = compute_sha256(block_hash_string)

    import datetime
    block = BlockchainLedger(
        block_index=block_index,
        block_hash=block_hash,
        previous_hash=previous_hash,
        transaction_id=transaction_id,
        payload_hash=payload_hash,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        is_valid=True,
    )
    db.add(block)
    # NOTE: Not committing — caller owns the transaction boundary
    db.flush()

    logger.info(
        f"Block #{block_index} created | hash={block_hash[:16]}… "
        f"| prev={previous_hash[:16]}… | txn={transaction_id}"
    )
    return block


def verify_chain(db: Session) -> dict:
    """Walk the entire chain and verify hash integrity.

    For each block (index >= 1):
      1. Recompute expected_hash = sha256(block.previous_hash + block.payload_hash)
      2. Check expected_hash == block.block_hash
      3. Check block.previous_hash == previous_block.block_hash

    Returns {"valid": bool, "total_blocks": int}.
    """
    blocks = (
        db.query(BlockchainLedger)
        .order_by(BlockchainLedger.block_index.asc())
        .all()
    )

    if not blocks:
        return {"valid": True, "total_blocks": 0}

    # Verify genesis block
    genesis = blocks[0]
    expected_genesis_hash = compute_sha256("GENESIS")
    if genesis.block_hash != expected_genesis_hash or genesis.previous_hash != "0":
        logger.warning("Genesis block integrity check FAILED")
        return {"valid": False, "total_blocks": len(blocks)}

    # Walk chain from block 1 onward
    for i in range(1, len(blocks)):
        current = blocks[i]
        previous = blocks[i - 1]

        # Check 1: previous_hash linkage
        if current.previous_hash != previous.block_hash:
            logger.warning(
                f"Chain broken at block #{current.block_index}: "
                f"previous_hash mismatch (expected={previous.block_hash[:16]}…, "
                f"got={current.previous_hash[:16]}…)"
            )
            return {"valid": False, "total_blocks": len(blocks)}

        # Check 2: Recompute block hash
        if current.payload_hash is None:
            logger.warning(
                f"Block #{current.block_index} has NULL payload_hash"
            )
            return {"valid": False, "total_blocks": len(blocks)}

        expected_hash_string = f"{current.block_index}{current.previous_hash}{current.payload_hash}"
        expected_hash = compute_sha256(expected_hash_string)
        
        if expected_hash != current.block_hash:
            logger.warning(
                f"Chain broken at block #{current.block_index}: "
                f"hash mismatch (expected={expected_hash[:16]}…, "
                f"got={current.block_hash[:16]}…)"
            )
            return {"valid": False, "total_blocks": len(blocks)}

    logger.info(f"Chain verified: {len(blocks)} blocks, all valid")
    return {"valid": True, "total_blocks": len(blocks)}


def get_recent_blocks(db: Session, limit: int = 20) -> list[BlockchainLedger]:
    """Return the most recent blocks for the explorer.

    Fetches by descending index then reverses so the frontend
    receives them in genesis → latest order.
    """
    rows = (
        db.query(BlockchainLedger)
        .order_by(BlockchainLedger.block_index.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))
