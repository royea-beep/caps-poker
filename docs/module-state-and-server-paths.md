# Module state that must be PUSHED is unsafe on any server path

**The rule, plainly:**

> A value that must be **pushed** into module state by the app's bootstrap can silently never
> arrive. A value that **fetches itself** and defaults safely cannot. Anything an Edge Function, an
> RPC, or any non-app runtime might read must be the second kind.

This is written down because we nearly paid for it, and because the failure is invisible: the code
bundles green, runs, and returns a plausible number that is wrong.

## What nearly shipped

`getCompleteBonusPercent(boardCount, fallback)` reads `_remoteBonusPctByBoards`, which is set only
by `setCompleteBonusPctByBoards` — called once from `app/_layout.tsx:489`, in a fire-and-forget
`useEffect` with a silent `catch`.

Server-side adjudication was one refactor away from importing that. Nothing on a server ever calls
the setter, so it would have returned the flat fallback of **50%** forever, against a live map of
`{"2":25,"3":50,"4":75}` — paying 50% where 25% was owed at a two-board table, on every hand, with
nothing on screen or in a log to say so.

That is why `utils/chipMath.ts` takes the percentage **as a parameter** and the Edge Function reads
`app_config` itself and refuses to run without it. A function handed its input cannot fall back.

The same bug had a second, quieter life on the client: `components/BoardArrangement.tsx` showed a
predicted COMPLETE bonus **before the hand**, and a failed fetch made it understate at 2P and
overstate at 4P. `utils/completeBonusPct.ts` replaced that with the self-fetching shape.

## The four instances, as of 2026-08-18

| where | value | source | shape |
|---|---|---|---|
| `constants/gameConfig.ts:8` | `_remoteBonusPctByBoards` | `complete_bonus_pct_by_boards` | **PUSHED** — set by `_layout.tsx:489` |
| `constants/gameConfig.ts:26` | `_remoteMpBoardRevealEnabled` | `mp_board_reveal_enabled` | **PUSHED** — set by `_layout.tsx` |
| `utils/iapEnabled.ts:14` | `_iapEnabled` | `iap_enabled` | self-fetching, defaults `false` |
| `utils/privateChannel.ts:60` | `_enforced` | `phase0_channel_authz_enforced` | self-fetching, defaults `true` |

**Only the first two are the dangerous shape.** `iapEnabled` and `privateChannel` pull their own
value and default to the safe side — IAP hidden, authz enforced — so a failed fetch degrades toward
safety rather than toward a confident wrong answer. `utils/serverAdjudication.ts` and
`utils/completeBonusPct.ts` follow that pattern deliberately.

**Neither of the two pushed instances is reachable from a server path today.** The Edge Function
reads `app_config` directly and imports only `chipMath`, `handEvaluator` and `cards`, none of which
touch `gameConfig`. The risk is a **future** server-side import of `gameConfig` — which is exactly
how this nearly shipped the first time.

## What to do when adding an Edge Function or an RPC-side module

1. **Do not import `constants/gameConfig.ts`** from anything that runs off-device. It pulls in
   `theme.ts` and the pushed module state above.
2. **Read config where the decision is made**, from `app_config`, and **refuse to run without it**
   rather than falling back to a plausible constant. A missing config should be a 500, not a number.
3. If a value must be shared with the client, **pass it as a parameter** (as `chipMath` does) or
   **return it in the response** (as `resolve_hand` returns `bonus_percent`).
4. If you add client-side config, use the **self-fetching, safe-default** shape — `iapEnabled.ts` is
   the shortest example.

## Not fixed, on purpose

The two pushed instances in `gameConfig.ts` are **left as they are**. They work correctly on the
client, where `_layout` does run, and changing them has a wider blast radius than the risk justifies
today. This document is the tripwire instead: the next person to reach for them from a server path
should find this first.
