import pytest
from app.services.alert_evaluator import AlertEvaluator

@pytest.fixture
def evaluator():
    return AlertEvaluator()

def test_alert_rule_normal(evaluator):
    """When both conditions are below threshold -> NORMAL"""
    status, smoke_det, high_temp, summary = evaluator.evaluate_raw(
        temperature_c=24.5,
        mq2_raw=180,
        temp_valid=True,
        threshold_temp=50.0,
        threshold_mq2=400
    )
    assert status == "NORMAL"
    assert smoke_det is False
    assert high_temp is False
    assert "MQ-2 180 < 400" in summary
    assert "24.5°C < 50.0°C" in summary

def test_alert_rule_watch_smoke_only(evaluator):
    """When only smoke exceeds threshold -> WATCH"""
    status, smoke_det, high_temp, summary = evaluator.evaluate_raw(
        temperature_c=25.0,
        mq2_raw=520,
        temp_valid=True,
        threshold_temp=50.0,
        threshold_mq2=400
    )
    assert status == "WATCH"
    assert smoke_det is True
    assert high_temp is False

def test_alert_rule_watch_temp_only(evaluator):
    """When only temperature exceeds threshold -> WATCH"""
    status, smoke_det, high_temp, summary = evaluator.evaluate_raw(
        temperature_c=55.2,
        mq2_raw=210,
        temp_valid=True,
        threshold_temp=50.0,
        threshold_mq2=400
    )
    assert status == "WATCH"
    assert smoke_det is False
    assert high_temp is True

def test_alert_rule_potential_fire_alert(evaluator):
    """When BOTH smoke AND temperature exceed thresholds -> POTENTIAL FIRE ALERT"""
    status, smoke_det, high_temp, summary = evaluator.evaluate_raw(
        temperature_c=58.0,
        mq2_raw=650,
        temp_valid=True,
        threshold_temp=50.0,
        threshold_mq2=400
    )
    assert status == "POTENTIAL FIRE ALERT"
    assert smoke_det is True
    assert high_temp is True

def test_alert_rule_sensor_error(evaluator):
    """When temperature sensor is invalid -> SENSOR ERROR regardless of smoke"""
    status, smoke_det, high_temp, summary = evaluator.evaluate_raw(
        temperature_c=None,
        mq2_raw=200,
        temp_valid=False,
        threshold_temp=50.0,
        threshold_mq2=400
    )
    assert status == "SENSOR ERROR"
    assert "SENSOR INVALID" in summary
