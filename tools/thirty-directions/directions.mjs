/**
 * THE THIRTY.
 *
 * Ten distinct answers to "what is the first thing you see", three treatments each. Not thirty
 * variations of one idea — the families disagree with each other about what the screen is for.
 *
 * Every direction declares `needs`, and it is the honest one:
 *   'none'       CSS/SVG delivers the finished thing. The render IS the art.
 *   'asset'      needs artwork nobody has made — a photograph, an illustration, a rendered 3D
 *                still. Not an npm package. The render is a sketch of the idea.
 *   'designer'   needs a person making judgement calls this file cannot encode (a real wordmark,
 *                a bespoke card back, kerning by hand).
 *   'library'    needs code we do not have installed.
 * Anything marked 'asset' or 'designer' is scored on the IDEA, and the score says the render
 * flatters or undersells it.
 *
 * Board count is dynamic. Directions that draw boards take `boards` and are rendered at the
 * 3-player default the home screen actually shows. No direction's copy names a count —
 * lib.mjs throws if one tries.
 */

import { P, DISPLAY, UI, POSTER, GARAMOND, card, suit, chip, grain, weave } from './lib.mjs';

/** Every direction gets this: a scale derived from the width, never a second set of literals. */
const S = (W) => (n) => Math.round(n * W / 393);
/** Hero box at the 393-design aspect. Measured from the built page, not guessed — see render.mjs. */
const HERO_H = (W) => Math.round(470 * W / 393);

const feltBg = `linear-gradient(170deg, ${P.feltTop} 0%, ${P.feltBot} 100%)`;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A · A REAL POKER TABLE SEEN FROM ABOVE, CARDS MID-DEAL
// ══════════════════════════════════════════════════════════════════════════════════════════════

function A1(W, boards) {
  const px = S(W), H = HERO_H(W), cw = px(46);
  const rows = Array.from({ length: boards }, (_, b) => {
    const y = px(64) + b * px(96);
    return Array.from({ length: 5 }, (_, c) =>
      card(['A', 'K', '9', '7', 'Q'][c], ['spade', 'heart', 'club', 'diamond', 'spade'][c],
        { w: cw, x: px(40) + c * (cw + px(10)), y, rot: (c - 2) * 0.7, lift: 1.1 })).join('');
  }).join('');
  // Two cards still in the air: bigger, rotated hard, shadow thrown far — that is what "mid-deal" is.
  const flying = card('J', 'diamond', { w: cw * 1.35, x: px(255), y: px(300), rot: -26, lift: 2.6 })
               + card('10', 'club', { w: cw * 1.22, x: px(190), y: px(352), rot: 14, lift: 2.2 });
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(120% 78% at 50% 34%,
      rgba(255,236,190,0.20) 0%, rgba(255,236,190,0.06) 38%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.8) 100%)"></div>
    ${weave('a1', { opacity: 0.16 })}
    <div style="position:absolute;inset:0;height:${H}px">${rows}${flying}</div>
    ${grain('a1g', { opacity: 0.05 })}</div>`;
}

function A2(W) {
  const px = S(W), cw = px(120);
  // A dealer's arc, cropped hard by the frame. The crop is the idea: you are AT the table.
  const arc = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6, ang = -58 + t * 74, r = px(230);
    return card(['A', 'K', 'Q', 'J', '10', '9', '8'][i], ['spade', 'heart', 'spade', 'diamond', 'club', 'heart', 'club'][i], {
      w: cw, rot: ang * 0.62,
      x: px(150) + Math.sin(ang * Math.PI / 180) * r,
      y: px(300) - Math.cos(ang * Math.PI / 180) * r * 0.42,
      lift: 1.6 + t,
    });
  }).join('');
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 22% 20%,
      rgba(255,240,200,0.24), transparent 62%), linear-gradient(200deg, transparent 40%, rgba(0,0,0,0.72))"></div>
    ${weave('a2', { opacity: 0.18 })}${arc}${grain('a2g')}</div>`;
}

