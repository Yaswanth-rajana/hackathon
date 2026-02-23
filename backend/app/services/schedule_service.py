import logging
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.scheduled_report import ScheduledReport
from app.schemas.report_schema import ScheduledReportCreate
from app.services.report_service import ReportService
# In a real app we'd use a real emailer
# from app.utils.email import send_email

logger = logging.getLogger(__name__)

from datetime import timedelta

class ScheduleService:
    @staticmethod
    def create_schedule(db: Session, schedule_in: ScheduledReportCreate) -> ScheduledReport:
        now = datetime.now(timezone.utc)
        
        db_schedule = ScheduledReport(
            district=schedule_in.district,
            report_type=schedule_in.report_type,
            frequency=schedule_in.frequency,
            recipient_email=schedule_in.recipient_email,
            format=schedule_in.format,
            next_run=now, # Run immediately once created, then schedule next
            last_run=None,
            is_active=True
        )
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
        return db_schedule

    @staticmethod
    def get_schedules(db: Session, district: Optional[str] = None) -> List[ScheduledReport]:
        query = db.query(ScheduledReport)
        if district:
            query = query.filter(ScheduledReport.district == district)
        return query.all()

    @staticmethod
    def delete_schedule(db: Session, schedule_id: int):
        db_schedule = db.query(ScheduledReport).filter(ScheduledReport.id == schedule_id).first()
        if db_schedule:
            db.delete(db_schedule)
            db.commit()
            return True
        return False

    @staticmethod
    def run_due_reports(db: Session):
        """
        Invoked by APScheduler.
        Finds reports where next_run <= now and is_active=True,
        generates the report, "emails" it, and updates next_run.
        """
        now = datetime.now(timezone.utc)
        due_reports = db.query(ScheduledReport).filter(
            ScheduledReport.is_active == True,
            ScheduledReport.next_run <= now
        ).all()
        
        for report in due_reports:
            logger.info(f"Generating scheduled report ID {report.id} ({report.report_type}) for {report.district}")
            try:
                # 1. Generate Report
                month_str = now.strftime("%Y-%m")
                buffer = None
                if report.report_type == 'monthly':
                    buffer = ReportService.generate_monthly_district_report(db, report.district, month_str)
                elif report.report_type == 'excel':
                    buffer = ReportService.export_analytics_excel(db, report.district)
                # Shop type left out for brevity in scheduled unless district = shop_id
                 
                if buffer:
                    # 2. Mock Email Sending
                    logger.info(f"📧 Mock sending report to {report.recipient_email} (Size: {len(buffer.getvalue())} bytes)")
                    
                # 3. Update next_run properly
                report.last_run = now
                if report.frequency == 'weekly':
                    report.next_run = now + timedelta(days=7)
                elif report.frequency == 'monthly':
                    report.next_run = now + timedelta(days=30)
                else:
                    report.next_run = now + timedelta(days=1)
                     
                db.commit()
            except Exception as e:
                logger.error(f"Failed to run scheduled report {report.id}: {e}")
                db.rollback()
