# CAPS POKER — Sprint 10 — MEGA AUDIT + FIX
# קרא MEMORY.md לפני הכל ואשר Iron Rules 1-8.
# הרץ 5 agents במקביל.

---

## Iron Rules (1-8 נעולים — אל תשנה)

---

## חוקי המשחק — תקרא בעיון לפני כל דבר

### חלוקת קלפים לפי מספר שחקנים
- 2 שחקנים: 4 בורדים, 16 קלפים לכל שחקן
- 3 שחקנים: 3 בורדים, 12 קלפים לכל שחקן
- 4 שחקנים: 2 בורדים, 8 קלפים לכל שחקן

### מבנה כל בורד
- **3 קלפי קהילה פתוחים (flop)** — מחולקים אוטומטית מהחפיסה בתחילת המשחק, גלויים לכולם
- **2 קלפי קהילה סגורים (turn + river)** — מחולקים אוטומטית אבל סגורים, מתגלים בשלב ה-reveal
- **כל שחקן שם 4 קלפים על הבורד** — כל 4 בשימוש
- הערכה: Omaha — בוחר 2 מתוך 4 הקלפים שלו + 3 מתוך 5 קלפי הקהילה

### ממשק הקצאת קלפים (חשוב!)
- **אין גרירה** — רק tap
- לחיצה על קלף מהיד → קלף נבחר (highlighted)
- לחיצה על בורד עם קלף נבחר → הקלף עובר לאותו בורד
- לחיצה על קלף שכבר על בורד → חוזר ליד
- כל שחקן רואה את **הקלפים שלו בלבד** — קלפי הבוט = face-down
- Ready מופעל רק כשכל הבורדים מלאים (4 קלפים כל אחד)

### סיכום מספרי
- 2 שחקנים: חפיסה של 52 קלפים — 32 לשחקנים + 20 לבורדים = 52 ✓
- 3 שחקנים: 36 לשחקנים + 15 לבורדים = 51 (מחפיסה של 52) ✓
- 4 שחקנים: 32 לשחקנים + 10 לבורדים = 42 ✓

---

## TASK 1 — AUDIT: Deal Logic (CRITICAL)
Agent: deal-auditor

A1. קרא `utils/gameLogic.ts`, `utils/deck.ts`, `utils/simulate.ts` במלואם.

A2. בדוק שהחלוקה נכונה:
    - כל בורד מקבל בדיוק 3 קלפי flop פתוחים + 2 קלפי turn/river סגורים
    - קלפי הקהילה נשלפים מהחפיסה **לפני** חלוקת הקלפים לשחקנים, או אחרי — לא משנה הסדר, רק שלא יהיו קלפים כפולים
    - המתמטיקה נכונה לפי מספר שחקנים

A3. אם יש בעיה בחלוקה — תקן. אם הכל תקין — דווח "VERIFIED" בלי לשנות כלום.

A4. כתוב בדיקה חדשה ב-`utils/__tests__/gameLogic.test.ts` (צור אם לא קיים):
    ```typescript
    describe('dealNewHand', () => {
      it('deals correct cards for 2 players', () => {
        const result = dealNewHand(2, DEFAULT_CONFIG);
        expect(result.boards.length).toBe(4);
        result.boards.forEach(board => {
          expect(board.communityCards.length).toBe(5); // 3 open + 2 closed
          expect(board.openCards.length).toBe(3);
          expect(board.closedCards.length).toBe(2);
        });
        expect(result.players[0].hand.length).toBe(16);
        expect(result.players[1].hand.length).toBe(16);
        // No duplicate cards
        const allCards = [
          ...result.players[0].hand,
          ...result.players[1].hand,
          ...result.boards.flatMap(b => b.communityCards),
        ];
        const ids = allCards.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
      it('deals correct cards for 3 players', () => { /* similar */ });
      it('deals correct cards for 4 players', () => { /* similar */ });
    });
    ```

A5. `npx jest --silent 2>&1` — כל הטסטים עוברים.

---

## TASK 2 — AUDIT + FIX: Board Component (CRITICAL)
Agent: board-auditor

A1. קרא `components/Board.tsx` ו-`components/Card.tsx` במלואם.

