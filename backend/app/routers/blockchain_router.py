from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_admin
from app.services.blockchain.blockchain import blockchain
from app.models.blockchain_ledger import BlockchainLedger

router = APIRouter(
    prefix="/api/blockchain",
    tags=["Blockchain"],
    dependencies=[Depends(require_admin)],
)

class TransactionRequest(BaseModel):
    type: str
    message: str

@router.get("/blocks")
def get_blocks(db: Session = Depends(get_db), page: int = 1, limit: int = 10):
    """Return paginated blocks from the chain DB with enriched traces."""
    from app.models.transaction import Transaction as DBTransaction
    
    total_len = db.query(BlockchainLedger).count()
    
    rows = db.query(BlockchainLedger)\
             .order_by(BlockchainLedger.block_index.desc())\
             .offset((page - 1) * limit)\
             .limit(limit)\
             .all()
    
    data = []
    for r in rows:
        tx_data = []
        if r.transaction_id:
            db_tx = db.query(DBTransaction).filter(DBTransaction.id == r.transaction_id).first()
            if db_tx:
                tx_data.append({
                    "id": db_tx.id,
                    "type": db_tx.transaction_type,
                    "items": db_tx.items,
                    "timestamp": db_tx.timestamp.isoformat() if db_tx.timestamp else None
                })
            else:
                tx_data.append({"type": "TRACED", "id": r.transaction_id})

        data.append({
            "index": r.block_index,
            "hash": r.block_hash,
            "previous_hash": r.previous_hash,
            "timestamp": r.timestamp,
            "nonce": r.nonce,
            "validator": r.validator,
            "network": r.network,
            "mining_time": r.mining_time,
            "payload_hash": r.payload_hash,
            "transactions": tx_data
        })

    return {
        "data": data,
        "total": total_len,
        "page": page,
        "limit": limit
    }

@router.get("/block/{index}")
def get_block(index: int, db: Session = Depends(get_db)):
    """Retrieve a specific block by index from DB with full transaction payload."""
    from app.models.transaction import Transaction as DBTransaction
    
    r = db.query(BlockchainLedger).filter(BlockchainLedger.block_index == index).first()
    if not r:
        raise HTTPException(status_code=404, detail="Block not found")
        
    tx_data = []
    if r.transaction_id:
        db_tx = db.query(DBTransaction).filter(DBTransaction.id == r.transaction_id).first()
        if db_tx:
            tx_data.append({
                "id": db_tx.id,
                "type": db_tx.transaction_type,
                "items": db_tx.items,
                "timestamp": db_tx.timestamp.isoformat() if db_tx.timestamp else None
            })
        else:
            tx_data.append({"type": "TRACED", "id": r.transaction_id})
            
    return {
        "index": r.block_index,
        "hash": r.block_hash,
        "previous_hash": r.previous_hash,
        "timestamp": r.timestamp,
        "nonce": r.nonce,
        "validator": r.validator,
        "network": r.network,
        "mining_time": r.mining_time,
        "payload_hash": r.payload_hash,
        "transactions": tx_data
    }

@router.post("/mine")
def mine_block(db: Session = Depends(get_db)):
    """Mine pending transactions into a new block"""
    try:
        new_block = blockchain.mine_pending_transactions(db)
        return {
            "message": "New block mined",
            "block": new_block.to_dict()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/transaction")
def add_transaction(transaction: TransactionRequest):
    """Add a new transaction to the pending pool (in-memory for current node)"""
    blockchain.add_transaction(transaction.dict())
    return {"message": "Transaction added to pending pool"}

@router.get("/verify")
def verify_chain(db: Session = Depends(get_db)):
    """Verify entire chain integrity via stateless DB check"""
    is_valid = blockchain.is_chain_valid(db)
    if is_valid:
        return {"status": "VALID"}
    else:
        return {"status": "CORRUPTED"}

@router.get("/fingerprint")
def get_fingerprint(db: Session = Depends(get_db)):
    """Return the cumulative deterministic chain fingerprint from DB"""
    import hashlib
    rows = db.query(BlockchainLedger.block_hash).order_by(BlockchainLedger.block_index.asc()).all()
    all_hashes = "".join([r[0] for r in rows])
    chain_hash = hashlib.sha256(all_hashes.encode()).hexdigest()
    
    last_index = db.query(BlockchainLedger.block_index).order_by(BlockchainLedger.block_index.desc()).first()
    
    return {
        "latest_block": last_index[0] if last_index else 0,
        "chain_hash": chain_hash
    }

@router.get("/shop/{shop_id}")
def get_shop_transactions(shop_id: str, db: Session = Depends(get_db), limit: int = 50):
    """
    Search the Ledger for traces containing this shop_id.
    Note: We iterate the DB Ledger here.
    """
    # This specifically searches for transactions by shop_id in the DB.
    # In this stateless version, we should probably join Ledger with the Transactions table.
    from app.models.transaction import Transaction as DBTransaction
    
    results = db.query(DBTransaction).filter(DBTransaction.shop_id == shop_id)\
                .order_by(DBTransaction.timestamp.desc())\
                .limit(limit).all()
    
    data = []
    for tx in results:
        data.append({
            "block_index": tx.block_index,
            "block_hash": tx.block_hash,
            "transaction": {
                "id": tx.id,
                "type": tx.transaction_type,
                "items": tx.items,
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None
            }
        })
                
    return {"data": data, "shop_id": shop_id, "returned": len(data)}
