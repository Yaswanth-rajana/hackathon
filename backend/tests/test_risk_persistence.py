import pytest
from sqlalchemy.orm import Session
from app.services.risk_service import run_ai_audit
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly
from app.models.shop import Shop
from app.models.user import User
from unittest.mock import patch

from app.database import SessionLocal, engine, Base

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

@pytest.fixture
def mock_shop(db_session: Session):
    shop = db_session.query(Shop).filter_by(id="TPT001").first()
    if not shop:
        shop = Shop(id="TPT001", name="Test Shop", district="Test District")
        db_session.add(shop)
        db_session.commit()
    return shop

@pytest.fixture
def mock_fraud_shop(db_session: Session):
    db_session.query(Anomaly).filter_by(shop_id="FRD001").delete()
    db_session.query(RiskScore).filter_by(shop_id="FRD001").delete()
    db_session.commit()
    
    shop = db_session.query(Shop).filter_by(id="FRD001").first()
    if not shop:
        shop = Shop(id="FRD001", name="Fraud Shop", district="Test District")
        db_session.add(shop)
        db_session.commit()
    return shop

def test_run_ai_audit_normal_shop(db_session: Session, mock_shop):
    # Mock evaluate_shop to return LOW risk
    with patch("app.services.risk_service.evaluate_shop") as mock_eval:
        mock_eval.return_value = {
            "shop_id": "TPT001",
            "features": {},
            "anomaly_score": 0.1,
            "risk_score": 15.0,
            "risk_level": "LOW",
            "is_fraud_predicted": False,
            "top_feature": None
        }

        result = run_ai_audit(db_session, "TPT001")

        assert result["shop_id"] == "TPT001"
        assert result["risk_score"] == 15.0
        assert result["risk_level"] == "LOW"
        assert result["anomaly_created"] is False

        # Verify RiskScore created
        score = db_session.query(RiskScore).filter_by(shop_id="TPT001").first()
        assert score is not None
        assert score.risk_score == 15
        assert score.risk_level == "LOW"

        # Verify no Anomaly
        anomaly = db_session.query(Anomaly).filter_by(shop_id="TPT001").first()
        assert anomaly is None

def test_run_ai_audit_fraud_shop(db_session: Session, mock_fraud_shop):
    with patch("app.services.risk_service.evaluate_shop") as mock_eval:
        mock_eval.return_value = {
            "shop_id": "FRD001",
            "features": {},
            "anomaly_score": 0.85,
            "risk_score": 85.0,
            "risk_level": "CRITICAL",
            "is_fraud_predicted": True,
            "top_feature": "ghost_ratio"
        }

        result = run_ai_audit(db_session, "FRD001")

        assert result["shop_id"] == "FRD001"
        assert result["risk_score"] == 85.0
        assert result["risk_level"] == "CRITICAL"
        assert result["anomaly_created"] is True

        # Verify RiskScore
        score = db_session.query(RiskScore).filter_by(shop_id="FRD001").first()
        assert score is not None
        assert score.risk_score == 85
        assert score.risk_level == "CRITICAL"

        # Verify Anomaly
        anomaly = db_session.query(Anomaly).filter_by(shop_id="FRD001").first()
        assert anomaly is not None
        assert anomaly.anomaly_type == "ghost_ratio"
        assert anomaly.severity == "critical"
        assert anomaly.confidence == 0.85
        assert anomaly.is_resolved is False

def test_run_ai_audit_idempotency(db_session: Session, mock_fraud_shop):
    with patch("app.services.risk_service.evaluate_shop") as mock_eval:
        mock_eval.return_value = {
            "shop_id": "FRD001",
            "features": {},
            "anomaly_score": 0.85,
            "risk_score": 85.0,
            "risk_level": "CRITICAL",
            "is_fraud_predicted": True,
            "top_feature": "ghost_ratio"
        }

        # First run
        result1 = run_ai_audit(db_session, "FRD001")
        # Might be True or False depending on if it ran in a previous test
        # We delete existing anomalies first just in case
        db_session.query(Anomaly).filter_by(shop_id="FRD001").delete()
        db_session.commit()
        
        result1 = run_ai_audit(db_session, "FRD001")
        assert result1["anomaly_created"] is True

        # Second run
        result2 = run_ai_audit(db_session, "FRD001")
        assert result2["anomaly_created"] is False

        # Verify only one Anomaly exists
        anomalies = db_session.query(Anomaly).filter_by(shop_id="FRD001").all()
        assert len(anomalies) == 1
