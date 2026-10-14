from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import SystemSettings
from app.services.sensor_bridge import sensor_bridge

router = APIRouter(prefix="/api/settings", tags=["settings"])

class UpdateSettingsRequest(BaseModel):
    threshold_temp: Optional[float] = Field(None, ge=-20.0, le=100.0)
    threshold_mq2: Optional[int] = Field(None, ge=50, le=1023)
    debounce_samples: Optional[int] = Field(None, ge=1, le=20)
    stale_timeout_sec: Optional[float] = Field(None, ge=2.0, le=60.0)
    notifications_enabled: Optional[bool] = None
    notification_provider: Optional[str] = Field(None, pattern="^(ntfy|webhook)$")
    ntfy_server: Optional[str] = None
    ntfy_topic: Optional[str] = None
    webhook_url: Optional[str] = None
    demo_mode: Optional[bool] = None
    demo_scenario: Optional[str] = Field(None, pattern="^(normal|smoke_spike|temp_spike|fire_alert|sensor_error|recovering)$")

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
    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    # Sync bridge mode if changed
    if payload.demo_mode is not None:
        sensor_bridge.set_mode("demo" if settings.demo_mode else "live")
    if payload.demo_scenario is not None:
        sensor_bridge.demo_scenario = settings.demo_scenario

    return settings.to_dict()
