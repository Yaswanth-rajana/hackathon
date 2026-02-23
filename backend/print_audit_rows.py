from app.database import SessionLocal
from app.models.risk_score import RiskScore
from app.models.anomaly import Anomaly

db = SessionLocal()

print("--- LOW AUDIT (TPT001) ---")
score_low = db.query(RiskScore).filter_by(shop_id="TPT001").first()
print(f"RiskScore: shop_id={score_low.shop_id}, score={score_low.risk_score}, level={score_low.risk_level}, calculated_at={score_low.calculated_at}")

anomaly_low = db.query(Anomaly).filter_by(shop_id="TPT001").first()
print(f"Anomaly: {anomaly_low}")

print("\n--- CRITICAL AUDIT (FRD001) ---")
score_high = db.query(RiskScore).filter_by(shop_id="FRD001").first()
print(f"RiskScore: shop_id={score_high.shop_id}, score={score_high.risk_score}, level={score_high.risk_level}, calculated_at={score_high.calculated_at}")

anomaly_high = db.query(Anomaly).filter_by(shop_id="FRD001").first()
print(f"Anomaly: shop_id={anomaly_high.shop_id}, type={anomaly_high.anomaly_type}, severity={anomaly_high.severity}, desc='{anomaly_high.description}', conf={anomaly_high.confidence}, resolved={anomaly_high.is_resolved}")

db.close()
