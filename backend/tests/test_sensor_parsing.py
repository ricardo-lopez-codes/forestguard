import pytest
from app.services.sensor_bridge import SensorBridge

@pytest.fixture
def bridge():
    return SensorBridge()

def test_parse_valid_json(bridge):
    line = '{"temp": 24.38, "mq2": 185, "temp_valid": true, "uptime_ms": 12400}'
    result = bridge.parse_serial_line(line)
    assert result is not None
    assert result["temperature_c"] == 24.38
    assert result["mq2_raw"] == 185
    assert result["temp_valid"] is True
    assert result["uptime_ms"] == 12400

def test_parse_invalid_temp_json(bridge):
    line = '{"temp": null, "mq2": 210, "temp_valid": false, "uptime_ms": 15000}'
    result = bridge.parse_serial_line(line)
    assert result is not None
    assert result["temperature_c"] is None
    assert result["mq2_raw"] == 210
    assert result["temp_valid"] is False

def test_parse_csv_fallback(bridge):
    line = "27.5, 340, 1"
    result = bridge.parse_serial_line(line)
    assert result is not None
    assert result["temperature_c"] == 27.5
    assert result["mq2_raw"] == 340
    assert result["temp_valid"] is True

def test_parse_malformed_packets(bridge):
    # Garbage serial data
    assert bridge.parse_serial_line("") is None
    assert bridge.parse_serial_line("   \r\n") is None
    assert bridge.parse_serial_line("{corrupted_json") is None
    assert bridge.parse_serial_line("garbage,string,not_numbers") is None

def test_parse_out_of_range_mq2(bridge):
    # ADC is 10-bit: 0 to 1023
    assert bridge.parse_serial_line('{"temp": 25.0, "mq2": 2048, "temp_valid": true}') is None
    assert bridge.parse_serial_line('{"temp": 25.0, "mq2": -5, "temp_valid": true}') is None
