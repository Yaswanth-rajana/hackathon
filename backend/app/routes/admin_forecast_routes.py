from fastapi import APIRouter, Depends, Query, HTTPException, Request
import asyncio
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services.forecast_service import ForecastService
from app.core.rate_limiter import limiter
from app.core.thread_pool import SHARED_EXECUTOR
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/demand")
@limiter.limit("10/minute")
async def get_demand_forecast(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(SHARED_EXECUTOR, lambda: ForecastService.predict_demand(db, district))

@router.get("/risk")
@limiter.limit("10/minute")
async def get_fraud_risk_forecast(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
         raise HTTPException(status_code=403, detail="Not authorized")
         
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(SHARED_EXECUTOR, lambda: ForecastService.predict_fraud_risk(db, district))
