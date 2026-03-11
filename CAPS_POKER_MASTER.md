# CAPS POKER — Master Project Summary
_עודכן: 11.3.2026 | Sprint 18 Complete_

---

## איך עובדים בפרויקט הזה

### שיטת העבודה — פינג פונג קבועה

| תפקיד | אחריות |
|--------|--------|
| **אני + המשתמש** | המוח האסטרטגי — כיוון, בדיקה, החלטות |
| **Claude Bot** | המבצע — קוד, פלטים, דיפים |

**הסייקל הקבוע:**
1. מגדירים כיוון + מחדדים יחד
2. שולחים MEGA PROMPT מלא לקלוד בוט
3. קלוד מבצע, מחזיר פלט ממוספר
4. מנתח, מסכם, מחליט מה הבא
5. המשתמש מאשר / מתקן / מוסיף
6. שולחים MEGA PROMPT חדש → חוזר לשלב 2

### כללים קבועים
- **שיחה בינינו:** עברית
- **כל מה שהולך לקלוד בוט:** אנגלית
- תמיד לחשוב קדימה — לא רק לענות על מה שנשאל
- בסוף כל סייקל — להכין MEGA PROMPT מוכן לביצוע

---

## מצב כללי של הפרויקט

### תיאור המוצר
משחק קלפים אסטרטגי מבוסס Omaha Poker על מספר בורדים במקביל. כל שחקן מקבל קלפים ומחלק אותם בין הבורדים — כל בורד הוא יד Omaha עצמאית עם פוט נפרד. מיועד ל-2-4 שחקנים. קיים כ-iOS native app + אתר web דמו.

### ארכיטקטורה — החלטות נעולות

| החלטה | סיבה | סטטוס |
|--------|-------|--------|
| React Native + Expo SDK 55 | פשטות, cross-platform | 🔒 נעול |
| iOS portrait only | UX focus | 🔒 נעול |
| כל פרמטר gameplay ב-Settings | גמישות testing | 🔒 נעול |
| Full Omaha: 2 קלפי שחקן + 3 board בדיוק | חוקי המשחק | 🔒 נעול |
| בוט random בלבד | testing בלבד | 🔒 נעול |
| No backend — local + AsyncStorage | פשטות | 🔒 נעול |
| Local MP via react-native-tcp-socket | Phase 1 | 🔒 נעול |
| Internet MP via Supabase Realtime | Phase 2, עתידי | 🔒 נעול |
| Tap-to-select + tap-to-place, אין גרירה | UX החלטה | 🔒 נעול |
| Complete bonus = 50% buy-in מכל יריב | חוקי המשחק | 🔒 נעול |
| Player hand = 2 שורות קבועות, ללא גלילה | UX נעול | 🔒 נעול |
| Reveal = אוטומטי לחלוטין, ללא קלט | UX נעול | 🔒 נעול |

### מצב פריסה / Production

- ✅ Web: http://caps.ftable.co.il (HTTP — SSL ממתין לתיקון WHM)
- ✅ iOS build bbb538b7 (v1.2.0) — מוכן ל-TestFlight
- Git: branch `main`, latest commit `f8e5673` (sprint-18)
- EAS account: royea (royearguan@gmail.com), Team: 3K9KJNGL9U
- Bundle ID: com.capspoker.app

---

## ארכיטקטורת המוצר

### Flow ראשי
```
index.tsx (Home)
    ↓
game.tsx → ARRANGING phase
    PlayerHand.tsx (2 fixed rows, tap-to-select)
    Board.tsx × N (tap-to-place, hand hint, board complete pulse)
    ↓
game.tsx → REVEAL phase
    useRevealSequence.ts (auto, sequential)
    Board.tsx (card flip rotateY, FloatingChips, Badge W/L/T)
    CompleteOverlay.tsx (if all boards won by one side)
    ↓
summary.tsx (chip counting animation, Badge, Next Hand)
    → gameover.tsx (if chips < buy-in)
    → index.tsx

Multiplayer:
lobby/host.tsx → gameServer.ts (TCP) → multiplayer-game.tsx
lobby/join.tsx → gameClient.ts (TCP) → multiplayer-game.tsx
```

