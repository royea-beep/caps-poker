# 2026-08-17 — Option A is done. The next wall is Deno's resolver, and it is measured.

**Option A is built, verified and shipped (`3f2b9b5`).** `resolve_hand` is **not** built: a probe
Edge Function proved that importing the app's evaluator needs one more thing than the leaf module,
and it is a repo-wide convention rather than a one-line change. **Two deploy attempts, two exact
errors, reported below.**

## Option A — done, and the risk you named is the one I checked

`constants/cards.ts` holds `Card`, `Rank`, `RANKS`, `SUITS`.

**It imports nothing** — verified mechanically, not by eye:

```
import statements = 0      require( ) = 0
```

**The re-export is transparent.** `constants/gameConfig.ts` re-exports all four (`export { SUITS,
RANKS } from './cards'` plus `export type { Suit, Rank, Card }`). **89 files import from
`gameConfig`** and not one of them changed — `tsc` exit 0 is the proof that every one of those
consumers still resolves the same symbols with the same types.

**`handEvaluator.ts`'s body is byte-identical.** Only the import line moved, to `../constants/cards`.
There is still exactly one definition of each symbol; this is a move, not a redefinition.

## The next wall, measured twice

A probe Edge Function was deployed whose only job was to answer one question: **can a Supabase Edge
Function import an app module that itself uses an extensionless relative import across
directories?** That is how `handEvaluator.ts` is written (`'../constants/cards'`), and how every
file in this repo is written.

**Attempt 1 — the plain shape.** Failed to bundle:

```
Module not found ".../constants/cards". Maybe add a '.ts' extension
    at utils/probe.ts:2:30
```

**Attempt 2 — solve it in the function's own config**, with a `deno.json` carrying
`"unstable": ["sloppy-imports"]` and an import-map entry. It **bundled and deployed** — and then:

```
{"code": "BOOT_ERROR", "message": "Function failed to start (please check logs)"}
```

So the import map got it past the bundler without actually resolving it at runtime. **Neither route
works today.**

### What that leaves

1. **Give the evaluator's import a `.ts` extension.** One character-level change, but TypeScript
   rejects `.ts` specifiers unless `allowImportingTsExtensions` is enabled in `tsconfig.json` — so
   it is a **project-wide compiler setting**, not a local edit, and it invites the same extension on
   every future import.
2. **A deploy-time prepare step**: copy `handEvaluator.ts` and `cards.ts` into the function's own
   directory at build time, rewriting the extensionless import as it goes. **The app stays untouched
   and the function still runs the same source** — the property route 2 was chosen for. Cost: a
   build step in CI, and a copy that is generated rather than authored (so it must be generated
   every deploy, never committed, or it becomes the second source of truth by the back door).
3. **Reconsider the route.** I do not recommend it — the reasoning that rejected PL/pgSQL has not
   changed.

**My recommendation: 2.** It keeps the single implementation, keeps the app's conventions, and puts
the awkwardness in a build script where it is visible, rather than in a compiler flag that quietly
changes how every future import may be written.

**This is the second time this stage has needed a ruling before code**, and both times the blocker
was in the seam rather than the logic. I would rather say that plainly than keep discovering it.

## Litter I created and could not remove

The probe deployed an Edge Function named **`resolver-probe`** which boot-errors. My tooling has no
delete for Edge Functions, so it is still listed. It is inert — it fails to start, so it cannot run
— but it should be deleted from the dashboard.

## Not built, and why not

`resolve_hand`, the equivalence harness, cold-start timings, the seven proof items, the practice-only
gating of `results.tsx`, and deleting `p_full` — **none of it.** Every one of them sits behind an
import that does not resolve, and gating the client calls before a server writer exists would leave
multiplayer with no writer at all.

## DB state

```
game_hands 0 · hand_history 151 · 11 public rooms, CJTK and QW7U still 'CAPS Bot', 54YU untouched
bug_reports 250 · backup 649 · phase0_channel_authz_enforced = true
```

Nothing created, deleted or migrated. `submit_placements` from the previous run is live and
untouched.

