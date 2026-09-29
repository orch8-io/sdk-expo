import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNativeModule: Record<string, any> = {
  createEngine: vi.fn(),
  destroyEngine: vi.fn(),
  registerAsyncHandler: vi.fn(),
  resolveHandler: vi.fn(),
  runtimeNodeAvailable: false,
  nodeRuntimeId: vi.fn(async () => "rt-1"),
  registerNode: vi.fn(),
  updateNodeStatus: vi.fn(async () => undefined),
  unregisterNode: vi.fn(async () => undefined),
  startWorker: vi.fn(async () => undefined),
  stopWorker: vi.fn(async () => undefined),
  runWorkerWindow: vi.fn(),
  workerStats: vi.fn(),
  onPushWake: vi.fn(async () => true),
  enableBuiltin: vi.fn(),
  setTokenProvider: vi.fn(async () => undefined),
  resolveToken: vi.fn(),
};

const listeners: Array<(event: any) => void> = [];
vi.mock("expo-modules-core", () => ({
  requireNativeModule: vi.fn(() => mockNativeModule),
  EventEmitter: class {
    addListener = (_name: string, fn: (event: any) => void) => {
      listeners.push(fn);
      return { remove: () => listeners.splice(listeners.indexOf(fn), 1) };
    };
  },
}));

const { NativeEngine, PermanentHandlerError, parseTaskContext } = await import("../native.js");
const emit = (event: unknown) => listeners.slice().forEach((fn) => fn(event));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("parseTaskContext", () => {
  it("maps __orch8 to camelCase", () => {
    expect(
      parseTaskContext(
        '{"doc":1,"__orch8":{"effect_id":"e","task_id":"t","instance_id":"i","block_id":"b","attempt":2,"runtime_id":"r","continuity_epoch":3}}',
      ),
    ).toEqual({
      effectId: "e",
      taskId: "t",
      instanceId: "i",
      blockId: "b",
      attempt: 2,
      runtimeId: "r",
      continuityEpoch: 3,
      resumeCheckpoint: null,
    });
  });

  it("returns null for local steps and invalid input", () => {
    expect(parseTaskContext("{}")).toBeNull();
    expect(parseTaskContext("[]")).toBeNull();
    expect(parseTaskContext("nope")).toBeNull();
  });
});

describe("awaited handlers", () => {
  let engine: InstanceType<typeof NativeEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.length = 0;
    engine = new NativeEngine();
    engine.create("/db");
  });

  it("answers handlerRequest with the handler output and task context", async () => {
    const handler = vi.fn(async (_params: string, ctx: any) => ({ key: ctx.task.effectId }));
    engine.registerAsyncHandler("scan", handler);
    expect(mockNativeModule.registerAsyncHandler).toHaveBeenCalledWith("scan");

    emit({
      type: "handlerRequest",
      requestId: "req-1",
      stepName: "scan",
      handlerName: "scan",
      params: '{"__orch8":{"effect_id":"eff-7"}}',
    });
    await flush();

    expect(handler.mock.calls[0]![1]).toMatchObject({ stepName: "scan", handlerName: "scan" });
    expect(mockNativeModule.resolveHandler).toHaveBeenCalledWith("req-1", '{"key":"eff-7"}', null, false);
  });

  it("maps PermanentHandlerError to a permanent failure and other errors to retryable", async () => {
    engine.registerAsyncHandler("bad", () => {
      throw new PermanentHandlerError("unsupported document");
    });
    engine.registerAsyncHandler("flaky", async () => {
      throw new Error("camera busy");
    });
    emit({ type: "handlerRequest", requestId: "1", stepName: "bad", handlerName: "bad", params: "{}" });
    emit({ type: "handlerRequest", requestId: "2", stepName: "flaky", handlerName: "flaky", params: "{}" });
    await flush();
    expect(mockNativeModule.resolveHandler).toHaveBeenCalledWith("1", null, "unsupported document", true);
    expect(mockNativeModule.resolveHandler).toHaveBeenCalledWith("2", null, "camera busy", false);
  });

  it("subscribes once and ignores other engine events", async () => {
    engine.registerAsyncHandler("a", () => "{}");
    engine.registerAsyncHandler("b", () => "{}");
    expect(listeners).toHaveLength(1);
    emit({ type: "stepPending", instanceId: "i", stepName: "s" });
    await flush();
    expect(mockNativeModule.resolveHandler).not.toHaveBeenCalled();
    engine.destroy();
    expect(listeners).toHaveLength(0);
  });
});

