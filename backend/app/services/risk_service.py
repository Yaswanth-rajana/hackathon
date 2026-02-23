"""
Rule-based risk scoring engine.

Rules (Phase 1 — no ML):
  1. High Frequency     — shop performs >5 distributions in 10 minutes
  2. Repeated Partial   — same ration_card distributed to ≥3 times in 1 hour
     (Assumption: "partial" is not entitlement-checked yet; any repeat counts)
  3. Daily Spike        — today's shop txn count > 2× its 30-day daily average
"""

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.models.anomaly import Anomaly
from app.models.transaction import Transaction
import asyncio
from app.utils.cache import invalidate_analytics_cache
from app.services.analytics_aggregator import AnalyticsAggregator
from app.models.risk_score import RiskScore
from app.services.ml.risk_engine import evaluate_shop
from app.models.shop import Shop

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Thresholds (tuneable)
# ──────────────────────────────────────────────
HIGH_FREQ_WINDOW_MINUTES = 10
HIGH_FREQ_THRESHOLD = 5

REPEAT_WINDOW_MINUTES = 60
REPEAT_THRESHOLD = 3

DAILY_SPIKE_LOOKBACK_DAYS = 30
DAILY_SPIKE_MULTIPLIER = 2


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def evaluate_transaction(
    db: Session,
    shop_id: str,
    ration_card: str,
    transaction_id: str,
) -> list[dict]:
    """Run all risk rules against the context of a just-committed transaction.

    Returns a list of triggered anomaly dicts (for logging / testing).
    Failures are caught and logged — never propagated.
    """
    triggered: list[dict] = []

    try:
        triggered += _rule_high_frequency(db, shop_id, transaction_id)
        triggered += _rule_repeated_partial(db, shop_id, ration_card, transaction_id)
        triggered += _rule_daily_spike(db, shop_id, transaction_id)

        if triggered:
            db.commit()
            logger.warning(
                f"🚨 {len(triggered)} anomaly rule(s) triggered for shop={shop_id}, "
                f"txn={transaction_id}: {[t['anomaly_type'] for t in triggered]}"
            )
            for _ in triggered:
                AnalyticsAggregator.record_anomaly(db, shop_id)
            
            # Since an anomaly usually modifies risk score conceptually (or we can just update it safely)
            shop = db.query(Shop).filter(Shop.id == shop_id).first()
            if shop:
                AnalyticsAggregator.update_monthly_risk_average(db, shop.district)
            # Invalidate analytics cache
            try:
                # We need to run this async function in an event loop, but we might be in sync context.
                # Assuming this is called from an async route, but if not, we must create a task or run it safely.
                # A safer fire-and-forget in sync context (if FastAPI):
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(invalidate_analytics_cache())
                else:
                    loop.run_until_complete(invalidate_analytics_cache())
            except Exception as e:
                logger.error(f"Failed to trigger cache invalidation: {e}")
                
        else:
            logger.debug(f"✅ No anomalies for txn={transaction_id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Risk evaluation failed for txn={transaction_id}: {e}", exc_info=True)

    return triggered


def calculate_shop_risk(db: Session, shop_id: str) -> str:
    """Classify a shop's risk level based on UNRESOLVED anomaly count.

    Returns: "high" | "medium" | "low"
    """
    count = (
        db.query(func.count(Anomaly.id))
        .filter(Anomaly.shop_id == shop_id, Anomaly.is_resolved == False)  # noqa: E712
        .scalar()
    )
    if count >= 3:
        return "high"
    if count >= 1:
        return "medium"
    return "low"


