# VAMOS CAPS — FULL-I18N-AND-FIXES (2026-09-03)

English must never show Hebrew. Then close S1, the 404, the false copy.
Branch `claude/vamos-caps-align-celebration-flppo0`. **S1 IS APPLIED TO PRODUCTION.** Nothing merged
to `main`, no version bump, no deploy.

---

# 1 — HEBREW LEAKING INTO ENGLISH: **0**, before and after

**The rule is asymmetric and the instrument encodes that asymmetry.** English showing Hebrew is a
defect, always, with no allowlist. Hebrew showing English is a gap, at lower severity, and hand-rank
names plus the CAPS loanwords stay English in both languages by standing product rule.

**Rendered, not grepped** — `tests/i18n-loop.mjs`, 26 routes × 2 engines × 4 widths × 2 languages.
It reads text nodes out of the live DOM and skips anything not painted (`display:none`,
zero-size, zero-opacity), so a hidden string cannot inflate or hide a count.

**Canary first, and it aborts the run on failure.** A planted page carries a known Hebrew string, a
known English string, and a hidden Hebrew string. All three detectors must behave:
`hebrew_caught` · `latin_caught` · `hidden_not_counted` — **PASS in chromium and in webkit**.

```
HEBREW RENDERED ON ENGLISH SCREENS:  before 0   ·   after 0     (must be 0)
```

**It was already 0 before this sprint, and it is still 0 after.** I did not find a single Hebrew
character on an English screen on any route, at any width, in either engine. That is the honest
answer: the zero-tolerance rule was already satisfied, and the work below did not break it.

**One key holds Hebrew inside the English table, and it is correct.** `languageHebrew: 'עברית'` is
the language switcher's endonym — a picker names each language in its own script or the person
looking for it cannot find it — and `SideMenu` renders `languageEnglish` when the current language
is English, so it never appears on an English screen. It is the single documented exemption in
`utils/__tests__/i18n-parity.test.ts`; nothing else may be added to it.

---

# 2 — HEBREW GAPS FILLED

**+143 keys, in all three places at once.** They were generated from one source list so the
interface, the Hebrew table and the English table cannot drift. Counting the lines of all three
blocks: **636 before → 1,083 after**. Counting distinct keys per table: **212 → 361**, and the two
tables hold exactly the same 361.

## Per screen, measured like-for-like at 393 / chromium

Every screen the brief enumerated is now at **zero**.

| screen | before | after | |
|---|---:|---:|---|
| `/play` | 7 | **0** | done |
| `/profile` | 6 | **0** | done |
| `/` (Home) | 5 | **0** | done |
| `/game` | 1 | **0** | done |
| `/theme-pick` | 11 | **0** | done |
| `/missions` | 5 | **0** | done |
| `/settings` | 49 | **2** | a build hash, not text — and **1** at the worst of the eight engine × width combinations |
| **the six enumerated screens + settings** | **84** | **2** | |
| everything else (17 routes, outside the brief) | 151 | 151 | reported below, untouched |
| **total, 24 routes** | **235** | **153** | |

## Two small behaviour changes worth naming## Two small behaviour changes worth naming

- **The player-name fallback now reads "Player 1", not "Player".** Home and Profile hardcoded
  `'Player'` while Settings already defaulted to `playerFallback` (`'Player 1'` / `'שחקן 1'`). All
  three now use the same key, so the three screens agree where they used to disagree by one word.
- **The daily-reward modal says "chips", not "CHIPS".** It first got wired to `profileChips`, which
  is the uppercase STAT LABEL, and rendered "+500 CHIPS". A separate `chipsWord` key holds the
  lowercase noun. Caught by reading the diff, not by a test.

## Hand-rank names left English — CONFIRMED, in both languages

They are a standing product rule, not an oversight, and the Hebrew table already keeps them that
way. Nothing about them changed. The first loop counted "ROYAL FLUSH" as a gap; that was **my
allowlist being wrong, not the app** — it matched per word and had `'royal flush'` as a phrase. The
list is now per-word and carries the reason above it. `COMPLETE`, `CAPS`, `Sit and Go` and the three
theme names are exempt for the same reason.

## What is NOT translated, and why — stated, not hidden

- **`/battle-pass` (34).** The entry was hidden last sprint because the screen promises 60 rewards
  and delivers none. Translating a screen no player can reach would be work on a feature that is
  about to change.
