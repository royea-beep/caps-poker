CAPS - CONTENT-ENGINE: ten videos exist, the rig cannot reach a real player, and two of the ten
were wrong until I looked at them (2026-08-27)

MAP: vamos_handoffs id 116. main f8d910a + this sprint's tools/. Live bundle index-477bf329,
UNCHANGED - nothing about the app shipped. No app, component, constant, util or store file
touched. jest 2,654/2,654, tsc clean. No schema change, no DB write beyond this handoff.
NOTHING PUBLISHED. NO ACCOUNT CREATED OR SCRIPTED. NO CREDENTIAL HANDLED.

=== 1 - THE CAPTURE RIG ===

  tools/content-lib.mjs   serving, the practice guard, the browser, determinism
  tools/find-seeds.mjs    which seeds produce a win / a tie
  tools/capture.mjs       the five scenes
  tools/find-action.mjs   where the splash ends in each take
  tools/cut.mjs           the ten cuts, with the constraints as assertions
  tools/videos.json       the scripts
  tools/README.md         how to run it and what was measured

FORMAT, MEASURED OFF THE FILE: Playwright records VP8 in WebM at 25 fps, yuv420p. The finished
videos are H.264 MP4, 1080x1920, 25 fps, yuv420p, +faststart, NO AUDIO STREAM.

VERTICAL WITHOUT CROPPING: YES. Nothing is cropped and nothing is padded. 486x864 is exactly
9:16 and the game screen has ZERO OVERFLOW at it (scrollHeight - clientHeight = 0), so the app
fills the vertical frame by itself. 486 is chosen because the app's own phone layout ends at
W < 500 (getDevice, constants/deviceBreakpoints.ts) - 486 is the widest true 9:16 that is still a
phone rather than the tablet layout.

TWO THINGS I ASSUMED AND HAD TO MEASURE. `recordVideo.size` is a CANVAS, not a scale target: a
393x852 viewport inside a 1080x1920 canvas put the page in the corner with 83% grey around it.
And video IGNORES deviceScaleFactor - 2.5x and 3x changed nothing. So the viewport has to carry
the shape, and ffmpeg does the 2.222x upscale to 1080x1920.
THE COST, STATED: it is an UPSCALE, so the result is softer than a native 1080-wide capture. There
is no way to get one - a 1080-CSS-pixel viewport would put the app in its desktop layout.

MOMENTS CAPTURED - the five the brief names:
  felt        the four-day-old green surface, held still, with the slot outlines raised yesterday
  autoplace   Auto-Place ALL filling sixteen cards across four boards in one tap
  reveal      board after board turning over
  win         a sweep, 4-0, with the gold winner cue landing
  tie         2-2, headline "TIE GAME"

THE SEEDS ARE NOT LUCK. Practice deals from Math.random, which the rig pins, so a seed is a
reproducible hand. find-seeds.mjs played out a range and recorded what the APP said each result
was: WIN 3, 7, 14, 15, 16 · SWEEP 8 · TIE 5, 9, 10, 12. The scenes name seeds, so the win and the
tie come out the same every run rather than being re-rolled until something photogenic happened.

PRACTICE-ONLY, ENFORCED IN THE TOOLING - three independent mechanisms in content-lib.mjs, any one
of which would be sufficient:
  1. openGame() takes a SEAT COUNT, NOT A PATH. It builds the practice URL itself and asserts it
     before navigating. There is no argument a caller could pass that reaches a live table.
  2. Every context aborts supabase.co and ftable.co.il at the route layer.
  3. It films a LOCAL export from localhost. Production is never contacted.
Practice hands are dealt client-side (utils/deck.ts), so the cards belong to nobody. Checked the
finished frames too: the results screen shows "Practice vs bot - XP only, no chips", "Bot" and
"YOU". No player name, no device id, no invite code anywhere in the ten.

DEVICES: THE RIG CREATED NONE, which is stronger than cleaning up after it. It never reaches the
database. Measured across the capture run: device_identity bindings in the window 0, game_rooms 0,
v_automation_devices unchanged at 28.
⚠️ WHAT DID TOUCH PRODUCTION TODAY, and it is not this rig: the BackstopJS baseline workflow and
bootstrap-storage-state.js visit the live site by design, and created 4 automation-classified
devices (8772-a7b0-56d2, d7c4-3725-2803, fc60-a6f8-d677, a037-f3ab-8068). They are last sprint's
tooling, not this one's, and I have NOT deleted them - the brief scopes cleanup to what the rig
creates, and deleting rows nobody asked about is the failure this project keeps guarding against.
⚠️ AND A FIFTH DEVICE THAT IS NOT AUTOMATION. e0ce-805f-08e6, platform "ios", webdriver false,
21:48 today: opened the app, auto-claimed a daily bonus, then stuck_dwell 30000ms and left without
starting a game. That reads as a REAL PERSON on an iPhone who bounced at the home screen after
thirty seconds. Untouched, and worth someone's attention.

