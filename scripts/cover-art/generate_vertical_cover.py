"""
CAPS Poker — vertical (1080x1920) brand cover, for the one real cover-like surface
Instagram and TikTok actually have: a per-video Reel/TikTok cover thumbnail (there
is no landscape profile "cover photo" concept on either platform, verified via
WebSearch this sprint — this is NOT a substitute for one, it doesn't exist to
substitute for). Same identity as the Facebook cover: FELT_GRADIENT.classic
background, dark_gold.titleColor '#c9a84c' wordmark, icon-script suit palette.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
GOLD = (201, 168, 76)
RED = (180, 50, 50)
FELT_TOP = (16, 40, 26)
FELT_BOTTOM = (14, 36, 24)
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


img = felt_background()
draw = ImageDraw.Draw(img)

title_font = ImageFont.truetype(FONT_BOLD, 150)
sub_font = ImageFont.truetype(FONT_REG, 46)
url_font = ImageFont.truetype(FONT_REG, 32)

title_text = "CAPS"
title_tracking = 32
title_w = letterspaced_width(draw, title_text, title_font, title_tracking)
sub_text = "P O K E R"
sub_w = draw.textlength(sub_text, font=sub_font)
url_text = "caps.ftable.co.il"
url_w = draw.textlength(url_text, font=url_font)

cx = W // 2
title_y = H // 2 - 160
sub_y = title_y + 180
url_y = sub_y + 80

shadow_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sdraw = ImageDraw.Draw(shadow_img)
draw_letterspaced(sdraw, (cx - title_w / 2, title_y + 10), title_text, title_font, (0, 0, 0, 235), title_tracking)
shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(14))
img = Image.alpha_composite(img.convert("RGBA"), shadow_img).convert("RGB")
draw = ImageDraw.Draw(img)

draw_letterspaced(draw, (cx - title_w / 2, title_y), title_text, title_font, GOLD, title_tracking)
draw.text((cx - sub_w / 2, sub_y), sub_text, font=sub_font, fill=GOLD)
draw.text((cx - url_w / 2, url_y), url_text, font=url_font, fill=(180, 180, 170))

suit_y = title_y + 68
suit_size = 22
draw_spade(draw, int(cx - title_w / 2 - 70), suit_y, suit_size, GOLD)
draw_heart(draw, int(cx + title_w / 2 + 70), suit_y, suit_size, RED)

img.save(r"C:\Projects\POKER\Caps\docs\cover-art-2026-09-09\vertical-cover-1080x1920.png", "PNG")
print("wrote vertical-cover-1080x1920.png")
