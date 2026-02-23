import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.services.blockchain.blockchain import blockchain

def run_test():
    print("Running Simulate=True Safety Check...")
    
    # Initial state
    initial_length = len(blockchain.chain)
    initial_pending = len(blockchain.pending_transactions)
    
    # Add a mock transaction
    blockchain.add_transaction({"test": "data", "amount": 100})
    assert len(blockchain.pending_transactions) == initial_pending + 1
    
    # Simulate mining
    simulated_block = blockchain.mine_pending_transactions(simulate=True)
    
    # Validations
    print(f"Initial chain length: {initial_length}, Post-simulation: {len(blockchain.chain)}")
    assert len(blockchain.chain) == initial_length, "Simulation mutated the chain length!"
    
    print(f"Simulated block index: {simulated_block.index}, Latest block index: {blockchain.get_latest_block().index}")
    assert simulated_block.index == blockchain.get_latest_block().index + 1, "Simulation index is incorrect"
    
    assert len(blockchain.pending_transactions) == initial_pending + 1, "Simulation cleared pending transactions!"
    print("✅ Simulate=True Safety Check Passed!")

if __name__ == "__main__":
    run_test()
