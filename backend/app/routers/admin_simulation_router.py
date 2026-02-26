from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import require_admin
from app.services.simulation_service import SimulationService
from app.schemas.simulation import (
    GhostInjectionRequest,
    StockMismatchRequest,
    ComplaintSpikeRequest
)
from app.utils.demo_guard import enforce_demo_mode

router = APIRouter()

@router.post("/ghost/{shop_id}")
def inject_ghosts(
    shop_id: str,
    payload: GhostInjectionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    enforce_demo_mode(shop_id)
    try:
        return SimulationService.inject_ghost_beneficiaries(
            db=db,
            shop_id=shop_id,
            count=payload.count,
            seed=payload.seed
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/mismatch/{shop_id}")
def inject_mismatch(
    shop_id: str,
    payload: StockMismatchRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    enforce_demo_mode(shop_id)
    try:
        return SimulationService.inject_stock_mismatch(
            db=db,
            shop_id=shop_id,
            inflation_factor=payload.inflation_factor,
            month_year=payload.month_year
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/complaints/{shop_id}")
def inject_complaints(
    shop_id: str,
    payload: ComplaintSpikeRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    enforce_demo_mode(shop_id)
    try:
        return SimulationService.inject_complaint_spike(
            db=db,
            shop_id=shop_id,
            count=payload.count,
            seed=payload.seed
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reset/{shop_id}")
def reset_simulation(
    shop_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    enforce_demo_mode(shop_id)
    try:
        return SimulationService.reset_simulation(
            db=db,
            shop_id=shop_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/events/{shop_id}")
def get_simulation_events(
    shop_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    enforce_demo_mode(shop_id)
    try:
        from app.models.simulation import SimulationEvent
        events = db.query(SimulationEvent).filter(
            SimulationEvent.shop_id == shop_id
        ).order_by(SimulationEvent.executed_at.desc()).limit(50).all()
        
        return [
            {
                "type": e.event_type,
                "msg": _format_event_msg(e),
                "timestamp": e.executed_at.isoformat()
            } for e in events
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def _format_event_msg(e):
    details = e.event_details or {}
    if e.event_type == "ghost_injection":
        return f"Injected {details.get('count', 0)} ghost beneficiaries into {e.shop_id}"
    if e.event_type == "stock_mismatch_injection":
        return f"Injected {details.get('inflation_factor', 0)}x stock mismatch for {details.get('month_year', 'N/A')}"
    if e.event_type == "complaint_spike_injection":
        return f"Injected {details.get('count', 0)} complaint spikes"
    if e.event_type == "simulation_reset":
        return f"Shop {e.shop_id} restored to clean state"
    return f"Sim event: {e.event_type}"
