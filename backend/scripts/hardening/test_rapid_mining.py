import sys
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.services.blockchain.blockchain import Blockchain
from app.services.blockchain.crypto import initialize_keys

def run_test():
    print("Running Rapid Sequential Mining Test...")
    
    # Isolate test by creating a brand new in-memory blockchain instance
    bc = Blockchain()
    initialize_keys()
    
    # We will spam 50 concurrent transactions that attempt to mine immediately
    NUM_THREADS = 20
    
    def worker(thread_id):
        try:
            # We add uniquely identifiable txn
            txn_id = str(uuid.uuid4())
            bc.add_transaction({"thread": thread_id, "txn_id": txn_id})
            # Mine it natively
            bc.mine_pending_transactions()
            return True
        except ValueError as e:
            # Expected if pending pool was scooped by another faster thread
            if "No pending transactions" in str(e):
                return True
            print(f"Error in thread {thread_id}: {e}")
            return False
        except Exception as e:
            print(f"Error in thread {thread_id}: {e}")
            return False
            
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
        results = list(executor.map(worker, range(NUM_THREADS)))
        
    duration = time.time() - start_time
    
    assert all(results), "A thread failed during concurrent mining!"
    
    print(f"Mined all transactions in {duration:.2f} seconds.")
    
    # Validate sequential indices
    chain_length = len(bc.chain)
    indices = [b.index for b in bc.chain]
    
    print(f"Validating chain integrity (Length: {chain_length})...")
    
    assert indices == list(range(chain_length)), "Chain indices are non-sequential!"
    assert len(set(indices)) == chain_length, "Duplicate indices detected!"
    
    # Validate unique hashes
    hashes = [b.hash for b in bc.chain]
    assert len(set(hashes)) == chain_length, "Duplicate hashes detected!"
    
    print("✅ Rapid Sequential Mining Test Passed! Concurrency lock is sound.")

if __name__ == "__main__":
    run_test()
