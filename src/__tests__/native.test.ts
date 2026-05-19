import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNativeModule = {
  createEngine: vi.fn(),
  destroyEngine: vi.fn(),
  registerHandler: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  tickOnce: vi.fn(),
  reportPowerState: vi.fn(),
  start: vi.fn(),
  cancelInstance: vi.fn(),
  getInstance: vi.fn(),
  activeInstances: vi.fn(),
  completeStep: vi.fn(),
  loadSequenceFromJson: vi.fn(),
  loadSequencesFromUrl: vi.fn(),
  loadedSequences: vi.fn(),
  sync: vi.fn(),
  setDeviceContext: vi.fn(),
  flushTelemetry: vi.fn(),
};

const mockRemove = vi.fn();
const mockAddListener = vi.fn(() => ({ remove: mockRemove }));

vi.mock("expo-modules-core", () => {
  return {
    requireNativeModule: vi.fn(() => mockNativeModule),
    EventEmitter: class MockEventEmitter {
      constructor() {}
      addListener = mockAddListener;
    },
  };
});

const { NativeEngine } = await import("../native.js");

describe("NativeEngine", () => {
  let engine: InstanceType<typeof NativeEngine>;

  beforeEach(() => {
    engine = new NativeEngine();
    vi.clearAllMocks();
  });

  describe("lifecycle", () => {
    it("starts uninitialized", () => {
      expect(engine.isInitialized).toBe(false);
    });

    it("create() initializes the engine", () => {
      engine.create("/db/path");
      expect(engine.isInitialized).toBe(true);
      expect(mockNativeModule.createEngine).toHaveBeenCalledWith("/db/path", {});
    });

    it("create() passes config to native module", () => {
      const config = { tickIntervalMs: 100, maxConcurrent: 5 };
      engine.create("/db/path", config);
      expect(mockNativeModule.createEngine).toHaveBeenCalledWith("/db/path", config);
    });

    it("destroy() tears down an initialized engine", () => {
      engine.create("/db/path");
      engine.destroy();
      expect(engine.isInitialized).toBe(false);
      expect(mockNativeModule.destroyEngine).toHaveBeenCalled();
    });

    it("destroy() is a no-op when not initialized", () => {
      engine.destroy();
      expect(mockNativeModule.destroyEngine).not.toHaveBeenCalled();
    });

    it("can re-create after destroy", () => {
      engine.create("/db/path");
      engine.destroy();
      engine.create("/db/new-path");
      expect(engine.isInitialized).toBe(true);
      expect(mockNativeModule.createEngine).toHaveBeenCalledTimes(2);
    });
  });

  describe("assertReady guard", () => {
    const guardedMethods: Array<{ name: string; call: (e: any) => void }> = [
      { name: "registerHandler", call: (e) => e.registerHandler("h") },
      { name: "resume", call: (e) => e.resume() },
      { name: "pause", call: (e) => e.pause() },
      { name: "tickOnce", call: (e) => e.tickOnce() },
      { name: "reportPowerState", call: (e) => e.reportPowerState("active") },
      { name: "start", call: (e) => e.start("seq") },
      { name: "cancelInstance", call: (e) => e.cancelInstance("id") },
      { name: "getInstance", call: (e) => e.getInstance("id") },
      { name: "activeInstances", call: (e) => e.activeInstances() },
      { name: "completeStep", call: (e) => e.completeStep("id", "step") },
      { name: "loadSequenceFromJson", call: (e) => e.loadSequenceFromJson("{}") },
      { name: "loadSequencesFromUrl", call: (e) => e.loadSequencesFromUrl("http://x") },
      { name: "loadedSequences", call: (e) => e.loadedSequences() },
      { name: "sync", call: (e) => e.sync("http://x") },
      { name: "setDeviceContext", call: (e) => e.setDeviceContext("d", "ios", "17", "1.0") },
      { name: "flushTelemetry", call: (e) => e.flushTelemetry("http://x") },
    ];

    for (const { name, call } of guardedMethods) {
      it(`${name}() throws before create()`, () => {
        expect(() => call(engine)).toThrow("NativeEngine not initialized");
      });

      it(`${name}() works after create()`, () => {
        engine.create("/db/path");
        expect(() => call(engine)).not.toThrow();
      });

      it(`${name}() throws after destroy()`, () => {
        engine.create("/db/path");
        engine.destroy();
        expect(() => call(engine)).toThrow("NativeEngine not initialized");
      });
    }
  });

  describe("JSON serialization", () => {
    beforeEach(() => engine.create("/db/path"));

    it("start() serializes input to JSON", () => {
      mockNativeModule.start.mockReturnValue("inst-1");
      const id = engine.start("mySeq", { key: "value" });
      expect(id).toBe("inst-1");
      expect(mockNativeModule.start).toHaveBeenCalledWith(
        "mySeq",
        '{"key":"value"}',
        undefined,
      );
    });

    it("start() defaults input to empty object", () => {
      mockNativeModule.start.mockReturnValue("inst-2");
      engine.start("mySeq");
      expect(mockNativeModule.start).toHaveBeenCalledWith("mySeq", "{}", undefined);
    });

    it("start() passes dedupKey", () => {
      mockNativeModule.start.mockReturnValue("inst-3");
      engine.start("mySeq", { a: 1 }, "dedup-123");
      expect(mockNativeModule.start).toHaveBeenCalledWith(
        "mySeq",
        '{"a":1}',
        "dedup-123",
      );
    });

    it("completeStep() serializes output to JSON", () => {
      engine.completeStep("inst-1", "step-a", { result: true });
      expect(mockNativeModule.completeStep).toHaveBeenCalledWith(
        "inst-1",
        "step-a",
        '{"result":true}',
      );
    });

    it("completeStep() defaults output to empty object", () => {
      engine.completeStep("inst-1", "step-a");
      expect(mockNativeModule.completeStep).toHaveBeenCalledWith(
        "inst-1",
        "step-a",
        "{}",
      );
    });

    it("loadSequenceFromJson() passes string through", () => {
      engine.loadSequenceFromJson('{"name":"test"}');
      expect(mockNativeModule.loadSequenceFromJson).toHaveBeenCalledWith('{"name":"test"}');
    });

    it("loadSequenceFromJson() serializes object to JSON", () => {
      engine.loadSequenceFromJson({ name: "test", steps: [] });
      expect(mockNativeModule.loadSequenceFromJson).toHaveBeenCalledWith(
        '{"name":"test","steps":[]}',
      );
    });
  });

  describe("passthrough methods", () => {
    beforeEach(() => engine.create("/db/path"));

    it("registerHandler() forwards name", () => {
      engine.registerHandler("onApproval");
      expect(mockNativeModule.registerHandler).toHaveBeenCalledWith("onApproval");
    });

    it("resume() calls native resume", () => {
      engine.resume();
      expect(mockNativeModule.resume).toHaveBeenCalled();
    });

    it("pause() calls native pause", () => {
      engine.pause();
      expect(mockNativeModule.pause).toHaveBeenCalled();
    });

    it("tickOnce() returns native result", () => {
      const result = { stepsExecuted: 3, instancesCompleted: 1 };
      mockNativeModule.tickOnce.mockReturnValue(result);
      expect(engine.tickOnce()).toEqual(result);
    });

    it("reportPowerState() forwards state", () => {
      engine.reportPowerState("background");
      expect(mockNativeModule.reportPowerState).toHaveBeenCalledWith("background");
    });

    it("cancelInstance() forwards id", () => {
      engine.cancelInstance("inst-1");
      expect(mockNativeModule.cancelInstance).toHaveBeenCalledWith("inst-1");
    });

    it("getInstance() returns native state", () => {
      const state = { id: "inst-1", status: "running", steps: [] };
      mockNativeModule.getInstance.mockReturnValue(state);
      expect(engine.getInstance("inst-1")).toEqual(state);
    });

    it("activeInstances() returns native list", () => {
      const list = [{ id: "inst-1", sequenceName: "seq", status: "running" }];
      mockNativeModule.activeInstances.mockReturnValue(list);
      expect(engine.activeInstances()).toEqual(list);
    });

    it("loadSequencesFromUrl() returns count", () => {
      mockNativeModule.loadSequencesFromUrl.mockReturnValue(3);
      expect(engine.loadSequencesFromUrl("http://example.com/seqs")).toBe(3);
    });

    it("loadedSequences() returns native list", () => {
      const seqs = [{ name: "onboarding", version: 1 }];
      mockNativeModule.loadedSequences.mockReturnValue(seqs);
      expect(engine.loadedSequences()).toEqual(seqs);
    });

    it("sync() returns native result", () => {
      const result = { added: 1, updated: 0, removed: 0 };
      mockNativeModule.sync.mockReturnValue(result);
      expect(engine.sync("http://example.com/manifest")).toEqual(result);
    });

    it("setDeviceContext() forwards all params", () => {
      engine.setDeviceContext("device-1", "iOS", "17.4", "2.1.0");
      expect(mockNativeModule.setDeviceContext).toHaveBeenCalledWith(
        "device-1",
        "iOS",
        "17.4",
        "2.1.0",
      );
    });

    it("flushTelemetry() returns native result", () => {
      const result = { eventsFlushed: 42, bytesSent: 8192 };
      mockNativeModule.flushTelemetry.mockReturnValue(result);
      expect(engine.flushTelemetry("http://telemetry.example.com")).toEqual(result);
    });
  });

  describe("event listener", () => {
    it("addListener() works without initialization", () => {
      const listener = vi.fn();
      const sub = engine.addListener("onEngineEvent", listener);
      expect(mockAddListener).toHaveBeenCalledWith("onEngineEvent", listener);
      expect(sub).toHaveProperty("remove");
    });

    it("subscription remove() calls through", () => {
      const sub = engine.addListener("onEngineEvent", vi.fn());
      sub.remove();
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
