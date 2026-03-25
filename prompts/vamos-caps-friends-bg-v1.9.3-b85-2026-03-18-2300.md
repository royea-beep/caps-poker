VAMOS CAPS FRIENDS-BG v1.9.3-b85 2026-03-18-2300

## Current state: v1.9.3 build #85 | commit c7ee76c
Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

---

## FEATURE: Friends TV show subtle background + settings selector

---

## TASK A — Create Friends backgrounds as SVG/inline assets
Agent: bg-designer

A1. Create 4 subtle background options as inline SVG strings in constants/friendsBgs.ts:

    Option 1: 'sofa' — Central Perk orange sofa silhouette, centered, opacity 6%
    Option 2: 'logo' — "Central Perk" text logo style (oval shape + text), bottom-right corner, opacity 8%
    Option 3: 'fountain' — simple fountain/water arc silhouette (from opening credits), centered bottom, opacity 5%
    Option 4: 'none' — no background (default)

    Each bg is an SVG string that can be rendered with react-native-svg or as a web <img>.

A2. Since react-native-svg may not be installed, use a simpler approach:
    - On web: render as absolute positioned <img> with SVG data URI
    - On native: use a <Text> with unicode characters to simulate silhouette OR skip on native

A3. Simple SVG designs (keep them minimal — these are WATERMARKS):

    Sofa SVG (simplified):
    ```svg
    <svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
      <!-- cushions -->
      <rect x="40" y="40" width="80" height="50" rx="15" fill="currentColor"/>
      <rect x="130" y="40" width="80" height="50" rx="15" fill="currentColor"/>
      <!-- back -->
      <rect x="20" y="20" width="260" height="35" rx="12" fill="currentColor"/>
      <!-- armrests -->
      <rect x="10" y="35" width="30" height="55" rx="10" fill="currentColor"/>
      <rect x="260" y="35" width="30" height="55" rx="10" fill="currentColor"/>
      <!-- legs -->
      <rect x="50" y="88" width="12" height="20" rx="3" fill="currentColor"/>
      <rect x="238" y="88" width="12" height="20" rx="3" fill="currentColor"/>
    </svg>
    ```

    Logo SVG (Central Perk style):
    ```svg
    <svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="40" rx="95" ry="35" fill="none" stroke="currentColor" stroke-width="3"/>
      <text x="100" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="currentColor" font-family="serif">Central</text>
      <text x="100" y="52" text-anchor="middle" font-size="22" font-weight="bold" fill="currentColor" font-family="serif">Perk</text>
    </svg>
    ```

    Fountain SVG:
    ```svg
    <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="85" rx="70" ry="12" fill="currentColor"/>
      <rect x="85" y="55" width="30" height="30" rx="5" fill="currentColor"/>
      <path d="M100 55 Q80 30 70 10 M100 55 Q100 25 100 5 M100 55 Q120 30 130 10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>
    ```

---

## TASK B — Add background to screens
Agent: bg-applier

B1. Create components/FriendsBg.tsx:
    ```tsx
    import React from 'react';
    import { View, Platform } from 'react-native';
    import { useGameStore } from '../store/gameStore';
    import { FRIENDS_BGS } from '../constants/friendsBgs';

    export function FriendsBg() {
      const friendsBg = useGameStore(s => s.friendsBg ?? 'none');
      if (friendsBg === 'none') return null;
      
      const bg = FRIENDS_BGS[friendsBg];
      if (!bg) return null;

      if (Platform.OS === 'web') {
        return (
          <View style={{
            position: 'absolute', inset: 0,
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}>
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(bg.svg(bg.color))}`}
              style={{
                width: bg.width,
                height: bg.height,
                opacity: bg.opacity,
                position: 'absolute',
                ...bg.position,
              }}
            />
          </View>
        );
      }
      
      // Native: skip for now (SVG rendering requires react-native-svg)
      return null;
    }
    ```

B2. Add `friendsBg` to gameStore (persisted):
    type FriendsBgId = 'none' | 'sofa' | 'logo' | 'fountain'
    default: 'none'

B3. Add <FriendsBg /> to:
    - app/index.tsx (inside SafeAreaView, before other content, zIndex 0)
    - app/game.tsx (same position)
    - app/results.tsx (same position)

---

## TASK C — Settings selector
Agent: settings-agent

C1. Read app/settings.tsx in full

C2. Add "BACKGROUND THEME" section at the TOP of settings (before HOME THEME):
    4 option tiles in a row:
    - NONE: dark box, text "None", no bg
    - SOFA: shows mini sofa SVG preview
    - LOGO: shows Central Perk text
    - FOUNTAIN: shows fountain SVG
    
    Active tile: gold border + checkmark
    Tap to switch

C3. npx tsc --noEmit — 0 errors

---

## FINAL STEPS
1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all pass
3. npx expo export --platform web --clear
4. node scripts/fix-web-html.js
5. cd dist && vercel --prod --yes
6. git add -A && git commit -m "feat: Friends TV show subtle bg watermark, settings selector [v1.9.3-b86]"
7. git push origin main
8. Update MEMORY.md with new feature
9. Report done

VAMOS CAPS FRIENDS-BG — END