def run_ai_audit(db: Session, shop_id: str) -> dict:
    """Orchestrates AI evaluation, persists score, and generates an anomaly if necessary."""
    
    # 1. Run ML evaluation outside txn block to keep transactions small and fast
    result = evaluate_shop(db, shop_id)
    
    # Close any implicit transaction started by feature extraction reads
    db.commit()
    
    anomaly_created = False
    
    if result["risk_level"] in ["HIGH", "CRITICAL"]:
        # 2. Build ML_ALERT payload
        from app.services.blockchain.crypto import sign_transaction
        
        ml_alert_payload = {
            "type": "ML_ALERT",
            "shop_id": shop_id,
            "risk_score": round(result["risk_score"], 4),
            "risk_level": result["risk_level"],
            "top_feature": result["top_feature"],
            "confidence": abs(round(result["anomaly_score"], 4)),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # 3. Sign payload
        sign_transaction(ml_alert_payload, "AI_SYSTEM")
        
        # 4. Simulate mining
        from app.services.blockchain.blockchain import blockchain
        blockchain.add_transaction(ml_alert_payload)
        block = blockchain.mine_pending_transactions(simulate=True)
        
        try:
            # 5. Persist securely within short txn block
            with db.begin():
                # Upsert RiskScore
                existing_score = db.query(RiskScore).filter(RiskScore.shop_id == shop_id).first()
                if existing_score:
                    existing_score.risk_score = result["risk_score"]
                    existing_score.risk_level = result["risk_level"]
                    existing_score.calculated_at = datetime.now(timezone.utc)
                else:
                    new_score = RiskScore(
                        shop_id=shop_id,
                        risk_score=result["risk_score"],
                        risk_level=result["risk_level"],
                        calculated_at=datetime.now(timezone.utc)
                    )
                    db.add(new_score)
                    
                # Insert Anomaly (WITHOUT block_hash/index yet)
                existing_anomaly = db.query(Anomaly).filter(
                    Anomaly.shop_id == shop_id,
                    Anomaly.is_resolved == False
                ).first()
                
                if not existing_anomaly:
                    anomaly = Anomaly(
                        shop_id=shop_id,
                        anomaly_type=result["top_feature"] or "unknown_ml_anomaly",
                        severity=result["risk_level"].lower(),
                        description=f"AI Audit flagged shop with risk score {result['risk_score']:.2f}",
                        confidence=abs(result["anomaly_score"]),
                        is_resolved=False
                    )
                    db.add(anomaly)
                    anomaly_created = True

            # DB Commit succeeds, now commit block
            blockchain.commit_block(block)
            
            # Now update anomaly with block reference
            if anomaly_created:
                db.query(Anomaly).filter(
                    Anomaly.shop_id == shop_id,
                    Anomaly.is_resolved == False,
                    Anomaly.block_hash == None
                ).update({
                    "block_hash": block.hash,
                    "block_index": block.index
                })
                db.commit()

            # 🔥 Broadcast WebSocket ML_ALERT event
            from app.services.event_emitter import manager
            import asyncio
            payload = {
                "event": "ML_ALERT",
                "shop_id": shop_id,
                "risk_score": result["risk_score"],
                "risk_level": result["risk_level"],
                "top_feature": result["top_feature"],
                "block_index": block.index,
                "block_hash": block.hash
            }
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(manager.broadcast_ml_alert(payload))
            except RuntimeError:
                pass # Skip cleanly if called entirely synchronously outside server (e.g., bare unit tests)

        except Exception as e:
            blockchain.discard_pending()
            raise e
            
    else:
        # LOW / MEDIUM risk
        with db.begin():
            existing_score = db.query(RiskScore).filter(RiskScore.shop_id == shop_id).first()
            if existing_score:
                existing_score.risk_score = result["risk_score"]
                existing_score.risk_level = result["risk_level"]
                existing_score.calculated_at = datetime.now(timezone.utc)
            else:
                new_score = RiskScore(
                    shop_id=shop_id,
                    risk_score=result["risk_score"],
                    risk_level=result["risk_level"],
                    calculated_at=datetime.now(timezone.utc)
                )
                db.add(new_score)

    return {
        "shop_id": shop_id,
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "anomaly_created": anomaly_created
    }


# ──────────────────────────────────────────────
# Internal Rules
# ──────────────────────────────────────────────

def _insert_anomaly(
    db: Session,
    shop_id: str,
    transaction_id: str,
    anomaly_type: str,
    severity: str,
    description: str,
    confidence: float,
) -> dict:
    """Helper: insert anomaly row natively registering it on immutable ML_ALERT blockchain index limitlessly binding audit traceability."""
    
    # 1. Prepare Blockchain Trace Object
    blockchain_payload = {
        "type": "ML_ALERT",
        "shop_id": shop_id,
        "transaction_id": transaction_id,
        "anomaly_type": anomaly_type,
        "severity": severity,
        "confidence_score": round(confidence, 4),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    from app.services.blockchain.crypto import sign_transaction
    sign_transaction(blockchain_payload, "AI_SYSTEM")
    
    from app.services.blockchain.blockchain import blockchain
    
    # Stage 1: Load payload and compute local simulated trace for database attachment
    blockchain.add_transaction(blockchain_payload)
    block = blockchain.mine_pending_transactions(simulate=True)
    
    try:
        # We assume _insert_anomaly caller envelops the outer commit transaction
        anomaly = Anomaly(
            shop_id=shop_id,
            transaction_id=transaction_id,
            anomaly_type=anomaly_type,
            severity=severity,
            description=description,
            confidence=confidence,
            block_index=block.index,
            block_hash=block.hash
        )
        db.add(anomaly)
        db.flush() # Secure native DB assignment safely
        
        blockchain.commit_block(block) # Stage 2: Finalize upon DB success bounds globally
        
    except Exception as e:
        logger.error(f"Blockchain integrity conflict logging anomaly: {e}")
        blockchain.discard_pending()
        raise e
        
    logger.info(f"📌 Anomaly mapped securely via Blockchain: type={anomaly_type}, severity={severity}, shop={shop_id}")
    return {
        "anomaly_type": anomaly_type,
        "severity": severity,
        "description": description,
        "confidence": confidence,
        "block_index": block.index,
        "block_hash": block.hash
    }


def _rule_high_frequency(db: Session, shop_id: str, transaction_id: str) -> list[dict]:
    """Rule 1 — Flag if shop has >5 transactions in the last 10 minutes."""
    window_start = datetime.now(timezone.utc) - timedelta(minutes=HIGH_FREQ_WINDOW_MINUTES)

    count = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.shop_id == shop_id,
            Transaction.timestamp >= window_start,
        )
        .scalar()
    )

    if count > HIGH_FREQ_THRESHOLD:
        return [_insert_anomaly(
            db, shop_id, transaction_id,
            anomaly_type="high_frequency",
            severity="high",
            description=(
                f"Shop {shop_id} performed {count} distributions in the last "
                f"{HIGH_FREQ_WINDOW_MINUTES} minutes (threshold: {HIGH_FREQ_THRESHOLD})"
            ),
            confidence=min(1.0, count / (HIGH_FREQ_THRESHOLD * 2)),
        )]
    return []


