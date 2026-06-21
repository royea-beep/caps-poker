const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// VAMOS-HOOKS-CRASH-FIX 2026-06-21 — keep_fnames / keep_classnames so React's
// componentStack names survive minification in release builds. Without these,
// crash_reports.component_stack shows mangled single-letter identifiers,
// useless for pinpointing which component violated hooks order. Applied at
// both the top-level minifierConfig and the nested mangle/compress blocks
// because uglify-es/terser look at different paths depending on version.
config.transformer = config.transformer || {};
const _prevMin = config.transformer.minifierConfig || {};
config.transformer.minifierConfig = {
  ..._prevMin,
  keep_fnames: true,
  keep_classnames: true,
  mangle: {
    ...(_prevMin.mangle || {}),
    keep_fnames: true,
    keep_classnames: true,
  },
  compress: {
    ...(_prevMin.compress || {}),
    keep_fnames: true,
    keep_classnames: true,
  },
};

// Stub native-only modules on web to prevent bundle crashes
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-tcp-socket') {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
