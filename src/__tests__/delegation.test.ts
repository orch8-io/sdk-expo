import { describe, it, expect, vi, beforeEach } from "vitest";

const status = {
  delegationId: "d-1",
  state: "completed",
  localInstanceId: "i-1",
  blockId: null,
  destinationRuntimeId: "rt-2",
  outputJson: '{"labels":["cat"]}',
  error: null,
};

const mockNativeModule: Record<string, any> = {
  createEngine: vi.fn(),
  destroyEngine: vi.fn(),
  delegationAvailable: false,
  startDelegation: vi.fn(async () => undefined),
  stopDelegation: vi.fn(async () => undefined),
  delegate: vi.fn(async () => "d-1"),
  delegationStatus: vi.fn(async () => status),
  listDelegations: vi.fn(async () => [status]),
  delegationStats: vi.fn(async () => ({ running: true, delegated: 1, completed: 1, failed: 0, abandoned: 0, resumed: 1 })),
};

vi.mock("expo-modules-core", () => ({
  requireNativeModule: vi.fn(() => mockNativeModule),
  EventEmitter: class {
    addListener = () => ({ remove: () => undefined });
  },
}));

const { NativeEngine } = await import("../native.js");

const IDS = {
  instanceId: "0192a000-0000-7000-8000-000000000001",
  destinationRuntimeId: "0192a000-0000-7000-8000-000000000002",
  subSequenceId: "0192a000-0000-7000-8000-000000000003",
};

describe("delegation gating", () => {
  let engine: InstanceType<typeof NativeEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new NativeEngine();
    engine.create("/db");
  });

  it("rejects with a version hint when the native build predates the API", async () => {
    mockNativeModule.delegationAvailable = false;
    expect(engine.delegationAvailable).toBe(false);
    await expect(engine.startDelegation({ tenantId: "acme" })).rejects.toThrow(/0\.7\.2 or later/);
    await expect(engine.delegate(IDS)).rejects.toThrow(/orch8NativeVersion/);
    await expect(engine.delegationStats()).rejects.toThrow(/0\.7\.1 Orch8Mobile pod and AAR/);
    expect(mockNativeModule.startDelegation).not.toHaveBeenCalled();
    expect(mockNativeModule.delegate).not.toHaveBeenCalled();
  });

  it("forwards delegation calls when available", async () => {
    mockNativeModule.delegationAvailable = true;
    await engine.startDelegation({ tenantId: "acme", ttlSecs: 60 });
    expect(mockNativeModule.startDelegation).toHaveBeenCalledWith({ tenantId: "acme", ttlSecs: 60 });

    await expect(engine.delegate({ ...IDS, input: { photo: { id: "p" } } })).resolves.toBe("d-1");
    expect(mockNativeModule.delegate).toHaveBeenCalledWith({ ...IDS, inputJson: '{"photo":{"id":"p"}}' });
    await engine.delegate(IDS);
    expect(mockNativeModule.delegate).toHaveBeenLastCalledWith({ ...IDS, inputJson: "{}" });

    await expect(engine.delegationStatus("d-1")).resolves.toEqual(status);
    expect(mockNativeModule.delegationStatus).toHaveBeenCalledWith("d-1");
    await expect(engine.listDelegations()).resolves.toEqual([status]);
    expect((await engine.delegationStats()).resumed).toBe(1);
    await engine.stopDelegation();
    expect(mockNativeModule.stopDelegation).toHaveBeenCalled();
  });

  it("validates arguments before crossing into the native module", async () => {
    mockNativeModule.delegationAvailable = true;
    await expect(engine.startDelegation({ tenantId: " " })).rejects.toThrow(TypeError);
    await expect(engine.startDelegation({ tenantId: "t", ttlSecs: 86_401 })).rejects.toThrow(RangeError);
    await expect(engine.startDelegation({ tenantId: "t", pollIntervalMs: 0 })).rejects.toThrow(RangeError);
    await expect(engine.delegate({ ...IDS, input: "[1]" })).rejects.toThrow(TypeError);
    await expect(engine.delegate({ ...IDS, input: "{" })).rejects.toThrow(TypeError);
    await expect(engine.delegate({ ...IDS, destinationRuntimeId: "" })).rejects.toThrow(TypeError);
    await expect(engine.delegationStatus("")).rejects.toThrow(TypeError);
    expect(mockNativeModule.startDelegation).not.toHaveBeenCalled();
    expect(mockNativeModule.delegate).not.toHaveBeenCalled();
    expect(mockNativeModule.delegationStatus).not.toHaveBeenCalled();
  });

  it("requires a created engine", async () => {
    mockNativeModule.delegationAvailable = true;
    const fresh = new NativeEngine();
    await expect(fresh.listDelegations()).rejects.toThrow();
    expect(mockNativeModule.listDelegations).not.toHaveBeenCalled();
  });
});
