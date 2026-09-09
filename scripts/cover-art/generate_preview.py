"""
Render the FB cover with the real avatar overlap zone marked, plus a small-size
version, so the safe-area claim can be looked at rather than trusted.

Avatar position sourced from the numbers verified via WebSearch this sprint:
desktop profile picture ~168x168, overlapping the bottom-left corner, vertically
centered on the cover's bottom edge, with a small left margin. Canvas here is
851x315 (~ same as the 820x312 desktop display), so the same pixel figures apply
directly without rescaling.
"""
from PIL import Image, ImageDraw

SRC = r"C:\Projects\POKER\Caps\docs\cover-art-2026-09-09\facebook-cover-851x315.png"
OUT_OVERLAY = r"C:\Projects\POKER\Caps\docs\cover-art-2026-09-09\facebook-cover-with-avatar-overlay.png"
OUT_SMALL = r"C:\Projects\POKER\Caps\docs\cover-art-2026-09-09\facebook-cover-phone-size-390w.png"

img = Image.open(SRC).convert("RGBA")
W, H = img.size

overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)

avatar_d = 168
avatar_left_margin = 24
cx = avatar_left_margin + avatar_d // 2
cy = H  # vertical center sits on the cover's bottom edge (half overlaps, half below)

od.ellipse(
    [cx - avatar_d // 2, cy - avatar_d // 2, cx + avatar_d // 2, cy + avatar_d // 2],
    outline=(255, 0, 0, 255), width=4, fill=(255, 0, 0, 60),
)
od.text((cx - avatar_d // 2, cy - avatar_d // 2 - 20), "profile pic zone (desktop)", fill=(255, 80, 80, 255))

# Mobile side-crop guide: ~90px shaved off each side per the researched figures.
od.line([(90, 0), (90, H)], fill=(255, 255, 0, 180), width=2)
od.line([(W - 90, 0), (W - 90, H)], fill=(255, 255, 0, 180), width=2)
od.text((94, 4), "mobile crop line", fill=(255, 255, 0, 255))

composited = Image.alpha_composite(img, overlay).convert("RGB")
composited.save(OUT_OVERLAY, "PNG")
print("wrote", OUT_OVERLAY)

small = Image.open(SRC).convert("RGB").resize((390, int(390 * H / W)), Image.LANCZOS)
small.save(OUT_SMALL, "PNG")
print("wrote", OUT_SMALL)
