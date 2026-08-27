# Content engine — capture, cut, queue

Ten vertical videos built from the real app, ready before the social accounts exist.
**Nothing here publishes anything, and nothing here can.**

## Where the files live — NOT in this repo

    ../caps-content/raw/     the raw 486x864 WebM takes + manifest.json
    ../caps-content/out/     the ten 1080x1920 MP4s + queue.json

`../caps-content` is a sibling of the repo, outside it, and is never added to git. Video is
large, binary and regenerable; a repo is the wrong place for all three. Override with
`CONTENT_DIR=/somewhere/else`. Only the *tools* and the *scripts* (`tools/videos.json`) are
version-controlled — the videos are an output of them, and re-running rebuilds every one.

## Run it

```bash
npx expo export -p web --output-dir web-slot-dist   # a build to film
node tools/find-seeds.mjs      # which seeds produce a win / a tie   -> tools/seeds.json
node tools/capture.mjs         # five scenes                          -> ../caps-content/raw
node tools/find-action.mjs     # where the splash ends in each take   -> raw/manifest.json
node tools/cut.mjs             # ten finished videos                  -> ../caps-content/out
```

`CAPS_BROWSER_PATH` points at Chromium where the container's Playwright build needs it;
`CAPS_ENGINE=webkit` runs the second engine.

## The practice-only rule is code, not a promise

Nothing published may contain a real player's data, so it is three independent mechanisms:

1. **`openGame()` cannot be pointed anywhere else.** It takes a seat count, not a path, builds
   the practice URL itself, and asserts it before navigating. There is no argument that reaches a
   live table.
2. **The network is blocked.** Every context aborts `supabase.co` and `ftable.co.il`.
3. **It films a local export.** Production is never contacted.

Practice hands are dealt client-side (`utils/deck.ts`), so the cards belong to nobody.

**The rig therefore creates no devices** — it never reaches the database. That is a stronger
guarantee than cleaning up afterwards, and it is checkable: `device_identity` bindings and
`game_rooms` rows stay flat across a capture run.

## What was measured rather than assumed

| Question | Answer | How |
|---|---|---|
| Recorded format | VP8 in WebM, **25 fps**, yuv420p | `ffprobe` on the take |
| Vertical without cropping | **Yes** — 486x864 is exactly 9:16 and the game screen has **zero overflow** at it | `scrollHeight - clientHeight = 0` |
| Why 486 wide | the app's own phone layout ends at `W < 500` (`getDevice`), so 486 is the widest true 9:16 that stays a phone | `constants/deviceBreakpoints.ts` |
| Does `recordVideo.size` scale up? | **No.** It is a canvas: a 393x852 page landed in the corner of a 1080x1920 frame, 83% grey | measured |
| Does video honour `deviceScaleFactor`? | **No** — 2.5x and 3x changed nothing | measured |
| Final resolution | 1080x1920, upscaled 2.222x in ffmpeg, no crop, no pad | `ffprobe` on the MP4 |

The upscale is a real cost: the result is softer than a native 1080-wide capture would be. There
is no way to get one — Playwright records CSS pixels, and a 1080-CSS-pixel viewport would put the
app in its desktop layout.

## ffmpeg

System **ffmpeg 6.1.1** (`libx264`, `libfreetype`/drawtext, `libass`). The ffmpeg **bundled with
Playwright cannot do this job**: it is built `--disable-everything` with only VP8, scale/pad/crop
and the WebM muxer — no drawtext, no H.264.

## The three constraints are assertions, not intentions

`tools/cut.mjs` throws rather than producing a file that breaks any of these:

- **under 60s** — the render is re-probed after muxing, not trusted from the command line
- **hook in the first 0.5s** — the first caption cue must start at `t=0`
- **no audio dependency** — muxed with `-an`, so there is **no audio stream at all**; "works
  muted" is a property of the file, and the build fails if a stream ever appears

Captions are **burned in**, because most of this viewing is silent and platform auto-captions are
not guaranteed.

## Two things that were only visible by looking

- **The hook was a loading screen.** Playwright records from context creation, so every take opens
  with the CAPS POKER splash — measured at 1.6s. The first cut put the hook caption over it: right
  duration, right dimensions, right caption timing, wrong first half-second. `find-action.mjs` now
  measures where the game actually appears and `cut.mjs` offsets every spec by it.
- **The "tie" video was a win.** The seed search classified the opponent's score as
  `boardsTotal - boardsWon`, which assumes every board the player did not win was won by the bot.
  **An individual board can tie.** Seed 4 is 2-1 with one board tied and the app says *YOU WIN*;
  it was about to ship captioned "Nobody wins". The scoreboard is now read, not derived, and the
  tie scene uses seed 5 — 2-2, headline *TIE GAME*.

## Publishing

There is no publishing code here and no credential is read, stored or accepted anywhere in these
tools. `../caps-content/out/queue.json` is a **queue, not a schedule**: ten files with their hook,
payoff and caption. See `docs/CONTENT-ENGINE-2026-08-27.md` for what the Meta and TikTok posting
APIs require and which half of it can be prepared before an account exists.
