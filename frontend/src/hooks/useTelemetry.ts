import { useState, useEffect, useRef, useCallback } from 'react';
import type { TelemetryReading } from '../types';
import { fetchCurrentTelemetry } from '../services/api';

export type WsConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export function useTelemetry() {
  const [reading, setReading] = useState<TelemetryReading | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);

  const fallbackPoll = useCallback(async () => {
    try {
      const data = await fetchCurrentTelemetry();
      if (data.reading && !isUnmountedRef.current) {
        setReading(data.reading);
        setLastUpdated(new Date());
      }
    } catch {
      // Ignore polling errors while reconnecting
    }
  }, []);

  const connectWs = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === 'telemetry' && packet.data) {
            setReading(packet.data);
            setLastUpdated(new Date());
          }
        } catch (e) {
          console.warn('Error parsing telemetry frame:', e);
        }
      };

      ws.onerror = () => {
        // Handled by onclose
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Schedule reconnect in 3 seconds
        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWs();
        }, 3000);
      };
    } catch {
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    // Initial fetch to populate immediately
    fallbackPoll();
    connectWs();

    // Fallback polling every 4s in case WS is dropped
    const pollInterval = window.setInterval(() => {
      if (connectionStatus !== 'connected') {
        fallbackPoll();
      }
    }, 4000);

    return () => {
      isUnmountedRef.current = true;
      window.clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs, fallbackPoll, connectionStatus]);

  return {
    reading,
    connectionStatus,
    lastUpdated,
    refreshNow: fallbackPoll
  };
}
