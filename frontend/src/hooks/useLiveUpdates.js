import { useCallback, useEffect, useRef } from 'react';
import { getAuthToken } from '../api/client';

const API_BASE = String(import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const RECONNECT_MS = 5000;

/**
 * Site-wide live updates via SSE — pauses when tab hidden, reconnects on error.
 * Falls back silently if SSE unavailable (visibility poll elsewhere still works).
 */
export default function useLiveUpdates({ onEvent, enabled = true } = {}) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handlePayload = useCallback((raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      onEventRef.current?.(parsed.event, parsed.data, parsed);
    } catch {
      /* ignore malformed events */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const token = getAuthToken();
    if (!token) return undefined;

    let es = null;
    let reconnectTimer = null;
    let closed = false;

    const disconnect = () => {
      if (es) {
        es.close();
        es = null;
      }
    };

    const connect = () => {
      if (closed || document.hidden) return;
      disconnect();
      const url = `${API_BASE}/events/stream?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      const events = ['order_created', 'order_updated', 'repair_created', 'repair_updated', 'repair_message', 'product_updated'];
      for (const name of events) {
        es.addEventListener(name, (e) => handlePayload(e.data));
      }

      es.onmessage = (e) => handlePayload(e.data);

      es.onerror = () => {
        disconnect();
        if (!closed && !document.hidden) {
          reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
        }
      };
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        disconnect();
      } else {
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      disconnect();
    };
  }, [enabled, handlePayload]);
}
