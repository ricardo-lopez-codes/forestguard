from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class NotificationResult:
    success: bool
    status_code: Optional[int] = None
    error: Optional[str] = None
    details: str = ""

class BaseNotificationProvider(ABC):
    @abstractmethod
    async def send(
        self,
        title: str,
        message: str,
        priority: str = "default",  # "min", "low", "default", "high", "urgent"
        tags: Optional[list[str]] = None
    ) -> NotificationResult:
        pass

    @abstractmethod
    async def test_connection(self) -> NotificationResult:
        pass