A2. ודא שהבורד מציג נכון:
    **שורת קלפי קהילה (communityRow):**
    - slots 0,1,2 (openCards): **תמיד face-up** עם rank ו-suit גלויים
    - slots 3,4 (closedCards): **face-down** עד reveal — כרטיס הפוך
    - אחרי reveal: כל 5 קלפים face-up

    **שורת קלפי שחקן (playerRow):**
    - 4 slots — כשריק: dashed border עם "+"
    - כשמלא: הקלף face-up עם rank ו-suit
    - בשלב arrangement: לחיצה על קלף מוצב → חוזר ליד

A3. תקן כל בעיה שמוצאת. שים לב במיוחד ל:
    - האם Card.tsx מציג קלף ריק/לבן כשאין card? תקן לתת placeholder נכון
    - האם faceDown={true} מציג גב קלף כהה? ודא שכן

A4. הוסף console.log זמני ב-Board.tsx (שנסיר אח"כ) כדי לראות מה מגיע:
    ```typescript
    console.log(`Board ${index}: openCards=${openCards.length}, closedCards=${closedCards.length}, playerCards=${playerCards.length}`);
    ```

A5. `npx tsc --noEmit 2>&1` — אפס שגיאות.

---

## TASK 3 — AUDIT + FIX: Game Screen (CRITICAL)
Agent: game-screen-auditor

A1. קרא `app/game.tsx` במלואו.

A2. עקוב אחרי כל ה-flow:
    - `initializeGame()` → איפה מאותחל?
    - `handleBoardPress(i)` → מה קורה כשלוחצים על בורד?
    - `handleCardSelect(card)` → מה קורה כשלוחצים על קלף?
    - `handleRemoveCardFromBoard(boardIndex, card)` → עובד?

A3. תקן בעיות שמוצא:
    - האם selectedCard מתנקה אחרי הצבת קלף? (צריך)
    - האם הכפתור "Place X more cards" מחשב נכון?
    - האם Ready button עובד נכון?
    - האם ה-timer מתחיל בשלב הנכון?

A4. ודא שהקלפים בתחתית (YOUR HAND) מציגים את **כל** 16/12/8 קלפים בשורה אחת scrollable — לא חסרים קלפים.

A5. `npx tsc --noEmit 2>&1` — אפס שגיאות.

---

## TASK 4 — AUDIT + FIX: Reveal + Summary (IMPORTANT)
Agent: reveal-auditor

A1. קרא `hooks/useRevealSequence.ts` ו-`app/summary.tsx` במלואם.

A2. ודא שה-reveal flow נכון:
    - בורדים מתגלים אחד אחד לפי boardRevealDuration
    - כשבורד מתגלה: closedCards (turn+river) נפתחים
    - winner מודגש (border ירוק/אדום)
    - COMPLETE bonus מוצג אם שחקן ניצח את כל הבורדים

A3. ודא שה-summary מציג:
    - תוצאה לכל בורד (win/lose/tie)
    - שם היד הטובה (e.g. "Two Pair", "Flush")
    - שינוי בצ'יפס (+/-)
    - COMPLETE bonus אם רלוונטי
    - כפתור "New Hand"

A4. תקן כל בעיה שמוצאת.

A5. `npx tsc --noEmit 2>&1` — אפס שגיאות.

---

## TASK 5 — Polish + Build (IMPORTANT)
Agent: polish-and-build

A1. הסר את ה-console.log שנוסף ב-Task 2 (Board.tsx).

A2. בדוק וודא:
    - אין warnings ב-TypeScript
    - אין dead imports
    - אין TODO/FIXME שנשארו

A3. הרץ את כל הטסטים:
    `npx jest --silent 2>&1`
    חייב לעבור הכל.

A4. עדכן MEMORY.md:
    - Current state: "Sprint 10 complete — full game audit, deal logic verified, board UI fixed"
    - עדכן open items

A5. `cp MEMORY.md "C:\Users\royea\.claude\projects\C--Projects-Caps\memory\MEMORY.md"`

A6. `git add -A`
    `git commit -m "sprint-10: full audit, deal logic verified, board UI polish"`

A7. `eas build --platform ios --profile preview --non-interactive`

A8. דווח בטבלה מלאה עם כל הממצאים.

---

## DO NOT
- לשנות Iron Rules 1-8
- לשבור טסטים קיימים
- להוסיף גרירה
- לשנות לוגיקת ה-Omaha evaluation
- לשאול שאלות באמצע
- לדלג על MEMORY.md
