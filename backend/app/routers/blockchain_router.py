from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel
from app.services.blockchain.blockchain import blockchain

router = APIRouter(
    prefix="/api/blockchain",
    tags=["Blockchain"],
)

class TransactionRequest(BaseModel):
    type: str
    message: str

@router.get("/blocks")
def get_blocks(page: int = 1, limit: int = 10):
    """Return paginated blocks from the chain."""
    total_len = len(blockchain.chain)
    
    start_idx = total_len - (page * limit)
    end_idx = total_len - ((page - 1) * limit)
    
    if end_idx <= 0:
        return {"data": [], "total": total_len}
        
    start_idx = max(0, start_idx)
    
    # Slice the chain, reverse it to show newest blocks first
    page_blocks = blockchain.chain[start_idx:end_idx]
    page_blocks.reverse()
    
    return {
        "data": [block.to_dict() for block in page_blocks],
        "total": total_len,
        "page": page,
        "limit": limit
    }

@router.post("/mine")
def mine_block():
    """Mine pending transactions into a new block"""
    try:
        new_block = blockchain.mine_pending_transactions()
        return {
            "message": "New block mined",
            "block": new_block.to_dict()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/transaction")
def add_transaction(transaction: TransactionRequest):
    """Add a new transaction to the pending pool"""
    blockchain.add_transaction(transaction.dict())
    return {"message": "Transaction added to pending pool"}

@router.get("/verify")
def verify_chain():
    """Verify entire chain integrity"""
    is_valid = blockchain.is_chain_valid()
    if is_valid:
        return {"status": "VALID"}
    else:
        return {"status": "CORRUPTED"}

@router.get("/fingerprint")
def get_fingerprint():
    """Return the cumulative deterministic chain fingerprint"""
    return blockchain.get_chain_fingerprint()

@router.get("/shop/{shop_id}")
def get_shop_transactions(shop_id: str, limit: int = 50):
    """
    Search the in-memory Blockchain explicitly for traces containing this shop_id.
    Guarantees pure Ledger filtering without touching DB layers.
    """
    results = []
    
    # Iterate backwards from newest
    for block in reversed(blockchain.chain):
        for txn in block.transactions:
            if isinstance(txn, dict) and txn.get("shop_id") == shop_id:
                results.append({
                    "block_index": block.index,
                    "block_hash": block.hash,
                    "mining_time": block.mining_time,
                    "transaction": txn
                })
                
                if len(results) >= limit:
                    break
        if len(results) >= limit:
            break
            
    return {"data": results, "shop_id": shop_id, "returned": len(results)}
