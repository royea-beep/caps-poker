# VAMOS CAPS CAPS-UX-TEST-MODE-CLEANUP
**Date:** 2026-04-27 IST | **Priority:** UX polish — based on Roye's 3 screenshots from v2.7.0 (EAS 328)

---

## CONTEXT
v2.7.0 (DB:471 / EAS:328) is LIVE on Roye's phone. He sent 3 screenshots showing UX issues:
1. **Home screen** — English strings, fake player count, daily reward modal too aggressive
2. **Results screen** — All hand rankings + bot labels in English  
3. **Game screen** — Broken encoding "ÃcÂÂ מוכן", English Daniel Negreanu quote, unclear card layout

All these are **OTA-safe** changes (pure JS strings + logic). No native build needed.

---

## TASK 1 — Fix broken encoding "ÃcÂÂ"

```bash
cd C:/Projects/POKER/Caps
grep -rn "ÃcÂÂ\|Ã¢ÂÂ\|Ã¢" --include="*.tsx" --include="*.ts" 2>/dev/null
```

Find any file with these mojibake sequences. Replace with:
- `ÃcÂÂ מוכן` → `✓ מוכן`
- Any other Ã sequences → likely meant to be ✓ or • or — depending on context

If the source is a JSON or DB string, fix the source.

---

## TASK 2 — Hebrew strings throughout

Search and replace these English strings (find file, replace):

```bash
grep -rn "RECENT HANDS\|Invite Friends\|Board 1\|2 boards\|HIGH CARD\|TWO PAIR\|STRAIGHT\|FLUSH\|BOT 1\|BOT 2\|BOT 3\|PLAYER\|So close" --include="*.tsx" 2>/dev/null
```

Replace with Hebrew:

| English | Hebrew |
|---|---|
| RECENT HANDS | ידיים אחרונות |
| Invite Friends | הזמן חברים |
| Board 1 / Board 2 | לוח 1 / לוח 2 |
| 2 boards / 3 boards / 4 boards | 2 לוחות / 3 לוחות / 4 לוחות |
| HIGH CARD | קלף גבוה |
| ONE PAIR | זוג |
| TWO PAIR | זוג כפול |
| THREE OF A KIND | שלישייה |
| STRAIGHT | רצף |
| FLUSH | פלאש |
| FULL HOUSE | פול האוס |
| FOUR OF A KIND | רביעייה |
| STRAIGHT FLUSH | רצף פלאש |
| ROYAL FLUSH | רויאל פלאש |
| BOT 1 / BOT 2 / BOT 3 | בוט 1 / בוט 2 / בוט 3 |
| PLAYER | שחקן |
| So close! | כמעט! |
| HIGH CARD (in a board context) | קלף גבוה |

**IMPORTANT:** Check if these strings come from a `pokerHands.ts` constants file — if yes, edit there once, not in each component.

---

## TASK 3 — Hide fake "62 שחקנים" counter in test mode

This counter shows "62 players online" but no real users exist. In test mode, hide it OR change to placeholder.

```bash
grep -rn "שחקנים\|playersOnline\|onlinePlayers" --include="*.tsx" --include="*.ts" 2>/dev/null
```

