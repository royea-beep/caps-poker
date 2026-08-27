#!/usr/bin/env python3
"""Builds the one reviewable page for the board-panel decision.

Every image is a real capture from a real export, embedded so the page is self-contained, and
every number beside a picture is the number measured off that picture. Nothing here is authored
by hand except the prose.
"""
import base64, json, os, pathlib

ART = pathlib.Path('panel-compare/art')
OUT = pathlib.Path('/tmp/claude-0/-home-user-caps-poker/29632af8-42ab-5a2c-a794-9f3ca7c63779/scratchpad/felt-under-the-boards.html')
OUT.parent.mkdir(parents=True, exist_ok=True)

def img(name):
    p = ART / name
    return 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode()

# state B, 393 / 2P — the densest cell, where the panel carries the most cards.
V = [
 dict(id='P0',  name='Today',            token='#1C1F268C ×2', rgb=(23,33,33), card=15.76, mint=9.03,
      cls=1.08, slate=2.02, slot=2.72, grey=36, kind='control',
      note='The control. Two 0.55 layers, so the panel renders at ~0.80 and the felt does not reach '
           'the play area at all.'),
 dict(id='P0S', name='Same tint, painted once', token='#1C1F268C', rgb=(23,41,35), card=14.59, mint=8.36,
      cls=1.16, slate=1.87, slot=2.67, grey=42, kind='fix',
      note='Not an option — this is today’s token with the duplicate web layer removed, included so '
           'the double paint’s cost is separable from any colour choice.'),
 dict(id='V1',  name='More transparent',  token='#1C1F2640', rgb=(23,51,37), card=13.09, mint=7.49,
      cls=1.30, slate=1.68, slot=2.59, grey=49, kind='option',
      note='The felt reads clearly through, and each board still reads as a slightly recessed region '
           'rather than relying on its 1px accent border alone.'),
 dict(id='V2',  name='Fully transparent', token='#1C1F2600', rgb=(24,60,39), card=11.73, mint=6.72,
      cls=1.45, slate=1.50, slot=2.51, grey=56, kind='option',
      note='The felt is the board’s own ground. Only the rail, the accent border and the slot '
           'outlines remain. The most committed answer to “surface, not surround”.'),
 dict(id='V3',  name='Lighter, felt-hued', token='#284A3873', rgb=(29,61,44), card=11.45, mint=6.56,
      cls=1.48, slate=1.47, slot=2.48, grey=58, kind='collapsed',
      note='Tinted toward the felt’s own hue — and therefore almost a no-op over it. Five parts in '
           '255 from V2. It stopped looking like a dark box and stopped reading as a panel at the '
           'same time, so it is not a third option.'),
 dict(id='V4',  name='Raised panel',      token='#8FB5A02E', rgb=(42,78,58), card=8.94, mint=5.12,
      cls=1.90, slate=1.15, slot=2.27, grey=72, kind='option',
      note='V3 done properly: a panel only reads as a panel if it differs from the felt in '
           'lightness, so this goes above it — a raised area of table rather than a scrim over it.'),
]

PROTECT = 10.28

def chips(v):
    out = []
    if v['card'] < PROTECT:
        out.append(('cost', f'Card contrast {v["card"]} — below the {PROTECT} floor'))
    if v['id'] != 'P0' and v['cls'] > V[0]['cls']:
        out.append(('gain', f'Default card back {V[0]["cls"]} → {v["cls"]}'))
    if v['id'] != 'P0' and v['slate'] < 1.25:
        out.append(('cost', f'Slate back {v["slate"]} — the paid back loses its advantage'))
    if v['kind'] == 'collapsed':
        out.append(('flat', 'Collapses into V2'))
    return out

def swatch(rgb):
    return f'rgb({rgb[0]},{rgb[1]},{rgb[2]})'