- **`/referral` (17), `/lobby` (11) + `/lobby/private` (12), `/achievements` (11),
  `/orientation-pick` (10), `/leaderboard` (8), `/friends` (7), and ten smaller screens
  (`/stats`, `/rank`, `/hand-history`, `/coaching`, `/gameover`, `/shop`, `/chip-store`,
  `/replay`, `/spectate` — 3 to 5 each).** These were outside the list the brief enumerated. They
  are real gaps, they are counted above, and they are the natural next sprint.
  **A Hebrew player can still read every one of them** — they show English, which the ruling allows.
- **A build hash (`(build 6068fb99)`) on Settings.** Not text.

## Both tables in sync — proven two ways

1. **TypeScript.** Both tables satisfy one `Translations` interface, so a missing key is a compile
   error. `tsc --noEmit` exit 0.
2. **`utils/__tests__/i18n-parity.test.ts`**, six assertions the compiler cannot make: identical key
   sets in both directions, identical value KINDS (string vs function), no empty or `TODO` value,
   every function-valued key returns a non-empty string in both languages, and — twice, for strings
   and for functions — **no Hebrew in the English table**.

`tsc` exit 0 · `jest` **2,706 / 2,706 across 44 suites** (2,656 before — +50 new assertions).

## Which matrix produced which number — provenance, so nothing is over-claimed

- **Hebrew on English = 0** — measured on **three complete matrices** (26 routes × 2 engines ×
  4 widths × 2 languages = 416 page loads each), canary green in both engines on all three. The
  third ran on the final build and is the one committed in `docs/full-i18n/loop/i18n-loop.json`.
- **The per-screen gap table** — quoted at **393 / chromium**, the slice the before-numbers were
  taken at, so the two compare like for like. The **worst case across all eight engine × width
  combinations is the same or better**: every enumerated screen is 0 at every width in both
  engines, and Settings' worst case is **1**, not 2 — the token `(build`, part of the build hash.

---

# 3 — S1 IS CLOSED. APPLIED, RE-ATTACKED, AND READ BACK.

## The hole, quoted from the live function before the change

```sql
IF p_device_id IS NULL OR p_device_id = '' OR v_uid IS NULL THEN RETURN true; END IF;
...
EXCEPTION WHEN OTHERS THEN
  RETURN true;
```

## The distinction that IS the fix, and where it is stated

**It refuses NO SESSION. It does not refuse ANONYMOUS.** Anonymous players arrive with role
`authenticated` and a `sub` claim, so `auth.uid()` is non-null and they pass exactly as before.
Stated in three places so it cannot be lost: the migration header, a comment on the first line of
the function body (`-- REFUSES NO SESSION, NOT ANONYMOUS`), and inline at the refusal itself.

## Branch-proven first — and the replica was hand-built, as it has been every time

⚠️ The branch came up **`MIGRATIONS_FAILED`, with 5 tables and 0 functions** against production's
73 and 188. Every object the gate reads was hand-built on the branch from production's live
definitions. The replica is only as faithful as that script — that is the branch-fidelity cost the
migration-history report priced, and it was paid again here.

| # | caller context | before | after |
|---|---|---|---|
| 1 | anon role, **NO session** (attacker **and** player mid-startup) | `true` — **MINTED** | **`false`** |
| 2 | anonymous **WITH session**, unbound device (a real player) | `true` | **`true`** |
| 3 | anonymous **WITH session**, device bound to itself | `true` | **`true`** |
| 4 | anonymous **WITH session**, device bound to another uid | `false` | `false` |
| 5 | **SERVICE ROLE**, no user session (`resolve-hand`) | `true` | **`true`** |
| 6 | real account **WITH session**, unbound device | `true` | **`true`** |
| 7 | no JWT context at all | — | **`false`** |
| 8 | **EXCEPTION** path (a table it reads made unavailable) | `true` — **MINTED** | **`false`** + logged, sqlstate `42P01` |

Rows 2, 3, 5 and 6 are the whole reason this was held twice. They all still pass.

**PART 2 proven separately, end to end, because `submit_score` had no guard at all.** It called
`econ_authz_probe` — telemetry, which refuses nothing — then inserted a new device into
`leaderboard`, firing the starting grant. On the branch, with the grant trigger replicated:

