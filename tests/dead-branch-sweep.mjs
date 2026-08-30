/**
 * DEAD-BRANCH SWEEP — find the shape that has now bitten this project seven times.
 *
 * THE SHAPE. A component takes a boolean, branches on it, and one side of the branch is
 * unreachable because every call site passes the same literal — or never passes it at all.
 * The unreachable side then accumulates comments, tuning and confident claims about behaviour
 * that has not executed since the day it was written.
 *
 * Known instances before this sweep:
 *   isLandscape   — a whole layout branch, no call site ever passed true
 *   isV2          — same
 *   revealed      — Board's, hardcoded `revealed={false}` at its single call site
 *   KILL_Board    — a module const `true`, so `if (!KILL_Board)` is `if (false)`
 *
 * WHAT THIS REPORTS, and what it does NOT. It reports facts about call sites:
 *   ALWAYS_<lit>  every JSX call site passes the same literal
 *   NEVER_PASSED  the prop is declared and no call site passes it at all
 * It does NOT decide that either is a bug — `active={false}` may be correct and permanent.
 * It decides that the OTHER branch has never run, which is the thing that keeps being assumed
 * rather than checked. A finding is a question to answer, not a defect to fix.
 *
 * LIMITS, STATED SO NOBODY READS MORE INTO A CLEAN LINE THAN IT CARRIES (Iron Rule #8/#14):
 *   - It reads JSX call sites only. A component rendered through a variable, a map of
 *     elements, or React.createElement is invisible to it.
 *   - Spread props (`{...props}`) are DETECTED and the component is reported as UNSCANNABLE
 *     rather than clean, because a spread can supply anything.
 *   - It only looks at props whose declared type mentions `boolean`.
 *   - Zero findings for a component means "nothing of this shape was found by this method",
 *     never "this component is clean".
 *
 * Usage:  node tests/dead-branch-sweep.mjs [--json]
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SCAN_DIRS = ['app', 'components'];
const SKIP = /node_modules|__tests__|\.test\.|\.spec\./;

/** Every .tsx under the scan dirs. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Blank out comments, KEEPING line count and offsets so reported line numbers stay true.
 *
 * THE SECOND BUG THIS EXISTS TO NOT HAVE. Without it, a prose mention of `<Board>` inside a
 * `//` comment in app/multiplayer-game.tsx counted as a call site. It passes no props, so
 * Board's `active` prop looked "literal at 1 of 2 sites" and fell between both verdicts —
 * the sweep SILENTLY DROPPED a real finding (`active={false}` at its only real call site)
 * because a comment was voting.
 */