=== 2 - THE CUT ===

CUT TOOL: system ffmpeg 6.1.1 - libx264, libfreetype (drawtext), libass. Installed this session.
⚠️ THE FFMPEG BUNDLED WITH PLAYWRIGHT CANNOT DO THIS JOB: it is built --disable-everything with
only VP8, scale/pad/crop and the WebM muxer - no drawtext, no H.264 at all. Worth knowing before
anyone assumes a working ffmpeg is already present.

THE THREE RULES ARE ASSERTIONS THAT FAIL THE BUILD, not notes:
  UNDER 60s      cut.mjs throws above MAX_SECONDS, and RE-PROBES the muxed file rather than
                 trusting the command line. Longest of the ten is 20.0s.
  HOOK IN 0.5s   the first caption cue must start at t=0; a spec whose first cue starts later is
                 refused outright.
  NO AUDIO       muxed with -an, so there is NO AUDIO STREAM AT ALL, and the build fails if one
                 ever appears. "Works muted" is then a property of the file rather than a taste
                 claim - verified with ffprobe on all ten: zero audio streams.
CAPTIONS ARE BURNED IN as pixels (drawtext, DejaVu Sans Bold, white on a 72% black box, lower
third), because most of this viewing is silent and platform auto-captions are not guaranteed.

=== 3 - TWO OF THE TEN WERE WRONG, AND ONLY LOOKING FOUND IT ===

1. THE HOOK WAS A LOADING SCREEN. Playwright records from CONTEXT CREATION, so every take opens
   with the CAPS POKER splash - measured at 1.6s in all five. The first cut put the hook caption
   over it. Duration correct, dimensions correct, caption timing correct, and the most important
   half-second of a social video was a loading screen. Nothing numeric would have caught it.
   find-action.mjs now MEASURES where the game appears (felt share and card-face share crossing a
   threshold) and cut.mjs offsets every spec by it, so a spec's `start` means "seconds into the
   action". Verified after: all four sampled hook frames are 53-73% felt with cards present.

2. THE TIE VIDEO WAS A WIN. The seed search classified the opponent's score as
   `boardsTotal - boardsWon`, which quietly assumes every board the player did not win was won by
   the bot. AN INDIVIDUAL BOARD CAN TIE. Seed 4 is 2-1 with one board tied and the app's own
   headline is YOU WIN - and it was cut and captioned "Two boards each / Nobody wins". A video
   that says the opposite of the screen behind it, about to go out under the project's name.
   The scoreboard is now READ, not derived, and the scene uses seed 5: 2-2, headline "TIE GAME".
   (The same pass also found my headline regex matching the "Tie" inside "Tier 2" in the XP block.
   It never drove a classification - those come from the scoreboard - but it was reported.)

=== 4 - THE TEN ===

