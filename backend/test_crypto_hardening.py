import sys
import os
import copy
import datetime
from sqlalchemy.orm import Session

# Add current directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.database import SessionLocal
from app.services.blockchain.block import Block
from app.services.blockchain.crypto import initialize_keys, get_signer_fingerprint, ROLE_PUBLIC_KEYS, sign_transaction, sign_block_header
from app.services.blockchain.blockchain import blockchain
from app.services.blockchain.validation import is_chain_valid, is_chain_valid_stateless

def test_elite_hardening():
    print("--- 1. Initializing Cryptographic Context ---")
    initialize_keys()
    admin_fingerprint = get_signer_fingerprint(ROLE_PUBLIC_KEYS["ADMIN"])
    print(f"Loaded ADMIN Fingerprint: {admin_fingerprint}")
    
    print("\n--- 2. Building In-Memory Chain for Validation Tests ---")
    # Genesis
    genesis = Block(
        index=0,
        timestamp="2026-01-01T00:00:00+00:00",
        transactions=[{"type": "GENESIS"}],
        previous_hash="0"
    )
    chain = [genesis]
    
    # Block 1
    dist_tx = {
        "type": "DISTRIBUTION",
        "shop_id": "TPt123",
        "ration_card": "1234****9012",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    sign_transaction(dist_tx, "DEALER")
    
    block1 = Block(
        index=1,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        transactions=[dist_tx],
        previous_hash=genesis.hash
    )
    header_dict1 = block1.get_header_dict()
    block1.validator_signatures = [sign_block_header(header_dict1, "NODE_1")]
    chain.append(block1)
    
    print(f"Built chain with {len(chain)} blocks.")
    
    print("\n--- 3. Testing Pure Validity ---")
    assert is_chain_valid(chain, blockchain.difficulty) == True
    print("Baseline Validity: SUCCESS")
    
    print("\n--- 4. HACK: Block Header Manipulation (Nonce) ---")
    chain_hack1 = copy.deepcopy(chain)
    chain_hack1[-1].nonce = 999999
    # Note: is_chain_valid checks hash vs calculate_hash
    assert is_chain_valid(chain_hack1, blockchain.difficulty) == False
    print("HACK CAUGHT: Block Header Rejection SUCCESS")
    
    print("\n--- 5. HACK: Signature Swapping (Tampered Payload) ---")
    chain_hack2 = copy.deepcopy(chain)
    tampered_tx = copy.deepcopy(chain_hack2[-1].transactions[0])
    tampered_tx["shop_id"] = "HACKER_SHOP"
    chain_hack2[-1].transactions[0] = tampered_tx
    # Recalculate payload hash but keep old block hash (which was based on old payload hash)
    # The Block constructor usually calculates payload_hash from txs.
    # To simulate a hack where the hash is NOT updated, we manually break it.
    
    # Re-init block with tampered tx but OLD hash
    old_hash = chain[-1].hash
    chain_hack2[-1] = Block(
        index=chain[-1].index,
        timestamp=chain[-1].timestamp,
        transactions=[tampered_tx],
        previous_hash=chain[-1].previous_hash,
        hash=old_hash # Manually set old hash
    )
    assert is_chain_valid(chain_hack2, blockchain.difficulty) == False
    print("HACK CAUGHT: Signature Content Mismatch SUCCESS")
    
    print("\n--- 6. HACK: Sequential Integrity Check ---")
    chain_hack3 = copy.deepcopy(chain)
    chain_hack3[-1].index = 5 # Break sequence
    assert is_chain_valid(chain_hack3, blockchain.difficulty) == False
    print("HACK CAUGHT: Identity Binding Failure SUCCESS")

    print("\n--- 7. DB-Backed Sequentiality Test ---")
    db = SessionLocal()
    try:
        # We won't actually clear the DB, but we'll check if adding a non-sequential block fails
        last_block = blockchain.get_latest_block(db)
        if not last_block:
            blockchain.ensure_genesis_exists(db)
            last_block = blockchain.get_latest_block(db)
            
        print(f"Current DB Head: Index {last_block.index}")
        
        # Try to commit a block with WRONG index
        bad_block = Block(
            index=last_block.index + 5,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            transactions=[{"type": "INVALID"}],
            previous_hash=last_block.hash
        )
        try:
            blockchain.commit_block(db, bad_block)
            print("FAILED: Committed non-sequential block!")
            sys.exit(1)
        except ValueError as e:
            print(f"SUCCESS: Caught expected sequential error: {e}")
            
    finally:
        db.close()

    print("\nALL HARDENING TESTS COMPLETED SAFELY!")

if __name__ == "__main__":
    try:
        test_elite_hardening()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
