"""Citizen-facing read services."""

import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timezone, timedelta
import math

from app.models.beneficiary import Beneficiary
from app.models.transaction import Transaction
from app.models.user import User
from app.models.entitlement import Entitlement
from app.models.shop import Shop
from app.models.complaint import Complaint
from app.models.notification import Notification
from app.models.family_member import FamilyMember
from app.models.anomaly import Anomaly
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


def get_citizen_transactions(db: Session, beneficiary: Beneficiary, limit: int = 10) -> dict:
    """Return transactions linked to the citizen's ration card."""
    base_query = db.query(Transaction).filter(Transaction.ration_card == beneficiary.ration_card)
    total = base_query.count()

    rows = base_query.order_by(Transaction.timestamp.desc()).limit(limit).all()

    items = [
        {
            "transaction_id": t.id,
            "items": t.items,
            "timestamp": t.timestamp,
            "block_index": t.block_index,
        }
        for t in rows
    ]

    summary_rows = db.query(
        Transaction.transaction_type,
        Transaction.items,
        Transaction.notes
    ).filter(Transaction.ration_card == beneficiary.ration_card).all()

    total_wheat = 0.0
    total_rice = 0.0
    total_sugar = 0.0
    shortfalls = 0

    for tx_type, tx_items, notes in summary_rows:
        if tx_type == "DISTRIBUTION":
            if isinstance(tx_items, dict):
                total_wheat += float(tx_items.get("wheat", 0) or 0)
                total_rice += float(tx_items.get("rice", 0) or 0)
                total_sugar += float(tx_items.get("sugar", 0) or 0)
            if isinstance(notes, str) and notes.strip():
                shortfalls += 1

    complaints_count = db.query(func.count(Complaint.id)).filter(
        Complaint.ration_card == beneficiary.ration_card
    ).scalar() or 0

    return {
        "transactions": items,
        "total": total,
        "summary": {
            "total_wheat_received": round(total_wheat, 2),
            "total_rice_received": round(total_rice, 2),
            "total_sugar_received": round(total_sugar, 2),
            "total_complaints_filed": int(complaints_count),
            "total_shortfalls_detected": shortfalls
        }
    }


def get_citizen_entitlement(db: Session, beneficiary: Beneficiary) -> dict:
    current_month_year = datetime.now(timezone.utc).strftime("%Y-%m")
    
    entitlement = db.query(Entitlement).filter(
        Entitlement.ration_card == beneficiary.ration_card,
        Entitlement.month_year == current_month_year
    ).first()

    wheat_total = entitlement.wheat if entitlement else 0.0
    rice_total = entitlement.rice if entitlement else 0.0
    sugar_total = entitlement.sugar if entitlement else 0.0

    # Calculate received amounts from transactions in the current month
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    transactions = db.query(Transaction).filter(
        Transaction.ration_card == beneficiary.ration_card,
        Transaction.timestamp >= start_of_month
    ).order_by(Transaction.timestamp.desc()).all()

    wheat_received = 0.0
    rice_received = 0.0
    sugar_received = 0.0
    cash_compensation = None
    last_txn_hash = None
    last_txn_block = None
    short_distribution_reason = None
    last_distribution_date = None
    recent_activity = []

    for t in transactions:
        if t.transaction_type == "CASH_TRANSFER" and not cash_compensation:
            cash_compensation = {
                "amount": t.cash_collected,
                "date": t.timestamp,
                "block": t.block_index,
                "txn_hash": t.block_hash,
                "verified": True
            }
        
        if t.transaction_type == "DISTRIBUTION":
            if isinstance(t.items, dict):
                wheat_received += t.items.get("wheat", 0.0)
                rice_received += t.items.get("rice", 0.0)
                sugar_received += t.items.get("sugar", 0.0)
            
            # Check for short distribution reason (from notes)
            # In our system, short distribution distribution requires notes >= 5 chars
            if t.notes and not short_distribution_reason:
                short_distribution_reason = t.notes
                last_distribution_date = t.timestamp

        if not last_txn_hash:
            last_txn_hash = t.block_hash
            last_txn_block = t.block_index
        
        if len(recent_activity) < 3:
            summary = ""
            if t.transaction_type == "CASH_TRANSFER":
                summary = f"Cash Compensation ₹{t.cash_collected}"
            else:
                items = []
                if t.items.get("wheat"): items.append(f"Wheat {t.items['wheat']}kg")
                if t.items.get("rice"): items.append(f"Rice {t.items['rice']}kg")
                if t.items.get("sugar"): items.append(f"Sugar {t.items['sugar']}kg")
                summary = ", ".join(items) if items else "Other Distribution"
            
            recent_activity.append({
                "date": t.timestamp,
                "type": t.transaction_type,
                "summary": summary,
                "block": t.block_index
            })

    wheat_remaining = max(0.0, wheat_total - wheat_received)
    rice_remaining = max(0.0, rice_total - rice_received)
    sugar_remaining = max(0.0, sugar_total - sugar_received)
    
    is_fully_distributed = (wheat_remaining <= 0 and rice_remaining <= 0 and sugar_remaining <= 0)
    cash_transfer_exists = cash_compensation is not None
    is_settled = cash_transfer_exists or is_fully_distributed

    if is_fully_distributed:
        dist_status = "completed"
    elif wheat_received == 0 and rice_received == 0 and sugar_received == 0:
        dist_status = "pending"
    else:
        dist_status = "partial"
    
    # Shop Risk Logic
    shop = db.query(Shop).filter(Shop.id == beneficiary.shop_id).first()
    shop_risk_level = "NORMAL"
    shop_warning = None
    
    if shop:
        # 1. Count short distributions for this shop in last 30 days
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        short_count = db.query(func.count(Transaction.id)).filter(
            Transaction.shop_id == shop.id,
            Transaction.transaction_type == "DISTRIBUTION",
            Transaction.notes.isnot(None),
            Transaction.timestamp >= thirty_days_ago
        ).scalar()
        
        if short_count >= 2:
            shop_risk_level = "ELEVATED"
            shop_warning = "This shop has recorded multiple short distributions. You may file a complaint."
        
        # 2. Check risk score (from AI) - Assuming threshold of 0.7 for HIGH
        if shop.risk_score >= 0.7:
            shop_risk_level = "HIGH"
            shop_warning = "High risk detected for this shop. Government audit in progress."

    return {
        "month_year": current_month_year,
        "wheat_total": wheat_total,
        "wheat_remaining": wheat_remaining,
        "rice_total": rice_total,
        "rice_remaining": rice_remaining,
        "sugar_total": sugar_total,
        "sugar_remaining": sugar_remaining,
        "status": dist_status,
        "is_settled": is_settled,
        "last_txn_hash": last_txn_hash,
        "last_txn_block": last_txn_block,
        "cash_compensation": cash_compensation,
        "short_distribution_reason": short_distribution_reason,
        "last_distribution_date": last_distribution_date,
        "shop_risk_level": shop_risk_level,
        "shop_warning": shop_warning,
        "recent_activity": recent_activity
    }


