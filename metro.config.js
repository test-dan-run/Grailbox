const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as .sql strings.
config.resolver.sourceExts.push('sql');

// The scanner's on-device embedding model ships as a bundled asset.
config.resolver.assetExts.push('tflite');

// Web preview only (not a shipping target): expo-sqlite's web build needs wasm
// and SharedArrayBuffer, which needs these headers.
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
