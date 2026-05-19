import { useState, useEffect, useRef, useCallback } from "react";
import type { InstanceSSEEvent } from "../types.js";
import { useOrch8Client } from "../provider.js";

export interface UseStreamOptions {
  enabled?: boolean;
  maxEvents?: number;
}

export interface UseStreamReturn {
  events: InstanceSSEEvent[];
  connected: boolean;
  error: Error | null;
  clear: () => void;
}

export function useStream(
  instanceId: string | null,
  options: UseStreamOptions = {},
): UseStreamReturn {
  const { enabled = true, maxEvents = 500 } = options;
  const client = useOrch8Client();
  const [events, setEvents] = useState<InstanceSSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!instanceId || !enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setEvents([]);
    setError(null);

    let didConnect = false;
    (async () => {
      try {
        for await (const event of client.streamInstance(instanceId, controller.signal)) {
          if (controller.signal.aborted) break;
          if (!didConnect) {
            didConnect = true;
            setConnected(true);
          }
          setEvents((prev) => {
            const next = [...prev, event];
            return next.length > maxEvents ? next.slice(-maxEvents) : next;
          });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!controller.signal.aborted) setConnected(false);
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [client, instanceId, enabled, maxEvents]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, error, clear };
}
