#!/usr/bin/env node
/**
 * SECRET SCANNER — the standing guard.
 *
 * WHY THIS EXISTS. On 2026-09-06 a LIVE Telegram bot token was found committed in plaintext in
 * this PUBLIC repository, in two places, for 81 days. A third party used it to rewrite
 * @caps_bug_bot's display name and could have read every bug report submitted through it. The
 * sweep that followed found three more credentials in history — a Supabase personal access token,
 * an Anthropic API key baked into two SHIPPED WEB BUNDLES, and a Google API key in a prompt file.
 * All three were already dead, which was luck, not process.
 *
 * A revoke fixes one leak. Only a gate stops the next one. Run modes:
 *   node scripts/scan-secrets.mjs --staged   (pre-commit: only what is about to be committed)
 *   node scripts/scan-secrets.mjs            (CI: the whole working tree)
 *   node scripts/scan-secrets.mjs --self-test (proves the patterns actually fire)
 *
 * Exit 1 on any finding. It NEVER prints the matched value — printing a secret to a CI log is
 * the same mistake in a different file.
 */
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  // The one that actually leaked. Telegram bot tokens are <digits>:AA<35ish chars>.
  { name: 'Telegram bot token',            re: /\b[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}/ },
  // Worse than a service-role key: a management token can MINT one, deploy functions, drop tables.
  { name: 'Supabase personal access token', re: /\bsbp_[a-f0-9]{40,}/ },
  { name: 'Supabase secret key',            re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  // A service_role JWT is checked structurally below, not by prefix — see serviceRoleJwt().
  { name: 'Anthropic API key',              re: /\bsk-ant-(?!api03-your-key-here)[A-Za-z0-9_-]{40,}/ },
  { name: 'OpenAI API key',                 re: /\bsk-(proj-)?[A-Za-z0-9]{32,}/ },
  { name: 'GitHub token',                   re: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/ },
  { name: 'Google API key',                 re: /\bAIza[A-Za-z0-9_-]{33,}/ },
  { name: 'Stripe secret key',              re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{20,}/ },
  { name: 'Slack token',                    re: /\bxox[baprs]-[A-Za-z0-9-]{20,}/ },
  { name: 'AWS access key id',              re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'SendGrid key',                   re: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Private key block',              re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY/ },
  { name: 'Password in a connection string', re: /\bpostgres(?:ql)?:\/\/[^\s:'"]+:(?!(?:pass|password|<|\[|\$|user|YOUR))[^\s@'"]{6,}@/ },
];

/** The anon key is PUBLIC BY DESIGN — it ships in the app bundle. Only service_role is a secret. */
function serviceRoleJwt(text) {
  const hits = text.match(/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? [];
  for (const jwt of hits) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') return true;
    } catch { /* not a JWT we can read; the prefix patterns above still apply */ }
  }
  return false;
}

const SKIP_DIRS = /(^|\/)(node_modules|\.git|\.expo|ios\/Pods|android\/build)(\/|$)/;
const BINARY = /\.(png|jpe?g|gif|webp|mp4|mov|ico|ttf|otf|woff2?|zip|gz|pdf|keystore|jks|p8|p12|mobileprovision)$/i;
const MAX_BYTES = 3_000_000;

function filesToScan() {
  if (process.argv.includes('--staged')) {
    return execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
      .split('\n').filter(Boolean);
  }
  return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function scanText(text) {
  const found = [];
  for (const { name, re } of PATTERNS) if (re.test(text)) found.push(name);
  if (serviceRoleJwt(text)) found.push('Supabase SERVICE-ROLE key');
  return found;
}

if (process.argv.includes('--self-test')) {
  // A guard nobody has watched fire is not a guard. These are syntactically valid but fake.
  const cases = [
    ['Telegram bot token', '1234567890:AA' + 'b'.repeat(33)],
    ['Supabase personal access token', 'sbp_' + 'a'.repeat(40)],
    ['Anthropic API key', 'sk-ant-api03-' + 'x'.repeat(60)],
    ['Google API key', 'AIza' + 'B'.repeat(35)],
    ['AWS access key id', 'AKIA' + 'ABCDEFGHIJKLMNOP'],
    ['GitHub token', 'ghp_' + 'c'.repeat(36)],
  ];
  let bad = 0;
  for (const [label, sample] of cases) {
    const hit = scanText(sample).includes(label);
    console.log(`  ${hit ? 'DETECTED' : 'MISSED  '}  ${label}`);
    if (!hit) bad++;
  }
  // And the two things that must NOT fire: the public anon key, and the .env.example placeholder.
  const anonJwt = execSync("git show HEAD:utils/supabase.ts", { encoding: 'utf8' });
  const anonClean = scanText(anonJwt).length === 0;
  console.log(`  ${anonClean ? 'IGNORED ' : 'FALSE+  '}  public anon key (must be ignored)`);
  if (!anonClean) bad++;
  const placeholderClean = scanText('EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here').length === 0;
  console.log(`  ${placeholderClean ? 'IGNORED ' : 'FALSE+  '}  .env.example placeholder (must be ignored)`);
  if (!placeholderClean) bad++;
  console.log(bad === 0 ? '\nself-test PASSED' : `\nself-test FAILED (${bad})`);
  process.exit(bad === 0 ? 0 : 1);
}

let failures = 0;
for (const f of filesToScan()) {
  if (SKIP_DIRS.test(f) || BINARY.test(f)) continue;
  let text;
  try {
    if (statSync(f).size > MAX_BYTES) continue;
    text = readFileSync(f, 'utf8');
  } catch { continue; }
  const found = scanText(text);
  if (found.length) {
    failures++;
    // The FILE and the KIND. Never the value.
    console.error(`  BLOCKED  ${f}  ->  ${found.join(', ')}`);
  }
}

if (failures) {
  console.error(`\nSECRET SCAN FAILED: ${failures} file(s) contain something credential-shaped.`);
  console.error('Move it to the Supabase vault or a GitHub Actions secret and read it at run time.');
  console.error('This repository is PUBLIC. A committed credential is a disclosed credential, and');
  console.error('deleting it later does not remove it from git history — only a revoke protects.');
  process.exit(1);
}
console.log('secret scan: clean');
