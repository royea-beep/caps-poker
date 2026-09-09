/**
 * TWO SMALL THINGS, PINNED — the bug form's ceiling, and the crash row's device id.
 *
 * MEASURED, production, 2026-09-06: `crash_reports` holds 350 rows and `device_id` is NULL in
 * ALL 350 — 191 of them written by utils/webErrorReporter, which is the live web crash writer
 * and the only one that never set the column. The other two writers (utils/crash-evidence,
 * utils/notifications) have set it since AU2.1 on 2026-08-01, but the last native crash row is
 * dated 2026-07-23, so that fix has never actually written a row. Web is where the round will
 * happen, and web was the gap.
 *
 * NO BACKFILL. The 350 existing rows keep their NULL: the device that produced them cannot be
 * recovered from the row, and inventing one would make a join look sound when it is a guess.
 * CUTOFF: web crash rows written from 2026-09-06 carry `device_id`.
 *
 * THE FORM had no timeout and no interim text. A tester watched an unlabelled spinner for as
 * long as the request took before it failed on its own, with nothing on screen distinguishing
 * "working" from "stuck" from "already sent". Both are source guards on purpose: neither defect
 * was a wrong value, both were a missing line.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

function code(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the bug form gives up, and says so while it waits', () => {
  const src = code('components/ReportBugButton.tsx');

  it('has a hard ceiling on the send', () => {
    expect(src).toMatch(/const SEND_TIMEOUT_MS = \d+;/);
    // The request is genuinely cancelled, not merely stopped being awaited — otherwise a hung
    // send can resolve later and overwrite a state the tester has moved past.
    expect(src).toContain('.abortSignal(ac.signal);');
    expect(src).toMatch(/setTimeout\(\(\) => \{ timedOut = true; ac\.abort\(\); \}, SEND_TIMEOUT_MS\)/);
  });

  it('tells the tester what is happening while it waits, and that it is slow', () => {
    expect(src).toMatch(/const SLOW_HINT_MS = \d+;/);
    expect(src).toContain("testID=\"report-bug-sending\"");
    expect(src).toContain("slow ? T('stillSending') : T('sending')");
  });

  it('reports a timeout as its own outcome, not as a generic connection error', () => {
    expect(src).toContain("'timeout'");
    expect(src).toContain("testID=\"report-bug-timeout\"");
    expect(src).toContain("setStatus(timedOut ? 'timeout' : 'error')");
  });

  it('every new string exists in both languages', () => {
    const i18nSrc = readFileSync(join(ROOT, 'components/ReportBugButton.tsx'), 'utf8');
    for (const key of ['sending', 'stillSending', 'errTimeout']) {
      const row = new RegExp(`${key}\\s*:\\s*\\{[^}]*en:[^}]*he:[^}]*\\}`);
      expect(i18nSrc).toMatch(row);
    }
  });

  it('clears its timers so a closed modal leaves nothing running', () => {
    expect(src).toContain('const clearTimers = useCallback');
    expect(src).toContain('useEffect(() => () => clearTimers(), [clearTimers]);');
    expect(src).toMatch(/finally \{\s*clearTimers\(\);/);
  });
});

describe('a web crash names the device that produced it', () => {
  const src = code('utils/webErrorReporter.ts');

  it('writes device_id on the crash row', () => {
    expect(src).toContain('device_id: getCachedDeviceId(),');
  });

  it('reads it synchronously — the window error handler must not await', () => {
    expect(src).toContain("import { getDeviceId, getCachedDeviceId } from './leaderboard';");
    // The cache is warmed at init, once, fire-and-forget.
    expect(src).toContain('void getDeviceId().catch(() => {});');
    // report() itself stays synchronous.
    expect(src).toMatch(/function report\(message: string, stack\?: string\): void \{/);
  });

  it('the synchronous accessor returns null rather than inventing an id', () => {
    const lb = code('utils/leaderboard.ts');
    expect(lb).toContain('export function getCachedDeviceId(): string | null {');
    expect(lb).toContain('return _deviceId ?? null;');
  });

  it('the newest non-actionable audio rejection is filtered out', () => {
    expect(src).toContain("m.includes('play() request was interrupted')");
  });
});
