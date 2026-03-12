"""
Generate placeholder App Store screenshots for CAPS Poker.
Uses Pillow to render mockups of app screens on poker green background.

Sizes:
  6.7" iPhone: 1290x2796
  6.1" iPhone: 1179x2556

Usage:
  python scripts/generate-screenshots.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

# --- Colors ---
BG = "#0a3d1f"
SURFACE = "#0d4a26"
GOLD = "#f0c040"
GOLD_DIM = "#a08020"
WHITE = "#f0f0e8"
RED = "#e04040"
GREEN_BRIGHT = "#40c060"
CARD_BG = "#f5f5f0"
CARD_EMPTY = "#1a3a20"
CARD_BORDER = "#c0c0b0"
TEXT_DARK = "#1a1a2e"
BORDER_SUBTLE = "rgba(255,255,255,0.15)"
BORDER_LIGHT = "#3a6a3f"

# --- Sizes ---
SIZES = {
    "6.7": (1290, 2796),
    "6.1": (1179, 2556),
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(PROJECT_DIR, "screenshots")


def get_font(size):
    """Get a font, falling back to default if no TTF available."""
    try:
        return ImageFont.truetype("arial.ttf", size)
    except (OSError, IOError):
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
        except (OSError, IOError):
            return ImageFont.load_default()


def rounded_rect(draw, xy, fill, radius=20, outline=None, width=0):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def scale(base_val, w):
    """Scale a value proportionally based on width (base = 1290)."""
    return int(base_val * w / 1290)


def draw_card(draw, x, y, w, h, filled=True, suit=None, rank=None, selected=False):
    """Draw a card rectangle."""
    if filled:
        outline_color = GOLD if selected else CARD_BORDER
        outline_w = 4 if selected else 2
        rounded_rect(draw, (x, y, x + w, y + h), fill=CARD_BG, radius=8, outline=outline_color, width=outline_w)
        if suit and rank:
            font = get_font(int(h * 0.3))
            color = RED if suit in ("♥", "♦") else TEXT_DARK
            text = f"{rank}{suit}"
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            draw.text((x + (w - tw) // 2, y + (h - th) // 2), text, fill=color, font=font)
    else:
        rounded_rect(draw, (x, y, x + w, y + h), fill=CARD_EMPTY, radius=8, outline=BORDER_LIGHT, width=2)


# ---- Screenshot 1: Home ----
def generate_home(w, h):
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)

    s = lambda v: scale(v, w)
    cy = h // 2

    # Suit symbols above title
    suit_font = get_font(s(80))
    suits = "♠  ♥  ♦  ♣"
    bbox = draw.textbbox((0, 0), suits, font=suit_font)
    sw = bbox[2] - bbox[0]
    suit_y = cy - s(420)
    # Color each suit individually
    suit_chars = [("♠", WHITE), ("  ", WHITE), ("♥", RED), ("  ", WHITE),
                  ("♦", RED), ("  ", WHITE), ("♣", WHITE)]
    total_x = (w - sw) // 2
    for ch, color in suit_chars:
        draw.text((total_x, suit_y), ch, fill=color, font=suit_font)
        cw = draw.textbbox((0, 0), ch, font=suit_font)[2]
        total_x += cw

    # "CAPS" title
    title_font = get_font(s(160))
    title = "CAPS"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    title_y = cy - s(320)
    draw.text(((w - tw) // 2, title_y), title, fill=GOLD, font=title_font)

    # "POKER" subtitle
    sub_font = get_font(s(80))
    sub = "POKER"
    bbox = draw.textbbox((0, 0), sub, font=sub_font)
    sw2 = bbox[2] - bbox[0]
    sub_y = title_y + s(180)
    draw.text(((w - sw2) // 2, sub_y), sub, fill=WHITE, font=sub_font)

    # Decorative line
    line_y = sub_y + s(100)
    line_w = s(300)
    draw.line(((w - line_w) // 2, line_y, (w + line_w) // 2, line_y), fill=GOLD, width=3)

    # Balance text
    bal_font = get_font(s(48))
    bal = "Your Balance: 1,000 chips"
    bbox = draw.textbbox((0, 0), bal, font=bal_font)
    bw = bbox[2] - bbox[0]
    bal_y = line_y + s(40)
    draw.text(((w - bw) // 2, bal_y), bal, fill=GOLD_DIM, font=bal_font)

    # Buttons
    buttons = ["NEW HAND (vs Bot)", "HOST GAME", "JOIN GAME", "SETTINGS"]
    btn_font = get_font(s(50))
    btn_w = s(800)
    btn_h = s(110)
    btn_gap = s(40)
    btn_start_y = bal_y + s(120)

    for i, label in enumerate(buttons):
        bx = (w - btn_w) // 2
        by = btn_start_y + i * (btn_h + btn_gap)
        if i == 0:
            # Primary button — gold filled
            rounded_rect(draw, (bx, by, bx + btn_w, by + btn_h), fill=GOLD, radius=s(20))
            bbox = draw.textbbox((0, 0), label, font=btn_font)
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            draw.text((bx + (btn_w - lw) // 2, by + (btn_h - lh) // 2), label, fill=TEXT_DARK, font=btn_font)
        else:
            # Secondary button — gold bordered
            rounded_rect(draw, (bx, by, bx + btn_w, by + btn_h), fill=SURFACE, radius=s(20), outline=GOLD, width=3)
            bbox = draw.textbbox((0, 0), label, font=btn_font)
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            draw.text((bx + (btn_w - lw) // 2, by + (btn_h - lh) // 2), label, fill=GOLD, font=btn_font)

    # Bottom decorative chips icon (simple circle)
    chip_y = h - s(200)
    chip_r = s(40)
    draw.ellipse((w // 2 - chip_r, chip_y - chip_r, w // 2 + chip_r, chip_y + chip_r), fill=GOLD, outline=GOLD_DIM, width=3)
    chip_font = get_font(s(30))
    draw.text((w // 2 - s(8), chip_y - s(12)), "$", fill=TEXT_DARK, font=chip_font)

    return img


# ---- Screenshot 2: Game ----
def generate_game(w, h):
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)

    s = lambda v: scale(v, w)

    # Status bar padding
    top_pad = s(120)

    # Timer
    timer_font = get_font(s(56))
    timer_text = "0:45"
    bbox = draw.textbbox((0, 0), timer_text, font=timer_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    timer_w = tw + s(60)
    timer_h = th + s(30)
    tx = (w - timer_w) // 2
    ty = top_pad
    rounded_rect(draw, (tx, ty, tx + timer_w, ty + timer_h), fill=SURFACE, radius=s(16), outline=GOLD, width=2)
    draw.text((tx + (timer_w - tw) // 2, ty + (timer_h - th) // 2), timer_text, fill=GOLD, font=timer_font)

    # Board sections
    board_y_start = ty + timer_h + s(60)
    board_h = s(280)
    board_gap = s(30)
    board_margin = s(40)
    label_font = get_font(s(32))
    small_font = get_font(s(26))

    # Card data for each board
    boards = [
        {"label": "BOARD 1", "community": [("A", "♠"), ("K", "♥"), ("7", "♦")],
         "player": [("Q", "♠"), ("J", "♥"), None, None]},
        {"label": "BOARD 2", "community": [("10", "♣"), ("5", "♠"), ("2", "♥")],
         "player": [("9", "♦"), None, None, None]},
        {"label": "BOARD 3", "community": [("8", "♠"), ("3", "♦"), ("K", "♣")],
         "player": [("A", "♥"), ("6", "♣"), ("4", "♠"), None]},
        {"label": "BOARD 4", "community": [("J", "♦"), ("9", "♠"), ("Q", "♥")],
         "player": [None, None, None, None]},
    ]

    card_w = s(80)
    card_h = s(110)
    card_gap = s(12)

    for i, board in enumerate(boards):
        by = board_y_start + i * (board_h + board_gap)
        # Board background
        rounded_rect(draw, (board_margin, by, w - board_margin, by + board_h),
                      fill=SURFACE, radius=12, outline=BORDER_LIGHT, width=2)

        # Board label
        draw.text((board_margin + s(20), by + s(12)), board["label"], fill=GOLD_DIM, font=label_font)

        # Community cards label
        draw.text((board_margin + s(20), by + s(50)), "Community", fill="#6a9a6f", font=small_font)

        # Community cards
        cx_start = board_margin + s(20)
        cy = by + s(85)
        for j, card in enumerate(board["community"]):
            cx = cx_start + j * (card_w + card_gap)
            if card:
                draw_card(draw, cx, cy, card_w, card_h, filled=True, rank=card[0], suit=card[1])
            else:
                draw_card(draw, cx, cy, card_w, card_h, filled=False)

        # Separator line
        sep_x = cx_start + 3 * (card_w + card_gap) + s(10)
        draw.line((sep_x, by + s(60), sep_x, by + board_h - s(20)), fill=BORDER_LIGHT, width=2)

        # Player cards label
        draw.text((sep_x + s(16), by + s(50)), "Your Cards", fill="#6a9a6f", font=small_font)

        # Player cards
        px_start = sep_x + s(16)
        for j, card in enumerate(board["player"]):
            px = px_start + j * (card_w + card_gap)
            if card:
                draw_card(draw, px, cy, card_w, card_h, filled=True, rank=card[0], suit=card[1],
                          selected=(i == 0 and j == 1))
            else:
                draw_card(draw, px, cy, card_w, card_h, filled=False)

    # YOUR HAND section at bottom
    hand_y = board_y_start + 4 * (board_h + board_gap) + s(30)
    hand_label_font = get_font(s(40))
    remaining_font = get_font(s(32))
    draw.text((board_margin + s(20), hand_y), "YOUR HAND", fill=GOLD, font=hand_label_font)
    draw.text((board_margin + s(320), hand_y + s(8)), "(3 remaining)", fill=GOLD_DIM, font=remaining_font)

    # Hand cards — 8 cards in a row
    hand_card_w = s(120)
    hand_card_h = s(165)
    hand_gap = s(12)
    total_hand_w = 8 * hand_card_w + 7 * hand_gap
    hx_start = (w - total_hand_w) // 2
    hy = hand_y + s(60)

    hand_cards = [
        ("A", "♠"), ("K", "♥"), ("Q", "♦"), ("J", "♣"),
        ("10", "♠"), None, None, None
    ]

    for j, card in enumerate(hand_cards):
        hx = hx_start + j * (hand_card_w + hand_gap)
        if card:
            selected = (j == 4)  # highlight one card
            draw_card(draw, hx, hy, hand_card_w, hand_card_h, filled=True,
                      rank=card[0], suit=card[1], selected=selected)
        else:
            # Used/empty slot
            draw_card(draw, hx, hy, hand_card_w, hand_card_h, filled=False)

    return img


# ---- Screenshot 3: Results ----
def generate_results(w, h):
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)

    s = lambda v: scale(v, w)

    top_pad = s(120)

    # Title
    title_font = get_font(s(80))
    title = "RESULTS"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, top_pad), title, fill=GOLD, font=title_font)

    # Board results
    margin = s(40)
    result_y_start = top_pad + s(140)
    result_h = s(360)
    result_gap = s(30)
    label_font = get_font(s(36))
    hand_font = get_font(s(42))
    chip_font = get_font(s(48))
    badge_font = get_font(s(36))
    small_font = get_font(s(28))

    boards = [
        {"label": "BOARD 1", "hand": "Two Pair", "result": "WIN", "chips": "+50",
         "community": [("A", "♠"), ("K", "♥"), ("7", "♦"), ("3", "♣"), ("A", "♦")],
         "player": [("A", "♥"), ("K", "♠")]},
        {"label": "BOARD 2", "hand": "Flush", "result": "WIN", "chips": "+75",
         "community": [("10", "♣"), ("5", "♠"), ("2", "♥"), ("8", "♠"), ("J", "♠")],
         "player": [("9", "♠"), ("4", "♠")]},
        {"label": "BOARD 3", "hand": "High Card", "result": "LOSS", "chips": "-25",
         "community": [("8", "♠"), ("3", "♦"), ("K", "♣"), ("Q", "♥"), ("2", "♣")],
         "player": [("6", "♣"), ("4", "♦")]},
        {"label": "BOARD 4", "hand": "Pair", "result": "LOSS", "chips": "-25",
         "community": [("J", "♦"), ("9", "♠"), ("Q", "♥"), ("5", "♦"), ("7", "♣")],
         "player": [("J", "♣"), ("2", "♦")]},
    ]

    card_w = s(70)
    card_h = s(95)
    card_gap = s(8)

    for i, board in enumerate(boards):
        by = result_y_start + i * (result_h + result_gap)

        # Board background
        rounded_rect(draw, (margin, by, w - margin, by + result_h),
                      fill=SURFACE, radius=12, outline=BORDER_LIGHT, width=2)

        # Board label
        draw.text((margin + s(20), by + s(15)), board["label"], fill=GOLD_DIM, font=label_font)

        # Result badge
        is_win = board["result"] == "WIN"
        badge_color = GREEN_BRIGHT if is_win else RED
        badge_text = board["result"]
        bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
        badge_tw = bbox[2] - bbox[0]
        badge_th = bbox[3] - bbox[1]
        badge_w = badge_tw + s(40)
        badge_h = badge_th + s(16)
        badge_x = w - margin - badge_w - s(20)
        badge_y = by + s(12)
        rounded_rect(draw, (badge_x, badge_y, badge_x + badge_w, badge_y + badge_h),
                      fill=badge_color, radius=s(10))
        draw.text((badge_x + (badge_w - badge_tw) // 2, badge_y + (badge_h - badge_th) // 2),
                  badge_text, fill=WHITE, font=badge_font)

        # Community cards row
        cards_y = by + s(70)
        draw.text((margin + s(20), cards_y - s(5)), "Community", fill="#6a9a6f", font=small_font)
        cx_start = margin + s(180)
        for j, card in enumerate(board["community"]):
            cx = cx_start + j * (card_w + card_gap)
            draw_card(draw, cx, cards_y, card_w, card_h, filled=True, rank=card[0], suit=card[1])

        # Player cards
        sep_x = cx_start + 5 * (card_w + card_gap) + s(20)
        draw.text((sep_x, cards_y - s(5)), "Yours", fill="#6a9a6f", font=small_font)
        for j, card in enumerate(board["player"]):
            px = sep_x + s(80) + j * (card_w + card_gap)
            draw_card(draw, px, cards_y, card_w, card_h, filled=True, rank=card[0], suit=card[1])

        # Hand name + chips
        info_y = cards_y + card_h + s(20)
        draw.text((margin + s(20), info_y), board["hand"], fill=WHITE, font=hand_font)

        chip_color = GREEN_BRIGHT if is_win else RED
        bbox = draw.textbbox((0, 0), board["chips"], font=chip_font)
        cw = bbox[2] - bbox[0]
        draw.text((w - margin - cw - s(20), info_y), board["chips"], fill=chip_color, font=chip_font)

    # Net total
    net_y = result_y_start + 4 * (result_h + result_gap) + s(20)
    net_font = get_font(s(60))
    net_text = "Net: +75 chips"
    bbox = draw.textbbox((0, 0), net_text, font=net_font)
    nw = bbox[2] - bbox[0]
    draw.text(((w - nw) // 2, net_y), net_text, fill=GREEN_BRIGHT, font=net_font)

    # NEXT HAND button
    btn_font = get_font(s(50))
    btn_text = "NEXT HAND"
    bbox = draw.textbbox((0, 0), btn_text, font=btn_font)
    btw = bbox[2] - bbox[0]
    bth = bbox[3] - bbox[1]
    btn_w = btw + s(120)
    btn_h = bth + s(40)
    bx = (w - btn_w) // 2
    by = net_y + s(100)
    rounded_rect(draw, (bx, by, bx + btn_w, by + btn_h), fill=GOLD, radius=s(20))
    draw.text((bx + (btn_w - btw) // 2, by + (btn_h - bth) // 2), btn_text, fill=TEXT_DARK, font=btn_font)

    return img


def main():
    generators = {
        "home.png": generate_home,
        "game.png": generate_game,
        "results.png": generate_results,
    }

    for size_name, (w, h) in SIZES.items():
        out_path = os.path.join(OUT_DIR, size_name)
        os.makedirs(out_path, exist_ok=True)

        for filename, gen_func in generators.items():
            filepath = os.path.join(out_path, filename)
            print(f"Generating {size_name}/{filename} ({w}x{h})...")
            img = gen_func(w, h)
            img.save(filepath, "PNG")
            print(f"  Saved: {filepath}")

    print(f"\nDone! Generated {len(generators) * len(SIZES)} screenshots.")


if __name__ == "__main__":
    main()
