VAMOS CAPS REDESIGN

Read MEMORY.md before starting. Iron Rules 1-8 confirmed.

Standing Orders:
- Try ALL actions autonomously first
- Check C:/Projects/ for credentials (FTP: ftableco / CPANEL_PASSWORD_REDACTED / ftable.co.il)
- Never give user commands to run

---

## Vision: Premium Casino — Black, Gold, Leather

The entire app needs a visual overhaul. Think: high-stakes private casino in Monaco.
- **Background:** Deep black (#0a0a0a) with subtle leather texture (CSS noise/grain overlay)
- **Primary accent:** Rich gold (#c9a84c) with shimmer on hover
- **Cards:** Crisp white faces, deep navy suits for clubs/spades, rich crimson for hearts/diamonds
- **Typography:** Playfair Display (serif, elegant) for headings + Inter/DM Sans for body — load from Google Fonts
- **Buttons:** Dark background with gold border + gold text. Hover = gold fill + black text. Smooth 200ms transition.
- **Boards:** Dark green felt (#0d2b1a) with subtle fabric texture, gold border
- **Shadows:** Deep, dramatic drop shadows everywhere (box-shadow: 0 8px 32px rgba(0,0,0,0.6))
- **Version number:** Always visible bottom-right of home screen, styled in gold, small

---

## TASK A — Global Theme Overhaul
Agent: theme-agent

A1. Read constants/theme.ts in full
A2. Redesign all color tokens:
    ```typescript
    // Premium Casino palette
    background: '#0a0a0a',        // Deep black
    surface: '#111111',           // Card/panel background
    surfaceElevated: '#1a1a1a',   // Elevated surfaces
    felt: '#0d2b1a',              // Board felt green
    feltLight: '#163d26',         // Lighter felt
    feltBorder: '#1e5c38',        // Felt border
    gold: '#c9a84c',              // Primary gold
    goldLight: '#e8c96a',         // Hover gold
    goldDark: '#9a7a2e',          // Pressed gold
    cardWhite: '#f5f0e8',         // Warm white card face
    cardBlack: '#1a1a2e',         // Dark navy for spades/clubs
    cardRed: '#c0392b',           // Rich crimson for hearts/diamonds
    textPrimary: '#f0ead6',       // Warm cream text
    textSecondary: '#8a7a5a',     // Muted gold-brown
    border: '#2a2a2a',            // Subtle border
    success: '#27ae60',
    danger: '#c0392b',
    ```
A3. Update FONTS — add to app/_layout.tsx:
    Load Playfair Display from Google Fonts (use expo-font or @expo-google-fonts/playfair-display)
    If package not installed: npm install @expo-google-fonts/playfair-display expo-font
A4. npx tsc --noEmit — 0 errors

---

## TASK B — Home Screen (index.tsx) Redesign
Agent: home-agent

B1. Read app/index.tsx in full
B2. Complete visual redesign:
    - Full-screen dark background with grain texture overlay (use SVG filter or CSS)
    - Logo area: "CAPS" in Playfair Display, large, gold gradient text
    - Subtitle: "The Game Where Every Board Counts" — elegant, spaced
    - Balance display: large gold number, coin icon
    - Stats row: played/won/winrate — styled as elegant data with separators
    - Buttons: premium outlined style, gold border, uppercase, letter-spacing: 2px
    - NEW HAND button: larger, filled gold background, black text — primary CTA
    - Version number: bottom-right, gold, small (v{version} from app.json / Constants.expoConfig)
    - Subtle horizontal gold divider lines between sections
B3. npx tsc --noEmit — 0 errors

---

## TASK C — Card Component Redesign
Agent: card-agent

C1. Read components/Card.tsx in full
C2. Premium card redesign:
    - Card face: warm white (#f5f0e8) with very subtle inner shadow
    - Rank + suit: larger, bolder. Clubs/spades in dark navy, hearts/diamonds in rich crimson
    - Card back: deep green felt texture — use linear-gradient with subtle pattern
    - Corner radius: 8px
    - Box shadow: 0 4px 12px rgba(0,0,0,0.5)
    - Face-down card: elegant back pattern (diagonal lines or diamond pattern in CSS)
    - Highlighted card: gold glow border (box-shadow: 0 0 12px #c9a84c)
    - Dimmed card: 40% opacity
C3. npx tsc --noEmit — 0 errors

---

## TASK D — Board Component Redesign
Agent: board-agent

D1. Read components/Board.tsx in full
D2. Premium board redesign:
    - Board container: dark green felt (#0d2b1a), gold border (1.5px), border-radius: 12px
    - Board header: "BOARD 1" in small gold caps, pot amount with coin icon
    - Empty card slots: dashed gold border, subtle pulse when in arrangement phase
    - Community cards area: subtle felt texture separator between flop and turn/river
    - Winner board: bright gold border glow
    - Loser board: dim, 70% opacity
    - Player/bot cards row: labeled elegantly
D3. npx tsc --noEmit — 0 errors

---

## TASK E — Build + Deploy
Agent: deploy-agent

E1. npx tsc --noEmit — 0 errors
E2. npx jest --silent — all pass
E3. Bump version: open app.json, increment patch version (e.g. 1.3.0 → 1.3.1)
E4. npx expo export --platform web
E5. Patch dist/index.html: add type="module" to script tag (run node scripts/fix-web-html.js if exists)
E6. Upload dist/ to FTP:
    - ftableco / CPANEL_PASSWORD_REDACTED / ftable.co.il
    - Target: /home/ftableco/public_html/caps/
    Use this Python FTP script:
    ```python
    import ftplib, os, io
    HOST="ftable.co.il"; USER="ftableco"; PASS="CPANEL_PASSWORD_REDACTED"
    REMOTE_BASE="/home/ftableco/public_html/caps"; LOCAL_BASE="C:/Projects/Caps/dist"
    ftp=ftplib.FTP(HOST); ftp.login(USER,PASS); ftp.set_pasv(True)
    def mkdirs(ftp,path):
        parts=path.split("/"); current=""
        for p in parts:
            if not p: continue
            current+="/"+p
            try: ftp.mkd(current)
            except: pass
    def upload(ftp,ld,rd):
        mkdirs(ftp,rd)
        for item in os.listdir(ld):
            lp=os.path.join(ld,item); rp=rd+"/"+item
            if os.path.isdir(lp): upload(ftp,lp,rp)
            else:
                with open(lp,"rb") as f: ftp.storbinary(f"STOR {rp}",f)
    upload(ftp,LOCAL_BASE,REMOTE_BASE)
    ftp.storbinary("STOR "+REMOTE_BASE+"/.htaccess",io.BytesIO(b"RewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.html [L]\n"))
    ftp.quit(); print("Done.")
    ```
E7. Trigger EAS build for TestFlight:
    eas build --platform ios --profile preview --non-interactive
E8. git add -A && git commit -m "redesign: premium casino theme — black, gold, leather"
E9. Update MEMORY.md
E10. Report full result table

---

## DO NOT
- Change Iron Rules 1-8
- Break 112/112 tests
- Change game logic
- Ask questions — decide and execute

VAMOS CAPS REDESIGN — END