=== STRATEGIST HANDOFF — resolve_hand ===
OPTION A: DONE AND SHIPPED (3f2b9b5).
  - constants/cards.ts created, imports NOTHING? YES — verified mechanically: 0 import statements,
    0 require() calls, counted rather than eyeballed.
  - re-export transparent, no consumer changed? YES — gameConfig re-exports all four
    (export { SUITS, RANKS } + export type { Suit, Rank, Card }); 89 files import from gameConfig
    and none changed; tsc exit 0 proves every one still resolves the same symbols with the same
    types.
  - handEvaluator.ts body byte-identical, only the import line moved? YES.
BUILD: NOT DONE. A probe Edge Function measured why.
  - Edge Function: a throwaway `resolver-probe`, whose only job was to answer whether a function can
    import an app module that uses an EXTENSIONLESS relative import across directories — the shape
    handEvaluator.ts and every file in this repo uses.
  - imports the evaluator successfully in Deno? NO, TWICE:
      ATTEMPT 1 (plain): failed to BUNDLE —
        Module not found ".../constants/cards". Maybe add a '.ts' extension  (at utils/probe.ts:2:30)
      ATTEMPT 2 (deno.json with "unstable": ["sloppy-imports"] + an import-map entry): BUNDLED and
        deployed, then {"code":"BOOT_ERROR","message":"Function failed to start"} — the import map
        got it past the bundler without resolving it at runtime.
  - everything else (auto-fill, hand_history rows, chips, idempotency, results.tsx gating, p_full):
    NOT BUILT — all of it sits behind an import that does not resolve.
EQUIVALENCE: not run. COLD START: not measured. PROOF 1-7: NOT RUN.
THE RULING I NEED — three ways past the resolver:
  1. GIVE THE IMPORT A .ts EXTENSION. TypeScript rejects .ts specifiers unless
     allowImportingTsExtensions is set in tsconfig — a PROJECT-WIDE compiler setting, not a local
     edit, and it invites the same extension on every future import.
  2. A DEPLOY-TIME PREPARE STEP: copy handEvaluator.ts and cards.ts into the function directory at
     build time, rewriting the extensionless import as it goes. The APP STAYS UNTOUCHED and the
     function still runs THE SAME SOURCE — the property route 2 exists for. Cost: a CI build step,
     and a generated copy that must be regenerated every deploy and never committed, or it becomes
     the second source of truth by the back door.
  3. RECONSIDER THE ROUTE — not recommended; the reasoning that rejected PL/pgSQL is unchanged.
  RECOMMENDATION: 2. Keeps one implementation, keeps the app's conventions, and puts the awkwardness
  in a visible build script rather than a compiler flag that quietly changes how every future import
  may be written.
  NOTE: this is the SECOND ruling this stage has needed before code, and both blockers were in the
  seam rather than the logic. Saying so plainly beats rediscovering it.
LITTER: the probe deployed an Edge Function named `resolver-probe` that BOOT-ERRORS. My tooling has
  no delete for Edge Functions — it is inert (it cannot start, so it cannot run) but it should be
  deleted from the dashboard.
GUEST READY PATH: not reached.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | submit_placements live and untouched.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot'
  and 54YU untouched, bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: exit code 0 — and it is the load-bearing check this run, since it is what proves the re-export
  is transparent across all 89 consumers. CI is the verdict on 3f2b9b5.
HANDOFF: file + vamos_handoffs slug 2026-08-17-option-a-and-the-resolver | chars | code-point? Y
WHAT I DID NOT CHECK: whether Metro and jest resolve a `.ts` import specifier as happily as tsc
  would under allowImportingTsExtensions — option 1's real cost is unmeasured; whether gameLogic.ts
  (evaluateAllBoards, calculateChipDeltas) has a clean chain once cards.ts exists, which the Edge
  Function will also need and which I did not trace; whether the re-export survives Metro's
  production bundling as cleanly as it survives tsc, since only the type layer was proven; and
  whether anything imports SUITS/RANKS from a THIRD place I did not find.
=== END ===
