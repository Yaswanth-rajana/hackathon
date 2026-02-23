from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.services.schedule_service import ScheduleService
from app.schemas.report_schema import ScheduledReportCreate, ScheduledReportResponse
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=ScheduledReportResponse)
def create_scheduled_report(
    schedule_in: ScheduledReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return ScheduleService.create_schedule(db, schedule_in)

@router.get("/", response_model=List[ScheduledReportResponse])
def get_scheduled_reports(
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return ScheduleService.get_schedules(db, district)

@router.delete("/{schedule_id}")
def delete_scheduled_report(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    success = ScheduleService.delete_schedule(db, schedule_id)
    if not success:
         raise HTTPException(status_code=404, detail="Schedule not found")
         
    return {"message": "Scheduled report deleted"}
