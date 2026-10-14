from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import NotificationLog
from app.services.notifications.service import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/logs")
def get_notification_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    logs = db.query(NotificationLog).order_by(NotificationLog.timestamp.desc()).limit(limit).all()
    return [log.to_dict() for log in logs]

@router.post("/test")
async def trigger_test_notification(db: Session = Depends(get_db)):
    result = await notification_service.send_test(db)
    return {
        "success": result.success,
        "status_code": result.status_code,
        "details": result.details,
        "error": result.error
    }
