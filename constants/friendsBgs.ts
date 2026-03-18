export type FriendsBgId = 'none' | 'sofa' | 'logo' | 'fountain';

interface FriendsBgEntry {
  svg: (color: string) => string;
  color: string;
  width: number;
  height: number;
  opacity: number;
  position: Record<string, string | number>;
}

const sofaSvg = (color: string) =>
  `<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" fill="${color}">` +
  `<rect x="40" y="40" width="80" height="50" rx="15"/>` +
  `<rect x="130" y="40" width="80" height="50" rx="15"/>` +
  `<rect x="20" y="20" width="260" height="35" rx="12"/>` +
  `<rect x="10" y="35" width="30" height="55" rx="10"/>` +
  `<rect x="260" y="35" width="30" height="55" rx="10"/>` +
  `<rect x="50" y="88" width="12" height="20" rx="3"/>` +
  `<rect x="238" y="88" width="12" height="20" rx="3"/>` +
  `</svg>`;

const logoSvg = (color: string) =>
  `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">` +
  `<ellipse cx="100" cy="40" rx="95" ry="35" fill="none" stroke="${color}" stroke-width="3"/>` +
  `<text x="100" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="${color}" font-family="serif">Central</text>` +
  `<text x="100" y="52" text-anchor="middle" font-size="22" font-weight="bold" fill="${color}" font-family="serif">Perk</text>` +
  `</svg>`;

const fountainSvg = (color: string) =>
  `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">` +
  `<ellipse cx="100" cy="85" rx="70" ry="12" fill="${color}"/>` +
  `<rect x="85" y="55" width="30" height="30" rx="5" fill="${color}"/>` +
  `<path d="M100 55 Q80 30 70 10 M100 55 Q100 25 100 5 M100 55 Q120 30 130 10" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
  `</svg>`;

export const FRIENDS_BGS: Record<Exclude<FriendsBgId, 'none'>, FriendsBgEntry> = {
  sofa: {
    svg: sofaSvg,
    color: '#ffffff',
    width: 320,
    height: 128,
    opacity: 0.06,
    position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  },
  logo: {
    svg: logoSvg,
    color: '#ffffff',
    width: 200,
    height: 80,
    opacity: 0.08,
    position: { bottom: 40, right: 40 },
  },
  fountain: {
    svg: fountainSvg,
    color: '#ffffff',
    width: 240,
    height: 120,
    opacity: 0.05,
    position: { bottom: 20, left: '50%', transform: 'translateX(-50%)' },
  },
};