describe("runtime node gating", () => {
  let engine: InstanceType<typeof NativeEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new NativeEngine();
    engine.create("/db");
  });

  it("rejects with a version hint when the native build predates the API", async () => {
    mockNativeModule.runtimeNodeAvailable = false;
    expect(engine.runtimeNodeAvailable).toBe(false);
    await expect(engine.registerNode()).rejects.toThrow(/0\.7\.2 or later/);
    await expect(engine.startWorker()).rejects.toThrow(/orch8NativeVersion/);
    expect(() => engine.enableBuiltin("http_request")).toThrow(/0\.7\.1 Orch8Mobile pod and AAR/);
    expect(mockNativeModule.registerNode).not.toHaveBeenCalled();
  });

  it("forwards node and worker calls when available", async () => {
    mockNativeModule.runtimeNodeAvailable = true;
    mockNativeModule.registerNode.mockResolvedValue({ runtimeId: "rt-1", deviceId: "d", handlers: ["scan"], expiresAt: "e" });
    mockNativeModule.runWorkerWindow.mockResolvedValue({ claimed: 1, completed: 1, failed: 0, stillRunning: 0, budgetExhausted: false });

    expect((await engine.registerNode({ hardware: ["camera"], connectivity: "wifi" })).runtimeId).toBe("rt-1");
    expect(mockNativeModule.registerNode).toHaveBeenCalledWith({ hardware: ["camera"], connectivity: "wifi" });
    await engine.startWorker({ maxConcurrentTasks: 2 });
    expect(mockNativeModule.startWorker).toHaveBeenCalledWith({ maxConcurrentTasks: 2 });
    expect((await engine.runWorkerWindow(20_000)).completed).toBe(1);
    await engine.updateNodeStatus(undefined, 50);
    expect(mockNativeModule.updateNodeStatus).toHaveBeenCalledWith(null, 50);
    expect(await engine.nodeRuntimeId()).toBe("rt-1");
    engine.enableBuiltin("http_request");
    expect(mockNativeModule.enableBuiltin).toHaveBeenCalledWith("http_request");
    await engine.stopWorker();
    await engine.unregisterNode();
    expect(mockNativeModule.unregisterNode).toHaveBeenCalled();
  });

  it("validates arguments and reduces pushes to the id-only envelope", async () => {
    mockNativeModule.runtimeNodeAvailable = true;
    await expect(engine.registerNode({ batteryPercent: 120 })).rejects.toThrow(RangeError);
    await expect(engine.runWorkerWindow(0)).rejects.toThrow(RangeError);
    await expect(engine.startWorker({ idlePollIntervalMs: -1 })).rejects.toThrow(RangeError);

    await expect(engine.onPushWake({ orch8: { task_id: "t", params: { secret: 1 } } })).resolves.toBe(true);
    expect(mockNativeModule.onPushWake).toHaveBeenCalledWith('{"task_id":"t"}');
    await expect(engine.onPushWake({ aps: {} })).resolves.toBe(false);
    expect(mockNativeModule.onPushWake).toHaveBeenCalledTimes(1);
  });
});

describe("device-session token provider", () => {
  let engine: InstanceType<typeof NativeEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.length = 0;
    mockNativeModule.runtimeNodeAvailable = true;
    engine = new NativeEngine();
    engine.create("/db");
  });

  it("rejects with the required engine version when the native module is too old", async () => {
    mockNativeModule.runtimeNodeAvailable = false;
    const fetchToken = vi.fn(async () => "dst_1");
    await expect(engine.setTokenProvider(fetchToken)).rejects.toThrow(/0\.7\.2 or later/);
    expect(fetchToken).not.toHaveBeenCalled();
    expect(mockNativeModule.setTokenProvider).not.toHaveBeenCalled();
  });

  it("awaits the first token and installs it natively", async () => {
    const fetchToken = vi.fn(async () => "dst_1");
    await engine.setTokenProvider(fetchToken);
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.setTokenProvider).toHaveBeenCalledWith("dst_1");
  });

  it("rejects an empty first token or a non-function", async () => {
    await expect(engine.setTokenProvider(async () => "")).rejects.toThrow(TypeError);
    await expect(engine.setTokenProvider("dst_1" as never)).rejects.toThrow(TypeError);
    expect(mockNativeModule.setTokenProvider).not.toHaveBeenCalled();
  });

  it("answers a native refresh request with a fresh token", async () => {
    const tokens = ["dst_1", "dst_2"];
    await engine.setTokenProvider(async () => tokens.shift()!);
    emit({ type: "tokenRequest", requestId: "tok-1" });
    await flush();
    expect(mockNativeModule.resolveToken).toHaveBeenCalledWith("tok-1", "dst_2", null);
  });

  it("reports provider failures and empty tokens as errors", async () => {
    let calls = 0;
    await engine.setTokenProvider(async () => {
      calls += 1;
      if (calls === 1) return "dst_1";
      if (calls === 2) throw new Error("backend down");
      return "  ";
    });
    emit({ type: "tokenRequest", requestId: "tok-1" });
    await flush();
    expect(mockNativeModule.resolveToken).toHaveBeenCalledWith("tok-1", null, "backend down");
    emit({ type: "tokenRequest", requestId: "tok-2" });
    await flush();
    expect(mockNativeModule.resolveToken).toHaveBeenCalledWith(
      "tok-2", null, "token provider returned an empty token",
    );
  });

  it("stops answering after destroy", async () => {
    await engine.setTokenProvider(async () => "dst_1");
    engine.destroy();
    expect(listeners).toHaveLength(0);
    await engine.dispatchTokenRequest({ type: "tokenRequest", requestId: "tok-9" });
    expect(mockNativeModule.resolveToken).toHaveBeenCalledWith("tok-9", null, "no token provider installed");
  });
});
