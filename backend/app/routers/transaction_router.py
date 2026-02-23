from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.core.dependencies import require_role
from app.schemas.transaction_schema import DistributeRequest, DistributeResponse
from app.services import transaction_service

router = APIRouter(
    prefix="/api/transaction",
    tags=["Transaction"],
)


@router.post("/distribute", response_model=DistributeResponse)
def distribute_ration(
    payload: DistributeRequest,
    current_user: User = Depends(require_role(UserRole.dealer)),
    db: Session = Depends(get_db),
):
    """Distribute ration to a beneficiary.

    Creates a transaction record and a linked blockchain block.
    Protected: dealer role only.
    """
    result = transaction_service.distribute(
        db=db,
        current_user=current_user,
        ration_card=payload.ration_card,
        items=payload.items,
    )
    return DistributeResponse(**result)
