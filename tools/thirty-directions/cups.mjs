/**
 * THE CUP FAMILY — the one asset in this product that no competitor owns.
 *
 * ── WHAT A CUP ACTUALLY IS IN THE APP, CHECKED BEFORE ANYTHING WAS DRAWN ────────────────────
 * `app/(tabs)/cups.tsx` renders each cup as **the 🏆 emoji at rf(26)** inside a 52pt rounded
 * square filled with the tier colour. That is the whole asset. There is no cup illustration, no
 * SVG, no PNG — `assets/` contains icons, a splash and sounds, and nothing cup-shaped. The five
 * tiers come from the `cups` table and are used here verbatim rather than invented:
 *
 *     bronze   #CD7F32   tier 1   10 hands won
 *     silver   #C0C0C0   tier 2   50
 *     gold     #FFD700   tier 3   100
 *     platinum #E5E4E2   tier 4   150
 *     diamond  #B9F2FF   tier 5   200
 *
 * ── SO THERE ARE TWO CUPS HERE, AND THE DIFFERENCE IS THE POINT ─────────────────────────────
 * `cupEmoji()` is the REAL cup — the literal glyph the Cups tab draws today. `cupVector()` is a
 * drawn cup in the same tier colours. The brief warned that inventing a cup creates a second
 * brand, and it is right: **any vector cup hero obliges the Cups tab to adopt the same mark**,
 * or the app ships two different trophies. That cost is stated in the report, not buried.
 *
 * Both are rendered, side by side, in K0 — because "use the real thing" is only good advice once
 * you have seen what the real thing looks like at hero size. A colour emoji is also drawn by the
 * PLATFORM: Noto here, Apple's on Roye's phone, something else on Android. A hero whose subject
 * changes shape per platform is not a brand mark, and that is a fact about the emoji, not an
 * opinion about it.
 */

import { P, DISPLAY, UI, POSTER, card, suit, grain, weave } from './lib.mjs';

/** The five tiers, verbatim from the `cups` table. Not invented, not approximated. */
export const CUP_TIERS = [
  { id: 'bronze',   color: '#CD7F32', tier: 1, won: 10 },
  { id: 'silver',   color: '#C0C0C0', tier: 2, won: 50 },
  { id: 'gold',     color: '#FFD700', tier: 3, won: 100 },
  { id: 'platinum', color: '#E5E4E2', tier: 4, won: 150 },
  { id: 'diamond',  color: '#B9F2FF', tier: 5, won: 200 },
];
export const GOLD_CUP = '#FFD700';

/**
 * A drawn cup: bowl, handles, stem, base. Two silhouettes were prototyped and looked at; this is
 * the one whose stem and base actually connect. `gloss` adds a single specular band so it does
 * not read as a flat sticker at hero size.
 */
export function cupVector(size, colour = GOLD_CUP, { rot = 0, x = null, y = null, gloss = true, opacity = 1, shadow = 0 } = {}) {
  const pos = (x === null && y === null) ? '' : `position:absolute;left:${x}px;top:${y}px;`;
  const id = Math.random().toString(36).slice(2, 8);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"
    style="${pos}transform:rotate(${rot}deg);opacity:${opacity};overflow:visible;
    ${shadow ? `filter:drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,.65))` : ''}">
    ${gloss ? `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".55"/>
      <stop offset="34%" stop-color="${colour}" stop-opacity="0"/>
    </linearGradient></defs>` : ''}
    <g fill="${colour}">
      <path d="M28 12 h44 v14 c0 18 -4 30 -12 36 c-2 2 -5 3 -8 4 v12 h11 v6 h-30 v-6 h11 v-12 c-3 -1 -6 -2 -8 -4 c-8 -6 -12 -18 -12 -36 z"/>
      <rect x="22" y="84" width="56" height="10" rx="3"/>
    </g>
    <path fill="none" stroke="${colour}" stroke-width="6" stroke-linecap="round" d="M28 18 C12 18 10 40 27 46"/>
    <path fill="none" stroke="${colour}" stroke-width="6" stroke-linecap="round" d="M72 18 C88 18 90 40 73 46"/>
    ${gloss ? `<path fill="url(#g${id})" d="M28 12 h44 v14 c0 18 -4 30 -12 36 c-2 2 -5 3 -8 4 v12 h11 v6 h-30 v-6 h11 v-12 c-3 -1 -6 -2 -8 -4 c-8 -6 -12 -18 -12 -36 z"/>` : ''}
  </svg>`;
}

/** The REAL cup — the literal glyph the Cups tab draws. Platform-drawn, so it is Noto here. */
export function cupEmoji(size, { x = null, y = null, rot = 0, opacity = 1 } = {}) {
  const pos = (x === null && y === null) ? '' : `position:absolute;left:${x}px;top:${y}px;`;
  return `<div aria-hidden="true" style="${pos}font-size:${size}px;line-height:1;opacity:${opacity};
    transform:rotate(${rot}deg);filter:drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,.6))">🏆</div>`;
}

