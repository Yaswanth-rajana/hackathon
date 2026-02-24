import csv
import io
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User, UserRole
from app.models.shop import Shop
from app.models.risk_score import RiskScore
from app.models.complaint import Complaint
from app.models.anomaly import Anomaly
from app.models.audit import Audit
from app.models.transaction import Transaction
from app.core.dependencies import get_current_user
from app.schemas.admin_dashboard_schema import (
    DashboardSummaryResponse, AlertsPaginatedResponse, AlertResponse,
    HeatmapRegionResponse, HighRiskShopsPaginatedResponse, HighRiskShopResponse,
    BlockchainRecentResponse
)

router = APIRouter(prefix="/api/admin/dashboard", tags=["Admin Dashboard"])

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    total_shops = db.query(Shop).filter(Shop.district == admin.district).count()
    
    # Get latest risk score per shop via subquery directly in SQL
    subq = db.query(
        RiskScore.shop_id,
        func.max(RiskScore.calculated_at).label('max_date')
    ).group_by(RiskScore.shop_id).subquery()

    high_risk_shops = db.query(Shop.id).join(
        subq, Shop.id == subq.c.shop_id
    ).join(
        RiskScore, (RiskScore.shop_id == subq.c.shop_id) & (RiskScore.calculated_at == subq.c.max_date)
    ).filter(
        Shop.district == admin.district,
        RiskScore.risk_score >= 70
    ).count()
    
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    complaints = db.query(Complaint).join(Shop, Complaint.shop_id == Shop.id).filter(
        Shop.district == admin.district, Complaint.created_at >= start_of_month
    ).count()
    
    compliance = max(0, int(100 - (high_risk_shops / total_shops * 100))) if total_shops > 0 else 100
    
    return DashboardSummaryResponse(
        total_shops=total_shops, high_risk_shops=high_risk_shops,
        complaints_this_month=complaints, compliance_score=compliance
    )

