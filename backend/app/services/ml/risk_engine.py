from sqlalchemy.orm import Session
from app.services.ml.feature_extractor import extract_shop_features
from app.services.ml.model import predict
from app.models.shop import Shop

def evaluate_shop(db: Session, shop_id: str) -> dict:
    """
    Evaluates a shop's risk using deterministic DB features and an ML model.
    Pure orchestration: no DB inserts, no block mining, no websockets.
    """
    # 1. Verify existence to prevent empty shop anomaly issues
    shop_exists = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop_exists:
        return {
            "shop_id": shop_id,
            "features": {}, # empty or defaults don't matter, it's bypassed
            "anomaly_score": 0.0,
            "risk_score": 0.0,
            "risk_level": "LOW",
            "is_fraud_predicted": False,
            "top_feature": None
        }

    # 2. Extract features
    features = extract_shop_features(db, shop_id)

    # 3. Run model
    prediction = predict(features)

    # 4. Identify strongest anomaly contributor using empirical deviation from baselines
    if features:
        # Scale deviations empirically to an ~0-100 scale for fair comparison
        # Base values => Ghost: 1.0, Mismatch: 1.0, Night/Weekend: 0.0, Complaint: 0.0, Consistency: 100.0
        deviations = {
            "ghost_ratio": abs(features.get("ghost_ratio", 1.0) - 1.0) * 100.0,
            "mismatch_ratio": abs(features.get("mismatch_ratio", 1.0) - 1.0) * 100.0,
            "night_ratio": features.get("night_ratio", 0.0) * 100.0,
            "weekend_ratio": features.get("weekend_ratio", 0.0) * 100.0,
            "complaint_rate": features.get("complaint_rate", 0.0), # Already percentage
            "consistency_score": abs(100.0 - features.get("consistency_score", 100.0))
        }
        top_feature = max(deviations, key=lambda k: deviations[k])
    else:
        top_feature = None

    # 4. Return structured result
    return {
        "shop_id": shop_id,
        "features": features,
        "anomaly_score": prediction["anomaly_score"],
        "risk_score": prediction["risk_score"],
        "risk_level": prediction["risk_level"],
        "is_fraud_predicted": prediction["is_fraud_predicted"],
        "top_feature": top_feature
    }
