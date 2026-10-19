/* ============ custom.js — 自製角色（個人自玩 mod） ============
 * 所有自製內容集中喺呢個檔，唔改原作者嘅檔案，方便 GitHub「Sync fork」跟更新。
 * 喺 dev.html 入面 starters.js 之後載入。
 *
 * 加新角色：喺 CUSTOM_CHARS 加一項，再喺 assets/pokemon/<dex>/ 放圖。
 *   sprite: 'copy:<dex>'  暫時借用某隻寶可夢嘅圖（例如 25 = 皮卡丘）
 *   sprite: 'custom'       自己嘅圖：設定喺 js/data/custom-sprites.js（由 tools/custom_sprites.py 生成）
 *   sprite: { ... }        直接寫設定（格式同 sprites-meta.js 一樣）
 *
 * 為咗唔會變成敵人／頭目或者喺扭蛋抽到：rarity 5 + bst 1 + 唔係 leg。
 */
(() => {
  const CUSTOM_MOVES = [
    { id: 'thunderclap-flash', name: '霹靂一閃', type: 'electric', kind: 'dash',
      desc: '雷之呼吸・壹之型：以雷電般嘅速度衝向敵人，斬開沿路所有嘢。',
      cd: 0.85, dmg: 34, radius: 160, width: 38, knock: 50,
      ladderFrom: 'quick-attack', evo: ['霹靂一閃・六連', 'spd'] },
    { id: 'getsuga-tensho', name: '月牙天衝', type: 'ghost', kind: 'beam',
      desc: '向前方斬出巨大嘅月牙，穿透所有敵人。',
      cd: 1.1, dmg: 30, radius: 220, width: 30,
      ladderFrom: 'psybeam', evo: ['黑月牙天衝', 'atk'] },
    { id: 'bankai-tensa', name: '卍解・天鎖斬月', type: 'ghost', kind: 'buff',
      desc: '無傷害：使用期間不斷累積速度。',
      cd: 0.85, stat: 'spd', amount: 0.14, dur: 8, stacks: 5,
      ladderFrom: 'agility' },
    { id: 'drill-missile', name: '鑽頭飛彈', type: 'steel', kind: 'projectile',
      desc: '由手臂射出旋轉鑽頭，穿透敵人。',
      cd: 1.0, dmg: 26, speed: 300, count: 1, spread: 0.12, pierce: 3, life: 0.8, size: 9, knock: 40,
      ladderFrom: 'rock-throw', evo: ['螺旋鑽頭風暴', 'atk'] }
  ];

  const CUSTOM_CHARS = [
    { dex: 9001, name: '我妻善逸', types: ['electric'],
      hp: 92, spd: 128, atk: 1.32,
      start: 'thunderclap-flash', sig: ['thunderclap-flash'],
      traits: ['tímido', 'valiente'],
      sprite: 'copy:25' },
    { dex: 9002, name: '黑崎一護', types: ['ghost', 'fighting'],
      hp: 100, spd: 112, atk: 1.38,
      start: 'getsuga-tensho', sig: ['getsuga-tensho', 'bankai-tensa'],
      traits: ['valiente', 'tenaz'],
      sprite: 'custom' },
    { dex: 9003, name: '紅蓮螺巖', types: ['steel', 'ground'],
      hp: 120, spd: 100, atk: 1.35,
      start: 'drill-missile', sig: ['drill-missile'],
      traits: ['valiente', 'tenaz'],
      sprite: 'custom' }
  ];

  // ---- 招式 ----
  for (const m of CUSTOM_MOVES) {
    const base = G.Moves.BY_ID[m.ladderFrom];
    const def = Object.assign({}, m);
    delete def.ladderFrom; delete def.evo;
    def.ups = base.ups;
    def.maxLvl = base.maxLvl;
    def.custom = true;
    G.Moves.ALL.push(def);
    G.Moves.BY_ID[def.id] = def;
    if (m.evo) G.Moves.EVO[def.id] = m.evo;   // [進化後名稱, 需要嘅升級卡]
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
    } else if (c.sprite === 'custom') {
      if (G.CUSTOM_SPRITES && G.CUSTOM_SPRITES[c.dex]) G.SPRITE_META[c.dex] = G.CUSTOM_SPRITES[c.dex];
    } else if (c.sprite) {
      G.SPRITE_META[c.dex] = c.sprite;
    }

    const st = { dex: c.dex, start: c.start, traits: c.traits };
    G.STARTERS.push(st);
    G.STARTER_BY[c.dex] = st;
  }

  // 變身造型（例如 9101 卍解、9102 虛化）：唔係可揀嘅角色，只係登記圖，等變身時換得到
  for (const d in (G.CUSTOM_SPRITES || {})) if (!G.SPRITE_META[d]) G.SPRITE_META[d] = G.CUSTOM_SPRITES[d];
})();