const S = (W) => (n) => Math.round(n * W / 393);
const HERO_H = (W) => Math.round(470 * W / 393);
const feltBg = `linear-gradient(170deg, ${P.feltTop} 0%, ${P.feltBot} 100%)`;

// ══════════════════════════════════════════════════════════════════════════════════════════════

/** K0 — THE CONTROL. Not a direction: the two cups at the same size, so "use the real thing" is
 *  a decision made with eyes open rather than a phrase. */
function K0(W) {
  const px = S(W), s = Math.round(W * 0.34);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;align-items:center;
    justify-content:center;gap:${px(24)}px">
    <div style="text-align:center">${cupEmoji(s)}
      <div style="font:700 ${px(11)}px ${UI};letter-spacing:${px(2)}px;color:${P.textMuted};margin-top:${px(10)}px">THE REAL ONE<br>🏆 emoji, platform-drawn</div></div>
    <div style="text-align:center">${cupVector(s, GOLD_CUP)}
      <div style="font:700 ${px(11)}px ${UI};letter-spacing:${px(2)}px;color:${P.textMuted};margin-top:${px(10)}px">DRAWN<br>tier colour #FFD700</div></div>
    ${grain('k0')}</div>`;
}

/** K1 — cups falling, caught the instant before landing. Shadows on the felt say how high. */
function K1(W) {
  const px = S(W), H = HERO_H(W);
  const drops = [
    { t: 'gold',     s: px(120), x: px(112), y: px(40),  rot: -14, sh: px(150), sw: px(96), so: 0.34 },
    { t: 'silver',   s: px(78),  x: px(20),  y: px(150), rot: 22,  sh: px(240), sw: px(62), so: 0.42 },
    { t: 'bronze',   s: px(64),  x: px(268), y: px(196), rot: -30, sh: px(276), sw: px(50), so: 0.46 },
    { t: 'diamond',  s: px(54),  x: px(180), y: px(258), rot: 12,  sh: px(300), sw: px(42), so: 0.5 },
  ];
  const colour = (t) => CUP_TIERS.find((c) => c.id === t).color;
  const shadows = drops.map((d) => `<div style="position:absolute;left:${d.x + d.s * 0.1}px;top:${d.sh}px;
    width:${d.sw}px;height:${Math.round(d.sw * 0.26)}px;border-radius:50%;
    background:rgba(0,0,0,${d.so});filter:blur(${px(7)}px)"></div>`).join('');
  const cups = drops.map((d) => cupVector(d.s, colour(d.t), { x: d.x, y: d.y, rot: d.rot, shadow: px(10) })).join('');
  return `<div style="position:absolute;inset:0;background:${feltBg};height:${H}px">
    <div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 18%,
      rgba(255,244,214,0.22), transparent 62%), linear-gradient(180deg, transparent 46%, rgba(0,0,0,.7))"></div>
    ${weave('k1', { opacity: 0.14 })}${shadows}${cups}${grain('k1g')}</div>`;
}

