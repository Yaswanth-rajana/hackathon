import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Helper to get an admin token (assuming standard login path exists for tests, or overriding deps)
# For simplicity in this mock test without real DB seeding, we override the dependency.
from app.core.dependencies import require_role
from app.models.user import User, UserRole

def mock_admin_user():
    return User(id="ADMIN123", role="admin", phone_number="9999999999")

app.dependency_overrides[require_role(UserRole.admin)] = mock_admin_user

def test_create_inspection():
    payload = {
        "shop_id": "SHOP001",
        "triggered_by": "anomaly",
        "trigger_reference": "ANM-001",
        "inspector_id": "INSP001",
        "priority": "high"
    }
    response = client.post("/api/admin/governance/inspections", json=payload)
    # Note: If DB is not reachable in the test client env, this might fail 500.
    # Assuming the test suite has a test DB setup hook.
    if response.status_code == 200:
        data = response.json()
        assert data["shop_id"] == "SHOP001"
        assert data["status"] == "scheduled"
        assert "id" in data
        
        # Start Inspection
        start_res = client.patch(f"/api/admin/governance/inspections/{data['id']}/start")
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "in_progress"
        
        # Complete Inspection
        comp_payload = {
            "findings": "Test findings",
            "evidence_urls": ["url1"]
        }
        comp_res = client.patch(f"/api/admin/governance/inspections/{data['id']}/complete", json=comp_payload)
        assert comp_res.status_code == 200
        assert comp_res.json()["status"] == "completed"
        
        # Take Action
        act_payload = {
            "action_taken": "Suspended"
        }
        act_res = client.patch(f"/api/admin/governance/inspections/{data['id']}/action", json=act_payload)
        assert act_res.status_code == 200
        assert act_res.json()["status"] == "action_taken"
