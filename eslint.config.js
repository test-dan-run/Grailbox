const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'drizzle/*', 'coverage/*', 'video/*'],
  },
  {
    // The demo images aren't in git, so a fresh clone (and CI) doesn't have them. Builds
    // without EXPO_PUBLIC_DEMO=1 never load the file (see metro.config.js).
    files: ['src/features/demo/assets.ts'],
    rules: { 'import/no-unresolved': 'off' },
  },
]);
