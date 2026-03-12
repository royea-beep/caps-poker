"""
Generate app icon, adaptive icon, favicon, and splash screen for Caps Poker.
Uses Pillow — no external fonts needed (uses built-in bitmap font scaled up
with anti-aliased polygon drawing for the "C" and text).
"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
import os

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

# Colors
GOLD = (240, 192, 64)
GOLD_LIGHT = (255, 215, 100)
GOLD_DARK = (180, 140, 40)
GREEN_CENTER = (26, 92, 50)
GREEN_EDGE = (10, 61, 31)
GREEN_BG = (10, 61, 31)
WHITE_SEMI = (255, 255, 255, 60)


def radial_gradient(size, center_color, edge_color):
    """Create a radial gradient image."""
    img = Image.new("RGBA", (size, size))
    cx, cy = size // 2, size // 2
    max_dist = math.sqrt(cx * cx + cy * cy)
    pixels = img.load()
    for y in range(size):
        for x in range(size):
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            t = min(dist / max_dist, 1.0)
            r = int(center_color[0] + t * (edge_color[0] - center_color[0]))
            g = int(center_color[1] + t * (edge_color[1] - center_color[1]))
            b = int(center_color[2] + t * (edge_color[2] - center_color[2]))
            pixels[x, y] = (r, g, b, 255)
    return img


def draw_text_centered(draw, text, cx, cy, font, fill):
    """Draw text centered at (cx, cy)."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = cx - tw // 2
    y = cy - th // 2 - bbox[1]  # adjust for font ascent
    draw.text((x, y), text, font=font, fill=fill)
    return tw, th


