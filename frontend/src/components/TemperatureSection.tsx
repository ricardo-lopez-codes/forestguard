import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';
import { Thermometer, AlertCircle, CheckCircle } from 'lucide-react';
import type { TelemetryReading, HistoryResponse } from '../types';
import { fetchTelemetryHistory } from '../services/api';

interface TemperatureSectionProps {
  reading: TelemetryReading | null;
  tempThreshold: number;
  onUpdateThreshold?: (val: number) => void;
}

export const TemperatureSection: React.FC<TemperatureSectionProps> = ({
  reading,
  tempThreshold,
  onUpdateThreshold
}) => {
  const [range, setRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h');
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = async (selectedRange: '15m' | '1h' | '6h' | '24h') => {
    try {
      setLoading(true);
      const data = await fetchTelemetryHistory(selectedRange);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load temperature history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(range);
    const interval = window.setInterval(() => {
      loadHistory(range);
    }, 10000); // Refresh history every 10s
    return () => window.clearInterval(interval);
  }, [range]);

  const tempValid = reading?.temp_valid ?? true;
  const currentTemp = reading?.temperature_c;
  const isHigh = tempValid && currentTemp !== null && currentTemp !== undefined && currentTemp >= tempThreshold;

  // Format timestamp for chart tooltip and axis
  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Format axis tick
  const formatAxisTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const chartData = history?.data.map((d) => ({
    timestamp: d.timestamp,
    timeLabel: formatAxisTime(d.timestamp),
    fullTime: formatTime(d.timestamp),
    temp: d.temp_valid ? d.temperature_c : null
  })) || [];

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Thermometer size={15} color="var(--forest-primary)" />
          <span className="card-title">Temperature Telemetry (DS18B20)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {tempValid ? (
            <span className="badge badge-normal" style={{ fontSize: '10px' }}>
              <CheckCircle size={10} /> Online
            </span>
          ) : (
            <span className="badge badge-error" style={{ fontSize: '10px' }}>
              <AlertCircle size={10} /> Sensor Error
            </span>
          )}
        </div>
      </div>

      {/* Prominent Current Reading Row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginBottom: '16px',
        padding: '0 4px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {tempValid && currentTemp !== null && currentTemp !== undefined ? (
              <span className="mono" style={{
                fontSize: '36px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: isHigh ? 'var(--status-watch-text)' : 'var(--text-primary)'
              }}>
                {currentTemp.toFixed(1)}°C
              </span>
            ) : (
              <span className="mono" style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--status-alert-text)'
              }}>
                SENSOR FAULT
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
              threshold: <strong className="mono">{tempThreshold.toFixed(1)}°C</strong>
              {onUpdateThreshold && (
                <span style={{ display: 'inline-flex', gap: '2px', marginLeft: '2px' }}>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: '10px', padding: '0 4px', height: '18px', minWidth: '18px', lineHeight: '18px' }}
                    onClick={() => onUpdateThreshold(tempThreshold - 1)}
                    title="Lower temperature threshold by 1°C"
                  >
                    -
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: '10px', padding: '0 4px', height: '18px', minWidth: '18px', lineHeight: '18px' }}
                    onClick={() => onUpdateThreshold(tempThreshold + 1)}
                    title="Raise temperature threshold by 1°C"
                  >
                    +
                  </button>
                </span>
              )}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Digital 1-Wire probe on D2 • Resolution 0.0625°C
          </div>
        </div>

        {/* Range Selector Controls */}
        <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
          {(['15m', '1h', '6h', '24h'] as const).map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${range === r ? 'btn-primary' : ''}`}
              style={{ padding: '2px 8px', fontSize: '11px' }}
              onClick={() => {
                setRange(r);
                loadHistory(r);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ flex: 1, minHeight: '190px', width: '100%', position: 'relative' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <XAxis 
                dataKey="timeLabel" 
                tick={{ fontSize: 10, fill: '#738087' }} 
                tickLine={false} 
                axisLine={{ stroke: '#e1e5e7' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{ fontSize: 10, fill: '#738087' }} 
                tickLine={false} 
                axisLine={{ stroke: '#e1e5e7' }}
                unit="°C"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius)',
                        padding: '6px 10px',
                        fontSize: '11px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                      }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>
                          {item.fullTime}
                        </div>
                        <div className="mono" style={{ fontWeight: 600 }}>
                          {item.temp !== null ? `${item.temp.toFixed(1)} °C` : 'Invalid / Disconnected'}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Threshold indicator line */}
              <ReferenceLine 
                y={tempThreshold} 
                stroke="#c26100" 
                strokeDasharray="4 4" 
                label={{ 
                  value: `Limit: ${tempThreshold}°C`, 
                  position: 'insideTopRight', 
                  fontSize: 10, 
                  fill: '#c26100' 
                }} 
              />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="var(--forest-primary)"
                strokeWidth={1.75}
                dot={false}
                connectNulls={false} // NEVER interpolate missing readings as real!
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px'
          }}>
            {loading ? 'Fetching telemetry history...' : 'Awaiting sensor telemetry data points...'}
          </div>
        )}
      </div>

      {/* Stats Summary Footer */}
      {history?.stats && (
        <div style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Min: <strong className="mono">{history.stats.temp_min !== null ? `${history.stats.temp_min.toFixed(1)}°C` : '—'}</strong>
          </div>
          <div>
            Avg: <strong className="mono">{history.stats.temp_avg !== null ? `${history.stats.temp_avg.toFixed(1)}°C` : '—'}</strong>
          </div>
          <div>
            Max: <strong className="mono">{history.stats.temp_max !== null ? `${history.stats.temp_max.toFixed(1)}°C` : '—'}</strong>
          </div>
          <div>
            Samples: <span className="mono">{history.stats.sample_count}</span>
          </div>
        </div>
      )}
    </div>
  );
};
