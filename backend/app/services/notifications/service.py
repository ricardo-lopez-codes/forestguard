import logging
from sqlalchemy.orm import Session
from app.models.settings import SystemSettings
from app.models.notification import NotificationLog
from app.services.notifications.ntfy_provider import NtfyProvider
from app.services.notifications.webhook_provider import WebhookProvider
from app.services.notifications.base import BaseNotificationProvider, NotificationResult

logger = logging.getLogger("forestguard.notifications")

class NotificationService:
    def __init__(self):
        self._alert_active_notified: bool = False

    def _get_provider(self, settings: SystemSettings) -> tuple[BaseNotificationProvider, str]:
        if settings.notification_provider == "webhook":
            return WebhookProvider(settings.webhook_url), settings.webhook_url
        # Default to ntfy
        return NtfyProvider(settings.ntfy_server, settings.ntfy_topic), f"{settings.ntfy_server}/{settings.ntfy_topic}"

    async def handle_status_transition(
        self,
        db: Session,
        previous_status: str,
        new_status: str,
        temperature_c: float | None,
        mq2_raw: int
    ) -> None:
        settings = db.query(SystemSettings).first()
        if not settings:
            return

        # Check if entering POTENTIAL FIRE ALERT
        if new_status == "POTENTIAL FIRE ALERT" and not self._alert_active_notified:
            self._alert_active_notified = True
            await self._dispatch(
                db=db,
                settings=settings,
                event_type="POTENTIAL_FIRE_ALERT",
                title="CRITICAL: Forest Fire Threat Detected",
                message=(
                    f"ForestGuard has entered POTENTIAL FIRE ALERT state.\n"
                    f"Readings: Temperature={temperature_c:.1f}°C (Threshold: {settings.threshold_temp:.1f}°C), "
                    f"MQ-2 Raw={mq2_raw} (Threshold: {settings.threshold_mq2}).\n"
                    f"Both smoke and high temperature conditions have been confirmed."
                ) if temperature_c is not None else (
                    f"ForestGuard POTENTIAL FIRE ALERT: MQ-2={mq2_raw} (Threshold: {settings.threshold_mq2})."
                ),
                priority="urgent",
                tags=["rotating_light", "warning", "fire"]
            )

        # Check if transitioning back to NORMAL from an alerted state
        elif new_status == "NORMAL" and self._alert_active_notified:
            self._alert_active_notified = False
            await self._dispatch(
                db=db,
                settings=settings,
                event_type="RESOLVED_NORMAL",
                title="CLEARED: Forest Conditions Normal",
                message=(
                    f"ForestGuard status has returned to NORMAL.\n"
                    f"Readings have stabilized below warning thresholds.\n"
                    f"Temperature={temperature_c:.1f}°C, MQ-2={mq2_raw}."
                ) if temperature_c is not None else (
                    f"ForestGuard status returned to NORMAL. MQ-2={mq2_raw}."
                ),
                priority="low",
                tags=["white_check_mark", "evergreen_tree"]
            )

    async def _dispatch(
        self,
        db: Session,
        settings: SystemSettings,
        event_type: str,
        title: str,
        message: str,
        priority: str = "default",
        tags: list[str] = None
    ) -> NotificationResult:
        provider, target = self._get_provider(settings)

        if not settings.notifications_enabled:
            # Log that notifications are disabled
            log_entry = NotificationLog(
                event_type=event_type,
                provider=settings.notification_provider,
                target=target,
                status="SKIPPED",
                message=message,
                error_details="Notifications are currently disabled in settings"
            )
            db.add(log_entry)
            db.commit()
            return NotificationResult(success=False, error="Notifications are disabled in settings")

        result = await provider.send(title=title, message=message, priority=priority, tags=tags)

        # Persist notification log
        log_entry = NotificationLog(
            event_type=event_type,
            provider=settings.notification_provider,
            target=target,
            status="SENT" if result.success else "FAILED",
            http_status_code=result.status_code,
            message=message,
            error_details=result.error if not result.success else result.details
        )
        db.add(log_entry)
        db.commit()

        if result.success:
            logger.info("Notification successfully delivered: %s", target)
        else:
            logger.warning("Notification delivery failed: %s (%s)", target, result.error)

        return result

    async def send_test(self, db: Session) -> NotificationResult:
        settings = db.query(SystemSettings).first()
        if not settings:
            return NotificationResult(success=False, error="Settings not found in database")

        provider, target = self._get_provider(settings)

        result = await provider.send(
            title="ForestGuard Integration Test",
            message=f"Test push notification dispatched at system request. Target: {target}",
            priority="default",
            tags=["bell", "satellite"]
        )

        log_entry = NotificationLog(
            event_type="TEST",
            provider=settings.notification_provider,
            target=target,
            status="SENT" if result.success else "FAILED",
            http_status_code=result.status_code,
            message=f"Test notification to {target}",
            error_details=result.error if not result.success else result.details
        )
        db.add(log_entry)
        db.commit()

        return result

notification_service = NotificationService()
