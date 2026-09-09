"""
CAPS Poker — Facebook Page cover photo.

Built from verified, currently-shipped brand sources (not invented):
  - Background: constants/paintThemes.ts FELT_GRADIENT.classic = ['#10281A','#0E2418']
    (the same felt gradient GameView/BoardSurface paint behind every real board today)
  - Wordmark color: constants/paintThemes.ts + homeThemes.ts dark_gold.titleColor = '#c9a84c'
    (the exact gold app/(tabs)/index.tsx uses for the "CAPS" / "POKER" title text)
  - Suit glyphs + gold/red palette: scripts/generate-icon.py (the script that actually
    produced the shipped assets/icon.png) — GOLD (201,168,76), RED (180,50,50)
  - Font: Georgia Bold, the real fallback in app/(tabs)/index.tsx's
    DISPLAY_FONT = 'Playfair Display, Georgia, serif' (Playfair not installed on this
    machine, so Georgia — the declared fallback — is used, not a substitute guess)

Facebook cover upload size: 851x315 (Meta's own fastest-loading recommendation).
Desktop display 820x312, safe zone centered 640x312. Mobile crops ~90px each side.
Profile picture overlaps the bottom-left corner (~168x168 desktop / ~100x100 mobile).
All content here is kept centered and clear of both crop zones — verified visually
in generate_preview.py, not just by these numbers.
"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 851, 315
GOLD = (201, 168, 76)      # #c9a84c
RED = (180, 50, 50)
FELT_TOP = (16, 40, 26)    # #10281A
FELT_BOTTOM = (14, 36, 24) # #0E2418

FONT_BOLD = r"C:\Windows\Fonts\georgiab.ttf"
FONT_REG = r"C:\Windows\Fonts\georgia.ttf"


def felt_background():
    img = Image.new("RGB", (W, H), FELT_BOTTOM)
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        r = round(FELT_TOP[0] + (FELT_BOTTOM[0] - FELT_TOP[0]) * t)
        g = round(FELT_TOP[1] + (FELT_BOTTOM[1] - FELT_TOP[1]) * t)
        b = round(FELT_TOP[2] + (FELT_BOTTOM[2] - FELT_TOP[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    return img


def draw_spade(d, x, y, s, col):
    pts = [(x, y - s), (x + s, y + s // 2), (x - s, y + s // 2)]
    d.polygon(pts, fill=col)
    d.ellipse([x - s, y - s // 4, x, y + s // 2], fill=col)
    d.ellipse([x, y - s // 4, x + s, y + s // 2], fill=col)
    d.rectangle([x - s // 5, y + s // 2, x + s // 5, y + s], fill=col)
    d.ellipse([x - s // 2, y + s // 2, x + s // 2, y + s + s // 4], fill=col)


def draw_heart(d, x, y, s, col):
    d.ellipse([x - s, y - s // 2, x, y + s // 2], fill=col)
    d.ellipse([x, y - s // 2, x + s, y + s // 2], fill=col)
    pts = [(x - s, y + s // 6), (x, y + s * 4 // 3), (x + s, y + s // 6)]
    d.polygon(pts, fill=col)


def draw_diamond(d, x, y, s, col):
    pts = [(x, y - s), (x + s * 3 // 4, y), (x, y + s), (x - s * 3 // 4, y)]
    d.polygon(pts, fill=col)


def draw_club(d, x, y, s, col):
    r = s * 2 // 3
    d.ellipse([x - r, y - s + r // 2, x + r, y + r // 2], fill=col)
    d.ellipse([x - s + r // 4, y - r // 2, x - r // 4 + r // 4, y + r], fill=col)
    d.ellipse([x + r // 4 - r // 4, y - r // 2, x + s - r // 4, y + r], fill=col)
    d.rectangle([x - s // 5, y + r // 2, x + s // 5, y + s], fill=col)
    d.ellipse([x - s // 2, y + r // 2, x + s // 2, y + s + s // 4], fill=col)


def draw_letterspaced(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        w = draw.textlength(ch, font=font)
        x += w + tracking
    return x


def letterspaced_width(draw, text, font, tracking):
    total = 0
    for ch in text:
        total += draw.textlength(ch, font=font) + tracking
    return total - tracking


def build():
    img = felt_background()

    # Soft dark vignette so the gold wordmark reads clean off the felt (matches the
    # app's own titleCaps textShadow treatment: rgba(0,0,0,0.85), radius 24).
    shadow_layer = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shadow_layer)

    title_font = ImageFont.truetype(FONT_BOLD, 66)
    sub_font = ImageFont.truetype(FONT_REG, 20)
    url_font = ImageFont.truetype(FONT_REG, 16)

    draw = ImageDraw.Draw(img)

    title_text = "CAPS"
    title_tracking = 14
    title_w = letterspaced_width(draw, title_text, title_font, title_tracking)

    sub_text = "P O K E R"
    sub_tracking = 0
    sub_w = draw.textlength(sub_text, font=sub_font)

    url_text = "caps.ftable.co.il"
    url_w = draw.textlength(url_text, font=url_font)

    # Vertical stack, centered horizontally in the canvas, weighted toward the upper-
    # center so nothing sits near the bottom-left avatar overlap zone.
    cx = W // 2
    title_y = 92
    sub_y = title_y + 78
    url_y = sub_y + 34

    # Drop shadow pass for the title (blurred dark copy offset slightly down),
    # same spirit as the app's textShadowColor rgba(0,0,0,0.85) / radius 24.
    shadow_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_img)
    draw_letterspaced(sdraw, (cx - title_w / 2, title_y + 4), title_text, title_font, (0, 0, 0, 235), title_tracking)
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(6))
    img.paste(Image.alpha_composite(img.convert("RGBA"), shadow_img).convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img)

    draw_letterspaced(draw, (cx - title_w / 2, title_y), title_text, title_font, GOLD, title_tracking)
    draw.text((cx - sub_w / 2, sub_y), sub_text, font=sub_font, fill=GOLD)
    draw.text((cx - url_w / 2, url_y), url_text, font=url_font, fill=(180, 180, 170))

    # Small suit accents flanking the wordmark, same shapes/colors as the shipped icon.
    suit_y = title_y + 30
    suit_size = 10
    draw_spade(draw, int(cx - title_w / 2 - 34), suit_y, suit_size, GOLD)
    draw_heart(draw, int(cx + title_w / 2 + 34), suit_y, suit_size, RED)

    img.save(r"C:\Projects\POKER\Caps\docs\cover-art-2026-09-09\facebook-cover-851x315.png", "PNG")
    print("wrote facebook-cover-851x315.png")


if __name__ == "__main__":
    build()
