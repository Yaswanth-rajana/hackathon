import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.services.blockchain.blockchain import Blockchain
from app.services.blockchain.crypto import initialize_keys

def run_test():
    print("Running Performance Safety Check (20 Sequential Blocks)...")
    
    if os.path.exists("blockchain_backup.json"):
        os.remove("blockchain_backup.json")
        
    bc = Blockchain()
    initialize_keys()
    
    # Assert difficulty is locked to 2
    assert bc.difficulty == 2, f"Difficulty is not 2! Found: {bc.difficulty}"
    
    max_mining_time = 0
    
    for i in range(20):
        txn = {"type": "ALLOCATION", "test": f"perf{i}"}
        bc.add_transaction(txn)
        
        start = time.time()
        block = bc.mine_pending_transactions()
        duration = time.time() - start
        
        if duration > max_mining_time:
            max_mining_time = duration
            
        print(f"Block {block.index} mined in {duration:.4f}s")
        assert duration < 3.0, f"Mining time exceeded 3 seconds! Took {duration:.4f}s"
        
    print(f"\n✅ Performance check passed! Max mining time: {max_mining_time:.4f}s")

if __name__ == "__main__":
    run_test()
