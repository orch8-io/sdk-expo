import { useState, useEffect, useCallback, useRef } from "react";
import type {
  NativeInstanceSummary,
  NativeInstanceState,
} from "../types.js";
import type { NativeEngineEvent } from "../native.js";
import { useNativeEngine } from "../provider.js";

export interface UseNativeWorkflowOptions {
  autoResume?: boolean;
  pollActiveMs?: number;
  maxEvents?: number;
}

export interface UseNativeWorkflowReturn {
  start: (
    sequenceName: string,
    input?: Record<string, unknown>,
    dedupKey?: string,
  ) => string;
  cancelInstance: (instanceId: string) => void;
  completeStep: (
    instanceId: string,
    stepName: string,
    output?: Record<string, unknown>,
  ) => void;
  getInstance: (instanceId: string) => NativeInstanceState;
  activeInstances: NativeInstanceSummary[];
  pendingSteps: Array<{ instanceId: string; stepName: string; prompt?: string }>;
  events: NativeEngineEvent[];
  resume: () => void;
  pause: () => void;
}

export function useNativeWorkflow(
  options: UseNativeWorkflowOptions = {},
): UseNativeWorkflowReturn {
  const { autoResume = true, pollActiveMs = 500, maxEvents = 500 } = options;
  const engine = useNativeEngine();
  const [activeInstances, setActiveInstances] = useState<NativeInstanceSummary[]>([]);
  const [pendingSteps, setPendingSteps] = useState<
    Array<{ instanceId: string; stepName: string; prompt?: string }>
  >([]);
  const [events, setEvents] = useState<NativeEngineEvent[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (autoResume) engine.resume();
    return () => {
      engine.pause();
    };
  }, [engine, autoResume]);

  useEffect(() => {
    const sub = engine.addListener("onEngineEvent", (event) => {
      if (!mountedRef.current) return;
      setEvents((prev) => {
        const next = [...prev, event];
        return next.length > maxEvents ? next.slice(-maxEvents) : next;
      });

      if (event.type === "stepPending") {
        setPendingSteps((prev) => [
          ...prev,
          {
            instanceId: event.instanceId,
            stepName: event.stepName,
            prompt: event.prompt,
          },
        ]);
      }

      if (event.type === "instanceFailed" || event.type === "instanceCancelled") {
        setPendingSteps((prev) =>
          prev.filter((s) => s.instanceId !== event.instanceId),
        );
      }
    });
    return () => sub.remove();
  }, [engine, maxEvents]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      if (!mountedRef.current) return;
      try {
        const instances = engine.activeInstances();
        setActiveInstances(instances);
        if (instances.length > 0 && !interval) {
          interval = setInterval(refresh, pollActiveMs);
        } else if (instances.length === 0 && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch {
        // engine may not be ready
      }
    };
    refresh();
    if (!interval) {
      interval = setInterval(refresh, pollActiveMs);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [engine, pollActiveMs]);

  const start = useCallback(
    (sequenceName: string, input: Record<string, unknown> = {}, dedupKey?: string) => {
      const id = engine.start(sequenceName, input, dedupKey);
      setActiveInstances(engine.activeInstances());
      return id;
    },
    [engine],
  );

  const cancelInstance = useCallback(
    (instanceId: string) => {
      engine.cancelInstance(instanceId);
      setActiveInstances(engine.activeInstances());
    },
    [engine],
  );

  const completeStep = useCallback(
    (instanceId: string, stepName: string, output: Record<string, unknown> = {}) => {
      engine.completeStep(instanceId, stepName, output);
      setPendingSteps((prev) =>
        prev.filter(
          (s) => !(s.instanceId === instanceId && s.stepName === stepName),
        ),
      );
    },
    [engine],
  );

  const getInstanceFn = useCallback(
    (instanceId: string) => engine.getInstance(instanceId),
    [engine],
  );

  const resume = useCallback(() => engine.resume(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);

  return {
    start,
    cancelInstance,
    completeStep,
    getInstance: getInstanceFn,
    activeInstances,
    pendingSteps,
    events,
    resume,
    pause,
  };
}
