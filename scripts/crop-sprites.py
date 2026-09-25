#!/usr/bin/env python3
"""
Crops decorative pieces out of the two grunge sprite sheets and turns each
into an alpha-only mask image, ready to be used as a CSS mask-image (colour
comes from --tex-ink at use time, this file only needs to carry shape).

Run with:
    python3 scripts/crop-sprites.py

Two source sheets, both 1024x1536, RGBA, background already transparent
(alpha 0) outside every sticker-shaped patch:
    design-src/assetsprite.png
    design-src/grunge_sprite.png

The source sheets and the contact-sheet preview live under design-src/,
outside assets/, so they never ship in the deployed build (vercel.json
only includes assets/**, css/**, js/** and *.html) — only the small
cropped .webp masks that CSS actually references belong in assets/.

Two different pieces need two different mask treatments, discovered by
sampling actual pixel data rather than assuming:

  - LINE_ART pieces (barcode, crosshair, chain-like marks, safety pin, X
    marks, barbed wire): the whole sticker-shaped area is already uniformly
    opaque in the source (alpha ~250+) whether the pixel is a white gap or
    a black stroke — the white/black contrast lives in colour, not alpha.
    Using the source alpha as-is would just produce a solid rectangle. So
    these derive a NEW alpha from inverted luminance (dark pixel -> opaque
    "ink", light pixel -> transparent), multiplied by the original alpha so
    the fully-transparent area around the sticker stays transparent.

  - PATCH pieces (halftone dot patch, smudge/grid backing, stripe block,
    scratch lines): mostly-white blob shapes where the interesting part IS
    the shape's soft torn/sprayed silhouette, not internal line detail.
    Running the luminance formula on these would erase most of the piece,
    since white = high luminance = low alpha under that formula. These use
    the source alpha directly instead — it already has a nice soft falloff
    at the torn edges.
"""

import os
from PIL import Image, ImageFilter

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "design-src")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "textures")
PREVIEW_DIR = SRC_DIR  # contact sheet is a dev-only QA aid, keep it out of assets/
PADDING = 8
MAX_DIMENSION = 600  # downscale anything bigger than this (px, longest side)
# Dense fine-pattern pieces (halftone dots, tight stripes, grid lines) carry
# far more high-frequency detail than the other line-art pieces at the same
# size, so they stay heavy even at low WebP quality. They're used purely as
# decorative texture at low opacity, never read up close, so cap them
# smaller rather than fight it with compression quality.
SMALL_MAX_DIMENSION = 260
DENSE_PIECES = {"halftone-patch", "stripe-block", "grid-smudge"}
WEBP_QUALITY = 78

LINE_ART = "line_art"
PATCH = "patch"

# (name, source file, box, treatment)
#
# QA pass after the first crop run (contact sheet review) found two things:
#  - halftone-patch, stripe-block and grid-smudge came out as solid black
#    blobs under PATCH treatment. Their source alpha is opaque (~224+)
#    across nearly the whole sticker, same as the line-art pieces — the
#    dot/stripe/grid detail lives in luminance, not alpha, so they need
#    LINE_ART, not PATCH. Confirmed by sampling + eyeballing the raw crops.
#  - crosshair's box bled in the corner of a neighbouring smudge-cloud
#    decoration (unrelated, not in this piece list) at its original
#    (715,440)-(855,580) box + 8px padding. Tightened to keep clear of it.
PIECES = [
    ("barcode-00240", "assetsprite.png", (745, 62, 990, 150), LINE_ART),
    ("crosshair", "assetsprite.png", (715, 445, 822, 572), LINE_ART),
    ("halftone-patch", "assetsprite.png", (40, 440, 345, 575), LINE_ART),
    ("safety-pin", "assetsprite.png", (785, 205, 985, 268), LINE_ART),
    ("barbed-wire", "assetsprite.png", (340, 148, 772, 195), LINE_ART),
    ("stripe-block", "grunge_sprite.png", (768, 68, 982, 392), LINE_ART),
    ("grid-smudge", "grunge_sprite.png", (690, 610, 985, 768), LINE_ART),
    ("xxxx", "grunge_sprite.png", (58, 58, 362, 112), LINE_ART),
    ("sparkle-crosshairs", "grunge_sprite.png", (648, 1325, 785, 1425), LINE_ART),
    ("scratch-lines", "grunge_sprite.png", (70, 315, 470, 375), PATCH),
]


