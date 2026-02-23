import json
from app.services.ml.model import predict

normal_features = {
  "ghost_ratio": 1.02,
  "mismatch_ratio": 0.98,
  "night_ratio": 0.05,
  "weekend_ratio": 0.12,
  "complaint_rate": 1.0,
  "consistency_score": 8.0
}

fraud_features = {
  "ghost_ratio": 1.6,
  "mismatch_ratio": 0.5,
  "night_ratio": 0.5,
  "weekend_ratio": 0.5,
  "complaint_rate": 12,
  "consistency_score": 0.2
}

print("=== NORMAL FEATURES ===")
print("Output:\n" + json.dumps(predict(normal_features), indent=2))
print("\n=== FRAUD FEATURES ===")
print("Output:\n" + json.dumps(predict(fraud_features), indent=2))