def _rule_repeated_partial(
    db: Session,
    shop_id: str,
    ration_card: str,
    transaction_id: str,
) -> list[dict]:
    """Rule 2 — Flag if same ration_card received ≥3 distributions in 1 hour."""
    window_start = datetime.now(timezone.utc) - timedelta(minutes=REPEAT_WINDOW_MINUTES)

    count = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.ration_card == ration_card,
            Transaction.shop_id == shop_id,
            Transaction.timestamp >= window_start,
        )
        .scalar()
    )

    if count >= REPEAT_THRESHOLD:
        return [_insert_anomaly(
            db, shop_id, transaction_id,
            anomaly_type="repeated_partial",
            severity="medium",
            description=(
                f"Ration card {ration_card} received {count} distributions from "
                f"shop {shop_id} in the last {REPEAT_WINDOW_MINUTES} minutes "
                f"(threshold: {REPEAT_THRESHOLD})"
            ),
            confidence=min(1.0, count / (REPEAT_THRESHOLD * 2)),
        )]
    return []


def _rule_daily_spike(db: Session, shop_id: str, transaction_id: str) -> list[dict]:
    """Rule 3 — Flag if today's txn count > 2× the 30-day daily average.

    Edge cases:
      - If no historical data (avg=0), skip the rule entirely.
      - 30-day average excludes today to avoid self-inflation.
    """
    today = datetime.now(timezone.utc).date()
    lookback_start = today - timedelta(days=DAILY_SPIKE_LOOKBACK_DAYS)

    # Today's count
    today_count = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.shop_id == shop_id,
            cast(Transaction.timestamp, Date) == today,
        )
        .scalar()
    )

    # 30-day average (exclude today)
    historical = (
        db.query(
            cast(Transaction.timestamp, Date).label("day"),
            func.count(Transaction.id).label("cnt"),
        )
        .filter(
            Transaction.shop_id == shop_id,
            cast(Transaction.timestamp, Date) >= lookback_start,
            cast(Transaction.timestamp, Date) < today,
        )
        .group_by(cast(Transaction.timestamp, Date))
        .all()
    )

    if not historical:
        # No historical data — cannot determine spike, skip rule
        return []

    avg_daily = sum(row.cnt for row in historical) / len(historical)

    if avg_daily == 0:
        return []

    if today_count > DAILY_SPIKE_MULTIPLIER * avg_daily:
        return [_insert_anomaly(
            db, shop_id, transaction_id,
            anomaly_type="daily_spike",
            severity="high",
            description=(
                f"Shop {shop_id} has {today_count} transactions today vs. "
                f"{avg_daily:.1f} daily average (threshold: {DAILY_SPIKE_MULTIPLIER}×)"
            ),
            confidence=min(1.0, today_count / (avg_daily * DAILY_SPIKE_MULTIPLIER * 2)),
        )]
    return []
