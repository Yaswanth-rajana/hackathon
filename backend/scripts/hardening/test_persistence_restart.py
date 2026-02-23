import sys
import os
import shutil

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

def run_test():
    print("Running Key Persistence and Restart Consistency Test...")
    
    # Clear out old test blockchain if exists
    if os.path.exists("blockchain_backup.json"):
        os.remove("blockchain_backup.json")
        
    from app.services.blockchain.blockchain import Blockchain
    from app.services.blockchain.crypto import ROLE_PUBLIC_KEYS, initialize_keys, get_signer_fingerprint
    
    # Initialize keys
    initialize_keys()
    
    # Instance 1
    bc1 = Blockchain()
    bc1.add_transaction({"test": "persistence1"})
    bc1.mine_pending_transactions()
    bc1.add_transaction({"test": "persistence2"})
    bc1.mine_pending_transactions()
    
    fp1 = bc1.get_chain_fingerprint()
    admin_pub_1 = get_signer_fingerprint(ROLE_PUBLIC_KEYS["ADMIN"])
    
    print(f"Pre-restart chain fingerprint: {fp1['chain_hash'][:10]}")
    print(f"Pre-restart ADMIN key fingerprint: {admin_pub_1[:10]}")
    
    # Simulate restart by destroying and recreating
    bc2 = Blockchain()
    
    # Re-initialize keys (would happen on startup)
    ROLE_PUBLIC_KEYS.clear()
    initialize_keys()
    
    fp2 = bc2.get_chain_fingerprint()
    admin_pub_2 = get_signer_fingerprint(ROLE_PUBLIC_KEYS["ADMIN"])
    
    print(f"Post-restart chain fingerprint: {fp2['chain_hash'][:10]}")
    print(f"Post-restart ADMIN key fingerprint: {admin_pub_2[:10]}")
    
    assert fp1 == fp2, "Chain fingerprint mismatch after restart!"
    assert admin_pub_1 == admin_pub_2, "Key fingerprint mismatch after restart!"
    
    print("✅ Persistence and Restart Consistency Test Passed!")

if __name__ == "__main__":
    run_test()
