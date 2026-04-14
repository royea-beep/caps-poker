const fs = require('fs');
const path = require('path');
const base = path.dirname(__filename);

// Fix index.tsx
let idx = fs.readFileSync(path.join(base, 'app/index.tsx'), 'utf8');
idx = idx.replace(
  "const theme = HOME_THEMES[homeThemeId];",
  "const theme = HOME_THEMES[homeThemeId] ?? HOME_THEMES[DEFAULT_HOME_THEME];"
);
if (!idx.includes('DEFAULT_HOME_THEME')) {
  idx = idx.replace(
    "import { HOME_THEMES } from '../constants/homeThemes';",
    "import { HOME_THEMES, DEFAULT_HOME_THEME } from '../constants/homeThemes';"
  );
}
fs.writeFileSync(path.join(base, 'app/index.tsx'), idx, 'utf8');
console.log('index.tsx: HOME_THEMES fallback added');

// Fix TournamentLobby.tsx
const tlPath = path.join(base, 'components/TournamentLobby.tsx');
let tl = fs.readFileSync(tlPath, 'utf8');
const tlBefore = tl;
tl = tl.replace(/\bT\.bg\b/g, "T?.bg ?? '#1a1a2e'");
if (tl !== tlBefore) { fs.writeFileSync(tlPath, tl, 'utf8'); console.log('TournamentLobby.tsx: T.bg fallback added'); }
else { console.log('TournamentLobby.tsx: no change needed'); }

// Fix Badge.tsx
const badgePath = path.join(base, 'components/Badge.tsx');
let bc = fs.readFileSync(badgePath, 'utf8');
bc = bc.replace('{ backgroundColor: colors.bg }', "{ backgroundColor: colors?.bg ?? '#1a1a2e' }");
fs.writeFileSync(badgePath, bc, 'utf8');
console.log('Badge.tsx: colors.bg fallback added');

console.log('All fixes applied.');
