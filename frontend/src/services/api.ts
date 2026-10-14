import type { 
  TelemetryReading, 
  SystemSettings, 
  EventLog, 
  NotificationLog, 
  SerialPortInfo, 
  HistoryResponse 
} from '../types';

const API_BASE = '/api';

export async function fetchCurrentTelemetry(): Promise<{
  reading: TelemetryReading | null;
  is_connected: boolean;
  mode: 'live' | 'demo';
  demo_scenario: string;
  serial_port?: string;
  thresholds: {
    temperature: number;
    smoke_mq2: number;
    debounce_samples: number;
    stale_timeout_sec: number;
  };
}> {
  const res = await fetch(`${API_BASE}/telemetry/current`);
  if (!res.ok) throw new Error(`Failed to fetch current telemetry: ${res.statusText}`);
  return res.json();
}

export async function fetchTelemetryHistory(range: string = '1h'): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/telemetry/history?range=${range}`);
  if (!res.ok) throw new Error(`Failed to fetch telemetry history: ${res.statusText}`);
  return res.json();
}

export async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error(`Failed to fetch system settings: ${res.statusText}`);
  return res.json();
}

export async function updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error(`Failed to update system settings: ${res.statusText}`);
  return res.json();
}

export async function fetchEvents(limit = 50, offset = 0, eventType?: string): Promise<{
  total: number;
  limit: number;
  offset: number;
  events: EventLog[];
}> {
  let url = `${API_BASE}/events?limit=${limit}&offset=${offset}`;
  if (eventType && eventType !== 'ALL') {
    url += `&event_type=${eventType}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
  return res.json();
}

export async function acknowledgeEvent(eventId: number): Promise<{ success: boolean; event: EventLog }> {
  const res = await fetch(`${API_BASE}/events/${eventId}/acknowledge`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to acknowledge event: ${res.statusText}`);
  return res.json();
}

export async function fetchSerialPorts(): Promise<{
  ports: SerialPortInfo[];
  active_port?: string;
  is_connected: boolean;
  mode: string;
}> {
  const res = await fetch(`${API_BASE}/serial/ports`);
  if (!res.ok) throw new Error(`Failed to fetch serial ports: ${res.statusText}`);
  return res.json();
}

export async function connectSerial(port: string, baudRate = 115200): Promise<{
  success: boolean;
  port: string;
  baud_rate: number;
  is_connected: boolean;
}> {
  const res = await fetch(`${API_BASE}/serial/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port, baud_rate: baudRate })
  });
  if (!res.ok) throw new Error(`Failed to connect serial port: ${res.statusText}`);
  return res.json();
}

export async function disconnectSerial(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/serial/disconnect`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to disconnect serial: ${res.statusText}`);
  return res.json();
}

export async function setBridgeMode(mode: 'live' | 'demo', scenario?: string): Promise<{
  mode: string;
  scenario: string;
  is_connected: boolean;
}> {
  const res = await fetch(`${API_BASE}/serial/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, scenario })
  });
  if (!res.ok) throw new Error(`Failed to set mode: ${res.statusText}`);
  return res.json();
}

export async function fetchNotificationLogs(limit = 50): Promise<NotificationLog[]> {
  const res = await fetch(`${API_BASE}/notifications/logs?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch notification logs: ${res.statusText}`);
  return res.json();
}

export async function sendTestNotification(): Promise<{
  success: boolean;
  status_code: number | null;
  details: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/notifications/test`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to send test notification: ${res.statusText}`);
  return res.json();
}
