import sys
import os
import threading
import concurrent.futures
from unittest.mock import patch
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.simulation_service import SimulationService
from app.models.beneficiary import Beneficiary
from app.models.complaint import Complaint
from app.models.entitlement import Entitlement
from app.models.simulation import EntitlementSimulationBackup
from app.models.shop import Shop
from app.models.user import User
from app.models.anomaly import Anomaly

def setup_demo_shop(db: Session):
    shop = db.query(Shop).filter_by(id="DEMO_001").first()
    if not shop:
        print("Demo shop doesn't exist. Creating...")
        shop = Shop(id="DEMO_001", name="Demo Shop", district="DemoDistrict", mandal="DemoMandal")
        db.add(shop)
        db.commit()
    elif shop.district != "DemoDistrict":
        shop.district = "DemoDistrict"
        db.commit()
    
    # Add a real beneficiary for DEMO_001
    b = db.query(Beneficiary).filter_by(ration_card="REAL_DEMO_01").first()
    if not b:
        b = Beneficiary(
            ration_card="REAL_DEMO_01",
            name="Real Citizen",
            family_members=4,
            account_status="active",
            is_active=True,
            shop_id="DEMO_001",
            is_simulated=False
        )
        db.add(b)
        db.commit()

    # Add an entitlement for the real beneficiary
    ent = db.query(Entitlement).filter_by(ration_card="REAL_DEMO_01").first()
    if not ent:
        ent = Entitlement(
            ration_card="REAL_DEMO_01",
            month_year="2026-02", # use current or test month
            wheat=10.0,
            rice=15.0,
            sugar=5.0
        )
        db.add(ent)
        db.commit()
    else:
        ent.wheat = 10.0
        ent.rice = 15.0
        ent.sugar = 5.0
        db.commit()

