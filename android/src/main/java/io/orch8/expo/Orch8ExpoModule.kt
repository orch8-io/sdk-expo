package io.orch8.expo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException
import io.orch8.mobile.MobileEngine
import io.orch8.mobile.MobileEngineConfig
import io.orch8.mobile.PowerState
import io.orch8.mobile.StepHandler
import io.orch8.mobile.InstanceStateKind

class Orch8ExpoModule : Module() {
    private var engine: MobileEngine? = null

    override fun definition() = ModuleDefinition {
        Name("Orch8ExpoModule")

        Events("onEngineEvent")

        Function("createEngine") { dbPath: String, config: Map<String, Any?> ->
            val cfg = MobileEngineConfig(
                tickIntervalMs = (config["tickIntervalMs"] as? Number)?.toLong() ?: 100L,
                maxConcurrentSteps = (config["maxConcurrentSteps"] as? Number)?.toInt() ?: 4,
                maxStepsPerInstance = (config["maxStepsPerInstance"] as? Number)?.toInt() ?: 1000,
                maxConcurrentInstances = (config["maxConcurrentInstances"] as? Number)?.toInt() ?: 10,
                maxTickDurationMs = (config["maxTickDurationMs"] as? Number)?.toLong() ?: 5000L,
                maxInstanceLifetimeSecs = (config["maxInstanceLifetimeSecs"] as? Number)?.toLong() ?: 86400L,
                maxStoredSequences = (config["maxStoredSequences"] as? Number)?.toInt() ?: 50,
                maxSequenceSizeBytes = (config["maxSequenceSizeBytes"] as? Number)?.toLong() ?: 1048576L,
                handlerTimeoutMs = (config["handlerTimeoutMs"] as? Number)?.toLong() ?: 30000L,
                operationTimeoutMs = (config["operationTimeoutMs"] as? Number)?.toLong() ?: 10000L,
                telemetryEnabled = config["telemetryEnabled"] as? Boolean ?: true,
                telemetryUrl = config["telemetryUrl"] as? String ?: "",
                environment = config["environment"] as? String ?: "production",
                rootPublicKey = config["rootPublicKey"] as? String ?: "",
                sdkVersion = "expo-0.3.0",
                memoryBudgetBytes = (config["memoryBudgetBytes"] as? Number)?.toLong() ?: 0L,
                sequencesUrl = config["sequencesUrl"] as? String ?: "",
                syncUrl = config["syncUrl"] as? String ?: "",
                deviceId = config["deviceId"] as? String ?: "",
                syncApiKey = config["syncApiKey"] as? String ?: "",
            )
            engine = MobileEngine(dbPath, cfg)
        }

        Function("destroyEngine") {
            engine?.pause()
            engine = null
        }

        Function("registerHandler") { name: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val handler = ExpoStepHandler(this@Orch8ExpoModule, name)
            eng.registerHandler(name, handler)
        }

        Function("resume") {
            val eng = engine ?: throw EngineNotInitialized()
            eng.resume()
        }

        Function("pause") {
            val eng = engine ?: throw EngineNotInitialized()
            eng.pause()
        }

        AsyncFunction("tickOnce") {
            val eng = engine ?: throw EngineNotInitialized()
            val result = eng.tickOnce()
            mapOf(
                "instancesAdvanced" to result.instancesAdvanced,
                "stepsExecuted" to result.stepsExecuted,
                "hasPendingWork" to result.hasPendingWork,
            )
        }

        AsyncFunction("runUntilIdle") { maxTicks: Int, timeBudgetMs: Long ->
            val eng = engine ?: throw EngineNotInitialized()
            require(maxTicks > 0 && timeBudgetMs > 0) {
                "maxTicks and timeBudgetMs must be greater than zero"
            }
            val result = eng.runUntilIdle(maxTicks.toUInt(), timeBudgetMs.toULong())
            mapOf(
                "ticksExecuted" to result.ticksExecuted.toInt(),
                "instancesAdvanced" to result.instancesAdvanced.toInt(),
                "stepsExecuted" to result.stepsExecuted.toInt(),
                "hasPendingWork" to result.hasPendingWork,
                "budgetExhausted" to result.budgetExhausted,
            )
        }

        Function("reportPowerState") { state: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val ps = when (state) {
                "charging" -> PowerState.CHARGING
                "lowBattery" -> PowerState.LOW_BATTERY
                "criticalBattery" -> PowerState.CRITICAL_BATTERY
                else -> PowerState.UNPLUGGED
            }
            eng.reportPowerState(ps)
        }

        Function("start") { sequenceName: String, input: String, dedupKey: String? ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.start(sequenceName, input, dedupKey)
        }

        Function("cancelInstance") { instanceId: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.cancelInstance(instanceId)
        }

        Function("getInstance") { instanceId: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val state = eng.getInstance(instanceId)
            mapOf(
                "instanceId" to state.instanceId,
                "sequenceName" to state.sequenceName,
                "state" to stateKindString(state.state),
                "context" to state.context,
                "createdAt" to state.createdAt,
                "updatedAt" to state.updatedAt,
            )
        }

        Function("activeInstances") {
            val eng = engine ?: throw EngineNotInitialized()
            eng.activeInstances().map { inst ->
                mapOf(
                    "instanceId" to inst.instanceId,
                    "sequenceName" to inst.sequenceName,
                    "state" to stateKindString(inst.state),
                    "createdAt" to inst.createdAt,
                )
            }
        }

        Function("completeStep") { instanceId: String, stepName: String, output: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.completeStep(instanceId, stepName, output)
        }

        Function("importContinuityCapsule") { capsuleJson: String, payloadBase64: String, payloadKeyBase64: String, destinationRuntimeId: String, destinationInstanceId: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val result = eng.importContinuityCapsule(
                capsuleJson,
                payloadBase64,
                payloadKeyBase64,
                destinationRuntimeId,
                destinationInstanceId,
            )
            mapOf(
                "capsuleId" to result.capsuleId,
                "continuityId" to result.continuityId,
                "instanceId" to result.instanceId,
                "sourceEpoch" to result.sourceEpoch,
                "state" to result.state,
            )
        }

        Function("activateContinuityCapsule") { capsuleId: String, destinationRuntimeId: String, destinationInstanceId: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.activateContinuityCapsule(
                capsuleId,
                destinationRuntimeId,
                destinationInstanceId,
            )
        }

        Function("loadSequenceFromJson") { json: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.loadSequenceFromJson(json)
        }

        AsyncFunction("loadSequencesFromUrl") { url: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.loadSequencesFromUrl(url).toInt()
        }

        Function("loadedSequences") {
            val eng = engine ?: throw EngineNotInitialized()
            eng.loadedSequences().map { seq ->
                mapOf("name" to seq.name, "version" to seq.version)
            }
        }

        AsyncFunction("sync") { manifestUrl: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val result = eng.sync(manifestUrl)
            mapOf(
                "sequencesUpdated" to result.sequencesUpdated,
                "sequencesRemoved" to result.sequencesRemoved,
            )
        }

        Function("setDeviceContext") { deviceId: String, osName: String, osVersion: String, appVersion: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.setDeviceContext(deviceId, osName, osVersion, appVersion)
        }

        AsyncFunction("flushTelemetry") { endpoint: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val result = eng.flushTelemetry(endpoint)
            mapOf(
                "eventsFlushed" to result.eventsFlushed,
                "bytesSent" to result.bytesSent,
            )
        }
    }

