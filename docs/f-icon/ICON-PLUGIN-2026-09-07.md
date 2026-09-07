# THE ICON PLUGIN — Route 3, 2026-09-07

Roye chose Route 3 and the suits stay. The plugin is built, a prebuild was run, **the emitted files
were opened and read from their pixels**, and the icon is now swapped into `assets/`.

**Prebuild inspection only — no compiled app was produced.** There is no Xcode and no Gradle build
in this container. What is proven is what the native projects contain after `expo prebuild`; what is
not proven is a running binary. The icon ships with the next build.

---

## §1 · The plugin

`plugins/withResponsiveIcons.js`, registered in `app.json`'s `plugins` array.

Expo's own icon handling takes one master and derives every size from it. That can express Route 1
or Route 2, but not option B. This plugin runs **after** Expo has generated the native projects and
overwrites the derived icons with the correct variant at each size.

### The split is read, never retyped

Every variant decision comes from `responsive` in `docs/f-icon/f-icon-build.json`, which the build
script wrote by comparing each size against the threshold `docs/f-icon/threshold.mjs` measured.
**Nothing in the plugin names a size and a variant in the same breath.** The iOS slots are declared
as point size and scale; the pixel size — the one number the decision keys off — is derived. A
number typed twice is eventually typed differently, and the whole point of the sweep was to stop the
boundary being somebody's preference.

If the facts file is missing, or has no measured split, the plugin **throws**. It does not fall back
to a default.

### It copies files and never resamples one

Every pixel size it needs is laid out and measured by `tools/icon/build-f-icon.mjs` — including the
adaptive layers at all five Android densities (108 / 162 / 216 / 324 / 432), added this sprint for
exactly this reason. If a required size is missing the plugin throws rather than substituting a
near-enough file. A plausible-looking icon that nobody rendered is the failure this project keeps
paying for.

### What lands where

| target | content |
|---|---|
| iOS `AppIcon.appiconset` | every iPhone slot, 20pt–60pt at @2x and @3x, plus the 1024 marketing icon |
| iOS 1024 store listing | **FULL** — this is precisely why Route 1 was rejected |
| Android `mipmap-*/ic_launcher.png` and `_round` | the variant the table gives for that pixel size |
| Android adaptive foreground / background / monochrome | **compact**, at every density |
| Play Store 512 | **full** — `docs/f-icon/built/full/icon-512.png`, uploaded separately |
| favicon 64 | **compact** — `assets/favicon.png` |

`ios.supportsTablet` is false, so no iPad slots are written and none are claimed.

## §2 · What actually landed — read from the pixels, not the filenames

`tools/icon/verify-emitted.mjs` opens every emitted PNG and **derives** its variant: the horizontal
bands containing ink are counted, and the full lockup has three (suits, CAPS, POKER) while compact
has two. Only then is that compared against what the measured table says.

### iOS — 9 slots, all correct

| slot | px | read from pixels | expected |
|---|---|---|---|
| 20pt @2x | 40 | compact | compact |
| 20pt @3x | 60 | compact | compact |
| 29pt @2x | 58 | compact | compact |
| 29pt @3x | 87 | compact | compact |
| 40pt @2x | 80 | compact | compact |
| 40pt @3x | 120 | compact | compact |
| 60pt @2x | 120 | compact | compact |
| **60pt @3x** | **180** | **full** | **full** |
| **App Store listing** | **1024** | **full** | **full** |

### Android — 25 files, all correct

Launcher squares: mdpi 48 compact · hdpi 72 compact · xhdpi 96 compact · **xxhdpi 144 full** ·
**xxxhdpi 192 full**, with `ic_launcher_round` matching. Adaptive foreground, background and
monochrome are compact at every density.

**Variant mismatches: 0. `#FFD700` across every emitted file: 0.**

### ⚠️ The control that makes this mean something

The first prebuild was run **with `assets/icon.png` still the old C1 playing card**, deliberately.
If the plugin had looked right and done nothing, every emitted icon would have been a cream card —
the verifier has a branch that reports exactly that. Not one file came back as a card. The icon was
only swapped afterwards, and the prebuild and verification were run again with F as the base, with
the same result.

### ⚠️ And a correction I had to make to my own verifier

The first verification run marked all five `ic_launcher_monochrome.png` files as MISMATCH with
"0 ink bands". The files were right and the test was wrong: my ink test looks for **warm** pixels
(red clearly above blue) to isolate gold from felt, and Android's monochrome asset is a **white**
silhouette on transparent, deliberately, so the system can tint it. White has red equal to blue, so
nothing is warm. Opening `mipmap-xxxhdpi/ic_launcher_monochrome.png` directly showed exactly the two
bright-opaque bands compact should have. Monochrome is now read with a brightness-and-alpha test,
and the warm test is kept for everything else rather than loosened for all of them — a test that
passes everything is not a test.

