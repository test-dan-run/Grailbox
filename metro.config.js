const path = require('path');
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

// The store video project (video/) has its own node_modules and is not part of the app.
// Metro may test absolute or root-relative paths, so match both.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^(?:${escape(path.join(__dirname, 'video'))}|video)[\\\\/]`),
];

// Only the demo build (EXPO_PUBLIC_DEMO=1) gets the demo images, which aren't in git. Other builds
// get a stand-in module, so they build without the images and don't ship them.
if (process.env.EXPO_PUBLIC_DEMO !== '1') {
  const demoAssets = path.join(__dirname, 'src/features/demo/assets.ts');
  const stub = path.join(__dirname, 'src/features/demo/assets.stub.ts');
  const resolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const result = (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
    return result.type === 'sourceFile' && result.filePath === demoAssets ? { type: 'sourceFile', filePath: stub } : result;
  };
}

module.exports = config;
