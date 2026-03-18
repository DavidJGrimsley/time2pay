const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: ['dist/**', '.expo/**', 'node_modules/**', 'packages/*/dist/**', 'packages/*/coverage/**', 'temp/**'],
  },
  ...expoConfig,
];
