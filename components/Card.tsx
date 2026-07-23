import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { rs } from '../utils/responsive';
import { PRD } from '../utils/prdTokens';
import { useGameStore } from '../store/gameStore';
import { Card as CardType } from '../constants/gameConfig';
import { DEFAULT_CARD_THEME } from '../constants/cardThemes';
import { OBSIDIAN, OBSIDIAN_GEOM, cardLiftShadow, cardLiftShadowSmall, cardBackShadow } from '../constants/obsidianTheme';
import { LinearGradient } from 'expo-linear-gradient';

// Card Display Bible (V2+ — rewritten 2026-07-23, CARD-FACE batch). The old S81 version was STALE:
// it still said "NO corners / large centered RANK" long after V2 shipped a top-left corner +
// centre-SUIT-only (no centre rank) on 2026-05-23. Keep THIS in sync with the code; don't
// resurrect the old rules. Update deliberately when the face changes.
//   DEFAULT face  (cardTheme === 'v1'):
//     - top-left corner (rank + suit) + ONE large centre SUIT, no centre rank
//     - sizes (width-based, utils/prdTokens.ts): cornerRank *0.30, cornerSuit *0.22, centerSuit *0.55
//   UPGRADED face (cardTheme !== 'v1' — opt-in via the Batch-B-preserved cardTheme mechanism).
//   v3.1 panel tunings, all size gates are named constants at the top of this file:
//     - centre suit centerSuitBig *0.64. CORNER GLYPHS DELIBERATELY UNTOUCHED — the corner is the
//       legibility workhorse at 40px, and we do not move two legibility variables in one change.
//     - bottom-right index (rotated 180°) only at width >= DOUBLE_CORNER_MIN_W (54) => 3P/4P yes, 2P no.
//     - ownership RIM (not an aura): 0 0 6px rgba(58,214,255,0.30), spread 0, PLAYER cards only,
//       gated by owner + ZONE (hand/reveal glow, board-placed does NOT) — NEVER by width, because
//       hand and board cards are the same width (see the measured width map below). One-time 250ms
//       ease-out deal-in pulse (0.5 -> 0.30) then STATIC — no loops, no reanimation on re-render,
//       driven by ONE shared Animated.Value for all cards (never one animator per card). Carried by
//       the outer wrapper so it can coexist with the depth shadow (iOS = one shadow per view).
//       Web/Android render the SAME 0.30 resting rim; only the pulse is skipped (no old 0.5 aura).
//     - depth tiered at DEPTH_RICH_MIN_W: above = gradient #FDFCF7->#F3EEDF + warm two-tier shadow;
//       at/below = inset top highlight ONLY.
//     - card OUTER size/position/hitbox is IDENTICAL to the default — internal graphics only (Iron Rule).
//   - 3D flip: RN Animated only — ZERO Reanimated.
//
//   LOGGED FOLLOW-UPS (raised by the v3.1 panel, deliberately NOT in this batch):
//     1. Shrinking the CORNER SUIT alongside the centre bump — refused here to avoid moving two
//        legibility variables at once. Candidate for a later, isolated legibility pass.
//     2. Evicting gold #c9a84c from the "selected/placed" state. The incoherence is real (gold
//        serves brand AND selection simultaneously — ~70 uses; the brand accent proper is mint
//        #4FD6A8, ~59 uses), so your own card appears to change team colour on placement. That is
//        a placement-screen-wide colour change and needs its own batch + before-audit, after the
//        face lands.

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  small?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  flipDuration?: number;
  cardWidth?: number;
  cardHeight?: number;
  themeOverride?: string; // kept for prop compatibility
  suitsOnly?: boolean;
  isCommunityCard?: boolean;
  /** CARD-FACE batch — whose card this is. Drives the ALWAYS-cyan ownership glow on the UPGRADED
   *  face (player = cyan glow, bot/undefined = none). Ignored on the default face. */
  owner?: 'player' | 'bot';
  /** Where this card is rendered. Gates the ownership rim: 'board' (placed/committed) never glows,
   *  'hand' and 'reveal' do. Deliberately a DENYLIST (zone !== 'board') so a new player-card site
   *  that forgets the prop still shows the ownership cue rather than silently losing it. */
  zone?: 'hand' | 'board' | 'reveal';
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const RED_COLOR = '#CC0000';
const BLACK_COLOR = '#111111';
const CARD_BACK_BG = '#1A1A2E';
const CARD_BACK_BORDER = '#C5A028';

