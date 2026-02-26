from app.database import SessionLocal
from app.models.user import User, UserRole

db = SessionLocal()
admin = db.query(User).filter(User.role == UserRole.admin).first()
if admin:
    print(f"Admin Mobile: {admin.mobile}")
    print(f"Admin ID: {admin.id}")
else:
    print("No admin found")
db.close()