/** K2 — a cascade. Many, tumbling, filling the frame edge to edge. */
function K2(W) {
  const px = S(W), H = HERO_H(W);
  let out = '';
  for (let i = 0; i < 22; i++) {
    const t = CUP_TIERS[i % CUP_TIERS.length];
    const a = i * 2.399;
    const s = px(38 + (i % 4) * 22);
    const x = ((Math.sin(a) * 0.5 + 0.5) * (W + px(60))) - px(40);
    const y = ((i * 71) % (H + 120)) - 50;
    out += cupVector(s, t.color, { x: Math.round(x), y: Math.round(y), rot: (i * 47) % 360, opacity: 0.35 + (i % 4) * 0.2, shadow: px(6) });
  }
  return `<div style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 6%, #16130a, ${P.bg});
    height:${H}px;overflow:hidden">${out}
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(10,10,10,.55), transparent 30%, rgba(10,10,10,.8))"></div>
    ${grain('k2')}</div>`;
}

/** K3 — one cup, enormous, cropped by the frame. */
function K3(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:radial-gradient(70% 55% at 50% 44%, #1d1808, ${P.bg});overflow:hidden">
    <div style="position:absolute;left:50%;top:${px(-40)}px;transform:translateX(-50%)">
      ${cupVector(Math.round(W * 1.28), GOLD_CUP, { shadow: px(26) })}</div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, transparent 58%, rgba(10,10,10,.86) 92%)"></div>
    ${grain('k3', { opacity: 0.06 })}</div>`;
}

/** K4 — the five tiers stacked into a tower. The collection as one object. */
function K4(W) {
  const px = S(W);
  const stack = CUP_TIERS.slice().reverse().map((t, i) => {
    const s = px(150 - i * 20);
    return `<div style="margin-top:${i === 0 ? 0 : -px(16)}px">${cupVector(s, t.color, { shadow: px(8) })}</div>`;
  }).join('');
  return `<div style="position:absolute;inset:0;background:radial-gradient(80% 60% at 50% 30%, #14141a, ${P.bg});
    display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div style="display:flex;flex-direction:column;align-items:center">${stack}</div>
    ${grain('k4')}</div>`;
}

/** K5 — a cup and a card. The two things this product actually has. */
function K5(W) {
  const px = S(W), cw = px(150);
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(80% 55% at 50% 40%,
      rgba(255,244,214,0.20), transparent 64%), linear-gradient(180deg, transparent 52%, rgba(0,0,0,.72))"></div>
    ${weave('k5', { opacity: 0.14 })}
    ${card('A', 'spade', { w: cw, x: px(28), y: px(150), rot: -11, lift: 2.2 })}
    <div style="position:absolute;left:${px(196)}px;top:${px(120)}px">
      ${cupVector(px(180), GOLD_CUP, { rot: 7, shadow: px(16) })}</div>
    ${grain('k5g')}</div>`;
}

