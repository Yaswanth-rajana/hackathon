import sys
import os

# Add the project root to the python path so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.shop import Shop

def seed_shop():
    db = SessionLocal()
    try:
        shop1 = db.query(Shop).filter(Shop.id == "SHOP_001").first()
        if not shop1:
            shop1 = Shop(
                id="SHOP_001",
                name="Central Godown FPS",
                address="123 Main St, Region A",
                stock_wheat=500,
                stock_rice=1200,
                stock_sugar=150,
                stock_kerosene=40
            )
            db.add(shop1)
            print("Added SHOP_001")
        
        shop2 = db.query(Shop).filter(Shop.id == "SHOP_002").first()
        if not shop2:
            shop2 = Shop(
                id="SHOP_002",
                name="North District FPS",
                address="456 North St, Region B",
                stock_wheat=200,
                stock_rice=800,
                stock_sugar=50,
                stock_kerosene=20
            )
            db.add(shop2)
            print("Added SHOP_002")
            
        db.commit()
        print("Shops seeded successfully")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_shop()
