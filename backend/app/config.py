from pathlib import Path
from pydantic import BaseModel
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "forestguard.db"

class AppConfig(BaseModel):
    app_name: str = "ForestGuard"
    app_version: str = "1.0.0"
    database_url: str = f"sqlite:///{DB_PATH}"
    
    # Default environmental alert thresholds
    default_temp_threshold: float = 50.0  # Celsius
    default_mq2_threshold: int = 400      # Raw ADC (0-1023)
    default_debounce_samples: int = 3     # Consecutive readings needed to transition status
    stale_timeout_sec: float = 5.0        # Seconds without telemetry before marking OFFLINE
    
    # Default Serial configuration
    default_serial_baud: int = 115200
    default_serial_port: str = "AUTO"
    
    # Mode
    default_demo_mode: bool = True        # Default to safe demo mode if no Arduino detected

config = AppConfig()
