const fs = require('fs');

console.log('\n🃏 Caps Poker — Pre-Build Checks\n');

const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));

const checks = [
  { name: 'Bundle ID set', pass: !!appJson.expo?.ios?.bundleIdentifier },
  { name: 'Scheme set', pass: !!appJson.expo?.scheme },
  { name: 'Version set', pass: !!appJson.expo?.version },
  { name: 'Orientation portrait', pass: appJson.expo?.orientation === 'portrait' },
  { name: 'Dark mode', pass: appJson.expo?.userInterfaceStyle === 'dark' },
  { name: 'EAS preview profile', pass: !!easJson.build?.preview },
  { name: 'EAS production profile', pass: !!easJson.build?.production },
  { name: 'Icon file exists', pass: fs.existsSync('assets/icon.png') },
  { name: 'Splash file exists', pass: fs.existsSync('assets/splash-icon.png') },
  { name: 'No PLACEHOLDER owner', pass: appJson.expo?.owner !== 'PLACEHOLDER_OWNER' },
];

let passed = 0;
checks.forEach(c => {
  console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`);
  if (c.pass) passed++;
});

console.log(`\n  ${passed}/${checks.length} checks passed\n`);
if (passed < checks.length) {
  console.log('  Fix failing checks before building.\n');
  process.exit(1);
}
console.log('  Ready to build! Run: eas build --platform ios --profile preview\n');