### קבצים קריטיים

| קובץ | תפקיד |
|------|--------|
| `app/game.tsx` | מסך משחק ראשי, כל ה-phases |
| `app/summary.tsx` | סיכום יד + chip animation |
| `app/gameover.tsx` | מסך GAME OVER כשנגמרים צ'יפים |
| `app/settings.tsx` | כל הפרמטרים |
| `store/gameStore.ts` | Zustand + AsyncStorage persist |
| `utils/handEvaluator.ts` | לוגיקת Omaha מלאה |
| `utils/gameLogic.ts` | deal, evaluate, chip deltas |
| `utils/handHint.ts` | hand strength hints בסידור |
| `components/Card.tsx` | קלף + flip animation rotateY |
| `components/Board.tsx` | בורד + Badge + FloatingChips + hint |
| `components/PlayerHand.tsx` | 2 שורות קבועות |
| `components/Badge.tsx` | W/L/T badge |
| `constants/gameConfig.ts` | DEFAULT_CONFIG + קבועים |
| `utils/gameServer.ts` | TCP server (local MP) |
| `utils/gameClient.ts` | TCP client (local MP) |
| `docs/multiplayer-test-guide.md` | מדריך בדיקת MP |

### Game Config (כולם ב-Settings, persist ב-AsyncStorage)

| פרמטר | Default | הסבר |
|--------|---------|------|
| arrangementTime | 60s | טיימר סידור |
| boardRevealDuration | 5s | הפסקה בין בורדים |
| turnRevealDelay | 800ms | מהירות flip קלף |
| completeBonusDisplay | 2s | זמן Complete overlay |
| startingChips | 1000 | צ'יפים התחלתיים |
| potPerBoard | 25 | buy-in = ×numBoards |
| completeBonusPercent | 50 | % מה-buy-in מכל יריב |
| numberOfPlayers | 2 | selector 2/3/4 |
| botSpeedMin/Max | 5000/30000ms | מהירות בוט |

---

## QA וסטטוס בדיקות

### מה בוצע
- ✅ Jest: 72/72 (14 hand evaluator + 19 simulation + 32 game logic + 7 hand hint)
- ✅ TypeScript: 0 errors
- ✅ Preflight check: 10/10
- ✅ EAS build v1.2.0 (bbb538b7) FINISHED

### מה עדיין חסר
- ❌ Manual device QA על build v1.2.0 — טרם בוצע
- ❌ Local multiplayer test על 2 מכשירים (מדריך: docs/multiplayer-test-guide.md)

---

## Mobile / App

### TestFlight — מצב עכשווי
- IPA מוכן: https://expo.dev/artifacts/eas/pbo4shJBorfNrmEm1j7Jdg.ipa
- **לא הועלה עדיין** — נדרש: Transporter (Mac) או ASC API Key
- ascAppId חסר ב-eas.json → צריך הרצה ידנית ראשונה של `eas submit`

### כלל builds
> שינויי JS/UI בלבד → web deploy מספיק (npx expo export + FTP upload)
> שינויי native / config / deps → EAS build חדש חובה

---

## Assets

| Asset | חשיבות | סטטוס |
|-------|---------|--------|
| אייקון CP (icon.png 1024×1024) | HIGH | ✅ קיים (SVG-generated via sharp) |
| Splash screen | HIGH | ✅ קיים |
| צלילי gameplay | MED | ❌ חסר (תשתית: utils/sounds.ts עתידי) |
| SSL לcaps.ftable.co.il | HIGH | ❌ דורש WHM מספק האחסון (SPD Hosting) |

---

## דברים פתוחים — לפי עדיפות

### 🔴 קריטי (עכשיו)
1. **TestFlight upload** — הורד IPA + פתח Transporter (Mac) → Deliver
2. **בדיקת build v1.2.0 על מכשיר** — checklist ב-MEMORY.md

### 🟠 גבוה (ספרינט הבא)
3. Home screen stats — handsPlayed, lastSessionNet (Sprint 19)
4. Sound effects stubs + toggle בSettings
5. ascAppId ב-eas.json לאחר submit ידני ראשון

