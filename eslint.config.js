const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: ['dist/**', '.expo/**', 'node_modules/**', 'packages/*/dist/**', 'packages/*/coverage/**', 'temp/**'],
  },
  ...expoConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // SDK 56 enables stricter React linting; keep the upgrade branch focused on dependency/runtime compatibility.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
