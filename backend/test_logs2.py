import requests
import sqlite3
import urllib.parse
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
admin = db.query(User).filter(User.role == 'admin').first()
if not admin:
    print("No admin found")
    exit(1)

# Generate a quick token for this admin
from app.core.security import create_access_token
from datetime import timedelta
from app.config import settings

access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
token = create_access_token(
    data={"sub": admin.phone}, expires_delta=access_token_expires
)

headers = {"Authorization": f"Bearer {token}"}
res = requests.get("http://127.0.0.1:8000/api/admin/logs?limit=100", headers=headers)
print(res.status_code)
print(res.text)
