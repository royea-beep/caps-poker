# CAPS POKER — Full Project Handoff
# תאריך: 11.3.2026

---

## מה זה CAPS POKER

משחק קלפים מבוסס Omaha Poker על מספר בורדים במקביל.
כל שחקן מקבל קלפים ומחלק אותם על פני כמה בורדים.
כל בורד = יד Omaha נפרדת עם פוט נפרד.

### חוקי המשחק
- **2 שחקנים:** 4 בורדים, 16 קלפים לכל שחקן
- **3 שחקנים:** 3 בורדים, 12 קלפים לכל שחקן
- **4 שחקנים:** 2 בורדים, 8 קלפים לכל שחקן
- כל בורד: 3 קלפי קהילה **פתוחים** (flop) + 2 **סגורים** (turn+river) — מחולקים אוטומטית
- כל שחקן שם **4 קלפים** על כל בורד — כולם בשימוש
- הערכה: Omaha — בוחר 2 מתוך 4 קלפי שחקן + 3 מתוך 5 קלפי קהילה
- COMPLETE bonus: ניצחון על כל הבורדים → 50% מהפוט הכולל מהיריב
- ממשק: tap-to-select + tap-to-place — אין גרירה

---

## שיטת עבודה — VAMOS

```
VAMOS [NAME] [NUMBER]
...משימות...
VAMOS [NAME] [NUMBER] — END
```

**Standing Orders (תמיד בפרומפט):**
- Try ALL actions autonomously first
- Check C:/Projects/ for any credentials needed
- Only escalate ONE specific question if truly blocked
- Never give the user a list of commands to run

---

## Iron Rules (1-8 נעולים לעולם)

1. React Native + Expo only — no bare workflow, no Capacitor
2. iOS portrait only
3. All params runtime-configurable via Settings — never hardcoded
4. Full Omaha evaluation — exactly 2 player cards + 3 board cards
5. Bot is random only — testing purposes
6. No backend — local only, AsyncStorage for persistence
7. Local multiplayer via react-native-tcp-socket LOCKED
8. Internet multiplayer via Supabase Realtime (Phase 2) LOCKED

---

## Tech Stack

- React Native + Expo SDK 55 (React 19, RN 0.83)
- expo-router, Zustand persist middleware, react-native-reanimated
- react-native-gesture-handler, expo-haptics, expo-device
- react-native-tcp-socket, uuid, expo-dev-client
- react-dom, react-native-web (web export)
- Jest 29 + ts-jest, EAS Build (iOS preview profile)
- TypeScript strict

---

## מיקום פרויקט

C:\Projects\Caps\

### קבצים מרכזיים
```
/app/_layout.tsx, index.tsx, game.tsx, summary.tsx, settings.tsx, simulate.tsx
/app/lobby/_layout.tsx, host.tsx, join.tsx
/app/multiplayer-game.tsx
/components/Card.tsx, Board.tsx, PlayerHand.tsx, ChipsDisplay.tsx, CompleteOverlay.tsx
/hooks/useGameTimer.ts, useRevealSequence.ts
/types/gameTypes.ts
/utils/deck.ts, handEvaluator.ts, gameLogic.ts, simulate.ts, gameServer.ts, gameClient.ts, roomCode.ts
/utils/__tests__/handEvaluator.test.ts, simulate.test.ts, gameLogic.test.ts
/constants/gameConfig.ts, theme.ts, networkConfig.ts
/store/gameStore.ts
/dist/  <-- Expo Web export, מועלה ל-caps.ftable.co.il
```

---

## סטטוס נוכחי

- TypeScript: 0 errors
- Tests: 43/43
- iOS Preview Build: c6bac0e8 (v1.1.0) — מותקן על מכשיר, טרם אושר סופית
- Web: caps.ftable.co.il — עלה אבל יש שגיאת JS (ראה משימות פתוחות)
- Git latest commit: 457469f — "fix: community cards show rank and suit"

---

## cPanel / FTP

- FTP User: ftableco
- FTP Password: Sb9k46-l)WI2Gq
- Host: ftable.co.il / IP: 195.225.46.105
- cPanel: https://ftable.co.il:2083
- caps subdomain: public_html/caps — נוצר
- credentials שמורים ב: C:/Projects/ftable/.env

---

## EAS / Apple

- Expo account: royea (royearguan@gmail.com)
- Apple Team: Roye Arguan (3K9KJNGL9U)
- Bundle ID: com.capspoker.app
- Project ID: 114b97d5-5cb3-4798-9a97-8233a6a37c07
- EAS Plan: Starter ($19/month)
- לבטל Additional Concurrency ($50/month): expo.dev/accounts/royea/settings/billing

---

## באגים שתוקנו

1. Sprint 08: קלפי שחקן face-down — תוקן faceDown={false}
2. Sprint 08: board layout — הוסר flexWrap, נוסף separator
3. Sprint 09: tap-to-remove, gold border, pulse animation
4. Sprint 10: אודיט מלא, 12 טסטים חדשים, dead code הוסר
5. Sprint 11: COLORS.black = '#f0f0e8' = רקע הקלף → קלפי spades/clubs בלתי נראים. תוקן ל-'#1a1a2e'

---

## משימות פתוחות

### עדיפות 1 — תיקון Web (URGENT)

הבעיה: "Uncaught SyntaxError: Cannot use 'import.meta' outside a module"

פרומפט לשלוח לבוט:

```
VAMOS CAPS WEB-FIX

The site loads at http://caps.ftable.co.il but shows console error:
"Uncaught SyntaxError: Cannot use 'import.meta' outside a module"

Standing Orders: Try all fixes autonomously. Check C:/Projects/ for credentials. Never give user commands.

TASK A — Fix the JS module error:
A1. Read C:\Projects\Caps\dist\index.html — check how the JS bundle is loaded
A2. Fix: the script tag needs type="module" OR re-export with correct config
    Option 1: Add type="module" to script tag in index.html
    Option 2: Update app.json: "web": { "bundler": "metro", "output": "static" }
              Then: cd C:/Projects/Caps && npx expo export --platform web
A3. Upload fixed dist/ to server via FTP:
    - ftableco / Sb9k46-l)WI2Gq / ftable.co.il
    - Target: /home/ftableco/public_html/caps/
A4. Verify: fetch http://caps.ftable.co.il — no console errors, app loads
A5. git add -A && git commit -m "fix: web export module error"

VAMOS CAPS WEB-FIX — END
```

### עדיפות 2 — SSL
AutoSSL אמור לעבוד אוטומטית. אם לא — trigger דרך cPanel API.

### עדיפות 3 — iOS Build Verification
לאשר build c6bac0e8: קלפים גלויים, tap-to-place, reveal, summary.

### עדיפות 4 — עתיד
- Card flip animation (rotateY)
- Floating "+chips" text אחרי reveal
- אייקון CP
- Local multiplayer test (2 מכשירים WiFi)
- Supabase Realtime internet multiplayer (Phase 2)

---

## הערות לבוט הבא

1. תמיד קרא MEMORY.md לפני הכל
2. Iron Rules 1-8 נעולים — לא לשנות
3. 43 טסטים — לא לשבור
4. אין גרירה — רק tap
5. Wingman = פרויקט נפרד: C:\projects\wingman\apps\mobile\
6. שפה: עברית עם המשתמש, אנגלית בפרומפטים לבוט
