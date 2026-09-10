# REPORTER AND BOARD 4 — 2026-09-08

**The reporter now says what it is and says when it loses something. Board 4 still scrolls, because
it cannot not — but the app now says so, and one tap gets you there.**

---

## §1 · THE BUG REPORTER — HONEST STILLS, NOT PRETEND VIDEO

### The decision, and why

**A burst of stills, named as stills.** Not video.

The capture path is `react-native-view-shot`'s `captureScreen` — a **still-frame API** — sampled
every 2000ms and capped at `MAX_FRAMES = 10` (`utils/screenRecorder.ts`). There is no encoder in
the app. Producing real video needs a native screen-recording module, which this file's own header
records as rejected because it requires a native build. Shipping one the week before a tester round
is not a change anyone should make. The brief said both were acceptable and pretending was not, so
the name changed to match the content.

### What changed

| | before | after |
|---|---|---|
| frames uploaded | **1** of up to 10 | **all** captured frames |
| upload budget | one 5s attempt | 8s, then one 12s retry, per frame |
| `report_type` | hardcoded `'video'` | **derived**: `'frames'` when frames arrived, else `'text'` |
| `has_video` | `frameCount > 0` | `false` — it has never been true in substance |
| loss when upload fails | **silent**; row filed, toast said "Report sent ✅" | note in `description`, and the toast says the capture did not upload |
| frame sequence | discarded | `metadata.frame_urls`, plus `frames_captured` / `frames_uploaded` / `attachment_complete` |
| temp files | last frame deleted, other nine left on disk | every frame deleted |

⚠️ **`video_url` KEEPS BEING WRITTEN, and that is deliberate.** However wrong the column's name is,
**four Edge Functions read it** — and two already know what it holds:
`analyze-bug-report/index.ts:234` and `retriage-pending/index.ts:195` both assign it straight into a
variable called `screenshotUrl`. It is the image the AI triage vision call and the Telegram/WhatsApp
photo are built from. Nulling it would blind triage, and **Edge Functions cannot be deployed from
this lane** (`verify_jwt` resets). It now carries the **representative** frame — the last one, the
screen as the tester left it — while the whole burst lives in `metadata.frame_urls`.

⚠️ **Renaming `report_type` was checked, not assumed.** Grep across the client, the scripts and all
14 Edge Functions returns **zero** comparisons or filters on `report_type`. Nothing branches on it.
`has_video` is likewise written by the client and read by nothing.

### ⚠️ A CORRECTION TO MY OWN PREVIOUS CLAIM

READ-THE-204 said nine of ten frames were lost because `stopRecording()`'s return is *"discarded by
a leading comma"* in `handleStop`. **That was wrong.** `handleStop` already received the entire
sequence from `getLastCrashScreenshots()`; the discarded value is a *duplicate* of the last frame,
and `utils/crashDetector.ts:53` legitimately uses that return, which is why its signature is
unchanged here. **The loss was at the upload**, where only `frames[length - 1]` was ever sent. Same
defect, wrong mechanism named.

### The audio path is untouched

27 rows carry a genuine `.m4a` and that is the one part of this pipeline that works. `uploadAudio`,
the recorder, the timeouts and the storage bucket are **byte-identical**. Only its *failure* is now
reported instead of swallowed.

### §1.5 · END TO END — **NOT COMPLETED, AND HERE IS WHY**

⚠️ **I could not file a real report from this container, and the row proves it rather than a log.**

The rig drove the built app to Settings, opened **Report a bug**, filled the form and pressed send.
The console then printed `TypeError: Failed to fetch` twice: **the browser in this container cannot
reach Supabase through the agent proxy** (the same limit that stopped the card probe reaching
`caps.ftable.co.il`, even though `curl` can). The rig's own log said "submitted".

**Reading the table is what settled it:** `bug_reports` is still **252 rows, newest still
2026-09-06, 0 rows matching the stamp.** Nothing arrived. ⚠️ *"Do not trust the 200"* earned its
place — the happy-path log was false, and only the row said so.

**And a second, harder limit sits behind that one.** There are **TWO writers** into `bug_reports`:

* `components/ReportBugButton.tsx` — the Settings entry. Text only, and it has always correctly
  said `report_type: 'text'`. **Unchanged by this sprint.** This is the one the rig can reach.
* `components/BugReporter.tsx` — the shake/FAB recorder, the media path, **the one this sprint
  changed**. `handleStart` returns early when `Platform.OS === 'web'` (`BugReporter.tsx:472`) and
  the capture API is native-only. **No browser can start it, on any host.**

So the media path's live proof **needs a device**, and is listed as a device-only tap. What IS
proven here: `tsc` clean, the full suite green, and
`utils/__tests__/attachment-note.test.ts` — 7 cases pinning the loss-note semantics, including the
exact shape of the 7 rows that carried `has_video` with a null url, and a defensive case.

---

## §2 · BOARD 4 — WHAT IT COST TO MEASURE PROPERLY

### ⚠️ THE FIRST PROBE SAID 0px OVERFLOW AND IT WAS WRONG

