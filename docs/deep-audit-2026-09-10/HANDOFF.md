VAMOS CAPS DEEP-AUDIT — handoff 210 — 2026-09-10
Branch claude/caps-deep-audit-nr8z17, from ef55640. NOT merged, no bump. 8 commits, all pushed.
Nothing in the product changed: no flag, economy value, cue, card size, 83px arc, KILL_Board, no
game_rooms or room_players row, no edge function deployed, no migration applied, no payment
enabled, no public link re-enabled, nothing submitted to Apple, no device / bug report / historical
row deleted. Only docs/ and one root-docs PATCH (not applied).

=== GROUND TRUTH — RE-MEASURED, ALL SEVEN MATCH ===
403 devices · 25 have played · 78 hands · 14 bindings · ledger gap 0 (812,400 = 812,400) ·
max chips 3,250 · purchases 0. Handoffs: max id 209, 207 rows — ids 19 and 172 are missing.
"Have played" has THREE answers: games_played>0 = 25, hands_played>0 = 26, distinct
hand_history.device_id = 10. Name the column when you quote it.

=== INDEX ===
33 routes · 73 tables · 198 functions · 12 views · 8 triggers · 100 policies · 31 cron jobs ·
14 edge functions deployed (13 in the repo) · 21 shipped assets · 65 branches · 17 workflow files
(19 registered) · 131 docs audited of 464 .md in the tree.
All of it: docs/deep-audit-2026-09-10/ — README, FINDINGS, SCREENS, DB-OBJECTS, DB-FUNCTIONS,
EDGE-FUNCTIONS, ASSETS, WORKFLOWS, BRANCHES, DOCS-INDEX, QUERIES, root-docs.patch.

WHAT THE 198/73 RATIO CONTAINS (the brief asked): the game + economy is 16 tables and ~70
functions and every hand touches it. The other 57 tables are five systems around it — retention /
push / missions (15 tables, 8 crons firing daily at 3 push tokens and 0 challenges), the bug /
crash / QA pipeline (16, six of them empty), ops self-monitoring (11, live for the bot not the
player), sit-and-go / clubs / quick-poker (8, last written April to June), and backups (7, inert).
105 functions have a live caller; 68 are reached only by other SQL or a view; 25 have no caller
found anywhere — flagged, not removed.

=== THE FIVE HIGHEST, ALL MEASURED TWICE ===
1. THE PRE-RESET LEDGER ARCHIVE IS OPEN TO THE ANON KEY. chip_transactions_prereset_20260901 has
   RLS OFF and every grant. SET ROLE anon; SELECT count(*) -> 4,237 rows: device_id, user_id,
   amounts, descriptions. The live ledger is service-role-only; its copy is not. Nothing reads it.
2. SEVEN DEFINER VIEWS HAND ANON WHAT THE TABLES DENY. v_grant_without_session -> 7 rows of
   device_id + total_chips; v_harness_devices_v2 -> 8 device_ids, a UNION over v_harness_devices,
   which migration 20260831170000 REVOKED from anon for exactly this reason ("should not be a
   public listing of device ids"); friction_heatmap and the top_* views read analytics_events,
   whose own comment says READS ARE service_role ONLY. Migration 20260907000000 created _v2 and
   did not carry the revoke. SQL for both is in FINDINGS.md, not applied — DDL on the economy's
   security surface is yours.
3. MAIN IS 33 COMMITS BEHIND THE BRANCH THAT RUNS. claude/vamos-caps-align-celebration-flppo0
   holds the migration live since 2026-09-08 (close_submit_score_chip_faucet), 14 test files and
   the corrected CLAUDE.md. Main's CLAUDE.md said "submit_score STILL OPEN" for two days after it
   closed. Fixed the pointer; the merge is yours.
3a. TWO EDGE FUNCTIONS RUN CODE THE REPO HAS NEVER HELD. whatsapp-bot-handler (v70) and
   crash-analyzer (v17), both 2026-07-15, send through Empire HQ empire-messaging; the repo copies
   POST straight to Twilio and assert TWILIO_WHATSAPP_FROM at module load. Deploying either from
   the repo reverts the egress route — the seo-prerender shape. resolve-hand and seven others are
   byte-identical; resolver-probe exists only as a deployment.
4. NOTHING COMPUTES THE FLOAT-VS-LEDGER GAP. health_check() sums the float and counts ledger rows
   and never subtracts; run_daily_reconciliation reconciles prompt-log counts with HQ. "Gap 0" is
   a hand measurement every sprint, and handoff 202 records that today's 0 rests on a one-off
   backfill. Plus 4a: the BLOCKING WCAG gate passes when the site cannot be loaded (an errored
   route contributes 0 violations and the verdict reads only critical>0), and 4b: the live
   payment-forge probe prints "expected 401" beside the real status and never compares them.

=== THE NINTH NAME-VS-CONTENT INSTANCE — FOUND ===
assets/sounds/boardLose.wav is BYTE-FOR-BYTE boardWin.wav (sha256 3c395893…, 44,178 B). So is
revealStart.wav. March placeholders (b6e99ff, "revealStart sound placeholder") never replaced.
BoardReveal.tsx:552/555 plays boardWin on a won board and boardLose on a lost one — the same
chime. Sound is on by default. Never heard in QA because native has never been verified and the
web rigs run muted. Three declared SoundName values have no file at all.

=== FIXED (docs only, each re-checked before commit) ===
· The product map's reachability: 3 routes marked R have NO tap path (/theme-pick,
  /orientation-pick, /spectate), /simulate renders in a dev build, /debug opens on __DEV__ not the
  dev-unlock gesture, and 8 "reached by" cells named a screen with no link. Corrected in place.
