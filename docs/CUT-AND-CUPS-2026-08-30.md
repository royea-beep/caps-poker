# CUT AND CUPS — twenty gone, and the cup idea tested honestly

**2026-08-30 · nothing shipped · nothing installed · renders only.**

One sheet for the choice: **`docs/thirty-directions/_finalists-393.png`** (and `-320.png`).
Icon evidence: `_icon-test.png`. Measurements: `cup-floor-audit.json`, `icon-legibility.json`.

---

## 1 · THE TWENTY CUTS — agreed, all twenty

I agree with every cut, and the three reasons given are the right three. They match my own
scoring table from the last sprint rather than overriding it, which is worth saying: the panel
and the measurements independently landed on the same twenty.

- **UI, not art** — `B1` `B2` `G1` `G3` `I3`. This is the sharper version of my own finding.
  I said the format "does not photograph"; the panel says *a picture of the interface cannot be
  the thing that makes someone want the interface*. That is the better sentence and it
  generalises further than mine did — it also explains `G1` and `G3`, which I had cut for
  weaker reasons.
- **The chips column** — `H1` `H2` `H3`. Agreed, and the legal-strip argument is the decisive
  one. I raised it last sprint as a footnote; it deserves to be the reason. A hero arguing with
  its own footer is a worse problem than a flat-looking chip.
- **Nothing is there** — `A3` `E3` `D2` `D3` `C3` `F3`. Agreed without reservation.
- **Also cut** — `A1` `B3` `E2` `G2` `I2`. Agreed.

**The closest call was `G2`**, and I want it on the record rather than silently dropped. It is
the only direction in thirty that shows a *moment* rather than an object — the instant of
winning, gold type over lit cards. Its five contrast failures are all the same five-minute fix
(the losers are dimmed to `brightness(0.38)`, which makes their own rank glyphs illegible). But
the panel is right that it is still a results-screen shape, and I would not spend the fix on it
now. If a future sprint ever wants "the moment" rather than "the object", `G2` is where to
restart.

On `I2` — agreed, and the reasoning is exactly right. Gold ground versus the mint control set
is a fight the mint loses, and that is a palette decision far larger than a hero image.

**Ten survive:** `J2` `A2` `I1` `C1` `F1` `F2` `E1` `D1` `J1` `J3`. Not re-rendered — verified
byte-identical by sha256 before and after this sprint's work.

---

## 2 · `C1` AT 60px — you are right, I was wrong

I put `I1` in the top three and left `C1` out. The measurement says that was backwards.

`tools/thirty-directions/icon-legibility.mjs`, run on the real 60px renders:

| | subject % | contrast | regions ≥1% | crispness |
|---|---|---|---|---|
| **C1** ace of spades | **48.8** | **18.73 : 1** | 1 | **0.557** |
| **I1** one spade | 34.5 | 8.71 : 1 | 1 | **0.155** |

`C1` is **1.4× larger** in the square, **2.2× the contrast**, and **3.6× crisper**. `I1`'s
crispness of 0.155 is the lowest of all seven candidates measured — gold on near-black, with a
drop-shadow glow, has soft edges, and soft edges are the first thing 60 pixels destroy. I had
scored `I1` on "there is nothing in it to lose", which turned out to be an assumption about the
silhouette rather than a look at it.

**So: agreed, `C1` beats `I1` at 60px, and it goes into my top three.**

*What the numbers do not settle:* at 60px `C1`'s corner rank glyphs are gone, so it reads as
"a playing card", not "the ace of spades". That is fine — "a playing card" is the right message
for a poker app, and `I1` reads as "a spade", which is no more specific. But four good numbers
cannot tell you a shape is recognisable; a blank white rectangle would score the same. That part
was decided by looking, and the tool says so in its own header.

---

## 3 · WHAT A CUP ACTUALLY LOOKS LIKE IN THE APP

Checked before anything was drawn, because inventing one creates a second brand.

**It is the 🏆 emoji.** `app/(tabs)/cups.tsx` renders each cup as `<Text style={{fontSize: rf(26)}}>🏆</Text>`
inside a 52pt rounded square filled with the tier colour. That is the entire asset. There is no
cup illustration, no SVG, no PNG — `assets/` holds icons, a splash and sounds, and nothing
cup-shaped. The five tiers come from the `cups` table and are used verbatim here:

| tier | id | colour | earned at |
|---|---|---|---|
| 1 | bronze | `#CD7F32` | 10 hands won |
| 2 | silver | `#C0C0C0` | 50 |
| 3 | gold | `#FFD700` | 100 |
| 4 | platinum | `#E5E4E2` | 150 |
| 5 | diamond | `#B9F2FF` | 200 |

