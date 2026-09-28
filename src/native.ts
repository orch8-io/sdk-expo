import { requireNativeModule, EventEmitter } from "expo-modules-core";
import type {
  NativeEngineConfig,
  NativeInstanceSummary,
  NativeInstanceState,
  NativeTickResult,
  NativeBackgroundRunResult,
  NativeSequenceInfo,
  NativeSyncResult,
  NativeContinuityImportResult,
  PowerState,
  NativeAsyncHandler,
  NativeNodeCapabilities,
  NativeNodeConnectivity,
  NativeNodeRegistration,
  NativePushWakeEnvelope,
  NativeTaskContext,
  NativeWorkerOptions,
  NativeWorkerStats,
  NativeWorkerWindowResult,
} from "./types.js";

interface Orch8NativeModule {
  createEngine(dbPath: string, config: NativeEngineConfig): void;
  destroyEngine(): void;
  registerHandler(name: string): void;
  resume(): void;
  pause(): void;
  tickOnce(): Promise<NativeTickResult>;
  runUntilIdle(maxTicks: number, timeBudgetMs: number): Promise<NativeBackgroundRunResult>;
  reportPowerState(state: PowerState): void;
  start(sequenceName: string, input: string, dedupKey?: string): string;
  cancelInstance(instanceId: string): void;
  getInstance(instanceId: string): NativeInstanceState;
  activeInstances(): NativeInstanceSummary[];
  completeStep(instanceId: string, stepName: string, output: string): void;
  importContinuityCapsule(
    capsuleJson: string,
    payloadBase64: string,
    payloadKeyBase64: string,
    destinationRuntimeId: string,
    destinationInstanceId: string,
  ): NativeContinuityImportResult;
  activateContinuityCapsule(
    capsuleId: string,
    destinationRuntimeId: string,
    destinationInstanceId: string,
  ): void;
  loadSequenceFromJson(json: string): void;
  loadSequencesFromUrl(url: string): Promise<number>;
  loadedSequences(): NativeSequenceInfo[];
  sync(manifestUrl: string): Promise<NativeSyncResult>;
  setDeviceContext(deviceId: string, osName: string, osVersion: string, appVersion: string): void;
  flushTelemetry(endpoint: string): Promise<{ eventsFlushed: number; dropped: number }>;
  // Awaited JS handlers (any engine version).
  registerAsyncHandler(name: string): void;
  resolveHandler(requestId: string, output: string | null, error: string | null, permanent: boolean): void;
  // Runtime node / worker: present only when the module was compiled against
  // an engine that has them (`runtimeNodeAvailable`).
  runtimeNodeAvailable?: boolean;
  nodeRuntimeId?(): Promise<string>;
  registerNode?(capabilities: NativeNodeCapabilities): Promise<NativeNodeRegistration>;
  updateNodeStatus?(connectivity: NativeNodeConnectivity | null, batteryPercent: number | null): Promise<void>;
  unregisterNode?(): Promise<void>;
  startWorker?(options: NativeWorkerOptions): Promise<void>;
  stopWorker?(): Promise<void>;
  runWorkerWindow?(timeBudgetMs: number): Promise<NativeWorkerWindowResult>;
  workerStats?(): Promise<NativeWorkerStats>;
  onPushWake?(envelopeJson: string): Promise<boolean>;
  enableBuiltin?(name: string): void;
}

/** Throw from an async handler to fail the step permanently (no retry). */
export class PermanentHandlerError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = "PermanentHandlerError";
  }
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Reads the reserved `__orch8` member the worker loop adds to a remote task's
 * params. Returns null for local steps, non-object params, or invalid JSON.
 */
export function parseTaskContext(params: string): NativeTaskContext | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const meta = (parsed as Record<string, unknown>).__orch8;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  return {
    effectId: str(m.effect_id),
    taskId: str(m.task_id),
    instanceId: str(m.instance_id),
    blockId: str(m.block_id),
    attempt: num(m.attempt),
    runtimeId: str(m.runtime_id),
    continuityEpoch: num(m.continuity_epoch),
    resumeCheckpoint: m.resume_checkpoint ?? null,
  };
}

