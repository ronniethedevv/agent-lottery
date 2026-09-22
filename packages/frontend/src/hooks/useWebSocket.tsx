"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface WSEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

interface WSContextValue {
  connected: boolean;
  lastEvent: WSEvent | null;
  events: WSEvent[];
  subscribe: (type: string, callback: (data: unknown) => void) => () => void;
}

const WSContext = createContext<WSContextValue>({
  connected: false,
  lastEvent: null,
  events: [],
  subscribe: () => () => {},
});

const MAX_EVENTS = 100;

export function WebSocketProvider({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WSEvent;
          setLastEvent(parsed);
          setEvents((prev) => [parsed, ...prev].slice(0, MAX_EVENTS));

          const subs = subscribersRef.current.get(parsed.type);
          if (subs) {
            for (const cb of subs) cb(parsed.data);
          }
          const allSubs = subscribersRef.current.get("*");
          if (allSubs) {
            for (const cb of allSubs) cb(parsed);
          }
        } catch { /* ignore malformed messages */ }
      };
    }

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [url]);

  const subscribe = useCallback(
    (type: string, callback: (data: unknown) => void) => {
      if (!subscribersRef.current.has(type)) {
        subscribersRef.current.set(type, new Set());
      }
      subscribersRef.current.get(type)!.add(callback);

      return () => {
        subscribersRef.current.get(type)?.delete(callback);
      };
    },
    []
  );

  return (
    <WSContext.Provider value={{ connected, lastEvent, events, subscribe }}>
      {children}
    </WSContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WSContext);
}
