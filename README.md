# @orch8/expo

Expo and React Native SDK for the Orch8 REST API and on-device engine.

Version 0.7 supports the Orch8 0.7 sequence and resumable-worker response
contract. It also exposes portable continuity capsule import and activation on
iOS and Android. Capsule export deliberately remains a native-host concern
because the engine requires a non-exportable Secure Enclave or KeyStore signer.

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
