// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// NativeWind compiles `globals.css` into the style registry the `className`
// prop reads from. Without this, every className silently resolves to nothing.
module.exports = withNativeWind(config, { input: "./src/globals.css" });
