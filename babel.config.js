module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      // `jsxImportSource` routes every JSX element through NativeWind's runtime,
      // which is what teaches core React Native components the `className` prop.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