/** Minimum `orch8NativeVersion` whose pod/AAR contain the runtime node API. */
export const RUNTIME_NODE_MIN_NATIVE_VERSION = "0.7.2";

const NativeModule = requireNativeModule<Orch8NativeModule>("Orch8ExpoModule");

export type NativeEngineEvent =
  | { type: "stepPending"; instanceId: string; stepName: string; prompt?: string }
  | { type: "instanceCompleted"; instanceId: string; sequenceName: string }
  | { type: "instanceFailed"; instanceId: string; error: string }
  | { type: "instanceCancelled"; instanceId: string }
  | {
      /** An awaited handler (`registerAsyncHandler`) is waiting for `resolveHandler`. */
      type: "handlerRequest";
      requestId: string;
      stepName: string;
      handlerName: string;
      params: string;
    }
  | {
      type: "handlerInvoked";
      /** Name of the step whose handler ran. */
      stepName: string;
      /** @deprecated Carries the step name, not an instance ID. Use `stepName`. */
      instanceId: string;
      handlerName: string;
      /** The step's input JSON. */
      params: string;
    };

type EngineEventsMap = {
  onEngineEvent: (event: NativeEngineEvent) => void;
};

const emitter = new EventEmitter<EngineEventsMap>(
  NativeModule as unknown as InstanceType<typeof EventEmitter>,
);

export class NativeEngine {
  private initialized = false;
  private readonly asyncHandlers = new Map<string, NativeAsyncHandler>();
  private handlerSubscription: { remove(): void } | null = null;

  get isInitialized(): boolean {
    return this.initialized;
  }

  private assertReady(): void {
    if (!this.initialized) {
      throw new Error("NativeEngine not initialized — call create() first");
    }
  }

  create(dbPath: string, config: NativeEngineConfig = {}): void {
    if (this.initialized) {
      throw new Error("NativeEngine already initialized — call destroy() before re-creating");
    }
    NativeModule.createEngine(dbPath, config);
    this.initialized = true;
  }

  destroy(): void {
    if (!this.initialized) return;
    NativeModule.destroyEngine();
    this.initialized = false;
    this.handlerSubscription?.remove();
    this.handlerSubscription = null;
    this.asyncHandlers.clear();
  }

  registerHandler(name: string): void {
    this.assertReady();
    NativeModule.registerHandler(name);
  }

  resume(): void {
    this.assertReady();
    NativeModule.resume();
  }

  pause(): void {
    this.assertReady();
    NativeModule.pause();
  }

  tickOnce(): Promise<NativeTickResult> {
    this.assertReady();
    return NativeModule.tickOnce();
  }

  /** Drain work within an OS-granted background window. */
  runUntilIdle(maxTicks = 25, timeBudgetMs = 20_000): Promise<NativeBackgroundRunResult> {
    this.assertReady();
    if (!Number.isInteger(maxTicks) || maxTicks <= 0) {
      throw new Error("maxTicks must be a positive integer");
    }
    if (!Number.isFinite(timeBudgetMs) || timeBudgetMs <= 0) {
      throw new Error("timeBudgetMs must be greater than zero");
    }
    return NativeModule.runUntilIdle(maxTicks, timeBudgetMs);
  }

  reportPowerState(state: PowerState): void {
    this.assertReady();
    NativeModule.reportPowerState(state);
  }

  start(sequenceName: string, input: Record<string, unknown> = {}, dedupKey?: string): string {
    this.assertReady();
    return NativeModule.start(sequenceName, JSON.stringify(input), dedupKey);
  }

  cancelInstance(instanceId: string): void {
    this.assertReady();
    NativeModule.cancelInstance(instanceId);
  }

  getInstance(instanceId: string): NativeInstanceState {
    this.assertReady();
    return NativeModule.getInstance(instanceId);
  }

