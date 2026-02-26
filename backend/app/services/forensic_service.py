from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.simulation import SimulationEvent
from app.models.anomaly import Anomaly
from app.models.transaction import Transaction
from app.models.enums import TransactionType
from typing import List, Dict, Any
from datetime import datetime, timezone

class ForensicService:
    @staticmethod
    def get_shop_timeline(db: Session, shop_id: str) -> List[Dict[str, Any]]:
        """
        Returns a unified chronological timeline of simulation and detection events.
        """
        # 1. Fetch Simulation Events
        sim_events = db.query(SimulationEvent).filter(SimulationEvent.shop_id == shop_id).all()
        
        # 2. Fetch Anomalies
        anomalies = db.query(Anomaly).filter(Anomaly.shop_id == shop_id).all()
        
        # 3. Fetch Blockchain Alerts from Transaction table
        alerts = db.query(Transaction).filter(
            Transaction.shop_id == shop_id,
            Transaction.transaction_type == TransactionType.ML_ALERT
        ).all()
        
        timeline = []
        
        for sim in sim_events:
            ts = sim.executed_at
            if ts and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            timeline.append({
                "id": f"sim_{sim.id}",
                "type": "SIMULATION",
                "event": sim.event_type.replace("_", " ").title(),
                "details": sim.event_details,
                "timestamp": ts,
                "icon": "zap",
                "color": "blue"
            })
            
        for anom in anomalies:
            ts = anom.created_at
            if ts and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            timeline.append({
                "id": f"anom_{anom.id}",
                "type": "DETECTION",
                "event": f"AI {anom.severity.upper()} Alert",
                "details": {"type": anom.anomaly_type, "description": anom.description},
                "timestamp": ts,
                "icon": "shield_alert",
                "color": "red" if anom.severity == "critical" else "orange"
            })
            
        for alert in alerts:
            ts = alert.timestamp
            if ts and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            timeline.append({
                "id": f"bc_{alert.id}",
                "type": "BLOCKCHAIN",
                "event": "Proof of Fraud Recorded",
                "details": {"block": alert.block_index, "hash": alert.block_hash[:16] + "..."},
                "timestamp": ts,
                "icon": "link",
                "color": "green"
            })
            
        # Sort by timestamp descending (newest first)
        timeline.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return timeline

    @staticmethod
    def get_financial_impact(db: Session, shop_id: str) -> Dict[str, Any]:
        """
        Calculates cumulative leakage from ghost beneficiaries.
        """
        ghost_events = db.query(SimulationEvent).filter(
            SimulationEvent.shop_id == shop_id,
            SimulationEvent.event_type == 'ghost_injection'
        ).all()
        
        total_ghosts = sum([e.event_details.get('count', 0) for e in ghost_events])
        # Multiplier: ₹1050 (avg entitlement) * 12 months
        estimated_leakage = total_ghosts * 1050 * 12
        
        return {
            "shop_id": shop_id,
            "total_ghosts": total_ghosts,
            "estimated_leakage": estimated_leakage,
            "currency": "INR"
        }
