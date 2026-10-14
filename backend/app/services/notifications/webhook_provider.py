import httpx
from datetime import datetime, timezone
from typing import Optional
from app.services.notifications.base import BaseNotificationProvider, NotificationResult

class WebhookProvider(BaseNotificationProvider):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url.strip()

    async def send(
        self,
        title: str,
        message: str,
        priority: str = "default",
        tags: Optional[list[str]] = None
    ) -> NotificationResult:
        if not self.webhook_url:
            return NotificationResult(
                success=False,
                error="Webhook URL is not configured"
            )

        payload = {
            "title": title,
            "message": message,
            "priority": priority,
            "tags": tags or [],
            "source": "ForestGuard",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

                if 200 <= response.status_code < 300:
                    return NotificationResult(
                        success=True,
                        status_code=response.status_code,
                        details=f"Dispatched via webhook ({self.webhook_url})"
                    )
                else:
                    return NotificationResult(
                        success=False,
                        status_code=response.status_code,
                        error=f"Webhook server responded with code {response.status_code}: {response.text[:200]}"
                    )
        except Exception as e:
            return NotificationResult(
                success=False,
                error=f"Network error connecting to webhook: {str(e)}"
            )

    async def test_connection(self) -> NotificationResult:
        return await self.send(
            title="ForestGuard Webhook Test",
            message="Test payload from ForestGuard. Notification integration verified.",
            priority="default",
            tags=["test"]
        )