Version one of `tests/board-fit-probe.mjs` selected the scroller by *computed `overflow-y`* plus
"contains a BOARD label" — which the document element satisfies — and reported a clean **0px** in
all twelve cells, contradicting a measurement already taken by hand. **A scroller that is not
scrolling is not the scroller.** It now selects by *actual* overflow and takes the innermost box.
Believing the first green would have closed this sprint with nothing fixed.

### The real numbers, both engines

| viewport | boards | viewport / content | hidden |
|---|---:|---|---:|
| 320 × 568, 2P | 4 | 206 / 477 | **271px** |
| 320 × 568, 3P | 3 | 254 / 367 | **113px** |
| 393 × 852, 2P | 4 | 512 / 556 | **44px** |
| 320 4P · 393 3P · 393 4P | 2–3 | — | none |

READ-THE-204 found the 44px. **It is far worse at 320: 271px, more than half the boards zone.**

### ⚠️ SO: IT CANNOT BE FIXED WITHOUT CHANGING CARD SIZES — REPORTED, NOT DECIDED

The brief said to stop and report if that were the conclusion, and it is — **for the "no scrolling
at all" half.** 271px is not recoverable from spacing. The levers that could close it are
`_FIT_SAFETY = rs(24)` (added specifically to stop a measured BC3 board-3 overlap — removing it
re-opens that bug), the hand-zone gaps, and the card width. `useGameLayout` already searches card
width downward and **sets `boardsScroll = true` only when even the minimum does not fit**. The
system is not failing; it has already concluded what I just measured.

**Roye ruled the card face and card sizes stay. I am not going to overturn one of his decisions to
satisfy another.** The trade is his: keep the settled sizes and accept a scroll on the two densest
layouts, or reopen sizes.

### What WAS delivered — the brief's other half, "or so scrolling is obvious and costs no time"

A **"▼ N more boards below"** pill at the foot of the boards zone: it appears only where content is
genuinely hidden, names how many whole boards are still below, and **one tap pages down**.

⚠️ **Paint and scroll only.** No card geometry, no cell height, no change to the `boardsScroll`
classification. The pill is absolutely positioned inside a `pointerEvents="box-none"` row, so it
adds **zero height** — and the fit sweep proves it: **every overflow number is identical before and
after, in both engines.**

The count is derived from the rendered content height divided by the board count — this layout's own
per-board pitch, whatever the grid shape — never a literal (Iron Rule 3). It reads the **rendered
scroller** rather than recomputing the fit, because a second opinion on the fit could silently
disagree with the first.

### ⚠️ AND LOOKING AT IT CAUGHT A DEFECT THE MEASUREMENT PASSED

The first pill had `left: 0; right: 0` directly on the `Pressable`. Every assertion passed — gating
correct, tap scrolled, overflow unchanged — and the render showed it **stretched across the whole
board, covering board 4's cards**. An affordance hiding the thing it points at. Fixed with a
full-width transparent row so the pill hugs its text. **Iron Rule 10 earned its keep: the numbers
were green and the screen was wrong.**

### Proof

* `tests/board-fit-probe.mjs` — 3 board counts × {320, 393} × {chromium, webkit}. BEFORE control at
  `board-fit-BEFORE.json`, AFTER at `board-fit-AFTER.json`, **identical**.
* `tests/board-pill-probe.mjs` — pill present in **6 of 6** overflowing cells, absent in **6 of 6**
  that fit, and **every tap moved the scroller**. Two canaries: the run fails if the pill appears in
  every cell (decoration, not an affordance) or in none.

---

## §3 · THE TWO CARD.TSX CLAIMS, CORRECTED TO THE MEASUREMENT

**Comments only. Zero render or logic lines changed; `DOUBLE_CORNER_MIN_W` is still 54.**

The header and the constant both said the bottom-right index shows at **"3P/4P yes, 2P no"**.
Measured on the built app, counting painted glyphs:

| players | boards | card width | bottom-right index |
|---|---:|---:|---|
| 2P | 4 | 40px | none |
| 3P | 3 | 46px | **none** ← the claim was wrong |
| 4P | 2 | 64px | present on all 14 face-up cards |

3P cards are **46px at a 393pt viewport, under the file's own 54px gate.** Both places now say
**4P yes, 3P and 2P no**, and both now say the gate is on **width, not player count** — because the
width falls out of the boards layout and moves with the viewport.

⚠️ **The comment was changed to match the render, never the reverse.** Roye's ruling stands: the
card face is untouched.

---

## STILL OPEN

* **The media reporter has no live proof.** Native-only; needs one report filed from a device, then
  read back from the row: `report_type` `frames`, `has_video` false, `metadata.frame_urls` holding
  more than one url, and — with the network throttled — the `[attachment incomplete …]` line.
* **Board 4 still scrolls** at 320/2P (271px), 320/3P (113px) and 393/2P (44px). Roye's call.
* Carried forward: the deploy `paths-ignore` unproven on a live trigger · the Vercel bill unread ·
  `/lobby` promises auto-start with 0 rooms ever `playing` · `/club/DEMO` renders for any code ·
  `submit_score` unledgered · the App Store listing blank and the age rating unanswered.
