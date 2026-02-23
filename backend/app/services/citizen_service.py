"""Citizen-facing read services."""

import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timezone
import math

from app.models.beneficiary import Beneficiary
from app.models.transaction import Transaction
from app.models.user import User
from app.models.entitlement import Entitlement
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.models.notification import Notification
from app.models.family_member import FamilyMember
from app.schemas.citizen_schema import ComplaintCreateRequest, FamilyMemberCreateRequest
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def get_citizen_profile(db: Session, beneficiary: Beneficiary) -> dict:
    """Return citizen profile from the linked beneficiary record."""
    return {
        "name": beneficiary.name,
        "ration_card": beneficiary.ration_card,
        "shop_id": beneficiary.shop_id,
        "account_status": beneficiary.account_status,
    }


def get_citizen_transactions(db: Session, beneficiary: Beneficiary) -> dict:
    """Return transactions linked to the citizen's ration card."""
    rows = (
        db.query(Transaction)
        .filter(Transaction.ration_card == beneficiary.ration_card)
        .order_by(Transaction.timestamp.desc())
        .limit(10)
        .all()
    )

    items = [
        {
            "transaction_id": t.id,
            "items": t.items,
            "timestamp": t.timestamp,
            "block_index": t.block_index,
        }
        for t in rows
    ]

    return {"transactions": items, "total": len(items)}


def get_citizen_entitlement(db: Session, beneficiary: Beneficiary) -> dict:
    current_month_year = datetime.utcnow().strftime("%Y-%m")
    
    entitlement = db.query(Entitlement).filter(
        Entitlement.ration_card == beneficiary.ration_card,
        Entitlement.month_year == current_month_year
    ).first()

    wheat_total = entitlement.wheat if entitlement else 0.0
    rice_total = entitlement.rice if entitlement else 0.0
    sugar_total = entitlement.sugar if entitlement else 0.0

    # Calculate received amounts from transactions in the current month
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    transactions = db.query(Transaction).filter(
        Transaction.ration_card == beneficiary.ration_card,
        Transaction.timestamp >= start_of_month
    ).all()

    wheat_received = 0.0
    rice_received = 0.0
    sugar_received = 0.0

    for t in transactions:
        if isinstance(t.items, dict):
            wheat_received += t.items.get("wheat", 0.0)
            rice_received += t.items.get("rice", 0.0)
            sugar_received += t.items.get("sugar", 0.0)
            
    wheat_remaining = max(0.0, wheat_total - wheat_received)
    rice_remaining = max(0.0, rice_total - rice_received)
    sugar_remaining = max(0.0, sugar_total - sugar_received)
    
    if wheat_remaining == 0 and rice_remaining == 0 and sugar_remaining == 0:
        dist_status = "completed"
    elif wheat_received == 0 and rice_received == 0 and sugar_received == 0:
        dist_status = "pending"
    else:
        dist_status = "partial"
        
    return {
        "month_year": current_month_year,
        "wheat_total": wheat_total,
        "wheat_remaining": wheat_remaining,
        "rice_total": rice_total,
        "rice_remaining": rice_remaining,
        "sugar_total": sugar_total,
        "sugar_remaining": sugar_remaining,
        "status": dist_status
    }


