# Caps Poker — Conversation Archive

This folder contains summaries of all conversations between Roye and Claude about Caps Poker development.

## What's here
- **TIMELINE.md** — full chronological index of all sessions + prompts + commits
- **YYYY-MM-DD/session-summary.md** — what was discussed, built, and decided each session
- **YYYY-MM-DD/key-decisions.md** — decisions that changed the project's direction
- **../prompts/** — all VAMOS MEGA PROMPTs sent to Claude Bot (archived automatically)
- **NEW-SESSION-TEMPLATE.md** — fill this out at the start of each new session

## Why this exists
Full context reconstruction. Any future Claude session can read these files and understand
exactly what was built, why, and how — without re-reading all of git history.

## Language conventions
- Roye speaks Hebrew in chat
- Claude responds in Hebrew in chat
- MEGA PROMPTs are in English (in ../prompts/)
- Code is always English
- Timestamps are Israel time (UTC+2 standard, UTC+3 summer)

## How to use after a session
1. Copy NEW-SESSION-TEMPLATE.md to YYYY-MM-DD/session-summary.md
2. Fill in what was reported, analyzed, built, and decided
3. Write key-decisions.md for any choices that changed direction
4. Run: `git add docs/conversations/ && git commit -m "docs: session archive YYYY-MM-DD"`

## Sessions archived
| Date | Builds | Summary |
|------|--------|---------|
| 2026-03-18 | b81→b88 | iOS crash fixes, home redesign, WhatsApp bot Phase 1 |
| 2026-03-19 | b89→b102 | WhatsApp bot full, orientation picker, Five-O graphics, audit |
| 2026-03-20 | b103→b105 | Five-O theme system, ZPM sync, Stage 8 completion |
