import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import config
from app.database import init_db
from app.services.sensor_bridge import sensor_bridge
from app.routers import telemetry, events, settings, notifications, serial, websocket

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("forestguard.main")

bridge_task: asyncio.Task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database tables and start sensor bridge
    logger.info("Initializing ForestGuard database...")
    init_db()

    logger.info("Starting sensor telemetry bridge loop...")
    global bridge_task
    bridge_task = asyncio.create_task(sensor_bridge.run())

    yield

    # Shutdown: Stop bridge and clean up serial connection
    logger.info("Shutting down sensor telemetry bridge...")
    sensor_bridge.is_running = False
    if bridge_task:
        bridge_task.cancel()
        try:
            await bridge_task
        except asyncio.CancelledError:
            pass
    sensor_bridge._disconnect_serial()
    logger.info("ForestGuard backend shutdown complete.")

app = FastAPI(
    title=config.app_name,
    version=config.app_version,
    description="ForestGuard - Forest Environmental Monitoring & Early-Warning Backend",
    lifespan=lifespan
)

# Configure CORS for local development and LAN access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(telemetry.router)
app.include_router(events.router)
app.include_router(settings.router)
app.include_router(notifications.router)
app.include_router(serial.router)
app.include_router(websocket.router)

@app.get("/api/health")
def healthcheck():
    return {
        "status": "healthy",
        "system": config.app_name,
        "version": config.app_version,
        "bridge_connected": sensor_bridge.is_connected,
        "mode": sensor_bridge.current_mode,
        "scenario": sensor_bridge.demo_scenario
    }

# Mount static frontend production build if available
from fastapi.staticfiles import StaticFiles
from pathlib import Path

frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

