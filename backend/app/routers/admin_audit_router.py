from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_admin
from app.services.audit_service import AuditService
from app.utils.demo_guard import enforce_demo_mode

router = APIRouter()

@router.post("/run/{shop_id}")
def run_audit(
    shop_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    enforce_demo_mode(shop_id)
    try:
        return AuditService.run_shop_audit(db, shop_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