function A3(W, boards) {
  const px = S(W), cw = px(42);
  const rows = Array.from({ length: boards }, (_, b) =>
    Array.from({ length: 5 }, (_, c) =>
      card('', 'spade', { w: cw, face: false, x: px(52) + c * (cw + px(12)), y: px(90) + b * px(104), lift: 0.8 })
    ).join('')).join('');
  // One card lifted and tilted, catching the light — the only event on an otherwise still table.
  const lifted = card('A', 'spade', { w: cw * 1.5, x: px(228), y: px(60), rot: -9, lift: 3 });
  return `<div style="position:absolute;inset:0;background:linear-gradient(175deg,#0d4a26,#05230f)">
    <div style="position:absolute;inset:0;background:radial-gradient(100% 70% at 62% 22%,
      rgba(255,255,255,0.13), transparent 58%)"></div>
    ${weave('a3', { opacity: 0.13 })}${rows}${lifted}${grain('a3g', { opacity: 0.04 })}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B · THE FORMAT ITSELF AS THE IMAGE — the thing nobody else has
// ══════════════════════════════════════════════════════════════════════════════════════════════

function B1(W, boards) {
  const px = S(W);
  const bars = Array.from({ length: boards }, (_, b) => `
    <div style="position:absolute;left:${px(26)}px;right:${px(26)}px;top:${px(56) + b * px(118)}px;height:${px(96)}px;
      border-radius:${px(14)}px;background:linear-gradient(120deg, rgba(79,214,168,0.16), rgba(79,214,168,0.04));
      border:1px solid rgba(79,214,168,0.55);box-shadow:0 0 ${px(34)}px rgba(79,214,168,0.22), inset 0 0 ${px(28)}px rgba(79,214,168,0.10)">
      <div style="position:absolute;left:${px(12)}px;top:${px(8)}px;font:800 ${px(11)}px ${UI};
        letter-spacing:${px(2)}px;color:${P.mint};opacity:.85">BOARD ${b + 1}</div>
      <div style="position:absolute;left:0;right:0;bottom:${px(10)}px;display:flex;gap:${px(8)}px;justify-content:center">
        ${Array.from({ length: 5 }, () => `<div style="width:${px(38)}px;height:${px(54)}px;border-radius:${px(5)}px;
          background:${P.cardFace};box-shadow:0 ${px(3)}px ${px(9)}px rgba(0,0,0,.5)"></div>`).join('')}
      </div></div>`).join('');
  return `<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 10%, #0f1a16, ${P.bg})">
    ${bars}
    <div style="position:absolute;left:0;right:0;bottom:${px(6)}px;text-align:center;
      font:800 ${px(13)}px ${UI};letter-spacing:${px(3)}px;color:${P.textMuted}">EVERY BOARD AT ONCE</div>
    ${grain('b1')}</div>`;
}

function B2(W, boards) {
  const px = S(W), cw = px(34);
  const fan = Array.from({ length: boards * 4 }, (_, i) => {
    const t = i / (boards * 4 - 1);
    return card('', 'spade', { w: cw * 0.82, face: false, rot: (t - 0.5) * 44,
      x: px(40) + t * px(300), y: px(18) + Math.abs(t - 0.5) * px(30) });
  }).join('');
  const lines = Array.from({ length: boards }, (_, b) => `
    <path d="M ${px(196)} ${px(86)} C ${px(196)} ${px(130)}, ${px(60)} ${px(120)}, ${px(60)} ${px(160 + b * 96)}"
      stroke="rgba(79,214,168,0.42)" stroke-width="1.5" fill="none"/>`).join('');
  const rows = Array.from({ length: boards }, (_, b) =>
    Array.from({ length: 4 }, (_, c) =>
      card('', 'spade', { w: cw, face: false, x: px(48) + c * (cw + px(8)), y: px(150) + b * px(96) })
    ).join('') + `<div style="position:absolute;left:${px(230)}px;top:${px(160) + b * px(96)}px;
      font:700 ${px(12)}px ${UI};letter-spacing:${px(1.5)}px;color:${P.mint};opacity:.75">BOARD ${b + 1}</div>`
  ).join('');
  return `<div style="position:absolute;inset:0;background:${P.bg}">
    <div style="position:absolute;left:${px(40)}px;top:${px(2)}px;font:700 ${px(11)}px ${UI};
      letter-spacing:${px(2)}px;color:${P.textMuted}">YOUR HAND</div>
    ${fan}
    <svg style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">${lines}</svg>
    ${rows}${grain('b2')}</div>`;
}