| device | leaderboard row | chips minted |
|---|---:|---:|
| raw anon, **before** | **1** | **2,000** ← the mint |
| raw anon, **after** | **0** | **0** ← refused |
| anonymous with session, after | 1 | 2,000 ← still works |
| service_role, after | 1 | 2,000 ← still works |

## All 14 callers — verified on production, by construction

Every one consumes the gate identically as `IF NOT public.econ_bind_ok(...) THEN <refuse>`, so all
14 inherit the table above exactly. Read off production, each with its own refusal shape:
`record_hand_net` · `record_reward` · `earn_chips` · `spend_chips` · `purchase_item` ·
`claim_daily_reward` · `claim_daily_streak` · `claim_emergency_chips` · `claim_low_chip_rescue` ·
`claim_winback_rescue` · `credit_purchase` · `update_mission_progress` · `update_leaderboard_elo` ·
`check_achievements`. **`submit_score` is the 15th, added by this migration.**

## `resolve-hand`, including a dropped seat

`supabase/functions/resolve-hand/index.ts:26` uses `SUPABASE_SERVICE_ROLE_KEY`; line 203 writes one
`hand_history` row **per seat, including any seat that dropped**; line 228 settles chips through
`record_hand_net`, which is gated. On production, with the fix live:

| caller | live `econ_bind_ok` |
|---|---|
| `service_role` (resolve-hand, incl. a dropped seat) | **true** |
| anon, no session | **false** |

## Production re-attacked with the raw anon key — all vectors refuse

```
record_hand_net  ->  {"ok": false, "net": 0, "reason": "identity_mismatch"}
record_reward    ->  {"ok": false, "reason": "identity_mismatch", "granted": 0}
submit_score     ->  {"ok": false, "reason": "identity_mismatch"}
earn_chips       ->  {"ok": false, "reason": "identity_mismatch", "chips_earned": 0}   (control)
```

And it wrote **nothing**: 0 leaderboard rows, 0 ledger rows, 0 bindings for the attack device.
`analytics_events` logged 4 × `refused_no_session`.

## ⚠️ THE COLD LAUNCH — the test that decides whether it is safe. It passes.

A brand-new device against the real production backend, signing in exactly as the app does
(`POST /auth/v1/signup`, no credentials → `is_anonymous: true`):

| step | result |
|---|---|
| anonymous sign-in | session issued, `is_anonymous: true` |
| `get_poker_shop` — the first economy call a fresh device makes | **balance 2,000** — the starting grant landed |
| `submit_score` after a hand | `{"ok": true, "total_chips": 2500}` |
| `record_hand_net` — a real hand's chips | `{"ok": true, "net": 150, "new_balance": 2723}` |
| `claim_daily_reward` | `{"success": true, "streak": 1, "chips_earned": 30}` |

**An anonymous player is not locked out.** All four gated calls succeed for a device that has never
been seen before. My test rows were then removed; production returned to 513 rows / gap 0 exactly.

## ⚠️ THE LIVE DEFINITION, READ BACK AFTER APPLYING — the step that was skipped last time

```
IF v_uid IS NULL THEN
IF auth.role() = 'service_role' THEN RETURN true; END IF;
```
and the tail of the live function:
```
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO analytics_events (...) VALUES ('econ_authz',
      jsonb_build_object('case','refused_exception','sqlstate',SQLSTATE,'sqlerrm',SQLERRM), ...);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN false;
```

| read back from `pg_get_functiondef` | |
|---|---|
| still fail-open on no session | **false** |
| still fail-open on `WHEN OTHERS` | **false** |
| `refused_no_session` marker present | **true** |
| `refused_exception` marker present | **true** |
| comment states no-session-not-anonymous | **true** |
| `submit_score` now calls `econ_bind_ok` | **true** |

One honest note: my first read-back query reported `still_fail_open_on_exception: true`. That was
**my own `ILIKE` pattern matching the words inside the explanatory comment** (`Was \`EXCEPTION WHEN
OTHERS THEN RETURN true\``), not the code. Reading the actual tail settled it. The probe was wrong,
not the function — and checking rather than trusting the first number is the point of this step.

## ⚠️ ONE THING THIS SURFACED, REPORTED NOT FIXED

**`submit_score` is an UNLEDGERED balance writer.** My cold-launch moved
`leaderboard.total_chips` 2000 → 2500 and wrote **no `chip_transactions` row**, so the gap went to
500 until I cleaned up. It is now gated, so only a caller with a session can do it — but it can
still move a balance without a ledger entry. That is the same class as the unledgered writers the
economy audits chased. Not changed here: it is outside "close the mint", and fixing it means
deciding whether `submit_score` should ledger or should stop writing balances at all.