// ── S-CARD-BACK — the "C" back (Variant B) ────────────────────────────────────
// The card back is ALWAYS on, in every theme, so its palette is the classic CAPS
// black/gold (NOT the streetStencil spray-yellow, which would clash on classic and
// wouldn't match the gold wordmark on Home). Values are local to the back — this
// batch touches colour/graphics only, no theme wiring.
const CARD_BACK_C_BG = '#18181c';                     // charcoal
const CARD_BACK_C_GOLD = '#c9a84c';                   // the "C" + edge ring
const CARD_BACK_C_RING = 'rgba(201,168,76,0.28)';     // inner circle, low-alpha gold
const CARD_BACK_C_EDGE = 'rgba(201,168,76,0.5)';      // inset edge ring
const CARD_BACK_C_GLOW = 'rgba(201,168,76,0.55)';     // soft glow on the C
// FONT RULING A: Bangers is NOT bundled (0 font files, expo-font never imported).
// Ship on the platform's heaviest system face now; when the font-infra batch bundles
// Bangers, this ONE constant becomes 'Bangers' and the C upgrades with a one-line swap.
// On native, `fontFamily: undefined` + fontWeight '900' = the system heavy face.
const CARD_BACK_FONT = Platform.select<string | undefined>({
  web: 'Arial Black, Impact, sans-serif',
  default: undefined,
});

// V2 Minimalist palette
const V2_RED = '#c41e3a';
const V2_BLACK = '#18181b';

// CARD-FACE batch — the ownership glow: ALWAYS cyan, theme-independent (never getTheme). Applied
// ONLY to the player's cards on the UPGRADED face so the player instantly reads which are theirs.
// CARD-FACE v3.1 (panel tunings) — every size gate is a NAMED constant, never a magic number.
// NOTE the cyan is NOT "the existing cyan": the brand accent is mint #4FD6A8. rgba(58,214,255,*)
// also exists in the bundle as streetStencil's DORMANT cardGlow token (S76, unconsumed) — this
// ownership rim is a separate, deliberate use of the same hue.
const GLOW_REST_ALPHA = 0.30;   // resting rim alpha (ownership cue, not an aura)
const GLOW_PEAK_ALPHA = 0.5;    // deal-in pulse peak, decays once to GLOW_REST_ALPHA
const GLOW_BLUR_PX = 6;         // tight rim, spread 0
const GLOW_PULSE_MS = 250;      // one-time ease-out on deal-in; no loops, no re-trigger
// v3.2 — MEASURED CARD-WIDTH MAP (393pt phone, rendered, not assumed). Width is ONE number per
// player count: VAMOS-UNIFY-CARD-SIZE makes a single universal CARD_W the authority for the hand,
// the slots AND the community, so hand and board cards are ALWAYS the same width:
//     2P (4 boards) = 40px   3P (3 boards) = 54px   4P (2 boards) = 65px   (65 = max possible)
// CONSEQUENCE: width CANNOT separate "hand" from "board-placed" — the proposed GLOW_MIN_W=48 proxy
// would have silently killed the glow on the 2P HAND (40px), the exact opposite of the intent.
// The glow is therefore gated by owner + ZONE (see CardProps.zone), never by width. No GLOW_MIN_W.
const DOUBLE_CORNER_MIN_W = 54; // bottom-right index renders at/above this width => 3P+4P yes, 2P (40px) no
const DEPTH_RICH_MIN_W = 48;    // above: gradient + warm two-tier shadow. at/below: inset highlight only
const CARD_GLOW_CYAN = `rgba(58,214,255,${GLOW_REST_ALPHA})`;
const GLOW_RGB = '#3ad6ff';

