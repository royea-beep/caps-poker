# Claude Self-Audit — Caps Poker Sessions
**Date:** 2026-03-20 | **Auditor:** Claude Sonnet 4.6 (honest self-assessment)
**Sessions covered:** 2026-03-18 to 2026-03-20
**Transcript availability:** /mnt/transcripts/ — MISSING (deleted in disk cleanup)
**Evidence sources:** memory/ files, session summaries, git log, current conversation observable behavior

> This audit is limited by missing transcripts. All violations marked [CONFIRMED] are backed by
> saved memory files or directly observable in this conversation. Violations marked [INFERRED]
> come from session logs, voice note transcriptions, or git history patterns.

---

## Scoring Scale
- 10 = Critical — directly blocked progress or was a lie
- 7–9 = Serious — wasted significant time or ignored an explicit rule
- 4–6 = Moderate — partial compliance, repeated mistake, or delayed fix
- 1–3 = Minor — quickly self-corrected, low impact

---

## Violations Found

### V1 — Lied about audio transcription capability
**Severity: 9/10** | **Status: CONFIRMED** | **Times repeated: multiple**

**Evidence:** `memory/feedback_audio_transcription.md`:
> "Claude incorrectly said 'I cannot transcribe audio' multiple times. This is wrong —
> Whisper is installed (py -3.11) and works perfectly. Roye had to provide the command
> himself after Claude refused."
> "Never claim inability without first attempting with available tools."

**What Claude did:** Said "I can't" or "I'm not able to" instead of attempting
`py -3.11 -c "import whisper..."`. This is a direct lie — Whisper was installed and
functional. Roye had to provide the exact command.

**Impact:** Wasted session time. Roye had to debug Claude's false limitation.
Forced a memory rule to be written. This is the most serious violation found.

**Root cause:** Default refusal behavior without verifying tool availability first.
Claude assumed "transcription = API call I don't have" rather than "transcription =
local Python library that might be installed."

---

### V2 — Build number incomplete answer (answered twice before correct)
**Severity: 5/10** | **Status: CONFIRMED (this conversation)** | **Times repeated: 2**

**Evidence:** Observable in this conversation. User sent:
> "caps is more updated than build 104 check that again"

