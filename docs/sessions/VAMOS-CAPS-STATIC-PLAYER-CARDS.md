# VAMOS CAPS CAPS-STATIC-PLAYER-CARDS
**Date:** 2026-04-27 IST | **Priority:** UX polish — Roye reported cards bouncing up/down looks bad

---

## What Roye sees on v2.7.0 (EAS 328)

The 8 player cards at the bottom of game.tsx (Image 3 reference) animate in by falling from above with staggered delays. Roye says it looks unstable. He wants them static but still polished.

## What's actually in the code

`components/PlayerHand.tsx` lines 36-54:
```typescript
const opacity = useSharedValue(0);
const translateY = useSharedValue(-200);

useEffect(() => {
  const delay = index * 60;
  opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
  translateY.value = withDelay(
    delay,
    withTiming(0, { duration: 280 }, (finished) => {
      if (finished && index % 4 === 0) runOnJS(playSound)('cardPlace');
    }),
  );
}, []);

const animStyle = useAnimatedStyle(() => ({
  opacity: opacity.value,
  transform: [{ translateY: translateY.value }],
}));
```

This is a one-shot deal animation — cards drop from -200px to 0 with 60ms stagger. Combined effect = visible "wave" of falling cards which Roye finds unsteady.

---

## TASK 1 — Make cards static on appear (keep fade-in only)

Edit `components/PlayerHand.tsx`:

**Change lines 36-54** to remove the translateY animation. Keep opacity fade-in (gentler, looks polished without movement).

```typescript
// REPLACE the existing animation block with:
const opacity = useSharedValue(0);

useEffect(() => {
  const delay = index * 40;  // slightly faster stagger since no movement
  opacity.value = withDelay(delay, withTiming(1, { duration: 220 }, (finished) => {
    // Play cardPlace sound every 4 cards (enough to feel like a deal, not spammy)
    if (finished && index % 4 === 0) runOnJS(playSound)('cardPlace');
  }));
}, []);

const animStyle = useAnimatedStyle(() => ({
  opacity: opacity.value,
  // No transform — cards stay in place, just fade in
}));
```

**What this does:**
- Cards no longer fall from above — they stay where they should be
- Fade-in still gives a polished "appearing" feel (220ms per card)
- Stagger reduced to 40ms (snappier since no movement to coordinate)
- Sound trigger preserved (every 4th card)
- No layout jitter, no visual instability

---

## TASK 2 — Verify nothing else uses translateY for cards

```bash
cd C:/Projects/POKER/Caps
grep -n "translateY" components/PlayerHand.tsx
```

**Expected output:** Only line ~209 with `transform: [{ translateY: -8 }, { rotate: '-3deg' }, { scale: 1.08 }]`. This is the **selected card lift** — keep it. That's the static visual cue when a card is picked, not an animation.

---

## TASK 3 — TypeScript + commit

```bash
npx tsc --noEmit 2>&1 | tail -5
# Should be clean

git add components/PlayerHand.tsx
git commit -m "fix(ux): remove vertical drop animation on player cards — fade-in only

Cards were falling from translateY -200 with 60ms stagger creating an unstable wave effect.
Replaced with fade-in only (220ms, 40ms stagger). Selected-card lift preserved.
Reported by Roye on v2.7.0 EAS 328."

git push origin main
```

---

## TASK 4 — OTA deploy (NOT a new build — this is OTA-safe)

This change is pure JS animation logic — perfect candidate for OTA. No native code touched.

```bash
npm run ota -- --message "fix: static player cards (no drop animation)"
```

Wait for OTA URL/hash to be reported. Save it.

---

## TASK 5 — Update DB

```sql
-- On CAPS DB (gxrpunvhjcrzqnitbqah)
INSERT INTO deploy_log (type, version, build_number, message, deployed_at)
VALUES ('ota', '2.7.0', '328', 'fix: removed translateY drop animation on player cards — fade-in only', NOW());
```

---

## EXPECTED RESULT ON ROYE'S PHONE

After OTA installs (force-close app and reopen):
- Open a game
- Cards at bottom appear by fading in (not falling)
- No bouncing, no instability
- Selected card still lifts up gently when tapped (good — that's intentional)

---

## AFTER AUDIT
```
PlayerHand.tsx translateY animation removed:    YES/NO
Fade-in opacity animation kept:                  YES/NO
Selected card lift (line 209) untouched:         YES/NO
TypeScript clean:                                YES/NO
Pushed:                                          YES/NO + commit SHA
OTA deployed:                                    YES/NO + hash
deploy_log updated:                              YES/NO
```

Yes, allow all edits.
VAMOS CAPS CAPS-STATIC-PLAYER-CARDS — END
