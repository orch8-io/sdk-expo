package io.orch8.expo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException
import io.orch8.mobile.DeviceContext
import io.orch8.mobile.HandlerException
import io.orch8.mobile.MobileEngine
import io.orch8.mobile.MobileEngineConfig
import io.orch8.mobile.PowerState
import io.orch8.mobile.StepHandler
import io.orch8.mobile.InstanceStateKind
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Reported to the engine as `sdkVersion`; kept equal to package.json `version`. */
internal const val ORCH8_EXPO_SDK_VERSION = "expo-0.7.1"

// UniFFI maps Rust u32/u64 to kotlin.UInt/ULong. JS numbers arrive as
// Double/Int/Long, and Expo cannot return unsigned inline classes, so convert
// at the boundary.
private fun Map<String, Any?>.uint(key: String, default: UInt): UInt =
    (this[key] as? Number)?.toLong()?.also { require(it >= 0) { "$key must be >= 0" } }?.toUInt() ?: default

private fun Map<String, Any?>.ulong(key: String, default: ULong): ULong =
    (this[key] as? Number)?.toLong()?.also { require(it >= 0) { "$key must be >= 0" } }?.toULong() ?: default

class Orch8ExpoModule : Module() {
    private var engine: MobileEngine? = null

    @Volatile private var handlerTimeoutMs: Long = 30_000
    internal val pendingHandlers = PendingHandlerCalls()

    /** Outstanding token refreshes (`tokenRequest` events awaiting `resolveToken`). */
    internal val pendingTokens = PendingHandlerCalls()

    override fun definition() = ModuleDefinition {
        Name("Orch8ExpoModule")

        Events("onEngineEvent")

        // Whether the runtime node / worker functions below exist in this build
        // (src/runtimeNode vs src/runtimeNodeUnavailable, chosen by build.gradle).
        // Likewise for delegation (src/delegation vs src/delegationUnavailable).
        Constants(
            "runtimeNodeAvailable" to RUNTIME_NODE_AVAILABLE,
            "delegationAvailable" to DELEGATION_AVAILABLE,
        )

        Function("createEngine") { dbPath: String, config: Map<String, Any?> ->
            val cfg = MobileEngineConfig(
                tickIntervalMs = config.ulong("tickIntervalMs", 100uL),
                maxConcurrentSteps = config.uint("maxConcurrentSteps", 4u),
                maxStepsPerInstance = config.uint("maxStepsPerInstance", 1000u),
                maxConcurrentInstances = config.uint("maxConcurrentInstances", 10u),
                maxTickDurationMs = config.ulong("maxTickDurationMs", 5000uL),
                maxInstanceLifetimeSecs = config.ulong("maxInstanceLifetimeSecs", 86400uL),
                maxStoredSequences = config.uint("maxStoredSequences", 50u),
                maxSequenceSizeBytes = config.ulong("maxSequenceSizeBytes", 1048576uL),
                handlerTimeoutMs = config.ulong("handlerTimeoutMs", 30000uL),
                operationTimeoutMs = config.ulong("operationTimeoutMs", 10000uL),
                telemetryEnabled = config["telemetryEnabled"] as? Boolean ?: true,
                telemetryUrl = config["telemetryUrl"] as? String ?: "",
                environment = config["environment"] as? String ?: "production",
                rootPublicKey = config["rootPublicKey"] as? String ?: "",
                sdkVersion = ORCH8_EXPO_SDK_VERSION,
                memoryBudgetBytes = config.ulong("memoryBudgetBytes", 0uL),
                sequencesUrl = config["sequencesUrl"] as? String ?: "",
                syncUrl = config["syncUrl"] as? String ?: "",
                deviceId = config["deviceId"] as? String ?: "",
                syncApiKey = config["syncApiKey"] as? String ?: "",
            )
            engine = MobileEngine(dbPath, cfg)
            handlerTimeoutMs = cfg.handlerTimeoutMs.toLong()
        }

        Function("destroyEngine") {
            engine?.pause()
            engine = null
            pendingHandlers.failAll("engine destroyed")
            pendingTokens.failAll("engine destroyed")
            Unit
        }

        // Awaited handler: blocks the engine thread until JS calls
        // resolveHandler (or handlerTimeoutMs elapses). Works with any engine.
        Function("registerAsyncHandler") { name: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.registerHandler(name, ExpoAsyncStepHandler(this@Orch8ExpoModule, name, handlerTimeoutMs))
        }

        Function("resolveHandler") { requestId: String, output: String?, error: String?, permanent: Boolean ->
            pendingHandlers.resolve(requestId, output, error, permanent)
        }

        // Answer to a `tokenRequest` event from ExpoTokenProvider.
        Function("resolveToken") { requestId: String, token: String?, error: String? ->
            pendingTokens.resolve(requestId, token, error, false)
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
                "instancesAdvanced" to result.instancesAdvanced.toInt(),
                "stepsExecuted" to result.stepsExecuted.toInt(),
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
                "sourceEpoch" to result.sourceEpoch.toLong(),
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
            val result = eng.sync(manifestUrl, null)
            mapOf(
                "sequencesUpdated" to (result.added + result.updated).toInt(),
                "sequencesRemoved" to result.removed.toInt(),
                "added" to result.added.toInt(),
                "updated" to result.updated.toInt(),
                "removed" to result.removed.toInt(),
                "skipped" to result.skipped.toInt(),
                "signatureFailures" to result.signatureFailures.toInt(),
            )
        }

        Function("setDeviceContext") { deviceId: String, osName: String, osVersion: String, appVersion: String ->
            val eng = engine ?: throw EngineNotInitialized()
            eng.setDeviceContext(
                DeviceContext(
                    deviceId = deviceId,
                    osName = osName,
                    osVersion = osVersion,
                    appVersion = appVersion,
                    sdkVersion = ORCH8_EXPO_SDK_VERSION,
                ),
            )
        }

        AsyncFunction("flushTelemetry") { endpoint: String ->
            val eng = engine ?: throw EngineNotInitialized()
            val result = eng.flushTelemetry(endpoint)
            mapOf(
                "eventsFlushed" to result.sent.toLong(),
                "dropped" to result.dropped.toLong(),
            )
        }

        runtimeNodeDefinitions { engine ?: throw EngineNotInitialized() }
        tokenProviderDefinitions(this@Orch8ExpoModule) { engine ?: throw EngineNotInitialized() }
        delegationDefinitions { engine ?: throw EngineNotInitialized() }
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
    override fun execute(stepName: String, input: String): String {
        module.sendEvent("onEngineEvent", mapOf(
            "type" to "handlerInvoked",
            "stepName" to stepName,
            // Deprecated: 0.7.0 sent the step name under this key.
            "instanceId" to stepName,
            "handlerName" to handlerName,
            "params" to input,
        ))
        return "{}"
    }
}

/** Outstanding native-to-JS handler calls, keyed by request id. */
internal class PendingHandlerCalls {
    class Outcome(val output: String?, val error: String?, val permanent: Boolean)

