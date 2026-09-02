const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// SDK 57 serializes `new Worker()` as a split chunk. If Metro lazy-bundling
// is left on, expo-sqlite's web worker never enters the graph and start
// fails with "Worker chunk not found for: .../expo-sqlite/web/worker.ts".
// Set this here so `npx expo start --web` and IDE start paths match `npm start`.
process.env.EXPO_NO_METRO_LAZY = '1';

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...new Set([...(config.resolver.assetExts ?? []), 'wasm'])];
config.resolver.blockList = [
  /(?:^|[\\/])__tests__(?:[\\/]|$)/,
  /\.(?:test|spec)\.[jt]sx?$/,
];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  polyfills: { rem: 14 },
});
