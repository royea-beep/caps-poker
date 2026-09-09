/**
 * withResponsiveIcons — the Expo config plugin that delivers the responsive F lockup.
 *
 * Roye chose option B: the full lockup (♠♥♦♣ / CAPS / POKER) wherever POKER is legible, and the
 * compact lockup (♠♥♦♣ / CAPS) below that. Expo's own icon handling takes ONE master and derives
 * every size from it, which can express option 1 or option 2 from the handoff but not option B.
 * This plugin is the third route: it runs AFTER Expo has generated the native projects and
 * overwrites the derived icons with the correct variant at each size.
 *
 * ⚠️ THE SPLIT IS READ, NOT RETYPED. Every variant decision comes from `responsive` in
 * docs/f-icon/f-icon-build.json, which the build script wrote by comparing each size against the
 * threshold that docs/f-icon/threshold.mjs measured. Nothing in this file names a size and a
 * variant in the same breath. A number typed twice is eventually typed differently, and the whole
 * point of the sweep was to stop the boundary being somebody's preference.
 *
 * ⚠️ THIS PLUGIN COPIES FILES AND NEVER RESAMPLES ONE. Every pixel size it needs — the iOS icon
 * sizes, the Android mipmap sizes, and the adaptive layers at all five densities — is laid out and
 * measured by tools/icon/build-f-icon.mjs. If a required size is missing the plugin THROWS rather
 * than substituting a near-enough file, because a plausible-looking icon nobody rendered is
 * exactly the failure this project keeps paying for.
 *
 * WHAT LANDS WHERE
 *   iOS      Images.xcassets/AppIcon.appiconset — every iPhone slot plus the 1024 marketing icon.
 *            ios.supportsTablet is false, so no iPad slots are written and none are claimed.
 *            ⚠️ THE 1024 MARKETING ICON IS THE FULL LOCKUP. Route 1 was rejected precisely
 *            because it would have put compact on the store listing.
 *   Android  mipmap-DPI ic_launcher.png and ic_launcher_round.png at the five densities, each the
 *            variant the table gives for that pixel size; ic_launcher_foreground /
 *            _background / _monochrome from the pre-rendered adaptive set, which is COMPACT —
 *            a launcher draws only the central safe circle at roughly 48-108dp, which renders
 *            like a 73.8px tile, below the threshold.
 *
 * The Play Store 512 and the 64px favicon are not part of a native build; they live in
 * docs/f-icon/built/ (512 full, favicon compact) and are uploaded / served separately.
 */

const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, IOSConfig } = require('@expo/config-plugins');

const ROOT = path.resolve(__dirname, '..');
const BUILT = path.join(ROOT, 'docs/f-icon/built');
const FACTS = path.join(ROOT, 'docs/f-icon/f-icon-build.json');

/** The measured table. Read once, at config time, so a missing file fails loudly and early. */
function loadSplit() {
  if (!fs.existsSync(FACTS)) {
    throw new Error(`withResponsiveIcons: ${path.relative(ROOT, FACTS)} is missing — run ` +
      `tools/icon/build-f-icon.mjs first. The variant split is measured data, not a default.`);
  }
  const facts = JSON.parse(fs.readFileSync(FACTS, 'utf8'));
  if (!facts.responsive || !facts.threshold || !facts.threshold.px) {
    throw new Error('withResponsiveIcons: f-icon-build.json has no measured split — refusing to guess.');
  }
  return facts;
}

/**
 * The variant for a pixel size. Prefers the exact entry the build wrote; falls back to the same
 * comparison the build used, so a size the build did not enumerate is still decided by the
 * measurement rather than by a default.
 */
function variantFor(facts, px) {
  const exact = facts.responsive[String(px)];
  if (exact) return exact;
  return px >= facts.threshold.px ? 'full' : 'compact';
}

