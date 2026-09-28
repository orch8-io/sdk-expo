# Native build check

Minimal Expo app used by `.github/workflows/native-build.yml`. CI packs
`@orch8.io/expo` with `npm pack`, installs the tarball here, runs
`npx expo prebuild`, then:

- iOS: `pod install` (must resolve the `Orch8Mobile` pod) and a simulator build.
- Android: `./gradlew :app:assembleDebug` (must resolve `io.orch8:orch8-mobile`
  from Orch8's Maven repository, added by the config plugin).

Run it locally the same way:

```bash
npm run build && npm pack          # in the repository root
cd example
npm install --no-save ../orch8.io-expo-*.tgz
npm install
npx expo prebuild --clean --no-install
(cd ios && pod install)
(cd android && ./gradlew :app:assembleDebug)
```
