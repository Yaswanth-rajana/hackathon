from sqlalchemy.orm import Session
from app.services.ml.feature_extractor import extract_shop_features
from app.services.ml.model import predict
from app.models.shop import Shop

def evaluate_shop(db: Session, shop_id: str) -> dict:
    """
    Evaluates a shop's risk using Hybrid Logic (ML + Rule Weighted).
    """
    # 1. Verify existence
    shop_exists = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop_exists:
        return {"shop_id": shop_id, "risk_score": 0, "risk_level": "LOW"}

    # 2. Extract features (0-100 normalized)
    # Admin intelligence views should reflect simulation injections in real-time.
    features = extract_shop_features(db, shop_id, include_simulated=True)

    # 3. Run ML model for confidence and anomaly score
    ml_result = predict(features)

    # 4. Hybrid Risk Score Calculation
    # Formula: 40% Ghost + 30% Stock + 15% Complaint + 10% Timing + 5% Variance
    risk_score = (
        0.40 * features.get("ghost_score", 0.0) +
        0.30 * features.get("stock_score", 0.0) +
        0.15 * features.get("complaint_score", 0.0) +
        0.10 * features.get("timing_score", 0.0) +
        0.05 * features.get("variance_score", 0.0)
    )

    # 5. Risk Level Classification
    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # 6. Identify Top Contributing Feature
    contributions = {f: features.get(f, 0.0) * weight for f, weight in {
        "ghost_score": 0.40,
        "stock_score": 0.30,
        "complaint_score": 0.15,
        "timing_score": 0.10,
        "variance_score": 0.05
    }.items()}
    top_feature = max(contributions, key=contributions.get) if contributions else "unknown"

    return {
        "shop_id": shop_id,
        "features": features,
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "confidence": ml_result["confidence"],
        "anomaly_score": ml_result["anomaly_score"],
        "is_fraud_predicted": ml_result["is_fraud_predicted"],
        "top_feature": top_feature
    }
