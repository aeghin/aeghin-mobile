import structuredClone from "@ungap/structured-clone";
import { Platform } from "react-native";

/**
 * What the AI SDK's streaming client needs that Hermes does not ship: the
 * text encoder/decoder streams it parses server-sent chunks with, and
 * `structuredClone`. Installed once, before the first screen mounts — the
 * root layout imports this file for that side effect.
 */
if (Platform.OS !== "web") {
  const setupPolyfills = async () => {
    // @ts-expect-error — an internal React Native module with no type entry.
    const { polyfillGlobal } = await import("react-native/Libraries/Utilities/PolyfillFunctions");
    const { TextEncoderStream, TextDecoderStream } = await import(
      "@stardazed/streams-text-encoding"
    );

    if (!("structuredClone" in globalThis)) {
      polyfillGlobal("structuredClone", () => structuredClone);
    }
    polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
    polyfillGlobal("TextDecoderStream", () => TextDecoderStream);
  };

  setupPolyfills();
}