**`K0` renders the real emoji beside a drawn cup at the same size** — because "use the real
thing" is only usable advice once you have seen what the real thing looks like at hero size.
Two facts follow, and both are costs:

1. **The emoji is platform-drawn.** Noto here, Apple's on Roye's phone, something else on
   Android. A hero whose subject changes shape per platform is not a brand mark. That is a fact
   about colour emoji, not an opinion about this one.
2. **A drawn cup obliges the Cups tab to adopt the same mark**, or the app ships two different
   trophies. Every cup direction below is therefore marked `needs designer` — not because the
   render is weak, but because the decision is not a rendering decision.

*(Noted in passing, not this sprint's job: `cups.tier` is an **integer** in the database while
`TIER_LABELS` in `cups.tsx` is keyed by the strings `bronze`…`diamond`, so `TIER_LABELS[cup.tier]`
is always `undefined` and every row falls through to `cup.name_he`. Worth a look in a sprint
that owns that file.)*

---

## 4 · EIGHT CUP DIRECTIONS, PLUS A CONTROL

Eight heroes (`K1`–`K8`), one control (`K0`), and one planted instrument canary (`ZZ`). Renders
at 393 and 320 in `docs/thirty-directions/`; all of them are in the finalist sheet.

| | stops a thumb | survives 60px | says **CAPS**, not "a poker game" | floor |
|---|---|---|---|---|
| **K3** one cup, enormous, cropped | **yes** — the only cup that does | **yes** — 47.8% / 14.03 : 1 / 1 region | no — it says *trophy*, which is any game | pass |
| K7 cup catching falling cards | mildly | weak — 23.3% subject, **2 regions** | partly — cup + card together | pass |
| K5 a cup and a card | mildly | ok — 39.9% / 13.18 : 1 / 1 region | partly, same reason | pass |
| K1 cups falling | **no** — see motion below | not tested; the still does not work | no | pass |
| K6 cup inside the wordmark | no — "C🏆PS" loses the word | **no** — 9.3% subject, **4 regions**, worst measured | it is the only *brand* idea here | pass |
| K4 five tiers stacked | no — reads as a totem, not a hero | no | partly — the collection is visible | pass |
| K2 cascade, many tumbling | no — reads as brown clutter | no | no | pass |
| K8 the collection, three of five | no — **this is an achievements screen** | no | yes, and it is the reason it fails | 2 contrast |

`K8`'s two failures are real and small: the locked-tier labels `PLATINUM` and `DIAMOND` at 9px
sit at 3.03 : 1 and 3.06 : 1 against a 4.5 bar, because the locked styling dims label and ground
together.

---

## 5 · MOTION

**Only `K1` needs it, and the still is its own key frame.**

`K1` draws four cups mid-air with cast shadows sized and offset for height. It does not read as
falling — it reads as *placed*, because a still image cannot distinguish "above the felt" from
"on the felt" without motion blur or a much more extreme perspective. The render at
`K1-393.png` is the key frame; the direction only works if it moves.

I am not recommending it, for a reason that predates this sprint: handoff 124 established that
**art is what is missing, not motion**, and that the home screen's existing motion is 4 of 145
elements, three of them at 0.13 opacity. Adding a falling-cup animation would be spending the
scarce thing (design attention) on the axis that was already measured as not being the problem.
`KILL_Board` is untouched and this would not have gone near it — a home hero is a different code
path — but "we could" is not "we should".

---

## 6 · THE INSTRUMENT, RE-VERIFIED BEFORE ANY NUMBER WAS TRUSTED

The audit has been wrong three times in this sprint series, and every one of those wrong runs
looked plausible. So this run carries a **planted canary** rather than a re-check by eye.

`ZZ` renders two lines on the same black ground:

```
#2a2a2a on #0a0a0a   → must FAIL     measured 1.38 : 1 against a 4.5 bar   ✓ reported FAIL
#f0ead6 on #0a0a0a   → must PASS     not flagged                            ✓ reported PASS
```

The instrument caught the planted failure and did not false-positive on its good sibling, in the
same run that produced every other number here. If `ZZ` had passed, no number in this document
would have been reportable.

**And the canary earned its keep immediately** — a *second* instrument, the 60px legibility
tool, was caught being wrong on its first run. It reported `J2` at **96.7% subject area**, which
is not a finding about `J2`: `J2` has a strong inset vignette, so its corners are dark and my
"ground = the corners" heuristic took the vignette for the ground and counted the entire cream
field as subject. It now compares the corner ground against the full border ring and flags any
tile with an implausible subject area as **UNRELIABLE** instead of scoring it. `J2`'s row is
flagged; `C1`, `I1` and every cup row read true-black corners (ground 0.003–0.006), so the
`C1`-vs-`I1` comparison in §2 is unaffected.

