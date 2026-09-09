# CAPS Poker — First Facebook Post

VAMOS CAPS FIRST-POST. One opening post to the Capspokerapp Page, branch
claude/vamos-caps-align-celebration-flppo0. Instagram and TikTok skipped — neither
had a `capspokerapp` session (Instagram still logged in as `featuretable1`; TikTok
has no session and `@capspokerapp` doesn't resolve).

## Video verified before posting

Downloaded `caps-explainer-FINAL.mp4` from
`https://vjxqlqtlywovnbidovit.supabase.co/storage/v1/object/public/bly-review/caps/caps-explainer-FINAL.mp4`
and checked it byte-for-byte before trusting the filename:

- Size: **5,358,156 bytes** — matches exactly.
- SHA-256: **fb456341645d554b50b48dfaff9eea446c5d628fbe835239e11f63e9382b9ec** — matches
  the prefix given in the brief.
- ffprobe: h264 video (1080x1920, yuv420p) + aac audio, 29.64s duration — standard,
  browser-playable codec.

## End card checked on the file itself

Extracted the last-second frame with ffmpeg (`video-endcard-source-verified.png`):
reads only **"CAPS POKER" / "caps.ftable.co.il"** on a plain green background. No
App Store, no Google Play, no "coming soon," no download language.

## Caption used (unchanged)

```
CAPS Poker — poker played across several boards at once.
Four cards on every board. Win the most boards, win the hand.

Free to play in your browser. No sign-up.
caps.ftable.co.il
```

Checked against the banned list before posting: no store references, no Google Play,
no player counts or ratings, no "download," no real-money language. Clean.

## Posted to

**Facebook only** — https://www.facebook.com/reel/1713831943032204 (posted as a Reel;
Facebook auto-classified the 9:16 sub-30s video). Instagram and TikTok were not
attempted — their sessions don't belong to `capspokerapp` (re-checked at the start of
this sprint, same result as the prior session).

## Verification

- **Published post seen after a fresh reload**: both as Page-admin
  (`admin-view-published.jpg`) and as the non-admin personal account, Roye Arguan
  (`visitor-view-published.jpg`) — public post, correct caption, video thumbnail
  matches the real file.
- **Video watched playing in the post, not inferred**: opened the live Reel
  (`reel-playback-live.jpg`) and watched ~25s of real playback — full color, correct
  gameplay footage, no black frames, narration captions rendering — before relying on
  the pre-upload frame extraction for the exact end-card content (the live player kept
  looping before a screenshot could land exactly on the last frame, but the transcode
  clearly did not fail: no black rectangle at any point, audio/caption overlays intact).

## Refused / friction

Nothing was refused by Facebook. The only pause was the built-in "Checking for
copyrighted content" scan, which cleared before Next was clickable.

## Not done

- Facebook name change (`Capspokerapp` → `CAPS Poker`): not attempted this sprint —
  Roye decided to leave it as-is per the FIRST-POST brief.
- Instagram, TikTok: not posted, no session for `capspokerapp` on either.

Nothing scheduled beyond this one post. No password typed or requested. No security
setting touched.
