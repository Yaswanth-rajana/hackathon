import json
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.anomaly import Anomaly
from app.services.blockchain.blockchain import blockchain

def run():
    from app.services.blockchain.crypto import initialize_keys
    initialize_keys()

    db = SessionLocal()
    try:
        # Get the latest anomaly
        anomaly = db.query(Anomaly).filter(Anomaly.block_hash != None).order_by(Anomaly.id.desc()).first()
        if not anomaly:
            print("No anomaly with block reference found. Ensure the test ran. Or run python -m pytest tests/test_ml_blockchain_binding.py")
            return
            
        print("====== ANOMALY DB ROW ======")
        print(json.dumps({
            "id": anomaly.id,
            "shop_id": anomaly.shop_id,
            "anomaly_type": anomaly.anomaly_type,
            "severity": anomaly.severity,
            "confidence": anomaly.confidence,
            "block_index": anomaly.block_index,
            "block_hash": anomaly.block_hash,
            "is_resolved": anomaly.is_resolved
        }, indent=2))
        
        print("\n====== ML_ALERT BLOCK JSON ======")
        # Get block by hash
        block = next((b for b in blockchain.chain if b.hash == anomaly.block_hash), None)
        if block:
            # We want the JSON structure of the block
            block_dict = {
                "index": block.index,
                "timestamp": block.timestamp,
                "transactions": block.transactions,
                "previous_hash": block.previous_hash,
                "hash": block.hash,
                "nonce": block.nonce,
                "mining_time": getattr(block, 'mining_time', None),
                "validator_signatures": getattr(block, 'validator_signatures', [])
            }
            print(json.dumps(block_dict, indent=2))
        else:
            print("Block not found in current blockchain state.")
            
        print("\n====== /VERIFY OUTPUT ======")
        print(json.dumps({
            "is_valid": blockchain.is_chain_valid(),
            "chain_length": len(blockchain.chain),
            "latest_block_index": blockchain.get_latest_block().index,
            "chain_hash": blockchain.get_chain_fingerprint()["chain_hash"]
        }, indent=2))
        
    finally:
        db.close()

if __name__ == "__main__":
    run()
