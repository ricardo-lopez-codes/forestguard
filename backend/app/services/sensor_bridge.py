import asyncio
import json
import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import serial
import serial.tools.list_ports
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.telemetry import TelemetryReading
from app.models.settings import SystemSettings
from app.services.alert_evaluator import AlertEvaluator, AlertEvaluationResult

logger = logging.getLogger("forestguard.bridge")

class SensorBridge:
    def __init__(self):
        self.evaluator = AlertEvaluator()
        self.serial_port_name: Optional[str] = None
        self.baud_rate: int = 115200
        self.serial_conn: Optional[serial.Serial] = None
        
        self.is_running: bool = False
        self.is_connected: bool = False
        self.current_mode: str = "demo"  # "live" or "demo"
        self.demo_scenario: str = "normal"
        self.last_reading: Optional[Dict[str, Any]] = None
        self.last_read_timestamp: Optional[datetime] = None
        self.last_remote_push_time: Optional[datetime] = None

        # Demo generator internal state
        self._demo_tick: int = 0
        self._demo_base_temp: float = 23.5
        self._demo_base_mq2: int = 160
        self._listeners = set()

    def add_listener(self, callback):
        self._listeners.add(callback)

    def remove_listener(self, callback):
        self._listeners.discard(callback)

    async def _notify_listeners(self, data: Dict[str, Any]):
        for listener in list(self._listeners):
            try:
                await listener(data)
            except Exception as e:
                logger.error(f"Error notifying telemetry listener: {e}")

    @staticmethod
    def list_available_ports() -> List[Dict[str, str]]:
        """List available COM/Serial ports on system."""
        ports = serial.tools.list_ports.comports()
        result = []
        for p in ports:
            result.append({
                "device": p.device,
                "description": p.description,
                "hwid": p.hwid or ""
            })
        return result

    def set_mode(self, mode: str, scenario: Optional[str] = None):
        """Toggle between 'live' (USB Serial) and 'demo' (deterministic simulation)."""
        if mode in ["live", "demo"]:
            self.current_mode = mode
        if scenario:
            self.demo_scenario = scenario
        logger.info(f"SensorBridge mode set to {self.current_mode} (scenario: {self.demo_scenario})")

    def parse_serial_line(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Parse raw line from Arduino USB Serial.
        Handles JSON format: {"temp": 24.5, "mq2": 180, "temp_valid": true, "uptime_ms": 12000}
        And fallback CSV format: 24.5,180,1
        """
        line = line.strip()
        if not line:
            return None

        # Try JSON
        if line.startswith("{") and line.endswith("}"):
            try:
                data = json.loads(line)
                # Ignore system ready greeting pulses
                if "system" in data and "status" in data:
                    return None

                temp_val = data.get("temp")
                temp_c = float(temp_val) if temp_val is not None else None
                mq2_raw = int(data.get("mq2", 0))
                temp_valid = bool(data.get("temp_valid", temp_c is not None))
                uptime_ms = data.get("uptime_ms")

                # Range sanity check
                if mq2_raw < 0 or mq2_raw > 1023:
                    logger.warning(f"MQ-2 raw value out of range (0-1023): {mq2_raw}")
                    return None
                if temp_c is not None and (temp_c < -55.0 or temp_c > 125.0):
                    temp_valid = False
                    temp_c = None

                return {
                    "temperature_c": temp_c,
                    "mq2_raw": mq2_raw,
                    "temp_valid": temp_valid,
                    "uptime_ms": uptime_ms
                }
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Malformed JSON serial packet: {line} ({e})")
                return None

        # Fallback CSV: temp,mq2,temp_valid
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2:
            try:
                temp_str = parts[0]
                temp_valid = True
                temp_c = None
                if temp_str.lower() in ["err", "null", "none", "nan", "-127", "85"]:
                    temp_valid = False
                else:
                    temp_c = float(temp_str)
                    if temp_c < -55.0 or temp_c > 125.0:
                        temp_valid = False
                        temp_c = None

                mq2_raw = int(parts[1])
                if len(parts) >= 3:
                    temp_valid = parts[2].lower() in ["1", "true", "yes"] and temp_valid

                return {
                    "temperature_c": temp_c,
                    "mq2_raw": mq2_raw,
                    "temp_valid": temp_valid,
                    "uptime_ms": None
                }
            except ValueError as e:
                logger.warning(f"Malformed CSV serial packet: {line} ({e})")
                return None

        return None

    def _generate_demo_telemetry(self) -> Dict[str, Any]:
        """
        Generate realistic, deterministic telemetry based on selected demo scenario.
        Clearly marked as mode="demo" throughout system.
        """
        self._demo_tick += 1
        t = self._demo_tick

        if self.demo_scenario == "normal":
            temp_c = round(self._demo_base_temp + 0.4 * math.sin(t * 0.1) + random.uniform(-0.15, 0.15), 1)
            mq2_raw = int(self._demo_base_mq2 + 8 * math.sin(t * 0.15) + random.randint(-4, 4))
            temp_valid = True

        elif self.demo_scenario == "smoke_spike":
            # Normal temp, high smoke
            temp_c = round(24.2 + random.uniform(-0.1, 0.1), 1)
            # Ramps up to ~650
            progress = min(1.0, t / 8.0)
            mq2_raw = int(160 + progress * (580 - 160) + random.randint(-10, 10))
            temp_valid = True

        elif self.demo_scenario == "temp_spike":
            # High temp, normal smoke
            progress = min(1.0, t / 8.0)
            temp_c = round(25.0 + progress * (56.0 - 25.0) + random.uniform(-0.2, 0.2), 1)
            mq2_raw = int(170 + random.randint(-5, 5))
            temp_valid = True

        elif self.demo_scenario == "fire_alert":
            # Both high temp and high smoke
            progress = min(1.0, t / 8.0)
            temp_c = round(25.0 + progress * (58.5 - 25.0) + random.uniform(-0.2, 0.2), 1)
            mq2_raw = int(160 + progress * (680 - 160) + random.randint(-8, 8))
            temp_valid = True

        elif self.demo_scenario == "sensor_error":
            # Temperature sensor failure (DS18B20 disconnected)
            temp_c = None
            temp_valid = False
            mq2_raw = int(180 + random.randint(-5, 5))

        elif self.demo_scenario == "recovering":
            # Cools down back to normal
            progress = max(0.0, 1.0 - (t / 12.0))
            temp_c = round(24.0 + progress * (52.0 - 24.0) + random.uniform(-0.15, 0.15), 1)
            mq2_raw = int(165 + progress * (550 - 165) + random.randint(-6, 6))
            temp_valid = True

        else:
            temp_c = 24.0
            mq2_raw = 170
            temp_valid = True

        return {
            "temperature_c": temp_c,
            "mq2_raw": mq2_raw,
            "temp_valid": temp_valid,
            "uptime_ms": self._demo_tick * 1000
        }

    async def run(self):
        """Main background loop."""
        self.is_running = True
        logger.info("ForestGuard Sensor Bridge started")

        while self.is_running:
            db: Session = SessionLocal()
            try:
                settings = db.query(SystemSettings).first()
                if not settings:
                    await asyncio.sleep(1.0)
                    continue

                # If remote hardware is actively streaming via /api/telemetry/push, yield to live stream
                if self.last_remote_push_time and (datetime.now(timezone.utc) - self.last_remote_push_time).total_seconds() < 10.0:
                    self.current_mode = "live"
                    self.is_connected = True
                    await asyncio.sleep(1.0)
                    continue

                # Sync mode with database settings
                if settings.demo_mode != (self.current_mode == "demo"):
                    self.current_mode = "demo" if settings.demo_mode else "live"
                self.demo_scenario = settings.demo_scenario

                raw_packet: Optional[Dict[str, Any]] = None

                if self.current_mode == "live":
                    # Attempt serial read if connected
                    if not self.serial_conn or not self.serial_conn.is_open:
                        self.is_connected = False
                        self._connect_serial()

                    if self.serial_conn and self.serial_conn.is_open:
                        try:
                            if self.serial_conn.in_waiting > 0:
                                line = self.serial_conn.readline().decode("utf-8", errors="ignore")
                                raw_packet = self.parse_serial_line(line)
                                if raw_packet:
                                    self.is_connected = True
                                    self.last_read_timestamp = datetime.now(timezone.utc)
                        except Exception as e:
                            logger.warning(f"Serial read error: {e}")
                            self._disconnect_serial()
                    
                    # Check for stale serial connection
                    if not raw_packet and self.is_connected:
                        await self.evaluator.check_stale(db, settings.stale_timeout_sec)
                        if (datetime.now(timezone.utc) - (self.last_read_timestamp or datetime.now(timezone.utc))).total_seconds() > settings.stale_timeout_sec:
                            self.is_connected = False

                else:
                    # Demo Mode
                    self.is_connected = True
                    raw_packet = self._generate_demo_telemetry()
                    self.last_read_timestamp = datetime.now(timezone.utc)

                if raw_packet:
                    # Process reading through alert logic
                    eval_result: AlertEvaluationResult = await self.evaluator.process_reading(
                        db=db,
                        temperature_c=raw_packet["temperature_c"],
                        mq2_raw=raw_packet["mq2_raw"],
                        temp_valid=raw_packet["temp_valid"],
                        settings=settings,
                        reading_time=self.last_read_timestamp
                    )

                    # Persist reading to database
                    reading = TelemetryReading(
                        timestamp=self.last_read_timestamp,
                        temperature_c=raw_packet["temperature_c"],
                        mq2_raw=raw_packet["mq2_raw"],
                        smoke_detected=eval_result.smoke_detected,
                        high_temperature=eval_result.high_temperature,
                        temp_valid=raw_packet["temp_valid"],
                        status=eval_result.status,
                        mode=self.current_mode,
                        uptime_ms=raw_packet.get("uptime_ms")
                    )
                    db.add(reading)
                    db.commit()

                    # Store last reading cache
                    packet_dict = reading.to_dict()
                    packet_dict["trigger_summary"] = eval_result.trigger_summary
                    packet_dict["is_connected"] = self.is_connected
                    packet_dict["serial_port"] = self.serial_port_name if self.current_mode == "live" else "SIMULATED"
                    self.last_reading = packet_dict

                    # Broadcast to active WebSockets
                    await self._notify_listeners({
                        "type": "telemetry",
                        "data": packet_dict
                    })

            except Exception as e:
                logger.error(f"Error in sensor bridge cycle: {e}", exc_info=True)
            finally:
                db.close()

            # 1 Hz sampling cycle
            await asyncio.sleep(1.0)

    def _connect_serial(self):
        """Attempt to open configured or auto-detected serial port."""
        target_port = self.serial_port_name
        if not target_port or target_port == "AUTO":
            ports = self.list_available_ports()
            # Search for typical Arduino Nano USB chips (CH340, FTDI, CP210x, Arduino)
            nano_ports = [p["device"] for p in ports if any(k in p["description"].lower() or k in p["hwid"].lower() for k in ["ch340", "ftdi", "nano", "arduino", "serial", "usb"])]
            target_port = nano_ports[0] if nano_ports else (ports[0]["device"] if ports else None)

        if not target_port:
            return

        try:
            self.serial_conn = serial.Serial(
                port=target_port,
                baudrate=self.baud_rate,
                timeout=0.2
            )
            self.serial_port_name = target_port
            logger.info(f"Connected to Arduino Nano on {target_port} at {self.baud_rate} baud")
        except Exception as e:
            # Serial device might not be plugged in
            self.serial_conn = None

    def _disconnect_serial(self):
        if self.serial_conn:
            try:
                self.serial_conn.close()
            except Exception:
                pass
            self.serial_conn = None
        self.is_connected = False

sensor_bridge = SensorBridge()
