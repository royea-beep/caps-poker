"""
Generate Caps Poker app icon — 1024x1024px
Black bg, gold C letter, 4 suit symbols at corners, gold ring border
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
BG = (10, 10, 10)
GOLD = (201, 168, 76)
RED = (180, 50, 50)

img = Image.new('RGBA', (SIZE, SIZE), BG + (255,))
draw = ImageDraw.Draw(img)

# Solid dark background
draw.rectangle([0, 0, SIZE, SIZE], fill=BG + (255,))

cx = SIZE // 2
cy = SIZE // 2

# ── Gold "C" as thick arc ───────────────────────────────────────────────────
outer_r = 245
inner_r = 168
gap_angle = 52   # degrees opening on right side

draw.pieslice(
    [cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r],
    start=gap_angle, end=360 - gap_angle,
    fill=GOLD
)
draw.ellipse(
    [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
    fill=BG + (255,)
)

# Round caps at top and bottom opening
mid_r = (outer_r + inner_r) // 2
cap_r = (outer_r - inner_r) // 2 + 4

for angle_deg in [gap_angle, 360 - gap_angle]:
    angle = math.radians(angle_deg)
    cap_x = cx + int(mid_r * math.cos(angle))
    cap_y = cy + int(mid_r * math.sin(angle))
    draw.ellipse(
        [cap_x - cap_r, cap_y - cap_r, cap_x + cap_r, cap_y + cap_r],
        fill=GOLD
    )

# ── Suit symbols at corners ─────────────────────────────────────────────────
suit_data = [
    (200, 200, 'spade',   GOLD),
    (824, 200, 'heart',   RED),
    (824, 824, 'diamond', RED),
    (200, 824, 'club',    GOLD),
]

def draw_spade(d, x, y, s, col):
    # Triangle pointing up + two bumps at bottom + stem
    pts = [(x, y - s), (x + s, y + s//2), (x - s, y + s//2)]
    d.polygon(pts, fill=col)
    d.ellipse([x - s, y - s//4, x, y + s//2], fill=col)
    d.ellipse([x, y - s//4, x + s, y + s//2], fill=col)
    d.rectangle([x - s//5, y + s//2, x + s//5, y + s], fill=col)
    d.ellipse([x - s//2, y + s//2, x + s//2, y + s + s//4], fill=col)

def draw_heart(d, x, y, s, col):
    d.ellipse([x - s, y - s//2, x, y + s//2], fill=col)
    d.ellipse([x, y - s//2, x + s, y + s//2], fill=col)
    pts = [(x - s, y + s//6), (x, y + s * 4//3), (x + s, y + s//6)]
    d.polygon(pts, fill=col)

def draw_diamond(d, x, y, s, col):
    pts = [(x, y - s), (x + s * 3//4, y), (x, y + s), (x - s * 3//4, y)]
    d.polygon(pts, fill=col)

def draw_club(d, x, y, s, col):
    r = s * 2 // 3
    d.ellipse([x - r, y - s + r//2, x + r, y + r//2], fill=col)
    d.ellipse([x - s + r//4, y - r//2, x - r//4 + r//4, y + r], fill=col)
    d.ellipse([x + r//4 - r//4, y - r//2, x + s - r//4, y + r], fill=col)
    d.rectangle([x - s//5, y + r//2, x + s//5, y + s], fill=col)
    d.ellipse([x - s//2, y + r//2, x + s//2, y + s + s//4], fill=col)

drawers = [draw_spade, draw_heart, draw_diamond, draw_club]
suit_size = 36

for (sx, sy, name, col), drawer in zip(suit_data, drawers):
    drawer(draw, sx, sy, suit_size, col)

# ── Thin gold ring border ───────────────────────────────────────────────────
ring_r = 494
draw.ellipse(
    [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
    outline=GOLD, width=8
)

# ── Save ─────────────────────────────────────────────────────────────────────
icon_path = r'C:\Projects\Caps\assets\icon.png'
adaptive_path = r'C:\Projects\Caps\assets\adaptive-icon.png'

img_rgb = img.convert('RGB')
img_rgb.save(icon_path, 'PNG', optimize=True)
img_rgb.save(adaptive_path, 'PNG', optimize=True)

size_kb = os.path.getsize(icon_path) // 1024
print(f"icon.png: {size_kb}KB (1024x1024)")
print("Done")
