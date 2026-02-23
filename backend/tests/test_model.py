import time
import pytest
from app.services.ml.model import predict, model

def test_model_loaded_and_trained():
    """Verify the model is initialized and trained once on import."""
    assert model is not None
    # If the model is fitted, it will have offset_ defined
    assert hasattr(model, 'offset_'), "Model should be fitted at module load"

def test_predict_normal_shop():
    """Test Case 1: Normal Shop Features should have LOW or MEDIUM risk."""
    input_data = {
        "ghost_ratio": 1.02,
        "mismatch_ratio": 0.98,
        "night_ratio": 0.05,
        "weekend_ratio": 0.12,
        "complaint_rate": 1.0,
        "consistency_score": 8.0
    }
    
    result = predict(input_data)
    
    assert result["risk_level"] == "LOW"
    assert result["risk_score"] < 40
    assert result["is_fraud_predicted"] is False

def test_predict_fraud_simulation():
    """Test Case 2: Fraud Simulation should have HIGH or CRITICAL risk."""
    input_data = {
        "ghost_ratio": 1.6,
        "mismatch_ratio": 0.5,
        "night_ratio": 0.5,
        "weekend_ratio": 0.5,
        "complaint_rate": 12,
        "consistency_score": 0.2
    }
    
    result = predict(input_data)
    
    assert result["risk_level"] == "CRITICAL"
    assert result["risk_score"] > 80
    assert result["is_fraud_predicted"] is True

def test_determinism():
    """Test Case 3: Same input must produce identical output."""
    input_data = {
        "ghost_ratio": 1.5,
        "mismatch_ratio": 0.6,
        "night_ratio": 0.7,
        "weekend_ratio": 0.8,
        "complaint_rate": 5.0,
        "consistency_score": 3.0
    }
    
    result1 = predict(input_data)
    result2 = predict(input_data)
    
    assert result1["anomaly_score"] == result2["anomaly_score"]
    assert result1["risk_score"] == result2["risk_score"]
    assert result1["risk_level"] == result2["risk_level"]
    assert result1["is_fraud_predicted"] == result2["is_fraud_predicted"]

def test_performance():
    """Test Case 4: Execution under 20ms."""
    input_data = {
        "ghost_ratio": 1.02,
        "mismatch_ratio": 0.98,
        "night_ratio": 0.05,
        "weekend_ratio": 0.12,
        "complaint_rate": 1.0,
        "consistency_score": 8.0
    }
    
    # Warmup
    predict(input_data)
    
    start_time = time.perf_counter()
    result = predict(input_data)
    execution_time_ms = (time.perf_counter() - start_time) * 1000
    
    assert execution_time_ms < 20.0
    assert "execution_time_ms" in result
