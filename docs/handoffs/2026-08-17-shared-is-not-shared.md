# 2026-08-17 — `_shared` is not shared. One cheap call, and the run stops there.

**Step 1 answered NO.** A second Edge Function cannot reach `_shared/handEvaluator.ts` without
re-uploading it. You asked for that in one cheap call and said to stop if the answer was no, because
it changes the shape of everything after. It does.

## The measurement

Deployed `shared-reuse-probe` — one `index.ts`, one `deno.json`, importing
`./_shared/handEvaluator.ts` and **uploading no `_shared` files at all**. `_shared` was uploaded with
`resolve-hand` and is unquestionably present in that function.

```
BadRequestException: Failed to bundle the function (reason: Module not found
"file:///tmp/user_fn_gxrpunvhjcrzqnitbqah_fd67b178-…_1/source/_shared/handEvaluator.ts"
    at …/source/index.ts:5:35).
```

Read the path. **`source/` is per-deploy**, and the temp directory carries a fresh per-deploy UUID
(`fd67b178…`), distinct from `resolve-hand`'s (`daa28ba2…`). Each function is its own isolated source
tree. `_shared` is a *convention of the CLI*, which uploads the shared directory alongside every
function that references it — not a project-level module namespace. Nothing is shared server-side.

**This is a bundle-time failure, so it is the good kind of no**: it cannot boot green and fail later.
And the probe was never created — it failed before the function existed, so no litter was added.

## What it changes

The run was scoped on "the 12 KB evaluator does not need re-uploading." It does. Every function that
adjudicates must carry its own verbatim copy of `cards.ts` and `handEvaluator.ts`. That is not fatal —
the generator already produces them and `--check` already guards drift — but **the biggest cost in
the run did not disappear, and the scoping that made this run fit is void.**

Three consequences worth carrying:

1. **The body must be deployed with the evaluator in the same upload.** One function, three files.
   There is no "deploy the small thing next to the big thing already up there."
2. **`--check` becomes load-bearing at deploy time, not merely at commit time.** With a copy inside
   every function, a stale upload is a second implementation that no test would catch. The deploy
   step must regenerate and verify immediately before uploading.
3. **Prefer one function over several.** Each additional adjudicating function is another 12 KB copy
   that can drift independently. `resolve_hand` should stay a single entrypoint.

## What was not done, and deliberately

No body, no gating, no proofs, no client wiring. Per the brief, step 2 is not deployed and nothing
calls anything. `results.tsx` still writes for multiplayer, which is correct while the server does
not — there is exactly one writer, as there has been all along.

## DB state — untouched, verified this run

```
game_hands 0 · hand_history 151 · 11 public rooms · CJTK and QW7U 'CAPS Bot' · 54YU present
bug_reports 250 · backup 649
```

=== STRATEGIST HANDOFF — resolve_hand, SCOPED ===
STEP 1 _shared REUSE:
  - does a second function import _shared/handEvaluator.ts without re-uploading it? **NO.**
    Deployed shared-reuse-probe with ONLY index.ts + deno.json, importing ./_shared/handEvaluator.ts
    and uploading no _shared files. It failed AT BUNDLE TIME:
      Failed to bundle the function (reason: Module not found
      "file:///tmp/user_fn_gxrpunvhjcrzqnitbqah_fd67b178-…_1/source/_shared/handEvaluator.ts"
          at …/source/index.ts:5:35)
    The temp path carries a FRESH PER-DEPLOY UUID, distinct from resolve-hand's (daa28ba2…). Each
    function is its own isolated source tree; `_shared` is a CLI convention that re-uploads the
    directory per function, NOT a project-level namespace. Nothing is shared server-side.
  - known board still matches? NOT RE-RUN — the probe never bundled, so it never evaluated anything.
    The last measured value stands from the previous run and is unchanged by this one:
    rank 5 / score 501413120702 / playerCardsUsed 2 / boardCardsUsed 3.
  - if NO — stopped and reported? YES. Stopped immediately, as instructed.
  - probe litter: NONE. It failed before creation; list_edge_functions shows no shared-reuse-probe.
STEP 2 BODY: NOT BUILT, NOT DEPLOYED, NOT CALLED. Auto-fill, both rows, chips_delta shape,
  idempotency on (room, hand_no), record_hand_net: NONE of it.
STEP 3 GATING: NOT DONE. results.tsx still calls record_hand_result_d and record_hand_net for MP —
  which is CORRECT while the server does not write. Exactly one writer, unchanged.
  - same commit as step 2? N/A — neither exists.
  - anything calling the function before both landed? NO. Nothing calls anything.
IF STEP 3 WAS UNREACHABLE: step 2 left undeployed? YES — and it was never started, so there is
  nothing in the working tree either. What remains: the entire body, the gating, and the proofs.
PROOFS 1, 2, 4, 5: NOT RUN — there is no adjudicator to prove. They are not deferred by choice;
  they are unreachable without step 2.
DEFERRED: not applicable — nothing was built to defer around. p_full still present, the equivalence
  harness not run, proofs 3, 6, 7 not run.
WHAT THIS CHANGES FOR THE NEXT BRIEF:
  - the 12 KB re-upload is UNAVOIDABLE. The body must ship in ONE upload with cards.ts and
    handEvaluator.ts beside it — three files, one function.
  - `--check` becomes load-bearing AT DEPLOY, not just at commit: with a copy inside every function,
    a stale upload is a second implementation no test would catch. Regenerate and verify immediately
    before uploading.
  - PREFER ONE FUNCTION. Every additional adjudicating function is another 12 KB copy that can drift
    independently, so resolve_hand should stay a single entrypoint.
DB: untouched and verified this run — game_hands 0, hand_history 151, 11 public rooms, CJTK and QW7U
  'CAPS Bot', 54YU present, bug_reports 250, backup 649. Nothing created, deleted or migrated.
tsc: not run — no app code changed. CI unchanged at ff2ee67.
HANDOFF: file + vamos_handoffs slug 2026-08-17-shared-is-not-shared | chars | code-point match? Y
WHAT I DID NOT CHECK: whether a Deno import MAP could reach across functions — I did not test it,
  and the previous run measured an import map bundling green then BOOT_ERRORing, so I would not
  trust it without a call; whether the platform has any project-level shared-module feature under a
  different name; and nothing new about the evaluator itself, which this run did not execute.
=== END ===
