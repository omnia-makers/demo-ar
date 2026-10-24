"""Generate a church-like marble floor image that works as a MindAR image target.

A plain checkerboard is a bad target: every corner looks the same, so the matcher cannot tell
them apart. Here every tile is unique (vein direction, frequency, turbulence, tone, wear, cracks)
while the whole still reads as an old diagonal marble floor.

With --qr URL the four tiles around the centre are replaced by one large inlaid slab holding a QR code
built from dark and light marble tesserae, framed in red marble, so a phone camera opens the URL while
the floor still looks like a floor. Needs `segno` (pip install segno); the rest of the floor is unchanged.

Usage: python3 tools/generate-floor.py OUT_DIR [--size 4096] [--tiles 7] [--seed 7] [--qr URL]
Writes OUT_DIR/floor-print.png (for printing) and OUT_DIR/floor.png (1024 px, for compiling).
"""
import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LIGHT_TONES = [(226, 218, 200), (214, 208, 196), (232, 226, 212), (205, 196, 178), (220, 212, 190)]
DARK_TONES = [(58, 56, 56), (72, 64, 58), (44, 44, 48), (96, 52, 44), (66, 70, 72)]
GROUT = (150, 140, 124)


def fbm(rng, size, octaves=6, base=4, persistence=0.55):
    """Fractal value noise in [-1, 1], built from upscaled random grids."""
    out = np.zeros((size, size), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = base * 2 ** o
        grid = rng.random((cells + 1, cells + 1)).astype(np.float32)
        layer = np.asarray(Image.fromarray(grid, mode="F").resize((size, size), Image.BICUBIC))
        out += amp * layer
        total += amp
        amp *= persistence
    out /= total
    return (out - out.mean()) / (out.std() * 3)


QR_DARK = (52, 50, 52)
QR_LIGHT = (226, 218, 200)
QR_FRAME = (112, 54, 46)
QR_QUIET, QR_FRAME_MODULES = 4, 2  # quiet zone required by QR readers; red marble frame around it


def qr_inlay(url, side, seed, texture=1.0):
    """Square RGB array (side x side) with the QR as marble tesserae. Error level H (30% recoverable)
    leaves room for the texture and for wear or a partial occlusion. `texture` scales the marble
    clouds and veins: higher hides the code better but lowers its contrast."""
    import segno

    qr = segno.make(url, error="h", boost_error=False, micro=False)
    dark = np.array(qr.matrix, bool)
    n = dark.shape[0] + 2 * (QR_QUIET + QR_FRAME_MODULES)
    mod = side / n
    rng = np.random.default_rng(seed)

    y, x = np.mgrid[0:side, 0:side].astype(np.float32)
    mi = np.clip((y / mod).astype(np.int32), 0, n - 1) - QR_FRAME_MODULES - QR_QUIET
    mj = np.clip((x / mod).astype(np.int32), 0, n - 1) - QR_FRAME_MODULES - QR_QUIET
    inside_qr = (mi >= 0) & (mj >= 0) & (mi < dark.shape[0]) & (mj < dark.shape[1])
    is_dark = np.zeros((side, side), bool)
    is_dark[inside_qr] = dark[mi[inside_qr], mj[inside_qr]]
    ring = (mi < -QR_QUIET) | (mj < -QR_QUIET) | (mi >= dark.shape[0] + QR_QUIET) | (mj >= dark.shape[1] + QR_QUIET)

    img = np.empty((side, side, 3), np.float32)
    img[:] = QR_LIGHT
    img[is_dark] = QR_DARK
    img[ring] = QR_FRAME
    # Marble texture, kept low so the dark/light contrast the reader needs survives.
    cloud = fbm(rng, side, octaves=6, base=4)
    img *= (1 + 0.10 * texture * cloud[..., None])
    phase = (x * 0.7 + y * 0.3) * 0.004 * 4096 / side * 2 + 6 * fbm(rng, side, octaves=6, base=3)
    veins = (1 - np.abs(np.sin(phase))) ** 3
    vein_k = min(0.18 * texture, 0.6)
    img = img * (1 - vein_k * veins[..., None]) + 128 * vein_k * veins[..., None]
    # Thin joints between tesserae: a mosaic look, faint enough not to split dark modules.
    fy, fx = (y / mod) % 1, (x / mod) % 1
    joint = (np.minimum(np.minimum(fy, 1 - fy), np.minimum(fx, 1 - fx)) < 0.05) & inside_qr
    img[joint] *= 0.86
    return np.clip(img, 0, 255).astype(np.uint8), qr.designator


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--size", type=int, default=4096)
    ap.add_argument("--tiles", type=float, default=7, help="tiles across the image width (diagonal grid)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--vein-power", type=float, nargs=2, default=(6, 16),
                    help="min/max vein sharpness: lower = wider veins, visible from further away")
    ap.add_argument("--cloud", type=float, default=0.05, help="strength of the cloudy tone variation inside tiles")
    ap.add_argument("--grout-contrast", type=float, default=1.0,
                    help="0 = grout same colour as the tile (grid corners invisible), 1 = full grout colour")
    ap.add_argument("--qr", metavar="URL", help="inlay a QR code to this URL in the centre of the floor")
    ap.add_argument("--qr-texture", type=float, default=1.0,
                    help="marble texture over the QR: higher hides it better, lower reads more reliably")
    args = ap.parse_args()

    S = args.size
    rng = np.random.default_rng(args.seed)
    diag = S / args.tiles  # diagonal of a diamond tile in px

    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    # Diagonal (45 deg) checkerboard coordinates.
    u = (x + y) / diag
    v = (x - y) / diag + 1000
    iu, iv = np.floor(u).astype(np.int32), np.floor(v).astype(np.int32)
    n_u, n_v = iu.max() + 1, iv.max() + 1
    tile_id = iu * n_v + iv
    n_tiles = int(n_u * n_v)
    dark = ((iu + iv) % 2 == 1)

    # Per-tile random parameters: this is what makes every tile distinct.
    angle = rng.uniform(0, math.pi, n_tiles).astype(np.float32)
    freq = rng.uniform(0.004, 0.012, n_tiles).astype(np.float32) * 4096 / S
    turb_k = rng.uniform(4, 9, n_tiles).astype(np.float32)
    vein_power = rng.uniform(*args.vein_power, n_tiles).astype(np.float32)
    # Offsets into the shared turbulence field, kept far enough from its edge that no tile wraps
    # around (wrapping shows up as straight seams inside a tile).
    off_x = rng.integers(0, int(S - diag) - 1, n_tiles)
    off_y = rng.integers(0, int(S - diag) - 1, n_tiles)
    # Top-left corner of each diamond's bounding box, to sample the turbulence in tile-local coordinates.
    t_iu, t_iv = np.divmod(np.arange(n_tiles), n_v)
    corner_x = ((t_iu + 0.5) + (t_iv + 0.5 - 1000)) * diag / 2 - diag / 2
    corner_y = ((t_iu + 0.5) - (t_iv + 0.5 - 1000)) * diag / 2 - diag / 2
    light_tone = rng.integers(0, len(LIGHT_TONES), n_tiles)
    dark_tone = rng.integers(0, len(DARK_TONES), n_tiles)
    brightness = rng.uniform(0.9, 1.08, n_tiles).astype(np.float32)

    turb = fbm(rng, S, octaves=7, base=6)
    fine = fbm(rng, S, octaves=4, base=64)
    wear = fbm(rng, S, octaves=4, base=3)

    # Marble: sine bands along a per-tile direction, distorted by turbulence sampled at a per-tile offset.
    ti = tile_id
    tx = np.clip(x - corner_x[ti] + off_x[ti], 0, S - 1).astype(np.int32)
    ty = np.clip(y - corner_y[ti] + off_y[ti], 0, S - 1).astype(np.int32)
    t = turb[ty, tx]
    del tx, ty
    phase = (x * np.cos(angle[ti]) + y * np.sin(angle[ti])) * freq[ti] + turb_k[ti] * t
    veins = (1 - np.abs(np.sin(phase))) ** vein_power[ti]  # thin bright ridges -> veins
    del phase

    light = np.array(LIGHT_TONES, np.float32)[light_tone[ti]]
    darkc = np.array(DARK_TONES, np.float32)[dark_tone[ti]]
    base = np.where(dark[..., None], darkc, light)
    # Light marble gets grey veins; dark marble gets pale veins.
    vein_col = np.where(dark[..., None], np.float32(200), np.float32(95))
    img = base * (1 + args.cloud * t[..., None]) * brightness[ti][..., None]
    img = img * (1 - veins[..., None] * 0.75) + vein_col * veins[..., None] * 0.75
    img *= (1 + 0.04 * fine[..., None])
    del veins, base

    # Grout lines, slightly irregular.
    fu, fv = u - iu, v - iv
    edge = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv)) * diag / math.sqrt(2)
    grout_w = S / 1100 * (1 + 0.5 * fine)
    grout = np.clip(1.5 - edge / grout_w, 0, 1)[..., None]
    grout_col = np.array(GROUT, np.float32) * args.grout_contrast + img * (1 - args.grout_contrast) * 0.85
    img = img * (1 - grout) + grout_col * (1 + 0.15 * fine[..., None]) * grout
    del fu, fv, edge

    # Large-scale wear and dirt: worn, slightly darker paths like a real old floor.
    img *= (1 - 0.12 * np.clip(wear, -1, 1)[..., None])
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")
    del img

    # A few cracks and chips, drawn on random tiles.
    draw = ImageDraw.Draw(out)
    for _ in range(int(args.tiles ** 2 * 0.6)):
        px, py = rng.uniform(0, S, 2)
        a = rng.uniform(0, 2 * math.pi)
        pts = [(px, py)]
        for _ in range(rng.integers(4, 12)):
            a += rng.normal(0, 0.5)
            step = rng.uniform(S / 300, S / 90)
            px, py = px + step * math.cos(a), py + step * math.sin(a)
            pts.append((px, py))
        shade = int(rng.uniform(30, 90))
        draw.line(pts, fill=(shade, shade - 4, shade - 8), width=max(1, S // 1500), joint="curve")
    for _ in range(int(args.tiles ** 2 * 0.4)):
        cx, cy = rng.uniform(0, S, 2)
        r = rng.uniform(S / 600, S / 250)
        c = int(rng.uniform(110, 170))
        draw.ellipse([cx - r, cy - r * rng.uniform(0.5, 1), cx + r, cy + r], fill=(c, c - 6, c - 14))

    if args.qr:
        # The four tiles around the centre form a diamond of diagonal 2 * diag: replace them with one slab.
        # Its own seed keeps the rest of the floor identical with or without the QR.
        side = int(round(2 * diag / math.sqrt(2)))
        inlay, version = qr_inlay(args.qr, side, args.seed + 1000, args.qr_texture)
        rotated = Image.fromarray(inlay).rotate(45, resample=Image.BICUBIC, expand=True)
        mask = Image.new("L", (side, side), 255).rotate(45, resample=Image.BICUBIC, expand=True)
        out.paste(rotated, (S // 2 - rotated.width // 2, S // 2 - rotated.height // 2), mask)
        half = diag
        ImageDraw.Draw(out).polygon([(S / 2, S / 2 - half), (S / 2 + half, S / 2), (S / 2, S / 2 + half), (S / 2 - half, S / 2)],
                                    outline=GROUT, width=max(2, int(S / 1100 * 2)))
        print(f"QR {version} -> {args.qr}")

    out = out.filter(ImageFilter.GaussianBlur(S / 4096 * 0.6))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    out.save(args.out_dir / "floor-print.png", optimize=True)
    out.resize((1024, 1024), Image.LANCZOS).save(args.out_dir / "floor.png", optimize=True)


if __name__ == "__main__":
    main()
