/* ============ cheats.js — 金手指（個人自玩 mod） ============
 * 暫停畫面：只影響今局（開新一局會重設）。
 * 設定 → 音效分頁：改存檔（金幣、扭蛋券、解鎖、成就、強化）。
 * 全部自製內容放喺 js/custom/ 同 js/data/custom.js，唔改原作者嘅畫面。
 */
(() => {
  const C = { god: false, ohk: false, fast: false };
  const $ = id => document.getElementById(id);
  const toast = (t, ms = 2000) => G.UI.toast(t, ms);

  // ---------------- 效果 ----------------
  const hurtP = G.Player.prototype.hurt;
  G.Player.prototype.hurt = function (amount, ...rest) {
    if (C.god && this === G.Game.player) return;
    return hurtP.call(this, amount, ...rest);
  };

  const hurtE = G.Enemy.prototype.hurt;
  G.Enemy.prototype.hurt = function (amount, ...rest) {
    if (C.ohk && amount > 0 && this.hp > 0) amount = Math.max(amount, this.hp + 1);
    return hurtE.call(this, amount, ...rest);
  };

  const spdDesc = Object.getOwnPropertyDescriptor(G.Player.prototype, 'spd');
  Object.defineProperty(G.Player.prototype, 'spd', {
    configurable: true,
    get() { const s = spdDesc.get.call(this); return C.fast && this === G.Game.player ? s * 1.7 : s; }
  });

  // 新一局：重設今局嘅金手指
  const startRun = G.Game.startRun;
  G.Game.startRun = function (...a) { C.god = C.ohk = C.fast = false; return startRun.apply(this, a); };

  function setHpMul(pl, k) {
    const cur = pl._hpMul || 1;
    const ratio = pl.hp / pl.maxHp;
    pl.maxHp = Math.round(pl.maxHp / cur * k);
    pl.hp = Math.max(1, Math.round(pl.maxHp * ratio));
    pl._hpMul = k;
  }

  const RUN = [
    { id: 'god',  t: '無敵',     toggle: 'god' },
    { id: 'ohk',  t: '秒殺',     toggle: 'ohk' },
    { id: 'fast', t: '移動加速', toggle: 'fast' },
    { id: 'heal', t: '回滿血',   run: pl => { pl.hp = pl.maxHp; toast('血量已回滿'); } },
    { br: '血量倍數' },
    { id: 'hp1',  t: '×1',  mul: 1 },
    { id: 'hp2',  t: '×2',  mul: 2 },
    { id: 'hp5',  t: '×5',  mul: 5 },
    { id: 'hp10', t: '×10', mul: 10 },
    { br: '' },
    { id: 'lv1',  t: '升 1 級', run: () => { G.Game.debugLevelUp(); toast('繼續遊戲後揀升級卡'); } },
    { id: 'lv5',  t: '升 5 級', run: () => { for (let i = 0; i < 5; i++) G.Game.debugLevelUp(); toast('繼續遊戲後揀升級卡'); } },
    { id: 'mmax', t: '招式全滿級', run: pl => { for (const m of pl.moves) while (G.Moves.levelUp(m)); toast('所有招式升到最高級'); } },
    { id: 'mevo', t: '招式進化', run: pl => {
        let n = 0;
        for (const m of pl.moves) {
          if (m.kind === 'buff' || m.evolved || !G.Moves.EVO[m.id]) continue;
          while (G.Moves.levelUp(m));
          if (G.Moves.evolve(m)) { n++; G.Progress.event('evolve', { move: m.id }); }
        }
        toast(n ? `進化咗 ${n} 個招式` : '冇招式可以進化');
      } },
    { id: 'item', t: '換道具', run: pl => {
        const ids = G.Items.LIST.map(i => i.id).filter(id => id !== pl.item);
        const id = ids[Math.floor(Math.random() * ids.length)];
        $('btn-resume').click();
        setTimeout(() => G.Game.offerItem(id), 50);
      } },
    { id: 'coin', t: '這局金幣 +500', run: pl => { pl.coins += 500; toast('今局金幣 +500'); } },
    { id: 'time', t: '時間 +30 分鐘', run: () => { G.Game.debugTime(G.Game.st.time + 1800); toast('時間 +30 分鐘'); } }
  ];

  function renderRun(box) {
    const pl = G.Game.player;
    if (!pl) { box.innerHTML = ''; return; }
    let html = '<h3 class="cheat-h">金手指（這一局）</h3><div class="cheat-grid">';
    for (const b of RUN) {
      if (b.br != null) {
        html += '</div>' + (b.br ? `<p class="cheat-sub">${b.br}（${Math.round(pl.hp)} / ${Math.round(pl.maxHp)}）</p>` : '') + '<div class="cheat-grid">';
        continue;
      }
      const on = b.toggle ? C[b.toggle] : b.mul ? (pl._hpMul || 1) === b.mul : false;
      html += `<button class="btn small cheat-btn${on ? ' on' : ''}" data-c="${b.id}">${b.t}${b.toggle && on ? ' ✓' : ''}</button>`;
    }
    box.innerHTML = html + '</div>';
    box.querySelectorAll('[data-c]').forEach(el => {
      el.onclick = () => {
        const b = RUN.find(x => x.id === el.dataset.c);
        const p = G.Game.player;
        if (!p) return;
        if (b.toggle) C[b.toggle] = !C[b.toggle];
        else if (b.mul) setHpMul(p, b.mul);
        else b.run(p);
        G.Audio.sfx && G.Audio.sfx('pick');
        renderRun(box);
      };
    });
  }

  const showPause = G.RunUI.showPause;
  G.RunUI.showPause = function (...a) {
    const r = showPause.apply(this, a);
    let box = $('pause-cheats');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pause-cheats';
      box.className = 'cheat-box';
      box.setAttribute('translate', 'no');
      const row = $('btn-resume').parentElement;
      row.parentElement.insertBefore(box, row);
    }
    renderRun(box);
    return r;
  };

  // ---------------- 存檔金手指（設定 → 音效） ----------------
  function commit(msg) { G.DB.commit(); toast(msg); }
  const SAVE = [
    { br: '金幣與扭蛋券' },
    { t: '金幣 +10,000',    run: s => { s.coins += 10000; commit('金幣 +10,000'); } },
    { t: '金幣 +100,000',   run: s => { s.coins += 100000; commit('金幣 +100,000'); } },
    { t: '扭蛋券×1 +100',  run: s => { s.tickets.t1 += 100; commit('扭蛋券×1 +100'); } },
    { t: '扭蛋券×10 +20',  run: s => { s.tickets.t10 += 20; commit('扭蛋券×10 +20'); } },
    { br: '收藏' },
    { t: '解鎖全部寶可夢', run: () => {
        let n = 0;
        for (const p of G.DEX) if (G.SPRITE_META[p.dex] && !G.DB.owns(p.dex)) { G.DB.grant(p.dex, 'gacha'); n++; }
        commit(`解鎖咗 ${n} 隻`);
      } },
    { t: '解鎖全部色違', run: () => {
        let n = 0;
        for (const p of G.DEX) {
          const m = G.SPRITE_META[p.dex];
          if (m && m.sh && !G.DB.ownsShiny(p.dex)) { if (!G.DB.owns(p.dex)) G.DB.grant(p.dex, 'gacha'); G.DB.grantShiny(p.dex, 'gacha'); n++; }
        }
        commit(`解鎖咗 ${n} 隻色違`);
      } },
    { t: '全部成就與稱號', run: s => {
        const now = Date.now();
        for (const a of G.AchDefs.LIST) if (!s.ach[a.id]) s.ach[a.id] = now;
        commit('已取得全部成就');
      } },
    { br: '強化' },
    { t: '目前夥伴強化全滿', run: s => { maxUpg(s, s.partner); commit('夥伴強化全滿'); } },
    { t: '全部強化全滿', run: s => { for (const d of Object.keys(s.owned)) maxUpg(s, +d); commit('全部強化全滿'); } }
  ];
  function maxUpg(s, dex) {
    if (dex == null) return;
    const lv = {};
    for (const u of G.Upgrades.LIST) lv[u.id] = u.max;
    s.pupg[dex] = lv;
  }

  function renderSave(box) {
    let html = '<h3 class="cheat-h">金手指（存檔）</h3>';
    let open = false;
    SAVE.forEach((b, i) => {
      if (b.br) { if (open) html += '</div>'; html += `<p class="cheat-sub">${b.br}</p><div class="cheat-grid">`; open = true; return; }
      html += `<button class="btn small cheat-btn" data-s="${i}">${b.t}</button>`;
    });
    box.innerHTML = html + (open ? '</div>' : '');
    box.querySelectorAll('[data-s]').forEach(el => {
      el.onclick = () => {
        const s = G.DB.save;
        if (!s) { toast('請先登入'); return; }
        SAVE[+el.dataset.s].run(s);
        if (G.Game.state === 'ui' && G.MenuUI && G.UI.isOpen && G.UI.isOpen('scr-menu')) G.MenuUI.open();
      };
    });
  }

  // 設定嘅音效分頁一出現，就喺下面加金手指
  function hookSettings() {
    const body = $('set-body');
    if (!body) return;
    new MutationObserver(() => {
      if ($('set-sound') && !$('set-cheats')) {
        const box = document.createElement('div');
        box.id = 'set-cheats';
        box.className = 'cheat-box';
        box.setAttribute('translate', 'no');
        body.appendChild(box);
        renderSave(box);
      }
    }).observe(body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookSettings);
  else hookSettings();

  // ---------------- 樣式 ----------------
  const css = document.createElement('style');
  css.textContent = `
    .cheat-box { margin: 12px 0 10px; padding: 10px 12px; border: 2px dashed rgba(255,210,63,.55); border-radius: 10px; text-align: left; }
    .cheat-h { color: #ffd23f; font-size: 16px; margin: 0 0 6px; }
    .cheat-sub { color: #b9c6e8; font-size: 13px; margin: 8px 0 4px; }
    .cheat-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .cheat-btn.on { background: #3f8a4a; border-color: #8ee08f; color: #fff; }
    #scr-pause .box { max-height: 92vh; overflow-y: auto; }
  `;
  document.head.appendChild(css);
})();
