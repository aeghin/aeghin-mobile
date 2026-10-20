// The runtime version is this project's fingerprint, and app.json's version is
// part of it by default, so a version bump alone used to cut installed builds
// off from `eas update`. Native changes still move it. Listing skips replaces
// the default, which is why the second entry is here.
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: ["ExpoConfigVersions", "PackageJsonAndroidAndIosScriptsIfNotContainRun"],
};

module.exports = config;
