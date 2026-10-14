import React from 'react';
import { Settings, RefreshCw, Cpu, Activity } from 'lucide-react';
import type { TelemetryReading } from '../types';
import type { WsConnectionStatus } from '../hooks/useTelemetry';

interface HeaderProps {
  reading: TelemetryReading | null;
  connectionStatus: WsConnectionStatus;
  lastUpdated: Date | null;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onQuickScenarioChange?: (scenario: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  reading,
  connectionStatus,
  lastUpdated,
  onOpenSettings,
  onRefresh,
  onQuickScenarioChange
}) => {
  const isDemo = reading?.mode === 'demo';

  // Format relative timestamp
  const getRelativeTime = () => {
    if (!lastUpdated) return 'No readings yet';
    const secondsAgo = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    if (secondsAgo < 2) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  return (
    <header style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-light)',
      padding: '10px 0'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'var(--forest-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            fontWeight: '700'
          }}>
            FG
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{
                fontSize: '15px',
                fontWeight: '700',
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                textTransform: 'uppercase'
              }}>
                ForestGuard
              </h1>
              {/* Telemetry Source Badge */}
              {isDemo ? (
                <span className="badge badge-demo" title="Explicitly running simulated test telemetry">
                  <Activity size={11} /> DEMO / SIMULATION MODE
                </span>
              ) : (
                <span className="badge badge-live" title="Streaming real telemetry from Arduino Nano USB Serial">
                  <Cpu size={11} /> LIVE HARDWARE ({reading?.serial_port || 'USB SERIAL'})
                </span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Forest Monitoring &amp; Early-Warning Telemetry System
            </p>
          </div>
        </div>

        {/* Telemetry Status and Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Quick Scenario Picker (shown in demo mode for instant testing) */}
          {isDemo && onQuickScenarioChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scenario:</span>
              <select
                style={{
                  fontSize: '11px',
                  padding: '3px 6px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--bg-surface)'
                }}
                onChange={(e) => onQuickScenarioChange(e.target.value)}
                defaultValue="normal"
              >
                <option value="normal">Normal (Clear)</option>
                <option value="smoke_spike">Watch: High Smoke Only</option>
                <option value="temp_spike">Watch: High Temp Only</option>
                <option value="fire_alert">Fire Alert: Smoke &amp; Temp</option>
                <option value="sensor_error">Sensor Error: Temp Fail</option>
                <option value="recovering">Cooling / Recovery</option>
              </select>
            </div>
          )}

          {/* Connection Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 
                connectionStatus === 'connected' ? 'var(--status-normal-text)' :
                connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? 'var(--status-watch-text)' :
                'var(--status-alert-text)',
              display: 'inline-block'
            }} />
            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              {connectionStatus}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>
              {getRelativeTime()}
            </span>
          </div>

          {/* Refresh button */}
          <button
            className="btn btn-sm"
            onClick={onRefresh}
            title="Refresh telemetry"
          >
            <RefreshCw size={12} />
          </button>

          {/* Settings Trigger */}
          <button
            className="btn btn-sm"
            onClick={onOpenSettings}
            style={{ fontWeight: 600 }}
          >
            <Settings size={12} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
