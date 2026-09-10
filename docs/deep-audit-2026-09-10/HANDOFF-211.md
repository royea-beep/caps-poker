VAMOS CAPS CLOSE-THE-FOUR — handoff 211 — 2026-09-10
All four closed. Branch work MERGED to main: origin/main = b3ceac1.
Production DB changed on purpose (two migrations, branch-proven first). No Edge Function deployed,
no version bumped, no flag, economy value, cue, card size, 83px arc or tie tally touched, no
game_rooms / room_players row hand-edited, no historical row deleted, nothing submitted to Apple,
no payment enabled, no public link re-enabled, no browser or social work attempted.

=== 1 · THE ARCHIVE — AND IT WAS WORSE THAN I REPORTED ===
chip_transactions_prereset_20260901 is now RLS ON, anon + authenticated REVOKED, service_role
SELECT. 4,237 rows intact.

⚠️ THE UPGRADE, MEASURED NOT ASSUMED: it was never merely readable. The table still carried the
schema DEFAULT ACL — anon=arwdDxtm and authenticated=arwdDxtm — so `a`=INSERT, `d`=DELETE and
`D`=TRUNCATE were granted too. On the throwaway branch, as anon: DELETE removed a row, INSERT
forged one, and TRUNCATE took a 25-row reproduction to ZERO ROWS. The standing rule for this table
is "locked, not deleted", and anyone holding the shipped public key could have emptied it.
I proved that on a branch and never on production.

NOTHING BROKE — PROVEN, NOT ASSUMED: 0 functions, 0 views, 0 crons, 0 dependent objects, 0
triggers and 0 foreign keys name the table (pg_depend + pg_proc + pg_views + cron.job). Its only
lifetime writes are the 4,237 archive inserts; its 9 lifetime sequential scans since 2026-02-13 are
this audit's own queries. And the negative control after the change: leaderboard and app_config
still return HTTP 200 with rows to the anon key.

=== 2 · THE SEVEN VIEWS ===
REVOKE ALL (not just SELECT — the client roles held a/w/d/D on them as well) from anon,
authenticated and PUBLIC; service_role keeps SELECT:
  friction_heatmap · top_abandon_screens · top_stuck_screens · top_rage_tap_targets ·
  v_simulator_devices · v_harness_devices_v2 · v_grant_without_session

=== 3 · ⚠️ THE CLASS, WHICH IS THE REAL FINDING ===
Nothing was ever "granted" to anon. Both the archive and all seven views were BORN that way:

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;

