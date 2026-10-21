import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Sparkles, RotateCcw, Check, Thermometer, Wind } from 'lucide-react';
import type { TelemetryReading } from '../types';

interface ThresholdControlBarProps {
  tempThreshold: number;
  mq2Threshold: number;
  reading: TelemetryReading | null;
  onUpdateThresholds: (temp: number, mq2: number) => Promise<void>;
}

export const ThresholdControlBar: React.FC<ThresholdControlBarProps> = ({
  tempThreshold,
  mq2Threshold,
  reading,
  onUpdateThresholds
}) => {
  const [localTemp, setLocalTemp] = useState<number>(tempThreshold);
  const [localMq2, setLocalMq2] = useState<number>(mq2Threshold);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync with upstream props when they change externally
  useEffect(() => {
    setLocalTemp(tempThreshold);
  }, [tempThreshold]);

  useEffect(() => {
    setLocalMq2(mq2Threshold);
  }, [mq2Threshold]);

  // Debounced save helper for sliders/inputs
  const triggerSave = (newTemp: number, newMq2: number) => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    setIsSaving(true);
    setSaveSuccess(false);

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        await onUpdateThresholds(newTemp, newMq2);
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        console.error('Threshold update error:', err);
        setIsSaving(false);
      }
    }, 300);
  };

  const handleTempChange = (val: number) => {
    const clamped = Math.max(-40.0, Math.min(125.0, Math.round(val * 10) / 10));
    setLocalTemp(clamped);
    triggerSave(clamped, localMq2);
  };

  const handleMq2Change = (val: number) => {
    const clamped = Math.max(0, Math.min(1023, Math.round(val)));
    setLocalMq2(clamped);
    triggerSave(localTemp, clamped);
  };

  const handleAutoCalibrate = () => {
    const currentTemp = reading?.temp_valid && reading?.temperature_c !== null ? reading.temperature_c : 24.0;
    const currentMq2 = reading?.mq2_raw ?? 160;

    // Set reasonable alert thresholds relative to ambient: +5°C for temp, +80 ADC for smoke
    const calibratedTemp = Math.round((currentTemp + 5.0) * 10) / 10;
    const calibratedMq2 = Math.min(1023, Math.max(80, currentMq2 + 80));

    setLocalTemp(calibratedTemp);
    setLocalMq2(calibratedMq2);
    triggerSave(calibratedTemp, calibratedMq2);
  };

  const handleResetDefaults = () => {
    setLocalTemp(50.0);
    setLocalMq2(400);
    triggerSave(50.0, 400);
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius)',
      padding: '14px 18px',
      marginBottom: '16px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Top Header & Quick Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: collapsed ? 0 : '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={16} color="var(--forest-primary)" />
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-primary)'
          }}>
            Threshold Customization &amp; Calibration
          </span>
          {isSaving ? (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving...</span>
          ) : saveSuccess ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '11px',
              color: 'var(--status-normal-text)',
              fontWeight: 600
            }}>
              <Check size={12} /> Saved to Cloud &amp; Hardware
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Auto Calibrate from Ambient */}
          <button
            className="btn btn-sm"
            onClick={handleAutoCalibrate}
            title="Auto-sets thresholds safely above current ambient room readings"
            style={{
              backgroundColor: 'var(--forest-subtle)',
              color: 'var(--forest-primary)',
              borderColor: 'var(--forest-primary)',
              fontWeight: 600,
              fontSize: '11px',
              padding: '3px 9px'
            }}
          >
            <Sparkles size={12} />
            <span>Auto-Calibrate to Ambient</span>
          </button>

          {/* Reset to Defaults */}
          <button
            className="btn btn-sm"
            onClick={handleResetDefaults}
            title="Reset to 50.0°C and 400 ADC defaults"
            style={{ fontSize: '11px', padding: '3px 8px' }}
          >
            <RotateCcw size={11} />
            <span>Defaults (50°C / 400)</span>
          </button>

          {/* Collapse Toggle */}
          <button
            className="btn btn-sm"
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '11px', padding: '3px 8px' }}
          >
            {collapsed ? 'Expand Controls' : 'Hide Sliders'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {/* Temperature Threshold Panel */}
          <div style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '12px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Thermometer size={14} color="var(--forest-primary)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Temperature Threshold
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  step="0.5"
                  min="-40"
                  max="125"
                  className="form-input mono"
                  style={{
                    width: '74px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'right'
                  }}
                  value={localTemp}
                  onChange={(e) => handleTempChange(parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>°C</span>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="15"
              max="75"
              step="0.5"
              value={Math.min(75, Math.max(15, localTemp))}
              onChange={(e) => handleTempChange(parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', margin: '4px 0 8px 0' }}
            />

            {/* Stepper Buttons & Presets */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => handleTempChange(localTemp - 1)}
                  title="Decrease by 1°C"
                >
                  -1°C
                </button>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => handleTempChange(localTemp + 1)}
                  title="Increase by 1°C"
                >
                  +1°C
                </button>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => handleTempChange(localTemp + 5)}
                  title="Increase by 5°C"
                >
                  +5°C
                </button>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Room (28°C)', val: 28.0 },
                  { label: 'Watch (35°C)', val: 35.0 },
                  { label: 'Standard (50°C)', val: 50.0 },
                  { label: 'Extreme (65°C)', val: 65.0 },
                ].map((p) => (
                  <button
                    key={p.val}
                    className="btn btn-sm"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      backgroundColor: Math.abs(localTemp - p.val) < 0.1 ? 'var(--forest-primary)' : undefined,
                      color: Math.abs(localTemp - p.val) < 0.1 ? '#ffffff' : undefined
                    }}
                    onClick={() => handleTempChange(p.val)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Smoke (MQ-2) Threshold Panel */}
          <div style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '12px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wind size={14} color="var(--forest-primary)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Smoke / Gas Threshold (MQ-2)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  step="10"
                  min="0"
                  max="1023"
                  className="form-input mono"
                  style={{
                    width: '74px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'right'
                  }}
                  value={localMq2}
                  onChange={(e) => handleMq2Change(parseInt(e.target.value) || 0)}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>ADC</span>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="50"
              max="900"
              step="10"
              value={Math.min(900, Math.max(50, localMq2))}
              onChange={(e) => handleMq2Change(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', margin: '4px 0 8px 0' }}
            />

            {/* Stepper Buttons & Presets */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => handleMq2Change(localMq2 - 25)}
                  title="Decrease by 25 ADC"
                >
                  -25
                </button>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => handleMq2Change(localMq2 + 25)}
                  title="Increase by 25 ADC"
                >
                  +25
                </button>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => handleMq2Change(localMq2 + 100)}
                  title="Increase by 100 ADC"
                >
                  +100
                </button>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Sensitive (220)', val: 220 },
                  { label: 'Medium (300)', val: 300 },
                  { label: 'Standard (400)', val: 400 },
                  { label: 'Dense (600)', val: 600 },
                ].map((p) => (
                  <button
                    key={p.val}
                    className="btn btn-sm"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      backgroundColor: Math.abs(localMq2 - p.val) < 5 ? 'var(--forest-primary)' : undefined,
                      color: Math.abs(localMq2 - p.val) < 5 ? '#ffffff' : undefined
                    }}
                    onClick={() => handleMq2Change(p.val)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