// v3.2 PULSE ARCHITECTURE — ONE shared driver for every card on screen, not one animator per card.
// A per-card Animated.Value would mean 12-16 concurrent animators on the hand (old-iPhone jank and
// a breach of the shared-animated-values budget). All glowing cards read this single value; the
// first card to mount after a deal starts the pulse and the rest ride it. The window guard keeps a
// 16-card mount burst from restarting the animation 16 times.
const sharedGlowAlpha = new Animated.Value(GLOW_REST_ALPHA);
let _lastGlowPulseAt = 0;
function triggerSharedGlowPulse() {
  const now = Date.now();
  if (now - _lastGlowPulseAt < GLOW_PULSE_MS * 2) return; // one pulse per deal, not per card
  _lastGlowPulseAt = now;
  sharedGlowAlpha.setValue(GLOW_PEAK_ALPHA);
  Animated.timing(sharedGlowAlpha, {
    toValue: GLOW_REST_ALPHA,
    duration: GLOW_PULSE_MS,
    easing: Easing.out(Easing.quad),
    useNativeDriver: false, // shadowOpacity is not native-driver safe
  }).start();
}

const SUIT_COLORS_4: Record<string, string> = {
  hearts:   '#E8192C',
  diamonds: '#1565C0',
  spades:   '#1a1a2e',
  clubs:    '#228B22',
};

const SUIT_COLORS_4_FIVEO: Record<string, string> = {
  hearts:   '#E8192C',
  diamonds: '#1565C0',
  spades:   '#1a1a2e',
  clubs:    '#006644',
};

