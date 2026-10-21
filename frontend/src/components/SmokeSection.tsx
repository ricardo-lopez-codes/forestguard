import React, { useRef, useEffect, useState } from 'react';
import { Wind, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import type { TelemetryReading } from '../types';

interface SmokeSectionProps {
  reading: TelemetryReading | null;
  smokeThreshold: number;
  onUpdateThreshold?: (val: number) => void;
}

export const SmokeSection: React.FC<SmokeSectionProps> = ({
  reading,
  smokeThreshold,
  onUpdateThreshold
}) => {
  const currentRaw = reading?.mq2_raw ?? 0;
  const smokeDetected = reading?.smoke_detected ?? false;

  // Track recent history to calculate trend slope (ADC points per minute)
  const historyRef = useRef<{ time: number; val: number }[]>([]);
  const [trend, setTrend] = useState<{ direction: 'rising' | 'falling' | 'steady'; rate: number }>({
    direction: 'steady',
    rate: 0
  });

  useEffect(() => {
    if (reading) {
      const now = Date.now();
      const nextHistory = [...historyRef.current, { time: now, val: currentRaw }].filter(
        (p) => now - p.time <= 30000 // Keep last 30 seconds
      );
      historyRef.current = nextHistory;

      if (nextHistory.length >= 4) {
        const first = nextHistory[0];
        const last = nextHistory[nextHistory.length - 1];
        const dtMinutes = (last.time - first.time) / 60000;
        if (dtMinutes > 0.05) {
          const dVal = last.val - first.val;
          const ratePerMin = Math.round(dVal / dtMinutes);

          if (ratePerMin > 10) {
            setTrend({ direction: 'rising', rate: ratePerMin });
          } else if (ratePerMin < -10) {
            setTrend({ direction: 'falling', rate: Math.abs(ratePerMin) });
          } else {
            setTrend({ direction: 'steady', rate: Math.abs(ratePerMin) });
          }
        }
      }
    }
  }, [reading, currentRaw]);

  // Compute percentage for gauge
  const percentage = Math.min(100, Math.max(0, (currentRaw / 1023) * 100));
  const thresholdPct = Math.min(100, Math.max(0, (smokeThreshold / 1023) * 100));

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind size={15} color="var(--forest-primary)" />
          <span className="card-title">Smoke &amp; Gas Telemetry (MQ-2)</span>
        </div>
        <div>
          {smokeDetected ? (
            <span className="badge badge-alert" style={{ fontSize: '10px' }}>
              Smoke Detected
            </span>
          ) : (
            <span className="badge badge-normal" style={{ fontSize: '10px' }}>
              No Smoke Detected
            </span>
          )}
        </div>
      </div>

      {/* Prominent Raw Value Row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginBottom: '16px',
        padding: '0 4px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono" style={{
              fontSize: '36px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: smokeDetected ? 'var(--status-watch-text)' : 'var(--text-primary)'
            }}>
              {currentRaw}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
              threshold: <strong className="mono">{smokeThreshold}</strong>
              {onUpdateThreshold && (
                <span style={{ display: 'inline-flex', gap: '2px', marginLeft: '2px' }}>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: '10px', padding: '0 4px', height: '18px', minWidth: '18px', lineHeight: '18px' }}
                    onClick={() => onUpdateThreshold(smokeThreshold - 25)}
                    title="Lower smoke threshold by 25 ADC"
                  >
                    -
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: '10px', padding: '0 4px', height: '18px', minWidth: '18px', lineHeight: '18px' }}
                    onClick={() => onUpdateThreshold(smokeThreshold + 25)}
                    title="Raise smoke threshold by 25 ADC"
                  >
                    +
                  </button>
                </span>
              )}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Raw 10-bit ADC integer (0–1023 steps) • Analog pin A0
          </div>
        </div>

        {/* Dynamic Trend Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--bg-subtle)',
          padding: '4px 8px',
          borderRadius: 'var(--radius)',
          fontSize: '11px'
        }}>
          {trend.direction === 'rising' && (
            <>
              <TrendingUp size={13} color="var(--status-alert-text)" />
              <span style={{ color: 'var(--status-alert-text)', fontWeight: 600 }}>
                Rising (+{trend.rate}/min)
              </span>
            </>
          )}
          {trend.direction === 'falling' && (
            <>
              <TrendingDown size={13} color="var(--status-normal-text)" />
              <span style={{ color: 'var(--status-normal-text)', fontWeight: 600 }}>
                Falling (-{trend.rate}/min)
              </span>
            </>
          )}
          {trend.direction === 'steady' && (
            <>
              <Minus size={13} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)' }}>
                Steady (±{trend.rate}/min)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Clean Linear Meter / Gauge */}
      <div style={{ margin: '14px 4px 18px 4px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '6px'
        }}>
          <span>0 (Ambient Baseline)</span>
          <span style={{ color: 'var(--status-watch-text)', fontWeight: 600 }}>
            Threshold: {smokeThreshold}
          </span>
          <span>1023 (Saturation)</span>
        </div>

        <div style={{
          position: 'relative',
          height: '14px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: '2px',
          overflow: 'hidden',
          border: '1px solid var(--border-light)'
        }}>
          {/* Active Fill */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${percentage}%`,
            backgroundColor: smokeDetected ? 'var(--status-watch-text)' : 'var(--forest-primary)',
            transition: 'width 0.4s ease'
          }} />

          {/* Threshold Tick Mark */}
          <div style={{
            position: 'absolute',
            left: `${thresholdPct}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: 'var(--status-alert-text)',
            zIndex: 2
          }} />
        </div>
      </div>

      {/* Label and Sensor Disclaimer */}
      <div style={{
        marginTop: 'auto',
        padding: '10px 12px',
        backgroundColor: 'var(--bg-subtle)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-light)',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px'
      }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>Engineering Note:</strong> MQ-2 readings represent uncalibrated analog voltage conversion steps. They reflect relative combustible gas and smoke density, not calibrated parts-per-million (PPM).
        </span>
      </div>
    </div>
  );
};
