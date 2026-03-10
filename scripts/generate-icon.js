/**
 * Generate placeholder app icons for Caps Poker.
 *
 * Creates a 1024x1024 dark-green icon and variants needed by Expo/EAS.
 * Replace these with a professionally designed icon before public release.
 *
 * Usage:  node scripts/generate-icon.js
 */

const { Jimp } = require("jimp");
const path = require("path");

const SIZE = 1024;
const BG_COLOR = 0x0a1a0fff; // dark green, fully opaque

async function generate() {
  // --- Main icon (1024x1024 solid dark green) ---
  const icon = new Jimp({ width: SIZE, height: SIZE, color: BG_COLOR });
  const iconPath = path.resolve(__dirname, "..", "assets", "icon.png");
  await icon.write(iconPath);
  console.log("wrote", iconPath);

  // --- splash-icon (same for now) ---
  const splashPath = path.resolve(__dirname, "..", "assets", "splash-icon.png");
  await icon.write(splashPath);
  console.log("wrote", splashPath);

  // --- favicon (48x48) ---
  const favicon = icon.clone().resize({ w: 48, h: 48 });
  const faviconPath = path.resolve(__dirname, "..", "assets", "favicon.png");
  await favicon.write(faviconPath);
  console.log("wrote", faviconPath);

  // --- Android adaptive icon foreground (1024x1024) ---
  const fgPath = path.resolve(
    __dirname,
    "..",
    "assets",
    "android-icon-foreground.png"
  );
  await icon.write(fgPath);
  console.log("wrote", fgPath);

  // --- Android adaptive icon background (1024x1024 solid) ---
  const bgPath = path.resolve(
    __dirname,
    "..",
    "assets",
    "android-icon-background.png"
  );
  await icon.write(bgPath);
  console.log("wrote", bgPath);

  // --- Android monochrome (1024x1024) ---
  const monoPath = path.resolve(
    __dirname,
    "..",
    "assets",
    "android-icon-monochrome.png"
  );
  await icon.write(monoPath);
  console.log("wrote", monoPath);

  console.log("\nAll icons generated. Replace with designed assets before public release.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
