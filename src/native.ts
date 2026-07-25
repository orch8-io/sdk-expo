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
  flushTelemetry(endpoint: string): Promise<{ eventsFlushed: number; bytesSent: number }>;
}

const NativeModule = requireNativeModule<Orch8NativeModule>("Orch8ExpoModule");

export type NativeEngineEvent =
  | { type: "stepPending"; instanceId: string; stepName: string; prompt?: string }
  | { type: "instanceCompleted"; instanceId: string; sequenceName: string }
  | { type: "instanceFailed"; instanceId: string; error: string }
  | { type: "instanceCancelled"; instanceId: string }
  | { type: "handlerInvoked"; instanceId: string; handlerName: string; params: string };

type EngineEventsMap = {
  onEngineEvent: (event: NativeEngineEvent) => void;
};

const emitter = new EventEmitter<EngineEventsMap>(
  NativeModule as unknown as InstanceType<typeof EventEmitter>,
);

export class NativeEngine {
  private initialized = false;

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

  flushTelemetry(endpoint: string): Promise<{ eventsFlushed: number; bytesSent: number }> {
    this.assertReady();
    return NativeModule.flushTelemetry(endpoint);
  }

  addListener(
    eventName: "onEngineEvent",
    listener: (event: NativeEngineEvent) => void,
  ): { remove(): void } {
    return emitter.addListener(eventName, listener);
  }
}
