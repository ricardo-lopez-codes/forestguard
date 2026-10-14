import React, { useState, useEffect } from 'react';
import { History, Check, AlertTriangle, ShieldAlert, Cpu, RadioOff, RefreshCw } from 'lucide-react';
import type { EventLog, SystemStatus } from '../types';
import { fetchEvents, acknowledgeEvent } from '../services/api';

interface EventHistoryProps {
  lastEventTrigger?: string;
}

export const EventHistory: React.FC<EventHistoryProps> = ({ lastEventTrigger }) => {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const pageSize = 15;

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await fetchEvents(pageSize, page * pageSize, filter);
      setEvents(res.events);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load event history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [page, filter, lastEventTrigger]);

  const handleAcknowledge = async (id: number) => {
    try {
      await acknowledgeEvent(id);
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, acknowledged: true } : e))
      );
    } catch (err) {
      console.error('Failed to acknowledge event:', err);
    }
  };

  const getEventBadge = (type: string, status: SystemStatus) => {
    switch (type) {
      case 'ALERT_TRIGGER':
        return (
          <span className="badge badge-alert">
            <ShieldAlert size={10} /> Fire Alert
          </span>
        );
      case 'SENSOR_ERROR':
        return (
          <span className="badge badge-error">
            <Cpu size={10} /> Sensor Error
          </span>
        );
      case 'DISCONNECT':
        return (
          <span className="badge badge-offline">
            <RadioOff size={10} /> Disconnected
          </span>
        );
      case 'ALERT_CLEAR':
        return (
          <span className="badge badge-normal">
            <Check size={10} /> Normal Cleared
          </span>
        );
      case 'STATUS_CHANGE':
      default:
        if (status === 'WATCH') {
          return (
            <span className="badge badge-watch">
              <AlertTriangle size={10} /> Watch
            </span>
          );
        }
        return <span className="badge badge-demo">{type}</span>;
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="card" style={{ marginTop: '16px' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={15} color="var(--forest-primary)" />
          <span className="card-title">Persistent Event &amp; Incident Log</span>
        </div>

        {/* Filter and Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            style={{
              fontSize: '11px',
              padding: '3px 6px',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            <option value="ALL">All Event Types</option>
            <option value="ALERT_TRIGGER">Fire Alerts</option>
            <option value="STATUS_CHANGE">Status Transitions</option>
            <option value="SENSOR_ERROR">Sensor Errors</option>
            <option value="DISCONNECT">Disconnects / Stale</option>
            <option value="ALERT_CLEAR">Cleared Normal</option>
          </select>

          <button
            className="btn btn-sm"
            onClick={loadEvents}
            title="Refresh event log"
          >
            <RefreshCw size={11} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{
              backgroundColor: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-light)',
              textAlign: 'left'
            }}>
              <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Timestamp</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Event Type</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status Transition</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Telemetry Readings</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Summary &amp; Triggers</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Review</th>
            </tr>
          </thead>
          <tbody>
            {events.length > 0 ? (
              events.map((evt) => (
                <tr
                  key={evt.id}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    backgroundColor: evt.acknowledged ? 'transparent' : 'rgba(0,0,0,0.01)'
                  }}
                >
                  <td className="mono" style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {formatTimestamp(evt.timestamp)}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {getEventBadge(evt.event_type, evt.new_status)}
                  </td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{evt.previous_status || 'INIT'}</span>
                    <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>→</span>
                    <strong style={{
                      color: evt.new_status === 'POTENTIAL FIRE ALERT' ? 'var(--status-alert-text)' :
                             evt.new_status === 'WATCH' ? 'var(--status-watch-text)' :
                             'var(--text-primary)'
                    }}>
                      {evt.new_status}
                    </strong>
                  </td>
                  <td className="mono" style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {evt.temperature_c !== null ? `${evt.temperature_c.toFixed(1)}°C` : 'Fault'} • MQ:{evt.mq2_raw ?? '—'}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                    {evt.trigger_summary || evt.description}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {evt.acknowledged ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Ack’d</span>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={() => handleAcknowledge(evt.id)}
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading logged events...' : 'No incident events recorded in database.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'var(--text-secondary)'
      }}>
        <span>
          Showing {events.length} of {total} records
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span style={{ padding: '3px 6px' }}>
            Page {page + 1} of {Math.max(1, totalPages)}
          </span>
          <button
            className="btn btn-sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
