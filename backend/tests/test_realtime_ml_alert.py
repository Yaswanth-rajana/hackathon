import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy.orm import Session
from app.services.risk_service import run_ai_audit
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly
from app.models.shop import Shop
from app.database import SessionLocal, engine, Base
import asyncio

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

@pytest.mark.asyncio
async def test_normal_shop_no_broadcast(db_session: Session, mock_shop):
    with patch("app.services.risk_service.evaluate_shop") as mock_eval:
        with patch("app.services.event_emitter.manager.broadcast_ml_alert", new_callable=AsyncMock) as mock_ws:
            mock_eval.return_value = {
                "shop_id": "TPT001",
                "features": {},
                "anomaly_score": 0.1,
                "risk_score": 15.0,
                "risk_level": "LOW",
                "is_fraud_predicted": False,
                "top_feature": None
            }

            run_ai_audit(db_session, "TPT001")
            await asyncio.sleep(0.01) # Yield to event loop to allow tasks to settle
            
            # Broadcast should NOT be called for LOW risk
            mock_ws.assert_not_called()

@pytest.mark.asyncio
async def test_fraud_shop_triggers_broadcast(db_session: Session, mock_fraud_shop):
    with patch("app.services.risk_service.evaluate_shop") as mock_eval:
        with patch("app.services.event_emitter.manager.broadcast_ml_alert", new_callable=AsyncMock) as mock_ws:
            mock_eval.return_value = {
                "shop_id": "FRD001",
                "features": {},
                "anomaly_score": 0.85,
                "risk_score": 85.0,
                "risk_level": "CRITICAL",
                "is_fraud_predicted": True,
                "top_feature": "ghost_ratio"
            }

            run_ai_audit(db_session, "FRD001")
            
            # Yield to event loop to allow create_task to execute the mock
            await asyncio.sleep(0.01)
            
            mock_ws.assert_called_once()
            
            # Extract arguments
            call_args = mock_ws.call_args[0][0]
            assert call_args["event"] == "ML_ALERT"
            assert call_args["shop_id"] == "FRD001"
            assert call_args["risk_level"] == "CRITICAL"
            assert call_args["top_feature"] == "ghost_ratio"
            assert "block_index" in call_args
            assert "block_hash" in call_args
            assert call_args["block_index"] > 0
