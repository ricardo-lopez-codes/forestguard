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
  const heartbeatIntervalRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);
  const isWsConnectedRef = useRef(false);

  const pollLatest = useCallback(async () => {
    try {
      const data = await fetchCurrentTelemetry();
      if (data.reading && !isUnmountedRef.current) {
        setReading(data.reading);
        setLastUpdated(new Date());
      }
    } catch {
      // Ignore background poll errors
    }
  }, []);

  const connectWs = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
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
        isWsConnectedRef.current = true;
        setConnectionStatus('connected');

        // Start 10s ping heartbeat to keep cloud reverse proxies (Render / Cloudflare) alive
        if (heartbeatIntervalRef.current) window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send('ping');
            } catch {}
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === 'telemetry' && packet.data) {
            setReading(packet.data);
            setLastUpdated(new Date());
          }
        } catch {
          // Ignore parse errors (e.g. pong replies)
        }
      };

      ws.onerror = () => {
        // Will trigger onclose
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        isWsConnectedRef.current = false;
        setConnectionStatus('disconnected');
        wsRef.current = null;

        if (heartbeatIntervalRef.current) {
          window.clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Auto-reconnect after 2 seconds
        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWs();
        }, 2000);
      };
    } catch {
      isWsConnectedRef.current = false;
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    
    // Initial fetch to populate immediately
    pollLatest();
    connectWs();

    // Secondary fallback poller in case WebSocket has any transient cloud delay
    const pollInterval = window.setInterval(() => {
      if (!isWsConnectedRef.current) {
        pollLatest();
      }
    }, 2000);

    return () => {
      isUnmountedRef.current = true;
      window.clearInterval(pollInterval);
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs, pollLatest]); // DO NOT put connectionStatus here to avoid cyclic re-close!

  return {
    reading,
    connectionStatus,
    lastUpdated,
    refreshNow: pollLatest
  };
}
