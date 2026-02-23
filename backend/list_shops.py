import sys
import os
sys.path.append('.')
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        shops = db.query(Shop).all()
        for s in shops:
            print(f"Shop: '{s.id}', Name: '{s.name}', Mandal: '{s.mandal}'")
        
        users = db.query(User).all()
        for u in users:
            print(f"User: '{u.id}', Role: '{u.role}', Shop: '{u.shop_id}'")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
