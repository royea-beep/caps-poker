/**
 * TEN HOME SCREENS, RENDERED — because the felt comparison worked when he could SEE it.
 *
 * These are RENDERS, not a shipped redesign. Nothing here is wired into the app; the brief is
 * explicit that Roye picks. They are built as REAL DOM — real buttons, real aria-labels, real
 * computed colours — so the same measurement pass that audits the shipping screen can audit each
 * concept: contrast on every text element, every touch target against 44pt, and the count of
 * controls actually exposed to assistive tech.
 *
 * PALETTE IS THE SHIPPING PALETTE, taken from constants/paintThemes.ts `classic`. The felt and the
 * winner cue are settled and are not re-litigated here. No concept invents a colour.
 */
export const T = {
  bg: '#0a0a0a', surface: '#161922', surface2: '#1C1F26',
  mint: '#4FD6A8', gold: '#c9a84c', goldLight: '#e8c96a',
  text: '#f0ead6', muted: '#9aa19b', dim: '#5b6168',
  cardFace: '#FCFAF3', win: '#2ecc71', red: '#c0392b',
  feltTop: '#003115', feltBot: '#062E18', feltLift: 'rgb(26,70,44)',
};

/** A tab bar, identical in every concept — it is not what is being compared. */
const tabs = (active = 'Home') => `
  <nav class="tabs" aria-label="Main">
    ${['Home', 'Play', 'Friends', 'Cups', 'Profile'].map((t) => `
      <button class="tab${t === active ? ' on' : ''}" aria-label="${t}">
        <span class="tabIcon" aria-hidden="true">${{ Home: '⌂', Play: '♠', Friends: '👥', Cups: '🏆', Profile: '👤' }[t]}</span>
        <span class="tabTxt">${t}</span>
      </button>`).join('')}
  </nav>`;

/** The chip pill + avatar, kept in concepts that argue for keeping it. */
const topbar = () => `
  <header class="top">
    <button class="chips" aria-label="Your chips, 2,530"><span aria-hidden="true">🪙</span> 2,530</button>
    <button class="avatar" aria-label="Your profile">👤</button>
  </header>`;

/** Four mini boards with cards — what the game actually looks like. */
const miniTable = (h = 150) => `
  <div class="felt" style="height:${h}px" role="img" aria-label="Four boards, each with five community cards">
    ${[0, 1, 2, 3].map(() => `<div class="miniBoard">${'<i class="pip"></i>'.repeat(5)}</div>`).join('')}
  </div>`;

const cardFan = (scale = 1) => `
  <div class="fan" style="transform:scale(${scale})" role="img" aria-label="A fan of playing cards">
    ${[['A', '♠', 0], ['K', '♥', 1], ['Q', '♦', 0], ['J', '♣', 1], ['10', '♠', 0]]
      .map(([r, s, red], i) => `<span class="pc${red ? ' red' : ''}" style="--i:${i}"><b>${r}</b><em>${s}</em></span>`).join('')}
  </div>`;

/**
 * Each concept declares what it CUTS and what it PROMOTES, because "nicer" is not a thesis and a
 * concept that cannot say what it removed has not made a choice.
 */
