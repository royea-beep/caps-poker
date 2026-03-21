VAMOS CAPS THEME-SYSTEM v1.9.3-b103 2026-03-20-0100

## Current state: v1.9.3 build #103 | commit dc20ce6
Read MEMORY.md. Iron Rules confirmed. Rule 2 UNLOCKED.
Standing Orders: Fix autonomously. Never give user commands.

## GOAL
Two complete visual themes selectable on first launch AND in Settings:
- CLASSIC: current dark gold style
- FIVE-O: inspired by Five-O Poker screenshots (red felt, big cards, yellow buttons)

User picks theme on first launch (alongside orientation pick). Can change in Settings.
Theme affects: cards, boards, buttons, menus, home screen.

---

## TASK A — Theme system in gameStore (agent: store-agent)

A1. Read store/gameStore.ts

A2. Add visual theme field:
    ```typescript
    export type VisualTheme = 'classic' | 'fiveo';
    ```

A3. Add to GameStore interface:
    ```typescript
    visualTheme: VisualTheme;
    setVisualTheme: (v: VisualTheme) => void;
    ```

A4. Default: 'classic', persisted in AsyncStorage

A5. Add to partialize list

---

## TASK B — Theme tokens (agent: tokens-agent)

B1. Create constants/visualThemes.ts:
    ```typescript
    export type VisualTheme = 'classic' | 'fiveo';

    interface ThemeTokens {
      // Backgrounds
      background: string;
      surface: string;
      boardBg: string;        // felt color
      boardBorder: string;

      // Text
      textPrimary: string;
      textSecondary: string;
      textMuted: string;

      // Accent
      accent: string;         // main accent (gold vs yellow)
      accentText: string;     // text on accent buttons

      // Cards
      cardFace: string;       // card background
      cardBorder: string;
      cardShadow: string;

      // Buttons
      primaryBtn: string;
      primaryBtnText: string;
      primaryBtnRadius: number;

      // Special
      winColor: string;
      loseColor: string;
    }

    export const THEMES: Record<VisualTheme, ThemeTokens> = {
      classic: {
        background: '#0a0a0a',
        surface: '#111111',
        boardBg: '#6B0000',        // deep red felt
        boardBorder: '#8B0000',
        textPrimary: '#f0f0e8',
        textSecondary: '#c9a84c',  // gold
        textMuted: '#666666',
        accent: '#c9a84c',
        accentText: '#0a0a0a',
        cardFace: '#ffffff',
        cardBorder: '#c9a84c',
        cardShadow: 'rgba(201,168,76,0.3)',
        primaryBtn: '#c9a84c',
        primaryBtnText: '#0a0a0a',
        primaryBtnRadius: 12,
        winColor: '#22c55e',
        loseColor: '#ef4444',
      },
      fiveo: {
        background: '#1a1a2e',     // dark navy (Five-O sidebar)
        surface: '#16213e',
        boardBg: '#8B0000',        // brighter red felt (like Five-O)
        boardBorder: '#cc0000',
        textPrimary: '#ffffff',
        textSecondary: '#FFD700',  // bright yellow
        textMuted: '#aaaaaa',
        accent: '#FFD700',         // Five-O yellow-gold
        accentText: '#000000',
        cardFace: '#f8f8f8',       // slightly off-white like Five-O
        cardBorder: '#dddddd',
        cardShadow: 'rgba(0,0,0,0.5)',
        primaryBtn: '#FFD700',     // Five-O yellow button
        primaryBtnText: '#000000',
        primaryBtnRadius: 8,       // less rounded than classic
        winColor: '#00cc44',
        loseColor: '#cc0000',
      },
    };

    export function getTheme(theme: VisualTheme): ThemeTokens {
      return THEMES[theme];
    }
    ```

---

## TASK C — Apply theme to all screens (agent: theme-apply-agent)

C1. Read app/index.tsx — home screen
C2. Read app/game.tsx — game screen
C3. Read components/Card.tsx
C4. Read components/Board.tsx
C5. Read app/settings.tsx
C6. Read app/results.tsx

C7. In each file — add theme support:
    ```typescript
    import { getTheme } from '../constants/visualThemes';
    const visualTheme = useGameStore(s => s.visualTheme);
    const theme = getTheme(visualTheme);
    ```

C8. Replace hardcoded COLORS.xxx with theme.xxx where relevant:
    - COLORS.gold → theme.accent
    - COLORS.background → theme.background
    - COLORS.surface → theme.surface
    - Board background → theme.boardBg
    - Primary buttons → theme.primaryBtn / theme.primaryBtnText / theme.primaryBtnRadius
    - Card face → theme.cardFace

C9. Five-O specific touches when theme === 'fiveo':
    - Cards: larger font size (rank = card height * 0.5 instead of 0.42)
    - Buttons: bold, uppercase, yellow with black text, slight shadow
    - Board borders: brighter red, more contrast
    - Home screen title: white instead of gold

C10. Make sure COLORS constants still work as fallback for anything not themed yet

---

## TASK D — Visual theme picker on first launch (agent: picker-agent)

D1. Read app/orientation-pick.tsx — use as template

D2. Create app/theme-pick.tsx:
    ```tsx
    // Full screen choice shown BEFORE orientation pick (or after):
    // Title: "CAPS POKER"
    // Subtitle: "CHOOSE YOUR STYLE"
    //
    // [CLASSIC card]              [FIVE-O card]
    // Dark gold elegant           Red felt action
    // Preview: dark bg, gold C    Preview: red bg, big card
    // "Timeless"                  "Arcade"
    //
    // TAP → saves to store → navigates to /orientation-pick (if not set) or home
    ```

D3. Show themed preview in each card using actual colors:
    - Classic card: dark background, gold border, gold C logo
    - Five-O card: red background, yellow button, white text

D4. In app/_layout.tsx — add visualTheme check:
    - If visualTheme is null → show theme-pick first
    - After theme → show orientation-pick
    - After both → show home

D5. Update _layout.tsx redirect logic:
    ```typescript
    // Priority: theme pick → orientation pick → home
    useEffect(() => {
      if (splashDone) {
        if (!visualTheme) {
          router.replace('/theme-pick');
        } else if (!orientation) {
          router.replace('/orientation-pick');
        }
      }
    }, [splashDone, visualTheme, orientation]);
    ```

---

## TASK E — Settings: visual theme toggle (agent: settings-agent)

E1. Read app/settings.tsx
E2. Add VISUAL THEME section at top (before ORIENTATION):
    ```
    🎨 VISUAL STYLE
    [CLASSIC tile]  [FIVE-O tile]
    Shows mini preview with theme colors
    ```
E3. On change: update store immediately (live preview)

---

## TASK F — Multiplayer test (agent: multiplayer-agent)

F1. Read app/lobby/host.tsx and app/lobby/join.tsx
F2. Read utils/networking.ts or similar — find tcp-socket or Supabase Realtime
F3. Check if Iron Rule 7 (local TCP) is implemented:
    - Does HOST GAME work?
    - Does JOIN GAME work?
    - What happens when 2 players connect?
F4. Check Iron Rule 8 (internet multiplayer via Supabase Realtime):
    - Is there a PLAY ONLINE flow?
    - Does it connect?
F5. Report status of both — fix any crashes found
F6. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — 115/115
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: visual theme system Classic/Five-O, theme picker on launch, multiplayer audit [v1.9.3-b104]"
7. git push origin main
8. Update MEMORY.md
9. Report: what changed visually, multiplayer status

VAMOS CAPS THEME-SYSTEM — END
