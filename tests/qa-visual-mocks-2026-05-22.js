/**
 * Render 4 visual mockups by injecting CSS/DOM into caps.ftable.co.il at runtime.
 * No source files modified, no commits. Uploads PNGs to Supabase `screenshots/caps-2026-05-22-mocks/`.
 *
 * Variants:
 *   01_current       — as-shipped (Monaco Casino classic + S83 Clean Lobby)
 *   02_b153_style    — current + b153 hero card fan + 15 floating suit particles + glow pulse
 *   03_neon_gaming   — current + sprint-21 neon palette (#00D4FF / #8B5CF6 / #00FF88 / #FF3366) overlaid
 *   04_neon_plus_b153 — combination of 02 + 03
 *
 * Each variant: home + game. iPhone 14 viewport, onboarded storageState if present.
 *
 * IMPORTANT: these are runtime visual approximations on top of the live deployed code.
 * They're for direction-of-design comparison, not pixel-perfect reproductions.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch (_) {}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gxrpunvhjcrzqnitbqah.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const STATE_PATH   = path.join(__dirname, 'caps-onboarded.json');
const FOLDER       = 'caps-2026-05-22-mocks';
const SITE         = 'https://caps.ftable.co.il';

// Sprint-21 neon palette (the actual hex codes from session memory)
const NEON = {
  blue:   '#00D4FF',
  purple: '#8B5CF6',
  green:  '#00FF88',
  red:    '#FF3366',
  bg:     '#0a0014',   // deep purple-black for "gaming" backdrop
};

// ─── DOM patches injected as page-level scripts ─────────────────────────────

// Patch (2): b153 hero card fan + 15 suit particles + glow pulse on primary button.
// Appends an overlay layer; doesn't touch existing styles.
const B153_INJECT = `
(() => {
  if (document.getElementById('mock-b153-style')) return;
  const style = document.createElement('style');
  style.id = 'mock-b153-style';
  style.textContent = \`
    /* 15 floating suit particles */
    .mock-particle {
      position: fixed; top: 0; left: 0; font-size: 28px; opacity: 0.18;
      pointer-events: none; z-index: 9998;
      animation: mockFloat 9s ease-in-out infinite;
      color: #c9a84c;
      text-shadow: 0 0 12px rgba(201,168,76,0.6);
    }
    @keyframes mockFloat {
      0%   { transform: translate(0,0)   rotate(0deg);   opacity: 0.05; }
      25%  { transform: translate(20px,-40px) rotate(15deg); opacity: 0.25; }
      50%  { transform: translate(-15px,-80px) rotate(-10deg); opacity: 0.18; }
      75%  { transform: translate(30px,-50px) rotate(20deg); opacity: 0.22; }
      100% { transform: translate(0,0)   rotate(0deg);   opacity: 0.05; }
    }
    /* Hero card fan container */
    .mock-card-fan {
      position: fixed; left: 50%; top: 40%; transform: translate(-50%, -50%);
      width: 320px; height: 200px; pointer-events: none; z-index: 9997;
    }
    .mock-card-fan .card {
      position: absolute; left: 50%; top: 50%;
      width: 70px; height: 100px; margin-left: -35px; margin-top: -50px;
      background: #FFFEF8; border-radius: 8px;
      border: 1px solid rgba(0,0,0,0.18);
      box-shadow: 0 4px 18px rgba(0,0,0,0.55), 0 0 26px rgba(201,168,76,0.32);
      display: flex; align-items: center; justify-content: center;
      font-size: 30px; font-weight: 800;
      transform-origin: 50% 130%;
    }
    .mock-card-fan .card.r0 { transform: rotate(-22deg); color: #1a1a2e; }
    .mock-card-fan .card.r1 { transform: rotate(-11deg); color: #c0392b; }
    .mock-card-fan .card.r2 { transform: rotate(  0deg); color: #c0392b; }
    .mock-card-fan .card.r3 { transform: rotate( 11deg); color: #1a1a2e; }
    .mock-card-fan .card.r4 { transform: rotate( 22deg); color: #1a1a2e; }
    /* Glow-pulse on the PLAY NOW button (the largest <Pressable> on home) */
    @keyframes mockGlow {
      0%, 100% { box-shadow: 0 0 0px rgba(201,168,76,0.0), 0 0 14px rgba(201,168,76,0.45); }
      50%      { box-shadow: 0 0 32px rgba(201,168,76,0.85), 0 0 60px rgba(201,168,76,0.55); }
    }
    .mock-glow-pulse { animation: mockGlow 1.8s ease-in-out infinite !important; }
  \`;
  document.head.appendChild(style);

  // 15 particles
  const suits = ['♠','♥','♦','♣'];
  for (let i = 0; i < 15; i++) {
    const p = document.createElement('div');
    p.className = 'mock-particle';
    p.textContent = suits[i % 4];
    p.style.left = (Math.random() * 100) + '%';
    p.style.top = (Math.random() * 100) + '%';
    p.style.fontSize = (18 + Math.floor(Math.random() * 22)) + 'px';
    p.style.animationDelay = (Math.random() * 9) + 's';
    document.body.appendChild(p);
  }

  // Card fan (only on /, the home route)
  if (location.pathname === '/' || location.pathname === '') {
    const fan = document.createElement('div');
    fan.className = 'mock-card-fan';
    const cards = [
      { r: 0, t: 'A♠' }, { r: 1, t: 'K♥' }, { r: 2, t: 'Q♦' },
      { r: 3, t: 'J♣' }, { r: 4, t: '10♠' },
    ];
    cards.forEach(c => {
      const el = document.createElement('div');
      el.className = 'card r' + c.r;
      el.textContent = c.t;
      fan.appendChild(el);
    });
    document.body.appendChild(fan);
  }

  // Glow-pulse on largest button that contains the word PLAY
  const all = Array.from(document.querySelectorAll('[role="button"], button, [aria-label*="play" i], [aria-label*="Play"]'));
  let target = null, bestArea = 0;
  for (const el of all) {
    const t = (el.innerText || '').toUpperCase();
    if (!t.includes('PLAY')) continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) { bestArea = area; target = el; }
  }
  if (target) target.classList.add('mock-glow-pulse');
})();
`;

// Patch (3): NEON GAMING palette — walk the DOM, override gold/maroon hexes.
// React Native Web emits inline styles, so we walk and patch element.style.
const NEON_INJECT = `
(() => {
  if (document.getElementById('mock-neon-style')) return;
  const style = document.createElement('style');
  style.id = 'mock-neon-style';
  style.textContent = \`
    /* Whole-page background hint */
    html, body { background: ${NEON.bg} !important; }
  \`;
  document.head.appendChild(style);

  // Hex map: current → neon
  const map = new Map([
    // gold family → neon blue
    ['#c9a84c', '${NEON.blue}'],
    ['#C9A84C', '${NEON.blue}'],
    ['#e8c96a', '${NEON.blue}'],
    ['#9a7a2e', '#0088aa'],
    ['#FFD700', '${NEON.blue}'],
    ['#ffd700', '${NEON.blue}'],
    // maroon felt → deep purple
    ['#6B0000', '#1a0033'],
    ['#6b0000', '#1a0033'],
    ['#8B0000', '#2a0044'],
    ['#5C1818', '#1a0033'],
    ['#5c1818', '#1a0033'],
    ['#8B4513', '${NEON.purple}'],
    ['#1C0508', '${NEON.bg}'],
    // cream text → cyan-tinted
    ['#f0ead6', '#e8faff'],
    ['#F0EAD6', '#e8faff'],
    ['#FFFEF8', '#e8faff'],
    // green wins keep but brighter
    ['#2ecc71', '${NEON.green}'],
    ['#22c55e', '${NEON.green}'],
    // red losses keep but neon
    ['#c0392b', '${NEON.red}'],
    ['#ef4444', '${NEON.red}'],
    // text dim → muted purple
    ['#8a7a5a', '#7a6a9a'],
  ]);
  const rgbMap = new Map();
  for (const [hex, neon] of map) {
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) continue;
    const r = parseInt(m[1].slice(0,2),16), g = parseInt(m[1].slice(2,4),16), b = parseInt(m[1].slice(4,6),16);
    rgbMap.set(\`rgb(\${r}, \${g}, \${b})\`, neon);
    rgbMap.set(\`rgb(\${r},\${g},\${b})\`, neon);
  }

  const patchProp = (el, prop) => {
    const cur = el.style[prop];
    if (!cur) return;
    if (rgbMap.has(cur)) { el.style.setProperty(prop, rgbMap.get(cur), 'important'); return; }
    for (const [k, v] of rgbMap) {
      if (cur.includes(k)) {
        el.style.setProperty(prop, cur.split(k).join(v), 'important');
        return;
      }
    }
  };
  const props = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'textShadow', 'boxShadow', 'fill', 'stroke'];

  const walk = () => {
    document.querySelectorAll('*').forEach(el => props.forEach(p => patchProp(el, p)));
  };
  walk();
  // Re-walk after a tick in case the app paints late
  setTimeout(walk, 400);
  setTimeout(walk, 1200);
})();
`;

// ─── Routes + variants ───────────────────────────────────────────────────────
const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'game', path: '/game' },
];

const VARIANTS = [
  { id: '01_current',        label: 'CURRENT — Monaco Casino + S83 Clean Lobby (as shipped)',                   inject: null },
  { id: '02_b153_style',     label: 'b153 STYLE — particles + hero card fan + glow pulse (gold palette)',       inject: B153_INJECT },
  { id: '03_neon_gaming',    label: 'NEON GAMING — sprint-21 palette (#00D4FF, #8B5CF6, #00FF88, #FF3366)',     inject: NEON_INJECT },
  { id: '04_neon_plus_b153', label: 'NEON + b153 combined — particles + fan + glow on neon palette',            inject: NEON_INJECT + '\n' + B153_INJECT },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outDir = path.join(process.cwd(), FOLDER);
  fs.mkdirSync(outDir, { recursive: true });

  const ctxOpts = {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  };
  if (fs.existsSync(STATE_PATH)) ctxOpts.storageState = STATE_PATH;

  const results = [];
  for (const v of VARIANTS) {
    const ctx = await browser.newContext(ctxOpts);
    for (const r of ROUTES) {
      const page = await ctx.newPage();
      const url = `${SITE}${r.path}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2800);
        if (v.inject) {
          await page.evaluate(v.inject);
          await page.waitForTimeout(900); // let the patches settle + glow animation reach a frame
        }
        const tag = `${v.id}_${r.name}`;
        const localPath = path.join(outDir, `${tag}.png`);
        await page.screenshot({ path: localPath, fullPage: false });
        const buf = fs.readFileSync(localPath);
        const storagePath = `${FOLDER}/${tag}.png`;
        const { error } = await sb.storage.from('screenshots').upload(storagePath, buf, { contentType: 'image/png', upsert: true });
        const publicUrl = error ? null : `${SUPABASE_URL}/storage/v1/object/public/screenshots/${storagePath}`;
        results.push({ variant: v.id, route: r.name, url: publicUrl, label: v.label, error: error?.message });
        console.log(`[mock] ${tag.padEnd(28)} ${publicUrl ? '✅' : '❌ ' + error?.message}`);
      } catch (e) {
        results.push({ variant: v.id, route: r.name, error: e.message });
        console.log(`[mock] ${v.id}_${r.name} ❌ ${e.message}`);
      } finally {
        await page.close();
      }
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'urls.json'), JSON.stringify(results, null, 2));
  console.log('\n=== URLS BY VARIANT ===');
  for (const v of VARIANTS) {
    console.log('\n' + v.label);
    for (const r of results.filter(x => x.variant === v.id)) {
      console.log(`  ${r.route.padEnd(8)} ${r.url || 'ERROR: ' + r.error}`);
    }
  }
})();
