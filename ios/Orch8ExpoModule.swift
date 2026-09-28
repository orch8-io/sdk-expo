import ExpoModulesCore
import Foundation
import Orch8Mobile

/// Reported to the engine as `sdkVersion`; kept equal to package.json `version`.
let orch8ExpoSdkVersion = "expo-0.7.1"

/// The runtime node / worker API (`registerNode`, `startWorker`, ...) exists
/// in Orch8Mobile after 0.7.1. Orch8Expo.podspec defines ORCH8_RUNTIME_NODE
/// when `orch8NativeVersion` >= `orch8RuntimeNodeMinVersion` (package.json),
/// so the module still compiles against the published 0.7.1 pod.
#if ORCH8_RUNTIME_NODE
let orch8RuntimeNodeAvailable = true
#else
let orch8RuntimeNodeAvailable = false
#endif

public class Orch8ExpoModule: Module {
    private var engine: MobileEngine?
    private var handlerTimeoutMs: UInt64 = 30_000
    let pendingHandlers = PendingHandlerCalls()

    public func definition() -> ModuleDefinition {
        Name("Orch8ExpoModule")

        Events("onEngineEvent")

        Constants([
            "runtimeNodeAvailable": orch8RuntimeNodeAvailable,
        ])

        Function("createEngine") { (dbPath: String, config: [String: Any]) in
            let cfg = MobileEngineConfig(
                tickIntervalMs: UInt64(config["tickIntervalMs"] as? Int ?? 100),
                maxConcurrentSteps: UInt32(config["maxConcurrentSteps"] as? Int ?? 4),
                maxStepsPerInstance: UInt32(config["maxStepsPerInstance"] as? Int ?? 1000),
                maxConcurrentInstances: UInt32(config["maxConcurrentInstances"] as? Int ?? 10),
                maxTickDurationMs: UInt64(config["maxTickDurationMs"] as? Int ?? 5000),
                maxInstanceLifetimeSecs: UInt64(config["maxInstanceLifetimeSecs"] as? Int ?? 86400),
                maxStoredSequences: UInt32(config["maxStoredSequences"] as? Int ?? 50),
                maxSequenceSizeBytes: UInt64(config["maxSequenceSizeBytes"] as? Int ?? 1048576),
                handlerTimeoutMs: UInt64(config["handlerTimeoutMs"] as? Int ?? 30000),
                operationTimeoutMs: UInt64(config["operationTimeoutMs"] as? Int ?? 10000),
                telemetryEnabled: config["telemetryEnabled"] as? Bool ?? true,
                telemetryUrl: config["telemetryUrl"] as? String ?? "",
                environment: config["environment"] as? String ?? "production",
                rootPublicKey: config["rootPublicKey"] as? String ?? "",
                sdkVersion: orch8ExpoSdkVersion,
                memoryBudgetBytes: UInt64(config["memoryBudgetBytes"] as? Int ?? 0),
                sequencesUrl: config["sequencesUrl"] as? String ?? "",
                syncUrl: config["syncUrl"] as? String ?? "",
                deviceId: config["deviceId"] as? String ?? "",
                syncApiKey: config["syncApiKey"] as? String ?? ""
            )
            self.engine = try MobileEngine(dbPath: dbPath, config: cfg)
            self.handlerTimeoutMs = cfg.handlerTimeoutMs
        }

        Function("destroyEngine") {
            if let eng = self.engine {
                eng.pause()
            }
            self.engine = nil
            self.pendingHandlers.failAll("engine destroyed")
        }

        Function("registerHandler") { (name: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let handler = ExpoStepHandler(module: self, handlerName: name)
            try eng.registerHandler(name: name, handler: handler)
        }

        // Awaited handler: blocks the engine thread until JS calls
        // resolveHandler (or handlerTimeoutMs elapses). Works with any engine.
        Function("registerAsyncHandler") { (name: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.registerHandler(
                name: name,
                handler: ExpoAsyncStepHandler(module: self, handlerName: name, timeoutMs: self.handlerTimeoutMs)
            )
        }

        Function("resolveHandler") { (requestId: String, output: String?, error: String?, permanent: Bool) in
            self.pendingHandlers.resolve(requestId, output: output, error: error, permanent: permanent)
        }

        Function("resume") {
            guard let eng = self.engine else { throw EngineNotInitialized() }
            eng.resume()
        }

        Function("pause") {
            guard let eng = self.engine else { throw EngineNotInitialized() }
            eng.pause()
        }

        AsyncFunction("tickOnce") { () -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let result = try eng.tickOnce()
            return [
                "instancesAdvanced": result.instancesAdvanced,
                "stepsExecuted": result.stepsExecuted,
                "hasPendingWork": result.hasPendingWork,
            ]
        }

        AsyncFunction("runUntilIdle") { (maxTicks: Int, timeBudgetMs: Int) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            guard maxTicks > 0, maxTicks <= Int(UInt32.max), timeBudgetMs > 0 else {
                throw InvalidBackgroundBudget()
            }
            let result = try eng.runUntilIdle(
                maxTicks: UInt32(maxTicks),
                timeBudgetMs: UInt64(timeBudgetMs)
            )
            return [
                "ticksExecuted": result.ticksExecuted,
                "instancesAdvanced": result.instancesAdvanced,
                "stepsExecuted": result.stepsExecuted,
                "hasPendingWork": result.hasPendingWork,
                "budgetExhausted": result.budgetExhausted,
            ]
        }

        Function("reportPowerState") { (state: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let ps: PowerState
            switch state {
            case "charging": ps = .charging
            case "lowBattery": ps = .lowBattery
            case "criticalBattery": ps = .criticalBattery
            default: ps = .unplugged
            }
            eng.reportPowerState(state: ps)
        }

        Function("start") { (sequenceName: String, input: String, dedupKey: String?) -> String in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            return try eng.start(sequenceName: sequenceName, input: input, dedupKey: dedupKey)
        }

        Function("cancelInstance") { (instanceId: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.cancelInstance(instanceId: instanceId)
        }

        Function("getInstance") { (instanceId: String) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let state = try eng.getInstance(instanceId: instanceId)
            return [
                "instanceId": state.instanceId,
                "sequenceName": state.sequenceName,
                "state": Self.stateKindString(state.state),
                "context": state.context,
                "createdAt": state.createdAt,
                "updatedAt": state.updatedAt,
            ]
        }

        Function("activeInstances") { () -> [[String: Any]] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            return try eng.activeInstances().map { inst in
                [
                    "instanceId": inst.instanceId,
                    "sequenceName": inst.sequenceName,
                    "state": Self.stateKindString(inst.state),
                    "createdAt": inst.createdAt,
                ]
            }
        }

        Function("completeStep") { (instanceId: String, stepName: String, output: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.completeStep(instanceId: instanceId, stepName: stepName, output: output)
        }

        Function("importContinuityCapsule") { (capsuleJson: String, payloadBase64: String, payloadKeyBase64: String, destinationRuntimeId: String, destinationInstanceId: String) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let result = try eng.importContinuityCapsule(
                capsuleJson: capsuleJson,
                payloadBase64: payloadBase64,
                payloadKeyBase64: payloadKeyBase64,
                destinationRuntimeId: destinationRuntimeId,
                destinationInstanceId: destinationInstanceId
            )
            return [
                "capsuleId": result.capsuleId,
                "continuityId": result.continuityId,
                "instanceId": result.instanceId,
                "sourceEpoch": result.sourceEpoch,
                "state": result.state,
            ]
        }

        Function("activateContinuityCapsule") { (capsuleId: String, destinationRuntimeId: String, destinationInstanceId: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.activateContinuityCapsule(
                capsuleId: capsuleId,
                destinationRuntimeId: destinationRuntimeId,
                destinationInstanceId: destinationInstanceId
            )
        }

        Function("loadSequenceFromJson") { (json: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.loadSequenceFromJson(json: json)
        }

        AsyncFunction("loadSequencesFromUrl") { (url: String) -> Int in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            return Int(try eng.loadSequencesFromUrl(url: url))
        }

        Function("loadedSequences") { () -> [[String: Any]] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            return try eng.loadedSequences().map { seq in
                ["name": seq.name, "version": seq.version]
            }
        }

        AsyncFunction("sync") { (manifestUrl: String) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let result = try eng.sync(manifestUrl: manifestUrl, tokenProvider: nil)
            return [
                "sequencesUpdated": Int(result.added) + Int(result.updated),
                "sequencesRemoved": Int(result.removed),
                "added": Int(result.added),
                "updated": Int(result.updated),
                "removed": Int(result.removed),
                "skipped": Int(result.skipped),
                "signatureFailures": Int(result.signatureFailures),
            ]
        }

        Function("setDeviceContext") { (deviceId: String, osName: String, osVersion: String, appVersion: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            eng.setDeviceContext(ctx: DeviceContext(
                deviceId: deviceId,
                osName: osName,
                osVersion: osVersion,
                appVersion: appVersion,
                sdkVersion: orch8ExpoSdkVersion
            ))
        }

        AsyncFunction("flushTelemetry") { (endpoint: String) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let result = try eng.flushTelemetry(endpointUrl: endpoint)
            return [
                "eventsFlushed": result.sent,
                "dropped": result.dropped,
            ]
        }

        #if ORCH8_RUNTIME_NODE
        AsyncFunction("nodeRuntimeId") { () -> String in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            return try eng.nodeRuntimeId()
        }

        AsyncFunction("registerNode") { (caps: [String: Any]) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let r = try eng.registerNode(capabilities: NodeCapabilities(
                handlers: caps["handlers"] as? [String] ?? [],
                regions: caps["regions"] as? [String] ?? [],
                hardware: caps["hardware"] as? [String] ?? [],
                plugins: caps["plugins"] as? [String] ?? [],
                credentials: caps["credentials"] as? [String] ?? [],
                offlineCapable: caps["offlineCapable"] as? Bool ?? true,
                connectivity: Self.connectivity(caps["connectivity"] as? String),
                batteryPercent: (caps["batteryPercent"] as? Int).map { UInt8(clamping: $0) },
                platform: caps["platform"] as? String ?? "ios",
                pushToken: caps["pushToken"] as? String,
                appVersion: caps["appVersion"] as? String,
                apiBaseUrl: caps["apiBaseUrl"] as? String,
                capsuleSigningPublicKey: caps["capsuleSigningPublicKey"] as? String
            ))
            return [
                "runtimeId": r.runtimeId,
                "deviceId": r.deviceId,
                "handlers": r.handlers,
                "expiresAt": r.expiresAt,
            ]
        }

        AsyncFunction("updateNodeStatus") { (connectivity: String?, batteryPercent: Int?) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.updateNodeStatus(
                connectivity: Self.connectivity(connectivity),
                batteryPercent: batteryPercent.map { UInt8(clamping: $0) }
            )
        }

        AsyncFunction("unregisterNode") {
            guard let eng = self.engine else { throw EngineNotInitialized() }
            eng.unregisterNode()
        }

        AsyncFunction("startWorker") { (options: [String: Any]) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.startWorker(options: WorkerOptions(
                maxConcurrentTasks: UInt32(clamping: options["maxConcurrentTasks"] as? Int ?? 1),
                idlePollIntervalMs: UInt64(clamping: options["idlePollIntervalMs"] as? Int ?? 15000),
                version: options["version"] as? String
            ))
        }

        AsyncFunction("stopWorker") {
            guard let eng = self.engine else { throw EngineNotInitialized() }
            eng.stopWorker()
        }

        AsyncFunction("runWorkerWindow") { (timeBudgetMs: Int) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            guard timeBudgetMs > 0 else { throw InvalidBackgroundBudget() }
            let r = try eng.runWorkerWindow(timeBudgetMs: UInt64(timeBudgetMs))
            return [
                "claimed": Int(clamping: r.claimed),
                "completed": Int(clamping: r.completed),
                "failed": Int(clamping: r.failed),
                "stillRunning": Int(r.stillRunning),
                "budgetExhausted": r.budgetExhausted,
            ]
        }

        AsyncFunction("workerStats") { () -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let s = eng.workerStats()
            return [
                "running": s.running,
                "inFlight": Int(s.inFlight),
                "claimed": Int(clamping: s.claimed),
                "completed": Int(clamping: s.completed),
                "failed": Int(clamping: s.failed),
                "released": Int(clamping: s.released),
                "lost": Int(clamping: s.lost),
            ]
        }

        AsyncFunction("onPushWake") { (envelopeJson: String) -> Bool in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            return eng.onPushWake(envelopeJson: envelopeJson)
        }

        Function("enableBuiltin") { (name: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            try eng.enableBuiltin(name: name)
        }
        #endif
    }

    #if ORCH8_RUNTIME_NODE
    private static func connectivity(_ value: String?) -> NodeConnectivity? {
        switch value {
        case "offline": return .offline
        case "metered": return .metered
        case "wifi": return .wifi
        case "ethernet": return .ethernet
        default: return nil
        }
    }
    #endif

    private static func stateKindString(_ state: InstanceStateKind) -> String {
        switch state {
        case .scheduled: return "scheduled"
        case .running: return "running"
        case .waiting: return "waiting"
        case .paused: return "paused"
        case .completed: return "completed"
        case .failed: return "failed"
        case .cancelled: return "cancelled"
        }
    }
}

// Fire-and-forget bridge: returns "{}" immediately so the engine marks the step
// complete, then emits a JS event. For steps needing async JS logic, use
// wait_for_input blocks and completeStep() from the JS side instead.
class ExpoStepHandler: StepHandler {
    private weak var module: Orch8ExpoModule?
    private let handlerName: String

    init(module: Orch8ExpoModule, handlerName: String) {
        self.module = module
        self.handlerName = handlerName
    }

    func execute(stepName: String, input: String) throws -> String {
        module?.sendEvent("onEngineEvent", [
            "type": "handlerInvoked",
            "stepName": stepName,
            // Deprecated: 0.7.0 sent the step name under this key.
            "instanceId": stepName,
            "handlerName": handlerName,
            "params": input,
        ])
        return "{}"
    }
}

/// Outstanding native-to-JS handler calls, keyed by request id.
final class PendingHandlerCalls: @unchecked Sendable {
    struct Outcome {
        let output: String?
        let error: String?
        let permanent: Bool
    }

    private final class Slot {
        let semaphore = DispatchSemaphore(value: 0)
        var outcome: Outcome?
    }

    private let lock = NSLock()
    private var slots: [String: Slot] = [:]

    func open(_ id: String) {
        lock.lock(); slots[id] = Slot(); lock.unlock()
    }

    func wait(_ id: String, timeoutMs: UInt64) -> Outcome? {
        lock.lock(); let slot = slots[id]; lock.unlock()
        guard let slot else { return nil }
        let result = slot.semaphore.wait(timeout: .now() + .milliseconds(Int(min(timeoutMs, UInt64(Int32.max)))))
        lock.lock()
        slots.removeValue(forKey: id)
        let outcome = slot.outcome
        lock.unlock()
        return result == .success ? outcome : nil
    }

    func resolve(_ id: String, output: String?, error: String?, permanent: Bool) {
        lock.lock()
        guard let slot = slots[id], slot.outcome == nil else { lock.unlock(); return }
        slot.outcome = Outcome(output: output, error: error, permanent: permanent)
        lock.unlock()
        slot.semaphore.signal()
    }

    func failAll(_ message: String) {
        lock.lock()
        let open = slots.values.filter { $0.outcome == nil }
        for slot in open { slot.outcome = Outcome(output: nil, error: message, permanent: false) }
        lock.unlock()
        for slot in open { slot.semaphore.signal() }
    }
}

/// Emits `handlerRequest` and blocks the engine thread until JS answers with
/// `resolveHandler` or `handlerTimeoutMs` elapses (retryable failure).
final class ExpoAsyncStepHandler: StepHandler, @unchecked Sendable {
    private weak var module: Orch8ExpoModule?
    private let handlerName: String
    private let timeoutMs: UInt64

    init(module: Orch8ExpoModule, handlerName: String, timeoutMs: UInt64) {
        self.module = module
        self.handlerName = handlerName
        self.timeoutMs = timeoutMs
    }

    func execute(stepName: String, input: String) throws -> String {
        guard let module else { throw HandlerError.Retryable(message: "Expo module released") }
        let requestId = UUID().uuidString
        module.pendingHandlers.open(requestId)
        module.sendEvent("onEngineEvent", [
            "type": "handlerRequest",
            "requestId": requestId,
            "stepName": stepName,
            "handlerName": handlerName,
            "params": input,
        ])
        guard let outcome = module.pendingHandlers.wait(requestId, timeoutMs: timeoutMs) else {
            throw HandlerError.Retryable(message: "JS handler '\(handlerName)' timed out after \(timeoutMs) ms")
        }
        if let error = outcome.error {
            throw outcome.permanent
                ? HandlerError.Permanent(message: error)
                : HandlerError.Retryable(message: error)
        }
        return outcome.output ?? "{}"
    }
}

class EngineNotInitialized: Exception {
    override var reason: String {
        "Native engine not initialized. Call createEngine() first."
    }
}

class InvalidBackgroundBudget: Exception {
    override var reason: String {
        "maxTicks and timeBudgetMs must be greater than zero."
    }
}