### 🟡 בינוני
6. SSL fix — לפנות ל-SPD Hosting לתיקון Apache SNI
7. Local multiplayer test — 2 מכשירים WiFi
8. EAS build v1.3.0 אחרי TestFlight verification

### ⚪ עתידי
9. Supabase Realtime internet multiplayer (Phase 2)
10. App Store submission (חובה: ascAppId, privacy policy)

---

## ספרינטים שהושלמו

| ספרינט | תאריך | עיקרי | טסטים |
|--------|-------|-------|-------|
| 01-07 | — | Setup, Expo, EAS, multiplayer foundation | 31 |
| 08-09 | — | Board UI polish, tap-to-place, gold border | 35 |
| 10 | — | Full audit, dead code cleanup | 43 |
| 11 | — | Fix COLORS.black (cards invisible bug) | 43 |
| 12 | — | 61 bugs fixed, settings overhaul, chip animation, MP hardening | 47 |
| 13-14 | — | Card flip rotateY, FloatingChips | 53 |
| 15 | — | CP icon, Badge W/L/T, v1.2.0, EAS build | 57 |
| 16 | — | Hand hint, MP test guide, EAS build success bbb538b7 | 64 |
| 17 | — | Arrangement UX audit, timer 3-tier colors | 69 |
| 18 | — | Board complete pulse, gameover screen | 72 |

---

## מה חובה לזכור לבוט הבא

- שיחה עם המשתמש: **עברית** | פרומפטים לקלוד: **אנגלית**
- לתמיד לקרוא `C:\Projects\Caps\MEMORY.md` לפני הכל
- Iron Rules 1-8 נעולים לעולם — לא לשנות
- 72 טסטים — לא לשבור
- אין גרירה — רק tap
- Complete bonus = 50% מה-buy-in, לא מהפוט

### סטטוס סופי במשפט אחד
> האפליקציה פונקציונלית מלאה (72 טסטים, 0 TS errors), build v1.2.0 מוכן — ממתינים לTestFlight upload ובדיקה על מכשיר לפני Sprint 19.

---

## טקסט להדבקה לבוט חדש

```
We are continuing the CAPS POKER project.

Important working model:
- Chat with the user is in Hebrew.
- All prompts sent to Claude Bot must be in English.
- The workflow is a ping-pong model:
  - User + Strategic AI = direction, decisions, review
  - Claude Bot = execution
- Always think like a project manager, not a passive responder.
- Always determine the next necessary steps proactively.
- Default output: a full MEGA PROMPT ready for Claude Bot.

Current CAPS POKER state:
- React Native + Expo SDK 55, iOS portrait, local-only (no backend)
- Version 1.2.0, EAS build bbb538b7 FINISHED — awaiting TestFlight upload
- IPA ready: https://expo.dev/artifacts/eas/pbo4shJBorfNrmEm1j7Jdg.ipa
- Web: http://caps.ftable.co.il (deployed, SSL pending)
- Tests: 72/72 Jest, TypeScript 0 errors
- Project path: C:\Projects\Caps\
- Git: branch main, latest commit f8e5673 (sprint-18)
- MEMORY.md is the source of truth — always read it first

Locked decisions (Iron Rules — never suggest changing):
1. React Native + Expo only — no bare workflow, no Capacitor
2. iOS portrait only
3. All params runtime-configurable via Settings — never hardcoded
4. Full Omaha evaluation — exactly 2 player cards + 3 board cards
5. Bot is random only — testing purposes
6. No backend — local only, AsyncStorage for persistence
7. Local multiplayer via react-native-tcp-socket LOCKED
8. Internet multiplayer via Supabase Realtime (Phase 2) LOCKED
+ Tap-to-select + tap-to-place — no drag
+ Complete bonus = 50% of buy-in per opponent (NOT % of pot)
+ Player hand = 2 fixed rows, no scroll
+ Reveal = fully automatic, no user input

Next priorities:
1. TestFlight upload (IPA ready)
2. Manual device QA checklist (in MEMORY.md)
3. Home screen stats (handsPlayed, lastSessionNet) — Sprint 19
4. Sound effects infrastructure

First, read C:\Projects\Caps\MEMORY.md, then prepare the next MEGA PROMPT.
```
