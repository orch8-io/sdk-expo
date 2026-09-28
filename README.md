# @orch8.io/expo

Expo and React Native SDK for the Orch8 REST API and on-device engine.

Version 0.7 supports the Orch8 0.7 sequence and resumable-worker response
contract. It also exposes portable continuity capsule import and activation on
iOS and Android. Capsule export deliberately remains a native-host concern
because the engine requires a non-exportable Secure Enclave or KeyStore signer.

## Install

```bash
npx expo install @orch8.io/expo
```

Add the config plugin to `app.json` (or `app.config.js`), then prebuild:

```json
{ "expo": { "plugins": ["@orch8.io/expo"] } }
```

```bash
npx expo prebuild        # or: eas build --profile development
```

The on-device engine is not bundled in this package. It is resolved at build
time, pinned to the engine version in `package.json` (`orch8NativeVersion`):

| Platform | Dependency | Source |
|---|---|---|
| iOS 16.0+ | `Orch8Mobile` CocoaPod | CocoaPods trunk |
| Android API 24+ | `io.orch8:orch8-mobile` AAR | `https://raw.githubusercontent.com/orch8-io/maven/main` |

The config plugin adds Orch8's Maven repository to the Android project
(`android.extraMavenRepos` in `android/gradle.properties`) and raises the iOS
deployment target to 16.0 if it is lower. The native module requires a
development build or a prebuilt app; it does not run in Expo Go.

New or experimental REST routes can be called with the authenticated low-level
client:

```typescript
const client = new Orch8Client({ baseUrl, tenantId });
const engineInfo = await client.request("GET", "/info");
```

For OS-scheduled work, call `NativeEngine.runUntilIdle(maxTicks,
timeBudgetMs)` from the task registered by your app with Expo BackgroundTask,
iOS `BGTaskScheduler`, or Android `WorkManager`. The method drains a bounded
window and returns `budgetExhausted` when work remains. It does not bypass
platform scheduling or guarantee an exact execution time.

The request path must begin with one `/`; absolute and protocol-relative URLs
are rejected so configured credentials cannot be redirected to another host.

Safe requests retry transient `408`, `425`, `429`, and `5xx` responses up to
three times, with a 30-second timeout per attempt. Use `getHeaders` for tokens
that may refresh while the app is running, and `retry: false` to opt out.

```typescript
const client = new Orch8Client({
  baseUrl,
  getHeaders: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  retry: { maxAttempts: 3, baseDelayMs: 250 },
});
```

The client also exposes cursor-preserving pages, attempt observations, and
resumable SSE envelopes:

```typescript
const page = await client.requestPage<TaskInstance>("/instances", { limit: "50" });
for await (const event of client.streamInstanceEvents(instanceId, {
  lastEventId: savedCursor,
})) {
  savedCursor = event.id;
  consume(event.data);
}
```

Dynamic resource IDs are encoded as individual URL path segments.
`ORCH8_ROUTES` and `ORCH8_API_VERSION` are generated from the engine OpenAPI
contract used by every Orch8 SDK.

## Development

```bash
npm install
npm run build
npm test
```

`example/` is a minimal Expo app used by the `native-build` workflow to prove
the packed tarball builds on iOS and Android. See `example/README.md`.
