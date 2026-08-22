// LIVE bug-report test: a NORMAL report must land, and a REFUSED one must not look like a crash.
// Both engines, because the refusal is something a tester reads on screen.
import { chromium, webkit } from 'playwright';

const SITE = 'https://caps.ftable.co.il';
const REST = 'https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports';
const KEY = process.env.ANON_KEY;
const MARK = process.env.MARK || 'probe-live';

async function floodDevice(deviceId, n) {
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const codes = [];
  for (let i = 0; i < n; i++) {
    const r = await fetch(REST, { method: 'POST', headers: H, body: JSON.stringify({
      project: 'caps-poker', report_type: 'text', status: 'probe_muted', ai_summary: 'probe',
      title: `${MARK} filler ${i}`, device_info: { device_id: deviceId } }) });
    codes.push(r.status);
  }
  return codes;
}

async function run(engine, name) {
  const b = await engine.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const out = { engine: name };
  try {
    await page.goto(`${SITE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(7000);

    const row = page.getByTestId('report-bug-row').first();
    await row.waitFor({ state: 'attached', timeout: 30000 });
    await row.scrollIntoViewIfNeeded();

    // --- NORMAL REPORT ---
    await row.click();
    await page.getByTestId('report-bug-description').fill(`${MARK} ${name} normal report`);
    await page.getByTestId('report-bug-send').click();
    await page.waitForTimeout(4000);
    out.normalAccepted = (await page.getByText('Thanks', { exact: false }).count()) > 0;
    out.normalText = (await page.getByText('Thanks', { exact: false }).first().innerText().catch(() => '(none)'));
    await page.screenshot({ path: `tests/screenshots/bugreport-normal-${name}.png` });
    // the device id the app actually used, straight out of its own storage
    out.deviceId = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (/device/i.test(k)) return `${k}=${localStorage.getItem(k)}`;
      return null;
    });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    const devId = (out.deviceId || '').split('=').pop();
    // 11 fillers + the report the tester just filed = 12, the ceiling. The NEXT one is the tester's.
    out.flood = await floodDevice(devId, 11);

    // --- REFUSED REPORT, through the real UI ---
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    const row2 = page.getByTestId('report-bug-row').first();
    await row2.waitFor({ state: 'attached', timeout: 30000 });
    await row2.scrollIntoViewIfNeeded();
    await row2.click();
    await page.getByTestId('report-bug-description').fill(`${MARK} ${name} refused report`);
    await page.getByTestId('report-bug-send').click();
    await page.waitForTimeout(4000);
    out.limitedShown = await page.getByTestId('report-bug-limited').count() > 0;
    out.refusedText = out.limitedShown
      ? (await page.getByTestId('report-bug-limited').first().innerText()) : '(none)';
    out.sendStillThere = await page.getByTestId('report-bug-send').count() > 0;
    out.thanksShown = (await page.getByText('Thanks', { exact: false }).count()) > 0;
    await page.screenshot({ path: `tests/screenshots/bugreport-refused-${name}.png` });
  } catch (e) {
    out.error = String(e).slice(0, 300);
  }
  await b.close();
  return out;
}

const results = [];
for (const [eng, n] of [[chromium, 'chromium'], [webkit, 'webkit']]) results.push(await run(eng, n));
console.log(JSON.stringify(results, null, 1));
if (results.some((r) => r.error || !r.normalAccepted)) { console.error('FAILED RUN'); process.exit(2); }
