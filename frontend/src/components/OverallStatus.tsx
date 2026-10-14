import React from 'react';
import { AlertTriangle, CheckCircle2, Flame, AlertCircle, RadioOff, Info } from 'lucide-react';
import type { SystemStatus, TelemetryReading } from '../types';

interface OverallStatusProps {
  reading: TelemetryReading | null;
  tempThreshold: number;
  mq2Threshold: number;
}

export const OverallStatus: React.FC<OverallStatusProps> = ({
  reading,
  tempThreshold,
  mq2Threshold
}) => {
  const status: SystemStatus = reading?.status || 'OFFLINE';

  const getStatusConfig = (st: SystemStatus) => {
    switch (st) {
      case 'NORMAL':
        return {
          icon: <CheckCircle2 size={18} />,
          badgeClass: 'badge-normal',
          border: 'var(--status-normal-border)',
          bg: 'var(--status-normal-bg)',
          textColor: 'var(--status-normal-text)',
          description: 'All monitored environmental parameters are currently within normal baseline thresholds.'
        };
      case 'WATCH':
        return {
          icon: <AlertTriangle size={18} />,
          badgeClass: 'badge-watch',
          border: 'var(--status-watch-border)',
          bg: 'var(--status-watch-bg)',
          textColor: 'var(--status-watch-text)',
          description: 'Single anomalous condition detected. Elevated vigilance required; awaiting condition confirmation.'
        };
      case 'POTENTIAL FIRE ALERT':
        return {
          icon: <Flame size={18} />,
          badgeClass: 'badge-alert',
          border: 'var(--status-alert-border)',
          bg: 'var(--status-alert-bg)',
          textColor: 'var(--status-alert-text)',
          description: 'CRITICAL WARNING: Both smoke threshold and high-temperature threshold have been breached simultaneously.'
        };
      case 'SENSOR ERROR':
        return {
          icon: <AlertCircle size={18} />,
          badgeClass: 'badge-error',
          border: 'var(--status-error-border)',
          bg: 'var(--status-error-bg)',
          textColor: 'var(--status-error-text)',
          description: 'Sensor failure detected: DS18B20 temperature probe returned invalid or disconnected telemetry.'
        };
      case 'OFFLINE':
      default:
        return {
          icon: <RadioOff size={18} />,
          badgeClass: 'badge-offline',
          border: 'var(--status-offline-border)',
          bg: 'var(--status-offline-bg)',
          textColor: 'var(--status-offline-text)',
          description: 'Telemetry link inactive. Sensor bridge is disconnected or serial readings are stale.'
        };
    }
  };

  const config = getStatusConfig(status);

  // Trigger evaluation details
  const smokeExceeded = reading?.smoke_detected ?? false;
  const tempExceeded = reading?.high_temperature ?? false;
  const tempValid = reading?.temp_valid ?? true;

  return (
    <div style={{
      backgroundColor: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Status Badge & Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            color: config.textColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {config.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)'
              }}>
                System Status
              </span>
              <span className={`badge ${config.badgeClass}`} style={{ fontSize: '12px', padding: '3px 8px' }}>
                {status}
              </span>
            </div>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              marginTop: '2px',
              fontWeight: 500
            }}>
              {config.description}
            </p>
          </div>
        </div>

        {/* Condition Check Grid */}
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          padding: '6px 14px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-light)',
          fontSize: '12px'
        }}>
          {/* Smoke condition */}
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Smoke State: </span>
            <strong style={{
              color: smokeExceeded ? 'var(--status-watch-text)' : 'var(--status-normal-text)'
            }}>
              {smokeExceeded ? 'EXCEEDED' : 'NORMAL'}
            </strong>
            <span className="mono" style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
              ({reading?.mq2_raw ?? '—'} / {mq2Threshold})
            </span>
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-light)' }} />

          {/* Temperature condition */}
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Temp State: </span>
            {!tempValid ? (
              <strong style={{ color: 'var(--status-alert-text)' }}>SENSOR ERROR</strong>
            ) : (
              <strong style={{
                color: tempExceeded ? 'var(--status-watch-text)' : 'var(--status-normal-text)'
              }}>
                {tempExceeded ? 'EXCEEDED' : 'NORMAL'}
              </strong>
            )}
            <span className="mono" style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
              ({tempValid && reading?.temperature_c !== null ? `${reading?.temperature_c?.toFixed(1)}°C` : 'N/A'} / {tempThreshold.toFixed(1)}°C)
            </span>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        <Info size={12} />
        <span>
          ForestGuard Early-Warning Prototype. Dual-condition verification required for fire alarm. Not certified for life safety.
        </span>
      </div>
    </div>
  );
};
