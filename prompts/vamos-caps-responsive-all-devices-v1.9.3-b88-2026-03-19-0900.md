VAMOS CAPS RESPONSIVE-ALL-DEVICES v1.9.3-b88 2026-03-19-0900

## Current state: v1.9.3 build #88 | commit 583c1d5
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## PROBLEM
On mobile web (iPhone Safari), cards in YOUR HAND are too big.
Boards show 2x2 grid which is good, but hand cards overflow.
Need responsive sizing for ALL device types.

---

## TASK A — Device breakpoint system
Agent: responsive-agent

A1. Create constants/deviceBreakpoints.ts:
    ```typescript
    import { Dimensions, Platform } from 'react-native';

    const { width: W, height: H } = Dimensions.get('window');

    // Device categories
    export const DEVICE = {
      // Mobile web (iPhone in browser)
      isMobileWeb: Platform.OS === 'web' && W < 500,
      // Tablet web
      isTabletWeb: Platform.OS === 'web' && W >= 500 && W < 1024,
      // Desktop web
      isDesktopWeb: Platform.OS === 'web' && W >= 1024,
      // Native small (iPhone SE, 375px)
      isNativeSmall: Platform.OS !== 'web' && W <= 375,
      // Native medium (iPhone 14, 390px)
      isNativeMedium: Platform.OS !== 'web' && W > 375 && W <= 430,
      // Native large (iPhone Pro Max, 430px+)
      isNativeLarge: Platform.OS !== 'web' && W > 430,
      
      W,
      H,
    };

    // Responsive value helper
    export function rv(mobileweb: number, tablet: number, desktop: number, native: number): number {
      if (Platform.OS !== 'web') return native;
      if (W < 500) return mobileweb;
      if (W < 1024) return tablet;
      return desktop;
    }
    ```

A2. Read app/game.tsx — find BOARD_CARD_H and all hardcoded sizes

A3. Fix BOARD_CARD_H to be responsive:
    ```typescript
    import { DEVICE, rv } from '../constants/deviceBreakpoints';
    
    const BOARD_CARD_H = rv(
      56,   // mobile web (iPhone Safari)
      72,   // tablet web
      100,  // desktop web
      Math.max(52, Math.min(82, Math.floor(boardSpace / 2)))  // native
    );
    ```

A4. Read components/PlayerHand.tsx — fix card sizes:
    ```typescript
    const cardW = (() => {
      if (Platform.OS !== 'web') return Math.min(36, Math.max(28, maxCardW));
      if (DEVICE.isMobileWeb) return Math.min(52, Math.max(40, maxCardW));  // mobile web
      if (DEVICE.isTabletWeb) return Math.min(64, Math.max(52, maxCardW));  // tablet
      return Math.min(80, Math.max(64, maxCardW));  // desktop
    })();
    ```

A5. Read components/Board.tsx — fix board card height:
    ```typescript
    const ch = cardHeightProp ?? rv(56, 72, 90, 64);
    ```

A6. Read components/RevealSequence.tsx — fix reveal card sizes:
    ```typescript
    const commCardW = rv(44, 54, 58, 48);
    const commCardH = rv(62, 76, 82, 68);
    const handCardW = rv(38, 46, 52, 42);
    const handCardH = rv(54, 66, 74, 60);
    ```

A7. npx tsc --noEmit — 0 errors

---

## TASK B — Fix home screen for mobile web
Agent: home-mobile-fixer

B1. Read app/index.tsx
B2. On mobile web (W < 500), reduce all sizes:
    - Title: Math.min(36, Math.floor(W * 0.09))
    - Button height: Math.min(42, H * 0.055)
    - Button font: Math.min(13, H * 0.017)
    - Stats box: paddingVertical 6
    - Gap between buttons: 6px
B3. Make sure the whole home screen fits WITHOUT scrolling on mobile web
B4. npx tsc --noEmit — 0 errors

---

## TASK C — Fix game screen layout on mobile web
Agent: game-mobile-fixer

C1. Read app/game.tsx
C2. On mobile web (W < 500):
    - 2x2 grid with smaller boards
    - boardCellHalf: width exactly '50%', no padding
    - YOUR HAND section: 2 rows of 8 cards, smaller cards
C3. Verify 2x2 grid is applied correctly on mobile web
C4. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "fix: responsive sizing for all devices — mobile web, tablet, desktop, native [v1.9.3-b89]"
7. git push origin main
8. Update MEMORY.md
9. Report done with device size table

VAMOS CAPS RESPONSIVE-ALL-DEVICES — END
