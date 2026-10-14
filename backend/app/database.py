from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import config

engine = create_engine(
    config.database_url,
    connect_args={"check_same_thread": False}  # Needed for SQLite in multi-threaded/async FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.models.telemetry import TelemetryReading
    from app.models.event import EventLog
    from app.models.settings import SystemSettings
    from app.models.notification import NotificationLog
    Base.metadata.create_all(bind=engine)
    
    # Initialize default settings if not exists
    db = SessionLocal()
    try:
        settings = db.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings(
                threshold_temp=config.default_temp_threshold,
                threshold_mq2=config.default_mq2_threshold,
                debounce_samples=config.default_debounce_samples,
                stale_timeout_sec=config.stale_timeout_sec,
                notifications_enabled=False,
                notification_provider="ntfy",
                ntfy_server="https://ntfy.sh",
                ntfy_topic="forestguard-alerts-demo",
                webhook_url="",
                demo_mode=config.default_demo_mode
            )
            db.add(settings)
            db.commit()
    finally:
        db.close()
