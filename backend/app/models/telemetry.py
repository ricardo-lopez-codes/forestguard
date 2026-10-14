from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, Boolean, String, DateTime
from app.database import Base

class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    temperature_c = Column(Float, nullable=True)
    mq2_raw = Column(Integer, nullable=False)
    smoke_detected = Column(Boolean, nullable=False, default=False)
    high_temperature = Column(Boolean, nullable=False, default=False)
    temp_valid = Column(Boolean, nullable=False, default=True)
    status = Column(String(32), nullable=False, index=True)
    mode = Column(String(16), nullable=False, default="live")  # "live" or "demo"
    uptime_ms = Column(Integer, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "temperature_c": self.temperature_c,
            "mq2_raw": self.mq2_raw,
            "smoke_detected": self.smoke_detected,
            "high_temperature": self.high_temperature,
            "temp_valid": self.temp_valid,
            "status": self.status,
            "mode": self.mode,
            "uptime_ms": self.uptime_ms
        }
