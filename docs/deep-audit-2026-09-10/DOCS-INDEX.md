# Documentation index — every .md in the repo root and docs/, audited 2026-09-10

Verdicts: **CURRENT** (consistent with the measured truth sheet) · **STALE** (presents itself as current and contradicts it — stale claims counted; `fixed` = corrected in place or bannered on this branch, `patch` = in `root-docs.patch`) · **HISTORICAL** (a dated record, not a claim about now) · **UNAUDITED** (not read by the audit; dated title, presumed historical).

**Totals:** 0 CURRENT · 32 STALE · 41 HISTORICAL · 388 UNAUDITED (of which 270 are dated logs in subdirectories). Also on disk and not indexed here: 239 files under `prompts/` and 327 under `.claude/` (skills and their 2026-05-17 backup copy).

Method: each audited file was read whole by an agent working from the truth sheet in `QUERIES.md`/`README.md`, every stale claim cited by line, and every correction here was re-checked by the orchestrator before it was applied.

## Repo root (26)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `APPSTORE_METADATA.md` | 2026-07-18 | STALE | 12 | patch | App Store Connect listing copy plus manual submission steps; presents itself as the metadata to paste today. I |
| `AUDIT_REPORT.md` | 2026-03-20 | STALE | 4 | patch | Undated cross-project audit (March 2026) listing components to copy from sibling projects, architecture sugges |
| `BUILD_INSTRUCTIONS.md` | 2026-03-20 | STALE | 8 | patch | Undated how-to for producing dev and TestFlight builds via EAS; presents itself as the current build procedure |
| `CAPS_POKER_MASTER.md` | 2026-03-20 | STALE | 11 | patch | Hebrew master project summary stamped 11.3.2026 / Sprint 18 Complete: working model, locked architecture decis |
| `CAPS_STATE.md` | 2026-03-20 | STALE | 8 | patch | 'Project State' card stamped 2026-03-17: version/build/stack/theme, a game-modes table with Live statuses, key |
| `CHANGELOG.md` | 2026-06-25 | HISTORICAL |  |  | Dated changelog: web v2.7.0 entry of 2026-06-25 (noting Build 506 lacked the lobby work) and Builds 228-237 of |
| `CLAUDE.md` | 2026-09-08 | STALE | 8 | fixed | The maintained landing/brain document for bots: Empire HQ quick start, project IDs, game rules, a dated 'Curre |
| `CURRENT-STATE.md` | 2026-06-17 | STALE | 6 | patch | A 'Current state' card (version/build, health, active issues, last actions, next priorities) scaffolded by VAM |
| `DEV_BUILD_GUIDE.md` | 2026-03-20 | STALE | 8 | patch | Undated guide for building an EAS dev client to test local-WiFi multiplayer; presents itself as the current de |
| `IRON_RULES.md` | 2026-03-21 | STALE | 7 | patch | Cross-project 'iron rules' auto-generated 2026-03-21 (git, code quality, database, payments, deployment, respo |
| `LOCAL_MULTIPLAYER_DESIGN.md` | 2026-03-20 | HISTORICAL |  |  | Design note (March 2026) for host-as-TCP-WebSocket-server local-WiFi multiplayer: protocol, state sync, packag |
| `MEMORY.md` | 2026-08-21 | UNAUDITED | — | |
| `MULTIPLAYER_RESEARCH.md` | 2026-03-20 | HISTORICAL |  |  | Research memo dated 2026-03-11 in-file comparing boardgame.io, Supabase Realtime, Liveblocks, PartyKit and Soc |
| `PREPLAN.md` | 2026-06-25 | STALE | 6 | patch | Phase plan with a 'Where we are' status section and 'Constraints / working rules'; stamped 'Last updated 2026- |
| `PROJECT-RULES.md` | 2026-04-13 | STALE | 3 | patch | Short project rules card: Supabase/Apple ids, TestFlight scope, active build, economy, key RPCs, two coding ru |
| `QA_CHECKLIST.md` | 2026-03-24 | STALE | 10 | patch | Undated manual pre-TestFlight QA checklist (core loop, COMPLETE bonus, settings, animations, edge cases, local |
| `QA_SPRINT44_STRESS_TEST.md` | 2026-03-24 | HISTORICAL |  |  | Dated (2026-03-13) Sprint-44 report of a 1,500-hand game-logic stress test (8 tests). Describes a moment in ti |
| `QA_SPRINT44_SUMMARY.md` | 2026-03-24 | HISTORICAL |  |  | Dated (2026-03-13) Sprint-44 QA summary: scope, issues fixed/deferred, post-QA state (112 tests, commit a47e30 |
| `QA_SPRINT44_SUPABASE.md` | 2026-03-24 | HISTORICAL |  |  | Dated (2026-03-13) Sprint-44 report of a 20-virtual-user Supabase leaderboard CRUD test and the leaderboard RL |
| `QA_SPRINT44_UI_AUDIT.md` | 2026-03-24 | HISTORICAL |  |  | Dated (2026-03-13) Sprint-44 static UI/navigation audit of the March screen set (index, game, results, setting |
| `README.md` | 2026-06-17 | STALE | 5 | patch | Root landing card for a bot: one-line description, status/tier/owner/language, live URLs, and a three-step qui |
| `SSL-INSTRUCTIONS.md` | 2026-03-24 | STALE | 6 | patch | How-to for fixing wrong-certificate SNI on SPD shared hosting (195.225.46.105) for caps.ftable.co.il and sibli |
| `TASKLIST.md` | 2026-06-25 | STALE | 5 | patch | Prioritised P0/P1/P2 task table with status column, stamped 'Last updated 2026-06-25 · main e046314'. Presents |
| `TESTFLIGHT_GUIDE.md` | 2026-03-24 | STALE | 8 | patch | Quickstart for shipping a TestFlight build through Expo EAS (eas login / build:configure / build --profile pre |
| `caps-backlog.md` | 2026-06-08 | STALE | 11 | patch | Dated (2026-06-08, post build-466 COUNCIL audit at 4347c6e3/a0122dad) backlog of non-blocking findings with fi |
| `PROJECT-INFO.json` | 2026-06-17 | STALE | 6 | patch | Machine-readable project metadata card: Supabase id/region, mobile bundle/version/build/pipeline, web, repo, t |

## docs/ top level (147)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/2026-03-25_1657_CAPS_card-protector-project-save.md` | 2026-03-30 | HISTORICAL |  |  | Dated (2026-03-25) save-file snapshot of the Feature TABLE physical 3D-printed card-protector prize project (M |
| `docs/2026-03-26_1451_CAPS_mega-prompt-cross-project-integrations.md` | 2026-03-30 | HISTORICAL |  |  | One-shot VAMOS prompt (report template dated March 26, 2026) targeting the sibling project C:\Projects\9soccer |
| `docs/2026-03-26_1526_CAPS_mega-prompt-integrations-and-learning.md` | 2026-03-30 | HISTORICAL |  |  | One-shot VAMOS prompt for C:\Projects\9soccer-mascots (fix bugs, integrate SecretSauce/TokenWise/PostPilot, po |
| `docs/2026-03-27_0450_CAPS_royea-master-project-map.md` | 2026-03-30 | UNAUDITED | — | |
| `docs/2026-03-27_0527_CAPS_ios-certificate-fix-guide.md` | 2026-03-30 | STALE | 4 | fixed | Hebrew step-by-step how-to (dated March 27, 2026) for recovering TestFlight across four repos after distributi |
| `docs/2026-03-27_0855_CAPS_caps-poker-mega-g-prompts.md` | 2026-03-30 | STALE | 22 | fixed | "Version 1.0 / March 27, 2026" library of eight copy-paste-as-is Claude prompts (chip economy, battle pass, si |
| `docs/2026-03-27_0912_CAPS_royea-master-project-map-v2.md` | 2026-03-30 | HISTORICAL |  |  | 32-line cross-project status table ('Updated: March 27, 2026 / All data from production DBs') covering 9Soccer |
| `docs/2026-03-27_0956_CAPS_reverse-engineer-learnings.md` | 2026-03-30 | HISTORICAL |  |  | Dated (March 27, 2026) lessons-learned write-up from the economy-system build across WINGMAN, 9Soccer and Caps |
| `docs/2026-03-27_1342_CAPS_caps-hooks-crash-fix-g-prompt.md` | 2026-03-30 | STALE | 6 | fixed | G-prompt instructing a bot (the auto-fix crash pipeline) to fix the 'Rendered fewer hooks than expected' crash |
| `docs/2026-03-27_1349_CAPS_caps-mega-prompt.md` | 2026-03-30 | STALE | 17 | fixed | Operator system prompt for a CAPS autonomous agent: identity, 'Project State', the hooks-crash issue, key tabl |
| `docs/2026-03-27_1515_CAPS_g-prompt-ux-fixes.md` | 2026-03-30 | HISTORICAL |  |  | One-off VAMOS task prompt from 2026-03-27 listing seven tester bugs (card readability, button size, bug-report |
| `docs/2026-03-27_1920_CAPS_caps-mega-prompt-1.md` | 2026-03-30 | STALE | 22 | fixed | 'Complete guide for CAPS Card Game development and maintenance' (Last Updated March 27, 2026): project info, t |
| `docs/2026-03-28_0359_CAPS_royea-master-project-map-v3-1.md` | 2026-03-30 | HISTORICAL |  |  | Cross-project metrics snapshot explicitly dated 'verified from production DBs — March 27, 2026' covering WINGM |
| `docs/2026-03-28_0605_CAPS_g-prompt-organize-downloads-full-team.md` | 2026-03-30 | HISTORICAL |  |  | One-off PowerShell G-prompt for sorting a Windows Downloads folder into ROYEA-EMPIRE/* subfolders by project k |
| `docs/2026-03-28_0611_CAPS_g-prompt-sit-n-go-build.md` | 2026-03-30 | HISTORICAL |  |  | One-off build task from 2026-03-28: remove the Battle Pass button and build Sit & Go lobby/waiting/game/result |
| `docs/2026-03-28_0619_CAPS_caps-bible-audit.md` | 2026-03-30 | UNAUDITED | — | |
| `docs/A11Y-AUDIT-2026-05-18-POST-FIX-1.md` | 2026-05-18 | HISTORICAL |  |  | Dated re-audit report after VAMOS-CAPS-A11Y-FIX-PATTERN-1: per-screen critical/warning/pass counts for 14 scre |
| `docs/A11Y-AUDIT-2026-05-18-POST-FIX-2.md` | 2026-05-18 | HISTORICAL |  |  | Dated re-audit report after VAMOS-CAPS-A11Y-FIX-PATTERN-2 (emoji hides): per-screen counts, delta vs the post- |
| `docs/A11Y-AUDIT-2026-05-18-POST-FIX-3.md` | 2026-05-18 | HISTORICAL |  |  | Dated log of the A11y PATTERN-3 contrast bulk swap (68 edits across 14 screens), listing deferred sub-patterns |
| `docs/A11Y-AUDIT-2026-05-18-POST-FIX-6.5-PLUS-5.md` | 2026-05-18 | HISTORICAL |  |  | Dated post-fix re-audit after PATTERN-6.5+5 (46 CRITICAL flat vs baseline), with a recommended fix order as of |
| `docs/A11Y-AUDIT-2026-05-18-POST-FIX-6.md` | 2026-05-18 | HISTORICAL |  |  | Dated post-fix re-audit after PATTERN-6 live-region edits (37 -> 46 CRITICAL, explained as reclassified warnin |
| `docs/A11Y-AUDIT-2026-05-18.md` | 2026-05-18 | HISTORICAL |  |  | Report-only WCAG 2.2 AA audit of the 14 screens in docs/SCREEN-INVENTORY.md (file exists, itself dated 2026-05 |
| `docs/ACHIEVEMENT-LANGUAGE-2026-08-21.md` | 2026-08-21 | HISTORICAL |  |  | Handoff (vamos_handoffs id 91, shipped main 865a77f — commit exists, dated 2026-08-21) describing the Hebrew-f |
| `docs/ADR.md` | 2026-03-24 | STALE | 4 | fixed | Twelve lightweight architecture decision records dated 2026-03-20, each carrying a Status (LOCKED/Active) a bo |
| `docs/ALIGN-CELEBRATION-PARITY-2026-08-27.md` | 2026-08-27 | HISTORICAL |  |  | Handoff (vamos_handoffs id 108) for branch 9c532d9 (commit exists, 2026-08-27): the 3-player one-board-each pa |
| `docs/ALIGN-THE-CELEBRATION-2026-08-23.md` | 2026-08-27 | HISTORICAL |  |  | Sprint doc for the one-definition-of-winning change (main 945cc12, commit exists 2026-08-23) with the 2026-08- |
| `docs/ANALYTICS.md` | 2026-05-17 | UNAUDITED | — | |
| `docs/ANTHROPIC_PROXY_HANDOFF.md` | 2026-05-17 | UNAUDITED | — | |
| `docs/AUDIT-2026-03-19.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/BENCHMARK-AND-STREAMLINE-2026-08-31.md` | 2026-08-31 | HISTORICAL |  |  | Three report-only audits (menu benchmark, logic audit, engineering leanness) pinned to repo a4bac0d (commit ex |
| `docs/BETA-TESTERS.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/BUILD-508-2026-08-28.md` | 2026-08-28 | HISTORICAL |  |  | Sprint report of 2026-08-28 07:27 UTC: build_history found dead (its readers return 471 while the device runs  |
| `docs/BUILD-D1-AND-C1-2026-08-30.md` | 2026-08-30 | STALE | 3 | fixed | Build report of 2026-08-30 for the D1 home hero (since merged: DISPLAY_FONT and the serif wordmark are in app/ |
| `docs/CAPS-MASTER-KNOWLEDGE-v2.md` | 2026-09-06 | STALE | 27 | fixed | Master knowledge base: identity, iron rules, game rules, credentials, deploy commands, key files, architecture |
| `docs/CAPS-STAGES-DASHBOARD.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/CAPS-STAGES-SCORE-2026-03-20.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/CAPS_POKER_SKILL.md` | 2026-06-17 | STALE | 28 | fixed | Chat-side operations skill ('ALWAYS read this file FIRST'): startup DB/CI protocol, game fundamentals and lock |
| `docs/CLAUDE-SELF-AUDIT-2026-03-20.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/CLAUDE_CODE_RULES.md` | 2026-06-17 | STALE | 16 | fixed | Intended repo-root CLAUDE.md for Claude Code: startup steps, hard rules, locked layout, Card.tsx branches, bui |
| `docs/CLOSE-S1-S2-2026-09-03.md` | 2026-09-03 | STALE | 7 | fixed | Close report committed 2026-09-03 02:23 UTC (4f3b2b7). Its S2 half is accurate: the ladder-forge trigger guard |
| `docs/CLOSE-THE-GAPS-2026-08-22.md` | 2026-08-22 | HISTORICAL |  |  | Sprint report of 2026-08-22 (vamos_handoffs id 96, harness main 955718f): MP exposed-control counts after the  |
| `docs/CLOSE-THE-LEAKS-2026-08-31.md` | 2026-08-31 | HISTORICAL |  |  | DB-only close report of 2026-08-31: finish_table/leave_table authorization, get_elo_leaderboard de-identified, |
| `docs/CLOSE-THE-SIX-2026-08-31.md` | 2026-08-31 | HISTORICAL |  |  | Close report of 2026-08-31 (two commits, 7338531 and 89a634c): chip_transactions anon INSERT closed, earn_chip |
| `docs/COMPETITIVE-ANALYSIS.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/CONTENT-ENGINE-2026-08-27.md` | 2026-08-27 | HISTORICAL |  |  | Handoff 116 of 2026-08-27: the Playwright capture rig (tools/content-lib.mjs, find-seeds.mjs, capture.mjs, fin |
| `docs/CURRENT-BUILD.md` | 2026-06-21 | STALE | 6 | fixed | Auto-generated snapshot from scripts/build-tracker.js (eas build:list / eas update:list) of build and OTA stat |
| `docs/CUT-AND-CUPS-2026-08-30.md` | 2026-08-30 | HISTORICAL |  |  | Design-review note of 2026-08-30: agreement with the twenty cut hero directions, C1 promoted over I1 on measur |
| `docs/DEAD-TABLE-AND-ECONOMY-2026-08-28.md` | 2026-08-28 | HISTORICAL |  |  | Dated handoff: the build-number readers repointed from the dead build_history table to get_live_build() (migra |
| `docs/DEBUG_SYSTEM_AUDIT.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/DEFAULT_DENY_INVENTORY.md` | 2026-08-01 | UNAUDITED | — | |
| `docs/DEPLOY-THE-SEAT-FIX-2026-08-27.md` | 2026-08-27 | HISTORICAL |  |  | Dated handoff (vamos_handoffs 109): three web deploys of the seat/tie fix verified by bundle-marker delta, the |
| `docs/ECONOMY-DECISIONS-2026-08-21.md` | 2026-08-21 | HISTORICAL |  |  | Dated decision record (vamos_handoffs 82): non-anonymous-uid binding branch built, rescue threshold derived fr |
| `docs/ECONOMY-MAP-2026-08-21.md` | 2026-08-21 | HISTORICAL |  |  | Dated read-only map of chip sources and sinks from 5,433 chip_transactions rows plus a same-day INTEGRITY-GAP  |
| `docs/EVERY-CONTROL-2026-08-21.md` | 2026-08-21 | HISTORICAL |  |  | Dated control-by-control audit (vamos_handoffs 88) via tests/enumerate-controls.mjs: all 42 Settings controls, |
| `docs/FAIRNESS_PLAN.md` | 2026-07-25 | UNAUDITED | — | |
| `docs/FELT-UNDER-THE-BOARDS-2026-08-27.md` | 2026-08-27 | HISTORICAL |  |  | Dated handoff (vamos_handoffs 113): the board panel painted twice on web (Board.tsx container gradient plus Li |
| `docs/FINAL-QA-2026-08-22.md` | 2026-08-22 | HISTORICAL |  |  | Dated four-cycle QA report (vamos_handoffs 100/101): the 8-vs-6-character referral code defect, the chip store |
| `docs/FINAL-QA-512-2026-09-01.md` | 2026-09-01 | HISTORICAL |  |  | Dated tester-candidate gate for iOS build 512 (run 33469592848, commit b79541a): mirrored-bytes render at four |
| `docs/FOUR-GAME-SCREENS-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/GEMS.md` | 2026-06-21 | UNAUDITED | — | |
| `docs/GOTCHAS-AND-LESSONS.md` | 2026-03-24 | STALE | 2 | fixed | Dated lessons file (2026-03-20, sessions b88–b104) of 13 gotchas with 'Fix:' instructions plus 6 process lesso |
| `docs/GRAPHICS-REVIEW-2026-03-19.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/HALF-BUILT-SCREENS-2026-08-21.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/HARNESS-REACH-REVEAL-2026-08-21.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/HUNT-THE-CLASSES-2026-08-22.md` | 2026-08-23 | UNAUDITED | — | |
| `docs/ISRACARD-DOMAIN-REQUEST-DRAFT.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/LABELS-AND-FINAL-PANEL-2026-08-23.md` | 2026-08-23 | UNAUDITED | — | |
| `docs/MASTER_INDEX.md` | 2026-09-06 | STALE | 26 | fixed | Index of knowledge files, edge-function inventory, MCP tools, key repo files, DB tables, locked game constants |
| `docs/MEASUREMENT-PROTOCOL.md` | 2026-08-23 | UNAUDITED | — | |
| `docs/MIGRATION_HYGIENE.md` | 2026-06-29 | HISTORICAL |  |  | Dated note (2026-06-28) recording that ~15 QA simulations were applied via apply_migration during one cycle, l |
| `docs/MP-COUNTS-NOTHING-2026-08-23.md` | 2026-08-23 | UNAUDITED | — | |
| `docs/MP-RECORDING-2026-08-23.md` | 2026-08-23 | UNAUDITED | — | |
| `docs/NATIVE-AND-HOME-2026-08-28.md` | 2026-08-28 | UNAUDITED | — | |
| `docs/NAV-AND-DEAD-CODE-2026-08-31.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/ONE-WIN-COUNTER-2026-08-23.md` | 2026-08-23 | UNAUDITED | — | |
| `docs/PANEL-EVERYTHING-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/PAYMENT-VERIFICATION-2026-08-22.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/PAYMENTS-GO-LIVE.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/PENDING_auto_learn.md` | 2026-07-06 | UNAUDITED | — | |
| `docs/PENDING_practice_to_live.md` | 2026-07-05 | UNAUDITED | — | |
| `docs/PHASE_0_CHANNEL_AUTHZ.md` | 2026-08-13 | UNAUDITED | — | |
| `docs/PLAY-NOT-PRESENCE-2026-08-28.md` | 2026-08-28 | UNAUDITED | — | |
| `docs/PRE-TESTER-BACKLOG.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/PRE-TESTER-CLOSE-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/PRE-TESTER-PLAN.md` | 2026-08-13 | UNAUDITED | — | |
| `docs/PRICE-LADDER-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/PROJECT_MANIFEST.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/PURGE-AND-BASELINES-2026-08-27.md` | 2026-08-27 | UNAUDITED | — | |
| `docs/PURGE-AND-CLOSE-2026-08-31.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/QA-CHECKLIST-2026-03-20.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/RECAP_2026-06-28.md` | 2026-06-29 | UNAUDITED | — | |
| `docs/RED-TEAM-2026-08-31.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/REPLY-TO-CAPS-BOT.md` | 2026-06-17 | UNAUDITED | — | |
| `docs/REVEAL-SAVE-AND-PAYMENTS-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/REVEAL-SEQUENCE-SPEC.md` | 2026-08-07 | UNAUDITED | — | |
| `docs/ROYE_WORKING_STYLE.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/SCOPE-PANEL-2026-08-21.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/SCREEN-INVENTORY.md` | 2026-05-18 | UNAUDITED | — | |
| `docs/SCREEN-PANEL-REVIEW.md` | 2026-08-07 | UNAUDITED | — | |
| `docs/SCREEN-VISUAL-AUDIT.md` | 2026-08-15 | UNAUDITED | — | |
| `docs/SECURITY-AUDIT-2026-08-15.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/SESSION-2026-03-18.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/SESSION-LOG-2026-03-19-20.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/SESSION_SUMMARY_20260321.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/SETTINGS-STRIP-2026-08-21.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/SHARED_GEMS.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/SHIP-509-2026-08-28.md` | 2026-08-28 | UNAUDITED | — | |
| `docs/SHIP-511-2026-08-31.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/SHIP-D1-2026-08-30.md` | 2026-08-30 | UNAUDITED | — | |
| `docs/SHIP-THE-GREEN-2026-08-27.md` | 2026-08-27 | UNAUDITED | — | |
| `docs/SHIP-V1-2026-08-27.md` | 2026-08-27 | UNAUDITED | — | |
| `docs/SHOP-OWNERSHIP-2026-08-21.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/SLOT-OUTLINES-2026-08-27.md` | 2026-08-27 | UNAUDITED | — | |
| `docs/SUBSCRIPTION-REMOVED-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/TESTFLIGHT_TEMPLATE.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/THE-KILL-SWITCH-2026-08-30.md` | 2026-08-30 | UNAUDITED | — | |
| `docs/THE-ONE-DAY-2026-08-22.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/THE-SINK-2026-08-28.md` | 2026-08-28 | UNAUDITED | — | |
| `docs/THIRTY-DIRECTIONS-2026-08-30.md` | 2026-08-30 | UNAUDITED | — | |
| `docs/THREE-FAMILIES-2026-08-21.md` | 2026-08-21 | UNAUDITED | — | |
| `docs/THREE-FELTS-2026-08-27.md` | 2026-08-27 | UNAUDITED | — | |
| `docs/TIMELINE.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/TWO-CURRENCIES-AND-RESET-2026-09-01.md` | 2026-09-01 | UNAUDITED | — | |
| `docs/TWO_DEVICE_TEST.md` | 2026-04-09 | UNAUDITED | — | |
| `docs/VAMOS-METHODOLOGY-GUIDE.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/VAMOS-NEXT.md` | 2026-04-27 | UNAUDITED | — | |
| `docs/VERIFY-EVERYTHING-2026-08-31.md` | 2026-08-31 | UNAUDITED | — | |
| `docs/VIDEO-HOSTING-2026-08-28.md` | 2026-08-28 | UNAUDITED | — | |
| `docs/WIRE-ACHIEVEMENTS-2026-08-21.md` | 2026-08-22 | UNAUDITED | — | |
| `docs/WSOP_SIMULATION.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/appstore_checklist.md` | 2026-07-18 | UNAUDITED | — | |
| `docs/caps-build-checklist.md` | 2026-08-28 | UNAUDITED | — | |
| `docs/caps-debug-flows.md` | 2026-06-17 | UNAUDITED | — | |
| `docs/caps-project-map.md` | 2026-03-27 | UNAUDITED | — | |
| `docs/caps-qa-team-simulation.md` | 2026-06-17 | UNAUDITED | — | |
| `docs/caps-screenshot-qa.md` | 2026-06-17 | UNAUDITED | — | |
| `docs/deploy_guide.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/dns_fix.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/initial_build_prompt.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/lemonsqueezy-products.md` | 2026-07-15 | UNAUDITED | — | |
| `docs/module-state-and-server-paths.md` | 2026-08-18 | UNAUDITED | — | |
| `docs/multiplayer-test-guide.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/ssl_setup.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/ux-audit-2026-04-27.md` | 2026-04-27 | UNAUDITED | — | |
| `docs/whatsapp-bot-design.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/whatsapp-bot-multiproject.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/whatsapp-bot-setup.md` | 2026-03-24 | UNAUDITED | — | |

## docs/knowledge (4)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/knowledge/caps-session-log-2026-03-20.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/knowledge/findings-lessons-learned.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/knowledge/reusable-skills-gems-patterns.md` | 2026-03-24 | UNAUDITED | — | |
| `docs/knowledge/roye-claude-workflow-analysis.md` | 2026-03-24 | UNAUDITED | — | |

## docs/last-gaps (2)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/last-gaps/FIX-THE-FOUR-2026-09-08.md` | 2026-09-07 | UNAUDITED | — | |
| `docs/last-gaps/THE-LAST-GAPS-2026-09-08.md` | 2026-09-07 | UNAUDITED | — | |

## docs/product-map (5)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/product-map/BAILEY-AND-REFRESH-2026-09-03.md` | 2026-09-03 | UNAUDITED | — | |
| `docs/product-map/BATTLE-PASS-CLOSED-2026-09-07.md` | 2026-09-07 | UNAUDITED | — | |
| `docs/product-map/INVENTORY-AND-MAP-2026-09-03.md` | 2026-09-03 | UNAUDITED | — | |
| `docs/product-map/PRODUCT-MAP-2026-09-06.md` | 2026-09-06 | UNAUDITED | — | |
| `docs/product-map/PRODUCT-MAP-2026-09-07.md` | 2026-09-10 | UNAUDITED | — | |

## docs/social (2)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/social/FACEBOOK-PAGE-RUNBOOK.md` | 2026-09-09 | UNAUDITED | — | |
| `docs/social/SPLASH-ASSETS-EXPLAINERS-2026-09-06.md` | 2026-09-06 | UNAUDITED | — | |

## docs/tester-readiness (1)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/tester-readiness/TESTER-READINESS-2026-09-05.md` | 2026-09-05 | UNAUDITED | — | |

## docs/testflight (4)

| file | last commit | verdict | stale claims | action | purpose |
|---|---|---|---|---|---|
| `docs/testflight/ATTACH-515-EXTERNAL-2026-09-07.md` | 2026-09-07 | UNAUDITED | — | |
| `docs/testflight/PUBLIC-LINK-2026-09-07.md` | 2026-09-07 | UNAUDITED | — | |
| `docs/testflight/SECOND-PHONE-2026-09-07.md` | 2026-09-07 | UNAUDITED | — | |
| `docs/testflight/VS-9SOCCER-2026-09-07.md` | 2026-09-07 | UNAUDITED | — | |

## docs/ subdirectories not read file-by-file (dated logs and prompt archives)

| directory | .md files | what it is |
|---|---|---|
| `docs/audit-rest-2026-09-05` | 1 | dated records |
| `docs/build-515` | 1 | dated records |
| `docs/button-styles` | 4 | dated records |
| `docs/conversations` | 3 | chat exports |
| `docs/deep-audit-2026-09-10` | 8 | dated records |
| `docs/dismiss-tips` | 2 | dated records |
| `docs/explainers` | 2 | dated records |
| `docs/f-icon` | 3 | dated records |
| `docs/facebook-first-post-2026-09-09` | 1 | dated records |
| `docs/facebook-update-2026-09-09` | 1 | dated records |
| `docs/final-qa` | 2 | FINAL-QA records 2026-09 |
| `docs/full-i18n` | 1 | dated records |
| `docs/game-audit` | 2 | dated records |
| `docs/handoffs` | 40 | VAMOS handoff copies (the DB table vamos_handoffs is the primary) |
| `docs/icon-history` | 2 | dated records |
| `docs/landing-2026-09-05` | 1 | dated records |
| `docs/landing-deploy-2026-09-05` | 1 | dated records |
| `docs/landing-lang-2026-09-05` | 1 | dated records |
| `docs/landing` | 1 | dated records |
| `docs/last-three` | 1 | dated records |
| `docs/neglected` | 2 | dated records |
| `docs/phase-a` | 2 | dated records |
| `docs/pre-invite-fixes` | 1 | dated records |
| `docs/prompts` | 135 | prompt archive; root prompts/ duplicates two of them byte-for-byte |
| `docs/qa` | 3 | QA run records |
| `docs/results-ia` | 1 | dated records |
| `docs/round-hygiene` | 3 | dated records |
| `docs/screen-audit` | 1 | dated records |
| `docs/sessions` | 24 | session logs |
| `docs/ship-513` | 1 | dated records |
| `docs/splash-landing` | 5 | dated records |
| `docs/sprints` | 12 | sprint records |
| `docs/token-rotation` | 1 | dated records |
| `docs/total-audit` | 1 | TOTAL-AUDIT-2026-09-02 |
