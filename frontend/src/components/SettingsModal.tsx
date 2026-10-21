import React, { useState, useEffect } from 'react';
import { X, Sliders, Bell, Cpu, List, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SerialPortInfo, NotificationLog } from '../types';
import { 
  fetchSettings, 
  updateSettings, 
  fetchSerialPorts, 
  connectSerial, 
  disconnectSerial,
  sendTestNotification, 
  fetchNotificationLogs 
} from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'thresholds' | 'hardware' | 'notifications' | 'logs'>('thresholds');
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  
  // Test notification state
  const [testingNotification, setTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; details: string; error?: string } | null>(null);

  // Form states
  const [tempThreshold, setTempThreshold] = useState<number>(50.0);
  const [mq2Threshold, setMq2Threshold] = useState<number>(400);
  const [debounceSamples, setDebounceSamples] = useState<number>(3);
  const [staleTimeout, setStaleTimeout] = useState<number>(5.0);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(false);
  const [notifProvider, setNotifProvider] = useState<'ntfy' | 'webhook'>('ntfy');
  const [ntfyServer, setNtfyServer] = useState<string>('https://ntfy.sh');
  const [ntfyTopic, setNtfyTopic] = useState<string>('forestguard-alerts-demo');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [demoScenario, setDemoScenario] = useState<string>('normal');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const s = await fetchSettings();
      setTempThreshold(s.threshold_temp);
      setMq2Threshold(s.threshold_mq2);
      setDebounceSamples(s.debounce_samples);
      setStaleTimeout(s.stale_timeout_sec);
      setNotifEnabled(s.notifications_enabled);
      setNotifProvider(s.notification_provider);
      setNtfyServer(s.ntfy_server);
      setNtfyTopic(s.ntfy_topic);
      setWebhookUrl(s.webhook_url);
      setDemoMode(s.demo_mode);
      setDemoScenario(s.demo_scenario);

      // Load serial ports
      const portData = await fetchSerialPorts();
      setPorts(portData.ports);
      if (portData.active_port) {
        setSelectedPort(portData.active_port);
      } else if (portData.ports.length > 0) {
        setSelectedPort(portData.ports[0].device);
      }

      // Load notification logs
      const notifLogs = await fetchNotificationLogs(25);
      setLogs(notifLogs);
    } catch (err) {
      console.error('Failed to load settings modal data:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSettings({
        threshold_temp: tempThreshold,
        threshold_mq2: mq2Threshold,
        debounce_samples: debounceSamples,
        stale_timeout_sec: staleTimeout,
        notifications_enabled: notifEnabled,
        notification_provider: notifProvider,
        ntfy_server: ntfyServer,
        ntfy_topic: ntfyTopic,
        webhook_url: webhookUrl,
        demo_mode: demoMode,
        demo_scenario: demoScenario as any
      });
      onSettingsUpdated();
      onClose();
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      alert(`Failed to save settings: ${err?.message || 'Check connection or values.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setTestingNotification(true);
      setTestResult(null);
      // First save current notification parameters
      await updateSettings({
        notifications_enabled: true,
        notification_provider: notifProvider,
        ntfy_server: ntfyServer,
        ntfy_topic: ntfyTopic,
        webhook_url: webhookUrl
      });
      const res = await sendTestNotification();
      setTestResult(res);
      // Reload logs
      const notifLogs = await fetchNotificationLogs(25);
      setLogs(notifLogs);
    } catch (err: any) {
      setTestResult({
        success: false,
        details: 'Failed to contact notification endpoint',
        error: err.message
      });
    } finally {
      setTestingNotification(false);
    }
  };

  const handleConnectPort = async () => {
    if (!selectedPort) return;
    try {
      await connectSerial(selectedPort);
      setDemoMode(false);
      await updateSettings({ demo_mode: false });
      onSettingsUpdated();
      loadInitialData();
    } catch (err) {
      console.error('Port connect error:', err);
      alert(`Could not open port ${selectedPort}`);
    }
  };

  const handleDisconnectPort = async () => {
    try {
      await disconnectSerial();
      loadInitialData();
      onSettingsUpdated();
    } catch (err) {
      console.error('Port disconnect error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} color="var(--forest-primary)" />
            <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              System Configuration &amp; Telemetry Settings
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-subtle)',
          padding: '0 12px'
        }}>
          {[
            { id: 'thresholds', label: 'Alert Thresholds', icon: <Sliders size={12} /> },
            { id: 'hardware', label: 'Hardware & Serial', icon: <Cpu size={12} /> },
            { id: 'notifications', label: 'Push Notifications', icon: <Bell size={12} /> },
            { id: 'logs', label: 'Notification Logs', icon: <List size={12} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 12px',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--forest-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--forest-primary)' : '2px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* TAB 1: THRESHOLDS & DEBOUNCE */}
          {activeTab === 'thresholds' && (
            <div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">
                    Temperature Warning Threshold (°C)
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { label: 'Room (28°C)', val: 28.0 },
                      { label: 'Watch (35°C)', val: 35.0 },
                      { label: 'Standard (50°C)', val: 50.0 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: '10px', padding: '1px 6px' }}
                        onClick={() => setTempThreshold(p.val)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="-40"
                  max="125"
                  className="form-input mono"
                  value={tempThreshold}
                  onChange={(e) => setTempThreshold(parseFloat(e.target.value) || 0)}
                />
                <div className="form-hint">
                  Range: -40.0°C to 125.0°C. Temperature readings at or above this trigger the high-temperature condition.
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">
                    Smoke / Gas Threshold (Raw MQ-2 ADC 0–1023)
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { label: 'Sensitive (220)', val: 220 },
                      { label: 'Standard (400)', val: 400 },
                      { label: 'Heavy (600)', val: 600 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: '10px', padding: '1px 6px' }}
                        onClick={() => setMq2Threshold(p.val)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  step="10"
                  min="0"
                  max="1023"
                  className="form-input mono"
                  value={mq2Threshold}
                  onChange={(e) => setMq2Threshold(parseInt(e.target.value) || 0)}
                />
                <div className="form-hint">
                  Range: 0 to 1023 ADC steps. Baseline ambient is typically ~120–200.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Debounce Filter Persistence (Sample Count)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="form-input mono"
                  value={debounceSamples}
                  onChange={(e) => setDebounceSamples(parseInt(e.target.value) || 1)}
                />
                <div className="form-hint">
                  Requires this number of consecutive readings in an alert state before triggering state changes and push notifications. Filters out single-sample noise spikes.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Telemetry Stale Timeout (Seconds)
                </label>
                <input
                  type="number"
                  step="1"
                  min="2"
                  max="60"
                  className="form-input mono"
                  value={staleTimeout}
                  onChange={(e) => setStaleTimeout(parseFloat(e.target.value) || 5)}
                />
                <div className="form-hint">
                  If no serial frame arrives within this interval, system automatically transitions to OFFLINE.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HARDWARE & SERIAL */}
          {activeTab === 'hardware' && (
            <div>
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
                  Telemetry Source Mode
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="telemetryMode"
                      checked={!demoMode}
                      onChange={() => setDemoMode(false)}
                    />
                    <strong>Live Hardware</strong> (Arduino Nano USB Serial)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="telemetryMode"
                      checked={demoMode}
                      onChange={() => setDemoMode(true)}
                    />
                    <strong>Simulation / Demo Mode</strong>
                  </label>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Note: Demo mode is always explicitly labeled with a distinct banner in compliance with verification standards.
                </div>
              </div>

              {!demoMode ? (
                <div>
                  <div className="form-group">
                    <label className="form-label">Available Serial Ports</label>
                    <select
                      className="form-select"
                      value={selectedPort}
                      onChange={(e) => setSelectedPort(e.target.value)}
                    >
                      {ports.length > 0 ? (
                        ports.map((p) => (
                          <option key={p.device} value={p.device}>
                            {p.device} — {p.description}
                          </option>
                        ))
                      ) : (
                        <option value="">No COM ports detected (Plug in Arduino Nano)</option>
                      )}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleConnectPort}
                      disabled={!selectedPort}
                    >
                      Connect USB Serial
                    </button>
                    <button className="btn" onClick={handleDisconnectPort}>
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Demo Test Scenario</label>
                  <select
                    className="form-select"
                    value={demoScenario}
                    onChange={(e) => setDemoScenario(e.target.value)}
                  >
                    <option value="normal">NORMAL — Baseline environmental readings</option>
                    <option value="smoke_spike">WATCH (Smoke Only) — Smoke spike above threshold</option>
                    <option value="temp_spike">WATCH (Temp Only) — Temperature above threshold</option>
                    <option value="fire_alert">POTENTIAL FIRE ALERT — Both smoke &amp; high temp breached</option>
                    <option value="sensor_error">SENSOR ERROR — DS18B20 temperature probe failure</option>
                    <option value="recovering">RECOVERING — Temperature and smoke returning to normal</option>
                  </select>
                  <div className="form-hint">
                    Select a scenario to verify the state machine, debounce filter, LCD output logic, and push notifications.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="notifToggle"
                  checked={notifEnabled}
                  onChange={(e) => setNotifEnabled(e.target.checked)}
                />
                <label htmlFor="notifToggle" style={{ fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  Enable Phone / Push Notifications
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Provider</label>
                <select
                  className="form-select"
                  value={notifProvider}
                  onChange={(e) => setNotifProvider(e.target.value as any)}
                >
                  <option value="ntfy">ntfy.sh (Free, instant push to iOS / Android / Web)</option>
                  <option value="webhook">Custom Webhook (JSON POST payload)</option>
                </select>
              </div>

              {notifProvider === 'ntfy' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">ntfy Server URL</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={ntfyServer}
                      onChange={(e) => setNtfyServer(e.target.value)}
                    />
                    <div className="form-hint">Default: https://ntfy.sh (or your self-hosted ntfy instance)</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">ntfy Topic Name</label>
                    <input
                      type="text"
                      className="form-input mono"
                      value={ntfyTopic}
                      onChange={(e) => setNtfyTopic(e.target.value)}
                    />
                    <div className="form-hint">
                      Install the free <strong>ntfy</strong> app on your phone, subscribe to this exact topic name, and receive instant push alarms with sound when a fire threat is confirmed.
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">Webhook URL</label>
                  <input
                    type="url"
                    className="form-input mono"
                    placeholder="https://your-domain.com/api/alerts"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <div className="form-hint">Receives POST request with JSON alert payload.</div>
                </div>
              )}

              {/* Test Button & Confirmation */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>Verify Notification Pipeline</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Sends a live test notification and confirms delivery confirmation code.
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={handleTestNotification}
                    disabled={testingNotification}
                  >
                    <Send size={11} />
                    <span>{testingNotification ? 'Sending...' : 'Send Test Notification'}</span>
                  </button>
                </div>

                {testResult && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius)',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: testResult.success ? 'var(--status-normal-bg)' : 'var(--status-alert-bg)',
                    color: testResult.success ? 'var(--status-normal-text)' : 'var(--status-alert-text)',
                    border: `1px solid ${testResult.success ? 'var(--status-normal-border)' : 'var(--status-alert-border)'}`
                  }}>
                    {testResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    <span>
                      {testResult.success ? (
                        <>Delivered successfully! {testResult.details}</>
                      ) : (
                        <>Delivery failed: {testResult.error || testResult.details}</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Delivery records confirmed by upstream notification providers:
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '6px' }}>Time</th>
                      <th style={{ padding: '6px' }}>Event</th>
                      <th style={{ padding: '6px' }}>Provider</th>
                      <th style={{ padding: '6px' }}>Status</th>
                      <th style={{ padding: '6px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length > 0 ? (
                      logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td className="mono" style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '6px' }}>{log.event_type}</td>
                          <td style={{ padding: '6px' }}>{log.provider}</td>
                          <td style={{ padding: '6px' }}>
                            <span className={`badge ${
                              log.status === 'SENT' ? 'badge-normal' :
                              log.status === 'SKIPPED' ? 'badge-demo' : 'badge-alert'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>
                            {log.error_details || log.message}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No notification attempts logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
