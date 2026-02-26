import math
import random
import uuid
from datetime import datetime, timezone
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
    def inject_ghost_beneficiaries(db: Session, shop_id: str = "DEMO_001", intensity: str = "MEDIUM", seed: Optional[int] = None) -> Dict[str, Any]:
        intensity_map = {
            "LOW": 2,
            "MEDIUM": 15,
            "HIGH": 45
        }
        count = intensity_map.get(intensity.upper(), 15)

        if seed is not None:
            random.seed(seed)
        
        try:
            shop = SimulationService._verify_demo_shop(db, shop_id)
            
            new_beneficiaries = []
            for _ in range(count):
                ration_card = f"SIM{uuid.uuid4().hex[:12].upper()}"
                family_members = random.choices([1, 2, 3, 4, 5], weights=[10, 25, 30, 25, 10], k=1)[0]
                
                beneficiary = Beneficiary(
                    ration_card=ration_card,
                    name=f"Simulated Citizen {ration_card[-4:]}",
                    family_members=family_members,
                    account_status="active",
                    is_active=True,
                    shop_id=shop_id,
                    district=shop.district,
                    is_simulated=True
                )
                new_beneficiaries.append(beneficiary)
            
            db.bulk_save_objects(new_beneficiaries)
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="ghost_injection",
                event_details={"count": count, "intensity": intensity.upper()},
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()

            # Trigger AI Audit immediately for real-time impact
            from app.services.audit_service import AuditService
            AuditService.run_shop_audit(db, shop_id)
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "ghost_injection",
            "intensity": intensity.upper(),
            "count": count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def inject_stock_mismatch(db: Session, shop_id: str = "DEMO_001", intensity: str = "MEDIUM", month_year: Optional[str] = None) -> Dict[str, Any]:
        intensity_map = {
            "LOW": 1.05,
            "MEDIUM": 1.20,
            "HIGH": 1.40
        }
        inflation_factor = intensity_map.get(intensity.upper(), 1.20)

        if not month_year:
            month_year = datetime.now(timezone.utc).strftime("%Y-%m")
        
        try:
            SimulationService._verify_demo_shop(db, shop_id)
            
            # Allow multiple injections but backup once
            backup_exists = db.query(EntitlementSimulationBackup).filter_by(month_year=month_year).first()
            if not backup_exists:
                entitlements = db.query(Entitlement).join(Beneficiary, Entitlement.ration_card == Beneficiary.ration_card).filter(
                    Beneficiary.shop_id == shop_id,
                    Entitlement.month_year == month_year
                ).all()
                
                if entitlements:
                    backups = [
                        EntitlementSimulationBackup(
                            ration_card=ent.ration_card,
                            month_year=ent.month_year,
                            wheat_kg=int(ent.wheat),
                            rice_kg=int(ent.rice),
                            sugar_kg=int(ent.sugar)
                        ) for ent in entitlements
                    ]
                    db.bulk_save_objects(backups)
                    db.flush()
            
            entitlements = db.query(Entitlement).join(Beneficiary, Entitlement.ration_card == Beneficiary.ration_card).filter(
                Beneficiary.shop_id == shop_id,
                Entitlement.month_year == month_year
            ).all()

            count = 0
            for ent in entitlements:
                ent.wheat = math.ceil(ent.wheat * inflation_factor)
                ent.rice = math.ceil(ent.rice * inflation_factor)
                ent.sugar = math.ceil(ent.sugar * inflation_factor)
                count += 1
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="stock_mismatch_injection",
                event_details={
                    "inflation_factor": inflation_factor,
                    "intensity": intensity.upper(),
                    "affected_rows": count,
                    "month_year": month_year
                },
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()

            # Trigger AI Audit
            from app.services.audit_service import AuditService
            AuditService.run_shop_audit(db, shop_id)
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "stock_mismatch_injection",
            "intensity": intensity.upper(),
            "count": count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def inject_complaint_spike(db: Session, shop_id: str = "DEMO_001", intensity: str = "MEDIUM", seed: Optional[int] = None) -> Dict[str, Any]:
        intensity_map = {
            "LOW": 1,
            "MEDIUM": 8,
            "HIGH": 25
        }
        count = intensity_map.get(intensity.upper(), 8)
            
        if seed is not None:
            random.seed(seed)
            
        try:
            shop = SimulationService._verify_demo_shop(db, shop_id)
            
            real_beneficiaries = db.query(Beneficiary).filter_by(
                shop_id=shop_id, 
                is_simulated=False
            ).all()
            
            if not real_beneficiaries:
                raise Exception(f"No real beneficiaries found for shop {shop_id} to attach complaints to")
            
            complaint_types = list(COMPLAINT_WEIGHTS.keys())
            weights = list(COMPLAINT_WEIGHTS.values())
            
            new_complaints = []
            for _ in range(count):
                selected_beneficiary = random.choice(real_beneficiaries)
                c_type = random.choices(complaint_types, weights=weights, k=1)[0]
                
                complaint = Complaint(
                    id=f"CMP_{uuid.uuid4().hex[:8].upper()}",
                    citizen_name=selected_beneficiary.name,
                    ration_card=selected_beneficiary.ration_card,
                    shop_id=shop_id,
                    complaint_type=c_type,
                    description=f"Simulated {c_type} complaint context auto-generated.",
                    district=shop.district,
                    status="NEW",
                    is_simulated=True
                )
                new_complaints.append(complaint)
                
            db.bulk_save_objects(new_complaints)
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="complaint_spike_injection",
                event_details={"count": count, "intensity": intensity.upper()},
                executed_by="admin"
            )
            db.add(sim_event)
            db.commit()

            # Trigger AI Audit
            from app.services.audit_service import AuditService
            AuditService.run_shop_audit(db, shop_id)
            
        except Exception:
            db.rollback()
            raise

        return {
            "status": "success",
            "shop_id": shop_id,
            "operation": "complaint_spike_injection",
            "intensity": intensity.upper(),
            "count": count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


    @staticmethod
    def reset_simulation(db: Session, shop_id: str = "DEMO_001") -> Dict[str, Any]:
        from app.models.blockchain_ledger import BlockchainLedger
        from app.models.transaction import Transaction
        from app.models.enums import TransactionType
        
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

            # 3. Blockchain & Audit Traces Cleanup (scoped to this demo shop only)
            from app.models.risk_score import RiskScore
            deleted_risk_scores = db.query(RiskScore).filter(
                RiskScore.shop_id == shop_id
            ).delete()

            # Only remove simulation-related ML alert transactions for this shop.
            tx_ids = [
                row[0] for row in db.query(Transaction.id).filter(
                    Transaction.shop_id == shop_id,
                    Transaction.transaction_type == TransactionType.ML_ALERT
                ).all()
            ]

            deleted_txs = 0
            deleted_ledger = 0
            if tx_ids:
                deleted_txs = db.query(Transaction).filter(
                    Transaction.id.in_(tx_ids)
                ).delete(synchronize_session=False)
                deleted_ledger = db.query(BlockchainLedger).filter(
                    BlockchainLedger.transaction_id.in_(tx_ids)
                ).delete(synchronize_session=False)
            
            sim_event = SimulationEvent(
                shop_id=shop_id,
                event_type="simulation_reset",
                event_details={
                    "deleted_beneficiaries": deleted_bens,
                    "deleted_complaints": deleted_comps,
                    "restored_entitlements": restored_ents,
                    "deleted_anomalies": deleted_anoms,
                    "deleted_transactions": deleted_txs,
                    "deleted_blockchain_entries": deleted_ledger,
                    "deleted_risk_scores": deleted_risk_scores
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
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