    private class Slot {
        val latch = CountDownLatch(1)

        @Volatile var outcome: Outcome? = null
    }

    private val slots = ConcurrentHashMap<String, Slot>()

    fun open(id: String) {
        slots[id] = Slot()
    }

    fun await(id: String, timeoutMs: Long): Outcome? {
        val slot = slots[id] ?: return null
        val done = slot.latch.await(timeoutMs, TimeUnit.MILLISECONDS)
        slots.remove(id)
        return if (done) slot.outcome else null
    }

    fun resolve(id: String, output: String?, error: String?, permanent: Boolean) {
        val slot = slots[id] ?: return
        synchronized(slot) {
            if (slot.outcome != null) return
            slot.outcome = Outcome(output, error, permanent)
        }
        slot.latch.countDown()
    }

    fun failAll(message: String) {
        for (id in slots.keys.toList()) resolve(id, null, message, false)
    }
}

// Emits `handlerRequest` and blocks the engine thread until JS answers with
// `resolveHandler` or handlerTimeoutMs elapses (retryable failure).
private class ExpoAsyncStepHandler(
    private val module: Orch8ExpoModule,
    private val handlerName: String,
    private val timeoutMs: Long,
) : StepHandler {
    override fun execute(stepName: String, input: String): String {
        val requestId = UUID.randomUUID().toString()
        module.pendingHandlers.open(requestId)
        module.sendEvent("onEngineEvent", mapOf(
            "type" to "handlerRequest",
            "requestId" to requestId,
            "stepName" to stepName,
            "handlerName" to handlerName,
            "params" to input,
        ))
        val outcome = module.pendingHandlers.await(requestId, timeoutMs)
            ?: throw HandlerException.Retryable("JS handler '$handlerName' timed out after $timeoutMs ms")
        outcome.error?.let { message ->
            throw if (outcome.permanent) HandlerException.Permanent(message) else HandlerException.Retryable(message)
        }
        return outcome.output ?: "{}"
    }
}

private class EngineNotInitialized : CodedException(
    code = "ERR_ENGINE_NOT_INITIALIZED",
    message = "Native engine not initialized. Call createEngine() first.",
    cause = null,
)
