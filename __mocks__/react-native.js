// Mock for react-native in Jest (Node environment)
// Provides just enough surface for utils/responsive.ts and other utils to work.

const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios ?? obj.default,
};

const Dimensions = {
  get: (dim) => ({ width: 393, height: 852 }),
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

const PixelRatio = {
  get: () => 3,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size) => size * 3,
  roundToNearestPixel: (size) => Math.round(size),
};

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
  hairlineWidth: 1,
};

const Alert = {
  alert: jest.fn(),
};

const Vibration = {
  vibrate: jest.fn(),
  cancel: jest.fn(),
};

module.exports = {
  Platform,
  Dimensions,
  PixelRatio,
  StyleSheet,
  Alert,
  Vibration,
};
