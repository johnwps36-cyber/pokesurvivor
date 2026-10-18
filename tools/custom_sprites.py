"""自製角色 sprite 生成器（個人自玩 mod）。

用法：  python tools/custom_sprites.py

讀取  custom-src/<角色>/<動作>_<方向>.(png|jpg)   ← Gemini 出嘅洋紅底多格圖
輸出  assets/pokemon/<編號>/<Anim>.png              ← 遊戲用 sprite sheet（8 個方向一行一個）
      js/data/custom-sprites.js                     ← 動作設定（格數、大細、腳位、速度）

方向：down / downright / right / upright / up。左邊三個方向自動由右邊反轉。
只交一個方向嘅動作（例如 hurt_down），全部方向都用同一行。
"""
import os, sys, json, glob
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(__file__))
from sprite_process import frames_from_sheet, build_sheet

ROOT = os.path.join(os.path.dirname(__file__), '..')
CHARS = {'zenitsu': 9001, 'ichigo': 9002}
ANIMS = {'idle': 'Idle', 'walk': 'Walk', 'attack': 'Attack', 'shoot': 'Shoot',
         'charge': 'Charge', 'hurt': 'Hurt', 'faint': 'Faint'}
# 最高嗰格嘅目標高度（像素）。攻擊動作有刀，所以高啲。
HEIGHT = {'Idle': 48, 'Walk': 48, 'Attack': 60, 'Shoot': 56, 'Charge': 52, 'Hurt': 46, 'Faint': 48}
# 每格時間（1/60 秒），按格數平均分配
DUR = {'Idle': 10, 'Walk': 8, 'Attack': 4, 'Shoot': 5, 'Charge': 6, 'Hurt': 6, 'Faint': 10}
# 8 行：0 下 1 右下 2 右 3 右上 4 上 5 左上 6 左 7 左下
ROWS = ['down', 'downright', 'right', 'upright', 'up', 'upleft', 'left', 'downleft']
MIRROR = {'upleft': 'upright', 'left': 'right', 'downleft': 'downright'}
FALLBACK = {'down': ['downright', 'right', 'up'], 'downright': ['down', 'right'], 'right': ['downright', 'upright', 'down'],
            'upright': ['up', 'right'], 'up': ['upright', 'right', 'down']}


def pick(have, d):
    """回傳 (來源方向, 要唔要反轉)。"""
    if d in have: return d, False
    if d in MIRROR:
        src, _ = pick(have, MIRROR[d])
        return src, True
    for f in FALLBACK[d]:
        if f in have: return f, False
    return next(iter(have)), False


def build_char(name, dex):
    files = glob.glob(os.path.join(ROOT, 'custom-src', name, '*.*'))
    by_anim = {}
    for f in files:
        base = os.path.splitext(os.path.basename(f))[0]
        if '_' not in base: continue
        a, d = base.split('_', 1)
        if a in ANIMS and d in FALLBACK: by_anim.setdefault(ANIMS[a], {})[d] = f
    if not by_anim: return None
    out_dir = os.path.join(ROOT, 'assets', 'pokemon', str(dex))
    os.makedirs(out_dir, exist_ok=True)
    meta = {'s': 1, 'a': {}}
    for anim, have in by_anim.items():
        frames = {d: frames_from_sheet(Image.open(f), HEIGHT[anim]) for d, f in have.items()}
        n = max(len(v) for v in frames.values())
        if len(have) == 1:
            rows = [next(iter(frames.values()))]
        else:
            rows = []
            for d in ROWS:
                src, flip = pick(have, d)
                fr = frames[src]
                rows.append([ImageOps.mirror(x) for x in fr] if flip else fr)
        rows = [r + [r[-1]] * (n - len(r)) for r in rows]          # 格數唔夠就重複最後一格
        sheet, w, h, ax, ay = build_sheet(rows)
        sheet.save(os.path.join(out_dir, anim + '.png'), optimize=True)
        d = [DUR[anim]] * n
        if anim == 'Idle' and n >= 2: d[0] = DUR[anim] * 3                 # 待機第一格停耐啲
        meta['a'][anim] = {'w': w, 'h': h, 'n': n, 'r': len(rows), 'd': d, 'ax': ax, 'ay': ay}
        print(f'  {name} {anim}: {n} 格 × {len(rows)} 行，{w}×{h}，來源方向 {sorted(have)}')
    if 'Idle' not in meta['a']:
        first = next(iter(meta['a']))
        meta['a']['Idle'] = meta['a'][first]
        Image.open(os.path.join(out_dir, first + '.png')).save(os.path.join(out_dir, 'Idle.png'))
    return meta


def main():
    all_meta = {}
    for name, dex in CHARS.items():
        m = build_char(name, dex)
        if m: all_meta[dex] = m
    js = ('/* ============ custom-sprites.js — 自製角色 sprite 設定 ============\n'
          ' * 由 tools/custom_sprites.py 生成，唔好手改。原圖喺 custom-src/。\n */\n'
          'G.CUSTOM_SPRITES = ' + json.dumps(all_meta, ensure_ascii=False) + ';\n')
    with open(os.path.join(ROOT, 'js', 'data', 'custom-sprites.js'), 'w', encoding='utf8') as f:
        f.write(js)
    print('ok:', ', '.join(str(k) for k in all_meta))


if __name__ == '__main__':
    main()
