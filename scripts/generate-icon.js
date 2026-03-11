/**
 * Generate CP branded app icons for Caps Poker.
 *
 * Creates:
 *  - 1024x1024 icon (dark green bg, gold "CP" text, small ♠ corner)
 *  - 1284x2778 splash
 *  - 48x48 favicon
 *  - Android adaptive icon variants
 *
 * Requires: npm install sharp (not in package.json to avoid EAS build failures)
 * Usage:  node scripts/generate-icon.js
 */

const sharp = require("sharp");
const path = require("path");

const ASSETS = path.resolve(__dirname, "..", "assets");

const ICON_SIZE = 1024;
const SPLASH_W = 1284;
const SPLASH_H = 2778;

const BG = "#1a3a2a";
const GOLD = "#c9a84c";

function iconSvg(size) {
  const fontSize = Math.round(size * 0.37);
  const suitSize = Math.round(size * 0.12);
  const suitX = Math.round(size * 0.88);
  const suitY = Math.round(size * 0.92);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.08)}" fill="${BG}"/>
  <text x="${size / 2}" y="${size * 0.52}" font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}" font-weight="bold" fill="${GOLD}"
    text-anchor="middle" dominant-baseline="middle">CP</text>
  <text x="${suitX}" y="${suitY}" font-family="Arial, sans-serif"
    font-size="${suitSize}" fill="${GOLD}" text-anchor="middle" opacity="0.5">&#9824;</text>
</svg>`;
}

function splashSvg(w, h) {
  const fontSize = Math.round(w * 0.25);
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <text x="${w / 2}" y="${h * 0.44}" font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}" font-weight="bold" fill="${GOLD}"
    text-anchor="middle" dominant-baseline="middle">CP</text>
  <text x="${w / 2}" y="${h * 0.50}" font-family="Arial, sans-serif"
    font-size="${Math.round(w * 0.06)}" fill="${GOLD}" opacity="0.6"
    text-anchor="middle" dominant-baseline="middle">CAPS POKER</text>
</svg>`;
}

async function generate() {
  const iconBuf = Buffer.from(iconSvg(ICON_SIZE));
  const splashBuf = Buffer.from(splashSvg(SPLASH_W, SPLASH_H));

  // Main icon
  await sharp(iconBuf).png().toFile(path.join(ASSETS, "icon.png"));
  console.log("wrote icon.png (1024x1024)");

  // Splash
  await sharp(splashBuf).png().toFile(path.join(ASSETS, "splash-icon.png"));
  console.log("wrote splash-icon.png (1284x2778)");

  // Favicon
  await sharp(iconBuf).resize(48, 48).png().toFile(path.join(ASSETS, "favicon.png"));
  console.log("wrote favicon.png (48x48)");

  // Android adaptive icon variants (all same for now)
  await sharp(iconBuf).png().toFile(path.join(ASSETS, "android-icon-foreground.png"));
  await sharp(iconBuf).png().toFile(path.join(ASSETS, "android-icon-background.png"));
  await sharp(iconBuf).png().toFile(path.join(ASSETS, "android-icon-monochrome.png"));
  console.log("wrote android adaptive icon variants");

  console.log("\nAll icons generated successfully.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
