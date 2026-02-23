from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.beneficiary import Beneficiary
from app.core.dependencies import get_current_citizen
from app.schemas.citizen_schema import (
    CitizenProfileResponse, 
    CitizenTransactionsResponse,
    EntitlementResponse,
    ShopDetailsResponse,
    ComplaintCreateRequest,
    ComplaintResponse,
    NotificationResponse,
    FamilyMemberResponse,
    FamilyMemberCreateRequest,
    NearbyShopResponse
)
from app.services import citizen_service

router = APIRouter(
    prefix="/api/citizen",
    tags=["Citizen"],
)

@router.get("/profile", response_model=CitizenProfileResponse)
def get_profile(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_profile(db, current_citizen)

@router.get("/transactions", response_model=CitizenTransactionsResponse)
def get_transactions(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_transactions(db, current_citizen)

@router.get("/entitlement", response_model=EntitlementResponse)
def get_entitlement(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_entitlement(db, current_citizen)

@router.get("/shop", response_model=ShopDetailsResponse)
def get_shop(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_shop(db, current_citizen)

@router.post("/complaint", response_model=ComplaintResponse)
def file_complaint(
    request: ComplaintCreateRequest,
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.file_complaint(db, current_citizen, request)

@router.get("/complaints", response_model=List[ComplaintResponse])
def get_complaints(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_complaints(db, current_citizen)

@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_notifications(db, current_citizen)

@router.get("/family", response_model=List[FamilyMemberResponse])
def get_family_members(
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_citizen_family(db, current_citizen)

@router.post("/family", response_model=FamilyMemberResponse)
def add_family_member(
    request: FamilyMemberCreateRequest,
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.add_family_member(db, current_citizen, request)

@router.delete("/family/{id}")
def delete_family_member(
    id: int,
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.delete_family_member(db, current_citizen, id)

@router.get("/nearby-shops", response_model=List[NearbyShopResponse])
def get_nearby_shops(
    lat: float = Query(...),
    lng: float = Query(...),
    current_citizen: Beneficiary = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    return citizen_service.get_nearby_shops(db, lat, lng)
