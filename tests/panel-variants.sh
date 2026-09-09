#!/usr/bin/env bash
# FOUR REAL BUILDS. Patch the panel tokens, export, revert — nothing here is committed as a
# product change. Each variant is a genuine `expo export`, because the questions this sprint asks
# (what happens to the slot outlines, the card back, the felt behind) only have answers inside the
# real component tree.
#
# THE DOUBLE PAINT. On web the panel is painted TWICE — once by the container's CSS
# `linear-gradient` (Board.tsx ~660) and once by the absolute-fill <LinearGradient> child
# (~683) — at different angles, both at the token's ~0.55 alpha. Effective opacity is therefore
# 1-(1-0.55)^2 = 0.80, not 0.55. Every variant below removes the duplicate web layer so that the
# alpha written in the token is the alpha that renders; without that, a variant would be measuring
# a number it does not actually have. P0 is the untouched control and keeps the double paint, and
# P0S isolates the double paint alone (today's tokens, single layer) so its cost is separable from
# any colour choice.
set -euo pipefail
cd "$(dirname "$0")/.."

PT=constants/paintThemes.ts
BD=components/Board.tsx
BAK=$(mktemp -d)
cp "$PT" "$BAK/paintThemes.ts"
cp "$BD" "$BAK/Board.tsx"
restore() { cp "$BAK/paintThemes.ts" "$PT"; cp "$BAK/Board.tsx" "$BD"; }
trap restore EXIT

# Remove the duplicate web CSS gradient, leaving the <LinearGradient> child as the sole painter —
# which is exactly what native already does, so this makes web match native rather than inventing
# a third behaviour.
drop_double_paint() {
  python3 - "$BD" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf8').read()
old = "          background: `linear-gradient(165deg, ${theme.boardPanelTop} 0%, ${theme.boardPanelBottom} 100%)`,\n"
assert s.count(old) == 1, f"expected 1 web gradient, found {s.count(old)}"
open(p, 'w', encoding='utf8').write(s.replace(old, ""))
PY
}

set_panel() { # $1=top $2=bottom
  python3 - "$PT" "$1" "$2" <<'PY'
import sys
p, top, bot = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf8').read()
a = s.count("boardPanelTop: '#1C1F268C'")
b = s.count("boardPanelBottom: '#1012188C'")
assert a == 2 and b == 2, f"expected 2 each (classic+fiveo), found {a}/{b}"
s = s.replace("boardPanelTop: '#1C1F268C'", f"boardPanelTop: '{top}'")
s = s.replace("boardPanelBottom: '#1012188C'", f"boardPanelBottom: '{bot}'")
open(p, 'w', encoding='utf8').write(s)
PY
}

build() { # $1=label
  rm -rf "web-$1-dist"
  npx expo export -p web --output-dir "web-$1-dist" >/dev/null 2>&1
  echo "  built web-$1-dist"
}

echo "P0  control — today, untouched (double paint, effective ~0.80)"
restore; build p0

echo "P0S isolation — today's tokens, single paint (0.55 as written)"
restore; drop_double_paint; build p0s

# V1 MORE TRANSPARENT — the felt reads clearly through. 0x40 = 64/255 = 0.251.
echo "V1  more transparent — same obsidian tint at 0.25"
restore; drop_double_paint; set_panel '#1C1F2640' '#10121840'; build v1

# V2 FULLY TRANSPARENT — the felt is the board's own ground; only the rail and the slot
# outlines remain. Alpha 00 rather than removing the element, so the layout is provably identical.
echo "V2  fully transparent — rail and slots only"
restore; drop_double_paint; set_panel '#1C1F2600' '#10121800'; build v2

# V3 LIGHTER TINT — still a panel, but not a dark box. The tint moves to the FELT'S OWN HUE
# (144.5deg, the shipped surface) rather than obsidian grey: a grey scrim at higher lightness
# desaturates the green it sits on, which defeats the purpose of having a felt. rgb(40,74,56) is
# the felt's hue lifted; 0x73 = 115/255 = 0.451.
echo "V3  lighter tint — felt-hued, 0.45"
restore; drop_double_paint; set_panel '#284A3873' '#1E3A2C73'; build v3

restore
echo "done — sources restored"
git diff --stat "$PT" "$BD"

# V4 LIGHTER PANEL, DONE PROPERLY. V3 above tints the panel with the FELT'S OWN HUE and lands at
# rgb(29,61,44) against V2's rgb(24,60,39) — five parts in 255. It stopped looking like a dark box
# and stopped reading as a panel at the same time, which is not the option the brief asked for. A
# panel only reads as a panel if it differs from the felt in LIGHTNESS; toward the felt is a no-op,
# so this goes ABOVE it — a raised area of table rather than a scrim laid over it.
if [ "${WITH_V4:-}" = "1" ]; then
  echo "V4  raised panel — lighter THAN the felt, 0.18"
  restore; drop_double_paint; set_panel '#8FB5A02E' '#7FA4902E'; build v4
  restore
fi
