import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import collections

from app.models.transaction import Transaction
from app.models.shop import Shop
from app.models.anomaly import Anomaly

logger = logging.getLogger(__name__)

class ForecastService:
    @staticmethod
    def predict_demand(db: Session, district: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculates a 6-month moving average of transactions, grouped by month.
        Applies a basic 5% growth seasonal multiplier for the next month.
        Requires at least 3 months of baseline data to be reliable.
        """
        # Fetch last 6 months grouping
        six_months_ago = datetime.now() - timedelta(days=180)
        
        query = db.query(
            func.date_trunc('month', Transaction.timestamp).label('month'),
            func.count(Transaction.id).label('tx_count')
        ).filter(Transaction.timestamp >= six_months_ago)
        
        if district:
            query = query.join(Shop, Transaction.shop_id == Shop.id).filter(Shop.district == district)
            
        results = query.group_by('month').order_by('month').all()
        
        historical = [{"month": r.month.strftime('%Y-%m') if r.month else "Unknown", "demand": r.tx_count} for r in results]
        
        if len(historical) < 3:
            return {
                "status": "insufficient_data",
                "message": "Need at least 3 months of historical data to accurately forecast demand.",
                "historical": historical,
                "forecast": []
            }
            
        # Basic Moving Average Forecast
        avg_demand = sum([h['demand'] for h in historical]) / len(historical)
        
        import math
        
        # Calculate Coefficient of Variation (CV) for confidence scoring
        variance = sum((h['demand'] - avg_demand) ** 2 for h in historical) / len(historical)
        std_dev = math.sqrt(variance)
        cv = std_dev / avg_demand if avg_demand > 0 else 0.0
        
        # Base confidence 1.0
        confidence = 1.0
        
        # Penalize for limited history (max 6 months lookback used)
        if len(historical) < 6:
            confidence -= (6 - len(historical)) * 0.05
            
        # Penalize for high volatility
        confidence -= cv
        
        # Clamp confidence
        confidence = max(0.1, min(0.99, confidence))
        
        # Next 3 months projection with 5% compounding growth assumption
        forecast = []
        current_projection = avg_demand
        for i in range(1, 4):
            next_month = (datetime.now().replace(day=1) + timedelta(days=32 * i)).replace(day=1)
            current_projection *= 1.05 # 5% growth
            forecast.append({
                "month": next_month.strftime('%Y-%m'),
                "projected_demand": int(current_projection),
                "confidence": round(confidence, 2)
            })
            
        return {
            "status": "success",
            "historical": historical,
            "forecast": forecast,
            "trend_analysis": f"Projected avg {int(avg_demand)} baseline with 5% expected m/m growth. Forecast confidence: {round(confidence * 100)}%."
        }

    @staticmethod
    def predict_fraud_risk(db: Session, district: Optional[str] = None) -> Dict[str, Any]:
        """
        Extrapolates fraud risk growth from historical anomalies.
        Compares last 30 days vs previous 30 days.
        """
        now = datetime.now()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)
        
        # Current 30 days
        curr_query = db.query(Anomaly).filter(Anomaly.created_at >= thirty_days_ago)
        
        # Previous 30 days
        prev_query = db.query(Anomaly).filter(Anomaly.created_at >= sixty_days_ago, Anomaly.created_at < thirty_days_ago)
        
        if district:
             curr_query = curr_query.join(Shop, Anomaly.shop_id == Shop.id).filter(Shop.district == district)
             prev_query = prev_query.join(Shop, Anomaly.shop_id == Shop.id).filter(Shop.district == district)
             
        curr_count = curr_query.count()
        prev_count = prev_query.count()
        
        # Calculate Growth Rate
        if prev_count == 0:
             growth_rate = 1.0 if curr_count > 0 else 0.0 # 100% growth if prev was 0 and now we have some
        else:
             growth_rate = (curr_count - prev_count) / prev_count
             
        # Clamp Extreme Growth to 200% MAX for UI sanity
        growth_rate = min(growth_rate, 2.0)
        
        projected_next_30_days = int(curr_count * (1 + growth_rate))
        
        risk_level = "LOW"
        if growth_rate > 0.5:
             risk_level = "CRITICAL"
        elif growth_rate > 0.1:
             risk_level = "HIGH"
             
        return {
            "current_30_days": curr_count,
            "previous_30_days": prev_count,
            "growth_rate_percent": round(growth_rate * 100, 2),
            "projected_next_30_days": projected_next_30_days,
            "risk_assessment": risk_level
        }