/** K6 — the cup as negative space in the wordmark: the A of CAPS is a cup. */
function K6(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;align-items:center;
    justify-content:center">
    <div style="display:flex;align-items:baseline;gap:0">
      <span style="font:900 ${px(110)}px ${DISPLAY};color:${P.text};line-height:.8">C</span>
      <span style="display:inline-block;width:${px(96)}px;position:relative;height:${px(110)}px">
        <span style="position:absolute;left:50%;bottom:${px(-4)}px;transform:translateX(-50%)">
          ${cupVector(px(104), GOLD_CUP)}</span></span>
      <span style="font:900 ${px(110)}px ${DISPLAY};color:${P.text};line-height:.8">PS</span>
    </div>
    ${grain('k6', { opacity: 0.07 })}</div>`;
}

/** K7 — a cup catching falling cards. */
function K7(W) {
  const px = S(W), cw = px(58);
  const falling = [
    { r: 'A', s: 'spade',   x: px(140), y: px(6),   rot: -22 },
    { r: 'K', s: 'heart',   x: px(206), y: px(58),  rot: 16 },
    { r: 'Q', s: 'club',    x: px(158), y: px(118), rot: -8 },
  ].map((c) => card(c.r, c.s, { w: cw, x: c.x, y: c.y, rot: c.rot, lift: 2.4 })).join('');
  return `<div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 52% 10%, #1a1710, ${P.bg})">
    ${falling}
    <div style="position:absolute;left:50%;top:${px(190)}px;transform:translateX(-50%)">
      ${cupVector(px(230), GOLD_CUP, { shadow: px(18) })}</div>
    ${grain('k7')}</div>`;
}

/** K8 — the collection itself: five tiers in a row, three earned. */
function K8(W) {
  const px = S(W);
  const row = CUP_TIERS.map((t, i) => {
    const earned = i < 3;
    return `<div style="text-align:center;opacity:${earned ? 1 : 0.26}">
      ${cupVector(px(56), earned ? t.color : '#6b6f78', { shadow: earned ? px(6) : 0 })}
      <div style="font:700 ${px(9)}px ${UI};letter-spacing:${px(1)}px;color:${earned ? t.color : P.textDim || '#5b6168'};
        margin-top:${px(6)}px">${t.id.toUpperCase()}</div></div>`;
  }).join('');
  return `<div style="position:absolute;inset:0;background:radial-gradient(110% 70% at 50% 20%, #131318, ${P.bg});
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${px(26)}px">
    <div style="display:flex;gap:${px(12)}px;align-items:flex-end">${row}</div>
    <div style="font:600 ${px(12)}px ${UI};letter-spacing:${px(5)}px;color:${P.textMuted}">THREE OF FIVE</div>
    ${grain('k8')}</div>`;
}

/**
 * THE INSTRUMENT CANARY — deliberately, knowably illegible: #2a2a2a on #0a0a0a is ~1.35:1
 * against a 4.5 bar. It is not a design proposal. It exists so the audit can be caught being
 * blind: if this direction is ever reported as passing the floor, the measurement is broken and
 * NO other number in the run may be trusted. The audit has already failed three times this
 * sprint series (glyph-sampled ground, an emoji scored on `color`, targets scaled not floored),
 * every one of which passed a "looks about right" reading.
 */
function ZZ_CANARY(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;align-items:center;
    justify-content:center;flex-direction:column;gap:${px(20)}px">
    <div style="font:400 ${px(15)}px ${UI};color:#2a2a2a">CANARY MUST FAIL CONTRAST</div>
    <div style="font:400 ${px(15)}px ${UI};color:#f0ead6">CANARY MUST PASS CONTRAST</div>
  </div>`;
}

export const CUP_DIRECTIONS = [
  { id: 'K0', family: 'Cups', name: 'CONTROL — real emoji vs drawn', needs: 'designer', art: K0,
    note: 'Not a direction. The comparison that decides whether a cup hero is even possible.' },
  { id: 'K1', family: 'Cups', name: 'Cups falling, caught before landing', needs: 'designer', art: K1 },
  { id: 'K2', family: 'Cups', name: 'Cascade, many tumbling', needs: 'designer', art: K2 },
  { id: 'K3', family: 'Cups', name: 'One cup, enormous, cropped', needs: 'designer', art: K3 },
  { id: 'K4', family: 'Cups', name: 'The five tiers stacked', needs: 'designer', art: K4 },
  { id: 'K5', family: 'Cups', name: 'A cup and a card', needs: 'designer', art: K5 },
  { id: 'K6', family: 'Cups', name: 'The cup inside the wordmark', needs: 'designer', art: K6 },
  { id: 'K7', family: 'Cups', name: 'A cup catching falling cards', needs: 'designer', art: K7 },
  { id: 'K8', family: 'Cups', name: 'The collection, three of five', needs: 'designer', art: K8 },
  { id: 'ZZ', family: 'Instrument', name: 'CANARY — must fail contrast', needs: 'none', art: ZZ_CANARY,
    note: 'A planted failure. If this passes, the audit is blind and no number in the run counts.' },
];
