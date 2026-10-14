import pytest
from app.services.alert_evaluator import AlertEvaluator
from app.database import Base, engine, SessionLocal
from app.models.settings import SystemSettings
from app.models.event import EventLog

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean tables
    db.query(EventLog).delete()
    db.query(SystemSettings).delete()
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

@pytest.mark.asyncio
async def test_debouncing_prevents_single_spike_false_alarm():
    evaluator = AlertEvaluator()
    db = SessionLocal()
    settings = db.query(SystemSettings).first()

    # Initial state is OFFLINE; first reading establishes baseline
    res1 = await evaluator.process_reading(
        db, temperature_c=24.0, mq2_raw=180, temp_valid=True, settings=settings
    )
    assert res1.status == "NORMAL"

    # Single transient spike in smoke (e.g. noise pulse of 600 for 1 cycle)
    # Debounce threshold is 3 consecutive samples!
    res2 = await evaluator.process_reading(
        db, temperature_c=24.0, mq2_raw=600, temp_valid=True, settings=settings
    )
    # Status should still remain NORMAL because count is 1 < 3
    assert res2.status == "NORMAL"
    assert evaluator.candidate_status == "WATCH"
    assert evaluator.candidate_count == 1

    # Second sample with spike
    res3 = await evaluator.process_reading(
        db, temperature_c=24.0, mq2_raw=600, temp_valid=True, settings=settings
    )
    assert res3.status == "NORMAL"
    assert evaluator.candidate_count == 2

    # Third consecutive sample with spike -> now officially promotes to WATCH
    res4 = await evaluator.process_reading(
        db, temperature_c=24.0, mq2_raw=600, temp_valid=True, settings=settings
    )
    assert res4.status == "WATCH"
    assert res4.status_changed is True

    # Check event log recorded
    event = db.query(EventLog).filter(EventLog.new_status == "WATCH").first()
    assert event is not None
    assert "Smoke: MQ-2 600 >= 400" in event.trigger_summary

    db.close()