is set on this project, and defaclobjtype='r' covers VIEWS as well as tables. Every new object in
public arrives with all seven privileges for both client roles, so a REVOKE protects exactly the
object it names and nothing created afterwards. That is the whole mechanism behind
20260831170000 revoking v_harness_devices ("the detector itself should not be a public listing of
device ids") and 20260907000000 handing the same rows straight back through v_harness_devices_v2
five weeks later — nobody wrote a line of wrong SQL.

⚠️ AND THE SIGNATURE IS READABLE IN ONE COLUMN. An object never revoked from still shows the
untouched default; a revoked one shows the gap:
    archive + the 7 views   anon=arwdDxtm   <- untouched default
    analytics_events        anon=xtm        <- SELECT/INSERT/UPDATE/DELETE/TRUNCATE revoked
    leaderboard             anon=awdDxtm    <- SELECT revoked 2026-08-15
    v_harness_devices       anon=awdDxtm    <- SELECT revoked 20260831170000
I swept every object this way. The seven views and the one table are the COMPLETE set — no ninth.

EVERY OTHER OBJECT CREATED AFTER A REVOKE THAT DID NOT INHERIT IT: none beyond these eight. The
other four views over the same tables (v_automation_devices, v_analytics_human, v_feedback_summary,
v_recent_feedback) are already postgres+service_role only.

HOW THE NEXT ONE IS CAUGHT: public.anon_read_surface_violations() — every relation a client role
can read whose SOURCE that role cannot, plus every RLS-off table a client role can touch. It keys
on the CONSEQUENCE (has_table_privilege), not on ACL text, so it is immune to how the grant
arrived. Wired into security_posture_tripwire() (cron 37, hourly), which already owns the alert
path, the 4-a-day cap and the 60-minute suppression. Must return zero rows.

⚠️ A CONTROL THAT CANNOT FAIL IS NOT A CONTROL — so it was driven against the known-bad input
BEFORE it was applied:
  C1  clean tree                 -> {"ok":true,"fired":false,"findings":0}
  C2  create v_harness_devices_v3 (the exact 20260907 mistake)
                                 -> {"ok":true,"fired":true,"findings":2} naming BOTH roles and
                                    the source, and it queued the WhatsApp alert with the remedy
  C3  the queued text carries "REVOKE ALL ON <object> FROM anon, authenticated, PUBLIC"
  C4  drop the v3                -> back to {"findings":0}
It also caught two mistakes in my own reproduction while I was building it (a view and a table I
created on the branch without replicating production's posture). That is the best evidence it will
catch the next real one.

=== 4 · BEFORE / AFTER (Iron Rule 11 — branch, then production) ===
BRANCH (anosmbtagvkbbblrbrpy, reproduction built from production's own ACLs, then deleted):
  BEFORE  anon reads all 8: archive 25 · v_harness_devices_v2 3 · v_simulator_devices 2 ·
          v_grant_without_session 1 · friction_heatmap 3 · top_abandon 1 · top_stuck 1 · top_rage 1
          and anon TRUNCATE emptied the archive: 25 -> 0
  AFTER   all 8 refused for anon AND for authenticated; DELETE / INSERT / TRUNCATE all refused
⚠️ An "after" alone would have passed on a database where the grant never existed. That is why the
before is there, and why the reproduction was built from production's ACL strings rather than
from memory.

PRODUCTION RE-ATTACKED with the SHIPPED PUBLIC ANON KEY over HTTPS (PostgREST, not SET ROLE):
  chip_transactions_prereset_20260901   401  42501 permission denied for table
  v_harness_devices_v2                  401  42501 permission denied for view
  v_simulator_devices                   401  42501
  v_grant_without_session               401  42501
  friction_heatmap                      401  42501
  top_abandon_screens                   401  42501
  top_stuck_screens                     401  42501
  top_rage_tap_targets                  401  42501
  archive DELETE                        401  42501
  archive POST (forged row)             401  42501
  NEGATIVE CONTROL leaderboard          200  [{"player_name":"Player"}]
  NEGATIVE CONTROL app_config           200  [{"key":"pro_voices_enabled"}]
Migrations 20260910120000 + 20260910120100, both with files in the repo this time.

=== 5 · THE MERGE ===
origin/main ef55640 -> 48cbf47 (celebration, 33 commits, 90 files, +8,123 lines) -> 6a50647
(deep audit) -> b3ceac1 (this addendum). CONFIRMED BY READING THE REMOTE REF each time
(git ls-remote), not by a local success line.
tsc clean at every step. Suite: 2,874/2,874 across 57 suites after the first merge, 2,888/2,888
across 58 after the second (the sound-assets suite).
20260908000000_close_submit_score_chip_faucet.sql — live since 2026-09-08, file previously only on
the branch — is now on main. One conflict, in CLAUDE.md, on the test-count line: both sides were
stale and the merge itself made them staler, so I re-measured on the merged tree.

WEB VERIFIED BY CONTENT DELTA, markers and counts:
  "attachment incomplete"   old main 0  ->  new main 3  ->  SERVED BUNDLE 1
  "failed to upload"        old main 0  ->  new main 3  ->  SERVED BUNDLE 1
  negative controls, unchanged strings that must still be there: "PLACE" 13, "Auto-Place" 4
  /landing.html md5 c8e340b050a7c76b98743b8ac3d4aa77 == repo
  /nope.png 404 · /definitely-missing.html 404 · / 200 — the honest 404s still hold
⚠️ MY FIRST FOUR MARKERS WERE WRONG AND READ AS ZERO: "scroll for more", "there is more below",
"more time where it scrolls", "Again no audio" all live in COMMENTS, which the bundler strips. I
would have filed "the deploy did not land". Looked at where the strings actually were instead.

⚠️ AND A THING FOUND ON THE WAY, NOT IN THE BRIEF: THE LIVE LANDING PAGE WAS ALREADY AHEAD OF MAIN.
Before either merge, /landing.html served md5 c8e340b0… — byte-identical to the unmerged
celebration branch and different from main (ef55640) on 8 lines, the CAPS POKER -> CAPS Poker
casing. Production was serving unmerged code. vercel.json's own header records that branch
`vercel --prod` was removed on 2026-07-19 "after it put unmerged code live". The merge has made
main match what was already served; the divergence is the finding and nothing this sprint caused it.

NO EDGE FUNCTION DEPLOYED — confirmed by reading all 14 versions after the merges: whatsapp-bot-
handler still v70, crash-analyzer v17, resolve-hand v11, analyze-bug-report v22, telegram v29,
retriage v11, legal v9, anthropic-proxy v9, auto-fix-crashes v19, flush-outbound v14, log-error v20,
sync-bugs-to-drive v22, resolver-probe v4, verify-purchase v4. Unchanged. Two of them still run
code the repo has never held; that stays a separate decision.

=== 6 · ⚠️ THE SOUND — MY OWN FINDING WAS WRONG, AND THE TRUTH IS WORSE ===
I reported "a lost board plays the win chime". IT PLAYED NOTHING. boardWin.wav, boardLose.wav and
revealStart.wav were 0.5 s of DIGITAL SILENCE — 22,050 frames, every sample exactly 0, ffmpeg's
null source (ISFT: Lavf62.3.100 is still in the header), committed once on 2026-03-25 in d996c9d
and never touched. A won board, a lost board and the start of every reveal were silent for five and
a half months, with sound ON by default.

⚠️ HOW I GOT IT WRONG: sha256 equality proved the three files were THE SAME. It never proved WHAT
they were. I compared hashes and did not read a sample.

PRODUCED (scripts/generate-reveal-sounds.py — stdlib only, deterministic, documents the design):
  boardLose    415 -> 277 Hz smooth downward GLIDE, 0.40s, peak RMS 0.072 — a glide not two steps,
               so it cannot be confused with `lose` (390->310 stepped, RMS 0.156); slow 25 ms attack
               so it deflates rather than hits; the QUIETEST of the three because a player hears it
               the most and it must not become punishing
  revealStart  220 -> 440 Hz rising glide with a swell, 0.30s, RMS 0.052 — low and smooth reads as
               anticipation, an octave below cardFlip's sweep so the two never blur
  boardWin     587 -> 880 Hz rising fifth, 0.38s, RMS 0.098 — lighter than chipsWin (RMS 0.199)
               because up to four boards are won in one hand
⚠️ boardWin WAS NOT IN THE BRIEF. I made it, because the brief was written believing both files
were the win chime; once both were silence, shipping an audible loss beside a silent win would have
inverted the feedback. It is its own commit and one `git revert` away if you disagree.

ALL HASHES DISTINCT — PROVEN: 11 .wav files, 11 distinct sha256. Was 3 sharing 3c395893…, now
boardWin ea810071…, boardLose 43079b59…, revealStart 679de3d2….

THE CHECK STAYS: tests/sound-assets.test.ts, in the jest suite. It asserts BOTH distinctness AND
signal, and that is the point — ⚠️ A UNIQUENESS CHECK ALONE WOULD HAVE PASSED HAPPILY ON THREE
DIFFERENT SILENT FILES. It also refuses to pass on an empty set, and checks every declared
SoundName resolves to a file that exists. PROVEN TO FAIL: with the March file planted back it fails
on exactly the right two assertions (duplicate hash, and peak 0), and passes with the real files.

⚠️ THE THREE "SOUNDNAMES WITH NO FILE" — THAT CLAIM WAS ALSO MINE AND ALSO WRONG. turnReveal,
riverReveal and boardTransition are NOT missing. They deliberately reuse cardFlip / chipsWin /
cardPlace at distinct volumes (utils/sounds.ts:62-64) and all three are played from
BoardReveal.tsx:320/338/440/474. All 14 declared names resolve to a real file; the new test enforces
it. Nothing to provide, nothing to remove.

⚠️ I CANNOT HEAR ANY OF THESE. Verified by waveform and hash only — duration, dominant frequency
per quarter, contour direction, peak amplitude, no clipping, no click at either edge, and
distinctness from every other file. LISTENING IS ROYE'S DEVICE TAP. `python3
scripts/generate-reveal-sounds.py --verify` prints the whole table from the files on disk.

=== 7 · "HAVE PLAYED" — CANONICAL DEFINITION, WRITTEN INTO CLAUDE.md ===
QUOTE 25, BY games_played > 0, AND NAME THE COLUMN.
  25  leaderboard.games_played > 0   the SERVER-credited count. Written only by
      tg_hand_history_leaderboard_counters, which since CLOSE-S2 runs for service_role only — so it
      is the one number that cannot be forged. ← the default
  26  leaderboard.hands_played > 0   caller-supplied through submit_score, never gated. A DISPLAY
      stat, forgeable; must never size the player base.
  10  distinct hand_history.device_id  devices with a stored hand ROW. Lower because practice hands
      are not written and 23 of the 25 pre-date the current write path.
If a number in a report is not one of these three, it is wrong.

=== 8 · THE FLOAT-VS-LEDGER GAP — WHAT IT WOULD TAKE. NOT BUILT. ===
Written out in docs/deep-audit-2026-09-10/FINDINGS.md §"computing the gap". Short form: one
SECURITY DEFINER function (sum(chips) vs sum(amount) plus the per-device breakdown), NAME WHICH
COLUMN (leaderboard carries both chips and total_chips, equal on all rows today, enforced by
nothing), state the epoch it is asserted from, and know the one structural hole it exists to watch
— leaderboard.total_chips has a column DEFAULT 2000 which is NOT a ledgered event and reconciles
only because trg_ledger_starting_grant writes the matching row on INSERT, so any path that bypasses
that trigger opens a silent per-device gap of exactly 2,000. Then wire it beside the class detector
in cron 37 and PROVE IT CAN FAIL before trusting it.
⚠️ NOT BUILT, on instruction. Step "state the epoch" is a judgement, not a migration.
⭐ ONE THING MEASURED THAT NOBODY HAD ESTABLISHED: all 403 devices reconcile INDIVIDUALLY — per-
device chips = per-device sum(amount) on every row, 0 exceptions, and 0 rows on either side carry a
NULL device_id. The aggregate zero is not two errors cancelling out.

=== PRODUCTION AFTER, RE-MEASURED ===
405 devices (403 at session start — two arrived while I worked) · 25 have played by games_played
(26 / 10 by the other two columns) · 78 hands · 15 bindings · ledger gap 0 · max chips 3,250 ·
purchases 0 · archive 4,237 intact · class detector 0 violations · tripwire {"ok":true,"fired":
false,"findings":0} · 9 rooms all waiting, 0 room_players · 31 active crons · iap_enabled false ·
web_payments_enabled false · pot_per_board 25 · starting_chips 2000 · hand_rake_pct 5.
Economy, flags, cue, layout and card sizes: untouched.

=== NEVER VERIFIED — unchanged, stated once ===
Native iOS rendering on a real device — which now includes THE THREE NEW SOUNDS, the only defect
this project has ever had that is heard rather than seen. The bug reporter's media path end to end.
Two real clients in one room. Multiplayer under load.

=== THREE RANKED NEXT STEPS ===
1. Tap the three sounds on a device. They are the one deliverable here that no instrument can sign
   off, they are on the screen that teaches the game, and boardWin is a call I made beyond the
   brief that you may want reverted.
2. Decide the two drifted Edge Functions (whatsapp-bot-handler v70, crash-analyzer v17). They run
   an Empire-HQ transport the repo has never held; the next person who deploys either from the repo
   silently reverts the egress route and every WhatsApp send fails. Committing the deployed source
   is a 20-minute job and removes a live landmine.
3. Find out why production was serving the unmerged landing page, before it happens with something
   that matters more than a capital letter.

Commits on origin/main: b3ceac1 (head) · 6a50647 · 48cbf47 · from ef55640.
