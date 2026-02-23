import json
import hashlib
from typing import List
from app.services.blockchain.block import Block
from app.services.blockchain.crypto import verify_signature_dict

def is_chain_valid(chain: List[Block], difficulty: int) -> bool:
    if not chain:
        return True

    for i in range(1, len(chain)):
        current = chain[i]
        previous = chain[i - 1]

        # 1. Index check
        if current.index != previous.index + 1:
            print(f"Failed at Index Check: {current.index} != {previous.index} + 1")
            return False

        # 2. Previous hash check
        if current.previous_hash != previous.hash:
            print(f"Failed at Previous Hash Check: {current.previous_hash} != {previous.hash}")
            return False

        # 3. Block header signatures check (Require at least 2 for simulated Multi-Sig Quorum)
        if not hasattr(current, 'validator_signatures') or len(current.validator_signatures) < 2:
            print(f"Failed at Validator Signatures: missing or < 2 sigs")
            return False
            
        header_dict = current.get_header_dict()
        for sig_proof in current.validator_signatures:
            if not verify_signature_dict(header_dict, sig_proof):
                print(f"Failed at Header Signature Verification for node {sig_proof.get('signed_by')}")
                return False

        # 4. Transaction signatures check (With Identity Gating)
        for tx in current.transactions:
            if not isinstance(tx, dict):
                continue
                
            signed_by = tx.get("signed_by")
            signature = tx.get("signature")
            
            if not signature or not signed_by:
                # Genesis or system-level exemptions might use no signature, but Phase 3 enforces
                # it for all new blocks. Genesis is index 0 anyway (skipped by range(1)).
                if tx.get("type") == "GENESIS":
                    continue
                print(f"Failed at Transaction Signatures: missing sig/signed_by")
                return False
                
            # Strict Transaction Role Binding Policy
            tx_type = tx.get("type")
            if tx_type == "DISTRIBUTION" and not signed_by.startswith("DEALER"):
                print(f"Failed at Strict Role Binding: {tx_type} mapped to {signed_by}")
                return False
            if tx_type == "ALLOCATION" and not signed_by.startswith("ADMIN"):
                print(f"Failed at Strict Role Binding: {tx_type} mapped to {signed_by}")
                return False
            if tx_type == "ML_ALERT" and not signed_by.startswith("AI_SYSTEM"):
                print(f"Failed at Strict Role Binding: {tx_type} mapped to {signed_by}")
                return False
            if tx_type == "COMPLAINT" and not signed_by.startswith("CITIZEN"):
                print(f"Failed at Strict Role Binding: {tx_type} mapped to {signed_by}")
                return False

            sig_proof = {
                "signed_by": signed_by,
                "signature": signature,
                "signature_algorithm": tx.get("signature_algorithm"),
                "signer_key_fingerprint": tx.get("signer_key_fingerprint")
            }
            if not verify_signature_dict(tx, sig_proof):
                print(f"Failed at verifying transaction signature for {tx_type}")
                return False

        # 5. Payload hash validation (Ensuring Canonical Payload Intrinsic Matches)
        tx_string = json.dumps(current.transactions, sort_keys=True)
        expected_payload_hash = hashlib.sha256(tx_string.encode()).hexdigest()
        if current.payload_hash != expected_payload_hash:
            print(f"Failed at Payload Hash validation")
            return False
            
        # Verify self-contained hash logic matches native block data canonical hashing
        if current.hash != current.calculate_hash():
            print(f"Failed at Self-Contained Hash calc matches")
            return False

        # 6. Proof of Work Difficulty validation
        if not current.hash.startswith("0" * difficulty):
            print(f"Failed at Proof of Work constraint")
            return False

    return True
