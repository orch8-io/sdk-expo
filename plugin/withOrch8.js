// Expo config plugin for @orch8.io/expo.
//
// The native engine is not vendored in this package. It is resolved at build
// time from Orch8's public distribution channels:
//   - iOS:     the `Orch8Mobile` CocoaPod (iOS 16.0+), pinned by ios/Orch8Expo.podspec
//   - Android: io.orch8:orch8-mobile from https://raw.githubusercontent.com/orch8-io/maven/main
//
// `npx expo prebuild` therefore needs two project-level changes that a library
// cannot make on its own:
//   1. Android: the app's Gradle projects must see Orch8's Maven repository.
//      Expo autolinking reads `android.extraMavenRepos` (a JSON array) from
//      android/gradle.properties and adds each entry to allprojects.
//   2. iOS: the app and Podfile must target at least iOS 16.0, the minimum of
//      Orch8Mobile.xcframework. Lower targets are raised; higher ones are kept.
"use strict";

const {
  createRunOncePlugin,
  withGradleProperties,
  withPodfileProperties,
  withXcodeProject,
} = require("expo/config-plugins");

const pkg = require("../package.json");

const ORCH8_MAVEN_URL = "https://raw.githubusercontent.com/orch8-io/maven/main";
const EXTRA_MAVEN_REPOS_KEY = "android.extraMavenRepos";
const IOS_DEPLOYMENT_TARGET_KEY = "ios.deploymentTarget";
const MIN_IOS_DEPLOYMENT_TARGET = "16.0";

function repoUrl(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && typeof entry.url === "string") return entry.url;
  return undefined;
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, "");
}

/**
 * Returns the `android.extraMavenRepos` JSON value with Orch8's repository
 * appended, preserving any repositories (and credentials) already declared,
 * for example by expo-build-properties. Idempotent.
 */
function mergeExtraMavenRepos(existing, url = ORCH8_MAVEN_URL) {
  let repos = [];
  if (existing !== undefined && existing !== null && String(existing).trim() !== "") {
    let parsed;
    try {
      parsed = JSON.parse(existing);
    } catch (error) {
      throw new Error(
        `[@orch8.io/expo] ${EXTRA_MAVEN_REPOS_KEY} in android/gradle.properties is not valid JSON: ${error.message}`,
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`[@orch8.io/expo] ${EXTRA_MAVEN_REPOS_KEY} must be a JSON array.`);
    }
    repos = parsed;
  }
  const wanted = normalizeUrl(url);
  const present = repos.some((entry) => {
    const candidate = repoUrl(entry);
    return candidate !== undefined && normalizeUrl(candidate) === wanted;
  });
  // Autolinking (expo-modules-autolinking MavenRepo) reads `.url` from each
  // entry, so new entries are objects.
  return JSON.stringify(present ? repos : [...repos, { url }]);
}

function parseVersion(version) {
  return String(version)
    .replace(/^["']|["']$/g, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** True when deployment target `a` is lower than `b` ("15.1" < "16.0"). */
function isLowerVersion(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l < r;
  }
  return false;
}

/** Raises a deployment target to Orch8Mobile's minimum; never lowers it. */
function raiseDeploymentTarget(current, minimum = MIN_IOS_DEPLOYMENT_TARGET) {
  if (current === undefined || current === null || String(current).trim() === "") return minimum;
  return isLowerVersion(current, minimum) ? minimum : String(current).replace(/^["']|["']$/g, "");
}

const withOrch8Android = (config) =>
  withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const index = props.findIndex((item) => item.type === "property" && item.key === EXTRA_MAVEN_REPOS_KEY);
    const merged = mergeExtraMavenRepos(index >= 0 ? props[index].value : undefined);
    if (index >= 0) {
      props[index].value = merged;
    } else {
      props.push({ type: "property", key: EXTRA_MAVEN_REPOS_KEY, value: merged });
    }
    return cfg;
  });

const withOrch8IosPodfile = (config) =>
  withPodfileProperties(config, (cfg) => {
    cfg.modResults[IOS_DEPLOYMENT_TARGET_KEY] = raiseDeploymentTarget(cfg.modResults[IOS_DEPLOYMENT_TARGET_KEY]);
    return cfg;
  });

const withOrch8IosProject = (config) =>
  withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key] && configurations[key].buildSettings;
      if (!buildSettings || buildSettings.IPHONEOS_DEPLOYMENT_TARGET === undefined) continue;
      buildSettings.IPHONEOS_DEPLOYMENT_TARGET = raiseDeploymentTarget(buildSettings.IPHONEOS_DEPLOYMENT_TARGET);
    }
    return cfg;
  });

const withOrch8 = (config) => withOrch8IosProject(withOrch8IosPodfile(withOrch8Android(config)));

module.exports = createRunOncePlugin(withOrch8, pkg.name, pkg.version);
module.exports.ORCH8_MAVEN_URL = ORCH8_MAVEN_URL;
module.exports.MIN_IOS_DEPLOYMENT_TARGET = MIN_IOS_DEPLOYMENT_TARGET;
module.exports.mergeExtraMavenRepos = mergeExtraMavenRepos;
module.exports.raiseDeploymentTarget = raiseDeploymentTarget;
