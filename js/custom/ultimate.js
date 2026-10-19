/* ============ ultimate.js — 必殺技同形態切換（個人自玩 mod） ============
 * 必殺：打敗敵人儲計量，滿咗撳必殺掣發動（電腦：R）。
 *       計量未滿時撳必殺掣＝轉下一個已解鎖嘅必殺；長按都可以轉（電腦：T）。
 * 形態：有形態嘅角色（一護、紅蓮螺巖）會多一排形態掣（1、2、3），撳邊個就轉邊個，
 *       唔會暫停遊戲，每次轉完有 3 秒冷卻（電腦：F 轉下一個）。
 * 其他寶可夢：通用必殺「全力爆發」，冇形態。
 * 造型圖：有對應編號嘅圖（例如 9101 = 卍解）就換圖，冇就用顏色光環頂住。
 */
(() => {
  const GAUGE_MAX = 100, PER_KILL = 1, PER_BOSS = 30;
  const FORM_CD = 3;

  // ---------------- 角色設定 ----------------
  // mods：dmg 傷害倍數、spd 速度倍數、cd 冷卻倍數（越細越快）
  const CHARS = {
    9002: {
      forms: [
        { name: '始解', lv: 1, dex: 9002, mods: {}, tint: '#ff8a2a' },
        { name: '卍解', lv: 15, dex: 9101, mods: { spd: 1.3, cd: 0.6, dmg: 0.85 }, tint: '#6a6a90' },
        { name: '血鎖', lv: 60, dex: 9104, mods: { cd: 1.2 }, dual: true, tint: '#ff3030' }
      ],
      ults: [
        { name: '虛化', lv: 1, dur: 15, mods: { dmg: 1.8, spd: 1.3, cd: 0.5 }, form: 9102, tint: '#c0102a', say: '虛化！' },
        { name: '完全虛化', lv: 30, dur: 15, mods: { dmg: 2.2 }, god: true, cero: true, form: 9105, tint: '#e8e8f0', say: '完全虛化！' },
        { name: '無月', lv: 45, dur: 10, mods: { dmg: 2.5, spd: 1.4, cd: 0.5 }, god: true, nuke: true, form: 9103, tint: '#20102a',
          say: '最後之月牙天衝・無月！' }
      ]
    },
    9003: {
      forms: [
        { name: '紅蓮', lv: 1, dex: 9003, mods: {}, tint: '#e83020' },
        { name: '超銀河', lv: 30, dex: 9201, mods: { dmg: 1.2, spd: 0.85 }, fan: 3, tint: '#ffc830' },
        { name: '天元', lv: 60, dex: 9202, mods: { dmg: 1.6, spd: 0.8, cd: 1.2 }, fan: 3, bigDrill: true, tint: '#40ff70' }
      ],
      ults: [
        { name: '極巨鑽頭破', lv: 1, dur: 0.8, god: true, drill: true, tint: '#e83020', say: '極巨鑽頭破！' },
        { name: '超天元突破', lv: 60, dur: 12, mods: { dmg: 2.5 }, god: true, planets: 0.8, finale: true, giant: true,
          tint: '#40ffd0', say: '超天元突破・紅蓮螺巖！' }
      ]
    },
    9001: {
      ults: [
        { name: '火雷神', lv: 1, dur: 8, mods: { dmg: 1.5, spd: 1.6, cd: 0.6 }, god: true, chain: 14, tint: '#ffd23f',
          say: '雷之呼吸・漆之型・火雷神！' }
      ]
    }
  };
  const DUAL_MOVES = ['getsuga-tensho'];
  const FAN_MOVES = ['drill-missile'];

  // ---------------- 鑽頭（紅蓮螺巖） ----------------
  // 像素鑽頭（向右，兩格輪住轉）：鑽頭飛彈、極巨鑽頭破、天元突破都用
  G.VFX.SHAPES.drill = { w: 15, h: 9, dir: true, frames: 2, gen(P, f) {
    P.fill((x, y) => {
      const half = 4.2 * (1 - x / 14), d = Math.abs(y - 4);
      if (x < 2 || d > half + 0.2) return null;
      const stripe = (x + f * 2 + (y < 4 ? 0 : 1)) % 4 < 2;
      return y < 4 ? (stripe ? 'w' : 'l') : (stripe ? 'l' : 'm');
    });
    for (let y = 1; y <= 7; y++) { P.set(0, y, 'd'); P.set(1, y, 'm'); }
    P.outline();
  } };
  // 天元突破形態用嘅巨型鑽頭（大一倍）
  G.VFX.SHAPES.drillBig = { w: 29, h: 17, dir: true, frames: 2, gen(P, f) {
    P.fill((x, y) => {
      const half = 8.2 * (1 - x / 28), d = Math.abs(y - 8);
      if (x < 3 || d > half + 0.3) return null;
      const stripe = (x + f * 3 + (y < 8 ? 0 : 2)) % 6 < 3;
      return y < 8 ? (stripe ? 'w' : 'l') : (stripe ? 'l' : 'm');
    });
    for (let y = 2; y <= 14; y++) { P.set(0, y, 'd'); P.set(1, y, 'm'); P.set(2, y, 'm'); }
    P.outline();
  } };
  // 天元突破形態：所有鑽頭飛彈變巨型，穿透多 3 隻
  const projSpawn = G.Projectiles.spawn;
  G.Projectiles.spawn = function (o) {
    const pl = G.Game.player;
    if (pl && o && o.owner === pl && o.vis && o.vis.proj === 'drill') {
      const f = curForm(pl);
      if (f && f.bigDrill) {
        o.vis = { proj: 'drillBig', pal: 'steel', trail: 'spark' };
        o.r = (o.r || 9) * 1.8; o.pierce = (o.pierce || 0) + 3;
      }
    }
    return projSpawn.apply(this, arguments);
  };
  const forMove = G.VFX.forMove;
  G.VFX.forMove = m => m && m.id === 'drill-missile' ? { proj: 'drill', pal: 'steel', trail: 'spark' } : forMove(m);

  function spawnDrill(pl, ang, dmg, o = {}) {
    const sp = o.speed || 300;
    G.Projectiles.spawn({
      x: pl.x + Math.cos(ang) * 3, y: pl.y + Math.sin(ang) * 3,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      dmg, r: o.size || 9, life: o.life || 0.8, pierce: o.pierce == null ? 3 : o.pierce,
      color: '#cad6e2', homing: 0, hits: new Set(), vis: { proj: 'drill', pal: 'steel', trail: 'spark' },
      ghost: false, owner: pl, burn: 0, poison: 0, slow: 0, knock: o.knock || 40, mtype: 'steel'
    });
  }

  // 極巨鑽頭破：向前衝，沿路普通敵人一擊打倒，頭目扣 15% 血
  function gigaDrill(pl) {
    const ang = pl.aim, ca = Math.cos(ang), sa = Math.sin(ang), sx = pl.x, sy = pl.y;
    let len = 0;
    for (let d = 8; d <= 380; d += 8) {
      if (!G.World.isFree(sx + ca * d, sy + sa * d, pl.r * 0.8, true)) break;
      len = d;
    }
    for (let d = 0; d <= len; d += 18) G.FX.sp('drill', 'steel', sx + ca * d, sy + sa * d - G.LIFT * 0.6, { life: 0.35, angle: ang, scale: 3 });
    G.FX.sp('drill', 'steel', sx + ca * (len + 20), sy + sa * (len + 20) - G.LIFT * 0.6, { life: 0.5, angle: ang, scale: 5 });
    pl.x = sx + ca * len; pl.y = sy + sa * len;
    G.World.collide(pl);
    const W = 70;
    for (const e of G.EnemyMgr.queryCircle(sx + ca * len / 2, sy + sa * len / 2, len / 2 + W)) {
      if (e.dead) continue;
      const px = e.x - sx, py = e.y - sy, along = px * ca + py * sa;
      if (along < -e.r - 20 || along > len + e.r + 40 || Math.abs(-px * sa + py * ca) > W / 2 + e.r) continue;
      e.hurt(e.boss ? e.maxHp * 0.15 : e.hp + 1, '#ff6040', ca, sa, 120, 'crit');
    }
    if (pl.anim && pl.anim.play) pl.anim.play('Attack', { speed: 1.5 });
    G.Camera.kick(0.3);
    G.FX.burst(pl.x, pl.y - 20, '#ffd060', 40, 300);
  }

  // ---------------- 超天元突破：掟星球 ----------------
  const PLANET_KINDS = [
    { base: '#2a7ae0', dark: '#123a80', spot: '#40c060', ring: null },           // 地球
    { base: '#e06a30', dark: '#803018', spot: '#ffb070', ring: null },           // 火星
    { base: '#a060e0', dark: '#4a2080', spot: '#e0b0ff', ring: '#ffe0a0' },      // 有環氣體星球
    { base: '#e0c060', dark: '#806020', spot: '#fff0b0', ring: '#c0a060' }       // 土星
  ];
  const planets = [];
  // 由空中掟落 (tx, ty)：落地爆炸。big = 完結嗰個超巨型星球
  function throwPlanet(pl, tx, ty, big) {
    const k = PLANET_KINDS[Math.floor(Math.random() * PLANET_KINDS.length)];
    const sx = pl.x + (Math.random() - 0.5) * 120, sy = pl.y - (big ? 900 : 420);
    planets.push({ pl, sx, sy, tx, ty, x: sx, y: sy, t: 0, life: big ? 0.9 : 0.5, R: big ? 220 : 26,
                   blast: big ? 99999 : 110, big, k, spin: Math.random() * 6 });
  }
  function planetHit(o) {
    const pl = o.pl;
    if (o.big) {
      for (const e of G.EnemyMgr.all().filter(e => !e.dead)) {
        e.hurt(e.boss ? e.maxHp * 0.4 : e.hp + 1, '#40ffd0', e.x - o.tx, e.y - o.ty, 0, 'crit');
      }
      G.FX.ring(o.tx, o.ty, 20, 900, '#40ffd0', 1.0, 14);
      G.Game.flash('#ffffff', 0.7);
      G.Camera.kick(0.6);
    } else {
      for (const e of G.EnemyMgr.queryCircle(o.tx, o.ty, o.blast)) {
        if (e.dead) continue;
        e.hurt(e.boss ? e.maxHp * 0.08 : e.hp + 1, o.k.base, e.x - o.tx, e.y - o.ty, 140, 'crit');
      }
      G.FX.ring(o.tx, o.ty, 10, o.blast * 1.2, o.k.spot, 0.45, 6);
      G.Camera.kick(0.18);
    }
    G.FX.burst(o.tx, o.ty - 10, o.k.spot, o.big ? 80 : 30, o.big ? 600 : 260);
    G.FX.burst(o.tx, o.ty - 10, '#ffffff', o.big ? 40 : 12, o.big ? 500 : 200);
    if (pl === G.Game.player) G.Audio.sfx(o.big ? 'legend' : 'shot', { kind: 'nova', type: 'rock' });
  }
  function throwNext(pl) {
    const near = G.EnemyMgr.all().filter(e => !e.dead && Math.hypot(e.x - pl.x, e.y - pl.y) < 520)
      .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y));
    const e = near.length ? near[Math.floor(Math.random() * Math.min(5, near.length))] : null;
    const a = Math.random() * 6.2832;
    throwPlanet(pl, e ? e.x : pl.x + Math.cos(a) * 200, e ? e.y : pl.y + Math.sin(a) * 200, false);
  }
  // 像素星球（直接畫格仔）
  function drawPlanet(ctx, o) {
    const P = G.Sprites.PX, R = Math.max(P * 3, Math.round(o.R / P) * P), k = o.k;
    const cx = Math.round(o.x / P) * P, cy = Math.round(o.y / P) * P;
    // 光尾
    const dx = o.tx - o.sx, dy = o.ty - o.sy, L = Math.hypot(dx, dy) || 1;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#40ffd0';
    for (let i = 1; i <= 6; i++) {
      const rr = R * (1 - i / 8);
      ctx.beginPath(); ctx.arc(cx - dx / L * R * 0.5 * i, cy - dy / L * R * 0.5 * i, rr, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let v = -R; v < R; v += P) for (let u = -R; u < R; u += P) {
      const d = Math.hypot(u + P / 2, v + P / 2);
      if (d > R) continue;
      const lit = (-(u) * 0.6 - (v) * 0.8) / R;
      const band = Math.sin((v / R) * 5 + o.spin + (u / R)) > 0.55;
      ctx.fillStyle = d > R - P ? '#101018' : band ? k.spot : lit > 0.3 ? k.base : lit > -0.4 ? k.base : k.dark;
      if (lit < -0.4 && !band) ctx.fillStyle = k.dark;
      ctx.fillRect(cx + u, cy + v, P, P);
    }
    if (k.ring) {
      ctx.strokeStyle = k.ring; ctx.lineWidth = Math.max(P, R / 8);
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.6, R * 0.4, -0.3, 0, 6.2832); ctx.stroke();
    }
  }

  // 超天元突破：背後巨大透明身影（青綠身、紅披風、紅眼鏡）
  function drawGiant(ctx, pl, t) {
    const H = 190, x = pl.x, y = pl.y + 10, a = 0.28 + Math.sin(t / 7) * 0.05;
    ctx.save();
    ctx.translate(x, y); ctx.scale(0.8, 0.8); ctx.translate(-x, -y);   // 大約公仔 3 倍高
    ctx.globalAlpha = a;
    // 披風
    ctx.fillStyle = '#e83848';
    ctx.beginPath();
    ctx.moveTo(x - 40, y - H * 0.85);
    ctx.quadraticCurveTo(x - 130, y - H * 0.5, x - 115 + Math.sin(t / 5) * 12, y);
    ctx.lineTo(x + 115 + Math.sin(t / 6) * 12, y);
    ctx.quadraticCurveTo(x + 130, y - H * 0.5, x + 40, y - H * 0.85);
    ctx.closePath(); ctx.fill();
    // 身體
    ctx.fillStyle = '#5ff0d0';
    ctx.beginPath(); ctx.ellipse(x, y - H * 0.55, 48, H * 0.42, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#9ffff0';
    ctx.beginPath(); ctx.ellipse(x - 14, y - H * 0.62, 20, H * 0.25, 0, 0, 6.2832); ctx.fill();
    // 頭同紅色太陽眼鏡
    ctx.globalAlpha = Math.min(1, a * 2.2);
    ctx.fillStyle = '#ff2030';
    ctx.beginPath();
    ctx.moveTo(x, y - H * 0.9); ctx.lineTo(x - 50, y - H * 1.02); ctx.lineTo(x - 22, y - H * 0.86);
    ctx.lineTo(x, y - H * 0.82); ctx.lineTo(x + 22, y - H * 0.86); ctx.lineTo(x + 50, y - H * 1.02);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function defaultUlt(pl) {
    const col = G.U.TYPE_COLOR[pl.mon.types[0]] || '#ffd23f';
    return { name: '全力爆發', lv: 1, dur: 12, mods: { dmg: 1.6, spd: 1.25, cd: 0.7 }, tint: col, say: pl.mon.name + '・全力爆發！' };
  }
  const cfg = pl => CHARS[pl.mon.dex] || {};
  const forms = pl => (cfg(pl).forms || []).filter(f => pl.level >= f.lv);
  const ults = pl => { const u = cfg(pl).ults; return u ? u.filter(x => pl.level >= x.lv) : [defaultUlt(pl)]; };

  // ---------------- 狀態 ----------------
  const S = {};
  function reset(pl) {
    Object.assign(S, { pl, gauge: 0, active: null, t: 0, ceroT: 0, form: 0, formCd: 0, ult: 0,
                       lastKills: pl ? pl.kills : 0, lastBosses: pl ? pl.bosses : 0, seen: {} });
    if (pl) for (const f of forms(pl)) S.seen['f' + f.name] = 1;
    if (pl) for (const u of ults(pl)) S.seen['u' + u.name] = 1;
  }
  const curForm = pl => (cfg(pl).forms || [])[S.form] || null;
  const curUlt = pl => { const l = ults(pl); return l[Math.min(S.ult, l.length - 1)]; };

  function applyMods(pl, mods, on) {
    if (!mods) return;
    const f = (v, x) => on ? v * x : v / x;
    if (mods.dmg) pl.atkMul = f(pl.atkMul, mods.dmg);
    if (mods.spd) pl.spdMul = f(pl.spdMul, mods.spd);
    if (mods.cd) pl.cdMul = f(pl.cdMul, mods.cd);
  }
  function setSprite(pl, dex) {
    if (!dex || !G.SPRITE_META[dex]) return false;
    if (pl.dex === dex) return true;
    pl.dex = dex;
    pl.anim = new G.Sprites.Animator(dex, 1, dex === pl.mon.dex && pl.shiny);
    if (G.Sprites.preload) G.Sprites.preload([dex], 4000, false);
    return true;
  }
  function restoreSprite(pl) {
    const f = curForm(pl);
    if (!(f && setSprite(pl, f.dex))) setSprite(pl, pl.mon.dex);
  }

  // ---------------- 形態切換 ----------------
  /** idx：直接揀第幾個形態；唔俾 idx 就轉去下一個已解鎖嘅（電腦 F 鍵）。 */
  function switchForm(idx) {
    const pl = G.Game.player;
    if (!pl || pl.dead || G.Game.state !== 'playing') return;
    const all = cfg(pl).forms || [];
    if (forms(pl).length < 2 || S.formCd > 0) return;
    let next = idx;
    if (next == null) { next = S.form; do { next = (next + 1) % all.length; } while (pl.level < all[next].lv); }
    if (!all[next] || next === S.form) return;
    if (pl.level < all[next].lv) { G.Spawner.say(all[next].name + '：' + all[next].lv + ' 級解鎖', 1.4, true); return; }
    applyMods(pl, all[S.form].mods, false);
    S.form = next;
    const to = all[next];
    applyMods(pl, to.mods, true);
    S.formCd = FORM_CD;
    if (!S.active) setSprite(pl, to.dex);
    G.Spawner.say(to.name + '！', 1.4, true);
    G.FX.ring(pl.x, pl.y, 8, 140, to.tint, 0.5, 5);
    G.FX.burst(pl.x, pl.y - 20, to.tint, 24, 200);
    G.Audio.sfx('pick');
  }

  // ---------------- 必殺 ----------------
  function cycleUlt() {
    const pl = G.Game.player;
    if (!pl || S.active) return;
    const l = ults(pl);
    if (l.length < 2) return;
    S.ult = (Math.min(S.ult, l.length - 1) + 1) % l.length;
    G.Spawner.say('必殺：' + l[S.ult].name, 1.2, true);
  }

  function activate() {
    const pl = G.Game.player;
    if (!pl || pl.dead || S.active || S.gauge < GAUGE_MAX || G.Game.state !== 'playing') return;
    const u = curUlt(pl);
    S.active = u; S.t = u.dur; S.gauge = 0; S.ceroT = 0;
    applyMods(pl, u.mods, true);
    setSprite(pl, u.form);
    G.Spawner.say(u.say || u.name, 2.6, true);
    G.Game.flash(u.tint, 0.5);
    G.FX.ring(pl.x, pl.y, 10, 260, u.tint, 0.7, 8);
    G.FX.burst(pl.x, pl.y - 20, u.tint, 60, 320);
    G.Audio.sfx('legend');
    if (u.nuke) nuke(pl);
    if (u.chain) chain(pl, u.chain);
    if (u.drill) gigaDrill(pl);
  }

  function end(pl) {
    const u = S.active;
    if (u.finale && !pl.dead) throwPlanet(pl, pl.x, pl.y - 20, true);
    applyMods(pl, u.mods, false);
    S.active = null;
    restoreSprite(pl);
    G.Spawner.say(u.name + ' 結束', 1.4, true);
  }

  // 一道直線攻擊（血鎖第二道月牙、虛閃共用）
  // 自訂光束顏色：虛閃紅黑、無月黑紫
  G.VFX.PAL.cero = ['#1a0004', '#5a0010', '#c0102a', '#ff3048', '#ffd0d8'];
  G.VFX.PAL.mugetsu = ['#000000', '#120820', '#2a1450', '#6a40c0', '#d8c8ff'];
  function strike(pl, ang, len, w, dmg, col, type, pal) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    G.FX.beam(pl.x, pl.y - G.LIFT, ang, len, w, col, pal ? { pal } : undefined);
    const mx = pl.x + ca * len / 2, my = pl.y + sa * len / 2;
    for (const e of G.EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (e.dead) continue;
      const px = e.x - pl.x, py = e.y - pl.y, along = px * ca + py * sa;
      if (along < -e.r || along > len + e.r || Math.abs(-px * sa + py * ca) > w / 2 + e.r) continue;
      const k = type ? G.Types.mult(type, e.types) : 1;
      e.hurt(dmg * k, col, ca, sa, 0, k > 1 ? 'super' : null);
    }
  }

  function nuke(pl) {
    for (const e of G.EnemyMgr.all().filter(e => !e.dead)) {
      e.hurt(e.boss ? e.maxHp * 0.35 : e.hp + 1, '#a0a0ff', e.x - pl.x, e.y - pl.y, 0, 'crit');
    }
    for (let i = 0; i < 6; i++) G.FX.beam(pl.x, pl.y - G.LIFT, i * 1.047, 900, 60, '#1a0a20', { pal: 'mugetsu' });
    G.FX.ring(pl.x, pl.y, 20, 900, '#000000', 1.0, 14);
  }

  function chain(pl, n) {
    let x = pl.x, y = pl.y;
    const hits = G.EnemyMgr.all().filter(e => !e.dead)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, n);
    hits.forEach((e, i) => setTimeout(() => {
      if (e.dead) return;
      G.FX.beam(x, y - 12, Math.atan2(e.y - y, e.x - x), Math.hypot(e.x - x, e.y - y), 14, '#ffe14d', { pal: 'electric', beam: 'lightning' });
      e.hurt(e.boss ? 400 : e.hp + 1, '#ffe14d', e.x - x, e.y - y, 60, 'crit');
      G.FX.burst(e.x, e.y - 10, '#ffe14d', 14, 200);
      x = e.x; y = e.y;
    }, i * 70));
  }

  function cero(pl) {
    const near = G.EnemyMgr.all().filter(e => !e.dead)
      .sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y)).slice(0, 3);
    for (const e of near) strike(pl, Math.atan2(e.y - pl.y, e.x - pl.x), 280, 22, 40 * pl.atk, '#ff3048', 'ghost', 'cero');
  }

  // ---------------- 月牙天衝：彎月刀氣（唔再係一條直線） ----------------
  // 顏色跟住而家個造型：[刀氣中間, 邊]
  const MOON_COL = {
    9002: ['#e8f6ff', '#5fb8ff'],   // 始解：淺藍白
    9101: ['#121018', '#e0303a'],   // 卍解：黑色紅邊
    9102: ['#1a0508', '#ff2030'],   // 虛化：黑紅
    9104: ['#120606', '#ff2a2a'],   // 血鎖：黑色紅光邊
    9105: ['#2a0a10', '#ff5070'],   // 完全虛化
    9103: ['#05030a', '#8a60ff']    // 無月
  };
  const moons = [];
  let moonNext = false;            // 下一下 G.FX.beam 係月牙天衝：畫月牙代替直線
  function moonColors(pl) { return MOON_COL[pl.dex] || MOON_COL[pl.mon.dex] || ['#e8f6ff', '#5fb8ff']; }

  const fxBeam = G.FX.beam;
  G.FX.beam = function (x, y, angle, len, width, color, fx) {
    if (!moonNext) return fxBeam.apply(this, arguments);
    moonNext = false;
    const pl = G.Game.player, c = pl ? moonColors(pl) : ['#e8f6ff', '#5fb8ff'];
    moons.push({ x, y, angle, len, R: Math.max(30, width * 1.6), core: c[0], edge: c[1], t: 0, life: 0.3 });
  };
  const fxUpdate = G.FX.update;
  G.FX.update = function (dt) {
    for (let i = moons.length - 1; i >= 0; i--) if ((moons[i].t += dt) >= moons[i].life) moons.splice(i, 1);
    for (let i = planets.length - 1; i >= 0; i--) {
      const o = planets[i], k = Math.min(1, (o.t += dt) / o.life), e = k * k;
      o.x = o.sx + (o.tx - o.sx) * e; o.y = o.sy + (o.ty - o.sy) * e; o.spin += dt * 3;
      if (k >= 1) { planets.splice(i, 1); planetHit(o); }
    }
    return fxUpdate.apply(this, arguments);
  };
  const fxClear = G.FX.clear;
  G.FX.clear = function () { moons.length = 0; planets.length = 0; return fxClear.apply(this, arguments); };

  // 像素月牙：喺前面個圓入面、後面個圓外面嘅格仔（中間厚、兩頭尖）
  function drawMoon(ctx, o, u0, R, alpha) {
    const P = G.Sprites.PX, d = R * 0.42;
    ctx.globalAlpha = alpha;
    for (let v = -R; v <= R; v += P) {
      for (let u = -R; u <= R; u += P) {
        const a = Math.hypot(u, v), b = Math.hypot(u + d, v);
        if (a > R || b < R) continue;
        ctx.fillStyle = (R - a < P * 1.5 || b - R < P * 1.5) ? o.edge : o.core;
        ctx.fillRect(u0 + u, v, P, P);
      }
    }
  }
  const fxDraw = G.FX.draw;
  G.FX.draw = function (ctx) {
    const r = fxDraw.apply(this, arguments);
    for (const o of moons) {
      const k = o.t / o.life, ease = 1 - (1 - k) * (1 - k);
      const R = Math.round(o.R * (0.75 + 0.25 * ease) / 2) * 2;
      ctx.save();
      ctx.translate(Math.round(o.x), Math.round(o.y));
      ctx.rotate(Math.round(o.angle / (Math.PI / 16)) * (Math.PI / 16));
      const fade = k > 0.8 ? 0.5 : 1;
      drawMoon(ctx, o, Math.round(o.len * Math.max(0, ease - 0.16)), R * 0.85, 0.25 * fade);   // 殘影
      drawMoon(ctx, o, Math.round(o.len * Math.max(0, ease - 0.08)), R * 0.92, 0.45 * fade);
      drawMoon(ctx, o, Math.round(o.len * ease), R, fade);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const o of planets) drawPlanet(ctx, o);
    ctx.globalAlpha = 1;
    return r;
  };

  const cast = G.Player.prototype.cast;
  G.Player.prototype.cast = function (m, ...a) {
    const r = cast.call(this, m, ...a);
    if (this !== G.Game.player || !m) return r;
    // 超銀河：鑽頭飛彈一次射三支（扇形）
    if (FAN_MOVES.includes(m.id)) {
      const f = curForm(this);
      if (f && f.fan) for (let i = 1; i < f.fan; i++) {
        const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2);
        spawnDrill(this, this.aim + side * k * 0.3, m.dmg * this.atk, { pierce: m.pierce, size: m.size, life: m.life, speed: m.speed });
      }
      return r;
    }
    if (!DUAL_MOVES.includes(m.id)) return r;
    // cast 之後即刻就係 Combat 嘅 beam()：嗰下改畫月牙
    moonNext = true;
    queueMicrotask(() => { moonNext = false; });
    // 血鎖：月牙天衝一次射兩道
    const f = curForm(this);
    if (f && f.dual) {
      const pl = this, ang = pl.aim + 0.32;
      setTimeout(() => { if (!pl.dead) { moonNext = true; strike(pl, ang, m.radius, m.width, m.dmg * pl.atk, '#9aa0ff', m.type); moonNext = false; } }, 110);
    }
    return r;
  };

  // ---------------- 每幀 ----------------
  const upd = G.Player.prototype.update;
  G.Player.prototype.update = function (dt) {
    const r = upd.call(this, dt);
    if (this !== G.Game.player) return r;
    if (S.pl !== this) reset(this);
    const dk = this.kills - S.lastKills, db = this.bosses - S.lastBosses;
    if (!S.active && (dk > 0 || db > 0)) S.gauge = Math.min(GAUGE_MAX, S.gauge + dk * PER_KILL + db * PER_BOSS);
    S.lastKills = this.kills; S.lastBosses = this.bosses;
    if (S.formCd > 0) S.formCd = Math.max(0, S.formCd - dt);
    if (S.active) {
      if (S.active.cero && (S.ceroT -= dt) <= 0) { S.ceroT = 0.7; cero(this); }
      if (S.active.planets && (S.ceroT -= dt) <= 0) { S.ceroT = S.active.planets; throwNext(this); }
      if ((S.t -= dt) <= 0 || this.dead) end(this);
    }
    // 新解鎖提示
    for (const f of forms(this)) if (!S.seen['f' + f.name]) { S.seen['f' + f.name] = 1; G.Spawner.say(f.name + ' 已解鎖！撳形態掣切換', 3, true); G.Game.flash(f.tint, 0.3); }
    for (const u of ults(this)) if (!S.seen['u' + u.name]) { S.seen['u' + u.name] = 1; G.Spawner.say('必殺「' + u.name + '」已解鎖！', 3, true); }
    return r;
  };

  // 無敵必殺：唔受傷（唔用 invuln，否則成段時間角色會一閃一閃）
  const hurt = G.Player.prototype.hurt;
  G.Player.prototype.hurt = function (...a) {
    if (this === G.Game.player && S.active && S.active.god) return;
    return hurt.apply(this, a);
  };

  const drw = G.Player.prototype.draw;
  G.Player.prototype.draw = function (ctx) {
    // 形態未有自己嘅圖：用形態顏色做光環
    const fm = this === G.Game.player && !S.active && !this.dead ? curForm(this) : null;
    if (fm && fm.dex !== this.mon.dex && this.dex !== fm.dex) {
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(performance.now() / 160) * 0.1;
      ctx.fillStyle = fm.tint;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 2.1, this.r * 0.9, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      if (Math.random() < 0.25) G.FX.burst(this.x + (Math.random() - 0.5) * 20, this.y - Math.random() * 36, fm.tint, 1, 50);
    }
    if (this === G.Game.player && S.active && S.active.giant && !this.dead) drawGiant(ctx, this, performance.now() / 90);
    if (this === G.Game.player && S.active && S.active.big && !this.dead) {
      // 天元突破：公仔放大（以腳底做中心）
      const k = S.active.big;
      ctx.save();
      ctx.translate(this.x, this.y); ctx.scale(k, k); ctx.translate(-this.x, -this.y);
      const r = drawUlt.call(this, ctx);
      ctx.restore();
      return r;
    }
    return drawUlt.call(this, ctx);
  };
  function drawUlt(ctx) {
    if (this === G.Game.player && S.active && !this.dead) {
      const u = S.active, t = performance.now() / 90;
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t) * 0.15;
      ctx.fillStyle = u.tint;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 2.4, this.r * 1.0, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      if (Math.random() < 0.5) G.FX.burst(this.x + (Math.random() - 0.5) * 20, this.y - Math.random() * 40, u.tint, 1, 60);
    }
    return drw.call(this, ctx);
  }

  const startRun = G.Game.startRun;
  G.Game.startRun = function (...a) { const r = startRun.apply(this, a); reset(G.Game.player); return r; };

  // ---------------- 按鈕 ----------------
  function makeBtn(id, onTap, onLong) {
    const b = document.createElement('button');
    b.id = id;
    b.className = 'cx-btn';
    b.setAttribute('translate', 'no');
    b.innerHTML = '<div class="cx-fill"></div><span class="cx-txt"></span>';
    let timer = null, long = false;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); long = false;
      if (onLong) timer = setTimeout(() => { long = true; onLong(); }, 450);
    });
    b.addEventListener('pointerup', e => {
      e.preventDefault(); e.stopPropagation(); clearTimeout(timer);
      if (!long) onTap();
    });
    b.addEventListener('pointercancel', () => clearTimeout(timer));
    document.body.appendChild(b);
    return b;
  }
  let ultBtn = null, formBox = null, formFor = null;
  const RUNNING = ['playing', 'levelup', 'paused', 'choice', 'held'];
  function buildForms(pl) {
    formBox.innerHTML = '';
    (cfg(pl).forms || []).forEach((f, i) => {
      const b = document.createElement('button');
      b.className = 'fx-btn';
      b.innerHTML = `<div class="cx-fill"></div><span class="cx-txt">${i + 1}<small>${f.name}</small></span>`;
      b.style.setProperty('--cx', f.tint);
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); switchForm(i); });
      formBox.appendChild(b);
    });
    formFor = pl;
  }
  function tick() {
    if (!ultBtn && document.body) {
      ultBtn = makeBtn('ult-btn', () => (S.gauge >= GAUGE_MAX ? activate() : cycleUlt()), cycleUlt);
      formBox = document.createElement('div');
      formBox.id = 'form-box';
      formBox.setAttribute('translate', 'no');
      document.body.appendChild(formBox);
    }
    if (ultBtn) {
      const pl = G.Game.player;
      const show = pl && !pl.dead && RUNNING.includes(G.Game.state);
      ultBtn.style.display = show ? 'flex' : 'none';
      const hasForms = show && (cfg(pl).forms || []).length >= 2;
      formBox.style.display = hasForms ? 'flex' : 'none';
      if (show) {
        const u = curUlt(pl), ready = !S.active && S.gauge >= GAUGE_MAX;
        ultBtn.querySelector('.cx-fill').style.height = Math.round((S.active ? S.t / S.active.dur : S.gauge / GAUGE_MAX) * 100) + '%';
        ultBtn.classList.toggle('ready', ready);
        ultBtn.classList.toggle('on', !!S.active);
        ultBtn.querySelector('.cx-txt').innerHTML = S.active ? Math.ceil(S.t) + 's'
          : `${u.name}<small>${ready ? '發動！' : Math.floor(S.gauge) + '%'}</small>`;
        ultBtn.style.setProperty('--cx', (S.active || u).tint);
      }
      if (hasForms) {
        if (formFor !== pl) buildForms(pl);
        const all = cfg(pl).forms;
        [...formBox.children].forEach((b, i) => {
          const locked = pl.level < all[i].lv;
          b.classList.toggle('cur', i === S.form);
          b.classList.toggle('locked', locked);
          b.querySelector('small').textContent = locked ? 'Lv' + all[i].lv : all[i].name;
          b.querySelector('.cx-fill').style.height = (i === S.form || locked ? 0 : Math.round(S.formCd / FORM_CD * 100)) + '%';
        });
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === 'r' || e.key === 'R') activate();
    else if (e.key === 'f' || e.key === 'F') switchForm();
    else if (e.key === 't' || e.key === 'T') cycleUlt();
  });

  const css = document.createElement('style');
  css.textContent = `
    .cx-btn { position: fixed; right: max(14px, env(safe-area-inset-right)); z-index: 30;
      width: 70px; height: 70px; border-radius: 50%; border: 3px solid #e8ecff; background: rgba(10,16,40,.75);
      display: none; align-items: center; justify-content: center; overflow: hidden; padding: 0; touch-action: none;
      color: #fff; font: 700 14px/1.1 sans-serif; text-shadow: 1px 1px 0 #000; -webkit-user-select: none; user-select: none; }
    .cx-btn .cx-fill { position: absolute; left: 0; right: 0; bottom: 0; background: var(--cx, #ffd23f); opacity: .55; }
    .cx-btn .cx-txt { position: relative; text-align: center; padding: 0 4px; }
    .cx-btn small { display: block; font-size: 10px; opacity: .85; margin-top: 2px; }
    #ult-btn { bottom: 96px; }
    #form-box { position: fixed; right: max(18px, env(safe-area-inset-right)); bottom: 176px; z-index: 30;
      display: none; flex-direction: column-reverse; gap: 6px; }
    .fx-btn { position: relative; width: 60px; height: 44px; border-radius: 10px; border: 2px solid var(--cx, #e8ecff);
      background: rgba(10,16,40,.75); color: #fff; overflow: hidden; padding: 0; touch-action: none;
      font: 700 15px/1 sans-serif; text-shadow: 1px 1px 0 #000; -webkit-user-select: none; user-select: none; }
    .fx-btn small { display: block; font-size: 10px; margin-top: 2px; }
    .fx-btn .cx-fill { position: absolute; left: 0; right: 0; bottom: 0; background: #000; opacity: .5; }
    .fx-btn .cx-txt { position: relative; }
    .fx-btn.cur { background: var(--cx, #ffd23f); box-shadow: 0 0 10px 2px var(--cx, #ffd23f); }
    .fx-btn.locked { opacity: .45; border-color: #667; }
    #ult-btn.ready { border-color: #ffd23f; animation: cx-pulse .7s ease-in-out infinite alternate; }
    #ult-btn.on { border-color: var(--cx, #ffd23f); }
    @keyframes cx-pulse { from { box-shadow: 0 0 6px 2px var(--cx, #ffd23f); } to { box-shadow: 0 0 22px 8px var(--cx, #ffd23f); } }
    @media (orientation: portrait) { #ult-btn { bottom: 120px; } #form-box { bottom: 200px; } }
  `;
  document.head.appendChild(css);

  G.CustomUlt = { fill() { S.gauge = GAUGE_MAX; }, get state() { return S; }, activate, switchForm, cycleUlt, moons };
})();