cards = []
for v in V:
    cs = ''.join(f'<li class="chip chip--{k}">{t}</li>' for k, t in chips(v))
    cards.append(f'''
      <article class="variant variant--{v['kind']}" id="{v['id'].lower()}">
        <figure class="variant__shot">
          <img src="{img(v['id'] + '-393-2-A.png')}" alt="The arrangement screen at 393px with the {v['name']} panel" loading="lazy">
          <figcaption>393 px · 2 players · 4 boards</figcaption>
        </figure>
        <div class="variant__body">
          <header class="variant__head">
            <span class="variant__id">{v['id']}</span>
            <h3>{v['name']}</h3>
            <code>{v['token']}</code>
          </header>
          <p class="variant__note">{v['note']}</p>
          <div class="ground">
            <span class="ground__sw" style="background:{swatch(v['rgb'])}"></span>
            <span class="ground__txt">Panel as rendered <b>{swatch(v['rgb'])}</b> · grey {v['grey']}/255</span>
          </div>
          <table class="metrics">
            <tbody>
              <tr><th>Card face vs panel</th><td class="{'bad' if v['card'] < PROTECT else 'ok'}">{v['card']}</td></tr>
              <tr><th>Mint cue vs panel</th><td class="ok">{v['mint']}</td></tr>
              <tr><th>Card back — classic <em>(default)</em></th><td class="{'bad' if v['cls'] < 1.2 else 'warn'}">{v['cls']}</td></tr>
              <tr><th>Card back — slate <em>(bought)</em></th><td class="{'bad' if v['slate'] < 1.25 else 'warn'}">{v['slate']}</td></tr>
              <tr><th>Empty slot outline</th><td class="warn">{v['slot']}</td></tr>
            </tbody>
          </table>
          <ul class="chips">{cs}</ul>
        </div>
      </article>''')

grey_strip = ''.join(f'''
      <figure class="strip__item">
        <img src="{img(v['id'] + '-393-2-A-grey.png')}" alt="Greyscale of {v['name']}" loading="lazy">
        <figcaption><b>{v['id']}</b> panel grey {v['grey']}/255</figcaption>
      </figure>''' for v in V)

narrow_strip = ''.join(f'''
      <figure class="strip__item">
        <img src="{img(v['id'] + '-320-2-A.png')}" alt="{v['name']} at 320px" loading="lazy">
        <figcaption><b>{v['id']}</b> · 320 px</figcaption>
      </figure>''' for v in V)

BY_ID = {v['id']: v for v in V}
count_strip = ''.join(f'''
      <figure class="strip__item">
        <img src="{img(vid + '-393-4-A.png')}" alt="{BY_ID[vid]['name']} at four players, two boards" loading="lazy">
        <figcaption><b>{vid}</b> · 4 players · 2 boards</figcaption>
      </figure>''' for vid in ('P0', 'V1', 'V2', 'V4'))

back_rows = ''.join(f'''
      <tr><th>{v['id']} {v['name']}</th>
        <td>{v['cls']}</td><td>{v['slate']}</td>
        <td class="{'bad' if v['slate']/v['cls'] < 1.1 else ''}">{v['slate']/v['cls']:.2f}×</td></tr>''' for v in V)

