import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { telemetryWsUrl } from '@/lib/runtime-config';

export interface TelemetryEvent {
  type:
    | 'connected'
    | 'trip:location'
    | 'geofence:approach_500m'
    | 'trip:state'
    | 'attendance:updated'
    | 'pin:validated'
    | 'incident:created'
    | 'incident:updated'
    | 'notification:created'
    | 'simulation:status';
  payload: Record<string, unknown>;
  timestamp: string;
}

export function useTelemetrySocket(onEvent?: (event: TelemetryEvent) => void) {
  const { isAuthenticated, getAuthToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [recentEvents, setRecentEvents] = useState<TelemetryEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<TelemetryEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!isAuthenticated) {
      setConnected(false);
      return;
    }

    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    async function connect() {
      if (disposed || !isAuthenticated) return;
      try {
        const token = await getAuthToken();
        if (disposed || !token) return;

        const url = telemetryWsUrl(token);
        ws = new WebSocket(url);

        ws.onopen = () => {
          if (disposed) return;
          attempt = 0;
          setConnected(true);
        };

        ws.onmessage = (msg) => {
          if (disposed) return;
          try {
            const parsed = JSON.parse(String(msg.data)) as TelemetryEvent;
            setLastEvent(parsed);
            if (parsed.type !== 'connected') {
              setRecentEvents((prev) => [parsed, ...prev].slice(0, 25));
            }
            onEventRef.current?.(parsed);
          } catch {
            // Ignore malformed socket frames
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          setConnected(false);
          const delayMs = Math.min(10000, 1500 * Math.pow(1.5, attempt));
          attempt += 1;
          reconnectTimer = setTimeout(() => {
            void connect();
          }, delayMs);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!disposed) {
          reconnectTimer = setTimeout(() => {
            void connect();
          }, 3000);
        }
      }
    }

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      setConnected(false);
    };
  }, [isAuthenticated, getAuthToken]);

  return { connected, lastEvent, recentEvents };
}
