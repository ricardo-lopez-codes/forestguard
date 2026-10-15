from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.settings import SystemSettings
from app.services.sensor_bridge import sensor_bridge

router = APIRouter(prefix="/api/serial", tags=["serial"])

class ConnectPortRequest(BaseModel):
    port: str
    baud_rate: Optional[int] = 115200

class SwitchModeRequest(BaseModel):
    mode: str  # "live" or "demo"
    scenario: Optional[str] = "normal"

@router.get("/ports")
def list_serial_ports():
    return {
        "ports": sensor_bridge.list_available_ports(),
        "active_port": sensor_bridge.serial_port_name,
        "is_connected": sensor_bridge.is_connected,
        "mode": sensor_bridge.current_mode
    }

@router.post("/connect")
def connect_serial_port(payload: ConnectPortRequest):
    sensor_bridge.serial_port_name = payload.port
    sensor_bridge.baud_rate = payload.baud_rate or 115200
    sensor_bridge.set_mode("live")
    sensor_bridge._connect_serial()

    return {
        "success": sensor_bridge.is_connected,
        "port": sensor_bridge.serial_port_name,
        "baud_rate": sensor_bridge.baud_rate,
        "is_connected": sensor_bridge.is_connected
    }

@router.post("/disconnect")
def disconnect_serial_port():
    sensor_bridge._disconnect_serial()
    return {"success": True, "message": "Serial connection closed"}

@router.post("/mode")
def set_bridge_mode(payload: SwitchModeRequest, db: Session = Depends(get_db)):
    if payload.mode not in ["live", "demo"]:
        raise HTTPException(status_code=400, detail="Mode must be 'live' or 'demo'")
    sensor_bridge.set_mode(payload.mode, payload.scenario)

    settings = db.query(SystemSettings).first()
    if settings:
        settings.demo_mode = (payload.mode == "demo")
        if payload.scenario:
            settings.demo_scenario = payload.scenario
        db.commit()

    return {
        "mode": sensor_bridge.current_mode,
        "scenario": sensor_bridge.demo_scenario,
        "is_connected": sensor_bridge.is_connected
    }
