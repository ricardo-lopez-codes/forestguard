from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import EventLog

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("")
def list_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EventLog)
    if event_type:
        query = query.filter(EventLog.event_type == event_type)

    total = query.count()
    events = query.order_by(EventLog.timestamp.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": [e.to_dict() for e in events]
    }

@router.post("/{event_id}/acknowledge")
def acknowledge_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(EventLog).filter(EventLog.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.acknowledged = True
    db.commit()
    return {"success": True, "event": event.to_dict()}
