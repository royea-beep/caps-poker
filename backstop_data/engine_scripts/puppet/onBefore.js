/**
 * BackstopJS onBefore hook — seeds localStorage from tests/caps-onboarded.json
 * so every scenario navigates with caps_language + caps-poker-storage already set,
 * skipping the smart-default reseed paint on each capture.
 *
 * Runs before navigation: we register the seeded data via evaluateOnNewDocument
 * so the first script tick on the page already sees the persisted state.
 */
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', '..', '..', 'tests', 'caps-onboarded.json');

module.exports = async (page, _scenario, _viewport, _isReference, _browserContext) => {
  let entries = {};
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(raw);
    const ls = state?.origins?.[0]?.localStorage ?? [];
    for (const { name, value } of ls) entries[name] = value;
  } catch (e) {
    console.warn('[backstop:onBefore] storageState load failed:', e.message);
    return;
  }
  await page.evaluateOnNewDocument((kv) => {
    try {
      for (const k of Object.keys(kv)) localStorage.setItem(k, kv[k]);
    } catch (_) { /* localStorage may be unavailable for some scenarios */ }
  }, entries);
};
