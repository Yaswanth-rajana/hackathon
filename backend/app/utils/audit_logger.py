from functools import wraps
from fastapi import Request
from sqlalchemy.orm import Session
from app.models.activity_log import ActivityLog
import logging
import asyncio

logger = logging.getLogger(__name__)

def audit_logger(action: str, target_type: str = "system"):
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                result = await func(*args, **kwargs)
                _log_action(action, target_type, result, kwargs)
                return result
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                result = func(*args, **kwargs)
                _log_action(action, target_type, result, kwargs)
                return result
            return sync_wrapper
    return decorator

def _log_action(action: str, target_type: str, result, kwargs):
    try:
        db: Session = kwargs.get("db")
        request: Request = kwargs.get("request")
        current_user = kwargs.get("current_user")
        
        if db and current_user:
            # We try to extract target_id from kwargs (e.g., id from path parameter)
            target_id = kwargs.get("id") or getattr(result, "id", None) or getattr(result, "shop_id", getattr(result, "complaint_id", "unknown"))
            ip_address = request.client.host if request and request.client else None
            
            # Using current_user.district, assume admin has district
            district = getattr(current_user, "district", "ALL")
            
            log_entry = ActivityLog(
                admin_id=current_user.id,
                action=action,
                target_type=target_type,
                target_id=str(target_id),
                district=district,
                ip_address=ip_address
            )
            db.add(log_entry)
            db.commit()
    except Exception as e:
        logger.error(f"Audit log failed silently: {e}")
        if 'db' in locals() and db:
            db.rollback()