function B3(W, boards) {
  const px = S(W), cw = Math.round(W / 4.2);
  // Edge to edge, bleeding off both sides: the format as wallpaper, not as diagram.
  const grid = Array.from({ length: boards }, (_, b) =>
    Array.from({ length: 5 }, (_, c) =>
      card(['A', 'K', 'Q', 'J', '9'][c], ['spade', 'heart', 'club', 'diamond', 'spade'][c],
        { w: cw, x: -px(38) + c * (cw + px(4)), y: px(10) + b * Math.round(cw / 0.7 + px(6)), lift: 0.7 })
    ).join('')).join('');
  return `<div style="position:absolute;inset:0;background:${P.bg};overflow:hidden">${grid}
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,
      rgba(10,10,10,0) 46%, rgba(10,10,10,0.88) 84%, ${P.bg} 100%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:${px(14)}px;text-align:center;
      font:900 ${px(40)}px ${DISPLAY};letter-spacing:${px(6)}px;color:${P.goldLight}">CAPS</div>
    ${grain('b3')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C · A SINGLE OVERSIZED HERO CARD
// ══════════════════════════════════════════════════════════════════════════════════════════════

function C1(W) {
  const px = S(W), cw = Math.round(W * 0.60);
  return `<div style="position:absolute;inset:0;background:radial-gradient(80% 60% at 50% 42%, #1b1f26, ${P.bg} 72%)">
    <div style="position:absolute;left:50%;top:${px(40)}px;transform:translateX(-50%) rotate(-4deg);
      width:${cw}px;height:${Math.round(cw / 0.7)}px;border-radius:${px(18)}px;background:${P.cardFace};
      box-shadow:0 ${px(30)}px ${px(70)}px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.10),
        ${px(2)}px 0 0 rgba(255,255,255,.28) inset">
      <div style="position:absolute;top:${px(16)}px;left:${px(18)}px;font:800 ${px(46)}px ${UI};color:${P.cardBlack};line-height:.9">A</div>
      <div style="position:absolute;left:50%;top:52%;transform:translate(-50%,-50%)">${suit('spade', { size: cw * 0.56, fill: P.cardBlack })}</div>
      <div style="position:absolute;bottom:${px(16)}px;right:${px(18)}px;font:800 ${px(46)}px ${UI};
        color:${P.cardBlack};line-height:.9;transform:rotate(180deg)">A</div>
    </div>
    ${grain('c1', { opacity: 0.06 })}</div>`;
}

function C2(W) {
  const px = S(W), cw = Math.round(W * 1.02);
  return `<div style="position:absolute;inset:0;background:${P.bg};overflow:hidden">
    <div style="position:absolute;left:${-px(120)}px;top:${-px(120)}px;transform:rotate(-13deg);
      width:${cw}px;height:${Math.round(cw / 0.7)}px;border-radius:${px(26)}px;background:${P.cardFace};
      box-shadow:0 ${px(40)}px ${px(90)}px rgba(0,0,0,.9)">
      <div style="position:absolute;top:${px(28)}px;left:${px(30)}px;font:800 ${px(72)}px ${UI};color:${P.cardRed};line-height:.85">K</div>
      <div style="position:absolute;top:${px(112)}px;left:${px(30)}px">${suit('heart', { size: px(58), fill: P.cardRed })}</div>
    </div>
    <div style="position:absolute;inset:0;background:linear-gradient(200deg, rgba(10,10,10,0) 30%, rgba(10,10,10,.92) 72%)"></div>
    <div style="position:absolute;left:${px(26)}px;bottom:${px(22)}px">
      <div style="font:900 ${px(62)}px ${DISPLAY};letter-spacing:${px(2)}px;color:${P.goldLight};line-height:.92">CAPS</div>
      <div style="font:600 ${px(13)}px ${UI};letter-spacing:${px(5)}px;color:${P.textMuted};margin-top:${px(6)}px">POKER</div>
    </div>${grain('c2')}</div>`;
}

function C3(W) {
  const px = S(W), cw = Math.round(W * 0.66), ch = Math.round(cw / 0.7);
  const rings = [0.86, 0.66, 0.46].map((r, i) => `
    <div style="position:absolute;left:50%;top:50%;width:${cw * r}px;height:${cw * r}px;margin:-${cw * r / 2}px 0 0 -${cw * r / 2}px;
      border-radius:50%;border:${px(1.5)}px solid rgba(201,168,76,${0.75 - i * 0.16})"></div>`).join('');
  return `<div style="position:absolute;inset:0;background:radial-gradient(70% 55% at 50% 45%, #14161c, ${P.bg})">
    <div style="position:absolute;left:50%;top:${px(46)}px;transform:translateX(-50%);width:${cw}px;height:${ch}px;
      border-radius:${px(20)}px;background:linear-gradient(150deg,#31384a,#1a1e28);
      box-shadow:0 ${px(28)}px ${px(64)}px rgba(0,0,0,.85), inset 0 0 0 ${px(6)}px #12151c, inset 0 0 0 ${px(7)}px rgba(201,168,76,.55)">
      ${rings}
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">${suit('spade', { size: cw * 0.26, fill: P.gold, opacity: 0.9 })}</div>
    </div>${grain('c3')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D · HEAVY, EXPENSIVE TYPOGRAPHY CARRYING THE SCREEN ALONE
// ══════════════════════════════════════════════════════════════════════════════════════════════

function D1(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;flex-direction:column;
    justify-content:center;align-items:center">
    <div style="font:900 ${px(126)}px ${DISPLAY};letter-spacing:${-px(4)}px;line-height:.82;
      background:linear-gradient(180deg,#f4e3ae,${P.gold} 58%,#8d7433);-webkit-background-clip:text;
      background-clip:text;color:transparent">CAPS</div>
    <div style="font:600 ${px(15)}px ${UI};letter-spacing:${px(13)}px;color:${P.textMuted};
      margin-top:${px(14)}px;text-indent:${px(13)}px">POKER</div>
    ${grain('d1', { opacity: 0.07 })}</div>`;
}

