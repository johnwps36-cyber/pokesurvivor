/* ============ custom.js — 自製角色（個人自玩 mod） ============
 * 所有自製內容集中喺呢個檔，唔改原作者嘅檔案，方便 GitHub「Sync fork」跟更新。
 * 喺 dev.html 入面 starters.js 之後載入。
 *
 * 加新角色：喺 CUSTOM_CHARS 加一項，再喺 assets/pokemon/<dex>/ 放圖。
 *   sprite: 'copy:<dex>'  暫時借用某隻寶可夢嘅圖（例如 25 = 皮卡丘）
 *   sprite: { ... }        自己嘅圖嘅設定（格式同 sprites-meta.js 一樣）
 *
 * 為咗唔會變成敵人／頭目或者喺扭蛋抽到：rarity 5 + bst 1 + 唔係 leg。
 */
(() => {
  const CUSTOM_MOVES = [
    { id: 'thunderclap-flash', name: '霹靂一閃', type: 'electric', kind: 'dash',
      desc: '雷之呼吸・壹之型：以雷電般嘅速度衝向敵人，斬開沿路所有嘢。',
      cd: 0.85, dmg: 34, radius: 160, width: 38, knock: 50,
      ladderFrom: 'quick-attack' }
  ];

  const CUSTOM_CHARS = [
    { dex: 9001, name: '我妻善逸', types: ['electric'],
      hp: 92, spd: 128, atk: 1.32,
      start: 'thunderclap-flash', sig: ['thunderclap-flash'],
      traits: ['tímido', 'valiente'],
      sprite: 'copy:25' }
  ];

  // ---- 招式 ----
  for (const m of CUSTOM_MOVES) {
    const base = G.Moves.BY_ID[m.ladderFrom];
    const def = Object.assign({}, m);
    delete def.ladderFrom;
    def.ups = base.ups;
    def.maxLvl = base.maxLvl;
    def.custom = true;
    G.Moves.ALL.push(def);
    G.Moves.BY_ID[def.id] = def;
  }

  // 專屬招式：只有 sig 入面列明嘅角色學到
  const origPool = G.Moves.poolFor;
  G.Moves.poolFor = mon => {
    const ids = origPool(mon);
    for (const id of (mon.sig || [])) if (G.Moves.BY_ID[id] && !ids.includes(id)) ids.push(id);
    return ids;
  };

  // ---- 角色 ----
  for (const c of CUSTOM_CHARS) {
    const entry = { dex: c.dex, name: c.name, types: c.types, hp: c.hp, spd: c.spd, atk: c.atk,
                    rarity: 5, bst: 1, starter: true, gen: 1, start: c.start, sig: c.sig, custom: true };
    G.DEX.push(entry);
    G.DEX_BY[c.dex] = entry;

    if (typeof c.sprite === 'string' && c.sprite.startsWith('copy:')) {
      const src = G.SPRITE_META[+c.sprite.slice(5)];
      const meta = JSON.parse(JSON.stringify(src));
      delete meta.sh; delete meta.sa; delete meta.sm;   // 冇 shiny 版
      G.SPRITE_META[c.dex] = meta;
    } else if (c.sprite) {
      G.SPRITE_META[c.dex] = c.sprite;
    }

    const st = { dex: c.dex, start: c.start, traits: c.traits };
    G.STARTERS.push(st);
    G.STARTER_BY[c.dex] = st;
  }
})();
