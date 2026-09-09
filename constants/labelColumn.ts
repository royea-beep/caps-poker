import type { ViewStyle } from 'react-native';

/**
 * THE TEXT COLUMN IN AN ICON · LABEL · CHEVRON ROW.
 *
 * Six screens independently wrote `<View style={{ flex: 1 }}>` around two Texts, between a fixed
 * leading glyph and a fixed trailing chevron. That arrangement renders differently on the two
 * platforms, and the difference is silent:
 *
 *   `flex: 1` is `flexGrow:1, flexShrink:1, flexBasis:0` — "start from zero width and grow into
 *   what is left". CSS then rescues it anyway, because a flex item defaults to `min-width: auto`
 *   and refuses to shrink below its min-content width: on web the words always survive and the
 *   ROW overflows instead. Yoga has no such floor — its flex items shrink to 0.
 *
 * So when the row is over-constrained (a narrow device, or iOS Dynamic Type inflating the glyphs,
 * which web ignores entirely), web keeps the label and native drops it, leaving the icon and the
 * chevron with nothing between them. Which is what was photographed on TestFlight.
 *
 * `flexBasis: 'auto'` starts the column at its content width, so growing is the only thing left
 * for it to do. On web the rendering is unchanged in both the fitting and the over-constrained
 * case, which is why the visual baselines do not move.
 *
 * Use this instead of `{ flex: 1 }` for any text column that sits between fixed-size siblings.
 */
export const LABEL_COLUMN: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' };
