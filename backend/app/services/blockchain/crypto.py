import os
import json
import base64
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

KEYS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../keys")
os.makedirs(KEYS_DIR, exist_ok=True)

ROLE_PUBLIC_KEYS = {}
ROLE_PRIVATE_KEYS = {}

def generate_key_pair():
    """Generates an RSA private and public key pair."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key

def load_or_generate_key(role: str):
    """Loads a key pair from disk or generates one if it doesn't exist."""
    priv_path = os.path.join(KEYS_DIR, f"{role}_private.pem")
    pub_path = os.path.join(KEYS_DIR, f"{role}_public.pem")

    if os.path.exists(priv_path) and os.path.exists(pub_path):
        with open(priv_path, "rb") as f:
            private_key = serialization.load_pem_private_key(
                f.read(),
                password=None,
            )
        with open(pub_path, "rb") as f:
            public_key = serialization.load_pem_public_key(
                f.read()
            )
    else:
        private_key, public_key = generate_key_pair()
        
        with open(priv_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
            
        with open(pub_path, "wb") as f:
            f.write(public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))
            
    return private_key, public_key

def initialize_keys():
    """Ensure all required system keys exist and are loaded into memory."""
    roles = ["ADMIN", "DEALER", "AI_SYSTEM", "CITIZEN", "NODE_1", "NODE_2"]
    for role in roles:
        priv, pub = load_or_generate_key(role)
        ROLE_PRIVATE_KEYS[role] = priv
        ROLE_PUBLIC_KEYS[role] = pub

def get_signer_fingerprint(public_key) -> str:
    """Returns SHA256 fingerprint of the public key bytes."""
    import hashlib
    pub_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return hashlib.sha256(pub_bytes).hexdigest()

def canonicalize_payload(payload: dict) -> dict:
    """Removes non-canonical signature fields ensuring strict JSON hashing consistency."""
    payload_copy = dict(payload)
    # Transaction specific
    payload_copy.pop("signature", None)
    payload_copy.pop("signed_by", None)
    payload_copy.pop("signature_algorithm", None)
    payload_copy.pop("signer_key_fingerprint", None)
    
    # Block specific exclusions preventing recursive signing failure
    payload_copy.pop("validator_signatures", None)
    payload_copy.pop("block_signature", None)
    payload_copy.pop("block_signed_by", None)
    return payload_copy

def sign_payload(payload: dict, role: str) -> str:
    """Signs a deterministic JSON representation of the currently canonical payload."""
    if role not in ROLE_PRIVATE_KEYS:
        priv, pub = load_or_generate_key(role)
        ROLE_PRIVATE_KEYS[role] = priv
        ROLE_PUBLIC_KEYS[role] = pub

    private_key = ROLE_PRIVATE_KEYS[role]
    canonical = canonicalize_payload(payload)
    
    # Deterministic canonical serialization ensuring timestamp was pre-set
    payload_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    
    signature = private_key.sign(
        payload_json.encode("utf-8"),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    
    return base64.b64encode(signature).decode("utf-8")

def sign_transaction(payload: dict, role: str) -> None:
    """Mutates payload directly attaching full cryptographic evidence."""
    signature = sign_payload(payload, role)
    pub_key = ROLE_PUBLIC_KEYS[role]
    
    payload["signed_by"] = role
    payload["signature"] = signature
    payload["signature_algorithm"] = "RSA-PSS-SHA256"
    payload["signer_key_fingerprint"] = get_signer_fingerprint(pub_key)

def sign_block_header(block_header: dict, role: str) -> dict:
    """Returns the cryptographic proof dictionary to be appended to validator_signatures."""
    signature = sign_payload(block_header, role)
    pub_key = ROLE_PUBLIC_KEYS[role]
    return {
        "signed_by": role,
        "signature": signature,
        "signature_algorithm": "RSA-PSS-SHA256",
        "signer_key_fingerprint": get_signer_fingerprint(pub_key)
    }

def verify_signature_dict(payload: dict, sig_proof: dict) -> bool:
    """Verifies any signature matching against explicitly signed identities and algorithms."""
    signed_by = sig_proof.get("signed_by")
    signature_b64 = sig_proof.get("signature")
    
    if not signed_by or not signature_b64:
        return False
        
    if signed_by not in ROLE_PUBLIC_KEYS:
        return False
        
    public_key = ROLE_PUBLIC_KEYS[signed_by]
    
    # Optional strict check against fingerprint
    expected_fingerprint = get_signer_fingerprint(public_key)
    if sig_proof.get("signer_key_fingerprint") and sig_proof.get("signer_key_fingerprint") != expected_fingerprint:
        return False
        
    canonical = canonicalize_payload(payload)
    payload_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    
    try:
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            payload_json.encode("utf-8"),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return True
    except Exception:
        return False

def verify_signature(payload: dict, signature_b64: str, signed_by: str) -> bool:
    """Backwards compatibility proxy for flat arguments."""
    return verify_signature_dict(
        payload, 
        {"signature": signature_b64, "signed_by": signed_by, "signer_key_fingerprint": payload.get("signer_key_fingerprint")}
    )
