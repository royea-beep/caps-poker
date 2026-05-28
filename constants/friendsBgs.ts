export type FriendsBgId = 'none' | 'sofa' | 'logo' | 'fountain';

interface FriendsBgEntry {
  svg: (color: string) => string;
  color: string;
  width: number;
  height: number;
  opacity: number;
  position: Record<string, string | number>;
}

// Original poker-themed background motifs. IDs are kept (`sofa`/`logo`/`fountain`)
// so persisted user preferences continue to resolve; only the rendered SVG and the
// user-facing labels (see app/settings.tsx BG_OPTIONS) have changed.

// 'sofa' → "Felt — Green table": oval poker-table outline with rail.
const feltTableSvg = (color: string) =>
  `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${color}" stroke-width="3">` +
  `<ellipse cx="160" cy="80" rx="150" ry="65"/>` +
  `<ellipse cx="160" cy="80" rx="135" ry="52"/>` +
  `<circle cx="160" cy="80" r="6" fill="${color}"/>` +
  `<circle cx="100" cy="80" r="3" fill="${color}"/>` +
  `<circle cx="220" cy="80" r="3" fill="${color}"/>` +
  `<circle cx="160" cy="50" r="3" fill="${color}"/>` +
  `<circle cx="160" cy="110" r="3" fill="${color}"/>` +
  `</svg>`;

// 'logo' → "Neon — Casino sign": neon-style rounded sign with "CAPS" wordmark.
const neonSignSvg = (color: string) =>
  `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">` +
  `<rect x="6" y="10" width="188" height="60" rx="14" fill="none" stroke="${color}" stroke-width="2"/>` +
  `<rect x="14" y="18" width="172" height="44" rx="9" fill="none" stroke="${color}" stroke-width="1" opacity="0.6"/>` +
  `<text x="100" y="50" text-anchor="middle" font-size="26" font-weight="bold" fill="${color}" font-family="Impact, Haettenschweiler, sans-serif" letter-spacing="6">CAPS</text>` +
  `</svg>`;

// 'fountain' → "Vegas — Strip lights": vertical light beams over a baseline.
const vegasLightsSvg = (color: string) =>
  `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">` +
  `<line x1="20" y1="20" x2="20" y2="100" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
  `<line x1="60" y1="8"  x2="60" y2="100" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
  `<line x1="100" y1="2" x2="100" y2="100" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
  `<line x1="140" y1="8" x2="140" y2="100" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
  `<line x1="180" y1="20" x2="180" y2="100" stroke="${color}" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="20" cy="20" r="4" fill="${color}"/>` +
  `<circle cx="60" cy="8"  r="4" fill="${color}"/>` +
  `<circle cx="100" cy="2" r="4" fill="${color}"/>` +
  `<circle cx="140" cy="8" r="4" fill="${color}"/>` +
  `<circle cx="180" cy="20" r="4" fill="${color}"/>` +
  `<rect x="10" y="100" width="180" height="6" fill="${color}" opacity="0.6"/>` +
  `</svg>`;

export const FRIENDS_BGS: Record<Exclude<FriendsBgId, 'none'>, FriendsBgEntry> = {
  sofa: {
    svg: feltTableSvg,
    color: '#ffffff',
    width: 320,
    height: 160,
    opacity: 0.06,
    position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  },
  logo: {
    svg: neonSignSvg,
    color: '#ffffff',
    width: 200,
    height: 80,
    opacity: 0.08,
    position: { bottom: 40, right: 40 },
  },
  fountain: {
    svg: vegasLightsSvg,
    color: '#ffffff',
    width: 240,
    height: 120,
    opacity: 0.05,
    position: { bottom: 20, left: '50%', transform: 'translateX(-50%)' },
  },
};
