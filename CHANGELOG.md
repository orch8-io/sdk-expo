# Changelog

## Unreleased

### Added

- `NativeEngine.registerAsyncHandler(name, handler)`: the native engine thread
  waits for the JS handler's result (up to `handlerTimeoutMs`) instead of
  completing the step with `{}`. `PermanentHandlerError` fails without retry;
  the handler context carries `task` (the parsed `__orch8` member, including
  `effectId`). Works with engine 0.7.1.
- Runtime node / worker API: `registerNode`, `updateNodeStatus`,
  `unregisterNode`, `nodeRuntimeId`, `startWorker`, `stopWorker`,
  `runWorkerWindow`, `workerStats`, `onPushWake`, `enableBuiltin`, with
  TypeScript types. It needs an engine newer than 0.7.1, so it is compiled only
  when `orch8NativeVersion` >= `orch8RuntimeNodeMinVersion` (0.7.2): the
  podspec sets the `ORCH8_RUNTIME_NODE` Swift condition and the Gradle build
  picks `src/runtimeNode` over `src/runtimeNodeUnavailable`. Against 0.7.1,
  `runtimeNodeAvailable` is `false` and the calls reject with a clear error.

## 0.7.1

Aligned with Orch8 engine 0.7.1. This release fixes native builds; 0.7.0 could
not be built on either platform.

### Fixed

- iOS: the package now ships `ios/Orch8Expo.podspec`, which depends on the
  `Orch8Mobile` CocoaPod pinned exactly to the engine version
  (`orch8NativeVersion` in `package.json`). In 0.7.0 there was no podspec, so
  `import Orch8Mobile` could not resolve after `npx expo prebuild`.
- Android: the module depends on `io.orch8:orch8-mobile:<engine version>` from
  Orch8's Maven repository instead of `libs/orch8-mobile-release.aar`, a file
  that was never included in the npm package.
- The npm tarball now includes every native file (podspec, Gradle build,
  Kotlin and Swift sources, config plugin) and excludes native build output.
- Native modules now compile against the Orch8Mobile 0.7.1 bindings (0.7.0
  was written against an older surface and could not compile on either
  platform once the engine resolved):
  - Step handlers implement `execute(stepName:input:)`. The `handlerInvoked`
    event now carries `stepName`; `instanceId` is kept as a deprecated alias
    that holds the same step name (it never held an instance ID).
  - `sync()` passes no token provider and returns `added`, `updated`,
    `removed`, `skipped` and `signatureFailures` alongside the existing
    `sequencesUpdated` (`added + updated`) and `sequencesRemoved`.
  - `setDeviceContext()` builds the engine's `DeviceContext` record.
  - `flushTelemetry()` resolves to `{ eventsFlushed, dropped }`. The former
    `bytesSent` field is removed; the engine does not report it.
  - Android converts config values to the unsigned types UniFFI expects and
    returns plain integers to JS.
  - The engine receives `sdkVersion` `expo-0.7.1` instead of `expo-0.3.0`.
- Android: the module compiles with `-Xskip-metadata-version-check`. The
  `io.orch8:orch8-mobile` AAR is built with Kotlin 2.1, and Expo SDK 52 apps
  compile with Kotlin 1.9, which otherwise rejects its metadata.

### Added

- Expo config plugin (`"plugins": ["@orch8.io/expo"]`). On `expo prebuild` it
  adds `https://raw.githubusercontent.com/orch8-io/maven/main` to
  `android.extraMavenRepos` (merged with existing repositories) and raises the
  iOS deployment target to 16.0 when it is lower.
- `native-build` CI workflow: packs the SDK, installs the tarball into a sample
  Expo app, runs `expo prebuild`, `pod install` and a simulator build on macOS,
  and `./gradlew :app:assembleDebug` on Linux. It fails if the native engine
  does not resolve. `publish.yml` now runs it before publishing.

### Changed

- Minimum iOS version is 16.0 (the minimum of `Orch8Mobile.xcframework`).
- Android build script is `android/build.gradle` using the Expo module core
  Gradle helpers, replacing the standalone `build.gradle.kts`.

## 0.7.0

- Align the Expo SDK version with engine 0.7.0.
