from sqlalchemy import Column, Integer, Float, Boolean, String
from app.database import Base

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, default=1)
    threshold_temp = Column(Float, nullable=False, default=50.0)
    threshold_mq2 = Column(Integer, nullable=False, default=400)
    debounce_samples = Column(Integer, nullable=False, default=3)
    stale_timeout_sec = Column(Float, nullable=False, default=5.0)
    notifications_enabled = Column(Boolean, nullable=False, default=False)
    notification_provider = Column(String(32), nullable=False, default="ntfy")
    ntfy_server = Column(String(255), nullable=False, default="https://ntfy.sh")
    ntfy_topic = Column(String(128), nullable=False, default="forestguard-alerts-demo")
    webhook_url = Column(String(512), nullable=False, default="")
    demo_mode = Column(Boolean, nullable=False, default=True)
    demo_scenario = Column(String(32), nullable=False, default="normal")

    def to_dict(self):
        return {
            "id": self.id,
            "threshold_temp": self.threshold_temp,
            "threshold_mq2": self.threshold_mq2,
            "debounce_samples": self.debounce_samples,
            "stale_timeout_sec": self.stale_timeout_sec,
            "notifications_enabled": self.notifications_enabled,
            "notification_provider": self.notification_provider,
            "ntfy_server": self.ntfy_server,
            "ntfy_topic": self.ntfy_topic,
            "webhook_url": self.webhook_url,
            "demo_mode": self.demo_mode,
            "demo_scenario": self.demo_scenario
        }
