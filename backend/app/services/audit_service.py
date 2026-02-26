import logging
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.shop import Shop
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly
from app.services.ml.feature_extractor import extract_shop_features
from app.services.ml.model import predict
from app.services.blockchain.crypto import sign_transaction
from app.services.blockchain.blockchain import blockchain
from app.models.transaction import Transaction
from app.services.event_emitter import manager
import asyncio
import uuid

logger = logging.getLogger(__name__)

class AuditService:
    @staticmethod
    def run_shop_audit(db: Session, shop_id: str) -> dict:
        """
        Executes a controlled, explicit, deterministic audit of a shop.
        Simulation data IS included.
        """
        # STEP 1: Validate Shop
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            raise ValueError("Shop not found")

        # STEP 2: Feature Extraction (include simulated logic)
        features = extract_shop_features(
            db=db,
            shop_id=shop_id,
            include_simulated=True
        )

        # STEP 3: ML Scoring
        prediction = predict(features)
        score = prediction["risk_score"]

        # Deterministic severity mapping
        if score >= 85:
            severity = "critical"
        elif score >= 70:
            severity = "high"
        elif score >= 50:
            severity = "medium"
        else:
            severity = "low"

        current_month = datetime.now(timezone.utc).strftime("%Y-%m")

        # Top feature determination
        if features:
            deviations = {
                "ghost_ratio": abs(features.get("ghost_ratio", 1.0) - 1.0) * 100.0,
                "mismatch_ratio": abs(features.get("mismatch_ratio", 1.0) - 1.0) * 100.0,
                "night_ratio": features.get("night_ratio", 0.0) * 100.0,
                "weekend_ratio": features.get("weekend_ratio", 0.0) * 100.0,
                "complaint_rate": features.get("complaint_rate", 0.0),
                "consistency_score": abs(100.0 - features.get("consistency_score", 100.0))
            }
            top_feature = max(deviations, key=deviations.get)
        else:
            top_feature = "unknown"

        anomaly_created = False
        block_index = None
        block = None

        # STEP 7: Transaction Control wrapping steps 4, 5, 6
        try:
            # STEP 4: Risk Score Upsert (One row per shop per month)
            existing_score = db.query(RiskScore).filter(
                RiskScore.shop_id == shop_id,
                RiskScore.month == current_month
            ).first()

            if existing_score:
                existing_score.risk_score = score
                existing_score.risk_level = severity.upper()
                existing_score.fraud_type = top_feature
                existing_score.confidence = score / 100.0
                existing_score.calculated_at = datetime.now(timezone.utc)
            else:
                new_score = RiskScore(
                    shop_id=shop_id,
                    risk_score=score,
                    risk_level=severity.upper(),
                    fraud_type=top_feature,
                    confidence=score / 100.0,
                    month=current_month,
                    calculated_at=datetime.now(timezone.utc)
                )
                db.add(new_score)

            # STEP 5: Anomaly Handling (Idempotent)
            existing_anomaly = db.query(Anomaly).filter(
                Anomaly.shop_id == shop_id,
                Anomaly.is_resolved == False
            ).first()

            if severity in ["medium", "high", "critical"]:
                if existing_anomaly:
                    severity_changed = str(existing_anomaly.severity).lower() != str(severity).lower()
                    existing_anomaly.severity = severity.lower()
                    existing_anomaly.confidence = score
                    existing_anomaly.description = f"AI Audit flagged shop with risk score {score:.2f}"
                    if severity_changed:
                        anomaly_created = True  # Trigger blockchain for severity escalation
                else:
                    new_anomaly = Anomaly(
                        shop_id=shop_id,
                        anomaly_type=top_feature,
                        severity=severity,
                        description=f"AI Audit flagged shop with risk score {score:.2f}",
                        confidence=score,
                        is_resolved=False
                    )
                    db.add(new_anomaly)
                    db.flush()
                    existing_anomaly = new_anomaly
                    anomaly_created = True
            else:
                # If severity is low, resolve existing anomaly if any
                if existing_anomaly:
                    existing_anomaly.is_resolved = True

            # STEP 6: DB-side ML_ALERT Preparation (OUTSIDE the severity-low logic)
            if anomaly_created and severity in ["medium", "high", "critical"]:
                txn_id = f"txn-{uuid.uuid4().hex[:12]}"
                payload = {
                    "transaction_id": txn_id,
                    "type": "ML_ALERT",
                    "shop_id": shop_id,
                    "severity": severity,
                    "confidence": score,
                    "month_year": current_month
                }

                sign_transaction(payload, "AI_SYSTEM")
                blockchain.add_transaction(payload)
                
                # Simulate block generation
                block = blockchain.mine_pending_transactions(db, simulate=True)
                
                # Assign block mapping natively
                existing_anomaly.block_hash = block.hash
                existing_anomaly.block_index = block.index
                existing_anomaly.transaction_id = txn_id

                # Record in Transaction table for Dashboard visibility
                db_tx = Transaction(
                    id=txn_id,
                    block_index=block.index,
                    shop_id=shop_id,
                    ration_card="SYSTEM",
                    transaction_type="ML_ALERT",
                    items=payload,
                    block_hash=block.hash,
                    previous_hash=block.previous_hash,
                    timestamp=datetime.now(timezone.utc)
                )
                db.add(db_tx)

            db.commit()

            # Now we can safely commit the block to the SQL ledger.
            if block:
                blockchain.commit_block(db, block)
                block_index = block.index
                
        except Exception as e:
            db.rollback()
            # If transaction failed, discard the pending block changes to avoid chain desync.
            blockchain.discard_pending()
            
            # Check for concurrency (IntegrityError usually on RiskScore or Blockchain index)
            from sqlalchemy.exc import IntegrityError
            if isinstance(e, IntegrityError):
                # Fetch existing audit state to return to UI
                existing_score = db.query(RiskScore).filter(
                    RiskScore.shop_id == shop_id,
                    RiskScore.month == current_month
                ).first()
                
                if existing_score:
                    return {
                        "status": "concurrent",
                        "shop_id": shop_id,
                        "risk_score": round(existing_score.risk_score, 1),
                        "severity": str(existing_score.risk_level).lower(),
                        "message": "Concurrent audit detected. System preserved consistency.",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
            raise e

        # STEP 8: WebSocket Broadcast (AFTER COMMIT!)
        if anomaly_created and severity in ["medium", "high", "critical"]:
            ws_event = {
                "type": "NEW_ANOMALY",
                "event": "NEW_ANOMALY",  # Legacy support
                "entity_id": shop_id,
                "shop_id": shop_id,
                "district": shop.district,
                "severity": severity,
                "risk_score": score,
                "block_index": block_index
            }
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(manager.broadcast_ml_alert(ws_event))
            except RuntimeError:
                pass

        # STEP 9: Return Structured Response
        return {
            "status": "success",
            "shop_id": shop_id,
            "risk_score": round(score, 1),
            "severity": severity,
            "anomaly_created": anomaly_created,
            "block_index": block_index,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
