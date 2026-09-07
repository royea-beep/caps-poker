/**
 * THE SIMULATOR SIGNAL — a guard on the rule, not on the database.
 *
 * 2026-09-07: an iOS Simulator bound itself, took a starter grant, and sat in the round's numbers
 * looking exactly like a real phone. `v_harness_devices` could not see it, and neither could
 * `v_automation_devices`, because BOTH ask "is this a robot?" and a simulator is not a robot:
 * it reports `webdriver: false`, carries no Headless/Playwright user agent, and its device_id
 * matches the real-device pattern. The signal that does work is `device_model`.
 *
 * The migration 20260907000000_simulator_devices_companion_view.sql encodes that as a regex.
 * ⚠️ THE RISK IS NOT THAT IT MISSES A SIMULATOR — it is that somebody widens it and it starts
 * sweeping REAL devices, at which point a purge deletes players. So this test pins both
 * directions against the exact device_model strings this database actually holds.
 */
const SIMULATOR_SIGNAL = /(simulator|emulator|sdk_gphone|android sdk built)/i;

describe('harness simulator signal', () => {
  // Every device_model present in analytics_events on 2026-09-07, with its device count.
  const REAL = [
    'iPhone',              // 128 devices
    'Macintosh',           //  33
    'iPhone 17 Pro Max',   //   3
    'K',                   //   2
    'iPhone 16',           //   1
    'iPad',                //   1
    'iPhone 12 Pro Max',   //   1 — Roye's second phone. Deleting this one would delete a tester.
  ];
  const SYNTHETIC = [
    'Simulator iOS',                 // 113 devices, none of them caught by v_harness_devices
    'iOS Simulator',
    'Android Emulator',
    'sdk_gphone64_arm64',
    'Android SDK built for x86',
  ];

  it.each(REAL)('does NOT flag a real device model: %s', (model) => {
    expect(SIMULATOR_SIGNAL.test(model)).toBe(false);
  });

  it.each(SYNTHETIC)('flags a simulator or emulator: %s', (model) => {
    expect(SIMULATOR_SIGNAL.test(model)).toBe(true);
  });

  it('matches the regex the migration actually installed', () => {
    const fs = require('fs');
    const sql = fs.readFileSync(
      'supabase/migrations/20260907000000_simulator_devices_companion_view.sql',
      'utf8',
    );
    // The migration is the source of truth; this test fails if the two ever drift apart.
    expect(sql).toContain("~* '(simulator|emulator|sdk_gphone|android sdk built)'");
  });

  it('leaves the human-shaped device alone — it has no device_model signal at all', () => {
    // 86c5-7eff-4e6b reported no device_model on most events and "iPhone" on one.
    expect(SIMULATOR_SIGNAL.test('iPhone')).toBe(false);
  });
});
