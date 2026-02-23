import sys
import os
import copy
import base64

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.services.blockchain.blockchain import Blockchain
from app.services.blockchain.crypto import initialize_keys, sign_transaction
from app.services.blockchain.validation import is_chain_valid

def run_test():
    print("Running Signature Hardening and Tampering Test...")
    
    if os.path.exists("blockchain_backup.json"):
        os.remove("blockchain_backup.json")
        
    # Initialize
    bc = Blockchain()
    initialize_keys()
    
    txn1 = {"type": "ALLOCATION", "test": "tamper1"}
    sign_transaction(txn1, "ADMIN")
    bc.add_transaction(txn1)
    block1 = bc.mine_pending_transactions()
    
    txn2 = {"type": "DISTRIBUTION", "test": "tamper2"}
    sign_transaction(txn2, "DEALER")
    bc.add_transaction(txn2)
    block2 = bc.mine_pending_transactions()
    
    assert is_chain_valid(bc.chain, bc.difficulty), "Base chain should be valid"
    
    # Test A: Swap signature from block 1 to block 2
    print("Testing Strategy A: Swap Signatures between blocks")
    chain_tampered_a = copy.deepcopy(bc.chain)
    chain_tampered_a[-1].validator_signatures = copy.deepcopy(chain_tampered_a[-2].validator_signatures)
    
    assert not is_chain_valid(chain_tampered_a, bc.difficulty), "Failed to detect swapped multi-sig signatures!"
    print("✅ Strategy A Blocked")
    
    # Test B: Wrong Role Injection
    print("Testing Strategy B: Wrong Role Signer")
    chain_tampered_b = copy.deepcopy(bc.chain)
    
    # Modify the block header signature to look like it came from ADMIN instead of NODE_1
    sig = chain_tampered_b[-1].validator_signatures[0]
    sig["signed_by"] = "ADMIN"
    
    assert not is_chain_valid(chain_tampered_b, bc.difficulty), "Failed to detect forged role!"
    print("✅ Strategy B Blocked")
    
    # Test C: Remove a multi-sig
    print("Testing Strategy C: Minimum Node Threshold (Remove one multi-sig)")
    chain_tampered_c = copy.deepcopy(bc.chain)
    chain_tampered_c[-1].validator_signatures.pop() # Remove one signature
    
    assert not is_chain_valid(chain_tampered_c, bc.difficulty), "Failed to detect missing consensus signature!"
    print("✅ Strategy C Blocked")
    
    # Final check
    assert is_chain_valid(bc.chain, bc.difficulty), "Original chain should remain unharmed"
    
    print("✅ Signature Tampering Simulation Complete.")

if __name__ == "__main__":
    run_test()
