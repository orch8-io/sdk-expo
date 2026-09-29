package io.orch8.expo

import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.orch8.mobile.MobileEngine

// The published 0.7.1 AAR has no MobileEngine.setTokenProvider; the JS layer
// reads `runtimeNodeAvailable` and reports the required engine version.

@Suppress("UNUSED_PARAMETER", "UnusedReceiverParameter")
internal fun ModuleDefinitionBuilder.tokenProviderDefinitions(
    module: Orch8ExpoModule,
    engine: () -> MobileEngine,
) = Unit
