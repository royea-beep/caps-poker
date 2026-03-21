# CAPS POKER — Sprint 11 — FIX COMMUNITY CARDS
# קרא MEMORY.md לפני הכל ואשר Iron Rules 1-8.

---

## הבעיה
קלפי הקהילה (flop — 3 קלפים) מוצגים כקלפים לבנים ריקים בלי rank ו-suit.
הם כן מחולקים (כי Board.tsx מציג את מספר הנכון של slots) אבל הערכים לא גלויים.

## צעדי Debug
A1. קרא `utils/gameLogic.ts` במלואו — מצא את הפונקציה שמחלקת קלפים ובדוק:
    - האם openCards מכיל קלפים עם rank ו-suit תקינים?
    - האם הנתונים עוברים נכון לתוך state?

A2. קרא `app/game.tsx` — מצא איפה openCards מועבר ל-Board:
    - מה בדיוק עובר כ-openCards prop לכל Board?
    - האם זה `board.openCards` או משהו אחר?

A3. קרא `components/Board.tsx` — בדוק:
    - איך openCards מוצג?
    - האם Card.tsx מקבל card עם ערכים?

A4. קרא `components/Card.tsx` במלואו:
    - מה קורה כשמקבלים card עם rank ו-suit תקינים?
    - האם יש תנאי שמסתיר את הערכים?

A5. הוסף console.log זמני כדי לראות את הנתונים:
    ```typescript
    // ב-game.tsx לפני ה-return, תוסיף:
    console.log('Board 0 openCards:', JSON.stringify(boards[0]?.openCards));
    ```

A6. תקן את הבעיה — הקלפים צריכים להציג rank ו-suit.

A7. הסר console.log.

A8. `npx tsc --noEmit 2>&1` — אפס שגיאות.
    `npx jest --silent 2>&1` — 43/43.

A9. `git add -A`
    `git commit -m "fix: community cards show rank and suit"`
    `eas build --platform ios --profile preview --non-interactive`

A10. דווח מה היתה הבעיה ומה תוקן.