function D2(W) {
  const px = S(W);
  const rule = `<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.7),transparent)"></div>`;
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;flex-direction:column;
    justify-content:center;padding:0 ${px(28)}px">
    <div style="text-align:center;font:400 ${px(11)}px ${UI};letter-spacing:${px(6)}px;
      color:${P.textMuted};margin-bottom:${px(14)}px">EST. FOUR CARDS PER BOARD</div>
    ${rule}
    <div style="text-align:center;font:900 ${px(84)}px ${DISPLAY};letter-spacing:${px(1)}px;
      color:${P.text};line-height:1.06;margin:${px(10)}px 0">CAPS</div>
    ${rule}
    <div style="display:flex;justify-content:center;gap:${px(18)}px;margin-top:${px(18)}px;opacity:.8">
      ${suit('spade', { size: px(17), fill: P.gold })}${suit('heart', { size: px(17), fill: P.gold })}
      ${suit('diamond', { size: px(17), fill: P.gold })}${suit('club', { size: px(17), fill: P.gold })}</div>
    ${grain('d2', { opacity: 0.06 })}</div>`;
}

function D3(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;align-items:center;
    padding:0 ${px(26)}px">
    <div style="font:700 ${px(46)}px ${GARAMOND};line-height:1.06;color:${P.text}">
      Split your hand.<br><span style="color:${P.goldLight}">Own every board.</span></div>
    ${grain('d3', { opacity: 0.06 })}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// E · LIGHT AND SHADOW ON FELT — depth instead of decoration
// ══════════════════════════════════════════════════════════════════════════════════════════════

function E1(W) {
  const px = S(W), cw = px(92);
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:linear-gradient(118deg,
      rgba(255,244,214,0.26) 0%, rgba(255,244,214,0.08) 26%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.72) 100%)"></div>
    ${weave('e1', { opacity: 0.15 })}
    <!-- the shadow is the subject; the card is only what casts it -->
    <div style="position:absolute;left:${px(120)}px;top:${px(214)}px;width:${px(250)}px;height:${px(58)}px;
      background:linear-gradient(96deg, rgba(0,0,0,.62), rgba(0,0,0,0) 76%);
      transform:skewX(-46deg);filter:blur(${px(7)}px)"></div>
    ${card('A', 'spade', { w: cw, x: px(88), y: px(150), rot: -7, lift: 0.4 })}
    ${grain('e1g', { opacity: 0.05 })}</div>`;
}

function E2(W, boards) {
  const px = S(W), cw = px(50);
  const row = Array.from({ length: 5 }, (_, c) =>
    card(['A', 'K', 'Q', '7', '2'][c], ['spade', 'spade', 'heart', 'club', 'diamond'][c],
      { w: cw, x: px(32) + c * (cw + px(9)), y: px(196), rot: (c - 2) * 1.2, lift: 1.3 })).join('');
  return `<div style="position:absolute;inset:0;background:#01150a">
    <div style="position:absolute;inset:0;background:radial-gradient(58% 34% at 50% 52%,
      ${P.feltTop} 0%, rgba(0,49,21,0.55) 46%, rgba(0,0,0,0.97) 82%)"></div>
    ${weave('e2', { opacity: 0.10 })}${row}
    <div style="position:absolute;inset:0;background:radial-gradient(56% 32% at 50% 52%,
      transparent 52%, rgba(0,0,0,0.72) 84%)"></div>
    ${grain('e2g', { opacity: 0.06 })}</div>`;
}

function E3(W) {
  const px = S(W), cw = px(60);
  const cards = Array.from({ length: 4 }, (_, i) =>
    card('', 'spade', { w: cw, face: false, x: px(50) + i * px(74), y: px(190) + (i % 2) * px(10), rot: i * 3 - 4, lift: 0.9 })).join('');
  return `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#052a14,#010a05)">
    <div style="position:absolute;left:${-px(60)}px;top:${px(40)}px;width:${px(520)}px;height:${px(160)}px;
      background:linear-gradient(96deg, rgba(255,255,255,0.11), transparent 62%);
      transform:rotate(-13deg);filter:blur(${px(28)}px)"></div>
    ${weave('e3', { opacity: 0.14 })}${cards}
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 ${px(120)}px ${px(46)}px rgba(0,0,0,.85)"></div>
    ${grain('e3g', { opacity: 0.05 })}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// F · THE WORDMARK AS THE WHOLE SCREEN, CINEMATIC
// ══════════════════════════════════════════════════════════════════════════════════════════════

function F1(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;align-items:center;
    justify-content:center;overflow:hidden">
    <div style="font:900 ${px(230)}px ${DISPLAY};letter-spacing:${-px(12)}px;line-height:.72;
      white-space:nowrap;color:${P.text};opacity:.96;transform:translateY(${-px(6)}px)">CAPS</div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,
      rgba(10,10,10,.55) 0%, transparent 26%, transparent 70%, rgba(10,10,10,.75) 100%)"></div>
    ${grain('f1', { opacity: 0.08 })}</div>`;
}