def get_citizen_shop(db: Session, beneficiary: Beneficiary) -> dict:
    shop = db.query(Shop).filter(Shop.id == beneficiary.shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
        
    dealer = db.query(User).filter(User.id == shop.dealer_id).first()
    
    return {
        "name": shop.name,
        "dealer_name": dealer.name if dealer else "N/A",
        "address": shop.address or "N/A",
        "timings": shop.timings or "09:00 AM - 05:00 PM",
        "rating": shop.rating or 4.5,
        "risk_score": shop.risk_score or 0.0
    }


def file_complaint(db: Session, beneficiary: Beneficiary, request: ComplaintCreateRequest) -> dict:
    # Rate Limiting: Max 3 complaints per day
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_complaints = db.query(func.count(Complaint.id)).filter(
        Complaint.ration_card == beneficiary.ration_card,
        Complaint.created_at >= start_of_day
    ).scalar()
    
    if today_complaints >= 3:
        raise HTTPException(status_code=429, detail="Maximum of 3 complaints allowed per day.")

    # Stage 1: Blockchain Simulation Layer
    target_shop_id = request.shop_id or beneficiary.shop_id
    
    # Optional: Verify shop exists
    shop_exists = db.query(Shop).filter(Shop.id == target_shop_id).first()
    if not shop_exists:
        raise HTTPException(status_code=404, detail=f"Shop {target_shop_id} not found in system")

    blockchain_payload = {
        "type": "COMPLAINT",
        "shop_id": target_shop_id,
        "ration_card_masked": beneficiary.ration_card[:4] + "****" + beneficiary.ration_card[-4:],
        "complaint_type": request.complaint_type,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    from app.services.blockchain.crypto import sign_transaction
    sign_transaction(blockchain_payload, "CITIZEN")
    
    from app.services.blockchain.blockchain import blockchain
    blockchain.add_transaction(blockchain_payload)
    block = blockchain.mine_pending_transactions(simulate=True)
    
    try:
        new_complaint = Complaint(
            citizen_name=beneficiary.name,
            ration_card=beneficiary.ration_card,
            shop_id=target_shop_id,
            complaint_type=request.complaint_type,
            description=request.description,
            status="pending", # Standardized to lowercase
            block_index=block.index,
            block_hash=block.hash
        )
        db.add(new_complaint)
        db.commit()
        db.refresh(new_complaint)
        
        # Stage 2: Blockchain Commit natively
        blockchain.commit_block(block)
    except Exception as e:
        db.rollback()
        blockchain.discard_pending()
        logger.error(f"Complaint ingestion failed, rolling back chain: {e}")
        raise HTTPException(status_code=500, detail="Failed to save complaint due to integrity error")
        
    return new_complaint.__dict__


def get_citizen_complaints(db: Session, beneficiary: Beneficiary) -> list:
    complaints = db.query(Complaint).filter(
        Complaint.ration_card == beneficiary.ration_card
    ).order_by(Complaint.created_at.desc()).all()
    return [c.__dict__ for c in complaints]


def get_citizen_notifications(db: Session, beneficiary: Beneficiary) -> list:
    # Notifications meant for this user's district or global
    notifications = db.query(Notification).filter(
        (Notification.district == beneficiary.district) | (Notification.district.is_(None))
    ).order_by(Notification.created_at.desc()).limit(20).all()
    # Mask read state as we might need a separate read table per user in a real system.
    # For now, just return them.
    return [n.__dict__ for n in notifications]


def get_citizen_family(db: Session, beneficiary: Beneficiary) -> list:
    members = db.query(FamilyMember).filter(FamilyMember.ration_card == beneficiary.ration_card).all()
    return [m.__dict__ for m in members]


def add_family_member(db: Session, beneficiary: Beneficiary, data: FamilyMemberCreateRequest) -> dict:
    current_count = db.query(func.count(FamilyMember.id)).filter(FamilyMember.ration_card == beneficiary.ration_card).scalar()
    if current_count >= 8: # Arbitrary max limit
        raise HTTPException(status_code=400, detail="Maximum family members reached (8).")
        
    # Check for duplicates by masked aadhaar
    existing = db.query(FamilyMember).filter(
        FamilyMember.ration_card == beneficiary.ration_card,
        FamilyMember.aadhaar_masked == data.aadhaar_masked
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Member with this Aadhaar already exists.")
        
    new_member = FamilyMember(
        ration_card=beneficiary.ration_card,
        name=data.name,
        relation=data.relation,
        age=data.age,
        aadhaar_masked=data.aadhaar_masked
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member.__dict__


def delete_family_member(db: Session, beneficiary: Beneficiary, member_id: int) -> dict:
    member = db.query(FamilyMember).filter(
        FamilyMember.id == member_id, 
        FamilyMember.ration_card == beneficiary.ration_card
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
        
    db.delete(member)
    db.commit()
    return {"message": "Success"}


def get_nearby_shops(db: Session, lat: float, lng: float) -> list:
    """Haversine distance logic. Radius = 10km, max limit 10"""
    shops = db.query(Shop).all()
    results = []
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0 # Earth radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    for shop in shops:
        if shop.latitude is not None and shop.longitude is not None:
            dist = haversine(lat, lng, shop.latitude, shop.longitude)
            if dist <= 10.0:  # 10km radius
                results.append({
                    "id": shop.id,
                    "name": shop.name,
                    "distance_km": round(dist, 2),
                    "timings": shop.timings,
                    "rating": shop.rating
                })
                
    # Sort by distance and limit 10
    results.sort(key=lambda x: x["distance_km"])
    return results[:10]