    private fun stateKindString(state: InstanceStateKind): String = when (state) {
        InstanceStateKind.SCHEDULED -> "scheduled"
        InstanceStateKind.RUNNING -> "running"
        InstanceStateKind.WAITING -> "waiting"
        InstanceStateKind.PAUSED -> "paused"
        InstanceStateKind.COMPLETED -> "completed"
        InstanceStateKind.FAILED -> "failed"
        InstanceStateKind.CANCELLED -> "cancelled"
    }
}

// Fire-and-forget bridge: returns "{}" immediately so the engine marks the step
// complete, then emits a JS event. For steps needing async JS logic, use
// wait_for_input blocks and completeStep() from the JS side instead.
private class ExpoStepHandler(
    private val module: Orch8ExpoModule,
    private val handlerName: String,
) : StepHandler {
    override fun execute(instanceId: String, params: String): String {
        module.sendEvent("onEngineEvent", mapOf(
            "type" to "handlerInvoked",
            "instanceId" to instanceId,
            "handlerName" to handlerName,
            "params" to params,
        ))
        return "{}"
    }
}

private class EngineNotInitialized : CodedException(
    code = "ERR_ENGINE_NOT_INITIALIZED",
    message = "Native engine not initialized. Call createEngine() first.",
    cause = null,
)
