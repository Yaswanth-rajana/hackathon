from typing import Dict

# Hybrid weights from the optimized plan
WEIGHTS = {
    "ghost_score": 0.40,
    "stock_score": 0.30,
    "complaint_score": 0.15,
    "timing_score": 0.10,
    "variance_score": 0.05
}

def explain_risk(features: Dict[str, float]) -> Dict[str, float]:
    """
    Calculates the contribution of each feature to the final risk score.
    contribution = feature_value * weight
    """
    contributions = {}
    for feature, weight in WEIGHTS.items():
        value = features.get(feature, 0.0)
        contributions[feature] = round(value * weight, 2)
    
    # Sort by contribution descending for better presentation
    return dict(sorted(contributions.items(), key=lambda item: item[1], reverse=True))
