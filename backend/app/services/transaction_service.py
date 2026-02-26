import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.models.transaction import Transaction
from app.models.beneficiary import Beneficiary
from app.services import blockchain_service
from app.services import risk_service
from app.models.enums import TransactionType

logger = logging.getLogger(__name__)


def distribute(
    db: Session,
    current_user: User,
    ration_card: str,
    items: dict,
) -> dict:
    """Execute a ration distribution as an atomic blockchain transaction.

    Flow (strict order):
    1. Get current dealer
    2. Fetch beneficiary
    3. Enforce shop ownership
    4. Generate transaction_id
    5. Ensure genesis block exists
    6. Fetch last block
    7. block_index = last.block_index + 1
    8. previous_hash = last.block_hash
    9. Create payload
    10. Compute payload_hash
    11. block_hash = sha256(previous_hash + payload_hash)
    12. Insert into transactions
    13. Insert into blockchain_ledger
    14. Single commit
    """
    try:
        # --- 1-3: Validate dealer + beneficiary + ownership ---
        if not current_user.shop_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dealer has no shop assigned",
            )

        beneficiary = (
            db.query(Beneficiary)
            .filter(Beneficiary.ration_card == ration_card)
            .first()
        )
        if not beneficiary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Beneficiary with ration card '{ration_card}' not found",
            )

        if beneficiary.shop_id != current_user.shop_id:
            logger.warning(
                f"Dealer {current_user.id} attempted cross-shop distribution "
                f"for {ration_card} (dealer_shop={current_user.shop_id}, "
                f"beneficiary_shop={beneficiary.shop_id})"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: beneficiary does not belong to your shop",
            )

        # --- 4: Generate transaction ID ---
        transaction_id = f"txn-{uuid.uuid4()}"

        # --- 5: Ensure genesis block ---
        blockchain_service.ensure_genesis_block(db)

        # --- 6-8: Get last block, compute index + previous_hash ---
        last_block = blockchain_service.get_last_block(db)
        block_index = last_block.block_index + 1
        previous_hash = last_block.block_hash

        # --- 9: Build payload (deterministic) ---
        payload = {
            "transaction_id": transaction_id,
            "shop_id": current_user.shop_id,
            "ration_card": ration_card,
            "items": items,
            "transaction_type": TransactionType.DISTRIBUTION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # --- 10-11: Compute hashes via blockchain service ---
        block = blockchain_service.create_block(
            db=db,
            transaction_id=transaction_id,
            payload=payload,
            previous_hash=previous_hash,
            block_index=block_index,
        )

        # --- 12: Insert transaction record ---
        txn = Transaction(
            id=transaction_id,
            block_index=block_index,
            shop_id=current_user.shop_id,
            ration_card=ration_card,
            transaction_type=TransactionType.DISTRIBUTION,
            items=items,
            block_hash=block.block_hash,
            previous_hash=previous_hash,
        )
        db.add(txn)

        # --- 14: SINGLE COMMIT (atomic) ---
        db.commit()

        logger.info(
            f"Distribution complete: txn={transaction_id}, "
            f"block_index={block_index}, hash={block.block_hash[:16]}…"
        )

        # --- 15: Risk evaluation (fire-and-forget, post-commit) ---
        try:
            risk_service.evaluate_transaction(
                db=db,
                shop_id=current_user.shop_id,
                ration_card=ration_card,
                transaction_id=transaction_id,
            )
        except Exception as risk_err:
            logger.error(f"Risk evaluation error (non-fatal): {risk_err}", exc_info=True)

        return {
            "transaction_id": transaction_id,
            "block_index": block_index,
            "block_hash": block.block_hash,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Distribution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Distribution failed due to an internal error",
        )
