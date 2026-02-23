import time
import numpy as np
from sklearn.ensemble import IsolationForest
np.random.seed(42)
ghost_ratio = np.clip(np.random.normal(1.02, 0.05, 3000), 1.0, 1.2)
mismatch_ratio = np.clip(np.random.normal(0.97, 0.03, 3000), 0.7, 1.0)
night_ratio = np.clip(np.random.exponential(0.05, 3000), 0.0, 0.3)
weekend_ratio = np.random.beta(2, 5, 3000)
complaint_rate = np.clip(np.random.exponential(1.0, 3000), 0.0, 5.0)
consistency_score = np.clip(1.0 / (np.random.exponential(0.1, 3000) + 0.01), 0.0, 10.0)
X = np.column_stack([ghost_ratio, mismatch_ratio, night_ratio, weekend_ratio, complaint_rate, consistency_score])
fraud_indices = np.random.choice(3000, 300, replace=False)
for idx in fraud_indices:
    ft = np.random.choice(['ghost', 'stock', 'timing'])
    if ft == 'ghost': X[idx, 0] *= 1.4
    elif ft == 'stock': X[idx, 1] *= 0.7
    else: X[idx, 2] += 0.4
m = IsolationForest(n_estimators=100, max_samples=256, contamination=0.1, random_state=42, n_jobs=-1)
m.fit(X)
v = [1.6, 0.5, 0.5, 0.5, 12, 0.2]
sc = m.decision_function([v])[0]
print("SCORE:", 50 - (sc * 50))
