import ExpoModulesCore
import Orch8Mobile

/// Reported to the engine as `sdkVersion`; kept equal to package.json `version`.
let orch8ExpoSdkVersion = "expo-0.7.1"

public class Orch8ExpoModule: Module {
    private var engine: MobileEngine?

    public func definition() -> ModuleDefinition {
        Name("Orch8ExpoModule")

        Events("onEngineEvent")

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
