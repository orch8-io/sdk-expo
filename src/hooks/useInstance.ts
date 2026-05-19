import { useState, useEffect, useCallback, useRef } from "react";
import type { TaskInstance, SendSignalBody } from "../types.js";
import { useOrch8Client } from "../provider.js";

export interface UseInstanceOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
}

export interface UseInstanceReturn {
  instance: TaskInstance | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  sendSignal: (body: SendSignalBody) => Promise<{ signal_id: string }>;
  retry: () => Promise<void>;
}

export function useInstance(
  instanceId: string | null,
  options: UseInstanceOptions = {},
): UseInstanceReturn {
  const { pollIntervalMs, enabled = true } = options;
  const client = useOrch8Client();
  const [instance, setInstance] = useState<TaskInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const hasDataRef = useRef(false);

  const fetchInstance = useCallback(async () => {
    if (!instanceId || !enabled) return;
    if (!hasDataRef.current) setLoading(true);
    try {
      const data = await client.getInstance(instanceId);
      if (mountedRef.current) {
        hasDataRef.current = true;
        setInstance(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [client, instanceId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  useEffect(() => {
    if (!pollIntervalMs || !instanceId || !enabled) return;
    const interval = setInterval(fetchInstance, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs, fetchInstance, instanceId, enabled]);

  const sendSignal = useCallback(
    async (body: SendSignalBody) => {
      if (!instanceId) throw new Error("No instance ID");
      return client.sendSignal(instanceId, body);
    },
    [client, instanceId],
  );

  const retry = useCallback(async () => {
    if (!instanceId) throw new Error("No instance ID");
    const retried = await client.retryInstance(instanceId);
    if (mountedRef.current) setInstance(retried);
  }, [client, instanceId]);

  return { instance, loading, error, refetch: fetchInstance, sendSignal, retry };
}