function stripComments(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/([^:"'`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - 1));
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const raw = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const src = new Map([...raw].map(([f, t]) => [f, stripComments(t)]));

/** Pull `name: boolean`-ish members out of a `{ ... }` body. */
function booleansIn(body) {
  const props = new Set();
  for (const m of body.matchAll(/(\w+)\s*\??\s*:\s*([A-Za-z|\s]*\bboolean\b[A-Za-z|\s]*)(?=[;,}\n])/g)) props.add(m[1]);
  return props;
}

/**
 * (componentName -> boolean props) for every function component in a file.
 *
 * THE BUG THIS EXISTS TO NOT HAVE. A first pass collected every boolean in the file and
 * attributed all of them to the file's EXPORTED component, then looked for them at that
 * component's call sites. TimerController.tsx contains a private `CircularTimer({ pulsing })`
 * and `pulsing` IS passed to it, on line 150 — but not to `<TimerController>`, so the sweep
 * reported it NEVER_PASSED. A false finding is worse than no finding: it is the same
 * "confident claim about code that was never checked" this tool exists to catch.
 *
 * So props are bound to the function that declares them, and each function is scanned at
 * ITS OWN call sites, private components included.
 */
function componentProps(file, text) {
  const decls = new Map(); // component name -> Set<prop>
  const typeBlocks = new Map(); // type name -> body
  for (const m of text.matchAll(/(?:interface|type)\s+(\w+)\s*=?\s*\{([\s\S]*?)\n\}/g)) typeBlocks.set(m[1], m[2]);

  // `function NAME({ ... }: TYPE)` and `function NAME({ ... }: { inline })`
  for (const m of text.matchAll(/function\s+([A-Z]\w*)\s*\(\s*\{[\s\S]{0,2000}?\}\s*:\s*(\{[\s\S]*?\}|\w+)/g)) {
    const [, name, ann] = m;
    const body = ann.startsWith('{') ? ann : (typeBlocks.get(ann) ?? '');
    if (body) decls.set(name, booleansIn(body));
  }
  // `export default function ({...}: TYPE)` — anonymous, so it is the file's name
  const anon = text.match(/export\s+default\s+function\s*\(\s*\{[\s\S]{0,2000}?\}\s*:\s*(\{[\s\S]*?\}|\w+)/);
  if (anon) {
    const body = anon[1].startsWith('{') ? anon[1] : (typeBlocks.get(anon[1]) ?? '');
    if (body) decls.set(path.basename(file, '.tsx'), booleansIn(body));
  }
  for (const [k, v] of [...decls]) if (!v.size) decls.delete(k);
  return decls;
}

/** Slice out the attribute text of every `<Name ...>` in `text`, brace-aware. */
function callSites(text, name) {
  const sites = [];
  const re = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  let m;
  while ((m = re.exec(text))) {
    let i = re.lastIndex, depth = 0, quote = null;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    sites.push({ attrs: text.slice(re.lastIndex, i), line: text.slice(0, m.index).split('\n').length });
  }
  return sites;
}

/** What a call site passes for `prop`: {kind:'literal'|'expr'|'absent', value} */
function passedValue(attrs, prop) {
  if (/\{\s*\.\.\./.test(attrs)) return { kind: 'spread' };
  const bare = new RegExp(`(?:^|\\s)${prop}(?=\\s|$|/)`);
  const withVal = new RegExp(`(?:^|\\s)${prop}\\s*=\\s*(\\{[^{}]*\\}|"[^"]*")`);
  const m = attrs.match(withVal);
  if (m) {
    const raw = m[1].replace(/^\{|\}$/g, '').trim();
    return /^(true|false)$/.test(raw) ? { kind: 'literal', value: raw } : { kind: 'expr', value: raw.slice(0, 60) };
  }
  if (bare.test(attrs) && !withVal.test(attrs)) return { kind: 'literal', value: 'true' }; // `<X flag />`
  return { kind: 'absent' };
}

const findings = [];
const unscannable = [];

for (const [file, text] of src) {
  for (const [name, props] of componentProps(file, text)) {
    // Call sites of THIS component, anywhere in the scanned tree (its own file included, so
    // private components are covered rather than silently skipped).
    const sites = [];
    for (const [f2, t2] of src) for (const s of callSites(t2, name)) sites.push({ ...s, file: f2 });
    if (!sites.length) {
      unscannable.push({ component: `${path.relative(ROOT, file)} · <${name}>`,
        reason: 'no JSX call site found — rendered indirectly, or not rendered at all' });
      continue;
    }
    if (sites.some((s) => /\{\s*\.\.\./.test(s.attrs))) {
      unscannable.push({ component: `${path.relative(ROOT, file)} · <${name}>`, reason: 'a call site uses spread props' });
      continue;
    }

    for (const prop of props) {
      const vals = sites.map((s) => ({ ...passedValue(s.attrs, prop), at: `${path.relative(ROOT, s.file)}:${s.line}` }));
      if (vals.some((v) => v.kind === 'expr')) continue;         // genuinely variable somewhere
      const lits = vals.filter((v) => v.kind === 'literal');
      if (lits.length === 0) {
        findings.push({ verdict: 'NEVER_PASSED', component: `${path.relative(ROOT, file)} · <${name}>`, prop,
          sites: vals.length, detail: `declared, and none of its ${vals.length} call site(s) pass it — the truthy branch is unreachable` });
      } else if (new Set(lits.map((v) => v.value)).size === 1 && lits.length === vals.length) {
        findings.push({ verdict: `ALWAYS_${lits[0].value}`, component: `${path.relative(ROOT, file)} · <${name}>`, prop,
          sites: vals.length, detail: `every call site passes ${lits[0].value} (${vals.map((v) => v.at).join(', ')})` });
      }
    }
  }
}

const out = {
  ts: new Date().toISOString(),
  scanned: { files: files.length, dirs: SCAN_DIRS },
  method: 'JSX call sites only. Zero findings is not proof of absence — see the header.',
  unscannable,
  findingCount: findings.length,
  findings: findings.sort((a, b) => a.component.localeCompare(b.component)),
};

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`scanned ${files.length} .tsx files in ${SCAN_DIRS.join(', ')}`);
  console.log(`${findings.length} boolean prop(s) constant or absent at EVERY call site:\n`);
  for (const f of out.findings) console.log(`  ${f.verdict.padEnd(13)} ${f.component} · ${f.prop}\n${' '.repeat(17)}${f.detail}`);
  if (unscannable.length) {
    console.log(`\nUNSCANNABLE — NOT reported clean (${unscannable.length}):`);
    for (const u of unscannable) console.log(`  ${u.component} — ${u.reason}`);
  }
}
fs.writeFileSync(path.join(ROOT, 'tests/dead-branch-sweep-result.json'), JSON.stringify(out, null, 2));
