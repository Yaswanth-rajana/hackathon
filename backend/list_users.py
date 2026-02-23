from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()

for user in users:
    print(f"ID: {user.id}, Role: {user.role}, Mobile: {user.mobile}, Shop ID: {user.shop_id}")

db.close()
