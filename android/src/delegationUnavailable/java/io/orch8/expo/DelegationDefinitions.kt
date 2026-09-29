package io.orch8.expo

import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.orch8.mobile.MobileEngine

// Compiled when package.json `orch8NativeVersion` is older than
// `orch8DelegationMinVersion` (the published 0.7.1 AAR has no delegation
// API). The JS layer reads `delegationAvailable` and reports a clear error.

internal const val DELEGATION_AVAILABLE = false

@Suppress("UNUSED_PARAMETER", "UnusedReceiverParameter")
internal fun ModuleDefinitionBuilder.delegationDefinitions(engine: () -> MobileEngine) = Unit
