import sys
import os
import sqlite3

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.services.blockchain.blockchain import blockchain
from app.services.blockchain.crypto import initialize_keys
import contextlib

def simulate_distribution(fail_db=False, fail_mining=False):
    initial_chain_len = len(blockchain.chain)
    
    try:
        # 1. Setup DB transaction mock
        if fail_db:
            raise Exception("Artificial DB constraint violation")
            
        # 2. Add transaction to blockchain
        blockchain.add_transaction({"test": "atomicity"})
        
        # 3. Simulate mining
        if fail_mining:
            raise Exception("Artificial mining exception")
            
        block = blockchain.mine_pending_transactions(simulate=True)
        
        # 4. Commit DB mock (skipped if above failed)
        
        # 5. Commit block
        blockchain.commit_block(block)
        
    except Exception as e:
        print(f"Caught simulated error: {e}")
        # Rollback Blockchain Memory
        blockchain.discard_pending()
        
    # Assertions
    if fail_db:
        assert len(blockchain.pending_transactions) == 0, "Failed to discard pending transactions on DB fail!"
        assert len(blockchain.chain) == initial_chain_len, "Chain mutated during DB failure!"
        print("✅ DB Failure Rollback Passed")
        
    if fail_mining:
        assert len(blockchain.pending_transactions) == 0, "Failed to discard pending transactions on Mining fail!"
        assert len(blockchain.chain) == initial_chain_len, "Chain mutated during Mining failure!"
        print("✅ Mining Failure Rollback Passed")

def run_test():
    print("Running DB <-> Blockchain Atomicity Test...")
    initialize_keys()
    
    # 1. Force DB failure
    print("\n--- Testing DB Failure ---")
    simulate_distribution(fail_db=True)
    
    # 2. Force mining failure
    print("\n--- Testing Mining Failure ---")
    simulate_distribution(fail_mining=True)
    
    print("\n✅ Atomicity Testing Complete!")

if __name__ == "__main__":
    run_test()
