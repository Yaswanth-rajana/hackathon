import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime

from app.models.monthly_analytics import MonthlyAnalytics
from app.models.risk_score import RiskScore
from app.models.shop import Shop

logger = logging.getLogger(__name__)

class AnalyticsAggregator:
    
    @staticmethod
    def _get_month_str(dt: datetime = None) -> str:
        if not dt:
            dt = datetime.now()
        return dt.strftime('%Y-%m')

    @staticmethod
    def _upsert_base_metrics(db: Session, district: str, month: str, 
                           fraud_inc: int = 0, 
                           complaint_inc: int = 0, 
                           resolved_inc: int = 0):
        """
        Upserts the count metrics safely.
        Requires PostgreSQL ON CONFLICT for true atomicity.
        """
        stmt = insert(MonthlyAnalytics).values(
            district=district,
            month=month,
            fraud_count=fraud_inc,
            complaint_count=complaint_inc,
            resolved_count=resolved_inc,
            avg_risk_score=0.0
        ).on_conflict_do_update(
            index_elements=['district', 'month'],
            set_={
                'fraud_count': MonthlyAnalytics.fraud_count + fraud_inc,
                'complaint_count': MonthlyAnalytics.complaint_count + complaint_inc,
                'resolved_count': MonthlyAnalytics.resolved_count + resolved_inc,
                'updated_at': func.now()
            }
        )
        db.execute(stmt)
        db.commit()

    @staticmethod
    def record_anomaly(db: Session, shop_id: str):
        """Increment fraud count when a new anomaly is detected."""
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if shop:
            AnalyticsAggregator._upsert_base_metrics(db, shop.district, AnalyticsAggregator._get_month_str(), fraud_inc=1)

    @staticmethod
    def record_complaint(db: Session, district: str):
        """Increment complaint count when a new citizen complaint is lodged."""
        AnalyticsAggregator._upsert_base_metrics(db, district, AnalyticsAggregator._get_month_str(), complaint_inc=1)

    @staticmethod
    def record_complaint_resolution(db: Session, district: str):
        """Increment resolved complaint count when a complaint is resolved."""
        AnalyticsAggregator._upsert_base_metrics(db, district, AnalyticsAggregator._get_month_str(), resolved_inc=1)

    @staticmethod
    def update_monthly_risk_average(db: Session, district: str, month: str = None):
        """
        Recalculates and updates the average risk score for a district/month.
        Called typically when a batch risk assessment runs.
        """
        if not month:
            month = AnalyticsAggregator._get_month_str()
            
        avg_score = db.query(func.avg(RiskScore.risk_score)).join(
            Shop, RiskScore.shop_id == Shop.id
        ).filter(
            Shop.district == district,
            RiskScore.month == month
        ).scalar() or 0.0
        
        # Ensure row exists first
        AnalyticsAggregator._upsert_base_metrics(db, district, month)
        
        # Then update with the exact average
        db.query(MonthlyAnalytics).filter(
            MonthlyAnalytics.district == district,
            MonthlyAnalytics.month == month
        ).update({"avg_risk_score": float(avg_score)})
        db.commit()
