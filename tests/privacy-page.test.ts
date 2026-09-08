/**
 * THE PRIVACY PAGE MUST STAY TRUE, AND MUST STAY THE COPY THAT SHIPS.
 *
 * ⚠️ TWO FAILURES THIS PINS, BOTH OF WHICH ALREADY HAPPENED HERE.
 *
 * 1. A PROMISE THE PRODUCT CANNOT HONOUR. The page this replaced said account deletion through
 *    Settings was "immediate and irreversible". `delete_user_account` is REVOKED from anon and
 *    authenticated (checked on production), so that button is guaranteed to fail — app/settings.tsx
 *    says so in its own error branch and tells the player to email instead. A privacy policy that
 *    promises a right the code cannot deliver is worse than a missing one.
 *
 * 2. THE WRONG COPY OF THE FILE. The web build runs `expo export` (which copies public/ into dist/)
 *    and THEN scripts/fix-web-html.js, which copies the ROOT privacy.html over the top. A
 *    public/privacy.html would be silently overwritten — the same shape as the catch-all 404 that
 *    was fixed in a vercel.json production never reads. This asserts no shadow copy exists.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');
/**
 * ⚠️ ASSERT ON THE BODY, NOT ON THE COMMENTS — this project has paid for the difference twice.
 * privacy.html opens with a comment recording exactly what the OLD page got wrong: that it
 * promised deletion was "immediate and irreversible", that it said "we do not share with third
 * parties", that it declared 12+. The first version of this file matched the whole document and so
 * failed on its own changelog — the same shape as the battle-pass test firing on the reopen note,
 * and of the caption rule that failed two correct captions. A guard that fails correct content
 * teaches the next person to delete the guard.
 */
/**
 * ⚠️ AND NORMALISE WHITESPACE, because HTML does. "There is no real-money gambling" is wrapped
 * across a line in the source, so a literal regex missed a phrase that renders perfectly. The page
 * was fine; the check was reading source formatting instead of what a reader sees. Collapsing runs
 * of whitespace makes the assertions test the sentence, which is the thing that has to be true.
 */
const page = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
const settings = fs.readFileSync(path.join(ROOT, 'app', 'settings.tsx'), 'utf8');
const generator = fs.readFileSync(path.join(ROOT, 'scripts', 'fix-web-html.js'), 'utf8');

describe('the privacy page is the one that ships', () => {
  it('has no shadow copy under public/, which the generator would overwrite', () => {
    expect(fs.existsSync(path.join(ROOT, 'public', 'privacy.html'))).toBe(false);
  });

  it('is copied into the build by the generator, and rewritten explicitly', () => {
    expect(generator).toMatch(/privacy\.html/);
    expect(generator).toMatch(/source: "\/privacy\.html"/);
  });
});

describe('the privacy page promises nothing the code cannot honour', () => {
  it('does NOT claim in-app account deletion works', () => {
    // The revoked RPC is still wired to the Settings button and still fails.
    expect(settings).toMatch(/delete_user_account/);
    expect(settings).toMatch(/Account deletion is temporarily disabled/);
    // So the page must not present Settings as a working deletion route.
    expect(page).not.toMatch(/Settings\s*&gt;\s*Delete/i);
    expect(page).not.toMatch(/immediate and irreversible/i);
    expect(page).toMatch(/does not currently work/i);
  });

  it('routes deletion to a human, at the address the brief specified', () => {
    expect(page).toMatch(/caps@ftable\.co\.il/);
    expect(page).toMatch(/delete it manually/i);
  });

  it('does not promise an automated data export', () => {
    expect(page).toMatch(/do not currently offer an automated way to export/i);
  });

  it('does not describe purchases the app cannot make', () => {
    expect(page).not.toMatch(/Apple processes (the )?payment/i);
    expect(page).toMatch(/cannot be bought with money/i);
  });
});

describe('the privacy page names every third party that genuinely receives data', () => {
  // Each of these is reachable in the shipped code or in a deployed Edge Function.
  it.each([
    ['Supabase', 'the backend host'],
    ['Vercel', 'hosts the web build'],
    ['Google', 'optional sign-in'],
    ['Telegram', 'bug reports are forwarded to a private channel'],
    ['Anthropic', 'bug reports are summarised by the Claude API'],
    ['OpenAI', 'attached audio is transcribed'],
    ['Expo', 'push notification delivery'],
  ])('names %s (%s)', (party) => {
    expect(page).toMatch(new RegExp(party));
  });

  it('does not claim it shares with nobody while naming seven parties', () => {
    expect(page).not.toMatch(/do not share.{0,40}third part/i);
  });
});

describe('the privacy page discloses the bug-report payload', () => {
  it.each(['breadcrumb', 'console output', 'device identifier', 'build number', 'screenshot'])(
    'says a report carries the %s', (thing) => {
      expect(page.toLowerCase()).toContain(thing.toLowerCase());
    });
});

describe('the privacy page agrees with the app about money and age', () => {
  it('states virtual chips only and no real-money gambling', () => {
    expect(page).toMatch(/virtual chips only/i);
    expect(page).toMatch(/no real-money gambling/i);
    expect(page).toMatch(/cannot be converted into money/i);
  });

  it('says 18+, matching the home screen and the age rating being declared', () => {
    expect(page).toMatch(/18 and over/i);
    expect(page).not.toMatch(/\b12\+/);
  });

  it('is in English, since the App Store listing locale is en-US', () => {
    expect(page).toMatch(/<html lang="en"/);
    expect(page).not.toMatch(/[֐-׿]/);   // no Hebrew characters anywhere
  });
});
