# VAMOS CAPS UX-FIXES

## 7 OPEN BUGS TO FIX

---

### BUG 1-3: CARD READABILITY (3 reports - same issue)
**Summary:** Remove small rank/suit indicators from card corners. Resize cards to fit properly.

**Files:**
- `components/Card.tsx` - Has `hideCornerLabels` prop
- `components/Board.tsx` - Community cards
- `components/PlayerHand.tsx` - Hole cards

**Fix:**
```tsx
// In Card.tsx - ensure hideCornerLabels works and is used everywhere
// In Board.tsx - pass hideCornerLabels={true} to all cards
// In PlayerHand.tsx - same

// Also reduce card size by ~15% if they don't fit
```

---

### BUG 4: BOTTOM 3 BUTTONS TOO SMALL
**Hebrew:** "ה3 כפתורים למטה קטנים מדי תעש אותם כפתורים כמו כל השאר אולי בצבע אחר"
**Screen:** game_screen

**Fix:**
```tsx
// In app/game.tsx - find the bottom action buttons
// Increase padding, fontSize, minHeight
// Consider different color (gold accent?)
```

---

### BUG 5: BUG REPORTER SCREENSHOT CROPPED
**Summary:** Screenshot annotation view is cropped, not showing full image
**Screen:** bug_reporter

**Fix:**
```tsx
// In components/BugReporter.tsx or similar
// Check Image component - might need resizeMode: 'contain'
// Or ScrollView wrapper for large screenshots
```

---

### BUG 6: WHATSAPP SHARE FOR INVITE CODE
**Hebrew:** "שהיה כפתור שלח בווטסאפ לקוד הזה עם הזמנה נחמדה"
**Screen:** invite_screen

**Fix:**
```tsx
// Add Share button using Linking.openURL
// Format: whatsapp://send?text=...
import { Linking } from 'react-native';

const shareToWhatsApp = (code: string) => {
  const message = `היי! בוא תנסה את CAPS Poker 🃏\nקוד הזמנה: ${code}\nלהורדה: [APP_LINK]`;
  Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
};
```

---

### BUG 7: X BUTTON NOT WORKING + GRAPHICS QUALITY
**Hebrew:** "האיקס לא עובד... הגרפיקה גועל נפש"
**Screen:** game_screen

**Fix:**
1. Find the X (close) button - check onPress handler
2. Graphics quality - check image resolution and scaling

---

## PRIORITY ORDER
1. **Card readability** (3 bugs, most common complaint)
2. **X button not working** (functional bug)
3. **Bottom buttons size** (UX)
4. **WhatsApp share** (feature request)
5. **Bug reporter screenshot** (dev tool)

## AFTER FIXING
```bash
npx tsc --noEmit
npx jest --forceExit
git add -A
git commit -m "fix: card readability, button sizing, X button, WhatsApp share"
git push origin main
```

---

VAMOS CAPS UX-FIXES — END
