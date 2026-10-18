"""自製角色 sprite 生成器（個人自玩 mod）。

用法：  python tools/custom_sprites.py

讀取  custom-src/<角色>/<動作>_<方向>.(png|jpg)   ← Gemini 出嘅洋紅底多格圖
輸出  assets/pokemon/<編號>/<Anim>.png              ← 遊戲用 sprite sheet（8 個方向一行一個）
      js/data/custom-sprites.js                     ← 動作設定（格數、大細、腳位、速度）

方向：down / downright / right / upright / up。左邊三個方向自動由右邊反轉。
合併圖：walk_all / shoot_all / attack_all（三行：正面、右、背面）、misc（三行：待機、受傷、倒下）。
只交一個方向嘅動作（例如 hurt_down），全部方向都用同一行。
"""
import os, sys, json, glob
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(__file__))
from sprite_process import frames_from_sheet, build_sheet

ROOT = os.path.join(os.path.dirname(__file__), '..')
CHARS = {'zenitsu': 9001, 'ichigo': 9002,
         'ichigo_bankai': 9101, 'ichigo_hollow': 9102, 'ichigo_mugetsu': 9103,
         'ichigo_shinbankai': 9104, 'ichigo_vastolorde': 9105}   # 變身造型
ANIMS = {'idle': 'Idle', 'walk': 'Walk', 'attack': 'Attack', 'shoot': 'Shoot',
         'charge': 'Charge', 'hurt': 'Hurt', 'faint': 'Faint'}
# 身高（像素，按每張圖格仔高度嘅中位數計）。
HEIGHT = {'Idle': 48, 'Walk': 48, 'Attack': 48, 'Shoot': 48, 'Charge': 48, 'Hurt': 48, 'Faint': 48}
# 某啲動作只用頭幾格（例如 Gemini 將待機畫成踏步，就只要第 1 格）：(角色, 動作) -> 格數
KEEP = {('ichigo_shinbankai', 'Idle'): 1}
# 每格時間（1/60 秒），按格數平均分配
DUR = {'Idle': 10, 'Walk': 8, 'Attack': 4, 'Shoot': 5, 'Charge': 6, 'Hurt': 6, 'Faint': 10}
# 合併圖（一張圖多行，由上至下）：檔名 -> 每行係 (動作, 方向)
COMBINED = {
    'walk_all':  [('walk', 'down'), ('walk', 'right'), ('walk', 'up')],
    'shoot_all': [('shoot', 'down'), ('shoot', 'right'), ('shoot', 'up')],
    'attack_all': [('attack', 'down'), ('attack', 'right'), ('attack', 'up')],
    'misc':      [('idle', 'down'), ('hurt', 'down'), ('faint', 'down')],
}
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
    combined = []          # 合併圖：一張圖多行
    for f in files:
        base = os.path.splitext(os.path.basename(f))[0]
        if base in COMBINED: combined.append((base, f)); continue
        if '_' not in base: continue
        a, d = base.split('_', 1)
        if a in ANIMS and d in FALLBACK: by_anim.setdefault(ANIMS[a], {})[d] = f
    pre = {}               # (anim, 方向) -> 已切好嘅 frames
    for base, f in combined:
        layout = COMBINED[base]
        rows = frames_from_sheet(Image.open(f), HEIGHT[ANIMS[layout[0][0]]], by_row=True)
        if len(rows) != len(layout):
            print(f'  ⚠ {name}/{base}: 搵到 {len(rows)} 行，應該係 {len(layout)} 行，跳過')
            continue
        for (a, d), fr in zip(layout, rows):
            # 唔同動作嘅高度唔同：按目標高度比例縮放
            k = HEIGHT[ANIMS[a]] / HEIGHT[ANIMS[layout[0][0]]]
            if k != 1: fr = [x.resize((max(1, round(x.width * k)), max(1, round(x.height * k))), Image.NEAREST) for x in fr]
            pre[(ANIMS[a], d)] = fr
            by_anim.setdefault(ANIMS[a], {})[d] = None
    if not by_anim: return None
    out_dir = os.path.join(ROOT, 'assets', 'pokemon', str(dex))
    os.makedirs(out_dir, exist_ok=True)
    meta = {'s': 1, 'a': {}}
    for anim, have in by_anim.items():
        frames = {d: pre[(anim, d)] if f is None else frames_from_sheet(Image.open(f), HEIGHT[anim]) for d, f in have.items()}
        if (name, anim) in KEEP: frames = {d: v[:KEEP[(name, anim)]] for d, v in frames.items()}
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
        # 未有待機圖：用第一個動作嘅第 2 格（通常係企定嘅姿勢）做靜止待機，唔會成日郁
        first = next(iter(meta['a']))
        m = meta['a'][first]
        k = 1 if m['n'] > 1 else 0
        src = Image.open(os.path.join(out_dir, first + '.png'))
        src.crop((k * m['w'], 0, (k + 1) * m['w'], m['h'] * m['r'])).save(os.path.join(out_dir, 'Idle.png'), optimize=True)
        meta['a']['Idle'] = dict(m, n=1, d=[60])
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
