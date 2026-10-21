import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import SystemSettings
from app.services.sensor_bridge import sensor_bridge

router = APIRouter(prefix="/api/settings", tags=["settings"])

class UpdateSettingsRequest(BaseModel):
    threshold_temp: Optional[float] = None
    threshold_mq2: Optional[float] = None
    debounce_samples: Optional[int] = None
    stale_timeout_sec: Optional[float] = None
    notifications_enabled: Optional[bool] = None
    notification_provider: Optional[str] = None
    ntfy_server: Optional[str] = None
    ntfy_topic: Optional[str] = None
    webhook_url: Optional[str] = None
    demo_mode: Optional[bool] = None
    demo_scenario: Optional[str] = None

@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not initialized")
    return settings.to_dict()

@router.put("")
def update_settings(payload: UpdateSettingsRequest, db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Normalize fields safely
    if "threshold_mq2" in update_data and update_data["threshold_mq2"] is not None:
        update_data["threshold_mq2"] = int(round(update_data["threshold_mq2"]))
    if "debounce_samples" in update_data and update_data["debounce_samples"] is not None:
        update_data["debounce_samples"] = max(1, int(update_data["debounce_samples"]))
    if "stale_timeout_sec" in update_data and update_data["stale_timeout_sec"] is not None:
        update_data["stale_timeout_sec"] = max(1.0, float(update_data["stale_timeout_sec"]))
    if update_data.get("demo_scenario") == "live":
        update_data["demo_mode"] = False
        update_data["demo_scenario"] = "normal"

    for field, value in update_data.items():
        if hasattr(settings, field):
            setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    # Sync bridge mode if changed
    if payload.demo_mode is not None or "demo_scenario" in update_data:
        sensor_bridge.set_mode("demo" if settings.demo_mode else "live")
        sensor_bridge.demo_scenario = settings.demo_scenario

    # Immediately re-evaluate active telemetry reading against newly customized thresholds
    if sensor_bridge.last_reading:
        temp_val = sensor_bridge.last_reading.get("temperature_c")
        mq2_val = sensor_bridge.last_reading.get("mq2_raw", 0)
        temp_valid = sensor_bridge.last_reading.get("temp_valid", True)

        status, smoke_det, high_t, trig_sum = sensor_bridge.evaluator.evaluate_raw(
            temperature_c=temp_val,
            mq2_raw=mq2_val,
            temp_valid=temp_valid,
            threshold_temp=settings.threshold_temp,
            threshold_mq2=settings.threshold_mq2
        )
        sensor_bridge.last_reading["status"] = status
        sensor_bridge.last_reading["smoke_detected"] = smoke_det
        sensor_bridge.last_reading["high_temperature"] = high_t
        sensor_bridge.last_reading["trigger_summary"] = trig_sum
        sensor_bridge.last_reading["threshold_temp"] = settings.threshold_temp
        sensor_bridge.last_reading["threshold_mq2"] = settings.threshold_mq2

        # Broadcast updated reading so all connected clients reflect new thresholds instantly
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(sensor_bridge._notify_listeners({
                    "type": "telemetry",
                    "data": sensor_bridge.last_reading
                }))
        except Exception:
            pass

    return settings.to_dict()

