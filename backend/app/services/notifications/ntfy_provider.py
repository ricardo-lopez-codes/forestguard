import httpx
from typing import Optional
from app.services.notifications.base import BaseNotificationProvider, NotificationResult

class NtfyProvider(BaseNotificationProvider):
    def __init__(self, server: str = "https://ntfy.sh", topic: str = "forestguard-alerts"):
        self.server = server.rstrip("/")
        self.topic = topic.strip("/")
        self.url = f"{self.server}/{self.topic}"

    async def send(
        self,
        title: str,
        message: str,
        priority: str = "default",
        tags: Optional[list[str]] = None
    ) -> NotificationResult:
        if not self.topic:
            return NotificationResult(
                success=False,
                error="ntfy topic is not configured"
            )

        # Map priority to ntfy priority strings (1 to 5, or min to max)
        priority_map = {
            "min": "1",
            "low": "2",
            "default": "3",
            "high": "4",
            "urgent": "5"
        }
        p_val = priority_map.get(priority, "3")

        headers = {
            "Title": title,
            "Priority": p_val,
        }
        if tags:
            headers["Tags"] = ",".join(tags)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.url,
                    content=message.encode("utf-8"),
                    headers=headers
                )

                if response.status_code == 200:
                    return NotificationResult(
                        success=True,
                        status_code=response.status_code,
                        details=f"Dispatched via ntfy ({self.url})"
                    )
                else:
                    return NotificationResult(
                        success=False,
                        status_code=response.status_code,
                        error=f"ntfy server rejected message with code {response.status_code}: {response.text[:200]}"
                    )
        except Exception as e:
            return NotificationResult(
                success=False,
                error=f"Network error connecting to ntfy: {str(e)}"
            )

    async def test_connection(self) -> NotificationResult:
        return await self.send(
            title="ForestGuard System Test",
            message="Test notification from ForestGuard Early Warning Node. If you received this, notifications are working properly.",
            priority="default",
            tags=["bell", "forest"]
        )