function CardComponent({
  card,
  faceDown = false,
  small,
  highlighted,
  dimmed,
  flipDuration = 800,
  cardWidth,
  cardHeight,
  suitsOnly = false,
  isCommunityCard = false,
  owner,
  zone,
}: CardProps) {
  // VAMOS-HAND-FIX-FINAL 2026-06-15 — when an EXPLICIT cardWidth is provided
  // (placement hand path: PlayerHand passes a measure-then-size value), it is
  // authoritative. Only a tiny absolute safety floor (16) applies. This unblocks
  // the bc=4 16-card hand from clipping at narrow viewports without changing
  // other Card usages (Card-default path keeps the original 44/62 tap-target
  // floor; community-card path keeps 24/34).
  const _minW = isCommunityCard ? 24 : 44;
  const _minH = isCommunityCard ? 34 : 62;
  const _explicitFloorW = isCommunityCard ? 24 : 16;
  const _explicitFloorH = isCommunityCard ? 34 : 22;
  const width = cardWidth != null
    ? Math.max(_explicitFloorW, cardWidth)
    : Math.max(small ? rs(52) : rs(58), _minW);
  const height = cardHeight != null
    ? Math.max(_explicitFloorH, cardHeight)
    : Math.max(small ? rs(74) : rs(82), _minH);
  const fourColorSuits = useGameStore((s) => s.fourColorSuits);
  const visualTheme = useGameStore((s) => s.visualTheme);
  const cardConfig = useGameStore((s) => s.cardConfig);
  // CARD-FACE batch — the upgraded face is OPT-IN via cardTheme (mechanism preserved in Batch B).
  // Default (DEFAULT_CARD_THEME = 'v1') renders the CURRENT face byte-identically; any other value
  // opts into the upgraded face: enriched depth + bigger centre suit + double corners + owner glow.
  const cardTheme = useGameStore((s) => s.cardTheme);
  const isUpgraded = cardTheme !== DEFAULT_CARD_THEME;
  // v3.2 — ownership RIM gated by owner + ZONE, never by width. Width is the same number for hand
  // and board cards (see the measured width map above), so it cannot express "these are in my hand".
  // Board-PLACED cards are player-owned but already committed, so they carry no rim.
  const showOwnerGlow = isUpgraded && owner === 'player' && zone !== 'board' && !faceDown;
  // One-time deal-in pulse off the SHARED driver. Empty deps = fires once per MOUNT (deal-in),
  // never on re-render; the guard inside collapses a 16-card mount burst into a single animation.
  useEffect(() => {
    if (showOwnerGlow) triggerSharedGlowPulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Card sizing — width-based (S80/S81 Card Bible)
  const mainRankRatio = cardConfig?.main_rank_size_ratio ?? 0.46;
  const mainSuitRatio = cardConfig?.main_suit_size_ratio ?? 0.34;
  // PR-N 2026-06-02 — font floor relaxed for community cards (rank 20->10, suit 14->8)
  // so they fit inside the smaller 24x34 card box without overflowing the rank text.
  const _rankFloor = isCommunityCard ? 10 : 20;
  const _suitFloor = isCommunityCard ? 8  : 14;
  const centerRankSize = Math.max(_rankFloor, Math.floor(width * mainRankRatio));
  const centerSuitSize = Math.max(_suitFloor, Math.floor(width * mainSuitRatio));

  // 3D flip — RN Animated only, ZERO Reanimated (S81)
  // flipAnim: 0 = face-down (back visible), 1 = face-up (front visible)
  const flipAnim = useRef(new Animated.Value(faceDown ? 0 : 1)).current;
  // Glow lift — native driver (transform only)
  const glowAnim = useRef(new Animated.Value(highlighted ? 1 : 0)).current;
  // Float idle animation REMOVED 2026-05-22 — see KILL_Card in utils/animationKill.ts.
  // Was: infinite Animated.loop on translateY making every card bob up/down forever.
  // Iron rule (per battle-pass.tsx comment): never Animated.loop without finite iterations.

  const prevFaceDownRef = useRef(faceDown);

  useEffect(() => {
    if (prevFaceDownRef.current === true && !faceDown && card) {
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: flipDuration,
        useNativeDriver: true,
      }).start();
    } else {
      flipAnim.setValue(faceDown ? 0 : 1);
    }
    prevFaceDownRef.current = faceDown;
  }, [faceDown]);

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: highlighted ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [highlighted]);

  // Float loop useEffect REMOVED 2026-05-22 — see KILL_Card.

  // Back face: rotates 0deg to 90deg during first half, then opacity 0
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  // Front face: hidden first half, rotates -90deg to 0deg during second half
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  // Glow: scale up + lift (native driver)
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const glowTranslateY = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  // floatY interpolation REMOVED 2026-05-22 — see KILL_Card.

  // S-CARD-BACK (Variant B) — "ring + bold C". Flat charcoal, a low-alpha gold ring,
  // and a heavy gold "C" with a soft glow. ALWAYS on, every theme (classic black/gold,
  // not spray-yellow). GRAPHICS ONLY: width/height/radius are the card's existing
  // frozen geometry; nothing here changes size, position, or the shadow tier.
  const renderBack = () => {
    // Everything scales off min(width,height) — the confirmed anchor — so the back
    // reads at both ~40px board backs and large hole cards, never a fixed px.
    const anchor = Math.min(width, height);
    const cSize = Math.max(12, Math.floor(anchor * 0.5));
    const ringD = Math.max(18, Math.floor(anchor * 0.72));
    const ringBorder = Math.max(2, Math.round(anchor * 0.05));
    const cardStyle: any[] = [
      {
        width,
        height,
        backgroundColor: CARD_BACK_C_BG,
        borderRadius: OBSIDIAN_GEOM.cardBackRadius,
        borderWidth: 2,
        borderColor: CARD_BACK_C_EDGE,
        overflow: 'hidden' as const,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      cardBackShadow,
    ];

    return (
      <View style={cardStyle}>
        {/* Inner low-alpha gold ring, centered */}
        <View
          style={{
            position: 'absolute',
            width: ringD,
            height: ringD,
            borderRadius: ringD / 2,
            borderWidth: ringBorder,
            borderColor: CARD_BACK_C_RING,
          }}
          pointerEvents="none"
        />
        {/* The bold gold "C" — heavy system weight now; CARD_BACK_FONT becomes
            'Bangers' in a one-line swap once the font-infra batch bundles it. */}
        <Text
          allowFontScaling={false}
          style={{
            color: CARD_BACK_C_GOLD,
            fontSize: cSize,
            fontWeight: '900',
            fontFamily: CARD_BACK_FONT,
            lineHeight: Math.round(cSize * 1.02),
            textShadowColor: CARD_BACK_C_GLOW,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          }}
          pointerEvents="none"
        >
          C
        </Text>
      </View>
    );
  };

  const faceUpShadow = isCommunityCard
    ? Platform.select({
        ios: {} as any, // iOS shadow handled by highlightShadow for community
        android: { elevation: 10 } as any,
        default: { boxShadow: '0 0 12px rgba(201,168,76,0.4)' } as any,
      })
    : visualTheme === 'fiveo'
    ? Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.65, shadowRadius: 10 } as any,
        android: { elevation: 10 } as any,
        default: { boxShadow: '2px 4px 14px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.15)' } as any,
      })
    : Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12 } as any,
        android: { elevation: 14 } as any,
        default: { boxShadow: '0 8px 24px rgba(0,0,0,0.55)' } as any,
      });

  // VAMOS-VISUAL-C — lifted face-up: cardLiftShadow for normal/hand/slot cards,
  // cardLiftShadowSmall for community/bc=4 cards (legibility+perf gate D1/D2).
  const v2Shadow = width < 40 ? cardLiftShadowSmall : cardLiftShadow;
  // v3.1 DEPTH, tiered (UPGRADED face ONLY — the default face keeps v2Shadow byte-identical):
  //   width  > DEPTH_RICH_MIN_W : gradient + warm two-tier shadow
  //   width <= DEPTH_RICH_MIN_W : inset top highlight ONLY — no gradient, no multi-layer shadow
  // iOS renders ONE shadow per view, so the two-tier stack is approximated by its dominant tier.
  const isRichDepth = isUpgraded && width > DEPTH_RICH_MIN_W;
  const upgradedDepthShadow = !isUpgraded
    ? v2Shadow
    : isRichDepth
      ? Platform.select({
          ios: { shadowColor: '#281E0A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 4 } as any,
          default: { boxShadow: '0 1px 2px rgba(40,30,10,0.25), 0 3px 8px rgba(40,30,10,0.18)' } as any,
        })
      : {}; // light tier — the inset top highlight alone carries the lift cue

  // v3.1 GLOW — a TIGHT RIM (spread 0) carried by the OUTER wrapper, not the face, so it coexists
  // with the depth shadow above (both on the face would force iOS to drop one). The wrapper is
  // sized exactly to the card and painted the card colour so iOS has an opaque surface to cast
  // from; the face covers it completely, so nothing shows through. Shadows never affect layout,
  // so the card's outer footprint is unchanged.
  const ownerGlowWrapStyle = showOwnerGlow
    ? [
        { backgroundColor: OBSIDIAN.cardFaceFallback, borderRadius: OBSIDIAN_GEOM.cardRadius },
        Platform.select({
          ios: {
            shadowColor: GLOW_RGB,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: GLOW_BLUR_PX / 2,
            shadowOpacity: sharedGlowAlpha, // ONE shared driver for every glowing card
          } as any,
          // Web/Android: static resting rim — boxShadow cannot take an Animated value. The pulse is
          // an iOS-device concern (that's the eye-test surface); static keeps web measurement exact.
          default: { boxShadow: `0 0 ${GLOW_BLUR_PX}px ${CARD_GLOW_CYAN}` } as any,
        }),
      ]
    : null;
  const v2Border = highlighted
    ? { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' as const }
    : { borderWidth: 0 };

  if (!card) {
    return (
      <Animated.View
        style={[
          { width, height },
          { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
        ]}
      >
        {renderBack()}
      </Animated.View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const activeSuitColors4 = visualTheme === 'fiveo' ? SUIT_COLORS_4_FIVEO : SUIT_COLORS_4;
  const suitColor = fourColorSuits ? (activeSuitColors4[card.suit] ?? BLACK_COLOR) : (isRed ? RED_COLOR : BLACK_COLOR);
  const suitBorderColor = isRed ? 'rgba(211,47,47,0.28)' : 'rgba(80,80,80,0.22)';
  const isFaceCard = ['J', 'Q', 'K', 'A'].includes(card.rank);

  // 2026-05-23: V2 layout (corner pip + dominant center suit, no center rank) is
  // now the only path — the legacy "3-corner-pip + center-rank+center-suit overlap"
  // branch was producing a cluttered card where the small corner suit was visually
  // hidden behind the large center suit. Force isV2=true; the legacy `: ( … )` else
  // branch below is removed.
  const isV2 = true;
  const v2SuitColor = isRed ? V2_RED : V2_BLACK;

  // VAMOS-THEME-PROPAGATION C2/C3 — Gold KEPT only for the winning-card highlight.
  // Community frame → MINT (obsidian inner-detail rule). Face-card prestige border
  // → mint hairline. Highlighted (winning) stays #c9a84c gold.
  const highlightBorder = highlighted
    ? { borderWidth: 2.5, borderColor: '#c9a84c' as const }                   // WINNING — gold
    : isCommunityCard
    ? { borderWidth: rs(2.5), borderColor: OBSIDIAN.mint }                    // community frame — mint
    : isFaceCard
    ? { borderWidth: 1.5, borderColor: OBSIDIAN.mintHairline }                // face-card prestige — mint hairline
    : { borderWidth: 1, borderColor: suitBorderColor };
  const highlightShadow = highlighted && Platform.OS === 'ios'
    ? { shadowColor: '#c9a84c', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 14 }
    : isCommunityCard && Platform.OS === 'ios'
    ? { shadowColor: OBSIDIAN.mint, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8 }
    : {};

  return (
    // Animated.View (not View) so the ownership rim's shadowOpacity can carry the deal-in pulse.
    // Identical layout/footprint to the plain View it replaces.
    <Animated.View style={[{ width, height }, ownerGlowWrapStyle]}>
      {/* Back face — 3D flip */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, width, height },
          { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
          { opacity: backOpacity },
        ]}
      >
        {renderBack()}
      </Animated.View>

      {/* Front face — 3D flip + glow lift */}
      <Animated.View
        style={[
          styles.card,
          {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width,
            height,
            // VAMOS-VISUAL-C — near-white with faint cream undertone, sharper radius (8 vs 10).
            backgroundColor: isV2 ? OBSIDIAN.cardFaceFallback : '#FFFEF8',
            borderRadius: isV2 ? OBSIDIAN_GEOM.cardRadius : 8,
          },
          // VAMOS-VISUAL-C-FINISH — solid bg kept as fallback; the LinearGradient child
          // below renders the true cream gradient on native AND web.
          !isV2 && Platform.OS === 'web' && { background: 'linear-gradient(160deg, #ffffff 0%, #f5f5f0 100%)' } as any,
          isV2 ? upgradedDepthShadow : faceUpShadow,
          isV2 ? v2Border : highlightBorder,
          !isV2 && highlightShadow,
          dimmed && styles.dimmed,
          {
            transform: [
              { perspective: 1000 },
              { rotateY: frontRotateY },
              { scale: glowScale },
              { translateY: glowTranslateY },
              // { translateY: floatY } removed 2026-05-22 — see KILL_Card
            ],
            opacity: frontOpacity,
          },
        ]}
      >
        {/* VAMOS-VISUAL-C-FINISH — true cream gradient (native + web), borderRadius on the
            gradient itself so we don't need overflow:hidden on the shadowed Animated.View. */}
        {/* v3.1 — on the UPGRADED face the gradient is part of the RICH depth tier only; at/below
            DEPTH_RICH_MIN_W the inset top highlight carries the lift alone. Default face unchanged. */}
        {isV2 && (!isUpgraded || isRichDepth) && (
          <LinearGradient
            colors={isUpgraded ? ['#FDFCF7', '#F3EEDF'] : [OBSIDIAN.cardFaceTop, OBSIDIAN.cardFaceBottom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: OBSIDIAN_GEOM.cardRadius }]}
            pointerEvents="none"
          />
        )}
        {/* Subtle depth gradient — native only */}
        {Platform.OS !== 'web' && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: 0.025, top: '65%', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }]} pointerEvents="none" />
        )}
        {/* VAMOS-VISUAL-C — 1px inset top highlight for lift cue */}
        {isV2 && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 1,
              right: 1,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderTopLeftRadius: OBSIDIAN_GEOM.cardRadius,
              borderTopRightRadius: OBSIDIAN_GEOM.cardRadius,
              opacity: isUpgraded ? 0.95 : 0.7,
            }}
            pointerEvents="none"
          />
        )}
        {suitsOnly ? (
          <View style={styles.suitBottomLeft}>
            <Text style={[styles.suitOnlyText, {
              color: suitColor,
              fontSize: Math.floor(height * 0.44),
              textShadowColor: isRed ? 'rgba(211,47,47,0.35)' : 'rgba(255,255,255,0.2)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 4,
            }]}>
              {SUIT_SYMBOLS[card.suit]}
            </Text>
          </View>
        ) : isV2 ? (
          <>
            {/* top-left corner */}
            <View style={styles.cornerTopLeft} pointerEvents="none">
              <Text allowFontScaling={false} style={[styles.v2CornerRank, { color: v2SuitColor, fontSize: PRD.card.cornerRank(width), lineHeight: Math.round(PRD.card.cornerRank(width) * 1.1) }]}>{card.rank}</Text>
              <Text allowFontScaling={false} style={[styles.v2CornerSuit, { color: v2SuitColor, fontSize: PRD.card.cornerSuit(width), lineHeight: Math.round(PRD.card.cornerSuit(width) * 1.1) }]}>{SUIT_SYMBOLS[card.suit]}</Text>
            </View>
            {/* CARD-FACE batch — bottom-right corner (UPGRADED face only; rotated 180° like a real card) */}
            {/* v3.1 — size-gated: the bottom-right index is suppressed below DOUBLE_CORNER_MIN_W,
                where it would crowd the centre suit and cost legibility rather than add realism. */}
            {isUpgraded && width >= DOUBLE_CORNER_MIN_W && (
              <View style={[styles.cornerBottomRight, { transform: [{ rotate: '180deg' }] }]} pointerEvents="none">
                <Text allowFontScaling={false} style={[styles.v2CornerRank, { color: v2SuitColor, fontSize: PRD.card.cornerRank(width), lineHeight: Math.round(PRD.card.cornerRank(width) * 1.1) }]}>{card.rank}</Text>
                <Text allowFontScaling={false} style={[styles.v2CornerSuit, { color: v2SuitColor, fontSize: PRD.card.cornerSuit(width), lineHeight: Math.round(PRD.card.cornerSuit(width) * 1.1) }]}>{SUIT_SYMBOLS[card.suit]}</Text>
              </View>
            )}
            {/* large center suit — bigger on the UPGRADED face (default keeps *0.55, byte-identical) */}
            <View style={styles.centerDisplay}>
              <Text allowFontScaling={false} style={[styles.v2CenterSuit, { color: v2SuitColor, fontSize: isUpgraded ? PRD.card.centerSuitBig(width) : PRD.card.centerSuit(width) }]}>
                {SUIT_SYMBOLS[card.suit]}
              </Text>
            </View>
          </>
        ) : null /* Legacy non-V2 branch removed 2026-05-23 — isV2 is now always true */}
      </Animated.View>
    </Animated.View>
  );
}

