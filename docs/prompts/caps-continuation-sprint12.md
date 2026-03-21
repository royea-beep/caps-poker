# CAPS POKER — המשך מספרינט 11
# קרא MEMORY.md לפני הכל

---

## מצב נוכחי (11.3.2026 — סוף יום)

### Builds
- **preview v1.1.0** (ספרינט 11) — ✅ finished
  - ID: c6bac0e8-dcc0-4990-8fa4-1d42b283812e
  - תיקון: COLORS.black היה '#f0f0e8' = אותו צבע כמו רקע הקלף → קלפי ♠♣ היו בלתי נראים
  - תוקן ל-'#1a1a2e' (כהה)

### סטטוס
- TypeScript: 0 errors ✅
- Tests: 43/43 ✅ (12 hand evaluator + 12 game logic + 19 simulation)
- Git: commit 457469f — "fix: community cards show rank and suit"

### Iron Rules (1-8 נעולים)
1. React Native + Expo only
2. iOS portrait only
3. All params runtime-configurable
4. Full Omaha evaluation
5. Bot is random only
6. No backend for single-player
7. Local multiplayer via react-native-tcp-socket ✅
8. Internet multiplayer via Supabase Realtime (Phase 2)

### חוקי המשחק (מאומתים)
- 2 שחקנים: 4 בורדים, 16 קלפים לכל שחקן
- 3 שחקנים: 3 בורדים, 12 קלפים לכל שחקן
- 4 שחקנים: 2 בורדים, 8 קלפים לכל שחקן
- כל בורד: 3 flop פתוחים + 2 turn/river סגורים (מחולקים אוטומטית)
- כל שחקן שם 4 קלפים על כל בורד — כולם בשימוש
- Omaha: 2 מתוך 4 קלפי שחקן + 3 מתוך 5 קלפי קהילה
- ממשק: tap-to-select + tap-to-place (אין גרירה)

### EAS / Expo
- Starter plan: $45 credits/חודש
- **לבטל Additional Concurrency ($50)** — עדיין לא בוטל!
- Wingman אוכל את רוב ה-builds (46 builds!)

---

## משימות לספרינט 12

### עדיפות 1 — בדיקה על מכשיר
לאשר שה-build c6bac0e8 עובד:
- כל הקלפים גלויים (♠♣ כהים, ♥♦ אדומים)
- flop מוצג נכון בכל בורד
- tap-to-place עובד
- reveal ו-summary עובדים

### עדיפות 2 — Expo Web Export
```bash
cd C:/Projects/Caps
npx expo export --platform web
```
מייצר תיקיית `dist/` — להעלות ל-caps.ftable.co.il דרך cPanel.

### עדיפות 3 — Deploy
- כנס ל-cPanel של ftable.co.il
- צור subdomain: caps.ftable.co.il
- העלה את תוכן `dist/` לתיקיית ה-subdomain
- ודא שיש .htaccess לניתוב נכון של SPA

---

## פקודת פתיחה מהירה
```bash
cd C:/Projects/Caps
npx tsc --noEmit
npx jest --silent
git log --oneline -5
```

---

## הערות חשובות
- הבוט נוטה לשלוח דוחות ישנים — תוודא שהוא קורא MEMORY.md
- לבטל Additional Concurrency ב-expo.dev/accounts/royea/settings/billing
- Wingman פרויקט נפרד ב: C:\projects\wingman\apps\mobile
