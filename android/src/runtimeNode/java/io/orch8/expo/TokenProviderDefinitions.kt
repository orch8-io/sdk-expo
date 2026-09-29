package io.orch8.expo

import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.orch8.mobile.MobileEngine
import io.orch8.mobile.MobileException
import io.orch8.mobile.TokenProvider
import java.util.UUID

// Compiled with the runtime node API (MobileEngine.setTokenProvider is new in
// the same engine release); see android/build.gradle.

internal fun ModuleDefinitionBuilder.tokenProviderDefinitions(
    module: Orch8ExpoModule,
    engine: () -> MobileEngine,
) {
    // Device-session credential for node, worker, delegation and sync calls;
    // JS already awaited the first token.
    AsyncFunction("setTokenProvider") { initialToken: String ->
        engine().setTokenProvider(ExpoTokenProvider(module, initialToken))
    }
}

/**
 * UniFFI `TokenProvider` backed by the JS `setTokenProvider` callback.
 * `currentToken` returns the last token JS delivered; `refreshToken` runs on an
 * engine blocking thread (after a 401), emits `tokenRequest` and waits for
 * `resolveToken`, bounded by [TIMEOUT_MS].
 */
internal class ExpoTokenProvider(
    private val module: Orch8ExpoModule,
    initialToken: String,
) : TokenProvider {
    @Volatile private var token: String = initialToken

    override fun currentToken(): String = token

    override fun refreshToken(): String {
        val requestId = UUID.randomUUID().toString()
        module.pendingTokens.open(requestId)
        module.sendEvent("onEngineEvent", mapOf("type" to "tokenRequest", "requestId" to requestId))
        val outcome = module.pendingTokens.await(requestId, TIMEOUT_MS)
            ?: throw MobileException.Engine("token provider timed out after $TIMEOUT_MS ms")
        outcome.error?.let { throw MobileException.Engine("token provider failed: $it") }
        val fresh = outcome.output
        if (fresh.isNullOrEmpty()) throw MobileException.Engine("token provider returned an empty token")
        token = fresh
        return fresh
    }

    companion object {
        const val TIMEOUT_MS = 30_000L
    }
}
