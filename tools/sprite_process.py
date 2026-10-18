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

def frames_from_sheet(img, h, min_area_frac=0.01, by_row=False):
    """將一張多格圖切成每格 sprite（按閱讀次序），全部統一高度比例、腳對齊。"""
    from scipy import ndimage
    a = np.array(img.convert('RGB'))
    fg = ~magenta_mask(a)
    # 合併附近嘅碎片（例如刀柄布條）
    big = ndimage.binary_dilation(fg, iterations=max(3, a.shape[0] // 60))
    lab, n = ndimage.label(big)
    boxes = []
    for sl in ndimage.find_objects(lab):
        hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if hh * ww > min_area_frac * a.shape[0] * a.shape[1]:
            boxes.append(sl)
    # 閱讀次序：先按行（用中心點分行），再按列
    boxes.sort(key=lambda s: (s[0].start + s[0].stop) / 2)
    rows, cur = [], []
    for s in boxes:
        if cur and (s[0].start + s[0].stop) / 2 - (cur[-1][0].start + cur[-1][0].stop) / 2 > (s[0].stop - s[0].start) * 0.5:
            rows.append(cur); cur = []
        cur.append(s)
    if cur: rows.append(cur)
    rows = [sorted(r, key=lambda s: s[1].start) for r in rows]
    # 用最高嗰格決定縮放比例，令全部格大細一致
    tallest = max(s[0].stop - s[0].start for r in rows for s in r)
    def conv(s):
        sub = a[s[0], s[1]]
        return to_sprite(Image.fromarray(sub), max(1, round(h * sub.shape[0] / tallest)))
    if by_row:
        return [[conv(s) for s in r] for r in rows]
    return [conv(s) for r in rows for s in r]

def build_sheet(frames_by_row, pad=2):
    """frames_by_row: 每個方向一行嘅 frame 列表。回傳 (sheet, w, h, ax, ay)；腳底對齊、水平置中。"""
    allf = [f for r in frames_by_row for f in r]
    w = max(f.width for f in allf) + pad * 2
    hgt = max(f.height for f in allf) + pad * 2
    n = max(len(r) for r in frames_by_row)
    sheet = Image.new('RGBA', (w * n, hgt * len(frames_by_row)), (0, 0, 0, 0))
    for ri, r in enumerate(frames_by_row):
        for ci, f in enumerate(r):
            sheet.alpha_composite(f, (ci * w + (w - f.width) // 2, ri * hgt + hgt - pad - f.height))
    ax, ay = w / 2 - 0.5, hgt - pad - 1.5
    return sheet, w, hgt, ax, ay
