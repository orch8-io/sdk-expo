import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Guards for the native distribution contract: @orch8.io/expo 0.7.0 shipped
// without a podspec and with an Android dependency on an AAR file that was not
// in the tarball, so neither platform could resolve the engine.

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const pkg = JSON.parse(read("package.json")) as {
  version: string;
  orch8NativeVersion: string;
  files: string[];
  exports: Record<string, unknown>;
};

const plugin = require("../../plugin/withOrch8.js") as {
  ORCH8_MAVEN_URL: string;
  MIN_IOS_DEPLOYMENT_TARGET: string;
  mergeExtraMavenRepos: (existing?: string) => string;
  raiseDeploymentTarget: (current?: string) => string;
};

describe("native distribution", () => {
  it("pins a released engine version", () => {
    expect(pkg.orch8NativeVersion).toMatch(/^\d+\.\d+\.\d+$/);
    // The SDK family is versioned with the engine; a wrapper-only patch may
    // move ahead of the native pin, but never to a different minor line.
    const [major, minor] = pkg.version.split(".");
    expect(pkg.orch8NativeVersion.startsWith(`${major}.${minor}.`)).toBe(true);
  });

  it("ships a podspec that depends on the Orch8Mobile pod", () => {
    const podspec = read("ios/Orch8Expo.podspec");
    expect(podspec).toContain("package.fetch('orch8NativeVersion')");
    expect(podspec).toContain("s.dependency 'Orch8Mobile', orch8_native_version");
    expect(podspec).toContain("s.dependency 'ExpoModulesCore'");
    expect(podspec).toContain(":ios => '16.0'");
    const moduleConfig = JSON.parse(read("expo-module.config.json"));
    expect(moduleConfig.ios.podspecPath).toBe("./ios/Orch8Expo.podspec");
  });

  it("resolves the Android engine from Orch8's Maven repository", () => {
    const gradle = read("android/build.gradle");
    expect(gradle).toContain('implementation "io.orch8:orch8-mobile:${orch8NativeVersion}"');
    expect(gradle).toContain(plugin.ORCH8_MAVEN_URL);
    expect(gradle).not.toMatch(/files\(|\.aar/);
  });

  it("reports the package version to the engine from both native modules", () => {
    expect(read("ios/Orch8ExpoModule.swift")).toContain(`let orch8ExpoSdkVersion = "expo-${pkg.version}"`);
    expect(read("android/src/main/java/io/orch8/expo/Orch8ExpoModule.kt")).toContain(
      `ORCH8_EXPO_SDK_VERSION = "expo-${pkg.version}"`,
    );
  });

  it("publishes every native file and the config plugin", () => {
    for (const entry of ["ios", "android/build.gradle", "android/src", "plugin", "app.plugin.js", "expo-module.config.json"]) {
      expect(pkg.files).toContain(entry);
    }
    expect(pkg.exports["./app.plugin.js"]).toBe("./app.plugin.js");
    expect(pkg.exports["./package.json"]).toBe("./package.json");
  });
});

describe("config plugin", () => {
  it("adds Orch8's Maven repository once and keeps existing repositories", () => {
    const first = plugin.mergeExtraMavenRepos(undefined);
    expect(JSON.parse(first)).toEqual([{ url: plugin.ORCH8_MAVEN_URL }]);
    expect(plugin.mergeExtraMavenRepos(first)).toBe(first);

    const existing = JSON.stringify([
      { url: "https://example.com/maven", credentials: { username: "u", password: "p" } },
    ]);
    const merged = JSON.parse(plugin.mergeExtraMavenRepos(existing));
    expect(merged).toHaveLength(2);
    expect(merged[0].credentials.username).toBe("u");
    expect(merged[1]).toEqual({ url: plugin.ORCH8_MAVEN_URL });

    // Legacy string entries (older expo-build-properties) and trailing slashes count as present.
    const legacy = JSON.stringify([`${plugin.ORCH8_MAVEN_URL}/`]);
    expect(plugin.mergeExtraMavenRepos(legacy)).toBe(legacy);
  });

  it("rejects a malformed extraMavenRepos value instead of overwriting it", () => {
    expect(() => plugin.mergeExtraMavenRepos("not json")).toThrow(/not valid JSON/);
    expect(() => plugin.mergeExtraMavenRepos('{"url":"x"}')).toThrow(/JSON array/);
  });

  it("raises the iOS deployment target to Orch8Mobile's minimum without lowering it", () => {
    expect(plugin.MIN_IOS_DEPLOYMENT_TARGET).toBe("16.0");
    expect(plugin.raiseDeploymentTarget(undefined)).toBe("16.0");
    expect(plugin.raiseDeploymentTarget("15.1")).toBe("16.0");
    expect(plugin.raiseDeploymentTarget('"15.1"')).toBe("16.0");
    expect(plugin.raiseDeploymentTarget("16.0")).toBe("16.0");
    expect(plugin.raiseDeploymentTarget("17.2")).toBe("17.2");
  });
});
