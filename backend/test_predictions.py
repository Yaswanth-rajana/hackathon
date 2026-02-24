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
normal_pred = predict(normal_features)
print("Output:\n" + json.dumps(normal_pred, indent=2))

print("\n=== FRAUD FEATURES ===")
fraud_pred = predict(fraud_features)
print("Output:\n" + json.dumps(fraud_pred, indent=2))

print("\n=== DETERMINISM CHECK ===")
def get_core(pred):
    return {k: v for k, v in pred.items() if k != "execution_time_ms"}

core_normal = get_core(normal_pred)
core_fraud = get_core(fraud_pred)

for i in range(5):
    assert get_core(predict(normal_features)) == core_normal
    assert get_core(predict(fraud_features)) == core_fraud
print("✅ Determinism Passed")
