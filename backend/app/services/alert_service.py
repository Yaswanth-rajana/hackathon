import logging
import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.services.event_emitter import manager

logger = logging.getLogger(__name__)

class AlertService:
    @staticmethod
    def create_alert(
        db: Session,
        severity: AlertSeverity,
        alert_type: str,
        district: str,
        entity_id: str,
        description: str,
        detected_by: str,
        block_index: Optional[int] = None,
        anomaly_id: Optional[int] = None
    ) -> Optional[Alert]:
        """
        Standardized Alert creation with duplicate prevention.
        Only creates alert if severity >= medium and no existing OPEN/INVESTIGATING alert
        exists for the same entity_id.
        """
        # 1. Enforcement: Only Medium+ or specific system alerts
        if severity not in [AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL]:
            logger.debug(f"Skipping alert creation for low severity: {severity}")
            return None

        # 2. Hardened Duplicate Prevention
        existing = db.query(Alert).filter(
            Alert.entity_id == entity_id,
            Alert.type == alert_type,
            Alert.status.in_([AlertStatus.OPEN, AlertStatus.INVESTIGATING])
        ).first()

        if existing:
            logger.info(f"Existing active alert {existing.id} found for {entity_id}. Skipping duplicate.")
            return existing

        # 3. Create Alert
        alert_id = f"ALR-{secrets.token_hex(3).upper()}" # e.g. ALR-1D2C3B -> shortened
        
        new_alert = Alert(
            id=alert_id,
            severity=severity,
            type=alert_type,
            district=district,
            entity_id=entity_id,
            description=description,
            detected_by=detected_by,
            block_index=block_index,
            anomaly_id=anomaly_id,
            status=AlertStatus.OPEN,
            created_at=datetime.now(timezone.utc)
        )

        db.add(new_alert)
        db.flush() # Ensure it's in DB before returning or emitting

        # 4. WebSocket Broadcast
        try:
            import asyncio
            payload = {
                "type": "NEW_ALERT",
                "alert_id": alert_id,
                "district": district,
                "severity": severity.value
            }
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast_ml_alert(payload)) # Reusing ml_alert broadcast for now or adding specific
        except Exception as e:
            logger.error(f"Failed to broadcast alert: {e}")

        logger.info(f"🚨 New Governance Alert created: {alert_id} for {entity_id}")
        return new_alert

    @staticmethod
    def get_alert_stats(db: Session, district: Optional[str] = None):
        from sqlalchemy import func
        query = db.query(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
        if district:
            query = query.filter(Alert.district == district)
        return dict(query.all())
