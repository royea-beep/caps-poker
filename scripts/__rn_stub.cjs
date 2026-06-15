// Minimal react-native stub for Node-only execution of utils/responsive.ts.
// responsive.ts only touches: Platform.OS (string) and PixelRatio.get() (number).
// We force Platform.OS = 'web' so the module skips the Dimensions.get() require
// and falls back to 393×852 — exactly what we want; all real screen widths are
// passed explicitly via the screenW / screenH override params.
module.exports = {
  Platform: { OS: 'web' },
  PixelRatio: { get: () => 2 },
};
