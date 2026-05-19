import ExpoModulesCore
import Orch8Mobile

public class Orch8ExpoModule: Module {
    private var engine: MobileEngine?

    public func definition() -> ModuleDefinition {
        Name("Orch8ExpoModule")

        Events("onEngineEvent")

        Function("createEngine") { (dbPath: String, config: [String: Any]) in
            let cfg = MobileEngineConfig(
                tenantId: config["tenantId"] as? String ?? "mobile",
                namespace: config["namespace"] as? String ?? "default",
                tickIntervalMs: UInt64(config["tickIntervalMs"] as? Int ?? 200),
                maxConcurrentSteps: UInt32(config["maxConcurrentSteps"] as? Int ?? 4),
                maxConcurrentInstances: UInt32(config["maxConcurrentInstances"] as? Int ?? 50),
                handlerTimeoutMs: UInt64(config["handlerTimeoutMs"] as? Int ?? 30000),
                maxStoredSequences: UInt32(config["maxStoredSequences"] as? Int ?? 100),
                maxSequenceSizeBytes: UInt64(config["maxSequenceSizeBytes"] as? Int ?? 1048576),
                maxInstanceLifetimeSecs: UInt64(config["maxInstanceLifetimeSecs"] as? Int ?? 86400),
                maxTickDurationMs: UInt64(config["maxTickDurationMs"] as? Int ?? 5000),
                memoryBudgetBytes: UInt64(config["memoryBudgetBytes"] as? Int ?? 0),
                telemetryEnabled: config["telemetryEnabled"] as? Bool ?? false,
                rootPublicKey: config["rootPublicKey"] as? String ?? "",
                sequencesUrl: config["sequencesUrl"] as? String ?? "",
                sdkVersion: "expo-0.1.0"
            )
            self.engine = try MobileEngine(dbPath: dbPath, config: cfg)
        }

        Function("destroyEngine") {
            if let eng = self.engine {
                eng.pause()
            }
            self.engine = nil
        }

        Function("registerHandler") { (name: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let handler = ExpoStepHandler(module: self, handlerName: name)
            try eng.registerHandler(name: name, handler: handler)
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
            let result = try eng.sync(manifestUrl: manifestUrl)
            return [
                "sequencesUpdated": result.sequencesUpdated,
                "sequencesRemoved": result.sequencesRemoved,
            ]
        }

        Function("setDeviceContext") { (deviceId: String, osName: String, osVersion: String, appVersion: String) in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            eng.setDeviceContext(
                deviceId: deviceId,
                osName: osName,
                osVersion: osVersion,
                appVersion: appVersion
            )
        }

        AsyncFunction("flushTelemetry") { (endpoint: String) -> [String: Any] in
            guard let eng = self.engine else { throw EngineNotInitialized() }
            let result = try eng.flushTelemetry(endpoint: endpoint)
            return [
                "eventsFlushed": result.eventsFlushed,
                "bytesSent": result.bytesSent,
            ]
        }
    }

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

    func execute(instanceId: String, params: String) throws -> String {
        module?.sendEvent("onEngineEvent", [
            "type": "handlerInvoked",
            "instanceId": instanceId,
            "handlerName": handlerName,
            "params": params,
        ])
        return "{}"
    }
}

class EngineNotInitialized: Exception {
    override var reason: String {
        "Native engine not initialized. Call createEngine() first."
    }
}
