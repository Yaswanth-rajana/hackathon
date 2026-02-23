import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from sqlalchemy.orm import with_polymorphic
from app.models.user import User
from app.models.transaction import Transaction
from app.models.beneficiary import Beneficiary
from app.models.shop import Shop
from app.models.idempotency import IdempotencyKey
from app.models.activity_log import ActivityLog
from app.services import blockchain_service
from app.services import risk_service
from app.services.dealer_entitlement_service import get_current_entitlement, get_already_received
from app.services.event_emitter import manager
from app.services.blockchain.blockchain import blockchain
from app.services.blockchain.crypto import sign_transaction
import hashlib

logger = logging.getLogger(__name__)


def distribute_ration(db: Session, dealer: User, request_data: dict, idempotency_key: str = None, client_ip: str = "0.0.0.0") -> dict:
    ration_card = request_data.get("ration_card")
    wheat_req = float(request_data.get("wheat", 0))
    rice_req = float(request_data.get("rice", 0))
    sugar_req = float(request_data.get("sugar", 0))

    if wheat_req < 0 or rice_req < 0 or sugar_req < 0:
        raise HTTPException(
            status_code=400, detail="Quantities cannot be negative")

    if wheat_req == 0 and rice_req == 0 and sugar_req == 0:
        raise HTTPException(
            status_code=400, detail="Cannot distribute zero quantity")

    transaction_id = None
    block_index = -1
    block_hash = "0x0"

    # Close any implicit transaction started by FastAPI auth dependencies
    if db.in_transaction():
        db.commit()

    # Idempotency Check (Pre-Transaction)
    if idempotency_key:
        one_min_ago = datetime.utcnow() - timedelta(minutes=1)
        existing_key = db.query(IdempotencyKey).filter(
            IdempotencyKey.key == idempotency_key,
            IdempotencyKey.created_at >= one_min_ago
        ).first()
        if existing_key:
            raise HTTPException(
                status_code=409, detail="Duplicate request detected (Idempotency)")

        # Save idempotency key immediately (auto-commits via its own short session)
        new_key = IdempotencyKey(key=idempotency_key)
        db.add(new_key)
        db.commit()

    try:
        with db.begin():
            # Step 1: Validate Dealer Ownership & Beneficiary Status
            beneficiary = db.query(Beneficiary).filter(Beneficiary.ration_card == ration_card).first()
            if not beneficiary:
                raise HTTPException(status_code=404, detail="Beneficiary not found")

            if beneficiary.account_status != "active":
                raise HTTPException(status_code=400, detail="Beneficiary account is not active")

            if beneficiary.shop_id != dealer.shop_id:
                logger.warning(f"Unauthorized beneficiary access attempt by {dealer.id}")
                raise HTTPException(status_code=403, detail="Unauthorized beneficiary")

            if dealer.dealer_status != "active":
                raise HTTPException(status_code=403, detail="Dealer account is suspended")

            # Step 2: Fetch Entitlement
            current_month = datetime.utcnow().strftime("%Y-%m")
            entitlement = get_current_entitlement(db, ration_card, current_month)

            # Step 3: Calculate Already Received
            received = get_already_received(db, ration_card, current_month)
        
            # Step 4: Validate Entitlement Limit
            if wheat_req > (entitlement.wheat - received["wheat"]):
                _log_audit(db, dealer.id, dealer.shop_id, "Failed Entitlement Attempt", {"ration_card": ration_card, "reason": "Exceeds wheat entitlement", "requested": wheat_req}, client_ip)
                raise HTTPException(status_code=400, detail="Exceeds wheat entitlement")
            if rice_req > (entitlement.rice - received["rice"]):
                _log_audit(db, dealer.id, dealer.shop_id, "Failed Entitlement Attempt", {"ration_card": ration_card, "reason": "Exceeds rice entitlement", "requested": rice_req}, client_ip)
                raise HTTPException(status_code=400, detail="Exceeds rice entitlement")
            if sugar_req > (entitlement.sugar - received["sugar"]):
                _log_audit(db, dealer.id, dealer.shop_id, "Failed Entitlement Attempt", {"ration_card": ration_card, "reason": "Exceeds sugar entitlement", "requested": sugar_req}, client_ip)
                raise HTTPException(status_code=400, detail="Exceeds sugar entitlement")

            # Step 5: Lock & Validate Stock (Race condition prevention)
            shop = db.query(Shop).with_for_update().filter(Shop.id == dealer.shop_id).first()
            if not shop:
                raise HTTPException(status_code=404, detail="Shop not found")
                
            if shop.stock_wheat < wheat_req:
                _log_audit(db, dealer.id, dealer.shop_id, "Failed Stock Attempt", {"item": "wheat", "required": wheat_req, "available": shop.stock_wheat}, client_ip)
                raise HTTPException(status_code=400, detail="Insufficient wheat stock")
            if shop.stock_rice < rice_req:
                _log_audit(db, dealer.id, dealer.shop_id, "Failed Stock Attempt", {"item": "rice", "required": rice_req, "available": shop.stock_rice}, client_ip)
                raise HTTPException(status_code=400, detail="Insufficient rice stock")
            if shop.stock_sugar < sugar_req:
                _log_audit(db, dealer.id, dealer.shop_id, "Failed Stock Attempt", {"item": "sugar", "required": sugar_req, "available": shop.stock_sugar}, client_ip)
                raise HTTPException(status_code=400, detail="Insufficient sugar stock")

            # Step 6: Generate Transaction ID
            transaction_id = f"txn-{uuid.uuid4().hex[:12]}"
            
            # Check duplicate transaction ID
            if db.query(Transaction).filter(Transaction.id == transaction_id).first():
                raise HTTPException(status_code=500, detail="Transaction ID collision")

            # Step 7: Blockchain Block Creation
            blockchain_service.ensure_genesis_block(db)
            
            # Privacy mapping the ration card
            masked_card = ration_card[:4] + "****" + ration_card[-4:]
            
            timestamp_val = datetime.utcnow()
            
            payload_dict = {
                "type": "DISTRIBUTION",
                "transaction_id": transaction_id,
                "shop_id": shop.id,
                "ration_card": masked_card,
                "items": {"wheat": wheat_req, "rice": rice_req, "sugar": sugar_req},
                "otp_verified": True,
                "timestamp": timestamp_val.isoformat()
            }
            
            sign_transaction(payload_dict, "DEALER")
            
            # Stage 1: Load payload and simulate mining to compute exact hash without appending
            blockchain.add_transaction(payload_dict)
            block = blockchain.mine_pending_transactions(simulate=True)
            block_index = block.index
            block_hash = block.hash
            previous_hash = block.previous_hash

            # Insert Transaction
            txn = Transaction(
                id=transaction_id,
                block_index=block_index,
                shop_id=shop.id,
                ration_card=ration_card,
                transaction_type="distribution",
                items={"wheat": wheat_req, "rice": rice_req, "sugar": sugar_req},
                otp_verified=True,
                cash_collected=request_data.get("cash_collected", 0.0),
                payment_mode=request_data.get("payment_mode", "free"),
                timestamp=timestamp_val,
                block_hash=block_hash,
                previous_hash=previous_hash
            )
            db.add(txn)

            # Step 9: Deduct Stock
            shop.stock_wheat -= wheat_req
            shop.stock_rice -= rice_req
            shop.stock_sugar -= sugar_req
            
            # Step 9b: Log Successful Distribution Audit
            _log_audit(db, dealer.id, dealer.shop_id, "Distribution Attempt", {
                "status": "Success",
                "transaction_id": transaction_id, 
                "ration_card": ration_card,
                "items": {"wheat": wheat_req, "rice": rice_req, "sugar": sugar_req},
                "cash_collected": request_data.get("cash_collected", 0),
                "payment_mode": request_data.get("payment_mode", "free")
            }, client_ip)

            # Stage 2: Commit block to memory only after SQL transaction successfully prepares
            blockchain.commit_block(block)

    except Exception as e:
        # Step 11: Transaction Failure Handler
        blockchain.discard_pending()
        logger.error(f"Transaction aborted, discarding generated blockchain state: {e}")
        raise e

    # Step 12: Post Commit Async Integrations
    # Step 11a: Risk Evaluation
    try:
        # Create a new session for post-commit tasks to avoid transaction scope issues
        with Session(db.get_bind()) as post_db:
            risk_service.evaluate_transaction(
                db=post_db,
                shop_id=dealer.shop_id,
                ration_card=ration_card,
                transaction_id=transaction_id
            )
    except Exception as e:
        logger.error(f"Risk evaluation failed post-commit: {e}")
        
    # Step 11b: Broadcast to Admin
    import asyncio
    try:
        if shop.mandal: # Ensure district/mandal mapping
            # Assuming broadcast to district matching shop.district
            asyncio.create_task(manager.broadcast_to_district(shop.district, {
                "type": "new_transaction",
                "shop_id": shop.id,
                "transaction_id": transaction_id,
                "block_index": block_index
            }))
    except Exception as e:
        logger.error(f"WebSocket broadcast failed: {e}")

    return {
        "message": "Distribution Successful",
        "transaction_id": transaction_id,
        "block_index": block_index,
        "block_hash": block_hash
    }

def _log_audit(db: Session, admin_id: str, target_id: str, action: str, metadata: dict, ip: str):
    """Helper to cleanly log audit events referencing ActivityLog for compatibility"""
    try:
        log = ActivityLog(
            admin_id=admin_id, # Can be reused for dealer_id safely since it maps to users.id
            action=action,
            target_type="distribution" if "Distribution" in action else "shop_stock_entitlement",
            target_id=target_id,
            metadata_info=metadata,
            ip_address=ip or "0.0.0.0"
        )
        db.add(log)
        # Flush occurs naturally if within a transaction, or auto-commits otherwise
    except Exception as e:
        logger.error(f"Failed to log audit activity: {e}")
