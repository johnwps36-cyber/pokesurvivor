/* ============ ultimate.js — 必殺技同變身（個人自玩 mod） ============
 * - 打敗敵人儲「必殺計量」，滿咗就撳必殺掣（電腦：R 鍵）發動。
 * - 每個角色都有必殺：自製角色用專屬必殺，其他寶可夢用通用嘅「全力爆發」。
 * - 一護 15 級永久變身「卍解」。
 * - 變身造型：如果有對應編號嘅圖（例如 9102 = 一護虛化）就換圖，冇就用顏色特效頂住。
 */
(() => {
  const GAUGE_MAX = 100;
  const PER_KILL = 1;            // 每打敗一隻 +1（大約 100 隻儲滿）
  const PER_BOSS = 30;

  // ---------------- 必殺定義 ----------------
  // mods：dmg 傷害倍數、spd 速度倍數、cd 冷卻倍數（越細越快）；
  // god：無敵；nuke：清場；chain：連續雷擊 N 隻；form：變身用嘅圖編號；tint：光環顏色。
  const ULTS = {
    9002: [
      { name: '虛化', minLv: 1, dur: 15, mods: { dmg: 1.8, spd: 1.3, cd: 0.5 }, form: 9102, tint: '#c0102a',
        say: '虛化！' },
      { name: '無月', minLv: 40, dur: 10, mods: { dmg: 2.5, spd: 1.4, cd: 0.5 }, god: true, nuke: true, form: 9103, tint: '#20102a',
        say: '最後之月牙天衝・無月！' }
    ],
    9001: [
      { name: '漆之型・火雷神', minLv: 1, dur: 8, mods: { dmg: 1.5, spd: 1.6, cd: 0.6 }, god: true, chain: 14, tint: '#ffd23f',
        say: '雷之呼吸・漆之型・火雷神！' }
    ]
  };
  function defaultUlt(pl) {
    const col = G.U.TYPE_COLOR[pl.mon.types[0]] || '#ffd23f';
    return { name: '全力爆發', dur: 12, mods: { dmg: 1.6, spd: 1.25, cd: 0.7 }, tint: col, say: pl.mon.name + '・全力爆發！' };
  }
  function ultFor(pl) {
    const list = ULTS[pl.mon.dex];
    if (!list) return defaultUlt(pl);
    let pick = list[0];
    for (const u of list) if (pl.level >= u.minLv) pick = u;
    return pick;
  }

  // 永久變身：一護 15 級卍解
  const FORMS = {
    9002: [{ lv: 15, name: '卍解', dex: 9101, spd: 1.15, say: '卍解！天鎖斬月！', tint: '#2a2a3a' }]
  };

  // ---------------- 狀態 ----------------
  const U = { gauge: 0, active: null, t: 0, lastKills: 0, lastBosses: 0, pl: null, form: null };

  function reset(pl) {
    Object.assign(U, { gauge: 0, active: null, t: 0, lastKills: pl ? pl.kills : 0, lastBosses: pl ? pl.bosses : 0, pl, form: null });
  }

  function setSprite(pl, dex) {
    if (!G.SPRITE_META[dex]) return false;
    pl.dex = dex;
    pl.anim = new G.Sprites.Animator(dex, 1, false);
    G.Sprites.preload && G.Sprites.preload([dex], 4000, false);
    return true;
  }
  const baseSprite = pl => (U.form && G.SPRITE_META[U.form.dex]) ? U.form.dex : pl.mon.dex;

  function applyMods(pl, mods, on) {
    const k = on ? 1 : -1;
    const f = (v, x) => on ? v * x : v / x;
    if (mods.dmg) pl.atkMul = f(pl.atkMul, mods.dmg);
    if (mods.spd) pl.spdMul = f(pl.spdMul, mods.spd);
    if (mods.cd) pl.cdMul = f(pl.cdMul, mods.cd);
    return k;
  }

  // ---------------- 發動 ----------------
  function activate() {
    const pl = G.Game.player;
    if (!pl || pl.dead || U.active || U.gauge < GAUGE_MAX) return;
    if (G.Game.state !== 'playing') return;
    const u = ultFor(pl);
    U.active = u; U.t = u.dur; U.gauge = 0;
    applyMods(pl, u.mods, true);
    if (u.form) setSprite(pl, u.form);
    G.Spawner.say(u.say || u.name, 2.6, true);
    G.Game.flash(u.tint, 0.5);
    G.Camera.kick && G.Camera.kick(0.8);
    G.FX.ring(pl.x, pl.y, 10, 260, u.tint, 0.7, 8);
    G.FX.burst(pl.x, pl.y - 20, u.tint, 60, 320);
    G.Audio.sfx('legend');
    if (u.nuke) nuke(pl, u);
    if (u.chain) chain(pl, u);
  }

  function nuke(pl, u) {
    const list = G.EnemyMgr.all().filter(e => !e.dead);
    for (const e of list) {
      const dmg = e.boss ? e.maxHp * 0.35 : e.hp + 1;
      e.hurt(dmg, '#a0a0ff', e.x - pl.x, e.y - pl.y, 0, 'crit');
    }
    for (let i = 0; i < 6; i++) G.FX.beam(pl.x, pl.y - 16, -Math.PI / 2 + i * 1.047, 900, 60, '#1a0a20');
    G.FX.ring(pl.x, pl.y, 20, 900, '#000000', 1.0, 14);
  }

  function chain(pl, u) {
    let x = pl.x, y = pl.y;
    const left = G.EnemyMgr.all().filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const hits = left.slice(0, u.chain);
    hits.forEach((e, i) => setTimeout(() => {
      if (e.dead) return;
      const ang = Math.atan2(e.y - y, e.x - x), len = Math.hypot(e.x - x, e.y - y);
      G.FX.beam(x, y - 12, ang, len, 14, '#ffe14d');
      e.hurt((e.boss ? 400 : e.hp + 1), '#ffe14d', e.x - x, e.y - y, 60, 'crit');
      G.FX.burst(e.x, e.y - 10, '#ffe14d', 14, 200);
      x = e.x; y = e.y;
    }, i * 70));
  }

  function end(pl) {
    const u = U.active;
    applyMods(pl, u.mods, false);
    if (u.form) {
      const back = baseSprite(pl);
      if (!setSprite(pl, back)) { pl.dex = pl.mon.dex; pl.anim = new G.Sprites.Animator(pl.mon.dex, 1, pl.shiny); }
    }
    U.active = null;
    G.Spawner.say(u.name + ' 結束', 1.6, true);
  }

  // ---------------- 每幀 ----------------
  const upd = G.Player.prototype.update;
  G.Player.prototype.update = function (dt) {
    const r = upd.call(this, dt);
    if (this !== G.Game.player) return r;
    if (U.pl !== this) reset(this);
    // 儲計量
    const dk = this.kills - U.lastKills, db = this.bosses - U.lastBosses;
    if (!U.active && (dk > 0 || db > 0)) U.gauge = Math.min(GAUGE_MAX, U.gauge + dk * PER_KILL + db * PER_BOSS);
    U.lastKills = this.kills; U.lastBosses = this.bosses;
    // 必殺時間
    if (U.active) {
      if (U.active.god) this.invuln = Math.max(this.invuln, 0.1);
      if ((U.t -= dt) <= 0 || this.dead) end(this);
    }
    // 永久變身
    const forms = FORMS[this.mon.dex];
    if (forms) for (const f of forms) {
      if (this.level >= f.lv && (!U.form || U.form.lv < f.lv)) {
        U.form = f;
        if (f.spd) this.spdMul *= f.spd;
        if (!U.active) setSprite(this, f.dex);
        G.Spawner.say(f.say, 2.6, true);
        G.Game.flash(f.tint, 0.4);
        G.FX.ring(this.x, this.y, 10, 200, '#ffffff', 0.6, 6);
      }
    }
    return r;
  };

  // 必殺中：腳底光環同閃動
  const drw = G.Player.prototype.draw;
  G.Player.prototype.draw = function (ctx) {
    if (this === G.Game.player && U.active && !this.dead) {
      const u = U.active, t = performance.now() / 90;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t) * 0.15;
      ctx.fillStyle = u.tint;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 2.4, this.r * 1.0, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      if (Math.random() < 0.5) G.FX.burst(this.x + (Math.random() - 0.5) * 20, this.y - Math.random() * 40, u.tint, 1, 60);
    }
    return drw.call(this, ctx);
  };

  // 新一局重設
  const startRun = G.Game.startRun;
  G.Game.startRun = function (...a) { const r = startRun.apply(this, a); reset(G.Game.player); return r; };

  // ---------------- 必殺掣 ----------------
  function makeButton() {
    const b = document.createElement('button');
    b.id = 'ult-btn';
    b.setAttribute('translate', 'no');
    b.innerHTML = '<div class="ult-fill"></div><span class="ult-txt">必殺</span>';
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); activate(); });
    document.body.appendChild(b);
    return b;
  }
  let btn = null;
  function tick() {
    if (!btn && document.body) btn = makeButton();
    if (btn) {
      const pl = G.Game.player;
      const show = pl && !pl.dead && ['playing', 'levelup', 'paused', 'choice', 'held'].includes(G.Game.state);
      btn.style.display = show ? 'flex' : 'none';
      if (show) {
        const pct = U.active ? U.t / U.active.dur : U.gauge / GAUGE_MAX;
        btn.querySelector('.ult-fill').style.height = Math.round(pct * 100) + '%';
        const ready = !U.active && U.gauge >= GAUGE_MAX;
        btn.classList.toggle('ready', ready);
        btn.classList.toggle('on', !!U.active);
        const u = ultFor(pl);
        btn.querySelector('.ult-txt').textContent = U.active ? Math.ceil(U.t) + 's' : ready ? u.name : Math.floor(U.gauge) + '%';
        btn.style.setProperty('--ult', u.tint);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && !e.repeat) activate(); });

  const css = document.createElement('style');
  css.textContent = `
    #ult-btn { position: fixed; right: max(14px, env(safe-area-inset-right)); bottom: 96px; z-index: 30;
      width: 68px; height: 68px; border-radius: 50%; border: 3px solid #e8ecff; background: rgba(10,16,40,.75);
      display: none; align-items: center; justify-content: center; overflow: hidden; padding: 0; touch-action: none;
      color: #fff; font: 700 13px/1.1 'Pixelify Sans', sans-serif; text-shadow: 1px 1px 0 #000; }
    #ult-btn .ult-fill { position: absolute; left: 0; right: 0; bottom: 0; background: var(--ult, #ffd23f); opacity: .55; }
    #ult-btn .ult-txt { position: relative; text-align: center; padding: 0 4px; }
    #ult-btn.ready { border-color: #ffd23f; animation: ult-pulse .7s ease-in-out infinite alternate; }
    #ult-btn.on { border-color: var(--ult, #ffd23f); }
    @keyframes ult-pulse { from { box-shadow: 0 0 6px 2px var(--ult, #ffd23f); } to { box-shadow: 0 0 22px 8px var(--ult, #ffd23f); } }
    @media (orientation: portrait) { #ult-btn { bottom: 120px; } }
  `;
  document.head.appendChild(css);

  // 金手指：即刻儲滿必殺
  G.CustomUlt = { fill() { U.gauge = GAUGE_MAX; }, get state() { return U; }, activate };
})();
