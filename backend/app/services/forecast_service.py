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
    def predict_fraud_risk(db: Session, shop_id: str) -> Dict[str, Any]:
        """
        Calculates a 7-day risk forecast using EWMA on historical risk scores.
        """
        from app.models.risk_score import RiskScore
        import pandas as pd
        
        # 1. Fetch last 10 scores
        scores = db.query(RiskScore.risk_score, RiskScore.calculated_at)\
            .filter(RiskScore.shop_id == shop_id)\
            .order_by(RiskScore.calculated_at.asc())\
            .limit(10).all()
            
        if not scores:
            return {
                "current_risk": 0,
                "forecast": [],
                "status": "insufficient_data"
            }
            
        # 2. Convert to Series for EWMA
        df = pd.DataFrame(scores, columns=["risk_score", "calculated_at"])
        series = df["risk_score"]
        
        # 3. Calculate EWMA (span=3 for sensitivity)
        ewma = series.ewm(span=3).mean()
        last_ewma = ewma.iloc[-1]
        
        # 4. Project 7-day trend
        # We assume a slight upward trend (+5 penalty if anomalies exist)
        trend_factor = 5.0 if last_ewma > 50 else 2.0
        
        forecast = []
        current_date = datetime.now()
        for i in range(1, 8):
            projected = min(100.0, last_ewma + (trend_factor * (i / 7)))
            forecast.append({
                "day": (current_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "risk_score": round(projected, 1)
            })
            
        return {
            "shop_id": shop_id,
            "current_risk": round(float(series.iloc[-1]), 1),
            "predicted_risk_day_7": round(forecast[-1]["risk_score"], 1),
            "forecast": forecast,
            "confidence": 0.85,
            "audit_needed_probability": round(min(0.99, last_ewma / 100.0 + 0.1), 2)
        }