@router.get("/alerts", response_model=AlertsPaginatedResponse)
def get_alerts(
    severity: Optional[str] = None, from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None, page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    # Subquery for latest risk score
    subq = db.query(
        RiskScore.shop_id,
        func.max(RiskScore.calculated_at).label('max_date')
    ).group_by(RiskScore.shop_id).subquery()

    latest_risk = db.query(RiskScore).join(
        subq, (RiskScore.shop_id == subq.c.shop_id) & (RiskScore.calculated_at == subq.c.max_date)
    ).subquery()

    query = db.query(Anomaly, latest_risk.c.risk_score).join(
        Shop, Anomaly.shop_id == Shop.id
    ).outerjoin(
        latest_risk, Anomaly.shop_id == latest_risk.c.shop_id
    ).filter(
        Shop.district == admin.district, Anomaly.is_resolved == False
    )
    
    if severity: query = query.filter(Anomaly.severity == severity)
    if from_date: query = query.filter(Anomaly.created_at >= from_date)
    if to_date: query = query.filter(Anomaly.created_at <= to_date)
    
    total = query.count()
    items = query.order_by(desc(Anomaly.created_at)).offset((page - 1) * limit).limit(limit).all()
    
    data = []
    for item, risk_score in items:
        data.append(AlertResponse(
            id=item.id, shop_id=item.shop_id, severity=item.severity,
            description=item.description, risk_score=risk_score or 0,
            detected_at=item.created_at, fraud_type=item.anomaly_type
        ))
        
    return AlertsPaginatedResponse(data=data, total=total, page=page, limit=limit)

@router.patch("/alerts/{id}/dismiss")
def dismiss_alert(id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    anomaly = db.query(Anomaly).join(Shop).filter(Anomaly.id == id, Shop.district == admin.district).first()
    if not anomaly: raise HTTPException(status_code=404, detail="Alert not found")
    anomaly.is_resolved = True
    db.commit()
    return {"message": "Alert dismissed"}

@router.get("/heatmap", response_model=List[HeatmapRegionResponse])
def get_heatmap(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    subq = db.query(
        RiskScore.shop_id,
        func.max(RiskScore.calculated_at).label('max_date')
    ).group_by(RiskScore.shop_id).subquery()

    latest_risk = db.query(RiskScore).join(
        subq, (RiskScore.shop_id == subq.c.shop_id) & (RiskScore.calculated_at == subq.c.max_date)
    ).subquery()

    # Join shops with their latest risk score natively
    shop_risks = db.query(Shop.mandal, latest_risk.c.risk_score, latest_risk.c.fraud_type).outerjoin(
        latest_risk, Shop.id == latest_risk.c.shop_id
    ).filter(Shop.district == admin.district).all()
    
    mandal_stats = {}
    for mandal, r_score, f_type in shop_risks:
        if mandal not in mandal_stats:
            mandal_stats[mandal] = {"scores": [], "fraud_counts": {}}
            
        score = r_score or 0
        mandal_stats[mandal]["scores"].append(score)
        
        if f_type:
            mandal_stats[mandal]["fraud_counts"][f_type] = mandal_stats[mandal]["fraud_counts"].get(f_type, 0) + 1
            
    res = []
    for mandal, stats in mandal_stats.items():
        avg = int(sum(stats["scores"]) / len(stats["scores"])) if stats["scores"] else 0
        level = "LOW"
        if avg >= 90: level = "CRITICAL"
        elif avg >= 70: level = "HIGH"
        elif avg >= 40: level = "MEDIUM"
        
        top_fraud = max(stats["fraud_counts"], key=stats["fraud_counts"].get) if stats["fraud_counts"] else None
        
        res.append(HeatmapRegionResponse(
            mandal=mandal, avg_score=avg, risk_level=level,
            shop_count=len(stats["scores"]), top_fraud_type=top_fraud
        ))
    return res

@router.get("/high-risk-shops", response_model=HighRiskShopsPaginatedResponse)
def get_high_risk_shops(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    # Latest Risk Subquery
    risk_subq = db.query( RiskScore.shop_id, func.max(RiskScore.calculated_at).label('max_date') ).group_by(RiskScore.shop_id).subquery()
    latest_risk = db.query(RiskScore).join( risk_subq, (RiskScore.shop_id == risk_subq.c.shop_id) & (RiskScore.calculated_at == risk_subq.c.max_date) ).subquery()

    # Latest Audit Subquery
    audit_subq = db.query( Audit.shop_id, func.max(Audit.completed_date).label('max_date') ).group_by(Audit.shop_id).subquery()
    latest_audit = db.query(Audit).join( audit_subq, (Audit.shop_id == audit_subq.c.shop_id) & (Audit.completed_date == audit_subq.c.max_date) ).subquery()

    query = db.query(Shop, latest_risk.c.risk_score, latest_risk.c.fraud_type, latest_audit.c.completed_date).join(
        latest_risk, Shop.id == latest_risk.c.shop_id
    ).outerjoin(
        latest_audit, Shop.id == latest_audit.c.shop_id
    ).filter(
        Shop.district == admin.district,
        latest_risk.c.risk_score >= 60
    )

    items = query.order_by(desc(latest_risk.c.risk_score)).offset((page - 1) * limit).limit(limit).all()

    data = []
    for shop, risk_score, fraud_type, last_audit in items:
        audit_str = last_audit.strftime("%Y-%m-%d") if last_audit else None
        data.append(HighRiskShopResponse(
            shop_id=shop.id, shop_name=shop.name, mandal=shop.mandal,
            risk_score=risk_score, fraud_type=fraud_type, last_audit=audit_str
        ))
            
    return HighRiskShopsPaginatedResponse(data=data)

from fastapi.responses import StreamingResponse

@router.get("/high-risk-shops/export")
def export_high_risk_shops(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    risk_subq = db.query( RiskScore.shop_id, func.max(RiskScore.calculated_at).label('max_date') ).group_by(RiskScore.shop_id).subquery()
    latest_risk = db.query(RiskScore).join( risk_subq, (RiskScore.shop_id == risk_subq.c.shop_id) & (RiskScore.calculated_at == risk_subq.c.max_date) ).subquery()

    audit_subq = db.query( Audit.shop_id, func.max(Audit.completed_date).label('max_date') ).group_by(Audit.shop_id).subquery()
    latest_audit = db.query(Audit).join( audit_subq, (Audit.shop_id == audit_subq.c.shop_id) & (Audit.completed_date == audit_subq.c.max_date) ).subquery()

    query = db.query(Shop, latest_risk.c.risk_score, latest_risk.c.fraud_type, latest_audit.c.completed_date).join(
        latest_risk, Shop.id == latest_risk.c.shop_id
    ).outerjoin(
        latest_audit, Shop.id == latest_audit.c.shop_id
    ).filter(
        Shop.district == admin.district,
        latest_risk.c.risk_score >= 60
    ).order_by(desc(latest_risk.c.risk_score))

    def iter_csv():
        yield "Shop ID,Shop Name,Mandal,Risk Score,Fraud Type,Last Audit\n"
        for shop, risk_score, fraud_type, last_audit in query.yield_per(100):
            audit_str = last_audit.strftime("%Y-%m-%d") if last_audit else "N/A"
            fraud_str = fraud_type or "N/A"
            row = f"{shop.id},{shop.name},{shop.mandal},{risk_score},{fraud_str},{audit_str}\n"
            yield row

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=high_risk_shops.csv"}
    )

@router.get("/blockchain-recent", response_model=List[BlockchainRecentResponse])
def get_blockchain_recent(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    txs = db.query(Transaction).join(Shop, Transaction.shop_id == Shop.id).filter(
        Shop.district == admin.district
    ).order_by(desc(Transaction.timestamp)).limit(10).all()
    
    res = []
    for tx in txs:
        res.append(BlockchainRecentResponse(
            timestamp=tx.timestamp.strftime("%I:%M %p") if tx.timestamp else "",
            transaction_id=tx.id,
            shop_id=tx.shop_id,
            type=tx.transaction_type or "Distribution",
            block_index=tx.block_index,
            block_hash=tx.block_hash or "0x0",
            status="Verified"
        ))
    return res