## ⚠️ verify_jwt — restated, and confirmed untouched

`verify-purchase` is still `verify_jwt: true` on production. When PayPlus is wired the provider's
webhook cannot present a user JWT, so `verify_jwt` must come off — and **at that moment the payload
signature becomes the only gate on crediting chips**. Add and prove the signature FIRST; never
remove `verify_jwt` in the same change.

---

# 4 — THE TWO SMALL ONES

## The catch-all 404

**Before** — `vercel.json` ended with `{ "source": "/(.*)", "destination": "/index.html" }`, so
every unmatched path returned 200 with the app's HTML:

```
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' https://caps.ftable.co.il/definitely-missing-abc123.html
200 1902        <- the app's index.html, not a 404
```
`/landing`, `/Landing.html` and `/landing.htm` did the same. That trap twice made a stale or absent
file read as "deployed".

**After** — the catch-all is `"/((?!.*\\.).*)"`: any path containing a dot is excluded, so a request
for a FILE that does not exist falls through to Vercel's own 404.

**The SPA is not broken, and that is checked rather than asserted.** `tests/vercel-rewrites.test.ts`
runs the compiled regex against **31 real routes** (every one grepped out of the app's own router
calls, plus the tab routes) and **9 file paths**. 44 assertions, all green. Two measurements make it
safe by construction: **0 of the app's routes contain a dot**, and every shipped asset is a real
static file, which Vercel serves *before* rewrites are consulted.

⚠️ **The boundary, stated:** this exercises the same regex in the same engine Vercel compiles to,
but not Vercel's `path-to-regexp` wrapper. One command confirms it after the next web deploy:
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://caps.ftable.co.il/definitely-missing.html   # expect 404
curl -s -o /dev/null -w '%{http_code}\n' https://caps.ftable.co.il/game                      # expect 200
```

## FIVE-O — the copy and the preview now match what the theme paints

`constants/paintThemes.ts` `visual.fiveo` paints **surface `#1A1A2E` (navy)**, accent `#4FD6A8`,
boardGold `#c9a84c`. The picker showed a **`#5c0000` red** preview and said **"Red felt / Bold
action"**, tagged **"Arcade"**. FIVE-O has not been red for a long time.

| | was | now |
|---|---|---|
| preview box (`theme-pick`) | `#5c0000` red | `#1A1A2E` — the surface it paints |
| swatch `bg` (`settings`) | `#5c0000` red | `#1A1A2E` |
| tag | "Arcade" | "Modern" / "מודרני" |
| description | "Red felt / Bold action" | "Navy table / Mint accents" / "שולחן כחול כהה / הדגשים במנטה" |

Same class as the maroon-felt line corrected in `CLAUDE.md` — a description that contradicts the
product.

**And one correction to my own previous work.** Last sprint's gold pass used a blanket colour
replace in `app/theme-pick.tsx` which rewrote its own explanatory comment, leaving it claiming the
winner cue was `#4FD6A8` and that "FIVE-O renders NO #4FD6A8 anywhere". Both nonsense — `#FFD700`
is the cue, `#4FD6A8` is the mint that replaced it. The note is rewritten and says so.

---

# PRODUCTION — WHAT CHANGED AND WHAT DID NOT

**Changed, deliberately:** `econ_bind_ok` and `submit_score`, via one migration.

| verified after all work | |
|---|---|
| `iap_enabled` / `web_payments_enabled` | false / false — unchanged |
| `battle_pass_enabled` | false — unchanged, still unread by the client, entry still hidden |
| `econ_binding_enabled` | true — unchanged (the gate was already live and doing work) |
| `verify-purchase` `verify_jwt` | **true** — untouched |
| leaderboard rows / total chips | 513 / 1,032,910 |
| **ledger gap** | **0** |
| `device_identity` bindings | 6 — untouched, all real people |
| tables | 73 — no schema change |
| `schema_migrations` | 367 → **368** (this migration; nothing else) |
| my test rows left on production | **0** |
| winner cue, card sizes, the 83px arc, tie-tally arithmetic, `KILL_Board` | untouched |
| Hebrew removed | **none** — translate up, never down |
| hand-rank names | English in both languages, unchanged |
| merged to `main` / version bump / deploy | none / none / none |
