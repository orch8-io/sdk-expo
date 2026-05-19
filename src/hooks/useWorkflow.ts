import { useState, useCallback, useRef, useEffect } from "react";
import type { TaskInstance, SequenceDefinition, CreateInstanceBody } from "../types.js";
import { useOrch8Client } from "../provider.js";

export interface UseWorkflowReturn {
  start: (body: CreateInstanceBody) => Promise<TaskInstance>;
  instances: TaskInstance[];
  sequences: SequenceDefinition[];
  loading: boolean;
  error: Error | null;
  listInstances: (filter?: Record<string, string>) => Promise<void>;
  listSequences: (filter?: Record<string, string>) => Promise<void>;
}

export function useWorkflow(): UseWorkflowReturn {
  const client = useOrch8Client();
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [sequences, setSequences] = useState<SequenceDefinition[]>([]);
  const [ops, setOps] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const start = useCallback(
    async (body: CreateInstanceBody) => {
      setOps((n) => n + 1);
      try {
        const inst = await client.createInstance(body);
        if (mountedRef.current) setError(null);
        return inst;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) setError(e);
        throw e;
      } finally {
        if (mountedRef.current) setOps((n) => n - 1);
      }
    },
    [client],
  );

  const listInstances = useCallback(
    async (filter?: Record<string, string>) => {
      setOps((n) => n + 1);
      try {
        const data = await client.listInstances(filter);
        if (mountedRef.current) {
          setInstances(data);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) setOps((n) => n - 1);
      }
    },
    [client],
  );

  const listSequences = useCallback(
    async (filter?: Record<string, string>) => {
      setOps((n) => n + 1);
      try {
        const data = await client.listSequences(filter);
        if (mountedRef.current) {
          setSequences(data);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) setOps((n) => n - 1);
      }
    },
    [client],
  );

  return {
    start,
    instances,
    sequences,
    loading: ops > 0,
    error,
    listInstances,
    listSequences,
  };
}
