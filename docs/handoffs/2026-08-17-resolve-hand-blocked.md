# 2026-08-17 — `resolve_hand`: route 2 is blocked by one import line

**Nothing built, nothing deployed, no migration, no code changed.** I stopped at the first step,
because **"import the evaluator unchanged" is not currently possible** — and the reason is small,
specific, and fixable, but it needs your ruling because the fix touches a file on the do-not-touch
list.

## The blocker, traced

```
utils/handEvaluator.ts   imports { Card, Rank, RANKS, SUITS } from '../constants/gameConfig'
constants/gameConfig.ts  imports { THEME }        from './theme'
constants/theme.ts       imports { activePaint }  from './paintThemes'
constants/paintThemes.ts imports                  from 'react-native'   <-- and uses Dimensions
```

An Edge Function runs on Deno. **`import 'react-native'` fails there at module load**, so importing
`handEvaluator.ts` unchanged imports a module graph that cannot resolve. The evaluator itself is
clean — zero React Native references, zero `Dimensions`/`Platform` — it is the *chain* that is dirty.

What the evaluator actually needs from that chain is four things: the `Card` and `Rank` **types**,
and the `RANKS` and `SUITS` **const arrays**. Nothing themed, nothing platform-bound, nothing that
has any business dragging in a UI framework.

## Three ways out, and what each costs

**A. Move the four card primitives to a leaf module.** Create `constants/cards.ts` holding `Card`,
`Rank`, `RANKS`, `SUITS` with **no imports at all**, have `constants/gameConfig.ts` re-export them
so every existing consumer is untouched, and point `handEvaluator.ts`'s import line at the leaf.

- The algorithm is **not** touched. There is still exactly **one** implementation, which is the
  entire point of route 2.
- It does edit `utils/handEvaluator.ts` — one import line — and that file is on the do-not-touch
  list because it contains `evaluateOmahaHand`. **That is why I am asking rather than doing.**
- Everything else keeps working through the re-export; no consumer changes.

**B. Stub `react-native` for Deno** via an import map, so nothing in the app changes at all.

- Keeps every file literally untouched.
- Costs a stub whose drift is invisible, and pulls the whole theme graph — `paintThemes`,
  `homeThemes`, `cardThemes` — into a function that needs none of it. A fake module standing in for
  a real one, maintained by nobody, is the kind of thing this project has been removing.

**C. Abandon route 2 and reimplement in PL/pgSQL.** The option already rejected, for the reason that
still holds: it creates the second source of truth this stage exists to remove.

**My recommendation: A.** It is the smallest change that keeps one implementation, and the constraint
it brushes against — "import the evaluator unchanged" — is aimed at *no copy, no port, no
equivalent*. A moved import line is none of those; the evaluator's body is byte-identical and there
is still one of it. But it is your list, so it is your call.

## What I did not do, deliberately

No Edge Function, no `resolve_hand`, no equivalence harness, no client wiring, no gating of
`results.tsx`, no deletion of `p_full`. **Building any of it on top of an import that cannot resolve
would mean discovering this at deploy time instead of at design time**, and gating the client calls
before a server writer exists would leave multiplayer with no writer at all — the coupling I flagged
last run and which still holds.

`submit_placements` from the previous run is live and untouched.

## DB state — untouched this run

```
game_hands 0 · hand_history 151 · 11 public rooms · CJTK and QW7U still 'CAPS Bot'
bug_reports 250 · backup 649
```

Nothing created, deleted or migrated.

=== STRATEGIST HANDOFF — resolve_hand ===
BUILD: NOTHING BUILT. Stopped at step one.
  - Edge Function created? NO. imports handEvaluator.ts UNCHANGED? IMPOSSIBLE TODAY — that is the
    blocker: handEvaluator.ts imports { Card, Rank, RANKS, SUITS } from constants/gameConfig, which
    imports ./theme, which imports ./paintThemes, WHICH IMPORTS 'react-native' AND USES Dimensions.
    An Edge Function is Deno; that import fails at module load. The EVALUATOR is clean — zero
    react-native references, zero Dimensions/Platform — the CHAIN is dirty.
  - auto-fill / hand_history rows / chips via record_hand_net / idempotency: NOT BUILT.
  - results.tsx practice-only? NO — and deliberately not, since gating before a server writer exists
    leaves MP with none. p_full deleted? NO — nothing replaced it.
EQUIVALENCE HARNESS: not run — there is nothing to compare against yet.
COLD START: not measured — no function deployed.
PROOF 1-7: NOT RUN.
THE RULING I NEED — three ways out:
  A. MOVE THE FOUR CARD PRIMITIVES TO A LEAF MODULE. New constants/cards.ts holding Card, Rank,
     RANKS, SUITS with NO imports; gameConfig re-exports them so every existing consumer is
     untouched; handEvaluator's import line points at the leaf. THE ALGORITHM IS NOT TOUCHED and
     there is still EXACTLY ONE implementation — the whole point of route 2. But it edits
     utils/handEvaluator.ts (one import line), and that file is on the do-not-touch list because
     evaluateOmahaHand lives in it. THAT IS WHY I AM ASKING RATHER THAN DOING.
  B. STUB react-native FOR DENO via an import map. Nothing in the app changes at all. Costs a stub
     whose drift is invisible, and drags the whole theme graph (paintThemes, homeThemes, cardThemes)
     into a function that needs none of it.
  C. ABANDON ROUTE 2 for PL/pgSQL — already rejected, and the reason still holds: it creates the
     second source of truth this stage exists to remove.
  RECOMMENDATION: A. Smallest change that keeps one implementation. "Import the evaluator unchanged"
  is aimed at no copy, no port, no equivalent — a moved import line is none of those; the body stays
  byte-identical and there is still one of it. Your list, your call.
GUEST READY PATH: not reached.
STILL NOT DONE: practice untouched YES | equity local YES | phase0 on YES | engine in bundle YES |
  adjudication still client-side | submit_placements live and untouched from the previous run.
DB: untouched — game_hands 0, hand_history 151, 11 public rooms with CJTK and QW7U still 'CAPS Bot',
  bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: not run — no code changed. CI unchanged at fd08d22.
HANDOFF: file + vamos_handoffs slug 2026-08-17-resolve-hand-blocked | chars | code-point match? Y
WHAT I DID NOT CHECK: whether Deno's TypeScript loader accepts the rest of handEvaluator.ts once the
  chain is clean — the type-only imports and the const-assertion style should be fine, but I did not
  run it; whether any OTHER module the Edge Function would need drags in react-native the same way
  (gameLogic.ts, which holds evaluateAllBoards and calculateChipDeltas, is the obvious next one and
  I did not trace it); and what Supabase's Deno runtime does with a relative import that climbs out
  of supabase/functions/ into the app tree, which may itself need a bundling step.
=== END ===