def get_citizen_shop(db: Session, beneficiary: Beneficiary) -> dict:
    shop = db.query(Shop).filter(Shop.id == beneficiary.shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
        
    dealer = db.query(User).filter(User.id == shop.dealer_id).first()
    
    # Shop Risk Logic (Consistent with entitlement)
    shop_risk_level = "NORMAL"
    shop_warning = None
    
    # 1. Count short distributions for this shop in last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    short_count = db.query(func.count(Transaction.id)).filter(
        Transaction.shop_id == shop.id,
        Transaction.transaction_type == "DISTRIBUTION",
        Transaction.notes.isnot(None),
        Transaction.timestamp >= thirty_days_ago
    ).scalar()
    
    if short_count >= 2:
        shop_risk_level = "ELEVATED"
        shop_warning = "This shop has recorded multiple short distributions. You may file a complaint."
    
    if shop.risk_score >= 70:
        shop_risk_level = "HIGH"
        shop_warning = "High risk detected for this shop. Government audit in progress."

    if (shop.status or "").lower() == "under_review":
        shop_risk_level = "HIGH"
        shop_warning = shop.under_review_reason or "Red Flag: shop is under investigation."

    # Grievance Count Logic
    active_grievances = db.query(func.count(Complaint.id)).filter(
        Complaint.shop_id == shop.id,
        Complaint.status != "RESOLVED"
    ).scalar()

    if active_grievances >= 3:
        shop_warning = f"High Complaint Volume: {active_grievances} active grievances pending."
        if shop_risk_level == "NORMAL": shop_risk_level = "ELEVATED"
    elif active_grievances > 0:
        shop_warning = shop_warning or f"Active Grievances: {active_grievances} reported by citizens."

    return {
        "id": shop.id,
        "name": shop.name,
        "dealer_name": dealer.name if dealer else "N/A",
        "address": shop.address or "N/A",
        "timings": shop.timings or "09:00 AM - 05:00 PM",
        "rating": shop.rating or 4.5,
        "risk_score": shop.risk_score or 0.0,
        "shop_status": (shop.status or "active").lower(),
        "dealer_status": (dealer.dealer_status if dealer else None),
        "shop_risk_level": shop_risk_level,
        "shop_warning": shop_warning,
        "active_grievances": active_grievances
    }


