package io.orch8.expo

import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.orch8.mobile.MobileEngine
import io.orch8.mobile.NodeCapabilities
import io.orch8.mobile.NodeConnectivity
import io.orch8.mobile.WorkerOptions

// Compiled when package.json `orch8NativeVersion` >= `orch8RuntimeNodeMinVersion`
// (see android/build.gradle). The 0.7.1 AAR has none of these calls; that
// build uses src/runtimeNodeUnavailable instead.

internal const val RUNTIME_NODE_AVAILABLE = true

private fun connectivity(value: String?): NodeConnectivity? = when (value) {
    "offline" -> NodeConnectivity.OFFLINE
    "metered" -> NodeConnectivity.METERED
    "wifi" -> NodeConnectivity.WIFI
    "ethernet" -> NodeConnectivity.ETHERNET
    else -> null
}

private fun Any?.strings(): List<String> = (this as? List<*>)?.filterIsInstance<String>() ?: emptyList()

private fun Any?.battery(): UByte? = (this as? Number)?.toInt()?.coerceIn(0, 100)?.toUByte()

internal fun ModuleDefinitionBuilder.runtimeNodeDefinitions(engine: () -> MobileEngine) {
    AsyncFunction("nodeRuntimeId") {
        engine().nodeRuntimeId()
    }

    AsyncFunction("registerNode") { caps: Map<String, Any?> ->
        val r = engine().registerNode(
            NodeCapabilities(
                handlers = caps["handlers"].strings(),
                regions = caps["regions"].strings(),
                hardware = caps["hardware"].strings(),
                plugins = caps["plugins"].strings(),
                credentials = caps["credentials"].strings(),
                offlineCapable = caps["offlineCapable"] as? Boolean ?: true,
                connectivity = connectivity(caps["connectivity"] as? String),
                batteryPercent = caps["batteryPercent"].battery(),
                platform = caps["platform"] as? String ?: "android",
                pushToken = caps["pushToken"] as? String,
                appVersion = caps["appVersion"] as? String,
                apiBaseUrl = caps["apiBaseUrl"] as? String,
                capsuleSigningPublicKey = caps["capsuleSigningPublicKey"] as? String,
            ),
        )
        mapOf(
            "runtimeId" to r.runtimeId,
            "deviceId" to r.deviceId,
            "handlers" to r.handlers,
            "expiresAt" to r.expiresAt,
        )
    }

    AsyncFunction("updateNodeStatus") { connectivity: String?, batteryPercent: Int? ->
        engine().updateNodeStatus(connectivity(connectivity), batteryPercent.battery())
    }

    AsyncFunction("unregisterNode") {
        engine().unregisterNode()
    }

    AsyncFunction("startWorker") { options: Map<String, Any?> ->
        engine().startWorker(
            WorkerOptions(
                maxConcurrentTasks = ((options["maxConcurrentTasks"] as? Number)?.toLong() ?: 1L).coerceAtLeast(1L).toUInt(),
                idlePollIntervalMs = ((options["idlePollIntervalMs"] as? Number)?.toLong() ?: 15_000L).coerceAtLeast(1L).toULong(),
                version = options["version"] as? String,
            ),
        )
    }

    AsyncFunction("stopWorker") {
        engine().stopWorker()
    }

    AsyncFunction("runWorkerWindow") { timeBudgetMs: Long ->
        require(timeBudgetMs > 0) { "timeBudgetMs must be greater than zero" }
        val r = engine().runWorkerWindow(timeBudgetMs.toULong())
        mapOf(
            "claimed" to r.claimed.toLong(),
            "completed" to r.completed.toLong(),
            "failed" to r.failed.toLong(),
            "stillRunning" to r.stillRunning.toInt(),
            "budgetExhausted" to r.budgetExhausted,
        )
    }

    AsyncFunction("workerStats") {
        val s = engine().workerStats()
        mapOf(
            "running" to s.running,
            "inFlight" to s.inFlight.toInt(),
            "claimed" to s.claimed.toLong(),
            "completed" to s.completed.toLong(),
            "failed" to s.failed.toLong(),
            "released" to s.released.toLong(),
            "lost" to s.lost.toLong(),
        )
    }

    AsyncFunction("onPushWake") { envelopeJson: String ->
        engine().onPushWake(envelopeJson)
    }

    Function("enableBuiltin") { name: String ->
        engine().enableBuiltin(name)
    }
}