  getInstanceParsed(instanceId: string): NativeInstanceState & { parsedContext: Record<string, unknown> } {
    const state = this.getInstance(instanceId);
    let parsedContext: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(state.context);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        parsedContext = parsed as Record<string, unknown>;
      }
    } catch {
      // context may not be valid JSON
    }
    return { ...state, parsedContext };
  }

  activeInstances(): NativeInstanceSummary[] {
    this.assertReady();
    return NativeModule.activeInstances();
  }

  completeStep(instanceId: string, stepName: string, output: Record<string, unknown> = {}): void {
    this.assertReady();
    NativeModule.completeStep(instanceId, stepName, JSON.stringify(output));
  }

  importContinuityCapsule(
    capsuleJson: string | Record<string, unknown>,
    payloadBase64: string,
    payloadKeyBase64: string,
    destinationRuntimeId: string,
    destinationInstanceId: string,
  ): NativeContinuityImportResult {
    this.assertReady();
    return NativeModule.importContinuityCapsule(
      typeof capsuleJson === "string" ? capsuleJson : JSON.stringify(capsuleJson),
      payloadBase64,
      payloadKeyBase64,
      destinationRuntimeId,
      destinationInstanceId,
    );
  }

  activateContinuityCapsule(
    capsuleId: string,
    destinationRuntimeId: string,
    destinationInstanceId: string,
  ): void {
    this.assertReady();
    NativeModule.activateContinuityCapsule(
      capsuleId,
      destinationRuntimeId,
      destinationInstanceId,
    );
  }

  loadSequenceFromJson(json: string | Record<string, unknown>): void {
    this.assertReady();
    const payload = typeof json === "string" ? json : JSON.stringify(json);
    NativeModule.loadSequenceFromJson(payload);
  }

  loadSequencesFromUrl(url: string): Promise<number> {
    this.assertReady();
    return NativeModule.loadSequencesFromUrl(url);
  }

  loadedSequences(): NativeSequenceInfo[] {
    this.assertReady();
    return NativeModule.loadedSequences();
  }

  sync(manifestUrl: string): Promise<NativeSyncResult> {
    this.assertReady();
    return NativeModule.sync(manifestUrl);
  }

  setDeviceContext(
    deviceId: string,
    osName: string,
    osVersion: string,
    appVersion: string,
  ): void {
    this.assertReady();
    NativeModule.setDeviceContext(deviceId, osName, osVersion, appVersion);
  }

  flushTelemetry(endpoint: string): Promise<{ eventsFlushed: number; dropped: number }> {
    this.assertReady();
    return NativeModule.flushTelemetry(endpoint);
  }

  /**
   * Register an awaited JS handler. Unlike `registerHandler` (fire-and-forget,
   * returns `{}` at once), the native engine thread waits for `handler`'s
   * result, up to `handlerTimeoutMs`, and records it as the step output. Use
   * this for handlers that serve remote tasks through the worker loop.
   */
  registerAsyncHandler(name: string, handler: NativeAsyncHandler): void {
    this.assertReady();
    this.asyncHandlers.set(name, handler);
    if (!this.handlerSubscription) {
      this.handlerSubscription = emitter.addListener("onEngineEvent", (event: NativeEngineEvent) => {
        if (event.type === "handlerRequest") void this.dispatchHandlerRequest(event);
      });
    }
    NativeModule.registerAsyncHandler(name);
  }

  /** @internal exported for tests */
  async dispatchHandlerRequest(event: Extract<NativeEngineEvent, { type: "handlerRequest" }>): Promise<void> {
    const handler = this.asyncHandlers.get(event.handlerName);
    if (!handler) {
      NativeModule.resolveHandler(event.requestId, null, `No handler registered for '${event.handlerName}'`, false);
      return;
    }
    try {
      const result = await handler(event.params, {
        stepName: event.stepName,
        handlerName: event.handlerName,
        task: parseTaskContext(event.params),
      });
      const output = typeof result === "string" ? result : JSON.stringify(result ?? {});
      NativeModule.resolveHandler(event.requestId, output, null, false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const permanent =
        e instanceof PermanentHandlerError ||
        (typeof e === "object" && e !== null && (e as { permanent?: unknown }).permanent === true);
      NativeModule.resolveHandler(event.requestId, null, message, permanent);
    }
  }

  // -- Runtime node / worker -------------------------------------------------

  /**
   * True when the native module was compiled against an engine with the
   * runtime node API (`orch8NativeVersion` >= 0.7.2). The published 0.7.1
   * pod and AAR predate it.
   */
  get runtimeNodeAvailable(): boolean {
    return NativeModule.runtimeNodeAvailable === true;
  }

  private node(): Required<Pick<Orch8NativeModule,
    | "nodeRuntimeId"
    | "registerNode"
    | "updateNodeStatus"
    | "unregisterNode"
    | "startWorker"
    | "stopWorker"
    | "runWorkerWindow"
    | "workerStats"
    | "onPushWake"
    | "enableBuiltin">> {
    this.assertReady();
    if (!this.runtimeNodeAvailable) {
      throw new Error(
        "The runtime node API needs @orch8.io/expo built against Orch8 engine " +
          `${RUNTIME_NODE_MIN_NATIVE_VERSION} or later (orch8NativeVersion); ` +
          "the 0.7.1 Orch8Mobile pod and AAR do not include it.",
      );
    }
    return NativeModule as never;
  }

  /** Stable runtime UUID of this installation (the lease `worker_id`). */
  async nodeRuntimeId(): Promise<string> {
    return this.node().nodeRuntimeId();
  }

  /**
   * Join the runtime mesh: registers device + capabilities with `syncUrl` and
   * `syncApiKey`, then re-advertises before the 5-minute capability TTL.
   */
  async registerNode(capabilities: NativeNodeCapabilities = {}): Promise<NativeNodeRegistration> {
    const n = this.node();
    if (capabilities.batteryPercent !== undefined) assertPercent(capabilities.batteryPercent);
    return n.registerNode(capabilities);
  }

  async updateNodeStatus(connectivity?: NativeNodeConnectivity, batteryPercent?: number): Promise<void> {
    const n = this.node();
    if (batteryPercent !== undefined) assertPercent(batteryPercent);
    return n.updateNodeStatus(connectivity ?? null, batteryPercent ?? null);
  }

  /** Stop the worker, advertise `draining`, stop re-advertising. */
  async unregisterNode(): Promise<void> {
    return this.node().unregisterNode();
  }

  /** Start the remote worker loop. Register handlers with `registerAsyncHandler` first. */
  async startWorker(options: NativeWorkerOptions = {}): Promise<void> {
    const n = this.node();
    if (options.maxConcurrentTasks !== undefined) assertPositiveInt("maxConcurrentTasks", options.maxConcurrentTasks);
    if (options.idlePollIntervalMs !== undefined) assertPositiveInt("idlePollIntervalMs", options.idlePollIntervalMs);
    return n.startWorker(options);
  }

  async stopWorker(): Promise<void> {
    return this.node().stopWorker();
  }

  /** Claim and run remote tasks inside a bounded background window (claims even while paused). */
  async runWorkerWindow(timeBudgetMs: number): Promise<NativeWorkerWindowResult> {
    const n = this.node();
    assertPositiveInt("timeBudgetMs", timeBudgetMs);
    return n.runWorkerWindow(timeBudgetMs);
  }

  async workerStats(): Promise<NativeWorkerStats> {
    return this.node().workerStats();
  }

  /**
   * Forward an id-only wake push (`{task_id?, runtime_id?, reason?}`, or a
   * payload nesting them under `orch8`). Resolves false when it is not for this
   * runtime or carries no Orch8 fields.
   */
  async onPushWake(payload: NativePushWakeEnvelope | Record<string, unknown> | string): Promise<boolean> {
    const n = this.node();
    const envelope = typeof payload === "string" ? payload : JSON.stringify(pickWakeFields(payload as Record<string, unknown>));
    if (envelope === "{}") return false;
    return n.onPushWake(envelope);
  }

  /** Enable an opt-in builtin handler (`http_request`) before `resume()`. */
  enableBuiltin(name: string): void {
    this.node().enableBuiltin(name);
  }

  addListener(
    eventName: "onEngineEvent",
    listener: (event: NativeEngineEvent) => void,
  ): { remove(): void } {
    return emitter.addListener(eventName, listener);
  }
}

function assertPercent(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError("batteryPercent must be an integer between 0 and 100");
  }
}

function assertPositiveInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function pickWakeFields(payload: Record<string, unknown>): NativePushWakeEnvelope {
  const nested = payload.orch8;
  const source =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : payload;
  const out: NativePushWakeEnvelope = {};
  for (const key of ["task_id", "runtime_id", "reason"] as const) {
    const value = source[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
