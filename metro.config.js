const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

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
