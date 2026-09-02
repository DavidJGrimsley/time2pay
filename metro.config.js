const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const { patchMetroSqliteWorkerSerializer } = require('./scripts/patch-metro-sqlite-worker.cjs');

// expo-sqlite's web worker needs Metro lazy/bundle-splitting. EXPO_NO_METRO_LAZY
// makes start succeed, then throws "Bundle splitting is required for Web Worker imports".
// Soften the export-only serializer assert so dev can load worker.bundle instead.
patchMetroSqliteWorkerSerializer();

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
