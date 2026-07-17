# VAMOS — CAPS S76-BOARD — PIN STAGE ONLY

**Date:** 2026-07-17
**Base:** `main` @ `205b799` (verify before starting)
**Branch:** `feat/board-pin`
**Type:** Data-model change. ZERO visual change. ZERO routing.

---

## 0. The one-line summary

Add the Board's colour vocabulary to the theme data model, pinned so that
`classic` and `fiveo` both equal **exactly today's static value**. Author the
`streetStencil` values from the N8 tokens. **Do not change a single Board read.**

If you finish the pin and stop, the app is byte-identical. That is the intended
end state of this batch. Pins-only is a valid, safe stop.

---

## 1. Why this batch exists (read this, it prevents the failure mode)

`components/Board.tsx` paints from ~45 static colour reads (`COLORS.*`,
`OBSIDIAN.*`, and raw hex/rgba literals) inside **module-scope StyleSheets**.
Those freeze at import. They cannot be repainted at runtime.

The obvious move — "route Board's colours to the theme" — is one commit that both
(a) invents ~20 new theme keys and (b) rewires ~45 reads. If any single key's
pinned value is wrong, the Board silently changes colour in production, and the
diff is too large to bisect by eye.

So we split it:

- **THIS batch (pin):** the keys exist and hold today's values. Nothing reads them.
  Impossible to change a pixel — the new keys have no consumers.
- **NEXT batch (route):** flip reads to the pinned keys, one surface at a time.
  Each flip is provably a no-op because the key already equals the value it replaces.

**A half-routed Board is the only dangerous outcome here.** Do not start routing.

---

## 2. Hard rules (non-negotiable)

1. **PAINT ONLY.** Every value you touch is a colour. No geometry — no size,
   spacing, radius, border *width*, position, flex, font size or weight. If a
   token's value is a number, you are in the wrong place.
2. **Zero reads routed.** `components/Board.tsx` must be **untouched** by this
   batch. Do not edit it. Do not "just do the easy ones."
3. **Board keeps exactly its current 7 shared values.** No Reanimated
   `useSharedValue` added, removed, or retyped. Geometry is frozen.
4. **`BoardArrangement.tsx` is OUT OF SCOPE.** It is its own increment. Do not
   touch it, do not pin its keys.
5. **`felt` stays `OBSIDIAN.*`.** Not re-pointed, not re-pinned, not renamed.
6. **Pinning is a LOOKUP, not a discovery.** Every value you need already exists
   in `constants/paintThemes.ts` (`currentPaint`, authored in S75). Find the
   value there or in the Board's own literal. Never invent, never eyeball,
   never "approximately".
7. **No refactors, no cleanups, no renames** of anything you pass on the way.

---

## 3. Scope — the three files

| File | Change |
|---|---|
| `constants/paintThemes.ts` | Add the new keys to `VisualPaint` interface + `currentPaint.visual.classic` + `currentPaint.visual.fiveo` |
| `constants/visualThemes.ts` | Add the same keys to `ThemeTokens` + author them on `VISUAL_THEMES.streetStencil` |
| `constants/__tests__/paintThemes.fidelity.test.ts` | Update the key-count assertion + add per-key fidelity assertions |

Nothing else. Not Board.tsx. Not settings.tsx. Not the pickers.

---

## 4. Step 1 — Enumerate (deterministic, do this first)

Grep `components/Board.tsx` for every colour read:

```
COLORS\.|OBSIDIAN\.|#[0-9a-fA-F]{3,8}|rgba?\(
```

For each hit, record: **line · current expression · resolved value · intent**
("what is this painting?" — e.g. `communitySeparator background`, `slot dashed
border`, `auto-place chip text`).

Then dedupe **by intent, not by value**. Two reads that happen to share a hex
today but paint different things (a border vs a glow) are **two keys**. This is
the same trap that forced `cardGlow` to be split out in Commit 1a — do not
re-create it.

Exclude from the key list:
- Line 520 `boardAccent` — comes from `PRD.board.accent` / `BOARD_COLORS`
  (per-board identity, its own system). Leave alone.
- Anything already routed to `theme.*` (lines 420/421/496/497 read
  `theme.accent` today). Already themed.
- `winColor` / `loseColor` semantics — readability-critical, explicitly excluded
  from N8 theming (see the `VISUAL_THEMES.streetStencil` comment).

Post the enumerated table in your report **before** you write any code.

---

## 5. Step 2 — The reuse map (audit ruling — apply as given)

Three of the Board's reads are **already value-identical on both `classic` and
`fiveo`** to an existing `ThemeTokens` key. Reuse the existing key; **do NOT mint
a new one** for these:

