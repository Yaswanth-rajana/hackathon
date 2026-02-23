from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()
ramulu = db.query(User).filter(User.mobile == "9876543210").first()
if ramulu:
    print(f"Ramulu found: ID={ramulu.id}, Active={ramulu.is_active}, Role={ramulu.role}")
    # Reset password to 'password' just to be sure
    ramulu.password_hash = get_password_hash("password")
    ramulu.is_active = True
    db.commit()
    print("✅ Ramulu password reset to 'password' and set to active.")
else:
    print("❌ Ramulu not found by mobile 9876543210")

suresh = db.query(User).filter(User.mobile == "9876543211").first()
if suresh:
    print(f"Suresh found: ID={suresh.id}, Active={suresh.is_active}, Role={suresh.role}")
else:
    print("❌ Suresh not found by mobile 9876543211")

db.close()