Files: ../caps-content/out/*.mp4 with queue.json. 1080x1920, 25fps, no audio, 163s total.

  FIVE GAMEPLAY
  play-autoplace   9.0s   "16 cards. One tap."          -> every board filled at once
  play-reveal     17.0s   "One hand. Four boards."      -> each resolves separately; that is the game
  play-win        17.0s   "Take one board? Fine."       -> take all four; gold marks the cards that won
  play-tie        17.0s   "Two boards each."            -> a tie is a result, not a bug
  play-felt        9.0s   "This green is four days old" -> we measured it instead of arguing

  FIVE DEVELOPMENT
  dev-signin      20.0s   "Our sign-in button was invisible" -> for four months; the code asked
                          "is there a user?" and an anonymous player IS a user, so it always said yes
  dev-invite      20.0s   "We issued 3,140 invite codes"     -> none worked; the database made 8
                          characters, every screen accepted 6
  dev-achievements 18.0s  "Our achievements screen said 0/36" -> to everyone, always; server and app
                          never agreed on one field name
  dev-wcag        18.0s   "We have a test that measures contrast" -> it was running on a screen a
                          tutorial overlay had dimmed. Nobody noticed for weeks
  dev-tie         18.0s   "When a hand tied"                 -> we told BOTH players they lost; the
                          code knew win and not-win, and a tie is neither

FIVE AND FIVE: confirmed. ENGLISH: confirmed, all ten. NO STORE-DATE PROMISE: confirmed - every
call to action is "Play free in your browser", and a grep for App Store / Google Play / coming
soon / soon over videos.json and queue.json returns only the line in the header FORBIDDING them.

⚠️ THE DEV FOOTAGE IS THE CURRENT BUILD, NOT THE BUG. Every one of these defects is fixed, so none
can be filmed. The captions tell what went wrong over footage of the app as it is today, and no
caption claims to be showing the defect. That is written into videos.json so nobody later mistakes
the B-roll for a reproduction. Every story is true and is in vamos_handoffs; the numbers - four
months, 3,140, 8 vs 6, 0/36 - are the numbers from the reports.

=== 5 - THE POSTING APIS: WHAT EACH NEEDS, AND THE SPLIT ===

Fetched from the current official docs rather than recalled.

META / INSTAGRAM CONTENT PUBLISHING
  - a PROFESSIONAL (business or creator) Instagram account connected to a Facebook Page
  - a Meta app, and Page Publishing Authorization completed
  - permissions: instagram_business_basic + instagram_business_content_publish (Instagram Login),
    or instagram_basic + instagram_content_publish + pages_read_engagement (Facebook Login;
    ads_management/ads_read too if the Page role comes via Business Manager)
  - an Instagram User access token, or a Page access token
  - App Review for those permissions before it works for anyone but the developer
  - media_type REELS for a reel, and THE MEDIA MUST BE ON A PUBLICLY ACCESSIBLE URL
  - 100 API-published posts per rolling 24 hours

TIKTOK CONTENT POSTING API
  - a registered app on TikTok for Developers with the Content Posting API product added and
    Direct Post enabled
  - the video.publish scope, approved for the app AND authorized by the target user
  - an access token and the user's open_id
  - domain or URL-prefix verification to pull video from a hosted source
  - MP4 + H.264, which is exactly what tools/cut.mjs produces
  ⚠️ AND THE ONE THAT DECIDES THE ORDER OF WORK: "All content posted by unaudited clients will be
    restricted to private viewing mode." Until the app passes TikTok's audit, everything posted
    through the API is visible to nobody. Wiring it up early does not buy an early launch.

PREPARABLE NOW, BEFORE ANY ACCOUNT EXISTS:
  - the videos themselves, in the exact formats both APIs want (H.264 MP4, 9:16, 1080x1920) - done
  - the captions and the queue - done
  - PUBLIC HOSTING FOR THE TEN FILES. This is the one piece of infrastructure worth building
    early, because BOTH APIs PULL MEDIA FROM A URL rather than accepting an upload from us: Meta
    requires a publicly accessible server, and TikTok requires a verified domain or URL prefix. A
    host serving ../caps-content/out over HTTPS on a domain that can later be verified satisfies
    both, and needs no account to stand up.
  - the request shapes and the retry/rate-limit budget (Meta's 100/24h) can be written against the
    published contracts.

NOT PREPARABLE, AND NOT ATTEMPTED:
  - the accounts themselves, on any platform, for any purpose
  - app registration, scope approval, App Review, TikTok's audit
  - any token, secret or authorization
None of these were attempted or scripted. There is NO posting code and NO credential path in
tools/ - grep it: nothing reads an access token, and nothing calls a platform endpoint.

=== 6 - WHERE THE FILES LIVE ===

  ../caps-content/raw/   the five raw 486x864 WebM takes + manifest.json
  ../caps-content/out/   the ten 1080x1920 MP4s + queue.json
32 MB, a SIBLING of the repo and outside it, never added to git. Video is large, binary and
regenerable, and a repo is the wrong place for all three. Only the tools and the scripts
(tools/videos.json) are version-controlled - re-running rebuilds every video from them.

=== 7 - PRODUCTION UNCHANGED ===

Nothing about the app shipped. No app/, components/, constants/, utils/, store/ or supabase/ file
touched - git diff against main is empty for all of them. Live bundle index-477bf329 unchanged.
iap_enabled=false · web_payments_enabled=false · hand_rake_pct=5 · rewarded_ad_chips=100 ·
rewarded_ad_max_daily=5 · rewarded_ad_enabled=true - all as found, none written.
purchases 0 · chip_purchases 0 · 0 active missions · v_automation_devices unchanged at 28.
Faucet, rescue, ad amount, rake, record_hand_net and record_reward untouched. RevenueCat and App
Store Connect untouched. KILL_Board NOT flipped - the slot outline values are calibrated against
it. Felt, panels and cues untouched. No game_rooms or room_players row hand-edited. No repository
setting changed.

=== 8 - STILL OPEN ===

  - PUBLIC HOSTING is the next buildable thing and the only one that unblocks both APIs.
  - THE UPSCALE. 486->1080 is soft. If it matters, the fix is not in this rig: it needs a capture
    path that is not Playwright video, e.g. per-frame screenshots at deviceScaleFactor 3, which
    would be crisper and would sample animation unevenly. A real trade, not yet needed.
  - A REAL PERSON BOUNCED AT THE HOME SCREEN TODAY after 30 seconds without starting a game
    (e0ce-805f-08e6). One visitor is not data, but it is the first one in a while and the funnel
    it fell out of is the one all ten of these videos point at.
  - NATIVE HAS STILL NEVER BEEN EXERCISED in 108-116.
  - No real 3-player tie yet; there has never been an attributable 3-player hand in production.
