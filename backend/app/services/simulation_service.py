import math
import random
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.shop import Shop
from app.models.beneficiary import Beneficiary
from app.models.entitlement import Entitlement
from app.models.complaint import Complaint
from app.models.anomaly import Anomaly
from app.models.simulation import SimulationEvent, EntitlementSimulationBackup

DEMO_SHOP_ID = "DEMO_001"
COMPLAINT_WEIGHTS = {
    "underweight": 50,
    "stock_out": 30,
    "overcharging": 10,
    "rude": 10
}

class SimulationService:

    @staticmethod
    def _verify_demo_shop(db: Session, shop_id: str):
        if shop_id != DEMO_SHOP_ID:
            raise HTTPException(status_code=403, detail="Simulation allowed only for demo shop")
        
        shop = db.query(Shop).filter(Shop.id == DEMO_SHOP_ID).first()
        if not shop:
            raise HTTPException(status_code=404, detail="Demo shop not found")
        
        # No strict district check for demo shop, allows moving it to match admin district
        return shop

    @staticmethod
    def inject_ghost_beneficiaries(db: Session, shop_id: str = "DEMO_001", count: int = 50, seed: Optional[int] = None) -> Dict[str, Any]:
        if count > 1000:
            raise ValueError("Max injection limit exceeded")

        if seed is not None:
            random.seed(seed)
        
        try:
            SimulationService._verify_demo_shop(db, shop_id)
            
            new_beneficiaries = []
            first_id = None
            last_id = None
            
            for i in range(count):
                ration_card = f"SIM{uuid.uuid4().hex[:12].upper()}"
                if i == 0:
                    first_id = ration_card
                if i == count - 1:
                    last_id = ration_card
                
                family_members = random.choices(
                    [1, 2, 3, 4, 5],
                    weights=[10, 25, 30, 25, 10],
                    k=1
                )[0]
                
                beneficiary = Beneficiary(
                    ration_card=ration_card,
                    name=f"Simulated Citizen {ration_card[-4:]}",
                    family_members=family_members,
                    account_status="active",
                    is_active=True,
                    shop_id=shop_id,
                    is_simulated=True
                )
                new_beneficiaries.append(beneficiary)
            
            db.bulk_save_objects(new_beneficiaries)
            
            event_details = {
                "count": count,
                "first_id": first_id,
                "last_id": last_id,
            }
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="ghost_injection",
                event_details=event_details,
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "ghost_injection",
            "count": count,
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def inject_stock_mismatch(db: Session, shop_id: str = "DEMO_001", inflation_factor: float = 1.5, month_year: Optional[str] = None) -> Dict[str, Any]:
        if inflation_factor <= 1.0:
            raise ValueError("Inflation factor must be > 1.0")

        if not month_year:
            month_year = datetime.utcnow().strftime("%Y-%m")
        
        try:
            SimulationService._verify_demo_shop(db, shop_id)
            
            backup_exists = db.query(EntitlementSimulationBackup).filter_by(month_year=month_year).count()
            if backup_exists > 0:
                raise Exception("Stock mismatch already simulated")
            
            entitlements = db.query(Entitlement).join(Beneficiary, Entitlement.ration_card == Beneficiary.ration_card).filter(
                Beneficiary.shop_id == shop_id,
                Entitlement.month_year == month_year
            ).all()
            
            if not entitlements:
                raise Exception(f"No entitlements found for shop {shop_id} in {month_year} to simulate")
            
            backups = []
            for ent in entitlements:
                backups.append(
                    EntitlementSimulationBackup(
                        ration_card=ent.ration_card,
                        month_year=ent.month_year,
                        wheat_kg=int(ent.wheat),
                        rice_kg=int(ent.rice),
                        sugar_kg=int(ent.sugar)
                    )
                )
            
            db.bulk_save_objects(backups)
            
            count = 0
            for ent in entitlements:
                ent.wheat = math.ceil(ent.wheat * inflation_factor)
                ent.rice = math.ceil(ent.rice * inflation_factor)
                ent.sugar = math.ceil(ent.sugar * inflation_factor)
                count += 1
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="stock_mismatch_injection",
                event_details={"inflation_factor": inflation_factor, "month_year": month_year, "affected_rows": count},
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "stock_mismatch_injection",
            "count": count,
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def inject_complaint_spike(db: Session, shop_id: str = "DEMO_001", count: int = 20, seed: Optional[int] = None) -> Dict[str, Any]:
        if count > 500:
            raise ValueError("Excessive complaint spike")
            
        if seed is not None:
            random.seed(seed)
            
        try:
            SimulationService._verify_demo_shop(db, shop_id)
            
            real_beneficiaries = db.query(Beneficiary).filter_by(
                shop_id=shop_id, 
                is_simulated=False
            ).all()
            
            if not real_beneficiaries:
                raise Exception(f"No real beneficiaries found for shop {shop_id} to attach complaints to")
            
            complaint_types = list(COMPLAINT_WEIGHTS.keys())
            weights = list(COMPLAINT_WEIGHTS.values())
            
            new_complaints = []
            first_id = None
            last_id = None
            
            for i in range(count):
                selected_beneficiary = random.choice(real_beneficiaries)
                c_type = random.choices(complaint_types, weights=weights, k=1)[0]
                
                cmp_id = f"CMP_{uuid.uuid4().hex[:8].upper()}"
                if i == 0:
                    first_id = cmp_id
                if i == count - 1:
                    last_id = cmp_id
                
                complaint = Complaint(
                    id=cmp_id,
                    citizen_name=selected_beneficiary.name,
                    ration_card=selected_beneficiary.ration_card,
                    shop_id=shop_id,
                    complaint_type=c_type,
                    description=f"Simulated {c_type} complaint context auto-generated.",
                    status="NEW",
                    is_simulated=True
                )
                new_complaints.append(complaint)
                
            db.bulk_save_objects(new_complaints)
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="complaint_spike_injection",
                event_details={"count": count, "first_id": first_id, "last_id": last_id},
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "complaint_spike_injection",
            "count": count,
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def reset_simulation(db: Session, shop_id: str = "DEMO_001") -> Dict[str, Any]:
        from app.models.blockchain_ledger import BlockchainLedger
        from app.models.transaction import Transaction
        
        try:
            SimulationService._verify_demo_shop(db, shop_id)
            
            # 1. Restore entitlement from backup
            backups = db.query(EntitlementSimulationBackup).all()
            restored_ents = 0
            if backups:
                backup_map = { (b.ration_card, b.month_year): b for b in backups }
                entitlements = db.query(Entitlement).join(Beneficiary, Entitlement.ration_card == Beneficiary.ration_card).filter(
                    Beneficiary.shop_id == shop_id,
                    Entitlement.month_year.in_([b.month_year for b in backups])
                ).all()
                for ent in entitlements:
                    key = (ent.ration_card, ent.month_year)
                    if key in backup_map:
                        b = backup_map[key]
                        ent.wheat = b.wheat_kg
                        ent.rice = b.rice_kg
                        ent.sugar = b.sugar_kg
                        restored_ents += 1
                        
            # 2. Sequential Cleanup
            db.query(EntitlementSimulationBackup).delete()
            
            # Wipe all anomalies for this shop during simulation reset
            deleted_anoms = db.query(Anomaly).filter(
                Anomaly.shop_id == shop_id
            ).delete()

            deleted_comps = db.query(Complaint).filter(
                Complaint.shop_id == shop_id,
                Complaint.is_simulated == True
            ).delete()

            deleted_bens = db.query(Beneficiary).filter(
                Beneficiary.shop_id == shop_id,
                Beneficiary.is_simulated == True
            ).delete()

            # 3. Blockchain & Audit Traces Cleanup
            # Truncate ALL transactions and the global ledger for a total system reset
            # This is required because of the global UNIQUE constraint on block_index 
            # in the transactions table.
            from app.models.risk_score import RiskScore
            db.query(RiskScore).delete()
            
            deleted_txs = db.query(Transaction).delete()
            db.query(BlockchainLedger).delete()
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="simulation_reset",
                event_details={
                    "deleted_beneficiaries": deleted_bens,
                    "deleted_complaints": deleted_comps,
                    "restored_entitlements": restored_ents,
                    "deleted_anomalies": deleted_anoms,
                    "deleted_transactions": deleted_txs,
                    "blockchain_ledger_truncated": True
                },
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "simulation_reset",
            "deleted_beneficiaries": deleted_bens,
            "deleted_complaints": deleted_comps,
            "restored_entitlements": restored_ents,
            "deleted_anomalies": deleted_anoms,
            "deleted_transactions": deleted_txs,
            "timestamp": datetime.utcnow().isoformat()
        }
