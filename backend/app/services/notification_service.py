from app.utils.sms_service import send_sms
from app.models.sms_log import SmsLog
from app.database import SessionLocal

def build_message(transaction, block_index):
    if transaction.transaction_type == "CASH_TRANSFER":
        return f"""RationShield Alert:
Cash ₹{transaction.cash_amount}
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

def notify_citizen(transaction, beneficiary, block_index):
    db = SessionLocal()

    try:
        # Idempotency check
        existing = db.query(SmsLog).filter(
            SmsLog.transaction_id == transaction.id
        ).first()

        if existing:
            return

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
    except Exception as e:
        print(f"Notification service error: {e}")
        db.rollback()
    finally:
        db.close()
