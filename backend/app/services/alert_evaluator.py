from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.event import EventLog
from app.models.settings import SystemSettings
from app.services.notifications.service import notification_service

@dataclass
class AlertEvaluationResult:
    status: str                         # NORMAL, WATCH, POTENTIAL FIRE ALERT, SENSOR ERROR, OFFLINE
    smoke_detected: bool
    high_temperature: bool
    temp_valid: bool
    temperature_c: Optional[float]
    mq2_raw: int
    trigger_summary: str
    status_changed: bool
    previous_status: Optional[str]

class AlertEvaluator:
    def __init__(self):
        self.current_status: str = "OFFLINE"
        self.candidate_status: Optional[str] = None
        self.candidate_count: int = 0
        self.last_reading_time: Optional[datetime] = None

    def evaluate_raw(
        self,
        temperature_c: Optional[float],
        mq2_raw: int,
        temp_valid: bool,
        threshold_temp: float,
        threshold_mq2: int
    ) -> Tuple[str, bool, bool, str]:
        """
        Pure rule-based status evaluation per specification:
        - If temperature sensor is invalid -> SENSOR ERROR
        - Else if smoke_detected AND high_temperature -> POTENTIAL FIRE ALERT
        - Else if smoke_detected OR high_temperature -> WATCH
        - Else -> NORMAL
        """
        smoke_detected = (mq2_raw >= threshold_mq2)
        high_temperature = (temp_valid and temperature_c is not None and temperature_c >= threshold_temp)

        trigger_parts = []
        if smoke_detected:
            trigger_parts.append(f"Smoke: MQ-2 {mq2_raw} >= {threshold_mq2}")
        else:
            trigger_parts.append(f"Smoke: MQ-2 {mq2_raw} < {threshold_mq2}")

        if not temp_valid or temperature_c is None:
            trigger_parts.append("Temp: SENSOR INVALID")
        elif high_temperature:
            trigger_parts.append(f"Temp: {temperature_c:.1f}°C >= {threshold_temp:.1f}°C")
        else:
            trigger_parts.append(f"Temp: {temperature_c:.1f}°C < {threshold_temp:.1f}°C")

        trigger_summary = " | ".join(trigger_parts)

        if not temp_valid or temperature_c is None:
            status = "SENSOR ERROR"
        elif smoke_detected and high_temperature:
            status = "POTENTIAL FIRE ALERT"
        elif smoke_detected or high_temperature:
            status = "WATCH"
        else:
            status = "NORMAL"

        return status, smoke_detected, high_temperature, trigger_summary

    async def process_reading(
        self,
        db: Session,
        temperature_c: Optional[float],
        mq2_raw: int,
        temp_valid: bool,
        settings: SystemSettings,
        reading_time: Optional[datetime] = None
    ) -> AlertEvaluationResult:
        if reading_time is None:
            reading_time = datetime.now(timezone.utc)
        self.last_reading_time = reading_time

        raw_status, smoke_detected, high_temperature, trigger_summary = self.evaluate_raw(
            temperature_c=temperature_c,
            mq2_raw=mq2_raw,
            temp_valid=temp_valid,
            threshold_temp=settings.threshold_temp,
            threshold_mq2=settings.threshold_mq2
        )

        # Apply debounce / persistence logic
        debounce_target = max(1, settings.debounce_samples)

        # Immediate promotion for critical or error conditions if configured,
        # but debouncing prevents transient single-sample noise spikes
        if self.candidate_status == raw_status:
            self.candidate_count += 1
        else:
            self.candidate_status = raw_status
            self.candidate_count = 1

        previous_status = self.current_status
        status_changed = False

        if self.candidate_count >= debounce_target or self.current_status == "OFFLINE":
            target_status = self.candidate_status
            if self.current_status != target_status:
                self.current_status = target_status
                status_changed = True

                # Determine event type
                if target_status == "POTENTIAL FIRE ALERT":
                    event_type = "ALERT_TRIGGER"
                    desc = f"POTENTIAL FIRE ALERT triggered: {trigger_summary}"
                elif target_status == "WATCH":
                    event_type = "STATUS_CHANGE"
                    desc = f"System entered WATCH state: {trigger_summary}"
                elif target_status == "SENSOR ERROR":
                    event_type = "SENSOR_ERROR"
                    desc = f"Sensor failure detected: Temperature sensor invalid. {trigger_summary}"
                elif target_status == "NORMAL":
                    event_type = "ALERT_CLEAR" if previous_status in ["POTENTIAL FIRE ALERT", "WATCH"] else "STATUS_CHANGE"
                    desc = f"System returned to NORMAL: {trigger_summary}"
                else:
                    event_type = "STATUS_CHANGE"
                    desc = f"Status changed to {target_status}: {trigger_summary}"

                # Persist event log
                event = EventLog(
                    event_type=event_type,
                    previous_status=previous_status,
                    new_status=target_status,
                    temperature_c=temperature_c,
                    mq2_raw=mq2_raw,
                    trigger_summary=trigger_summary,
                    description=desc
                )
                db.add(event)
                db.commit()

                # Dispatch notifications if appropriate
                await notification_service.handle_status_transition(
                    db=db,
                    previous_status=previous_status,
                    new_status=target_status,
                    temperature_c=temperature_c,
                    mq2_raw=mq2_raw
                )

        return AlertEvaluationResult(
            status=self.current_status,
            smoke_detected=smoke_detected,
            high_temperature=high_temperature,
            temp_valid=temp_valid,
            temperature_c=temperature_c,
            mq2_raw=mq2_raw,
            trigger_summary=trigger_summary,
            status_changed=status_changed,
            previous_status=previous_status
        )

    async def check_stale(self, db: Session, stale_timeout_sec: float) -> Optional[EventLog]:
        """Check if telemetry has stopped arriving and mark OFFLINE."""
        if self.last_reading_time is None:
            return None

        elapsed = (datetime.now(timezone.utc) - self.last_reading_time).total_seconds()
        if elapsed > stale_timeout_sec and self.current_status != "OFFLINE":
            prev = self.current_status
            self.current_status = "OFFLINE"
            self.candidate_status = "OFFLINE"
            self.candidate_count = 0

            event = EventLog(
                event_type="DISCONNECT",
                previous_status=prev,
                new_status="OFFLINE",
                temperature_c=None,
                mq2_raw=None,
                trigger_summary=f"No telemetry received for {elapsed:.1f}s (stale threshold: {stale_timeout_sec}s)",
                description=f"Sensor bridge telemetry became stale after {elapsed:.1f}s. System marked OFFLINE."
            )
            db.add(event)
            db.commit()
            return event

        return None