def make_line_art_alpha(rgba):
    """New alpha = inverted luminance * original alpha (both 0-255), so
    dark ink reads opaque, light gaps read transparent, and the already-
    transparent background around the sticker stays transparent regardless
    of stray colour noise there. Plain pixel loop — these crops are small
    (a few hundred px per side at most), no need for a numpy dependency."""
    r, g, b, a = rgba.split()
    grey = Image.merge("RGB", (r, g, b)).convert("L")
    inv = grey.point(lambda v: 255 - v)
    inv_px = inv.load()
    a_px = a.load()
    out = Image.new("L", grey.size)
    out_px = out.load()
    w, h = grey.size
    for y in range(h):
        for x in range(w):
            out_px[x, y] = (inv_px[x, y] * a_px[x, y]) // 255
    return out


def trim(img):
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def downscale_if_needed(img, cap):
    w, h = img.size
    longest = max(w, h)
    if longest <= cap:
        return img
    scale = cap / longest
    return img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)


def process(name, src_file, box, treatment):
    src_path = os.path.join(SRC_DIR, src_file)
    im = Image.open(src_path).convert("RGBA")
    x1, y1, x2, y2 = box
    x1 = max(0, x1 - PADDING)
    y1 = max(0, y1 - PADDING)
    x2 = min(im.width, x2 + PADDING)
    y2 = min(im.height, y2 + PADDING)
    crop = im.crop((x1, y1, x2, y2))

    if treatment == LINE_ART:
        alpha = make_line_art_alpha(crop)
    else:
        alpha = crop.split()[3]

    mask = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    white = Image.new("RGBA", crop.size, (255, 255, 255, 255))
    mask = Image.composite(white, mask, alpha)
    mask.putalpha(alpha)

    mask = trim(mask)
    cap = SMALL_MAX_DIMENSION if name in DENSE_PIECES else MAX_DIMENSION
    mask = downscale_if_needed(mask, cap)

    webp_path = os.path.join(OUT_DIR, name + ".webp")
    mask.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)

    webp_kb = os.path.getsize(webp_path) / 1024
    print(f"{name:22s} {treatment:9s} {mask.size[0]:4d}x{mask.size[1]:<4d}  {webp_kb:6.1f} KB  ({src_file})")
    return mask


def build_preview(results):
    cols = 5
    rows = (len(results) + cols - 1) // cols
    cell = 220
    sheet = Image.new("RGB", (cols * cell, rows * cell), (128, 128, 128))
    for i, (name, mask) in enumerate(results):
        col = i % cols
        row = i // cols
        thumb = mask.copy()
        thumb.thumbnail((cell - 24, cell - 40))
        tinted = Image.new("RGBA", thumb.size, (20, 20, 20, 255))
        tinted.putalpha(thumb.split()[3])
        cx = col * cell + (cell - thumb.width) // 2
        cy = row * cell + (cell - thumb.height) // 2 - 8
        sheet.paste(tinted, (cx, cy), tinted)
    sheet.save(os.path.join(PREVIEW_DIR, "_preview.png"))
    print(f"\npreview sheet -> {os.path.join(PREVIEW_DIR, '_preview.png')}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    results = []
    for name, src_file, box, treatment in PIECES:
        mask = process(name, src_file, box, treatment)
        results.append((name, mask))
    build_preview(results)


if __name__ == "__main__":
    main()
