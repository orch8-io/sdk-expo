package io.orch8.expo

import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.orch8.mobile.DelegateRequest
import io.orch8.mobile.DelegationOptions
import io.orch8.mobile.DelegationStatus
import io.orch8.mobile.MobileEngine

// Compiled when package.json `orch8NativeVersion` >= `orch8DelegationMinVersion`
// (see android/build.gradle). The 0.7.1 AAR has none of these calls; that
// build uses src/delegationUnavailable instead.

internal const val DELEGATION_AVAILABLE = true

private fun DelegationStatus.toMap(): Map<String, Any?> = mapOf(
    "delegationId" to delegationId,
    "state" to state,
    "localInstanceId" to localInstanceId,
    "blockId" to blockId,
    "destinationRuntimeId" to destinationRuntimeId,
    "outputJson" to outputJson,
    "error" to error,
)

internal fun ModuleDefinitionBuilder.delegationDefinitions(engine: () -> MobileEngine) {
    AsyncFunction("startDelegation") { options: Map<String, Any?> ->
        engine().startDelegation(
            DelegationOptions(
                tenantId = options["tenantId"] as? String ?: "",
                pollIntervalMs = ((options["pollIntervalMs"] as? Number)?.toLong() ?: 2_000L).coerceAtLeast(1L).toULong(),
                ttlSecs = ((options["ttlSecs"] as? Number)?.toLong() ?: 600L).coerceIn(1L, 86_400L).toUInt(),
            ),
        )
    }

    AsyncFunction("stopDelegation") {
        engine().stopDelegation()
    }

    AsyncFunction("delegate") { request: Map<String, Any?> ->
        engine().delegate(
            DelegateRequest(
                instanceId = request["instanceId"] as? String ?: "",
                destinationRuntimeId = request["destinationRuntimeId"] as? String ?: "",
                subSequenceId = request["subSequenceId"] as? String ?: "",
                inputJson = request["inputJson"] as? String ?: "{}",
            ),
        )
    }

    AsyncFunction("delegationStatus") { delegationId: String ->
        engine().delegationStatus(delegationId).toMap()
    }

    AsyncFunction("listDelegations") {
        engine().listDelegations().map { it.toMap() }
    }

    AsyncFunction("delegationStats") {
        val s = engine().delegationStats()
        mapOf(
            "running" to s.running,
            "delegated" to s.delegated.toLong(),
            "completed" to s.completed.toLong(),
            "failed" to s.failed.toLong(),
            "abandoned" to s.abandoned.toLong(),
            "resumed" to s.resumed.toLong(),
        )
    }
}
