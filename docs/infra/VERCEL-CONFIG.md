# vercel.json — the two files, and the two ways prose has broken this project

**Written 2026-09-10 (RPT-CAPS-002).** This is the home the root `vercel.json` points at. Prose
goes HERE. It does not go in the JSON, in any form — not as a key, and not stuffed into a value.

## There are two config files and they are not the same file

| | root `vercel.json` | `dist/vercel.json` |
|---|---|---|
| written by | a person | `scripts/fix-web-html.js` |
| read by production | **never** | **always** |
| read by Vercel's Git integration | yes, on every push to every branch | no |
| keys | 6 (installCommand, buildCommand, outputDirectory, framework, rewrites, headers) | 2 (rewrites, headers) |

The site is deployed by `.github/workflows/web-deploy.yml`, which runs `npx vercel --prod` from
`dist/` after `scripts/fix-web-html.js` writes `dist/vercel.json`. **Any rewrite, header or
redirect that must ship goes in the generator.** A catch-all 404 fix went into the root file on
2026-09-03, was declared done, and was never live: four days later `/nope.png` still returned 200
with the app's HTML.

## Two outages, five days apart, from the same instinct

**2026-09-03 — the comment KEY.** A `_comment_rewrites` array was added to the root file to
explain a change. JSON has no comment syntax, so it was a real property, and Vercel validates
`vercel.json` against a **closed schema BEFORE the project's Ignored Build Step runs**. Every
Git-integration deploy died at `should NOT have additional property _comment_rewrites` — 29 of 40
deploys in one 21.7-hour window. The Ignored Build Step that had been correctly cancelling those
deploys for weeks never got the chance, because validation comes first.

**2026-09-08 — the same prose, moved into a VALUE.** Commit `9577aa5` removed the key and put the
warning in `installCommand` as a chain of `echo` segments: **1,158 characters**. Vercel caps
`installCommand` at **256**. So the deploys kept failing, with a different message —
`` `installCommand` should NOT be longer than 256 characters `` — for two more days, and it was
still failing on `f4edc75` at 13:12Z on 2026-09-10.

**The class:** a schema constrains VALUES as well as KEYS. Moving prose from a key to a value
does not remove it from the file.

## Why the guard did not catch either one

`tests/vercel-rewrites.test.ts` (added by the same commit, `9577aa5`) checks top-level key names
against a hand-typed allowlist. It has three holes, all measured on 2026-09-10:

1. **No value is ever length-checked.** The 256-cap violation is invisible to it.
2. **It pins the violation in place.** Four assertions in its `the root vercel.json labels itself`
   block REQUIRE the three warning phrases to be present in `installCommand`. Shortening the
   string to make the deploy pass would have failed the guard. A guard that fails when you fix the
   bug is worse than no guard.
3. **No workflow ran it.** `jest` appears in `.github/workflows/claude-fix.yml` and nowhere else.
   `web-deploy.yml` runs no test step at all, so the deploy path never executed it once.

It reported **56 of 56 passing** on a file Vercel was refusing to deploy.

## What guards it now

`scripts/check-vercel-config.mjs`, run by `.github/workflows/vercel-config-check.yml` on **every
push to every branch** — which is where the Git integration fires, and therefore where the break
happens. `web-deploy.yml` could not have covered it: it skips docs-only pushes via `paths-ignore`,
and both of the most recent failures were docs-only commits on `main`.

The checker validates **both** files: the root one as written, and the generated one rebuilt from
the generator's own object literal. It enforces the key allowlist AND the documented string caps.
`--self-test` proves it refuses both historical shapes and accepts the current file; the workflow
runs the self-test first and blocks on it, so a checker broken into always-pass fails the run
rather than blessing it.

Proven to refuse, 2026-09-10, by planting each shape into the real repo and watching exit 1:

```
✗ vercel.json (root): should NOT have additional property `_comment_rewrites`
✗ vercel.json (root): `installCommand` should NOT be longer than 256 characters (it is 1342)
✗ dist/vercel.json (GENERATED — this is what production serves): should NOT have additional property `_comment`
```

## Can prose reach the file production actually serves?

**Not today, and now checked rather than assumed.** `dist/vercel.json` is `JSON.stringify` of an
object literal in `scripts/fix-web-html.js` carrying exactly two keys, `rewrites` and `headers`.
It has no `installCommand`, so the 256 cap cannot bite there. A `_comment:` property added to that
literal WOULD ship — plant 3 above is exactly that case, and the checker refuses it.

## The rule

Put commentary in `scripts/fix-web-html.js` (it is JavaScript — real comments) or in this file.
The root `vercel.json` gets data only, and one short pointer under 256 characters.

## Why the root file is kept rather than deleted

Its `buildCommand` is a working build of this app, which is what a Git-integration deploy would
fall back on if the project's Ignored Build Step were ever switched off. Deleting it would swap a
labelled trap for a silent zero-config deploy of the repository root onto the production domain.