### The Android mask

Nothing clipped. The safe zone is solved on the **diagonal** at every density, because the block is
wider than it is tall and fitting its width would still push its corners out:

| density | canvas | worst corner | safe radius | clearance |
|---|---|---|---|---|
| mdpi | 108 | 34.9 | 36.0 | 3.0% |
| hdpi | 162 | 52.4 | 54.0 | 3.0% |
| xhdpi | 216 | 69.8 | 72.0 | 3.0% |
| xxhdpi | 324 | 104.8 | 108.0 | 3.0% |
| xxxhdpi | 432 | 139.7 | 144.0 | 3.0% |

## §3 · Swapped in

| file | now |
|---|---|
| `assets/icon.png` | F **full** 1024 (sha `e053fb9f6371`) |
| `assets/adaptive-icon.png` | F full 1024 |
| `assets/android-icon-foreground.png` | F **compact**, 432 adaptive canvas |
| `assets/android-icon-background.png` | felt ground |
| `assets/android-icon-monochrome.png` | F compact, white |
| `assets/favicon.png` | F **compact**, 64 |

`app.json` changed in exactly two places: the plugin was registered, and
`android.adaptiveIcon.backgroundColor` moved from `#1C0508` — a leftover from the **maroon**
identity, the same class of stale value as the `expo-notifications` colour fixed on 2026-09-06 — to
`#003115`, `FELT_GRADIENT.classic[0]`. It is a fallback behind the background image either way.
**No version bump, no build number change, not merged.**

`docs/icon-history/` keeps all eight icons and now carries a `README.md` recording the timeline and
the rule: **do not overwrite an icon in place; add the next one as `08-`.**

`ios/` and `android/` are gitignored, correctly — they are prebuild output and the plugin
regenerates them on every build.

### Social

`docs/social/` now carries the F profile images. All four are the **full** lockup, decided last
sprint by counting POKER's letter cells on each rendered file rather than assuming a platform's
display size, and re-confirmed here: 0 mark pixels outside the inscribed circle at 1024 / 360 / 320
/ 200, clearance 28.9–29.7% of the radius. They hold POKER down to 84–100px of display.
**The covers are kept** and were not overwritten.

### The first second, from the emitted files

`docs/f-icon/F-FIRST-SECOND-EMITTED.png` — built by reading
`ios/CapsPoker/Images.xcassets/AppIcon.appiconset` and `android/app/src/main/res`, not the source
renders. It shows the responsive decision working: **a 3× iPhone gets the full lockup at 180px and a
2× iPhone gets compact at 120px.** That difference is real and worth seeing rather than being told.

## §4 · Not done

* Typecheck clean (`tsc --noEmit`, 0 errors).
* **No version bump, no build number change, not merged.** The icon ships with the next build.
* No splash, no winner cue, no card size, no 83px arc, no economy value, no flag.
* **No Edge Function deployed** — `verify_jwt` unchanged everywhere.
* No database write beyond the handoff row.

### Worth knowing before the next build

* The `expo-notifications` plugin still points its Android notification icon at `./assets/icon.png`,
  which now carries F. Android renders a notification icon as a white silhouette regardless, so this
  is not newly broken — but a dedicated monochrome notification asset would be better, and that is a
  separate change.
* If any BackstopJS scenario captures the favicon, its baseline will need regenerating **on Linux**.

### Getting the pictures to Downloads (cmd.exe, from `C:\Projects\POKER\Caps`)

```
git fetch origin claude/vamos-caps-align-celebration-flppo0
set B=origin/claude/vamos-caps-align-celebration-flppo0
git show %B%:docs/f-icon/F-FIRST-SECOND-EMITTED.png > %USERPROFILE%\Downloads\F-FIRST-SECOND-EMITTED.png
git show %B%:docs/f-icon/F-RESPONSIVE-SHEET.png > %USERPROFILE%\Downloads\F-RESPONSIVE-SHEET.png
git show %B%:assets/icon.png > %USERPROFILE%\Downloads\shipped-icon.png
git show %B%:docs/f-icon/built/compact/icon-120.png > %USERPROFILE%\Downloads\F-compact-120.png
git show %B%:docs/f-icon/built/full/icon-180.png > %USERPROFILE%\Downloads\F-full-180.png
git show %B%:docs/f-icon/built/full/icon-512.png > %USERPROFILE%\Downloads\F-play-store-512.png
git show %B%:docs/social/caps-profile-1024.png > %USERPROFILE%\Downloads\F-profile-1024.png
```

To regenerate and re-verify from a clean checkout:

```
xvfb-run -a node tools/icon/build-f-icon.mjs
npx expo prebuild --no-install --clean
node tools/icon/verify-emitted.mjs
```
