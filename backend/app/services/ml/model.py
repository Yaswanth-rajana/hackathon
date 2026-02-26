import time
import numpy as np
from sklearn.ensemble import IsolationForest

def generate_synthetic_training_data(n_samples=3000) -> np.ndarray:
    np.random.seed(42)
    """
    Generates structured numeric samples for training the baseline model.
    Normalized Feature order (0-100):
    [ghost_score, stock_score, complaint_score, timing_score, variance_score]
    """
    # Normal data stays near 0-20
    ghost_score = np.random.uniform(0, 15, n_samples)
    stock_score = np.random.uniform(0, 10, n_samples)
    complaint_score = np.random.uniform(0, 10, n_samples)
    timing_score = np.random.uniform(0, 15, n_samples)
    variance_score = np.random.uniform(0, 15, n_samples)
    
    X = np.column_stack([ghost_score, stock_score, complaint_score, timing_score, variance_score])
    
    # Inject 5% Fraud Samples (elevated scores)
    n_fraud = int(n_samples * 0.05)
    fraud_indices = np.random.choice(n_samples, n_fraud, replace=False)
    
    for idx in fraud_indices:
        fraud_type = np.random.choice(['ghost', 'stock', 'timing'])
        if fraud_type == 'ghost':
            X[idx, 0] = np.random.uniform(70, 100)
        elif fraud_type == 'stock':
            X[idx, 1] = np.random.uniform(70, 100)
        else:
            X[idx, 3] = np.random.uniform(70, 100)
            
    return X

# Step 2: Initialize Isolation Forest
model = IsolationForest(
    n_estimators=100,
    max_samples=256,
    contamination=0.05,
    random_state=42,
    n_jobs=-1
)

# Step 3: Train Once at Startup
_training_data = generate_synthetic_training_data(n_samples=3000)
model.fit(_training_data)


def predict(features_dict: dict) -> dict:
    start_time = time.perf_counter()

    # Backward-compatible feature mapping:
    # old inputs used *_ratio / complaint_rate / consistency_score.
    ghost_score = features_dict.get("ghost_score")
    if ghost_score is None:
        ghost_ratio = float(features_dict.get("ghost_ratio", 1.0) or 1.0)
        ghost_score = max(0.0, min(100.0, (ghost_ratio - 1.0) * 200.0))

    stock_score = features_dict.get("stock_score")
    if stock_score is None:
        mismatch_ratio = float(features_dict.get("mismatch_ratio", 1.0) or 1.0)
        stock_score = max(0.0, min(100.0, abs(1.0 - mismatch_ratio) * 200.0))

    complaint_score = features_dict.get("complaint_score")
    if complaint_score is None:
        complaint_rate = float(features_dict.get("complaint_rate", 0.0) or 0.0)
        complaint_score = max(0.0, min(100.0, complaint_rate * 20.0))

    timing_score = features_dict.get("timing_score")
    if timing_score is None:
        night_ratio = float(features_dict.get("night_ratio", 0.0) or 0.0)
        timing_score = max(0.0, min(100.0, night_ratio * 500.0))

    variance_score = features_dict.get("variance_score")
    if variance_score is None:
        consistency_score = float(features_dict.get("consistency_score", 100.0) or 100.0)
        if consistency_score <= 10.0:
            # Legacy scale (0-10): lower consistency means higher variance risk.
            variance_score = max(0.0, min(100.0, (10.0 - consistency_score) * 10.0))
        else:
            variance_score = max(0.0, min(100.0, abs(100.0 - consistency_score)))

    # Extract features in fixed order
    feature_vector = [
        ghost_score,
        stock_score,
        complaint_score,
        timing_score,
        variance_score
    ]
    
    # Predict
    anomaly_score_raw = model.decision_function([feature_vector])[0]
    is_anomaly = model.predict([feature_vector])[0]
    
    # Normalized score: Convert raw anomaly score (-0.5 to 0.5) to risk probability
    # If raw < 0 (outlier), risk is high.
    risk_prob = max(0.0, min(100.0, (0.5 - anomaly_score_raw) * 100.0))
    
    # Confidence: Abs(raw_score) * 100 capped at 99
    confidence = min(99.0, abs(anomaly_score_raw) * 200.0)

    hybrid_risk = (
        0.40 * float(ghost_score) +
        0.30 * float(stock_score) +
        0.15 * float(complaint_score) +
        0.10 * float(timing_score) +
        0.05 * float(variance_score)
    )
    hybrid_risk = max(0.0, min(100.0, hybrid_risk))

    if hybrid_risk >= 85:
        risk_level = "CRITICAL"
    elif hybrid_risk >= 70:
        risk_level = "HIGH"
    elif hybrid_risk >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"
    
    execution_time_ms = (time.perf_counter() - start_time) * 1000
    
    return {
        "anomaly_score": float(round(anomaly_score_raw, 4)),
        "risk_probability": float(round(risk_prob, 1)),
        "risk_score": float(round(hybrid_risk, 1)),
        "risk_level": risk_level,
        "confidence": float(round(confidence, 1)),
        "is_fraud_predicted": bool(is_anomaly == -1),
        "execution_time_ms": float(round(execution_time_ms, 2))
    }
