from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.telemetry import TelemetryReading
from app.models.settings import SystemSettings
from app.services.sensor_bridge import sensor_bridge

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

@router.get("/current")
def get_current_telemetry(db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    last = sensor_bridge.last_reading

    if not last:
        # Fallback to last DB reading
        db_reading = db.query(TelemetryReading).order_by(TelemetryReading.id.desc()).first()
        if db_reading:
            last = db_reading.to_dict()
            last["is_connected"] = sensor_bridge.is_connected
            last["serial_port"] = sensor_bridge.serial_port_name

    return {
        "reading": last,
        "is_connected": sensor_bridge.is_connected,
        "mode": sensor_bridge.current_mode,
        "demo_scenario": sensor_bridge.demo_scenario,
        "serial_port": sensor_bridge.serial_port_name,
        "thresholds": {
            "temperature": settings.threshold_temp if settings else 50.0,
            "smoke_mq2": settings.threshold_mq2 if settings else 400,
            "debounce_samples": settings.debounce_samples if settings else 3,
            "stale_timeout_sec": settings.stale_timeout_sec if settings else 5.0
        }
    }

@router.get("/history")
def get_telemetry_history(
    time_range: str = Query("1h", alias="range", pattern="^(15m|1h|6h|24h)$"),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    delta_map = {
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24)
    }
    cutoff = now - delta_map[time_range]

    # Query readings since cutoff
    readings = db.query(TelemetryReading).filter(
        TelemetryReading.timestamp >= cutoff
    ).order_by(TelemetryReading.timestamp.asc()).all()

    # If there are a large number of readings (e.g. for 24h: up to 86,400 data points), downsample evenly
    max_points = 300
    total = len(readings)
    if total > max_points:
        step = total / max_points
        sampled = [readings[int(i * step)] for i in range(max_points)]
    else:
        sampled = readings

    # Compute statistics over actual valid data
    valid_temps = [r.temperature_c for r in readings if r.temp_valid and r.temperature_c is not None]
    mq2_vals = [r.mq2_raw for r in readings]

    stats = {
        "temp_min": min(valid_temps) if valid_temps else None,
        "temp_max": max(valid_temps) if valid_temps else None,
        "temp_avg": round(sum(valid_temps) / len(valid_temps), 1) if valid_temps else None,
        "mq2_min": min(mq2_vals) if mq2_vals else None,
        "mq2_max": max(mq2_vals) if mq2_vals else None,
        "mq2_avg": round(sum(mq2_vals) / len(mq2_vals), 0) if mq2_vals else None,
        "sample_count": total
    }

    return {
        "range": time_range,
        "stats": stats,
        "data": [
            {
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "temperature_c": r.temperature_c if r.temp_valid else None,
                "mq2_raw": r.mq2_raw,
                "temp_valid": r.temp_valid,
                "status": r.status,
                "mode": r.mode
            }
            for r in sampled
        ]
    }

from pydantic import BaseModel

class PushTelemetryRequest(BaseModel):
    temperature_c: Optional[float] = None
    mq2_raw: int
    temp_valid: bool = True
    uptime_ms: Optional[int] = None
    serial_port: Optional[str] = "REMOTE_GATEWAY"

@router.post("/push")
async def push_remote_telemetry(payload: PushTelemetryRequest, db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    now_utc = datetime.now(timezone.utc)

    eval_result = await sensor_bridge.evaluator.process_reading(
        db=db,
        temperature_c=payload.temperature_c,
        mq2_raw=payload.mq2_raw,
        temp_valid=payload.temp_valid,
        settings=settings,
        reading_time=now_utc
    )

    reading = TelemetryReading(
        timestamp=now_utc,
        temperature_c=payload.temperature_c,
        mq2_raw=payload.mq2_raw,
        smoke_detected=eval_result.smoke_detected,
        high_temperature=eval_result.high_temperature,
        temp_valid=payload.temp_valid,
        status=eval_result.status,
        mode="live",
        uptime_ms=payload.uptime_ms
    )
    db.add(reading)
    db.commit()

    packet = reading.to_dict()
    packet["trigger_summary"] = eval_result.trigger_summary
    packet["is_connected"] = True
    packet["serial_port"] = payload.serial_port
    packet["threshold_temp"] = settings.threshold_temp if settings else 50.0
    packet["threshold_mq2"] = settings.threshold_mq2 if settings else 400
    sensor_bridge.last_reading = packet
    sensor_bridge.current_mode = "live"
    sensor_bridge.is_connected = True
    sensor_bridge.last_read_timestamp = now_utc
    sensor_bridge.last_remote_push_time = now_utc
    if settings and settings.demo_mode:
        settings.demo_mode = False
        db.commit()

    await sensor_bridge._notify_listeners({
        "type": "telemetry",
        "data": packet
    })

    return {
        "success": True, 
        "reading": packet,
        "threshold_temp": settings.threshold_temp if settings else 50.0,
        "threshold_mq2": settings.threshold_mq2 if settings else 400
    }