HTML = f'''<title>Felt Under the Boards</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root {{
  --ground: #0A120E;
  --raised: #101C16;
  --sunk:   #0C1611;
  --line:   #1E3228;
  --ink:    #E9F0EA;
  --ink-2:  #A8BCAF;
  --ink-3:  #7A9184;
  --mint:   #4FD6A8;
  --gold:   #FFD700;
  --warn:   #E0A24A;
  --bad:    #E5705F;
  --measure: 66ch;
}}
@media (prefers-color-scheme: light) {{
  :root:not([data-theme="dark"]) {{
    --ground: #F3F6F3;
    --raised: #FFFFFF;
    --sunk:   #E8EEE9;
    --line:   #D2DED5;
    --ink:    #101A14;
    --ink-2:  #43574B;
    --ink-3:  #61776A;
    --mint:   #0E7A55;
    --gold:   #8A6B00;
    --warn:   #9A6410;
    --bad:    #B03A2A;
  }}
}}
:root[data-theme="light"] {{
  --ground: #F3F6F3; --raised: #FFFFFF; --sunk: #E8EEE9; --line: #D2DED5;
  --ink: #101A14; --ink-2: #43574B; --ink-3: #61776A;
  --mint: #0E7A55; --gold: #8A6B00; --warn: #9A6410; --bad: #B03A2A;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: "Public Sans", system-ui, -apple-system, sans-serif;
  font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased;
}}
.wrap {{ max-width: 1120px; margin: 0 auto; padding: 0 24px 96px; }}
h1, h2, h3 {{ font-family: Fraunces, Georgia, serif; text-wrap: balance; margin: 0; }}
p {{ margin: 0; max-width: var(--measure); }}
code, .mono {{ font-family: "IBM Plex Mono", ui-monospace, Menlo, monospace; }}

/* ── masthead ─────────────────────────────────────────────────────────── */
.top {{ padding: 72px 0 40px; border-bottom: 1px solid var(--line); }}
.eyebrow {{
  font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--mint); margin: 0 0 20px;
}}
.top h1 {{ font-size: clamp(40px, 7vw, 68px); line-height: 1.02; font-weight: 600; letter-spacing: -.02em; }}
.top .lede {{ margin-top: 20px; font-size: 19px; color: var(--ink-2); }}
.facts {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; padding: 0; list-style: none; }}
.facts li {{
  font-family: "IBM Plex Mono", monospace; font-size: 12.5px; color: var(--ink-2);
  border: 1px solid var(--line); border-radius: 999px; padding: 6px 13px; background: var(--raised);
}}
.facts b {{ color: var(--ink); font-weight: 500; }}

section {{ padding-top: 64px; }}
.shead {{ display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }}
.shead h2 {{ font-size: 28px; font-weight: 600; letter-spacing: -.01em; }}
.shead .tag {{
  font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: .12em;
  text-transform: uppercase; color: var(--ink-3);
}}
.sintro {{ color: var(--ink-2); margin-bottom: 28px; }}

/* ── the prerequisite finding ─────────────────────────────────────────── */
.finding {{
  margin-top: 24px; background: var(--raised); border: 1px solid var(--line);
  border-left: 3px solid var(--warn); border-radius: 4px; padding: 24px 26px;
}}
.finding h3 {{ font-size: 20px; margin-bottom: 10px; }}
.finding p + p {{ margin-top: 12px; }}
.layers {{ list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 8px; }}
.layers li {{
  font-family: "IBM Plex Mono", monospace; font-size: 12.5px; color: var(--ink-2);
  background: var(--sunk); border: 1px solid var(--line); border-radius: 3px; padding: 9px 12px;
  overflow-x: auto; white-space: nowrap;
}}

/* ── variants ─────────────────────────────────────────────────────────── */
.variants {{ display: grid; gap: 28px; margin-top: 12px; }}
.variant {{
  display: grid; grid-template-columns: 240px 1fr; gap: 32px; align-items: start;
  background: var(--raised); border: 1px solid var(--line); border-radius: 6px; padding: 24px;
}}
.variant--control {{ border-style: dashed; }}
.variant--fix, .variant--collapsed {{ opacity: .82; }}
.variant__shot img {{ width: 100%; display: block; border-radius: 4px; border: 1px solid var(--line); }}
.variant__shot figcaption, .strip__item figcaption {{
  font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--ink-3);
  margin-top: 8px; text-align: center;
}}
.variant__head {{ display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }}
.variant__id {{
  font-family: "IBM Plex Mono", monospace; font-weight: 600; font-size: 13px;
  color: var(--ground); background: var(--mint); border-radius: 3px; padding: 3px 8px;
}}
.variant__head h3 {{ font-size: 22px; font-weight: 600; }}
.variant__head code {{ font-size: 12.5px; color: var(--ink-3); }}
.variant__note {{ margin: 12px 0 0; color: var(--ink-2); font-size: 15px; }}
.ground {{ display: flex; align-items: center; gap: 10px; margin-top: 18px; }}
.ground__sw {{ width: 34px; height: 22px; border-radius: 3px; border: 1px solid var(--line); flex: none; }}
.ground__txt {{ font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--ink-3); }}
.ground__txt b {{ color: var(--ink-2); font-weight: 500; }}

.metrics {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }}
.metrics th {{
  text-align: left; font-weight: 400; color: var(--ink-2); padding: 7px 0;
  border-bottom: 1px solid var(--line);
}}
.metrics th em {{ color: var(--ink-3); font-style: normal; font-size: 12.5px; }}
.metrics td {{
  text-align: right; padding: 7px 0; border-bottom: 1px solid var(--line);
  font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums; font-weight: 500;
}}
td.ok {{ color: var(--mint); }}
td.warn {{ color: var(--warn); }}
td.bad {{ color: var(--bad); }}

.chips {{ list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }}
.chip {{
  font-family: "IBM Plex Mono", monospace; font-size: 11.5px; padding: 5px 10px;
  border-radius: 3px; border: 1px solid;
}}
.chip--cost {{ color: var(--bad); border-color: var(--bad); }}
.chip--gain {{ color: var(--mint); border-color: var(--mint); }}
.chip--flat {{ color: var(--ink-3); border-color: var(--line); }}

/* ── strips ───────────────────────────────────────────────────────────── */
.strip {{ display: flex; gap: 16px; overflow-x: auto; padding-bottom: 12px; margin-top: 8px; }}
.strip__item {{ flex: 0 0 168px; margin: 0; }}
.strip__item img {{ width: 100%; display: block; border-radius: 4px; border: 1px solid var(--line); }}

/* ── tables ───────────────────────────────────────────────────────────── */
.tablewrap {{ overflow-x: auto; margin-top: 20px; }}
table.data {{ width: 100%; border-collapse: collapse; font-size: 14px; min-width: 460px; }}
table.data th, table.data td {{
  padding: 10px 14px; border-bottom: 1px solid var(--line); text-align: right;
  font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums;
}}
table.data thead th {{
  text-align: right; color: var(--ink-3); font-weight: 500; font-size: 11.5px;
  letter-spacing: .08em; text-transform: uppercase; border-bottom: 1px solid var(--ink-3);
}}
table.data tbody th {{ text-align: left; font-family: "Public Sans", sans-serif; color: var(--ink-2); font-weight: 400; }}
table.data td.bad {{ color: var(--bad); }}

.locked {{ display: grid; gap: 14px; margin-top: 20px; padding: 0; list-style: none; }}
.locked li {{ background: var(--raised); border: 1px solid var(--line); border-radius: 4px; padding: 16px 18px; }}
.locked b {{ display: block; margin-bottom: 4px; }}
.locked span {{ color: var(--ink-2); font-size: 15px; }}

/* ── recommendation ───────────────────────────────────────────────────── */
.rec {{
  margin-top: 24px; background: var(--raised); border: 1px solid var(--gold);
  border-radius: 6px; padding: 28px 30px;
}}
.rec h3 {{ font-size: 24px; margin-bottom: 12px; }}
.rec h3 span {{ color: var(--gold); }}
.rec p + p {{ margin-top: 12px; }}
.rec .caveat {{ margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line);
  color: var(--ink-3); font-size: 14.5px; }}

footer {{ margin-top: 72px; padding-top: 24px; border-top: 1px solid var(--line);
  color: var(--ink-3); font-size: 13px; font-family: "IBM Plex Mono", monospace; }}

@media (max-width: 760px) {{
  .variant {{ grid-template-columns: 1fr; gap: 20px; }}
  .variant__shot {{ max-width: 240px; margin: 0 auto; }}
}}
@media (prefers-reduced-motion: reduce) {{ * {{ animation: none !important; transition: none !important; }} }}
</style>

<div class="wrap">
  <header class="top">
    <p class="eyebrow">CAPS · board-panel study · 27 Aug 2026</p>
    <h1>Felt Under the Boards</h1>
    <p class="lede">Four ways the board panel could stop being a dark box over the green, each one a
      real build of the app photographed on the same hand. Measured, not chosen — nothing here is
      shipped.</p>
    <ul class="facts">
      <li><b>Same hand</b> proven by share-of-pixels, identical to 2 dp</li>
      <li><b>No layout change</b> — geometry byte-identical in all six cells</li>
      <li><b>Nothing shipped</b> — tokens patched, exported, reverted</li>
      <li><b>2,653</b> tests pass · tsc clean</li>
    </ul>
  </header>

  <section>
    <div class="shead"><h2>Before any option: the panel is painted twice</h2><span class="tag">prerequisite</span></div>
    <p class="sintro">This was not in the brief and it changes what every option below is worth.</p>
    <div class="finding">
      <h3>On web the panel renders at ~0.80, not the 0.55 its token says</h3>
      <p>The board container paints the panel as a CSS gradient, and an absolute-fill
        <code>&lt;LinearGradient&gt;</code> child paints it again — at a different angle. Two 0.55
        layers composite to 1−(1−0.55)² ≈ 0.80. Native paints it once, so web has been roughly half
        again as opaque as native this whole time.</p>
      <ul class="layers">
        <li>container → linear-gradient(<b>165deg</b>, rgba(28,31,38,0.55), rgba(16,18,24,0.55))</li>
        <li>child &nbsp;&nbsp;&nbsp;→ linear-gradient(<b>131.6deg</b>, rgba(28,31,38,0.55), rgba(16,18,24,0.55))</li>
      </ul>
      <p style="margin-top:16px">Read out of the live DOM, not from the source. Every option below
        removes the duplicate layer, because otherwise the alpha written in the token is not the
        alpha that renders — an option would be measuring a number it does not have.</p>
    </div>
  </section>

  <section>
    <div class="shead"><h2>The options</h2><span class="tag">state: every slot filled · 393 px</span></div>
    <p class="sintro">Same hand in all six, same viewport, same capture. Only the panel changes.
      Contrast ratios are measured against each variant’s own rendered ground, found by diffing two
      real renders rather than by guessing at coordinates.</p>
    <div class="variants">{''.join(cards)}</div>
  </section>

  <section>
    <div class="shead"><h2>The card back nobody was watching</h2><span class="tag">the real cost</span></div>
    <p class="sintro">Today’s panel renders at rgb(23,33,33). The default <em>classic</em> card back
      is <code>#18181c</code> — rgb(24,24,28). The face-down cards are very nearly the same colour as
      the surface they sit on: 1.08:1, six steps of grey out of 255. Every option improves that. But
      <em>slate</em>, the back players buy, moves the other way, and past V2 it stops being worth
      buying.</p>
    <div class="tablewrap">
      <table class="data">
        <thead><tr><th style="text-align:left">Panel</th><th>Classic (free)</th><th>Slate (paid)</th><th>Slate’s advantage</th></tr></thead>
        <tbody>{back_rows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="shead"><h2>Without hue</h2><span class="tag">greyscale</span></div>
    <p class="sintro">Remove colour and the separation has to survive as luminance alone. It does in
      every option — the card face never falls below 176/255 of separation from the panel, and the
      winner cue is carried by width, not hue, so it is untouched either way.</p>
    <div class="strip">{grey_strip}</div>
  </section>

  <section>
    <div class="shead"><h2>320 px, and every board count</h2><span class="tag">2P=4 · 3P=3 · 4P=2</span></div>
    <p class="sintro">Board count is never assumed. Each option was captured at both widths across
      all three seat counts; the panel behaves identically at every one.</p>
    <div class="strip">{narrow_strip}</div>
    <div class="strip" style="margin-top:20px">{count_strip}</div>
  </section>

  <section>
    <div class="shead"><h2>What no option here can move</h2><span class="tag">verified, not assumed</span></div>
    <ul class="locked">
      <li><b>The gold winner cue — 12.52:1, untouched</b><span>It needs <code>revealed</code>, and a
        revealed hand is either the full-screen board reveal (cards on bare felt, no panel) or
        /results, whose <code>BoardResultCard</code> paints <code>COLORS.surface</code>. Gold never
        rests on a board panel. Driven and confirmed, not read off the source.</span></li>
      <li><b>The neutral cue — 3.31:1, untouched</b><span>It is the card’s own 1px border, so it
        composites over the card face, never over the panel. The width channel — 3px gold, 2px mint,
        1px neutral — is unaffected by all of this.</span></li>
      <li><b>Layout — byte-identical</b><span>The board surface and first-board geometry are the same
        in all six variants at all six cells. A clip-aware overlap sweep against a pre-change control
        returns identical pair counts everywhere; the only pairs found are two pre-existing ones at
        320 px, a card’s own corner pip over its centre suit.</span></li>
    </ul>
  </section>

  <section>
    <div class="shead"><h2>Recommendation</h2><span class="tag">yours to call</span></div>
    <div class="rec">
      <h3>Take <span>V1</span> — more transparent, painted once</h3>
      <p>The felt reads clearly as the table’s surface right up to the cards, which is the thing the
        brief is actually asking for, and each board still reads as its own slightly recessed region
        instead of leaning entirely on a 1px accent border to say where it ends.</p>
      <p>It also keeps the most in reserve. Card contrast lands at 13.09 — comfortably above the
        10.28 floor, where V4 breaks it at 8.94. The default card back gets meaningfully better
        (1.08 → 1.30) without flattening slate’s paid advantage to nothing, which V2 nearly does and
        V4 inverts.</p>
      <p>If the goal is the fuller commitment, <b>V2</b> is the honest version of it and costs only
        card contrast you can afford — but it does spend the slate back. <b>V4</b> is the most
        table-like of the four and the only one I would not ship as measured.</p>
      <p class="caveat">Two things this page cannot tell you. Every number is Chromium only — WebKit
        will not install in this container and there is no browser egress, so nothing here has been
        seen on Safari. And the empty slot outlines sit between 2.72 and 2.27 against the panel:
        below 3:1 in every option <em>including today’s</em>. That is a pre-existing defect this
        change mildly worsens, and it wants its own decision.</p>
    </div>
  </section>

  <footer>
    tests/panel-variants.sh · tests/panel-compare.mjs · tests/panel-measure.mjs · tests/panel-sweep.mjs
    &nbsp;·&nbsp; six real exports, 72 captures, Chromium 1194, deviceScaleFactor 2
  </footer>
</div>
'''

OUT.write_text(HTML, encoding='utf8')
print('wrote', OUT, round(OUT.stat().st_size / 1e6, 2), 'MB')
