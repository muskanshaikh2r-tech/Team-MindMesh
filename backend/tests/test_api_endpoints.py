import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import repository

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    repository.init_db()
    repository.reset_models_to_defaults()
    yield

def test_api_models_crud():
    res = client.get("/api/models")
    assert res.status_code == 200
    models = res.json()
    assert len(models) >= 4
    
    # Test update
    update_res = client.put("/api/models/mini", json={"latency_ms": 199.0, "available": False})
    assert update_res.status_code == 200
    updated_model = update_res.json()
    assert updated_model["latency_ms"] == 199.0
    assert updated_model["available"] is False

    # Test reset
    reset_res = client.post("/api/models/reset")
    assert reset_res.status_code == 200
    reset_mini = client.get("/api/models/mini").json()
    assert reset_mini["available"] is True

def test_api_route_endpoint():
    payload = {
        "prompt": "What is 2 + 2?",
        "max_latency_ms": 3000.0,
        "max_cost": 0.05,
        "preference": "lowest_cost"
    }
    res = client.post("/api/route", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status_code"] == "SUCCESS"
    assert "token_metrics" in data
    assert "complexity_analysis" in data
    assert "all_evaluations" in data
    assert "execution_trace" in data

    # Verify saved in history
    hist_res = client.get("/api/history")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    assert history[0]["id"] == data["request_id"]

def test_api_scenarios_endpoint():
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) == 7

def test_api_dashboard_endpoint():
    # Route one request first
    client.post("/api/route", json={"prompt": "Quick test"})
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    dash = res.json()
    assert dash["total_requests"] >= 1
    assert "success_rate_percent" in dash
    assert "model_usage" in dash
