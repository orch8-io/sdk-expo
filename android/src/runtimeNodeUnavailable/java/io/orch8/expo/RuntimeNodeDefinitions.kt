package io.orch8.expo

import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.orch8.mobile.MobileEngine

// Compiled when package.json `orch8NativeVersion` is older than
// `orch8RuntimeNodeMinVersion` (the published 0.7.1 AAR has no runtime node
// API). The JS layer reads `runtimeNodeAvailable` and reports a clear error.

internal const val RUNTIME_NODE_AVAILABLE = false

@Suppress("UNUSED_PARAMETER", "UnusedReceiverParameter")
internal fun ModuleDefinitionBuilder.runtimeNodeDefinitions(engine: () -> MobileEngine) = Unit
