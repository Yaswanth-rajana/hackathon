from app.utils.sms_service import send_sms
from app.models.sms_log import SmsLog
from app.models.notification import Notification
from app.database import SessionLocal
from sqlalchemy.orm import Session

def build_message(transaction, block_index):
    if transaction.transaction_type == "CASH_TRANSFER":
        cash_amount = getattr(transaction, "cash_collected", None)
        if cash_amount is None:
            cash_amount = 0
        return f"""RationShield Alert:
Cash ₹{cash_amount}
Txn:{transaction.id}
Block:{block_index}
1967"""
    else:
        # Get items safely - handle case where items might be a dict or object
        items = transaction.items if isinstance(transaction.items, dict) else {}
        wheat = items.get("wheat", 0)
        rice = items.get("rice", 0)
        sugar = items.get("sugar", 0)
        
        return f"""RationShield Alert:
W:{wheat} R:{rice} S:{sugar}
Txn:{transaction.id}
Block:{block_index}
1967"""

def create_distribution_notification(
    db: Session,
    beneficiary,
    items: dict,
    txn_id: str,
    block_index: int,
    shortfall: str = None,
    status: str = "sent"
):
    message = (
        "RationShield Receipt:\n"
        f"Wheat: {items.get('wheat', 0)}kg\n"
        f"Rice: {items.get('rice', 0)}kg\n"
        f"Sugar: {items.get('sugar', 0)}kg\n"
        f"Txn ID: {txn_id}\n"
        f"Block: {block_index}"
    )

    if shortfall:
        message += f"\nShortfall: {shortfall}"

    message += "\nIf mismatch, file complaint in Citizen Portal."

    notification = Notification(
        district=beneficiary.district,
        type="DISTRIBUTION_RECEIPT",
        message=message,
        severity="info",
        payload={
            "ration_card": beneficiary.ration_card,
            "mobile": beneficiary.mobile,
            "channel": "sms",
            "status": status,
            "transaction_id": txn_id,
            "block_index": block_index,
            "items": items,
            "shortfall": shortfall
        }
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification

def notify_citizen(transaction, beneficiary, block_index):
    db = SessionLocal()

    try:
        # Idempotency check
        existing = db.query(SmsLog).filter(
            SmsLog.transaction_id == transaction.id
        ).first()

        if existing:
            return existing.status or "sent"

        message = build_message(transaction, block_index)

        result = send_sms(beneficiary.mobile, message)

        status = "sent"
        if isinstance(result, dict):
            if result.get("return") is False or "error" in str(result) or result.get("status") == "error":
                status = "failed"
            elif result.get("status") == "disabled":
                status = "disabled"
        elif "error" in str(result):
            status = "failed"

        log = SmsLog(
            transaction_id=transaction.id,
            ration_card=beneficiary.ration_card,
            mobile=beneficiary.mobile,
            message=message,
            status=status,
            provider_response=str(result)
        )

        db.add(log)
        db.commit()
        return status
    except Exception as e:
        print(f"Notification service error: {e}")
        db.rollback()
        return "failed"
    finally:
        db.close()
