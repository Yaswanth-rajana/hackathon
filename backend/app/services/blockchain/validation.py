from sqlalchemy.orm import Session
from app.models.blockchain_ledger import BlockchainLedger
from app.services.blockchain.block import Block

def is_chain_valid_stateless(db: Session, difficulty: int) -> bool:
    """
    Validates the entire blockchain stored in SQL.
    Sequential integrity is strictly enforced: index N must follow N-1.
    """
    rows = db.query(BlockchainLedger).order_by(BlockchainLedger.block_index.asc()).all()
    if not rows:
        return True

    # Convert first row to Block object for initial state
    prev_db = rows[0]
    previous_block = Block(
        index=prev_db.block_index,
        timestamp=prev_db.timestamp,
        transactions=[], 
        previous_hash=prev_db.previous_hash,
        hash=prev_db.block_hash,
        payload_hash=prev_db.payload_hash,
        nonce=prev_db.nonce,
        validator=prev_db.validator,
        network=prev_db.network
    )

    # 1. Genesis check (index 0)
    if previous_block.index != 0:
        print(f"Chain integrity failure: Missing genesis block (found index {previous_block.index})")
        return False

    for i in range(1, len(rows)):
        current_db = rows[i]
        current_block = Block(
            index=current_db.block_index,
            timestamp=current_db.timestamp,
            transactions=[],
            previous_hash=current_db.previous_hash,
            hash=current_db.block_hash,
            payload_hash=current_db.payload_hash,
            nonce=current_db.nonce,
            validator=current_db.validator,
            network=current_db.network
        )

        # 1. Index check (Strict Sequentiality)
        if current_block.index != previous_block.index + 1:
            print(f"Failed at Index Check: {current_block.index} != {previous_block.index} + 1")
            return False

        # 2. Previous hash check
        if current_block.previous_hash != previous_block.hash:
            print(f"Failed at Previous Hash Check: {current_block.previous_hash} != {previous_block.hash}")
            return False

        # 3. Hash calculation check (Stateless re-verification)
        if current_block.hash != current_block.calculate_hash():
            print(f"Failed at Hash Validation: stored hash does not match computed header hash")
            return False

        # 4. Proof of Work Difficulty validation
        if not current_block.hash.startswith("0" * difficulty):
            print(f"Failed at Proof of Work constraint for block {current_block.index}")
            return False

        previous_block = current_block

    return True

def is_chain_valid(chain: List[Block], difficulty: int) -> bool:
    """Legacy support for in-memory list validation."""
    if not chain:
        return True

    for i in range(1, len(chain)):
        current = chain[i]
        previous = chain[i - 1]

        if current.index != previous.index + 1:
            return False
        if current.previous_hash != previous.hash:
            return False
        if current.hash != current.calculate_hash():
            return False
            
    return True