def file_complaint(db: Session, beneficiary: Beneficiary, request: ComplaintCreateRequest) -> dict:
    # 1. Validation
    description = request.description.strip() if request.description else ""
    if len(description) < 10:
        raise HTTPException(status_code=400, detail="Description must be at least 10 characters long.")

    # 2. Refined Spam Prevention (Same category/shop/citizen within 5 mins)
    five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    existing_spam = db.query(Complaint).filter(
        Complaint.ration_card == beneficiary.ration_card,
        Complaint.shop_id == (request.shop_id or beneficiary.shop_id),
        Complaint.complaint_type == request.complaint_type,
        Complaint.created_at >= five_minutes_ago
    ).first()
    
    if existing_spam:
        raise HTTPException(
            status_code=429, 
            detail="Duplicate complaint detected. Please wait 5 minutes before submitting the same issue again."
        )

    # 3. Rate Limiting (Daily)
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_complaints = db.query(func.count(Complaint.id)).filter(
        Complaint.ration_card == beneficiary.ration_card,
        Complaint.created_at >= start_of_day
    ).scalar()
    
    if today_complaints >= 5: # Increased to 5 for demo flexibility but keeping limit
        raise HTTPException(status_code=429, detail="Maximum of 5 complaints allowed per day.")

    target_shop_id = request.shop_id or beneficiary.shop_id
    shop = db.query(Shop).filter(Shop.id == target_shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail=f"Shop {target_shop_id} not found")

    # 4. District Auto-Assignment (Ignore UI input, force from profile)
    assigned_district = beneficiary.district or "Hyderabad"

    # 5. Blockchain Transaction
    blockchain_payload = {
        "type": "COMPLAINT",
        "shop_id": target_shop_id,
        "ration_card_masked": beneficiary.ration_card[:4] + "****" + beneficiary.ration_card[-4:],
        "complaint_type": request.complaint_type,
        "severity": request.severity,
        "is_anonymous": request.is_anonymous,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    from app.services.blockchain.blockchain import blockchain
    blockchain.add_transaction(blockchain_payload)
    block = blockchain.mine_pending_transactions(db, simulate=True) # Added db parameter
    
    try:
        new_complaint = Complaint(
            citizen_name=beneficiary.name,
            ration_card=beneficiary.ration_card,
            shop_id=target_shop_id,
            complaint_type=request.complaint_type,
            description=description,
            severity=request.severity,
            is_anonymous=request.is_anonymous,
            attachment_url=request.attachment_url,
            district=assigned_district,
            status="pending",
            block_index=block.index,
            block_hash=block.hash
        )
        db.add(new_complaint)
        db.flush() # Flush to get ID and ensure constraints hold
        
        # 6. Anomaly Bridge
        active_count = db.query(func.count(Complaint.id)).filter(
            Complaint.shop_id == target_shop_id,
            Complaint.status != "RESOLVED"
        ).scalar()
        
        if request.severity == "urgent" or active_count >= 3:
            anomaly = Anomaly(
                shop_id=target_shop_id,
                anomaly_type="grievance_spike" if active_count >= 3 else "urgent_grievance",
                severity="high" if request.severity == "urgent" else "medium",
                description=f"Action Required: {active_count} active grievances. Latest: {request.complaint_type}",
                confidence=0.9,
                is_simulated=False
            )
            db.add(anomaly)

        db.commit()
        db.refresh(new_complaint)
        
        # Finalize blockchain block
        blockchain.commit_block(db, block)
    except Exception as e:
        db.rollback()
        blockchain.discard_pending()
        logger.error(f"Complaint ingestion failed: {e}")
        raise HTTPException(status_code=500, detail="Grievance registration failed. Please try again.")
        
    return new_complaint.__dict__


def get_citizen_complaints(db: Session, beneficiary: Beneficiary) -> list:
    complaints = db.query(Complaint).filter(
        Complaint.ration_card == beneficiary.ration_card
    ).order_by(Complaint.created_at.desc()).all()
    return [c.__dict__ for c in complaints]


def get_citizen_notifications(db: Session, beneficiary: Beneficiary) -> list:
    # Notifications meant for this user's district or global
    rows = db.query(Notification).filter(
        (Notification.district == beneficiary.district) | (Notification.district.is_(None))
    ).order_by(Notification.created_at.desc()).limit(50).all()

    filtered = []
    for n in rows:
        payload = n.payload if isinstance(n.payload, dict) else {}

        # Distribution receipts are user-specific. Keep only this citizen's records.
        if n.type == "DISTRIBUTION_RECEIPT":
            if payload.get("ration_card") != beneficiary.ration_card:
                continue

        filtered.append({
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "severity": n.severity,
            "read": n.read,
            "created_at": n.created_at,
            "payload": payload
        })

    return filtered[:20]


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
        aadhaar_masked=data.aadhaar_masked,
        is_verified=True
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
