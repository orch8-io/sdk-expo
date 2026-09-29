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

## Awaited handlers

`NativeEngine.registerHandler(name)` is fire-and-forget: the native side emits
`handlerInvoked` and completes the step with `{}` at once.
`registerAsyncHandler(name, handler)` instead makes the engine thread wait for
your handler's result (up to `handlerTimeoutMs`) and records it as the step
output. Throw `PermanentHandlerError` to fail without retry. This works with
the 0.7.1 engine.

```typescript
engine.registerAsyncHandler("scan_document", async (params, ctx) => {
  const result = await scan(JSON.parse(params), { idempotencyKey: ctx.task?.effectId });
  return { pages: result.pages };
});
```

## Runtime node (Orch8 engine after 0.7.1)

The device can join the distributed-execution mesh as a runtime of kind
`mobile` and run server-placed steps with its awaited handlers. The published
`Orch8Mobile` 0.7.1 pod and `orch8-mobile` 0.7.1 AAR do not contain this API,
so it is compiled only when `orch8NativeVersion` is at least
`orch8RuntimeNodeMinVersion` (0.7.2) in `package.json`: the podspec defines the
`ORCH8_RUNTIME_NODE` Swift condition and `android/build.gradle` adds
`src/runtimeNode` instead of `src/runtimeNodeUnavailable`. Builds against 0.7.1
keep working; `engine.runtimeNodeAvailable` is `false` and the calls reject
with a message naming the required engine version.

```typescript
if (engine.runtimeNodeAvailable) {
  engine.registerAsyncHandler("scan_document", scanHandler);
  await engine.registerNode({ hardware: ["camera"], pushToken });
  await engine.startWorker({ maxConcurrentTasks: 1 });
  // Silent push (id-only wake hint):
  await engine.onPushWake(notification.request.content.data);
  // Expo BackgroundTask window:
  await engine.runWorkerWindow(25_000);
}
```

Also: `nodeRuntimeId()`, `updateNodeStatus(connectivity, batteryPercent)`,
`workerStats()`, `stopWorker()`, `unregisterNode()`, and
`enableBuiltin("http_request")`. Remote tasks carry `__orch8` in their params;
`ctx.task.effectId` is the server's idempotency key for the step's effect.

## Delegating from a phone-local workflow (Orch8 engine after 0.7.1)

A step of a workflow running on the device's own engine whose `$runtime`
places it on another runtime (`runtime_id` of another node, or
`runtime_kinds` without `mobile`) is handed to that runtime through the server
mailbox; the local instance parks and resumes exactly once with the result,
across disconnects and app kills. Handler `orch8.delegation` delegates the
server-side sequence `params.sequence_id` with `params.input`; any other
handler delegates just that step. It needs `registerNode` and a node
credential allowed to call the continuity API.

Like the runtime node API, it is compiled only when `orch8NativeVersion` is at
least `orch8DelegationMinVersion` (0.7.2): the podspec defines
`ORCH8_DELEGATION` and `android/build.gradle` adds `src/delegation` instead of
`src/delegationUnavailable`. Against 0.7.1, `engine.delegationAvailable` is
`false` and the calls reject with the required engine version.

```typescript
if (engine.delegationAvailable) {
  await engine.registerNode();
  await engine.startDelegation({ tenantId: "acme" }); // on every launch

  // Explicit delegation from app code (no local step is parked):
  const delegationId = await engine.delegate({
    instanceId,
    destinationRuntimeId: desktopRuntimeId,
    subSequenceId: classifySequenceId,
    input: { photo: { id: photoId } },
  });
  const status = await engine.delegationStatus(delegationId);
  // status.state: "preparing" | "delegated" | "completed" | "failed" | "abandoned"
}
```

Also: `listDelegations()`, `delegationStats()` (`running`, `delegated`,
`completed`, `failed`, `abandoned`, `resumed`) and `stopDelegation()`.
`onPushWake` advances pending delegations immediately.

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
