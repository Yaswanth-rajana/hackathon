from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from fastapi_cache.decorator import cache

from app.database import get_db
from app.services.analytics_service import AnalyticsService
from app.core.rate_limiter import limiter
from app.schemas.analytics_schema import (
    FraudDistributionResponse,
    MonthlyTrendResponse,
    MandalComplianceResponse,
    ResolutionMetricsResponse,
    AnomalyTrendResponse
)
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

# Helper function to generate cache keys
def custom_key_builder(func, namespace: str = "", request=None, response=None, *args, **kwargs):
    """
    Builds a custom cache key analytics:{district}:{from}:{to} to ensure
    caching is strictly scoped.
    """
    kwargs_dict = kwargs.get("kwargs", {})
    district = kwargs_dict.get("district", "all")
    from_date = kwargs_dict.get("from_date", "any")
    to_date = kwargs_dict.get("to_date", "any")
    
    if isinstance(from_date, datetime):
        from_date = from_date.strftime("%Y-%m-%d")
    if isinstance(to_date, datetime):
        to_date = to_date.strftime("%Y-%m-%d")
        
    return f"v2:{namespace}:{func.__name__}:{district}:{from_date}:{to_date}"

@router.get("/fraud-distribution", response_model=FraudDistributionResponse)
@limiter.limit("20/minute")
@cache(expire=300, namespace="analytics", key_builder=custom_key_builder)
def get_fraud_distribution(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    from_date: Optional[datetime] = Query(None, description="Start date filter"),
    to_date: Optional[datetime] = Query(None, description="End date filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return AnalyticsService.get_fraud_distribution(db, district, from_date, to_date)

@router.get("/monthly-trend", response_model=MonthlyTrendResponse)
@limiter.limit("20/minute")
@cache(expire=300, namespace="analytics", key_builder=custom_key_builder)
def get_monthly_trend(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return AnalyticsService.get_monthly_trend(db, district)

@router.get("/compliance-by-mandal", response_model=MandalComplianceResponse)
@limiter.limit("20/minute")
@cache(expire=300, namespace="analytics", key_builder=custom_key_builder)
def get_compliance_scores(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return AnalyticsService.get_compliance_by_mandal(db, district)

@router.get("/resolution-metrics", response_model=ResolutionMetricsResponse)
@limiter.limit("20/minute")
@cache(expire=300, namespace="analytics", key_builder=custom_key_builder)
def get_resolution_metrics(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return AnalyticsService.get_resolution_metrics(db, district)

@router.get("/anomaly-trend", response_model=AnomalyTrendResponse)
@limiter.limit("20/minute")
@cache(expire=300, namespace="analytics", key_builder=custom_key_builder)
def get_anomaly_trend(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    days: int = Query(30, description="Time window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return AnalyticsService.get_anomaly_trend(db, district, days)