---

## 7 · DID THE CUP IDEA WORK? MOSTLY NO

Asked for honestly, so: **the cup motif did not deliver, and I would not lead with it.**

The brief predicted the failure mode exactly — *"a cup is a trophy, and trophies are a
reward-screen object"* — and that is what happened. `K8` is literally an achievements screen.
`K4` is a progress list stood on end. `K3` is the one that stops a thumb, and what it says is
"you have unlocked something", not "this is a poker game".

But the deeper reason is the one this sprint series already found once, in a different costume:

> The cups are a **collection system**. A collection is a systems fact, and systems facts are
> read, not seen — the same way multiple simultaneous boards were. A picture of one trophy
> conveys "there is a trophy" exactly as well as a picture of four boards conveyed "boards run
> at once", which is to say not at all. `K8` is the direction that genuinely shows the
> collection, and `K8` is the worst one.

So the strategic argument for cups — *nothing else in poker has this* — is true and does not
transfer to a hero image. It is a real differentiator for the **store listing copy**, for a
**secondary screenshot**, and for retention. It is not a first frame.

**Three things I would keep from the attempt:**

1. **`K3` is a genuinely strong image** and the best-measured cup. If Roye wants a cup hero, it
   is `K3` and nothing else. My reservation is what it *says*, not how it looks.
2. **`K6` is the only real brand idea in the set** — a cup as a letter in the wordmark. It fails
   at 60px badly (9.3% subject, 4 regions, worst of everything measured) and "C🏆PS" is hard to
   read as a word. But a designer could make a cup-and-A ligature work where my substitution
   does not, and that would be a mark no competitor could copy. It is the one cup idea worth a
   designer's hour.
3. **The five tier colours are an unused asset.** Bronze through diamond is a real, owned,
   five-step palette sitting in the database and used at 52pt in one tab. That is more likely to
   be worth something than the trophy shape is.

---

## 8 · MY TOP THREE OVERALL

Across all thirty-eight. The cup family does not place, and §7 says why.

1. **`J2` · card stock, extreme close.** Unchanged. Stops a thumb, says poker instantly, and it
   is the only light picture in the whole set — a cream field with a red Ace is a hole in a
   store page where every poker app is dark green or black. Cheapest to build: ~25 lines, no
   library, no required asset.
2. **`C1` · ace of spades, centred.** *Promoted on measurement* — see §2. The best 60px
   legibility of everything tested, by every measure taken. It is the icon the other two need.
3. **`A2` · dealer's arc, cropped hard.** The best *screen* and the best store screenshot: real
   cards on real felt with real light, and it is the product's own material rather than a
   metaphor for it. Not an icon — it smears at 60px — so pair it with `C1`.

`I1` drops out, on its own measured crispness of 0.155. `K3` is the best cup and does not make
the three.

**A complete identity, if it helps:** `C1` as the icon, `A2` as the store screenshot, `J2` as the
home hero. Those three do not fight each other — they are the same deck, the same ink, and the
same cream.

---

## 9 · DELIVERY — `cmd.exe`, byte-safe

The copy route does not exist from this session; the `git show` route does, and it writes
straight to Downloads without a checkout, so `main` in the working copy is untouched.
**`cmd.exe`, not PowerShell** — PowerShell's `>` re-encodes and corrupts PNGs.

```
cd /d C:\Projects\POKER\Caps
git fetch origin claude/vamos-caps-align-celebration-flppo0
set R=origin/claude/vamos-caps-align-celebration-flppo0
git show %R%:docs/thirty-directions/_finalists-393.png > "%USERPROFILE%\Downloads\_finalists-393.png"
git show %R%:docs/thirty-directions/_finalists-320.png > "%USERPROFILE%\Downloads\_finalists-320.png"
git show %R%:docs/thirty-directions/_icon-test.png     > "%USERPROFILE%\Downloads\_icon-test.png"
dir "%USERPROFILE%\Downloads\_finalists-*.png" "%USERPROFILE%\Downloads\_icon-test.png"
```

Verify by size — a much **larger** file means it was re-encoded and the PNG is broken.
Any individual direction is available the same way, e.g. `docs/thirty-directions/K3-393.png`.

---

## Nothing shipped · nothing installed · production unchanged

No app source modified. No dependency added. `KILL_Board` and `KILL_game` remain `true` and were
never touched — the one direction that would want motion (`K1`) is a home hero on a different
code path, and it is not recommended anyway. Felt, panels, cues, faucet values, economy, rake,
missions, payment flags and the slot outline values are all untouched. **The ten survivors were
not re-rendered:** sha256 of all sixty original renders taken before this sprint's work and
re-checked after — all sixty byte-identical.