function sourceIcon(facts, px) {
  const variant = variantFor(facts, px);
  const file = path.join(BUILT, variant, `icon-${px}.png`);
  if (!fs.existsSync(file)) {
    throw new Error(`withResponsiveIcons: no ${variant} icon at ${px}px ` +
      `(${path.relative(ROOT, file)}). Add the size to tools/icon/build-f-icon.mjs and re-run it — ` +
      `this plugin will not resample another size into place.`);
  }
  return { file, variant };
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/**
 * The iPhone slots iOS asks for, as (point size, scale). The pixel size is derived, never written
 * down — that is the one number the variant decision keys off, so it must not be typeable.
 * ios.supportsTablet is false in app.json, so iPad idioms are deliberately absent.
 */
const IPHONE_SLOTS = [
  { size: 20, scales: [2, 3] },
  { size: 29, scales: [2, 3] },
  { size: 40, scales: [2, 3] },
  { size: 60, scales: [2, 3] },
];

function writeIosCatalogue(projectRoot, facts, log) {
  const iosProjectName = IOSConfig.XcodeUtils.getHackyProjectName(projectRoot, {});
  const setDir = path.join(projectRoot, 'ios', iosProjectName, 'Images.xcassets', 'AppIcon.appiconset');
  if (!fs.existsSync(path.dirname(setDir))) {
    throw new Error(`withResponsiveIcons: no Images.xcassets at ${path.relative(projectRoot, path.dirname(setDir))} — ` +
      `prebuild did not produce the iOS project this plugin is meant to patch.`);
  }
  // Start clean: Expo's own icon mod may have left a single-image catalogue behind.
  fs.rmSync(setDir, { recursive: true, force: true });
  fs.mkdirSync(setDir, { recursive: true });

  const images = [];
  for (const slot of IPHONE_SLOTS) {
    for (const scale of slot.scales) {
      const px = slot.size * scale;
      const { file, variant } = sourceIcon(facts, px);
      const name = `AppIcon-${slot.size}x${slot.size}@${scale}x.png`;
      copy(file, path.join(setDir, name));
      images.push({ idiom: 'iphone', size: `${slot.size}x${slot.size}`, scale: `${scale}x`, filename: name });
      log.ios.push({ slot: `${slot.size}pt @${scale}x`, px, variant, file: name });
    }
  }
  // The App Store marketing icon. FULL, deliberately — see the header.
  const marketing = sourceIcon(facts, 1024);
  copy(marketing.file, path.join(setDir, 'AppIcon-1024.png'));
  images.push({ idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: 'AppIcon-1024.png' });
  log.ios.push({ slot: 'App Store listing', px: 1024, variant: marketing.variant, file: 'AppIcon-1024.png' });

  fs.writeFileSync(path.join(setDir, 'Contents.json'),
    JSON.stringify({ images, info: { version: 1, author: 'withResponsiveIcons' } }, null, 2));
  return setDir;
}

/** Android launcher densities: the mipmap bucket and the square icon's pixel size. */
const ANDROID_DENSITIES = [
  { dpi: 'mdpi', launcher: 48 },
  { dpi: 'hdpi', launcher: 72 },
  { dpi: 'xhdpi', launcher: 96 },
  { dpi: 'xxhdpi', launcher: 144 },
  { dpi: 'xxxhdpi', launcher: 192 },
];

function writeAndroidMipmaps(projectRoot, facts, log) {
  const res = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(res)) {
    throw new Error(`withResponsiveIcons: no android res directory — prebuild did not produce the ` +
      `Android project this plugin is meant to patch.`);
  }
  for (const { dpi, launcher } of ANDROID_DENSITIES) {
    const dir = path.join(res, `mipmap-${dpi}`);
    const { file, variant } = sourceIcon(facts, launcher);
    copy(file, path.join(dir, 'ic_launcher.png'));
    copy(file, path.join(dir, 'ic_launcher_round.png'));
    log.android.push({ dpi, asset: 'ic_launcher', px: launcher, variant });

    // The adaptive layers, pre-rendered at this density's 108dp canvas. Copied, never resized.
    for (const layer of ['foreground', 'background', 'monochrome']) {
      const src = path.join(BUILT, 'adaptive', dpi, `${layer}.png`);
      if (!fs.existsSync(src)) {
        throw new Error(`withResponsiveIcons: missing adaptive ${layer} for ${dpi} ` +
          `(${path.relative(ROOT, src)}). Re-run tools/icon/build-f-icon.mjs.`);
      }
      copy(src, path.join(dir, `ic_launcher_${layer}.png`));
      log.android.push({ dpi, asset: `ic_launcher_${layer}`, px: null, variant: 'compact' });
    }
  }
  return res;
}

module.exports = function withResponsiveIcons(config) {
  const facts = loadSplit();

  config = withDangerousMod(config, ['ios', (cfg) => {
    const log = { ios: [], android: [] };
    const dir = writeIosCatalogue(cfg.modRequest.projectRoot, facts, log);
    console.log(`\n[withResponsiveIcons] iOS — threshold ${facts.threshold.px}px, from ` +
      `${path.basename(facts.threshold.source)}`);
    for (const r of log.ios) {
      console.log(`  ${String(r.px).padStart(4)}px  ${r.variant.padEnd(7)} ${r.slot.padEnd(20)} ${r.file}`);
    }
    console.log(`  -> ${path.relative(cfg.modRequest.projectRoot, dir)}`);
    return cfg;
  }]);

  config = withDangerousMod(config, ['android', (cfg) => {
    const log = { ios: [], android: [] };
    const res = writeAndroidMipmaps(cfg.modRequest.projectRoot, facts, log);
    console.log(`\n[withResponsiveIcons] Android`);
    for (const r of log.android.filter((x) => x.asset === 'ic_launcher')) {
      console.log(`  ${r.dpi.padEnd(8)} ${String(r.px).padStart(4)}px  ${r.variant}`);
    }
    console.log(`  adaptive foreground/background/monochrome: compact, at every density`);
    console.log(`  -> ${path.relative(cfg.modRequest.projectRoot, res)}`);
    return cfg;
  }]);

  return config;
};