· CLAUDE.md: main-behind-production, submit_score CLOSED, tests 2,846/53, live data, the
  three-answers warning, the flag/edge caveats, the ninth instance.
· 31 stale docs bannered or corrected, each banner naming the specific contradiction.
· docs/CURRENT-BUILD.md and MASTER_INDEX.md bannered; GOTCHAS §8 and PAYMENTS-GO-LIVE line refs.
· root-docs.patch: 17 root files (README calls this a "club management app"; PROJECT-INFO.json
  carries a bundle id this app has never had; CURRENT-STATE is from April; IRON_RULES.md holds
  none of the numbered Iron Rules the briefs cite). NOT applied — root is outside the allowance.
  git apply docs/deep-audit-2026-09-10/root-docs.patch

=== REPORTED, NOT FIXED (why: off-limits or not provably safe from here) ===
The economy, the cue, card sizes, the arc, flags: untouched by rule. The two security items are
DDL. The sound files need real audio, not a rename. The COMPLETE banner says "+50% BONUS" on every
hand while the bonus is 25/50/75 by board count — results copy, economy-adjacent. Settings
"4 colours" paints nothing on in-game cards (Card.tsx:506 computes it, every V2 render uses
v2SuitColor). The CLASSIC swatch is brown/gold beside a green-felt theme. The dirty-shutdown
detector writes one AsyncStorage key and reads another, so a mid-hand kill alerts nobody.
15 probe scripts under tests/ cannot fail, and 6 verifiers print a verdict they never assert.
23 of 42 app_config keys are read by NOTHING — not the client, not an edge function, not any live
pg_proc body — including maintenance_mode and min_app_version. iap_enabled is read but its loader
sits in a component that is never mounted, so the row decides nothing. Full ranked list, 40 rows:
FINDINGS.md.

=== INSTRUMENT FAULTS IN MY OWN RUN — three, each caught by looking ===
1. I handed the doc agents a truth sheet saying "the game is not Omaha". WRONG: per-board
   evaluation IS Omaha-style (evaluateOmahaHand, used by gameLogic and resolve-hand). Every
   "Omaha is wrong" line the agents produced was discarded and three banners corrected before
   commit. IRON_RULES.md's project block is stale on the theme and on "no backend", not on Omaha.
2. The ELO-badge finding arrived as HIGH. Measured: 0 of 403 rows carry a non-zero elo_last_delta,
   so nobody can see it today. Filed as latent, not as a live defect.
3. The morning-digest NULL-drop is real SQL, in a function (get_daily_digest) that no cron, RPC,
   function or client calls. Informational.
Also: the usage limit killed 60 of 62 verifier agents mid-run, so the three-lens adversarial pass
never ran. Every finding here was instead re-read by me at the cited line and re-measured on the
live DB. Findings that did not survive that are not listed.

=== PASS / FAIL / COULD NOT VERIFY ===
PASS: ground truth (7/7), ledger gap today, submit_score closed, cron 31/31 with 0 failures in 7
days, jest 2,846/2,846 on main, web deploy = head (bundle hash read from the live site, 404s
honest), landing explainer, asset pairs, the two ghost workflows inert.
FAIL: the archive, the seven views, main-vs-production, the two edge functions, no gap control,
the WCAG gate, the payment probe, the sound files, the product map, 61 stale docs.
COULD NOT VERIFY: native rendering, the reporter's media path, two clients in one room, MP under
load — same four as every sprint, and this run had no device, no second client and no billing
access either. Also: the Facebook cover live (no browser path), the TestFlight link state and the
App Store listing (would need an ASC dispatch), PITR (organization endpoint denies).

=== READY FOR TESTERS? ===
Yes, for the single-player loop on web — unchanged from handoff 201. Two things first, because
they only matter once testers exist: close #1 and #2 (a tester's device id and balance history are
readable with the shipped key), and commit the deployed source of the two drifted edge functions.
WOULD NOT WANT A TESTER TO HIT: the multiplayer lobby, still; on native, a lost board (win chime);
a 2P or 4P COMPLETE (wrong bonus percentage on the banner).
MOST VALUABLE THING LEFT: one migration file finishing what 20260831170000 started — RLS on the
archive, SELECT revoked from anon on the seven views — proven by the same two SET ROLE anon
queries. Two statements, and it is the only finding that gets more urgent with every install.

=== THREE RANKED NEXT STEPS ===
1. Apply that migration file (FINDINGS.md has the SQL and the before/after proof). Closes the only
   findings that leak identity and balance history to anyone holding the public anon key.
2. Decide the merge of claude/vamos-caps-align-celebration-flppo0. Until it lands, every bot that
   starts from main reads a product that stopped running on 2026-09-08 — and the next person to
   deploy an edge function from the repo reverts the WhatsApp transport.
3. Replace the three placeholder sound files (or map boardLose to lose.wav). One tester on a real
   device hears a win chime when they lose a board, on the screen that teaches the game.

Commits on origin/claude/caps-deep-audit-nr8z17: 47693d1 (head), eea4942, d548cdf, ceeebb9,
a2eb60a, 3579e67, 9dfe81b, and the doc-banner commits between them.