Find the source. Two options:
- **A:** Hide entirely (`{__DEV__ ? null : <PlayersOnline />}` — but app is always in production mode for TestFlight, so this won't trigger)
- **B:** Tie to `app_config.is_beta` flag from DB — when true, hide the counter

**Recommended:** Option B — read `is_beta` from app.json's `extra.isBeta` (which is `true` per github-file scan):
```typescript
import Constants from 'expo-constants';
const isBeta = Constants.expoConfig?.extra?.isBeta === true;
// ...
{!isBeta && <Text>{playerCount} שחקנים</Text>}
```

Or simpler: just remove the counter component entirely until launch. Roye can add it back when there are real players.

---

## TASK 4 — Daily Reward modal — delay or move to manual claim

Currently pops on app open. Options:
- **A:** Move to a button user taps in their own time
- **B:** Show only after 1st game played (not on cold launch)
- **C:** Add 2-second delay so home screen renders first

Find:
```bash
grep -rn "DailyReward\|Daily Reward\|+50 chips" --include="*.tsx" --include="*.ts" 2>/dev/null
```

**Recommended:** Option B (after first game). For test mode this is fine; for launch we can revisit. If complex, fall back to A — make it a button.

---

## TASK 5 — Hide/translate Daniel Negreanu English quote

Image 3 shows: "Stack one board or spread evenly? THAT is the question." — Daniel Negreanu

This is one of those AI-generated quotes (per the small text below: "סימולציית AI — לא ציטוטים אמיתיים").

Options:
- **A:** Show only Hebrew quotes (filter the quotes array by language)
- **B:** Translate this specific quote to Hebrew on the fly
- **C:** Hide the entire quote bar in test mode

```bash
grep -rn "Negreanu\|Stack one board\|simulationQuote\|aiQuote" --include="*.tsx" --include="*.ts" 2>/dev/null
```

**Recommended:** Option A — only show quotes flagged `language: 'he'`. If the quotes file doesn't have language tags, add them — Hebrew-only for now.

---

## TASK 6 — Settings test-mode panel

Add a "Test Mode" section in Settings with:

```typescript
// In app/settings.tsx, add a new section before the "מחק חשבון" danger zone:

{__DEV__ || isBeta ? (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>מצב טסט</Text>
    
    <View style={styles.row}>
      <Text style={styles.rowLabel}>גרסה</Text>
      <Text style={styles.rowValue}>v2.7.0 (DB:471 / EAS:328)</Text>
    </View>
    
    <Pressable onPress={handleResetProgress} style={styles.button}>
      <Text>🔄 אפס התקדמות (טסט)</Text>
    </Pressable>
    
    <View style={styles.row}>
      <Text>השתק ציטוטים</Text>
      <Switch value={muteQuotes} onValueChange={setMuteQuotes} />
    </View>
    
    <View style={styles.row}>
      <Text>השתק צלילים</Text>
      <Switch value={muteSounds} onValueChange={setMuteSounds} />
    </View>
  </View>
) : null}
```

`handleResetProgress` should:
- Confirm via Alert ("לאפס את כל ההתקדמות?")
- AsyncStorage.clear()
- Reset chips to 1000
- Navigate to home

`muteQuotes` and `muteSounds` save to AsyncStorage and read by quote/sound players.

---

## TASK 7 — TypeScript + commit + OTA

```bash
npx tsc --noEmit 2>&1 | tail -5
# Should be clean

git add -A
git commit -m "fix(ux): test-mode UX cleanup

- Fix broken ÃcÂÂ encoding to ✓ checkmark
- Hebrew translations for all hand rankings, bot labels, board labels
- Hide fake players counter in beta
- Daily reward modal moved to post-first-game
- Hebrew-only AI quotes
- Settings test-mode panel: reset progress, mute toggles, version display

Reported by Roye on v2.7.0 EAS 328 via screenshots."

git push origin main

# OTA deploy (no native rebuild needed)
npm run ota -- --message "UX cleanup: Hebrew strings + encoding fix + test-mode panel"
```

---

## TASK 8 — Update DB

```sql
INSERT INTO deploy_log (type, version, build_number, message, deployed_at)
VALUES ('ota', '2.7.0', '328', 'UX cleanup: Hebrew strings, encoding fix, test-mode settings panel', NOW());
```

---

## CRITICAL RULES

- ❌ DO NOT edit Card.tsx (still locked unless explicitly told)
- ❌ DO NOT modify game logic (board count, hand evaluator)
- ❌ DO NOT touch native config (app.json plugins, package.json) — this is OTA-only
- ✅ DO group string changes into a constants file if not already there
- ✅ DO test on web (`npm run web`) before push to catch obvious issues fast
- ⚠️ If you can't find a string in the codebase, it might be coming from DB or a remote config — report back, don't guess

---

## REPORT BACK

```
Encoding ÃcÂÂ fixed:                        YES/NO + file path
Hebrew strings (count of replacements):      [N]
Players counter handled:                     YES/NO + how (hide/conditional)
Daily Reward delayed:                        YES/NO + how
Quotes filter to Hebrew only:                YES/NO
Settings test-mode panel added:              YES/NO
TypeScript clean:                            YES/NO
Pushed:                                      YES/NO + commit SHA
OTA deployed:                                YES/NO + update group
```

Yes, allow all edits.
VAMOS CAPS CAPS-UX-TEST-MODE-CLEANUP — END