| Board read | Value (identical on classic AND fiveo) | Reuse existing key |
|---|---|---|
| `COLORS.background` | `#0a0a0a` | `theme.background` |
| `COLORS.mint` / `OBSIDIAN.mint` | `#4FD6A8` | `theme.accent` |
| `COLORS.boardBorder` | `rgba(79,214,168,0.45)` | `theme.boardBorder` |

Everything else that survives Step 4 is a **new key, pinned classic = fiveo =
today's static value**.

Expected magnitude: **~23 keys total ≈ 3 reuses + ~20 new.** If your count lands
far from ~20 new, stop and report — do not force it to match, and do not pad it
to match. The number is a smoke alarm, not a target.

---

## 6. Step 3 — The two collision traps (WILL bite you)

`theme.*` and `COLORS.*` share names with **different values**. When you pin a
Board read that currently uses `COLORS.x`, the pinned value is the **`COLORS`
value**, never the `theme` value that happens to share the name:

| Name | `theme.*` (ThemeTokens) | `COLORS.*` (gameConfig) | 
|---|---|---|
| `textSecondary` | `#4FD6A8` (mint) | `#9aa19b` (grey) |
| `textPrimary` | `#ffffff` (fiveo) | `#f0ead6` |

So a Board read of `COLORS.textSecondary` (grey) must **NOT** be pinned to or
named after `theme.textSecondary` (mint). Give it a new, intent-named key
(e.g. `boardLabelMuted`) pinned to `#9aa19b`. Naming a key after the token it
replaces is how a grey label silently turns mint at routing time.

**Name keys by INTENT, prefixed `board*`.** Not by the token they came from.

---

## 7. Step 4 — Author `streetStencil`

`VISUAL_THEMES` is `Record<VisualTheme, ThemeTokens>`, so every key you add to
`ThemeTokens` is **required** on `streetStencil` — `tsc` enforces completeness.
This is a feature: it makes it impossible to half-author the theme.

Source every `streetStencil` value **from the paint layer**
(`streetStencilPaint.colors.*` / `.obsidian.*`), matching the existing style in
`constants/visualThemes.ts` lines 53–78. Do not hardcode N8 hexes into
`visualThemes.ts` — paintThemes is the DATA layer, visualThemes the DELIVERY
layer (S76 Option 2 ruling).

If an N8 value for some board key genuinely does not exist yet: inherit the
`classic` value and mark it `// TODO(S77): N8 value pending`. Inheriting is
safe (streetStencil is structurally unselectable). Guessing is not.

---

## 8. Step 5 — Tests

`constants/__tests__/paintThemes.fidelity.test.ts`:

1. **Line ~37** asserts `visual = 2 themes x 16 keys = 32`. This WILL fail.
   Update the count and the `it(...)` title to the new number. Update the
   240-value header comment (line ~4) and the key-count comment in
   `PaintTokens` (lines ~96–97) to match.
2. **Add one fidelity assertion per new key**, in the existing style, proving
   `classic === fiveo === <the literal that is in Board.tsx today>`. Write the
   expected value as a **literal**, never as a reference to the source token —
   a test that reads `COLORS.x` on both sides proves nothing.

Lines ~320–321 (`VISUAL_THEMES.classic` toEqual spread) should keep passing
untouched. If they fail, you changed something you should not have.

---

## 9. Definition of done

- [ ] `npx tsc --noEmit` → **0 errors**
- [ ] `npm test` → **all green** (2,535 baseline + your new assertions)
- [ ] `git diff --stat` touches **exactly 3 files** (the ones in §3)
- [ ] `git diff components/Board.tsx` → **empty**
- [ ] `git diff components/BoardArrangement.tsx` → **empty**
- [ ] Every new key is a colour (no numbers)
- [ ] Every new key: `classic === fiveo === today's literal`
- [ ] `npm run visual-qa` → green (proves zero visual change)

---

## 10. Report back with

1. The **enumeration table** from §4 (line · expression · value · intent).
2. The **final key list**: name → classic/fiveo pinned value → streetStencil value.
3. Which reads you **reused** vs **minted new**, and any you **excluded** + why.
4. Anything that **surprised** you or did not match this prompt. Say it plainly —
   a mismatch means my audit was wrong, and I need to know before the routing batch.
5. `tsc` / `npm test` / `visual-qa` raw output.

**Do NOT** merge, push, or open a PR. Branch + commit only. Roye verifies before merge.

---

## 11. If you get stuck

Stop and report. Do not improvise a key value, do not route "just one read to
test it", do not touch Board.tsx to "verify the pin works". The pin is verified
by the tests, not by the screen. An incomplete pin is safe; an improvised one is not.