def run_tests():
    db = SessionLocal()
    try:
        setup_demo_shop(db)
        # Ensure clean state
        SimulationService.reset_simulation(db)
        
        from app.models.blockchain_ledger import BlockchainLedger
        pre_ledg_count = db.query(BlockchainLedger).count()
        print(f"Baseline Ledger Count: {pre_ledg_count}")
        
        print("====== TEST A: Ghost Injection ======")
        baseline_bens = db.query(Beneficiary).filter_by(shop_id="DEMO_001").count()
        baseline_comps = db.query(Complaint).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        db.commit() # Close implicit tx
        resA = SimulationService.inject_ghost_beneficiaries(db, count=50)
        new_bens = db.query(Beneficiary).filter_by(shop_id="DEMO_001").count()
        print(f"Baseline: {baseline_bens}, New: {new_bens}, Diff: {new_bens - baseline_bens}")
        assert new_bens - baseline_bens == 50
        print("Test A Passed!")

        print("====== TEST B: Double Injection Prevention ======")
        db.commit() # Close implicit tx
        resB1 = SimulationService.inject_stock_mismatch(db, month_year="2026-02")
        print("First injection success.")
        try:
            resB2 = SimulationService.inject_stock_mismatch(db, month_year="2026-02")
            print("FAILED: Allowed double injection")
        except Exception as e:
            print(f"Caught expected exception: {e}")
            print("Test B Passed!")

        print("====== TEST C: Reset ======")
        db.commit() # Close implicit tx
        SimulationService.inject_complaint_spike(db, count=20)
        resC = SimulationService.reset_simulation(db)
        print("Reset Result:", resC)
        final_bens = db.query(Beneficiary).filter_by(shop_id="DEMO_001").count()
        final_comps = db.query(Complaint).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        print(f"Post-reset Bens (should be {baseline_bens}): {final_bens}, Comps (should be {baseline_comps}): {final_comps}")
        assert final_bens == baseline_bens
        assert final_comps == baseline_comps
        
        ent = db.query(Entitlement).filter_by(ration_card="REAL_DEMO_01", month_year="2026-02").first()
        print(f"Restored Entitlement: Wheat={ent.wheat}")
        assert ent.wheat == 10.0
        print("Test C Passed!")

        print("====== TEST D: Analytics Isolation ======")
        db.commit() # Close implicit tx
        resD = SimulationService.inject_ghost_beneficiaries(db, count=40)
        sim_count = db.query(Beneficiary).filter_by(shop_id="DEMO_001").count()
        real_count = db.query(Beneficiary).filter_by(shop_id="DEMO_001", is_simulated=False).count()
        print(f"Total: {sim_count}, Real (analytics): {real_count}")
        assert real_count == baseline_bens
        print("Test D Passed!")

        db.commit() # Close implicit tx
        SimulationService.reset_simulation(db)
        
        print("====== TEST E: Concurrent Injection Attempt ======")
        def run_concurrent_injection():
            local_db = SessionLocal()
            try:
                SimulationService.inject_ghost_beneficiaries(local_db, count=50) # Use 50 to avoid big DB stalls
            finally:
                local_db.close()
                
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut1 = executor.submit(run_concurrent_injection)
            fut2 = executor.submit(run_concurrent_injection)
            concurrent.futures.wait([fut1, fut2])
            
        print("Both concurrent injections completed.")
        db.commit() # clear local session implicitly seen state
        cc_count = db.query(Beneficiary).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        print(f"Concurrent created: {cc_count}")
        assert cc_count == 100
        print("Test E Passed!")

        db.commit() # Close implicit tx
        SimulationService.reset_simulation(db)

        print("====== TEST F: Crash Mid-Injection ======")
        def mock_bulk_save(*args, **kwargs):
            raise RuntimeError("Artificially crashing mid-injection")
        
        with patch.object(Session, 'bulk_save_objects', side_effect=mock_bulk_save):
            try:
                SimulationService.inject_ghost_beneficiaries(db, count=25)
                print("FAILED: Should have crashed")
            except Exception as e:
                print(f"Caught expected crash: {e}")
        
        # Test transaction rollback
        db.commit() # implicitly close the session read transaction for the queries
        crash_count = db.query(Beneficiary).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        print(f"Simulated rows after crash (should be 0): {crash_count}")
        assert crash_count == 0
        print("Test F Passed!")

        print("====== TEST G: Mixed Scenario ======")
        db.commit()
        SimulationService.inject_ghost_beneficiaries(db, count=30)
        SimulationService.inject_complaint_spike(db, count=10)
        SimulationService.inject_stock_mismatch(db, month_year="2026-02")
        
        db.commit()
        mixed_bens = db.query(Beneficiary).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        mixed_comps = db.query(Complaint).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        backups = db.query(EntitlementSimulationBackup).count()
        print(f"Mixed State -> Bens: {mixed_bens}, Comps: {mixed_comps}, Backups: {backups}")
        
        db.commit() # Close implicit tx
        SimulationService.reset_simulation(db)
        
        db.commit()
        final_sim_bens = db.query(Beneficiary).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        final_comps_count = db.query(Complaint).filter_by(shop_id="DEMO_001", is_simulated=True).count()
        final_backups = db.query(EntitlementSimulationBackup).count()
        print(f"Post Mixed-Reset -> Bens: {final_sim_bens}, Comps: {final_comps_count}, Backups: {final_backups}")
        assert final_sim_bens == 0
        assert final_comps_count == 0
        assert final_backups == 0
        
        ent = db.query(Entitlement).filter_by(ration_card="REAL_DEMO_01", month_year="2026-02").first()
        print(f"Restored Entitlement: Wheat={ent.wheat}")
        assert ent.wheat == 10.0
        print("Test G Passed!")

        print("====== TEST H: Reset Idempotency ======")
        db.commit() # Close implicit tx
        resH1 = SimulationService.reset_simulation(db)
        resH2 = SimulationService.reset_simulation(db)
        print(f"Reset 1 metrics: {resH1['deleted_beneficiaries']}, Reset 2 metrics: {resH2['deleted_beneficiaries']}")
        assert resH2['deleted_beneficiaries'] == 0
        assert resH2['restored_entitlements'] == 0
        print("Test H Passed!")

        print("====== TEST I: Inflation Factor Safety ======")
        try:
            SimulationService.inject_stock_mismatch(db, month_year="2026-02", inflation_factor=0.5)
            print("FAILED: Should not allow inflation factor <= 1.0")
            assert False
        except ValueError as e:
            print(f"Caught expected ValueError: {e}")
            print("Test I Passed!")

        print("====== TEST J: Partial Backup Deletion Resilience ======")
        # Inject standard stock mismatch
        SimulationService.inject_stock_mismatch(db, month_year="2026-02", inflation_factor=2.0)
        
        # Manually delete the backup directly mimicking a partial backup state
        print("Manually deleting backup row to simulate partial corruption...")
        db.query(EntitlementSimulationBackup).filter_by(ration_card="REAL_DEMO_01").delete()
        db.commit() # commit the manual deletion

        # Try to reset
        print("Resetting over a partial backup state...")
        resJ = SimulationService.reset_simulation(db)
        
        # Verify it didn't crash and restored what it could (which is 0 in this case, but it shouldn't crash)
        print(f"Restored entitlements: {resJ['restored_entitlements']}")
        assert resJ['restored_entitlements'] == baseline_bens - 1
        
        # Note: Since the backup was deleted, REAL_DEMO_01 will still have the 2.0x inflated values
        # in the DB right now. Let's manually fix it up after the test completes for cleanliness if desired,
        # but the test itself is passing if the reset operation didn't crash.
        inflated_ent = db.query(Entitlement).filter_by(ration_card="REAL_DEMO_01", month_year="2026-02").first()
        inflated_ent.wheat /= 2.0
        inflated_ent.rice /= 2.0
        inflated_ent.sugar /= 2.0
        db.commit()
        
        print("Test J Passed!")
        
        print("\n====== FINAL BLOCKCHAIN ISOLATION CHECK ======")
        final_ledg_count = db.query(BlockchainLedger).count()
        print(f"Final Ledger Count: {final_ledg_count} (Baseline: {pre_ledg_count})")
        assert final_ledg_count == pre_ledg_count, "Blockchain was modified during simulation!"
        print("✅ Blockchain Isolation Confirmed")

    except Exception as e:
        print("Test Suite Error:", e)
        db.rollback()
        raise e
    finally:
        # Final cleanup
        db.commit() # Close implicit tx
        try:
            SimulationService.reset_simulation(db)
        except Exception:
            pass
        db.close()

if __name__ == "__main__":
    run_tests()
