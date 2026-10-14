from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.database import Base

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    event_type = Column(String(64), nullable=False)
    provider = Column(String(32), nullable=False)
    target = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False)  # SENT, FAILED, SKIPPED
    http_status_code = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    error_details = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "event_type": self.event_type,
            "provider": self.provider,
            "target": self.target,
            "status": self.status,
            "http_status_code": self.http_status_code,
            "message": self.message,
            "error_details": self.error_details
        }
