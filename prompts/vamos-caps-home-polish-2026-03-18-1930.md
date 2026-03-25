VAMOS CAPS HOME-POLISH 2026-03-18-1930

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## TASK A — Fix home screen layout + title
Agent: home-fixer

A1. Read app/index.tsx in full

A2. Fix title:
    Change "CAPS" → "CAPS POKER"
    Keep it large and bold but slightly smaller: fontSize 52 (was 64)

A3. Remove "SIT & GO" button completely from home screen
    (keep the screen file, just remove the button from index.tsx)

A4. Fix button layout — responsive to all screen sizes:
    - Use useWindowDimensions() to get screen height
    - If screen height < 700px: smaller padding, smaller font
    - If screen height >= 700px: normal sizing
    - Button height: Math.min(52, screenH * 0.07)
    - Button font size: Math.min(16, screenH * 0.022)
    - Gap between buttons: Math.min(10, screenH * 0.013)

A5. Fix BugReporter icon overlapping JOIN GAME button:
    Move it to bottom: safeArea.bottom + 16, right: 16
    Make sure it doesn't overlap any button

A6. Fix version showing twice (v1.9.2 and v1.9.2 (?)):
    Show only ONE version in bottom-right

---

## TASK B — 10 color themes + button style options
Agent: theme-expander

B1. Read constants/homeThemes.ts in full
B2. Read app/settings.tsx in full

B3. Expand to 10 color themes:
    ```typescript
    export const HOME_THEMES = {
      dark_gold: { name: 'Dark Gold', accent: '#c9a84c', bg: '#0a0a0a', ... },
      navy_silver: { name: 'Navy Silver', accent: '#7eb8e8', bg: '#0a0f1e', ... },
      purple_neon: { name: 'Purple Neon', accent: '#b44fff', bg: '#080010', ... },
      casino_red: { name: 'Casino Red', accent: '#e8192c', bg: '#0a0000', ... },
      emerald: { name: 'Emerald', accent: '#00c875', bg: '#001a0d', ... },
      rose_gold: { name: 'Rose Gold', accent: '#e8a0b4', bg: '#120008', ... },
      ocean: { name: 'Ocean', accent: '#00d4ff', bg: '#000d1a', ... },
      sunset: { name: 'Sunset', accent: '#ff6b35', bg: '#0a0500', ... },
      arctic: { name: 'Arctic', accent: '#e8f4f8', bg: '#0a0f14', ... },
      matrix: { name: 'Matrix', accent: '#00ff41', bg: '#000a00', ... },
    };
    ```

B4. Add button style options (3 styles):
    ```typescript
    export type ButtonStyle = 'solid' | 'glass' | 'outline';
    // solid: filled background, strong
    // glass: glassmorphism — semi-transparent with blur
    // outline: border only, transparent background
    ```
    Store in gameStore: buttonStyle (default: 'solid')

B5. Update settings.tsx:
    - HOME THEME section: show 10 color swatches in 2 rows of 5
      Each swatch: 40x40px circle with theme accent color
      Active: white border + checkmark
      Show theme name below active swatch
    - BUTTON STYLE section: show 3 options with preview
      Each preview shows a mini button in that style

B6. Apply buttonStyle in index.tsx — buttons render differently based on style:
    solid: backgroundColor = accent, text = dark
    glass: backgroundColor = accent+'20', border = accent, backdrop blur (web only)
    outline: backgroundColor = transparent, border = accent, text = accent

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: CAPS POKER title, 10 themes, button styles, responsive layout"
7. git push origin main
8. Update MEMORY.md
9. Report done

VAMOS CAPS HOME-POLISH — END
