from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services.report_service import ReportService
from app.core.dependencies import get_current_user
from app.core.rate_limiter import limiter
from app.models.user import User
import asyncio
from app.core.thread_pool import SHARED_EXECUTOR

router = APIRouter()

# Memory Throttling: Max 3 concurrent report generations
REPORT_SEMAPHORE = asyncio.Semaphore(3)

@router.get("/monthly")
@limiter.limit("5/minute")
async def download_monthly_report(
    request: Request,
    district: str = Query(..., description="District name"),
    month: str = Query(..., description="Month (YYYY-MM)"),
    format: str = Query("pdf", description="Format (pdf)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if format.lower() != "pdf":
         raise HTTPException(status_code=400, detail="Only PDF format is supported for monthly report currently")
         
    try:
        async with REPORT_SEMAPHORE:
            loop = asyncio.get_event_loop()
            buffer = await loop.run_in_executor(
                SHARED_EXECUTOR, 
                lambda: ReportService.generate_monthly_district_report(db, district, month)
            )
        
        headers = {
            'Content-Disposition': f'attachment; filename="monthly_report_{district}_{month}.pdf"'
        }
        
        return StreamingResponse(
            iter([buffer.getvalue()]), 
            media_type="application/pdf", 
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shop/{shop_id}")
@limiter.limit("5/minute")
async def download_shop_report(
    request: Request,
    shop_id: str,
    month: str = Query(..., description="Month (YYYY-MM)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        async with REPORT_SEMAPHORE:
            loop = asyncio.get_event_loop()
            buffer = await loop.run_in_executor(
                SHARED_EXECUTOR,
                lambda: ReportService.generate_shop_performance_report(db, shop_id, month)
            )
        
        headers = {
            'Content-Disposition': f'attachment; filename="shop_audit_{shop_id}_{month}.pdf"'
        }
        
        return StreamingResponse(
            iter([buffer.getvalue()]), 
            media_type="application/pdf", 
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
@limiter.limit("5/minute")
async def download_analytics_excel(
    request: Request,
    district: Optional[str] = Query(None, description="Filter by district"),
    format: str = Query("excel", description="Format (excel)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
     if current_user.role != "admin":
         raise HTTPException(status_code=403, detail="Not authorized")
         
     if format.lower() != "excel":
         raise HTTPException(status_code=400, detail="Only Excel format is supported for analytics raw data")
         
     try:
         async with REPORT_SEMAPHORE:
             loop = asyncio.get_event_loop()
             buffer = await loop.run_in_executor(
                 SHARED_EXECUTOR,
                 lambda: ReportService.export_analytics_excel(db, district)
             )
         
         headers = {
             'Content-Disposition': f'attachment; filename="analytics_dump_{district or "all"}.xlsx"'
         }
         
         return StreamingResponse(
             iter([buffer.getvalue()]), 
             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
             headers=headers
         )
     except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))