// VAMOS-FIX-RESULTS-RENDER 2026-06-17 — memo'd so 36 cards on the results
// screen don't re-render on every parent state update (chip roll-up, board
// stagger, achievement toasts).
export default React.memo(CardComponent);

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: rs(3),
    left: rs(4),
    alignItems: 'center',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 4,
    right: 5,
    alignItems: 'center',
  },
  cornerRank: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  cornerSuit: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
    marginTop: -1,
  },
  centerDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRankText: {
    fontWeight: '900',
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Arial Black, Arial, sans-serif' } as any,
      default: {},
    }),
  },
  centerSuitText: {
    fontWeight: '700',
    marginTop: -6,
  },
  backCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backDiamond: {
    color: '#c9a84c',
    opacity: 0.3,
  },
  dimmed: {
    opacity: 0.35,
  },
  suitBottomLeft: {
    position: 'absolute',
    bottom: 4,
    left: 6,
  },
  suitOnlyText: {
    fontWeight: '700',
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Arial Black, Arial, sans-serif' } as any,
      default: {},
    }),
  },
  // V2 Minimalist styles
  v2CornerRank: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 22,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
  v2CornerSuit: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 16,
    marginTop: 2,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
  v2CenterSuit: {
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: undefined,
    ...Platform.select({
      web: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' } as any,
      default: {},
    }),
  },
});
