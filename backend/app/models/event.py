from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, Boolean, String, DateTime, Text
from app.database import Base

class EventLog(Base):
    __tablename__ = "event_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    event_type = Column(String(32), nullable=False, index=True)  # STATUS_CHANGE, SENSOR_ERROR, DISCONNECT, ALERT_TRIGGER, ALERT_CLEAR
    previous_status = Column(String(32), nullable=True)
    new_status = Column(String(32), nullable=False)
    temperature_c = Column(Float, nullable=True)
    mq2_raw = Column(Integer, nullable=True)
    trigger_summary = Column(String(255), nullable=True)  # e.g. "Smoke (612 >= 400) & Temp (52.3C >= 50.0C)"
    description = Column(Text, nullable=False)
    acknowledged = Column(Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "event_type": self.event_type,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "temperature_c": self.temperature_c,
            "mq2_raw": self.mq2_raw,
            "trigger_summary": self.trigger_summary,
            "description": self.description,
            "acknowledged": self.acknowledged
        }
