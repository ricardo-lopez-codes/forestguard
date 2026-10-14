import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.settings import SystemSettings

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(
            threshold_temp=50.0,
            threshold_mq2=400,
            debounce_samples=3,
            stale_timeout_sec=5.0,
            notifications_enabled=False
        )
        db.add(settings)
        db.commit()
    db.close()
    yield

def test_healthcheck():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["system"] == "ForestGuard"

def test_get_current_telemetry():
    response = client.get("/api/telemetry/current")
    assert response.status_code == 200
    data = response.json()
    assert "thresholds" in data
    assert "mode" in data

def test_get_telemetry_history():
    response = client.get("/api/telemetry/history?range=1h")
    assert response.status_code == 200
    data = response.json()
    assert data["range"] == "1h"
    assert "stats" in data
    assert "data" in data

def test_get_and_update_settings():
    # GET settings
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    initial = get_res.json()

    # PUT settings
    put_res = client.put("/api/settings", json={
        "threshold_temp": 48.5,
        "threshold_mq2": 450,
        "debounce_samples": 4
    })
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["threshold_temp"] == 48.5
    assert updated["threshold_mq2"] == 450
    assert updated["debounce_samples"] == 4

def test_get_events():
    response = client.get("/api/events")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "events" in data

def test_serial_ports_list():
    response = client.get("/api/serial/ports")
    assert response.status_code == 200
    data = response.json()
    assert "ports" in data
    assert "mode" in data

def test_switch_mode():
    response = client.post("/api/serial/mode", json={"mode": "demo", "scenario": "smoke_spike"})
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "demo"
    assert data["scenario"] == "smoke_spike"

def test_notification_logs():
    response = client.get("/api/notifications/logs")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_root_serves_frontend():
    response = client.get("/")
    assert response.status_code == 200
    assert "ForestGuard" in response.text or "html" in response.text.lower()

