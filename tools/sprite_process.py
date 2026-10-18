"""把 Gemini 出嘅洋紅底點陣圖，轉成遊戲用嘅細 sprite。"""
from PIL import Image
import numpy as np, sys

def magenta_mask(a, loose=False):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    k = 40 if loose else 80
    return (r - g > k) & (b - g > k) & (abs(r - b) < 90)

def to_sprite(img, h, colors=24):
    a = np.array(img.convert('RGB'))
    bg = magenta_mask(a)
    ys, xs = np.where(~bg)
    a = a[ys.min():ys.max()+1, xs.min():xs.max()+1]; bg = bg[ys.min():ys.max()+1, xs.min():xs.max()+1]
    w = max(1, round(a.shape[1] * h / a.shape[0]))
    # 背景先填深色，避免縮細時洋紅色滲入邊緣
    fill = a.copy(); fill[bg] = (24, 22, 30)
    rgb = Image.fromarray(fill).resize((w, h), Image.BOX)
    al = np.array(Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).resize((w, h), Image.BOX)) > 120
    q = np.array(rgb.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB'))
    # 殘留洋紅 → 外框色
    mm = magenta_mask(q, loose=True); q[mm] = (24, 22, 30)
    # 邊緣像素加深，做出 1px 外框
    pad = np.pad(al, 1)
    edge = al & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    q[edge] = (q[edge] * 0.3).astype(np.uint8)
    out = np.dstack([q, np.where(al, 255, 0).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')

if __name__ == '__main__':
    to_sprite(Image.open(sys.argv[1]), int(sys.argv[3])).save(sys.argv[2])

def _segments(counts, min_gap, min_len):
    """一維投影：連續有內容嘅區段（相隔少過 min_gap 嘅會合併），太短嘅丟棄。"""
    on = counts > 0
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None: start = i
        if not v and start is not None: segs.append([start, i]); start = None
    if start is not None: segs.append([start, len(on)])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap: merged[-1][1] = s[1]
        else: merged.append(s)
    return [s for s in merged if s[1] - s[0] >= min_len]


def frames_from_sheet(img, h, min_area_frac=0.01, by_row=False):
    """將一張多格圖切成每格 sprite（按閱讀次序），全部統一縮放比例。
    先用橫向空白位分行，再喺每行用直向空白位分格。"""
    a = np.array(img.convert('RGB'))
    fg = ~magenta_mask(a)
    H, W = fg.shape
    noise = max(2, W // 400)                       # 少過幾粒像素當雜訊
    rows = _segments((fg.sum(1) > noise).astype(int), max(3, H // 300), H // 20)
    cells = []
    for r0, r1 in rows:
        band = fg[r0:r1]
        cols = _segments((band.sum(0) > noise // 2).astype(int), max(3, W // 300), 1)
        # 太窄嘅碎片（例如飄出去嘅布條）併入最近嗰格
        minw = (r1 - r0) * 0.25
        merged = []
        for c in cols:
            if merged and (c[1] - c[0] < minw or merged[-1][1] - merged[-1][0] < minw) and c[0] - merged[-1][1] < (r1 - r0) * 0.3:
                merged[-1][1] = c[1]
            else:
                merged.append(c)
        row_cells = []
        for c0, c1 in merged:
            sub = fg[r0:r1, c0:c1]
            ys, xs = np.where(sub)
            if len(ys) < min_area_frac * 0.2 * H * W: continue
            row_cells.append((slice(r0 + ys.min(), r0 + ys.max() + 1), slice(c0 + xs.min(), c0 + xs.max() + 1)))
        if row_cells: cells.append(row_cells)
    # 縮放比例用「中位數高度」＝大約嘅身高：舉高把刀嘅格唔會令成個人縮細
    hs = sorted(s[0].stop - s[0].start for r in cells for s in r)
    ref = hs[len(hs) // 2]
    def conv(s):
        sub = a[s[0], s[1]]
        return to_sprite(Image.fromarray(sub), max(1, round(h * sub.shape[0] / ref)))
    if by_row:
        return [[conv(s) for s in r] for r in cells]
    return [conv(s) for r in cells for s in r]

def feet_x(f):
    """腳嘅水平位置：最底 15% 嘅不透明像素嘅中位數。"""
    al = np.array(f.split()[3]) > 0
    ys, xs = np.where(al)
    if not len(ys): return f.width / 2
    low = xs[ys >= ys.max() - max(2, int(f.height * 0.15))]
    return float(np.median(low))


def build_sheet(frames_by_row, pad=2):
    """frames_by_row: 每個方向一行嘅 frame 列表。回傳 (sheet, w, h, ax, ay)；腳底對齊、腳嘅位置對準中線。"""
    allf = [f for r in frames_by_row for f in r]
    half = max(max(feet_x(f), f.width - feet_x(f)) for f in allf)
    w = int(np.ceil(half * 2)) + pad * 2
    hgt = max(f.height for f in allf) + pad * 2
    n = max(len(r) for r in frames_by_row)
    sheet = Image.new('RGBA', (w * n, hgt * len(frames_by_row)), (0, 0, 0, 0))
    for ri, r in enumerate(frames_by_row):
        for ci, f in enumerate(r):
            x = int(round(w / 2 - feet_x(f)))
            sheet.alpha_composite(f, (ci * w + x, ri * hgt + hgt - pad - f.height))
    ax, ay = w / 2 - 0.5, hgt - pad - 1.5
    return sheet, w, hgt, ax, ay