def generate_icon(size, output_path):
    """Generate the app icon at given size."""
    # Work at 2x for anti-aliasing, then downscale
    work_size = size * 2
    img = radial_gradient(work_size, GREEN_CENTER, GREEN_EDGE)
    draw = ImageDraw.Draw(img)

    # Gold ring border (inside edge)
    border_w = max(4, work_size // 60)
    margin = work_size // 20
    draw.ellipse(
        [margin, margin, work_size - margin, work_size - margin],
        outline=GOLD_DARK,
        width=border_w,
    )

    # Inner subtle ring
    inner_margin = margin + border_w + work_size // 80
    draw.ellipse(
        [inner_margin, inner_margin, work_size - inner_margin, work_size - inner_margin],
        outline=(*GOLD_DARK, 80),
        width=max(2, border_w // 3),
    )

    # Large "C" in center
    try:
        font_size = int(work_size * 0.55)
        font = ImageFont.truetype("arial.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    # Shadow
    draw_text_centered(draw, "C", work_size // 2 + 6, work_size // 2 + 6, font, (*GOLD_DARK, 120))
    # Main letter
    draw_text_centered(draw, "C", work_size // 2, work_size // 2, font, GOLD)
    # Highlight
    draw_text_centered(draw, "C", work_size // 2 - 2, work_size // 2 - 2, font, (*GOLD_LIGHT, 100))

    # Corner suit symbols
    suits = ["\u2660", "\u2665", "\u2666", "\u2663"]  # ♠ ♥ ♦ ♣
    try:
        suit_font_size = int(work_size * 0.08)
        suit_font = ImageFont.truetype("arial.ttf", suit_font_size)
    except (OSError, IOError):
        try:
            suit_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", suit_font_size)
        except (OSError, IOError):
            suit_font = ImageFont.load_default()

    suit_margin = work_size // 7
    positions = [
        (suit_margin, suit_margin),                           # top-left
        (work_size - suit_margin, suit_margin),               # top-right
        (suit_margin, work_size - suit_margin),               # bottom-left
        (work_size - suit_margin, work_size - suit_margin),   # bottom-right
    ]
    for i, (sx, sy) in enumerate(positions):
        draw_text_centered(draw, suits[i], sx, sy, suit_font, (255, 255, 255, 50))

    # Downscale with anti-aliasing
    img = img.resize((size, size), Image.LANCZOS)
    img.save(output_path, "PNG")
    print(f"  Generated {output_path} ({size}x{size})")


def generate_favicon(size, output_path):
    """Generate a simplified favicon."""
    work_size = size * 4
    img = Image.new("RGBA", (work_size, work_size), GREEN_EDGE)
    draw = ImageDraw.Draw(img)

    # Simple gold C
    try:
        font_size = int(work_size * 0.7)
        font = ImageFont.truetype("arial.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    draw_text_centered(draw, "C", work_size // 2, work_size // 2, font, GOLD)

    img = img.resize((size, size), Image.LANCZOS)
    img.save(output_path, "PNG")
    print(f"  Generated {output_path} ({size}x{size})")


def generate_splash(width, height, output_path):
    """Generate splash screen."""
    work_w, work_h = width, height
    img = Image.new("RGBA", (work_w, work_h), GREEN_BG)
    draw = ImageDraw.Draw(img)

    # Subtle radial gradient overlay
    cx, cy = work_w // 2, work_h // 2
    max_dist = math.sqrt((work_w / 2) ** 2 + (work_h / 2) ** 2)
    gradient = Image.new("RGBA", (work_w, work_h), (0, 0, 0, 0))
    gpx = gradient.load()
    for y in range(0, work_h, 2):  # step 2 for speed
        for x in range(0, work_w, 2):
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            t = min(dist / max_dist, 1.0)
            alpha = int(t * 40)
            for dy in range(2):
                for dx in range(2):
                    if x + dx < work_w and y + dy < work_h:
                        gpx[x + dx, y + dy] = (0, 0, 0, alpha)
    img = Image.alpha_composite(img, gradient)

    # Felt texture (noise)
    noise = Image.new("RGBA", (work_w, work_h), (0, 0, 0, 0))
    npx = noise.load()
    random.seed(42)
    for y in range(0, work_h, 3):
        for x in range(0, work_w, 3):
            if random.random() < 0.3:
                v = random.randint(0, 15)
                a = random.randint(8, 25)
                for dy in range(3):
                    for dx in range(3):
                        if x + dx < work_w and y + dy < work_h:
                            npx[x + dx, y + dy] = (v, v + 5, v, a)
    img = Image.alpha_composite(img, noise)

    draw = ImageDraw.Draw(img)

    # "CAPS" text
    try:
        caps_font_size = int(work_w * 0.28)
        caps_font = ImageFont.truetype("arial.ttf", caps_font_size)
    except (OSError, IOError):
        try:
            caps_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", caps_font_size)
        except (OSError, IOError):
            caps_font = ImageFont.load_default()

    # Shadow
    text_y = work_h // 2 - int(work_w * 0.08)
    draw_text_centered(draw, "CAPS", cx + 4, text_y + 4, caps_font, (*GOLD_DARK, 150))
    # Main
    draw_text_centered(draw, "CAPS", cx, text_y, caps_font, GOLD)

    # "POKER" text below
    try:
        poker_font_size = int(work_w * 0.09)
        poker_font = ImageFont.truetype("arial.ttf", poker_font_size)
    except (OSError, IOError):
        try:
            poker_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", poker_font_size)
        except (OSError, IOError):
            poker_font = ImageFont.load_default()

    poker_y = text_y + int(work_w * 0.25)
    draw_text_centered(draw, "P O K E R", cx, poker_y, poker_font, (200, 200, 200, 180))

    # Suit symbols row between CAPS and POKER
    try:
        suit_size = int(work_w * 0.05)
        suit_font = ImageFont.truetype("arial.ttf", suit_size)
    except (OSError, IOError):
        try:
            suit_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", suit_size)
        except (OSError, IOError):
            suit_font = ImageFont.load_default()

    suits_y = text_y + int(work_w * 0.18)
    suits_text = "\u2660   \u2665   \u2666   \u2663"
    draw_text_centered(draw, suits_text, cx, suits_y, suit_font, (*GOLD, 120))

    # Thin gold line separators
    line_w = int(work_w * 0.35)
    line_y1 = text_y - int(work_w * 0.04)
    draw.line([(cx - line_w, line_y1), (cx + line_w, line_y1)], fill=(*GOLD, 60), width=2)
    line_y2 = poker_y + int(work_w * 0.06)
    draw.line([(cx - line_w, line_y2), (cx + line_w, line_y2)], fill=(*GOLD, 60), width=2)

    # Convert to RGB for final save (no alpha needed)
    final = Image.new("RGB", (work_w, work_h), GREEN_BG)
    final.paste(img, mask=img.split()[3])
    final.save(output_path, "PNG")
    print(f"  Generated {output_path} ({work_w}x{work_h})")


if __name__ == "__main__":
    print("Generating Caps Poker assets...")

    # App icon (1024x1024)
    generate_icon(1024, os.path.join(ASSETS_DIR, "icon.png"))

    # Android adaptive icon (1024x1024)
    generate_icon(1024, os.path.join(ASSETS_DIR, "adaptive-icon.png"))

    # Android foreground (same as icon for now)
    generate_icon(1024, os.path.join(ASSETS_DIR, "android-icon-foreground.png"))

    # Favicon (64x64)
    generate_favicon(64, os.path.join(ASSETS_DIR, "favicon.png"))

    # Splash screen (1284x2778 — iPhone 14 Pro Max)
    generate_splash(1284, 2778, os.path.join(ASSETS_DIR, "splash.png"))

    print("\nDone! All assets generated.")
