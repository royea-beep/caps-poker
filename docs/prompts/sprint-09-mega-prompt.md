# CAPS POKER — Sprint 09
# קרא MEMORY.md לפני הכל ואשר Iron Rules.
# הרץ 3 agents במקביל.

---

## Iron Rules Confirmation (1-8 נעולים)

---

## CONTEXT — חוקי המשחק (תקרא בעיון)

Caps Poker = Omaha על מספר בורדים במקביל.

### חלוקת קלפים
- 2 שחקנים: 4 בורדים, 16 קלפים לכל שחקן
- 3 שחקנים: 3 בורדים, 12 קלפים לכל שחקן
- 4 שחקנים: 2 בורדים, 8 קלפים לכל שחקן

### מבנה כל בורד
- 3 קלפי קהילה **פתוחים** (flop) — מחולקים אוטומטית מהחפיסה בתחילת המשחק
- 2 קלפי קהילה **סגורים** (turn + river) — מתגלים בשלב ה-reveal
- כל שחקן שם **4 קלפים** על הבורד — כולם 4 בשימוש
- הערכה: Omaha — בוחר 2 מתוך 4 הקלפים שלו + 3 מתוך 5 קלפי הקהילה

### ממשק הקצאת קלפים
- לא גרירה
- לחיצה על קלף מהיד → לחיצה על בורד = הקצאה של הקלף לאותו בורד
- כל שחקן רואה **את הקלפים שלו בלבד** (לא של יריב)
- קלפי הבוט/יריב מוצגים כ-face-down

---

## TASK 1 — Fix: Community Cards Auto-Deal (CRITICAL)
Agent: community-cards-fix

A1. קרא `utils/gameLogic.ts` ו-`utils/deck.ts` במלואם.

A2. קרא `utils/simulate.ts` — הבן איך dealNewHand מחלק קלפים.

A3. תקן את לוגיקת החלוקה:
    - כל בורד חייב לקבל **3 קלפי קהילה** (flop) בחלוקה הראשונית
    - עוד **2 קלפים** (turn+river) מחולקים לכל בורד אבל נשארים סגורים
    - הקלפים האלה לא נוגעים ב-16/12/8 קלפי השחקנים
    - סה"כ קלפים בשימוש: (שחקנים × קלפים לשחקן) + (בורדים × 5)

A4. ודא ש-`gameTypes.ts` מכיל שדות נכונים ל-board:
    ```typescript
    interface BoardState {
      communityCards: Card[];      // 5 קלפים — 3 פתוחים + 2 סגורים
      playerCards: Card[][];       // קלפי כל שחקן על הבורד (4 כל אחד)
      pot: number;
      result?: BoardResult;
    }
    ```

A5. `npx tsc --noEmit 2>&1` — אפס שגיאות.

---

## TASK 2 — Fix: Board UI Display (CRITICAL)
Agent: board-ui-fix

A1. קרא `components/Board.tsx` במלואו.

A2. תקן את תצוגת קלפי הקהילה:
    - slots 0,1,2 = communityCards[0,1,2] — **פתוחים תמיד**
    - slots 3,4 = communityCards[3,4] — **סגורים** (face-down) עד reveal
    - אחרי reveal: כל 5 קלפים פתוחים

A3. תקן את תצוגת קלפי השחקן על הבורד:
    - 4 slots ריקים (dashed border) לקלפי השחקן
    - כשמוקצה קלף — מציג אותו face-up
    - קלפי הבוט על הבורד = face-down עד reveal

A4. הוסף visual feedback:
    - בורד שנבחר (כדי להוסיף קלף) = border מוזהב בולט
    - slot ריק שניתן להוסיף קלף = pulse animation עדין

A5. `npx tsc --noEmit 2>&1` — אפס שגיאות.

---

## TASK 3 — Fix: Card Assignment UX (CRITICAL)
Agent: card-assignment-ux

A1. קרא `app/game.tsx` במלואו — הבן את flow הקצאת הקלפים.

A2. תקן את ה-UX:
    **הלוגיקה:**
    - לחיצה על קלף מהיד → הקלף נבחר (highlighted)
    - לחיצה על בורד עם קלף נבחר → הקלף עובר לבורד
    - לחיצה על קלף שכבר על בורד → חזרה ליד
    - לחיצה על קלף אחר → מחליף בחירה
    
    **ולידציה:**
    - כל בורד מקבל בדיוק 4 קלפים
    - Ready button מופעל רק כשכל הבורדים מלאים

A3. ודא שהכפתור מציג את הסטטוס:
    - "Place X more cards" כשיש עוד קלפים להציב
    - "READY" כשכל הקלפים הוצבו

A4. `npx tsc --noEmit 2>&1` — אפס שגיאות.
    `npx jest --silent 2>&1` — 31/31.

---

## FINAL STEPS

1. `npx tsc --noEmit 2>&1` — zero errors
2. `npx jest --silent 2>&1` — 31/31
3. עדכן MEMORY.md
4. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`
5. `git add -A`
6. `git commit -m "fix: community cards auto-deal, board UI, card assignment UX"`
7. `eas build --platform ios --profile preview`
8. דווח בטבלה

---

## DO NOT
- לשנות Iron Rules
- לשבור 31/31 טסטים
- להוסיף גרירה (drag & drop) — רק tap-to-select + tap-to-place
- לשאול שאלות באמצע
- לדלג על MEMORY.md
