"""Admin dashboard aggregation queries."""

import logging
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.transaction import Transaction
from app.models.beneficiary import Beneficiary
from app.models.anomaly import Anomaly
from app.services.risk_service import calculate_shop_risk

logger = logging.getLogger(__name__)


def get_dashboard_summary(db: Session) -> dict:
    """Aggregate system-wide counts for the admin dashboard.

    Counts shops from dealers only (not admin/inspector users).
    """
    total_shops = (
        db.query(func.count(func.distinct(User.shop_id)))
        .filter(User.role == UserRole.dealer, User.shop_id.isnot(None))
        .scalar()
    ) or 0

    total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
    total_beneficiaries = db.query(func.count(Beneficiary.ration_card)).scalar() or 0
    total_anomalies = (
        db.query(func.count(Anomaly.id))
        .filter(Anomaly.is_resolved == False)  # noqa: E712
        .scalar()
    ) or 0

    # High-risk shops: distinct shops with ≥3 unresolved anomalies
    high_risk_shops = _count_shops_by_risk(db, "high")

    return {
        "total_shops": total_shops,
        "total_transactions": total_transactions,
        "total_beneficiaries": total_beneficiaries,
        "total_anomalies": total_anomalies,
        "high_risk_shops": high_risk_shops,
    }


def get_risk_distribution(db: Session) -> dict:
    """Count shops per risk level (high / medium / low)."""
    # Get all unique dealer shop_ids
    shop_ids = (
        db.query(func.distinct(User.shop_id))
        .filter(User.role == UserRole.dealer, User.shop_id.isnot(None))
        .all()
    )

    distribution = {"high": 0, "medium": 0, "low": 0}

    for (shop_id,) in shop_ids:
        risk = calculate_shop_risk(db, shop_id)
        distribution[risk] += 1

    return distribution


def _count_shops_by_risk(db: Session, target_risk: str) -> int:
    """Count shops matching a specific risk level."""
    shop_ids = (
        db.query(func.distinct(User.shop_id))
        .filter(User.role == UserRole.dealer, User.shop_id.isnot(None))
        .all()
    )

    count = 0
    for (shop_id,) in shop_ids:
        if calculate_shop_risk(db, shop_id) == target_risk:
            count += 1
    return count


def get_recent_anomalies(db: Session, limit: int = 20) -> list[dict]:
    """Return the most recent unresolved anomalies.

    Ordered by severity priority (high first) then newest first.
    """
    from sqlalchemy import case

    severity_order = case(
        (Anomaly.severity == "high", 0),
        (Anomaly.severity == "medium", 1),
        else_=2,
    )

    rows = (
        db.query(Anomaly)
        .filter(Anomaly.is_resolved == False)  # noqa: E712
        .order_by(severity_order, Anomaly.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "shop_id": r.shop_id,
            "type": r.anomaly_type,
            "severity": r.severity,
            "description": r.description,
            "confidence": r.confidence,
            "created_at": r.created_at,
        }
        for r in rows
    ]
