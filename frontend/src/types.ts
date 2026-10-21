export type SystemStatus = 
  | 'NORMAL' 
  | 'WATCH' 
  | 'POTENTIAL FIRE ALERT' 
  | 'SENSOR ERROR' 
  | 'OFFLINE';

export interface TelemetryReading {
  id?: number;
  timestamp: string;
  temperature_c: number | null;
  mq2_raw: number;
  smoke_detected: boolean;
  high_temperature: boolean;
  temp_valid: boolean;
  status: SystemStatus;
  mode: 'live' | 'demo';
  uptime_ms?: number;
  trigger_summary?: string;
  is_connected?: boolean;
  serial_port?: string;
  threshold_temp?: number;
  threshold_mq2?: number;
}

export interface SystemSettings {
  id: number;
  threshold_temp: number;
  threshold_mq2: number;
  debounce_samples: number;
  stale_timeout_sec: number;
  notifications_enabled: boolean;
  notification_provider: 'ntfy' | 'webhook';
  ntfy_server: string;
  ntfy_topic: string;
  webhook_url: string;
  demo_mode: boolean;
  demo_scenario: 'normal' | 'smoke_spike' | 'temp_spike' | 'fire_alert' | 'sensor_error' | 'recovering';
}

export interface EventLog {
  id: number;
  timestamp: string;
  event_type: 'ALERT_TRIGGER' | 'STATUS_CHANGE' | 'SENSOR_ERROR' | 'DISCONNECT' | 'ALERT_CLEAR';
  previous_status: string | null;
  new_status: SystemStatus;
  temperature_c: number | null;
  mq2_raw: number | null;
  trigger_summary: string | null;
  description: string;
  acknowledged: boolean;
}

export interface NotificationLog {
  id: number;
  timestamp: string;
  event_type: string;
  provider: string;
  target: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  http_status_code: number | null;
  message: string;
  error_details: string | null;
}

export interface SerialPortInfo {
  device: string;
  description: string;
  hwid: string;
}

export interface HistoryDataPoint {
  timestamp: string;
  temperature_c: number | null;
  mq2_raw: number;
  temp_valid: boolean;
  status: SystemStatus;
  mode: string;
}

export interface HistoryResponse {
  range: '15m' | '1h' | '6h' | '24h';
  stats: {
    temp_min: number | null;
    temp_max: number | null;
    temp_avg: number | null;
    mq2_min: number | null;
    mq2_max: number | null;
    mq2_avg: number | null;
    sample_count: number;
  };
  data: HistoryDataPoint[];
}