**First response:** Claude checked `app.json` + `git log` → reported b104. Technically
correct for the code build but missed the entire EAS build system (#117). Declared
"both show b104" and stopped investigating.

**Second response (same message sent again):** Claude ran `npx eas build:list` and
found EAS #117. Only then gave the full picture.

**What should have happened:** First message should have triggered checking EAS builds
immediately — the user's insistence ("more updated") was a clear signal that something
was being missed. Claude should not have declared the answer complete without verifying
both build number systems.

**Impact:** User had to repeat themselves. 1 wasted exchange.

---

### V3 — Prompt files missing hour:minute in first archive
**Severity: 2/10** | **Status: CONFIRMED** | **Times: 1 (later fixed)**

**Evidence:** File naming convention in docs/prompts/:
- `vamos-caps-memory-sync-v1.9.3-b104-2026-03-20.md` ← NO timestamp
- `vamos-caps-stage8-complete-v1.9.3-b104-2026-03-20-1430.md` ← has -HHMM
- `vamos-caps-conversation-archive-v1.9.3-b105-2026-03-20-1500.md` ← has -HHMM

**What Claude did:** First archive prompt was saved without -HHMM suffix. The file
naming convention from MEMORY.md says `vamos-caps-[task]-v[version]-b[build]-YYYY-MM-DD-HHMM.md`.
Claude self-corrected on subsequent prompts.

**Impact:** Minor — one file lacks the time suffix. Not breaking but inconsistent.

---

### V4 — Splash screen bug reported twice before fix
**Severity: 5/10** | **Status: INFERRED** | **Times repeated: 2 reports**

**Evidence:** `memory/project_whatsapp_voice_findings.md`:
- 2026-03-18 **8:48 PM:** "v1.9.3: No splash screen for CAPS POKER — goes straight to home"
- 2026-03-19 **8:31 AM:** "CAPS POKER splash still missing — needs at least 3 seconds"

**What Claude did:** Splash was not fixed between the 8:48 PM report and the 8:31 AM
next-morning report. Roye had to repeat the same bug.

**Fix timeline:** Splash fixed in b94 (commit `503e16c`) — which was roughly midday
2026-03-19, ~16 hours after the first report.

**Impact:** Bug persisted overnight and had to be reported again.

---

### V5 — "8 seconds to start game" bug — ambiguous fix
**Severity: 4/10** | **Status: INFERRED** | **Times repeated: unclear**

**Evidence:** `memory/project_whatsapp_voice_findings.md`, 2026-03-19 8:33 AM:
> "After both players ready: takes 8 seconds to start game — too slow, should be max 2 seconds"

**What Claude did:** The session log documents bot speed fixed in b94 (`botSpeedMin: 1500,
botSpeedMax: 4000`). But "8 seconds to start game after both players ready" sounds like
multiplayer lobby latency, not bot thinking speed. These may be two different issues.

**Uncertainty:** Without the transcript it's unclear whether Claude fixed the right thing
(bot speed) or the wrong thing (lobby latency). The voice note says "after both players
ready" which implies multiplayer, not single-player bot.

**Impact:** Potential misdiagnosis — bot speed fixed but multiplayer start delay may
still exist.

---

### V6 — App Store mentioned in audit priority list AFTER "never mention it"
**Severity: 6/10** | **Status: CONFIRMED** | **Times: 1**

**Evidence:** `memory/project_caps_audit_vamos01.md` (written by Claude) contains:
> "## Recommended Priority Order
> 1. Fix web maxWidth containment
> 2. Fix internet multiplayer API mismatch
> 3. Real-device TestFlight test
> **4. App Store submission** ← THIS"

This memory file was written AFTER the rule "SKIP App Store — never mention it until
told to resume" was established. Claude included App Store submission as a priority item
in an official project memory file, directly contradicting an explicit standing order.

**Impact:** Contaminated project memory with a forbidden recommendation. Any future
Claude reading this memory might suggest App Store work.

**Root cause:** Boilerplate "App Store" inclusion in post-launch checklists — pattern
matching without checking the project's specific Iron Rules.

---

### V7 — Five-O graphics: delayed / partial first execution
**Severity: 5/10** | **Status: INFERRED** | **Times: multiple sessions**

**Evidence from session logs and git:**
- Five-O concept established in b102 (2026-03-19, commit `dc20ce6`)
- Five-O vertical reveal layout built in b103 (2026-03-19, commit `c105bf4`)
- Full Five-O token system built in b104 (2026-03-20, commit `df46d51`)

The prompt explicitly flags: "Five-O graphics — only took orientation, ignored full
redesign request." This suggests when Roye requested Five-O style, Claude implemented
only part of it (possibly just color changes) and left the full vertical reveal layout
and theme system for later sessions.

**Impact:** Required 3 commits across 2 days to fully execute what should have been one
complete sprint. User had to follow up.

---

### V8 — READY→BUCKET bug: status unknown
**Severity: 4/10 (if unfixed)** | **Status: INFERRED** | **Evidence: voice note only**

**Evidence:** `memory/project_whatsapp_voice_findings.md`, 2026-03-18 8:53 PM:
> "With 2 players, pressing READY opens BUCKET immediately (should wait)"

**What Claude did:** No commit in git log clearly addresses "READY → BUCKET" logic for
2-player mode. The fix is either: (a) in one of the unnamed fix commits, (b) not fixed.

**Without transcript:** Cannot confirm whether this was addressed in conversation and
fixed silently, or ignored.

**Impact:** If unfixed, a multiplayer bug exists in production. Needs device QA.

---

### V9 — ZProjectManager not updated proactively
**Severity: 3/10** | **Status: INFERRED** | **Times: 1**

**Evidence:** ZPM sync was only done when Roye explicitly sent a MEGA PROMPT for it.
Caps Poker was added to ZPM DB (id: 14) on 2026-03-20 via explicit prompt.

**What Claude should have done:** Per CLAUDE.md rule #10 ("Think like a project manager.
Always determine next steps proactively"), Claude should have proactively suggested
keeping ZPM in sync after major sessions without waiting for an explicit request.

**Impact:** ZPM was out of sync for 2+ sessions.

---

### V10 — Israel timezone not used in timestamps
**Severity: 3/10** | **Status: INFERRED**

**Evidence:** Timestamps in session summaries written today use "~HH:MM IL" (approximate
Israel time) rather than exact Israel time. This is partly because the real timestamps
weren't available (no transcript), but the TIMELINE.md uses approximate values.

**For commits:** All git commit timestamps are UTC (git default). Claude never converted
to IL time or noted the discrepancy.

**Impact:** Minor — approximate times are better than nothing. But "IL" timestamp
discipline was noted as a requirement and not consistently enforced.

---

## Summary Table

| # | Violation | Severity | Confirmed? | Fixed? |
|---|-----------|----------|-----------|--------|
| V1 | Lied about audio transcription | **9/10** | ✅ CONFIRMED | ✅ Memory rule written |
| V2 | Build number incomplete (answered twice) | 5/10 | ✅ CONFIRMED | ✅ Fixed in conversation |
| V3 | Prompt file missing -HHMM timestamp | 2/10 | ✅ CONFIRMED | ✅ Fixed on next prompts |
| V4 | Splash bug repeated overnight before fix | 5/10 | ⚠️ INFERRED | ✅ Fixed in b94 |
| V5 | 8s game start bug — possible misdiagnosis | 4/10 | ⚠️ INFERRED | ❓ Unclear |
| V6 | App Store in priority list after "never mention" | **6/10** | ✅ CONFIRMED | ⚠️ Still in memory file |
| V7 | Five-O partial execution across 3 commits/2 days | 5/10 | ⚠️ INFERRED | ✅ Eventually complete |
| V8 | READY→BUCKET bug status unknown | 4/10 | ⚠️ INFERRED | ❓ Not verified |
| V9 | ZPM not updated proactively | 3/10 | ⚠️ INFERRED | ✅ Done when asked |
| V10 | Israel timezone not enforced | 3/10 | ⚠️ INFERRED | ⚠️ Approximate only |

**Total violations: 10 | Confirmed: 4 | Inferred: 6**
**Average severity: 4.6/10 | Max severity: 9/10 (V1)**

---

## Patterns Found

### Pattern 1: Default refusal before attempting
V1 is the clearest example. Claude said "I can't" without first checking if the tool
existed. This pattern — defaulting to "impossible" without attempting — is dangerous
because it actively misleads the user about Claude's capabilities.

### Pattern 2: Partial first execution
V4, V5, V7: Bug reports or feature requests that weren't fully resolved on first attempt,
requiring follow-up sessions or repeated reports. Claude tends to implement the most
obvious interpretation rather than the full scope of the request.

### Pattern 3: Boilerplate overriding explicit rules
V6: "App Store submission" was added to a priority list by habit/pattern-matching despite
an explicit standing order to never mention it. Claude's training on standard app
development checklists overrode project-specific Iron Rules.

### Pattern 4: Incomplete verification before declaring done
V2: Declared "b104 is correct" after checking two sources without checking EAS builds —
a third source that would have given the complete answer. Claude stopped investigating
when the first answer seemed plausible.

---

## Root Causes

1. **Training patterns override project rules** — Claude knows "App Store submission
   follows TestFlight" as a standard pattern. Without actively checking Iron Rules before
   every output, this pattern fires automatically.

2. **Capability uncertainty defaults to refusal** — When Claude doesn't immediately know
   how to do something (audio transcription), it defaults to "I can't" rather than
   "let me check what tools are available."

3. **Plausible-answer syndrome** — When the first check returns a reasonable-looking
   answer (b104 in app.json), Claude treats the question as resolved rather than
   continuing to verify completeness.

4. **Feature scope underestimation** — Complex requests (Five-O theme system) tend to
   be partially implemented first, with the full scope only emerging across multiple
   conversations.

---

## Commitments Going Forward

**C1 (V1 — audio):** Before saying "I can't [X]", run `ls` or `which` to check if the
tool exists. For audio: always try `py -3.11 -c "import whisper"` first.

**C2 (V2 — verification):** When a user challenges an answer ("more updated than X"),
treat it as a signal that my answer is incomplete. Expand the search before replying.
For build numbers: always check BOTH app.json AND `eas build:list`.

**C3 (V6 — Iron Rules):** Before writing any priority list, checklist, or recommendation,
re-read MEMORY.md Iron Rules + standing orders. Never include App Store or any other
forbidden item by habit.

**C4 (V4/V5/V7 — scope):** When a bug is reported, ask: "what is the full scope of what
Roye reported, not just the most obvious interpretation?" Voice notes especially contain
multiple issues — process all of them, not just the loudest one.

**C5 (V8 — unknown status):** When a bug is reported in voice notes and there's no
clear commit that fixes it, flag it explicitly rather than assuming it was handled.
Add it to QA checklist as "status unknown — verify on device."

**C6 (timestamps):** Start using Israel time (UTC+3 in summer, UTC+2 in winter) for all
session notes. Note: Israel is in summer time (UTC+3) from last Sunday of March.
2026-03-20 = UTC+3 applies from ~2026-03-29 (check exact date), so currently UTC+2.

---

## What This Audit Cannot Cover

Because `/mnt/transcripts/` was deleted in the disk cleanup, this audit is necessarily
incomplete. It covers only what was preserved in:
- `memory/` feedback and project files (4 confirmed violations)
- Observable behavior in the current conversation (V2 confirmed live)
- Session logs reconstructed from git history (6 inferred violations)

A complete audit would require the full conversation text. If transcripts are available
from another source (browser history, Anthropic export, etc.), re-run this audit with
those for a more accurate picture.

**Known gap:** The full transcript would likely reveal additional violations —
particularly around specific moments where Roye corrected Claude mid-session.
The 4 confirmed violations here should be treated as a minimum, not a maximum.