export const CONCEPTS = [
  {
    id: 'C1', name: 'ONE DOOR',
    cuts: 'player selector, blinds/config line, daily bonus, invite, report-a-bug, tagline',
    promotes: 'a single decision — one button, nothing competing with it',
    body: () => `${topbar()}
      <div class="pad">
        <div class="wordmarkSm">CAPS <span>POKER</span></div>
        <button class="cta big" aria-label="Play">PLAY</button>
        <p class="under">Four boards. One hand. Take the most.</p>
      </div>${tabs()}`,
  },
  {
    id: 'C2', name: 'MULTIPLAYER FIRST',
    cuts: 'the practice button’s primacy, selector, config line, invite, bug card',
    promotes: 'the actual product — Play Online is the hero, practice is the fallback',
    body: () => `${topbar()}
      <div class="pad">
        <div class="wordmarkSm">CAPS <span>POKER</span></div>
        <button class="cta big mint" aria-label="Play online against real players">
          <span class="ctaTop">PLAY ONLINE</span><span class="ctaSub">real players · tables open now</span>
        </button>
        <button class="cta ghost" aria-label="Practice against bots">Practice vs bots</button>
      </div>${tabs()}`,
  },
  {
    id: 'C3', name: 'THE TABLE IS THE HERO',
    cuts: 'the large wordmark, the card fan, the tagline, the config line',
    promotes: 'what the game LOOKS like — the felt and four boards, before any words',
    body: () => `${topbar()}
      <div class="pad">
        ${miniTable(260)}
        <button class="cta big mint" aria-label="Play online">PLAY ONLINE</button>
        <button class="cta ghost" aria-label="Practice against bots">Practice vs bots</button>
      </div>${tabs()}`,
  },
  {
    id: 'C4', name: 'TWO DOORS',
    cuts: 'everything above the fold except the choice itself',
    promotes: 'one either/or, weighted equally, no third option to weigh',
    body: () => `${topbar()}
      <div class="pad">
        <div class="wordmarkSm">CAPS <span>POKER</span></div>
        <div class="two">
          <button class="door mint" aria-label="Play online against real players">
            <span class="doorIcon" aria-hidden="true">🌐</span><b>ONLINE</b><i>real players</i></button>
          <button class="door" aria-label="Practice against bots">
            <span class="doorIcon" aria-hidden="true">🤖</span><b>PRACTICE</b><i>vs bots</i></button>
        </div>
      </div>${tabs()}`,
  },
  {
    id: 'C5', name: 'LIVE NOW',
    cuts: 'daily bonus, invite, bug card, selector',
    promotes: 'proof the room is not empty — the one thing a stranger cannot tell',
    body: () => `${topbar()}
      <div class="pad">
        <div class="wordmarkSm">CAPS <span>POKER</span></div>
        <div class="live" role="status"><span class="dot" aria-hidden="true"></span> 41 players · 12 tables open</div>
        <button class="cta big mint" aria-label="Join a table now">JOIN A TABLE</button>
        <button class="cta ghost" aria-label="Practice against bots">Practice vs bots</button>
      </div>${tabs()}`,
  },
  {
    id: 'C6', name: 'SAY WHAT IT IS',
    cuts: 'the jargon config line (“Low Blinds · 25/board”), the selector, the tagline',
    promotes: 'comprehension — a stranger learns the rule before being asked to press anything',
    body: () => `${topbar()}
      <div class="pad">
        <div class="wordmarkSm">CAPS <span>POKER</span></div>
        <p class="pitch">You get <b>four cards on every board</b>.<br>Four boards run at once.<br><b>Win the most, win the hand.</b></p>
        <button class="cta big mint" aria-label="Play">PLAY</button>
      </div>${tabs()}`,
  },
  {
    id: 'C7', name: 'YOUR RUN',
    cuts: 'selector, config line, bug card, invite',
    promotes: 'progression — chips, streak and tier framing the button instead of floating loose',
    body: () => `
      <div class="pad">
        <div class="runCard">
          <div class="runRow"><span class="runK">CHIPS</span><span class="runV">2,530</span></div>
          <div class="runRow"><span class="runK">STREAK</span><span class="runV">🔥 3</span></div>
          <div class="runRow"><span class="runK">TIER</span><span class="runV">2</span></div>
          <button class="cta big mint" aria-label="Play online">PLAY ONLINE</button>
        </div>
        <button class="cta ghost" aria-label="Practice against bots">Practice vs bots</button>
      </div>${tabs()}`,
  },
  {
    id: 'C8', name: 'MINIMAL',
    cuts: 'the chip pill, avatar, selector, config, bonus, invite, bug, tagline, legal line',
    promotes: 'nothing. That is the argument — one button and the tab bar, and see what breaks',
    body: () => `
      <div class="pad center">
        <div class="wordmarkBig">CAPS<br><span>POKER</span></div>
        <button class="cta big mint" aria-label="Play">PLAY</button>
      </div>${tabs()}`,
  },
  {
    id: 'C9', name: 'CARD HERO',
    cuts: 'the config line, the selector, the bug card',
    promotes: 'graphics — the cards at a size you can actually read, as the picture',
    body: () => `${topbar()}
      <div class="pad">
        <div class="heroWrap">${cardFan(1.55)}</div>
        <button class="cta big mint" aria-label="Play online">PLAY ONLINE</button>
        <button class="cta ghost" aria-label="Practice against bots">Practice vs bots</button>
      </div>${tabs()}`,
  },
  {
    id: 'C10', name: 'SEAT OPEN',
    cuts: 'wordmark size, tagline, selector, config, bonus, invite, bug',
    promotes: 'urgency plus multiplayer in one image — three seats taken, one empty, and it is yours',
    body: () => `${topbar()}
      <div class="pad">
        <div class="seats" role="img" aria-label="A table with three players seated and one seat open">
          ${['👤', '👤', '👤'].map((s) => `<span class="seat">${s}</span>`).join('')}
          <span class="seat open">+</span>
        </div>
        ${miniTable(150)}
        <p class="under">Your seat is open.</p>
        <button class="cta big mint" aria-label="Take the open seat">TAKE THE SEAT</button>
      </div>${tabs()}`,
  },
];
