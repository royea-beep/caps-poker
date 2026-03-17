# CAPS POKER — Sprint 08
# קרא MEMORY.md לפני הכל ואשר Iron Rules.
# הרץ 2 agents במקביל.

---

## Iron Rules Confirmation
- Rule 1: React Native + Expo only ✓
- Rule 2: iOS portrait only ✓
- Rule 3: All params runtime-configurable ✓
- Rule 4: Full Omaha evaluation ✓
- Rule 5: Bot is random only ✓
- Rule 6: No backend for single-player ✓
- Rule 7: Local multiplayer via react-native-tcp-socket ✓
- Rule 8: Internet multiplayer via Supabase Realtime (Phase 2) ✓

---

## CONTEXT
Preview build v1.1.0 רץ על מכשיר. נמצאו 2 באגים ויזואליים:
1. קלפי היד של השחקן מוצגים הפוכים (face-down)
2. לייאאוט קלפי הבורד לא נכון — צריך 3 פתוחים + 2 סגורים

---

## TASK 1 — Fix: Player Hand Face-Up (CRITICAL)
Agent: hand-display-fix

A1. קרא `components/PlayerHand.tsx` במלואו.

A2. תקן: קלפים של השחקן האנושי תמיד מוצגים face-up.
    - אם יש prop `faceDown` או לוגיקה שמסתירה קלפים — הסר אותה לשחקן האנושי
    - קלפי הבוט ממשיכים להיות face-down (לא רואים את הקלפים שלו)

A3. קרא `app/game.tsx` — ודא שה-prop שנשלח ל-PlayerHand לשחקן הוא face-up.

A4. `npx tsc --noEmit 2>&1` — אפס שגיאות.

---

## TASK 2 — Fix: Board Community Cards Layout (CRITICAL)
Agent: board-layout-fix

A1. קרא `components/Board.tsx` במלואו.

A2. תקן לייאאוט קלפי הקהילה בכל בורד:
    - Slots 0, 1, 2 = **פתוחים תמיד** (ה-flop — קלפי הקהילה הגלויים)
    - Slots 3, 4 = **סגורים** (turn + river — יתגלו בשלב ה-reveal)
    - בשלב ה-reveal: כל 5 הקלפים נפתחים לפי הסדר

A3. ודא שהלייאאוט נכון גם בשלב ה-arrangement וגם ב-reveal.

A4. `npx tsc --noEmit 2>&1` — אפס שגיאות.
    `npx jest --silent 2>&1` — 31/31.

---

## FINAL STEPS

1. `npx tsc --noEmit 2>&1` — zero errors
2. `npx jest --silent 2>&1` — 31/31
3. `git add -A`
4. `git commit -m "fix: player hand face-up, board community cards layout"`
5. `eas build --platform ios --profile preview`
6. דווח בטבלה

---

## DO NOT
- לשנות Iron Rules
- לשבור את 31/31 הטסטים
- לגעת בלוגיקת המשחק — רק תיקונים ויזואליים
- לשאול שאלות באמצע הריצה
- לדלג על עדכון MEMORY.md