function F2(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 40%, #15130c, ${P.bg});
    display:flex;flex-direction:column;justify-content:center;align-items:center">
    <div style="position:relative;font:900 ${px(96)}px ${DISPLAY};letter-spacing:${px(1)}px;
      background:linear-gradient(168deg,#fff3cf 6%,${P.goldLight} 30%,#8a6f2c 62%,#f0dda2 92%);
      -webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 ${px(2)}px 0 rgba(0,0,0,.85)) drop-shadow(0 ${px(14)}px ${px(26)}px rgba(201,168,76,.22))">CAPS</div>
    <div style="width:${px(150)}px;height:1px;background:linear-gradient(90deg,transparent,${P.gold},transparent);margin:${px(18)}px 0"></div>
    <div style="display:flex;gap:${px(14)}px;opacity:.85">
      ${suit('spade', { size: px(15), fill: P.gold })}${suit('heart', { size: px(15), fill: P.gold })}
      ${suit('diamond', { size: px(15), fill: P.gold })}${suit('club', { size: px(15), fill: P.gold })}</div>
    ${grain('f2', { opacity: 0.07 })}</div>`;
}

function F3(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:#050505;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;top:0;left:0;right:0;height:${px(56)}px;background:#000"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:${px(56)}px;background:#000"></div>
    <div style="text-align:center">
      <div style="font:400 ${px(52)}px ${POSTER};letter-spacing:${px(22)}px;color:${P.text};
        text-indent:${px(22)}px">CAPS</div>
      <div style="font:400 ${px(11)}px ${UI};letter-spacing:${px(8)}px;color:${P.textMuted};
        margin-top:${px(16)}px;text-indent:${px(8)}px">A POKER GAME</div>
    </div>${grain('f3', { opacity: 0.09 })}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// G · A HAND FROZEN AT THE MOMENT OF REVEAL
// ══════════════════════════════════════════════════════════════════════════════════════════════

function G1(W) {
  const px = S(W), cw = px(62);
  const four = Array.from({ length: 4 }, (_, c) =>
    card(['A', 'K', 'Q', 'J'][c], ['spade', 'spade', 'spade', 'spade'][c],
      { w: cw, x: px(20) + c * (cw + px(7)), y: px(180), lift: 1.2 })).join('');
  // The fifth caught mid-flip: a real 3D rotation, so the edge foreshortens instead of squashing.
  const flip = `<div style="position:absolute;left:${px(20) + 4 * (cw + px(7))}px;top:${px(180)}px;
    width:${cw}px;height:${Math.round(cw / 0.7)}px;perspective:${px(600)}px">
    <div style="width:100%;height:100%;transform:rotateY(66deg);transform-origin:left center;
      border-radius:${px(6)}px;background:linear-gradient(90deg,#3a4254,#20242e);
      box-shadow:${px(16)}px ${px(10)}px ${px(30)}px rgba(0,0,0,.8), inset 0 0 0 1px rgba(79,214,168,.35)"></div></div>`;
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(80% 50% at 50% 52%,
      rgba(255,240,205,0.18), transparent 66%), linear-gradient(180deg,rgba(0,0,0,.5),transparent 34%,rgba(0,0,0,.66))"></div>
    ${weave('g1', { opacity: 0.14 })}${four}${flip}
    <div style="position:absolute;left:0;right:0;top:${px(120)}px;text-align:center;
      font:800 ${px(13)}px ${UI};letter-spacing:${px(4)}px;color:${P.mint};opacity:.9">ONE CARD TO COME</div>
    ${grain('g1g')}</div>`;
}

function G2(W) {
  const px = S(W), cw = px(54);
  const winners = Array.from({ length: 5 }, (_, c) =>
    card(['A', 'K', 'Q', 'J', '10'][c], 'heart', { w: cw, x: px(30) + c * (cw + px(8)), y: px(150), lift: 2.2 })).join('');
  const losers = Array.from({ length: 5 }, (_, c) =>
    card(['3', '8', '5', '2', '9'][c], ['club', 'spade', 'diamond', 'club', 'spade'][c],
      { w: cw * 0.86, x: px(40) + c * (cw * 0.86 + px(8)), y: px(258), dim: 0.62, lift: 0.5 })).join('');
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(70% 30% at 50% 40%,
      rgba(255,238,190,0.26), transparent 70%), linear-gradient(180deg,transparent 50%, rgba(0,0,0,.78))"></div>
    ${weave('g2', { opacity: 0.13 })}${winners}${losers}
    <div style="position:absolute;left:0;right:0;top:${px(96)}px;text-align:center;
      font:900 ${px(30)}px ${DISPLAY};color:${P.goldLight};text-shadow:0 0 ${px(26)}px rgba(232,201,106,.5)">ROYAL FLUSH</div>
    ${grain('g2g')}</div>`;
}

function G3(W, boards) {
  const px = S(W), cw = px(34);
  const rows = Array.from({ length: boards }, (_, b) => {
    const won = b !== 1;
    const y = px(60) + b * px(112);
    return `<div style="position:absolute;left:${px(22)}px;right:${px(22)}px;top:${y - px(10)}px;height:${px(94)}px;
      border-radius:${px(12)}px;border:1px solid ${won ? 'rgba(79,214,168,.6)' : 'rgba(192,57,43,.45)'};
      background:${won ? 'rgba(79,214,168,.07)' : 'rgba(192,57,43,.05)'};
      box-shadow:${won ? `0 0 ${px(26)}px rgba(79,214,168,.20)` : 'none'}"></div>
    ${Array.from({ length: 5 }, (_, c) => card(['A', 'K', 'Q', '9', '4'][c],
      ['spade', 'heart', 'club', 'diamond', 'spade'][c],
      { w: cw, x: px(34) + c * (cw + px(7)), y, dim: won ? 0 : 0.42 })).join('')}
    <div style="position:absolute;right:${px(34)}px;top:${y + px(14)}px;font:800 ${px(14)}px ${UI};
      letter-spacing:${px(2)}px;color:${won ? P.mint : '#c0392b'}">${won ? 'WON' : 'LOST'}</div>`;
  }).join('');
  return `<div style="position:absolute;inset:0;background:radial-gradient(110% 80% at 50% 0%, #0d1512, ${P.bg})">
    ${rows}${grain('g3')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// H · CHIPS, PHYSICAL AND STACKED
// ══════════════════════════════════════════════════════════════════════════════════════════════

function H1(W) {
  const px = S(W);
  const stack = (x, n, colour, size, blur) => Array.from({ length: n }, (_, i) =>
    `<div style="filter:blur(${blur}px)">${chip(size, colour, { x, y: px(330) - i * size * 0.17 })}</div>`).join('');
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 34%,
      rgba(255,240,205,0.20), transparent 68%), linear-gradient(180deg,rgba(0,0,0,.45),transparent 30%,rgba(0,0,0,.7))"></div>
    ${weave('h1', { opacity: 0.14 })}
    ${stack(px(40), 9, '#1a1a2e', px(76), px(1.6))}
    ${stack(px(140), 13, '#c0392b', px(80), 0)}
    ${stack(px(246), 7, '#2ecc71', px(78), px(0.8))}
    ${stack(px(330), 5, '#8B008B', px(74), px(2.4))}
    ${grain('h1g')}</div>`;
}

function H2(W) {
  const px = S(W), d = Math.round(W * 0.72);
  return `<div style="position:absolute;inset:0;background:radial-gradient(70% 50% at 50% 44%, #191d26, ${P.bg})">
    <div style="position:absolute;left:50%;top:${px(78)}px;transform:translateX(-50%);width:${d}px;height:${d}px;
      border-radius:50%;background:conic-gradient(from 0deg, #23262f 0 8%, #c0392b 8% 16%, #23262f 16% 24%,
        #c0392b 24% 32%, #23262f 32% 40%, #c0392b 40% 48%, #23262f 48% 56%, #c0392b 56% 64%,
        #23262f 64% 72%, #c0392b 72% 80%, #23262f 80% 88%, #c0392b 88% 100%);
      box-shadow:0 ${px(24)}px ${px(56)}px rgba(0,0,0,.9), inset 0 0 ${px(40)}px rgba(0,0,0,.55)">
      <div style="position:absolute;inset:${px(26)}px;border-radius:50%;background:radial-gradient(circle at 42% 34%, #2b2f3a, #14171d);
        box-shadow:inset 0 0 0 ${px(3)}px rgba(201,168,76,.6);display:flex;align-items:center;justify-content:center">
        <div style="font:900 ${px(40)}px ${DISPLAY};letter-spacing:${px(1)}px;color:${P.goldLight}">CAPS</div></div>
    </div>${grain('h2', { opacity: 0.06 })}</div>`;
}

function H2b(W) { return H2(W); }

function H3(W) {
  const px = S(W);
  const cols = ['#c0392b', '#2ecc71', '#1a1a2e', '#f5f0e8', '#8B008B'];
  const scatter = Array.from({ length: 14 }, (_, i) => {
    const a = (i * 2.399), r = px(30) + (i % 5) * px(34);
    const x = px(180) + Math.cos(a) * r, y = px(190) + Math.sin(a) * r * 0.62;
    return chip(px(40 + (i % 3) * 12), cols[i % cols.length], { x, y, rot: i * 27 });
  }).join('');
  return `<div style="position:absolute;inset:0;background:${feltBg}">
    <div style="position:absolute;inset:0;background:radial-gradient(80% 55% at 46% 40%,
      rgba(255,240,205,0.18), transparent 68%)"></div>
    ${weave('h3', { opacity: 0.15 })}${scatter}${grain('h3g')}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// I · STARK AND MINIMAL — one object, enormous
// ══════════════════════════════════════════════════════════════════════════════════════════════

function I1(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;align-items:center;justify-content:center">
    ${suit('spade', { size: Math.round(W * 0.92), fill: P.gold, style: `filter:drop-shadow(0 ${px(20)}px ${px(50)}px rgba(201,168,76,.22))` })}
    ${grain('i1', { opacity: 0.06 })}</div>`;
}

function I2(W) {
  const px = S(W), cw = Math.round(W * 0.46);
  // The card is the HOLE, not the object. Negative space as the mark.
  return `<div style="position:absolute;inset:0;background:linear-gradient(150deg,${P.goldLight},${P.gold} 52%,#7d6529);
    display:flex;align-items:center;justify-content:center">
    <div style="width:${cw}px;height:${Math.round(cw / 0.7)}px;border-radius:${px(14)}px;background:${P.bg};
      box-shadow:inset 0 ${px(6)}px ${px(18)}px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center">
      ${suit('spade', { size: cw * 0.42, fill: P.goldLight, opacity: 0.9 })}</div>
    ${grain('i2', { opacity: 0.07 })}</div>`;
}

function I3(W, boards) {
  const px = S(W), d = Math.round(W * 0.17);
  const dots = Array.from({ length: boards }, (_, b) =>
    `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${b === 0 ? P.goldLight : 'transparent'};
      border:${px(3)}px solid ${P.goldLight}"></div>`).join('');
  return `<div style="position:absolute;inset:0;background:${P.bg};display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:${px(30)}px">
    <div style="display:flex;gap:${px(22)}px">${dots}</div>
    <div style="font:600 ${px(12)}px ${UI};letter-spacing:${px(7)}px;color:${P.textMuted};text-indent:${px(7)}px">EVERY BOARD AT ONCE</div>
    ${grain('i3', { opacity: 0.05 })}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// J · TEXTURED AND TACTILE — grain, felt weave, card stock
// ══════════════════════════════════════════════════════════════════════════════════════════════

function J1(W) {
  const px = S(W);
  return `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#0a4a25,#03200f)">
    ${weave('j1a', { opacity: 0.5, freq: '2.4 5.2' })}
    ${weave('j1b', { opacity: 0.28, freq: '0.4 1.1' })}
    <div style="position:absolute;inset:0;background:radial-gradient(70% 46% at 30% 26%, rgba(255,255,255,.14), transparent 60%)"></div>
    <!-- a card edge entering frame: the subject is the MATERIAL, the card is the scale reference -->
    <div style="position:absolute;right:${-px(40)}px;bottom:${-px(30)}px;width:${px(300)}px;height:${px(210)}px;
      transform:rotate(-19deg);border-radius:${px(12)}px;background:linear-gradient(160deg,#fffdf6,${P.cardFace} 40%,#ddd6c6);
      box-shadow:0 ${px(16)}px ${px(40)}px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.9)"></div>
    ${grain('j1g', { opacity: 0.10 })}</div>`;
}

function J2(W) {
  const px = S(W);
  // ⚠️ CARD TRUTH. The first render put a RED SPADE here — the rank in ink black, the suit in
  // card red — on a direction whose whole subject is a card face seen close. A spade is never
  // red in a 52-card deck, and getting that wrong on the one direction that IS a playing card
  // says the designer does not know the game. It is the Ace of Hearts now: red rank, red heart.
  return `<div style="position:absolute;inset:0;background:${P.cardFace};overflow:hidden">
    ${grain('j2a', { opacity: 0.16, freq: 1.6, octaves: 4 })}
    <div style="position:absolute;left:${-px(70)}px;top:${px(30)}px;font:800 ${px(300)}px ${UI};
      color:${P.cardRed};line-height:.72;opacity:.96">A</div>
    <div style="position:absolute;right:${-px(30)}px;bottom:${-px(50)}px;opacity:.92">${suit('heart', { size: px(250), fill: P.cardRed })}</div>
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 ${px(80)}px ${px(20)}px rgba(120,110,90,.28)"></div>
    ${grain('j2b', { opacity: 0.20, freq: 3.2, octaves: 2 })}</div>`;
}

function J3(W) {
  const px = S(W), band = Math.round(HERO_H(W) / 3);
  return `<div style="position:absolute;inset:0;background:${P.bg}">
    <div style="position:absolute;left:0;right:0;top:0;height:${band}px;background:linear-gradient(160deg,#0a4a25,#04240f)">
      ${weave('j3a', { opacity: 0.44, freq: '2.2 4.8' })}</div>
    <div style="position:absolute;left:0;right:0;top:${band}px;height:${band}px;
      background:linear-gradient(110deg,#7d6529,${P.goldLight} 32%,#8a6f2c 58%,#f0dda2 82%,#6d5723)">
      ${grain('j3b', { opacity: 0.12, freq: 2.2 })}</div>
    <div style="position:absolute;left:0;right:0;top:${band * 2}px;bottom:0;background:${P.cardFace}">
      ${grain('j3c', { opacity: 0.22, freq: 1.8, octaves: 4 })}</div>
    <div style="position:absolute;left:0;right:0;top:${band}px;height:1px;background:rgba(0,0,0,.55)"></div>
    <div style="position:absolute;left:0;right:0;top:${band * 2}px;height:1px;background:rgba(0,0,0,.55)"></div>
    <div style="position:absolute;left:${px(20)}px;bottom:${px(12)}px;font:600 ${px(11)}px ${UI};
      letter-spacing:${px(4)}px;color:#6b6252">FELT · FOIL · STOCK</div></div>`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════

export const DIRECTIONS = [
  { id: 'A1', family: 'Table from above', name: 'Overhead, cards mid-deal', needs: 'asset', art: A1, boardsAware: true,
    note: 'CSS gets the layout and the light; real depth of field and card-in-flight blur want a rendered still.' },
  { id: 'A2', family: 'Table from above', name: 'Dealer’s arc, cropped hard', needs: 'none', art: A2 },
  { id: 'A3', family: 'Table from above', name: 'Still table, one card lifted', needs: 'none', art: A3, boardsAware: true },

  { id: 'B1', family: 'The format as the image', name: 'Boards as lit bars', needs: 'none', art: B1, boardsAware: true },
  { id: 'B2', family: 'The format as the image', name: 'Hand splitting into boards', needs: 'none', art: B2, boardsAware: true },
  { id: 'B3', family: 'The format as the image', name: 'Card grid, edge to edge', needs: 'none', art: B3, boardsAware: true },

  { id: 'C1', family: 'One oversized card', name: 'Ace of spades, centred', needs: 'designer', art: C1,
    note: 'The pip layout and the face art are a real card design, not a centred glyph.' },
  { id: 'C2', family: 'One oversized card', name: 'Card bleeding off frame + wordmark', needs: 'designer', art: C2 },
  { id: 'C3', family: 'One oversized card', name: 'The card back as hero', needs: 'designer', art: C3,
    note: 'The shop already sells card backs; this wants the real back art, not three circles.' },

  { id: 'D1', family: 'Typography alone', name: 'CAPS, gold, enormous', needs: 'none', art: D1 },
  { id: 'D2', family: 'Typography alone', name: 'Editorial masthead', needs: 'none', art: D2 },
  { id: 'D3', family: 'Typography alone', name: 'The sentence is the art', needs: 'none', art: D3 },

  { id: 'E1', family: 'Light and shadow on felt', name: 'Raking light, long shadow', needs: 'none', art: E1 },
  { id: 'E2', family: 'Light and shadow on felt', name: 'Chiaroscuro pool', needs: 'none', art: E2, boardsAware: true },
  { id: 'E3', family: 'Light and shadow on felt', name: 'Cards barely emerging', needs: 'none', art: E3 },

  { id: 'F1', family: 'Wordmark as the screen', name: 'Letters cropped by the frame', needs: 'none', art: F1 },
  { id: 'F2', family: 'Wordmark as the screen', name: 'Gold foil emboss', needs: 'none', art: F2 },
  { id: 'F3', family: 'Wordmark as the screen', name: 'Cinema title card', needs: 'none', art: F3 },

  { id: 'G1', family: 'Frozen at reveal', name: 'One card mid-flip', needs: 'none', art: G1 },
  { id: 'G2', family: 'Frozen at reveal', name: 'The winning hand lit', needs: 'none', art: G2 },
  { id: 'G3', family: 'Frozen at reveal', name: 'All boards resolving at once', needs: 'none', art: G3, boardsAware: true },

  { id: 'H1', family: 'Chips', name: 'Stacks in depth of field', needs: 'asset', art: H1,
    note: 'CSS blur is not depth of field and a conic gradient is not a moulded clay chip.' },
  { id: 'H2', family: 'Chips', name: 'One enormous chip', needs: 'asset', art: H2b },
  { id: 'H3', family: 'Chips', name: 'Chips mid-fall', needs: 'asset', art: H3 },

  { id: 'I1', family: 'Stark and minimal', name: 'One spade, screen height', needs: 'none', art: I1 },
  { id: 'I2', family: 'Stark and minimal', name: 'The card as negative space', needs: 'none', art: I2 },
  { id: 'I3', family: 'Stark and minimal', name: 'Boards reduced to marks', needs: 'none', art: I3, boardsAware: true },

  { id: 'J1', family: 'Texture and material', name: 'Felt weave, card edge entering', needs: 'none', art: J1 },
  { id: 'J2', family: 'Texture and material', name: 'Card stock, extreme close', needs: 'none', art: J2 },
  { id: 'J3', family: 'Texture and material', name: 'Felt, foil and stock meeting', needs: 'none', art: J3 },
];

/** Directions whose art is light behind the legal strip, so the strip needs its dark ink. */
export const LIGHT_ART = new Set(['I2', 'J2']);
