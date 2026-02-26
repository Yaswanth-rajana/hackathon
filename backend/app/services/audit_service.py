import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.shop import Shop
from app.models.user import User, UserRole
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly
from app.services.ml.feature_extractor import extract_shop_features
from app.services.ml.model import predict
from app.services.blockchain.crypto import sign_transaction
from app.services.blockchain.blockchain import blockchain
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.services.event_emitter import manager
import asyncio
import uuid
import threading

logger = logging.getLogger(__name__)
audit_lock = threading.Lock()

class AuditService:
    @staticmethod
    def run_shop_audit(db: Session, shop_id: str) -> dict:
        """
        Executes a controlled, explicit, deterministic audit of a shop.
        Simulation data IS included.
        """
        from app.models.simulation import SimulationEvent

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
        score = prediction["risk_probability"]

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
        auto_enforced = False
        enforcement_block_index = None
        dealer = None
        public_proof_id = None
        
        # History & Delta Logic (exclude future-dated projections)
        now = datetime.now(timezone.utc)
        last_score_obj = db.query(RiskScore).filter(
            RiskScore.shop_id == shop_id,
            RiskScore.calculated_at <= now
        ).order_by(RiskScore.calculated_at.desc()).first()
        prev_score = last_score_obj.risk_score if last_score_obj else 30.0 # Default baseline
        delta = score - prev_score
        delta_text = f"+{delta:.1f}%" if delta > 0 else f"{delta:.1f}%"

        # Leakage Calculation
        latest_sim = db.query(SimulationEvent).filter(
            SimulationEvent.shop_id == shop_id,
            SimulationEvent.event_type == 'ghost_injection'
        ).order_by(SimulationEvent.executed_at.desc()).first()
        
        ghost_count = (latest_sim.event_details or {}).get('count', 0) if latest_sim else 0
        leakage_est = ghost_count * 1050 * 12 # ₹1050 avg entitlement * 12 months

        # STEP 7: Transaction Control wrapping steps 4, 5, 6
        with audit_lock:
            try:
                # STEP 4: Risk Score ALWAYS Append (History)
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
                shop.risk_score = score
                
                # STEP 4.b: Synthetic Future Points (T+1, T+3, T+7) for HIGH delta
                if delta > 10:
                    for days in [1, 3, 7]:
                        synthetic_score = min(100.0, score + (delta * (days/20.0))) # Credible data-driven projection
                        synthetic_point = RiskScore(
                            shop_id=shop_id,
                            risk_score=synthetic_score,
                            risk_level=severity.upper(),
                            fraud_type=f"projected_{top_feature}",
                            confidence=0.5, # Lower confidence for projection
                            month=current_month,
                            calculated_at=datetime.now(timezone.utc) + timedelta(days=days)
                        )
                        db.add(synthetic_point)

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
                        existing_anomaly.description = f"AI Audit flagged shop with risk score {score:.2f} (Delta: {delta_text})"
                        if severity_changed:
                            anomaly_created = True
                    else:
                        new_anomaly = Anomaly(
                            shop_id=shop_id,
                            anomaly_type=top_feature,
                            severity=severity,
                            description=f"AI Audit flagged shop with risk score {score:.2f} (Delta: {delta_text})",
                            confidence=score,
                            is_resolved=False
                        )
                        db.add(new_anomaly)
                        db.flush()
                        existing_anomaly = new_anomaly
                        anomaly_created = True
                else:
                    if existing_anomaly:
                        existing_anomaly.is_resolved = True

                # STEP 5.b: Autonomous enforcement thresholds
                stock_score = float(features.get("stock_score", 0.0) or 0.0)
                unresolved_critical_count = db.query(func.count(Anomaly.id)).filter(
                    Anomaly.shop_id == shop_id,
                    Anomaly.is_resolved == False,
                    func.lower(Anomaly.severity) == "critical"
                ).scalar() or 0

                enforcement_triggered = (
                    score >= 85.0 or
                    unresolved_critical_count >= 3 or
                    stock_score >= 80.0  # 40% mismatch threshold
                )

                enforcement_reason = None
                if score >= 85.0:
                    enforcement_reason = f"Risk score {score:.1f} exceeded 85 threshold"
                elif unresolved_critical_count >= 3:
                    enforcement_reason = f"{unresolved_critical_count} unresolved critical anomalies detected"
                elif stock_score >= 80.0:
                    mismatch_pct = round(stock_score / 2.0, 1)
                    enforcement_reason = f"Stock mismatch {mismatch_pct}% exceeded 40% threshold"

                if shop.dealer_id:
                    dealer = db.query(User).filter(User.id == shop.dealer_id).first()

                should_suspend_dealer = (
                    enforcement_triggered and
                    dealer is not None and
                    dealer.role == UserRole.dealer and
                    (dealer.is_active or (dealer.dealer_status or "").lower() != "suspended")
                )

                if should_suspend_dealer:
                    dealer.is_active = False
                    dealer.dealer_status = "suspended"
                    shop.status = "under_review"
                    shop.under_review_reason = enforcement_reason
                    auto_enforced = True

                # STEP 6: DB-side ML_ALERT Preparation
                if anomaly_created and severity in ["medium", "high", "critical"]:
                    txn_id = f"txn-{uuid.uuid4().hex[:12]}"
                    payload = {
                        "transaction_id": txn_id,
                        "type": "ML_ALERT",
                        "shop_id": shop_id,
                        "severity": severity,
                        "confidence": score,
                        "delta": delta_text,
                        "month_year": current_month
                    }

                    sign_transaction(payload, "AI_SYSTEM")
                    blockchain.add_transaction(payload)
                    block = blockchain.mine_pending_transactions(db, simulate=True)
                    
                    existing_anomaly.block_hash = block.hash
                    existing_anomaly.block_index = block.index
                    existing_anomaly.transaction_id = txn_id

                    db_tx = Transaction(
                        id=txn_id,
                        block_index=block.index,
                        shop_id=shop_id,
                        ration_card="SYSTEM",
                        transaction_type=TransactionType.ML_ALERT,
                        items=payload,
                        block_hash=block.hash,
                        previous_hash=block.previous_hash,
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(db_tx)

                if block:
                    blockchain.commit_block(db, block)
                    block_index = block.index

                # STEP 6.b: Immutable AUTO_ENFORCEMENT trail
                if auto_enforced:
                    enforce_txn_id = f"txn-{uuid.uuid4().hex[:12]}"
                    enforcement_payload = {
                        "transaction_id": enforce_txn_id,
                        "type": "AUTO_ENFORCEMENT",
                        "action": "DEALER_SUSPENDED",
                        "shop_id": shop_id,
                        "dealer_id": shop.dealer_id,
                        "reason": shop.under_review_reason,
                        "risk_score": round(score, 1),
                        "severity": severity,
                        "month_year": current_month,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }

                    sign_transaction(enforcement_payload, "AI_SYSTEM")
                    blockchain.add_transaction(enforcement_payload)
                    enforcement_block = blockchain.mine_pending_transactions(db, simulate=True)

                    db.add(Transaction(
                        id=enforce_txn_id,
                        block_index=enforcement_block.index,
                        shop_id=shop_id,
                        ration_card="SYSTEM",
                        transaction_type=TransactionType.ML_ALERT,
                        items=enforcement_payload,
                        block_hash=enforcement_block.hash,
                        previous_hash=enforcement_block.previous_hash,
                        timestamp=datetime.now(timezone.utc)
                    ))
                    blockchain.commit_block(db, enforcement_block)
                    enforcement_block_index = enforcement_block.index

                    # Public immutable proof record for transparency
                    from app.models.suspension_record import SuspensionRecord
                    public_proof_id = f"AUDIT-{datetime.now(timezone.utc):%Y-%m}-{shop_id}-{uuid.uuid4().hex[:6].upper()}"
                    db.add(SuspensionRecord(
                        public_id=public_proof_id,
                        shop_id=shop_id,
                        shop_name=shop.name,
                        dealer_id=shop.dealer_id,
                        risk_score_before=float(prev_score),
                        risk_score_after=float(score),
                        reason=shop.under_review_reason or "Auto-enforcement threshold triggered",
                        ai_factors={
                            "severity": severity,
                            "delta_percent": round(delta, 1),
                            "top_feature": top_feature,
                            "stock_score": round(float(features.get("stock_score", 0.0) or 0.0), 2),
                            "complaint_score": round(float(features.get("complaint_score", 0.0) or 0.0), 2),
                            "ghost_score": round(float(features.get("ghost_score", 0.0) or 0.0), 2),
                        },
                        enforcement_txn_id=enforce_txn_id,
                        enforcement_block_index=enforcement_block.index,
                        block_hash=enforcement_block.hash,
                        previous_hash=enforcement_block.previous_hash
                    ))
                
                db.commit()
                
            except Exception as e:
                db.rollback()
                blockchain.discard_pending()
                logger.error(f"Audit failure for shop {shop_id}: {str(e)}", exc_info=True)
                raise e

        # STEP 8: WebSocket Broadcast (Enriched for Final Round Impact)
        if severity in ["medium", "high", "critical"]:
            toast_msg = f"🚨 CRITICAL RISK ESCALATION: {delta_text}" if delta > 40 else f"⚠️ Risk Score Increased: {delta_text}"
            ws_event = {
                "type": "ML_ALERT",
                "event": "ML_ALERT",
                "shop_id": shop_id,
                "district": shop.district,
                "severity": severity,
                "previous_risk": round(prev_score, 1),
                "current_risk": round(score, 1),
                "delta": round(delta, 1),
                "delta_text": delta_text,
                "toast_message": toast_msg,
                "leakage_est": f"₹{leakage_est:,}",
                "anomaly_type": top_feature,
                "block_index": block_index,
                "auto_enforced": auto_enforced,
                "shop_status": shop.status,
                "public_proof_id": public_proof_id
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
            "delta": round(delta, 1),
            "anomaly_created": anomaly_created,
            "block_index": block_index,
            "auto_enforced": auto_enforced,
            "shop_status": shop.status,
            "dealer_status": (dealer.dealer_status if dealer else None),
            "enforcement_block_index": enforcement_block_index,
            "public_proof_id": public_proof_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
