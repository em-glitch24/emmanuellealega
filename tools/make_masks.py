"""
Bakes the two alpha masks that drive the "face turning into code" effect.

  hero-solid-{a,b,c}.png  -> where the real photo stays visible (3 shimmer frames)
  hero-code.png           -> where the code layer shows (wider canvas: streaks
                             can leave the silhouette on the right)

Both are derived from hero.png only, so they line up pixel-for-pixel.
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SRC = str(ROOT / "images/hero.png")
OUT = str(ROOT / "tools") + "/"
rng = np.random.default_rng(7)

im = np.asarray(Image.open(SRC).convert("RGBA")).astype(np.float32) / 255.0
H, W = im.shape[:2]
A = im[..., 3]
PADR = int(round(W * 0.26))           # extra canvas on the right for streaks
CW = W + PADR

yy, xx = np.mgrid[0:H, 0:CW].astype(np.float32)
CUT = 0.512 * W + 0.012 * W * np.sin(yy / 63.0) + 0.01 * W * np.sin(yy / 17.0)
d = (xx - CUT) / W                    # signed distance right of the cut, in widths

smooth = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))

def cells(cw, ch, shape, seed):
    """blocky value noise, cell size cw x ch px"""
    r = np.random.default_rng(seed)
    h, w = shape
    small = r.random((int(np.ceil(h / ch)), int(np.ceil(w / cw)))).astype(np.float32)
    return np.kron(small, np.ones((ch, cw), np.float32))[:h, :w]

def rank_uniform(a):
    flat = a.ravel()
    order = flat.argsort().argsort().astype(np.float32)
    return (order / (flat.size - 1)).reshape(a.shape)

# ---------------------------------------------------------------- SOLID MASK
d_s = d[:, :W]
t = np.clip((d_s - 0.015) / 0.30, 0, 1)
keep_prob = (1 - t) ** 1.7            # 1 near the cut -> 0 far right

iso = 0.45 * cells(14, 14, (H, W), 1) + 0.35 * cells(6, 6, (H, W), 2) + 0.20 * cells(2, 2, (H, W), 3)
streak = 0.6 * cells(34, 3, (H, W), 4) + 0.4 * cells(12, 2, (H, W), 5)
w = np.clip(d_s / 0.25, 0, 1) * 0.65
n0 = rank_uniform((1 - w) * iso + w * streak)

u = np.arange(W, dtype=np.float32)[None, :] / W
v = np.arange(H, dtype=np.float32)[:, None] / H
edge = (np.clip(u / 0.14, 0, 1) * np.clip((1 - u) / 0.14, 0, 1)
        * np.clip((1 - v) / 0.30, 0, 1))          # same fades the old CSS mask drew

def solid(n):
    keep = np.maximum((keep_prob >= n), d_s < 0.01).astype(np.float32)   # never punch holes left of the cut
    keep = ndi.gaussian_filter(keep, 0.55)
    return np.clip(keep * edge, 0, 1)

variants = {"a": n0}
for k, seed in (("b", 11), ("c", 12)):       # same structure, ~25% of cells flip a bit
    jitter = cells(6, 6, (H, W), seed) - 0.5
    variants[k] = np.clip(n0 + 0.09 * jitter, 0, 0.9999)

def save_la(arr, name, levels=24):
    q = np.round(np.clip(arr, 0, 1) * (levels - 1)) / (levels - 1)
    a8 = np.clip(q * 255 + 0.5, 0, 255).astype(np.uint8)
    la = np.stack([np.full_like(a8, 255), a8], -1)
    Image.fromarray(la, "LA").save(OUT + name, optimize=True)

for k, n in variants.items():
    save_la(solid(n), f"hero-solid-{k}.png")

# ----------------------------------------------------------------- CODE MASK
lum = (0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2])
lum = ndi.gaussian_filter(lum, 1.3)
core = A > 0.9
lo, hi = np.percentile(lum[core], [4, 96])
Ln = np.clip((lum - lo) / (hi - lo), 0, 1)
shade = 0.42 + 0.58 * Ln ** 0.7            # eyes/brows/hair stay darker, skin glows

Apad = np.zeros((H, CW), np.float32); Apad[:, :W] = ndi.gaussian_filter(A, 0.8)
Spad = np.zeros((H, CW), np.float32); Spad[:, :W] = shade

ramp = smooth(-0.012, 0.15, d)
tex = 0.72 + 0.28 * cells(3, 3, (H, CW), 21)
cov = Apad * Spad * ramp * tex

# streaks: the code trails off to the right like data leaving the body
row_len = rng.exponential(0.09 * W, H).astype(np.float32)
row_len = ndi.uniform_filter1d(row_len, 3)
gate = ndi.uniform_filter1d((rng.random(H) < 0.5).astype(np.float32), 2)
row_len = (row_len * gate)[:, None] + 1e-3
out = cov.copy()
for k in range(2, int(0.34 * W), 2):
    sh = np.zeros_like(cov); sh[:, k:] = cov[:, :-k]
    out = np.maximum(out, sh * np.clip(1 - k / row_len, 0, 1) ** 1.5 * 0.9)

vv = np.arange(H, dtype=np.float32)[:, None] / H
out *= np.clip((1 - vv) / 0.30, 0, 1)                       # bottom fade
out *= np.clip((CW - np.arange(CW)[None, :]) / (0.08 * W), 0, 1)  # right fade
out = np.clip(out * 1.55, 0, 1) ** 0.85
save_la(out, "hero-code.png")

print("canvas", W, H, "code canvas", CW, H, "code width %", round(CW / W * 100, 2))

# quick preview of the masks on a dark background
bg = np.zeros((H, CW, 3), np.float32) + 0.05
photo = np.zeros((H, CW, 3), np.float32); photo[:, :W] = im[..., :3] * 0.55
sol = np.zeros((H, CW), np.float32); sol[:, :W] = solid(n0)
comp = bg * (1 - sol[..., None]) + photo * sol[..., None]
codec = np.array([0.80, 0.82, 1.0], np.float32)
comp = comp * (1 - out[..., None] * 0.9) + codec * out[..., None] * 0.9
Image.fromarray((np.clip(comp, 0, 1) * 255).astype(np.uint8)).save(OUT + "mask_preview.png")
