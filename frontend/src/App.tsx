import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OverallStatus } from './components/OverallStatus';
import { ThresholdControlBar } from './components/ThresholdControlBar';
import { TemperatureSection } from './components/TemperatureSection';
import { SmokeSection } from './components/SmokeSection';
import { EventHistory } from './components/EventHistory';
import { SettingsModal } from './components/SettingsModal';
import { useTelemetry } from './hooks/useTelemetry';
import { fetchSettings, updateSettings, setBridgeMode } from './services/api';
import type { SystemSettings } from './types';
import { triggerBrowserAlert } from './services/browserNotifications';

export const App: React.FC = () => {
  const { reading, connectionStatus, lastUpdated, refreshNow } = useTelemetry();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadSettings = async () => {
    try {
      const s = await fetchSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Trigger browser notification and sound chime when POTENTIAL FIRE ALERT occurs
  useEffect(() => {
    if (reading?.status === 'POTENTIAL FIRE ALERT') {
      triggerBrowserAlert(
        '🔥 CRITICAL: Forest Fire Threat Detected!',
        `Temperature: ${reading.temperature_c?.toFixed(1) ?? 'N/A'}°C | Smoke: ${reading.mq2_raw} ADC. Dual-condition verification confirmed fire emergency!`
      );
    }
  }, [reading?.status, reading?.temperature_c, reading?.mq2_raw]);

  const handleQuickScenarioChange = async (scenario: string) => {
    try {
      await setBridgeMode('demo', scenario);
      loadSettings();
      refreshNow();
    } catch (err) {
      console.error('Failed to switch demo scenario:', err);
    }
  };

  const handleUpdateThresholds = async (newTemp: number, newMq2: number) => {
    try {
      const updated = await updateSettings({
        threshold_temp: newTemp,
        threshold_mq2: newMq2
      });
      setSettings(updated);
      refreshNow();
    } catch (err) {
      console.error('Failed to update thresholds:', err);
    }
  };

  const handleUpdateTempThreshold = async (newTemp: number) => {
    await handleUpdateThresholds(newTemp, mq2Threshold);
  };

  const handleUpdateMq2Threshold = async (newMq2: number) => {
    await handleUpdateThresholds(tempThreshold, newMq2);
  };

  const tempThreshold = settings?.threshold_temp ?? reading?.threshold_temp ?? 50.0;
  const mq2Threshold = settings?.threshold_mq2 ?? reading?.threshold_mq2 ?? 400;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <Header
        reading={reading}
        connectionStatus={connectionStatus}
        lastUpdated={lastUpdated}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={refreshNow}
        onQuickScenarioChange={handleQuickScenarioChange}
      />

      {/* Main Dashboard Workspace */}
      <main style={{ flex: 1, padding: '20px 0' }}>
        <div className="container">
          {/* Prominent Operational Overall Status */}
          <OverallStatus
            reading={reading}
            tempThreshold={tempThreshold}
            mq2Threshold={mq2Threshold}
          />

          {/* Interactive Threshold Customization & Ambient Calibration Toolbar */}
          <ThresholdControlBar
            tempThreshold={tempThreshold}
            mq2Threshold={mq2Threshold}
            reading={reading}
            onUpdateThresholds={handleUpdateThresholds}
          />

          {/* 2-Column Responsive Telemetry Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '16px',
            alignItems: 'stretch'
          }}>
            {/* Left: Temperature Telemetry & Time Series */}
            <TemperatureSection
              reading={reading}
              tempThreshold={tempThreshold}
              onUpdateThreshold={handleUpdateTempThreshold}
            />

            {/* Right: Smoke Telemetry & Linear Gauge */}
            <SmokeSection
              reading={reading}
              smokeThreshold={mq2Threshold}
              onUpdateThreshold={handleUpdateMq2Threshold}
            />
          </div>

          {/* Persistent Event & Incident Log Table */}
          <EventHistory lastEventTrigger={reading?.status} />
        </div>
      </main>

      {/* Engineering Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-light)',
        backgroundColor: 'var(--bg-surface)',
        padding: '12px 0',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <strong>ForestGuard Early-Warning Node</strong> • Firmware v1.0 • Node.js / Python FastAPI Engine
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span>Hardware: Arduino Nano (ATmega328P)</span>
            <span>Sensors: DS18B20 (D2) + MQ-2 (A0)</span>
            <span>Display: I2C LCD (A4/A5)</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={() => {
          loadSettings();
          refreshNow();
        }}
      />
    </div>
  );
};

export default App;
