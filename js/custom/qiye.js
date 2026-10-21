/* ============ qiye.js — 最終頭目：柒爺（個人自玩 mod） ============
 * 觸發：阿爾宙斯審判開始後撐夠 90 秒（只限單人）。
 *   過場「柒爺」→ 阿爾宙斯同傳說寶可夢被趕走 → 柒爺從天而降。
 * 第一形態「七頭柒爺」：一個大身七條頸。血分 7 段，每打走一段跌一個頭，跌嗰陣講一句口頭禪。
 *   招式：頭輪流噴字（口頭禪做子彈）、口水雨（地上警告圈）。頭越少噴得越快。
 * 第二形態「童軍柒爺」：7 個頭跌晒就變童軍，講「點睇都係柒」。
 *   招式：營火（地上燒圈）、綁繩結（中咗會慢）、童軍敬禮（四周衝擊波）。
 * 打贏：「通關！」然後正常結算。
 * 圖：assets/custom/qiye_head.png、qiye_body.png（七頭），9301（童軍公仔，custom_sprites.py）。
 */
(() => {
  const TRIGGER = 90;                 // 審判開始後幾多秒出場
  const LINES = ['屌', 'on9', '柒', '撚屌', '傻閪', '仆街', '係你眼中咩都柒'];
  const CHATTER = ['屌', 'on9', '柒', '撚屌', '傻閪', '仆街', '係你眼中咩都柒', '點睇都係柒', '你講咩呀', '聽我講啦'];
  const SCOUT_DEX = 9301;
  const J = G.Judgment;

  const head = new Image(); head.src = 'assets/custom/qiye_head.png';
  const body = new Image(); body.src = 'assets/custom/qiye_body.png';

  const Q = { on: false, done: false, boss: null, mode: null, dmgSum: 0, words: [], ropes: [], bubbles: [],
              flying: [], heads: 7, segHp: 0, t: 0, atkT: 0, skillT: 0, won: false, winT: 0 };

  // ---------------- 觸發：計審判期間打出嘅傷害（用嚟定柒爺血量） ----------------
  const eHurt = G.Enemy.prototype.hurt;
  G.Enemy.prototype.hurt = function (amount, ...rest) {
    if (J.active && !Q.on && !this.dead) Q.dmgSum += Math.max(0, Math.min(amount, this.hp));
    if (this === Q.boss) return bossHurt(this, amount, rest, eHurt);
    return eHurt.call(this, amount, ...rest);
  };

  const jUpdate = J.update;
  J.update = function (dt, pl, time) {
    if (Q.on) { tick(dt, pl); return; }
    if (Q.challenge) { prepTick(dt, pl); return; }
    const r = jUpdate.apply(this, arguments);
    const s = J.summary();
    if (s && s.time >= TRIGGER && !Q.done && !G.Coop.active && pl && !pl.dead) begin(pl, s.time);
    return r;
  };
  const jDrawable = J.drawable, jDrawAir = J.drawAir, jOverlay = J.drawOverlay;
  J.drawable = function () { return Q.on ? null : jDrawable.apply(this, arguments); };
  J.drawAir = function (ctx) { if (Q.on) { drawAir(ctx); return; } return jDrawAir.apply(this, arguments); };
  J.drawOverlay = function (ctx, w, h) { if (Q.on) return; return jDrawOverlay(ctx, w, h); };
  function jDrawOverlay(ctx, w, h) { return jOverlay.call(J, ctx, w, h); }
  const activeGet = Object.getOwnPropertyDescriptor(J, 'active').get;
  Object.defineProperty(J, 'active', { configurable: true, get() { return Q.on || Q.challenge || activeGet.call(J); } });
  const musicGet = Object.getOwnPropertyDescriptor(J, 'music').get;
  Object.defineProperty(J, 'music', { configurable: true, get() { return Q.on ? (G.CustomUlt.inCine ? null : 'boss') : musicGet.call(J); } });

  // ---------------- 登場 ----------------
  function begin(pl, survived) {
    Q.on = true; Q.done = true;
    const ar = jDrawable.call(J);
    // 趕走阿爾宙斯同傳說寶可夢
    if (ar) { G.FX.burst(ar.x, ar.y - 40, '#ffd25e', 60, 420); G.FX.ring(ar.x, ar.y, 20, 500, '#ffd25e', 0.8, 10); }
    for (const e of G.EnemyMgr.all()) if (!e.dead) e.hurt(e.hp + 1, '#ffd25e');
    G.Hazards.clear();
    // 血量：審判期間每秒傷害 × 秒數（全場淨係佢一隻，所以大約幾耐打得死）
    const dps = Math.max(600, Q.dmgSum / Math.max(30, survived));
    Q.segHp = Math.round(Math.max(9000, dps * 7));        // 每個頭大約 7 秒
    if (Q.challenge) Q.segHp = 1e7;                       // Challenge：頭 5 秒量度你嘅傷害先定血量
    G.CustomUlt.cine(2.2, Q.challenge ? ['打柒柒爺', 'Challenge 開始！'] : ['柒爺', '最終頭目・降臨'], () => spawn(pl, dps));
    G.Audio.sfx('boss');
  }

  function spawn(pl, dps) {
    const def = { dex: SCOUT_DEX, name: '七頭柒爺', hp: Q.segHp * 7, spd: 62, dmg: 1, xp: 5000, behavior: 'chase' };
    const e = new G.Enemy(def, pl.x + 165, pl.y - 10, { hp: 1, spd: 1, dmg: 1 }, true);
    e.name = '七頭柒爺';
    e.maxHp = e.hp = Q.segHp * 7;
    e.dmg = pl.maxHp * 0.15;                 // 撞到扣 15% 血
    e.atkType = null;
    e.r = 40; e.bodyH = 170; e.flying = true; e.qiye = true;
    e.scale = 1;
    Q.calib = Q.challenge ? 5 : 0; Q.calibDmg = 0; Q.chT = 0;
    Q.boss = e; Q.mode = 'seven'; Q.heads = 7; Q.t = 0; Q.atkT = 1.5; Q.skillT = 4; Q.scoutHp = Math.round(Math.max(12000, dps * 22));
    e.drop = 1;                               // 由天跌落
    e.touchCd = 3;
    G.EnemyMgr.add(e);
    say(e, '你哋全部都係柒！', 2.5);
    G.Camera.kick(1.2); G.Game.flash('#ffffff', 0.5);
  }

  // ---------------- 受傷：七個頭逐個跌，打完變童軍 ----------------
  // 柒爺戰冇小怪：打柒爺都會儲必殺（大約每 20 秒儲滿一次）
  function charge(dealt) {
    const U = G.CustomUlt && G.CustomUlt.state;
    if (!U || U.active || dealt <= 0 || Q.calib > 0) return;
    const per = Q.mode === 'seven' ? Q.segHp : Q.scoutHp / 3;   // 大約 8 秒嘅傷害
    U.gauge = Math.min(100, U.gauge + dealt / per * 40);
  }
  function bossHurt(e, amount, rest, orig) {
    if (Q.won || e.inv > 0 || Q.mode === 'cine') return;
    const hp0 = e.hp;
    try { return bossHurt2(e, amount, rest, orig); } finally { charge(hp0 - Math.max(0, e.hp)); }
  }
  function bossHurt2(e, amount, rest, orig) {
    if (Q.mode === 'seven') {
      if (Q.calib > 0) Q.calibDmg += Math.max(0, amount);
      const before = e.hp;
      orig.call(e, Math.min(amount, e.hp - 1), ...rest);
      const left = Math.max(0, Math.ceil(e.hp / Q.segHp - 1e-6));
      while (Q.heads > Math.max(left, 0) && Q.heads > 0) loseHead(e);
      if (Q.heads <= 0 || e.hp <= 1) transform(e);
      return before;
    }
    orig.call(e, amount, ...rest);
    if (e.dead && !Q.won) win(e);
  }

  function headPos(e, i, n) {
    // 7 條頸由膊頭扇形向上伸，會左右擺
    const spread = (i - (n - 1) / 2) / ((n - 1) / 2 || 1);
    const sway = Math.sin(Q.t * 2 + i * 1.3) * 6;
    const bx = e.x + spread * 28, by = e.y - 120;
    const hx = e.x + spread * 78 + sway, hy = e.y - 178 - (1 - Math.abs(spread)) * 26 + Math.cos(Q.t * 2.4 + i) * 4;
    return { bx, by, hx, hy };
  }

  function loseHead(e) {
    const idx = 7 - Q.heads;                  // 由左邊開始跌
    const p = headPos(e, idx, 7);
    Q.heads--;
    Q.flying.push({ x: p.hx, y: p.hy, vx: (Math.random() - 0.5) * 220, vy: -260, rot: 0, t: 0 });
    Q.bubbles.push({ text: LINES[idx], x: p.hx, y: p.hy - 30, t: 0, life: 2.4, big: true });
    G.FX.burst(p.hx, p.hy, '#ffcf9a', 30, 260);
    G.Camera.kick(0.5);
    G.Audio.sfx('bossDown');
    e.inv = 0.6;
  }

  function transform(e) {
    while (Q.heads > 0) loseHead(e);
    Q.mode = 'cine';
    e.inv = 99;
    G.CustomUlt.cine(1.8, ['點睇都係柒', '童軍柒爺'], () => {
      Q.mode = 'scout';
      e.name = '童軍柒爺';
      e.maxHp = e.hp = Q.scoutHp;
      e.xp = 0;                                // 打贏即刻結算，唔好彈升級卡
      e.inv = 0.8;
      e.r = 20; e.bodyH = 80; e.scale = 2;
      e.anim = new G.Sprites.Animator(SCOUT_DEX, 2);
      e.spd = 95;
      Q.atkT = 1.2; Q.skillT = 2.5;
      G.FX.burst(e.x, e.y - 40, '#7fbf5a', 60, 360);
      G.FX.ring(e.x, e.y, 10, 300, '#ffd23f', 0.6, 8);
      say(e, '點睇都係柒', 2.6);
    });
  }

  function win(e) {
    Q.won = true; Q.winT = 3.5;
    setTimeout(() => { if (G.Game.state !== 'over' && G.Game.state !== 'ui') G.Game.quit(); }, 9000);
    say(e, '仆街…', 2);
    G.Game.flash('#ffffff', 0.8);
    G.Camera.kick(1.2);
    for (let i = 0; i < 6; i++) G.FX.ring(e.x, e.y, 10 + i * 20, 300 + i * 120, i % 2 ? '#ffd23f' : '#ffffff', 0.6 + i * 0.2, 6);
    let sub = '柒爺被你打低咗';
    if (Q.challenge) {
      const t = Q.chT, best = bestTime();
      sub = '用咗 ' + mmss(t) + (best == null || t < best ? '・新紀錄！' : '・最快 ' + mmss(best));
      if (best == null || t < best) try { localStorage.setItem(BEST_KEY, String(t)); } catch (err) { /* 冇 storage */ }
    }
    setTimeout(() => G.CustomUlt.cine(2.6, ['通關！', sub], () => { G.Game.quit(); }), 1200);
  }

  // ---------------- 每幀 ----------------
  function tick(dt, pl) {
    Q.t += dt;
    const e = Q.boss;
    updateWords(dt, pl);
    for (const b of Q.bubbles) b.t += dt;
    Q.bubbles = Q.bubbles.filter(b => b.t < b.life);
    for (const f of Q.flying) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; f.rot += dt * 8; }
    Q.flying = Q.flying.filter(f => f.t < 1.6);
    if (!e || e.dead || Q.won) return;
    if (Q.challenge && e.drop <= 0 && Q.mode !== 'cine') { Q.chT += dt; timerShow(); }
    if (Q.calib > 0 && e.drop <= 0 && (Q.calib -= dt) <= 0) {
      // 頭 5 秒嘅傷害 → 七個頭合共大約 60 秒，童軍大約 25 秒
      const dps = Math.max(300, Q.calibDmg / 5);
      Q.segHp = Math.round(dps * 8.5);
      Q.scoutHp = Math.round(dps * 25);
      const done = Q.calibDmg;
      e.maxHp = Q.segHp * 7; e.hp = Math.max(1, e.maxHp - done);
    }
    if (e.inv > 0) e.inv -= dt;
    if (e.drop > 0) {                          // 從天而降
      e.drop -= dt * 1.4;
      if (e.drop <= 0) { G.Camera.kick(1.0); G.FX.ring(e.x, e.y, 10, 260, '#ffcf9a', 0.6, 8); }
      return;
    }
    if (Q.mode === 'cine') return;
    if (Q.mode === 'seven') sevenAI(dt, e, pl);
    else scoutAI(dt, e, pl);
    // 多咀：成日講嘢
    if (Math.random() < dt * 0.6) {
      const n = Q.mode === 'seven' ? Q.heads : 1;
      const i = 7 - Q.heads + Math.floor(Math.random() * n);
      const p = Q.mode === 'seven' ? headPos(e, i, 7) : { hx: e.x, hy: e.y - 90 };
      Q.bubbles.push({ text: G.U.pick(CHATTER), x: p.hx, y: p.hy - 26, t: 0, life: 1.4 });
    }
  }

  function chase(dt, e, pl, spd, keep = 60) {
    const [dx, dy] = G.U.norm(pl.x - e.x, pl.y - e.y);
    const d = G.U.dist(e.x, e.y, pl.x, pl.y);
    if (d > keep) { e.x += dx * spd * dt; e.y += dy * spd * dt; }
    e.anim.dir = G.Sprites.dirFromAngle(Math.atan2(dy, dx));
    e.anim.loop(d > keep ? 'Walk' : 'Idle');
  }

  function sevenAI(dt, e, pl) {
    // 企喺你側邊（咁成個身同七個頭都喺畫面入面）
    // 每 5–7 秒轉位：左、右、斜上、斜下（轉位時行快啲）
    Q.posT = (Q.posT || 0) - dt;
    if (Q.posT <= 0 || !Q.pos) {
      const opts = [[1, 0], [-1, 0], [0.8, -0.55], [-0.8, -0.55], [0.8, 0.45], [-0.8, 0.45]].filter(o => !Q.pos || o !== Q.pos);
      Q.pos = G.U.pick(opts); Q.posT = G.U.rand(5, 7); Q.moving = 1.2;
    }
    if (Q.moving > 0) Q.moving -= dt;
    const tx = pl.x + Q.pos[0] * 165, ty = pl.y + Q.pos[1] * 110 - 10;
    const [dx, dy] = G.U.norm(tx - e.x, ty - e.y), d = G.U.dist(e.x, e.y, tx, ty);
    const spd = (Q.moving > 0 ? 190 : 75) + (7 - Q.heads) * 8;
    if (d > 8) { e.x += dx * Math.min(spd * dt, d); e.y += dy * Math.min(spd * dt, d); }
    e.anim.loop(d > 8 ? 'Walk' : 'Idle');
    // 噴字：頭越少越快
    Q.atkT -= dt;
    if (Q.atkT <= 0) {
      Q.atkT = 0.55 + Q.heads * 0.12;
      const i = 7 - Q.heads + Math.floor(Math.random() * Q.heads);
      const p = headPos(e, i, 7);
      const a = Math.atan2(pl.y - 20 - p.hy, pl.x - p.hx);
      const n = Q.heads <= 3 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const aa = a + (k - (n - 1) / 2) * 0.22;
        Q.words.push({ x: p.hx, y: p.hy, vx: Math.cos(aa) * 230, vy: Math.sin(aa) * 230, text: LINES[i], t: 0, life: 3.2, pct: 0.12 });
      }
    }
    // 口水雨：地上警告圈
    Q.skillT -= dt;
    if (Q.skillT <= 0) {
      Q.skillT = 5.5;
      const n = 3 + (7 - Q.heads);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.2832, d = k ? G.U.rand(30, 140) : 0;
        G.Hazards.add({ kind: 'zone', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d * 0.8, r: 46, delay: 1.2 + k * 0.08,
                        pct: 0.18, pure: true, dmg: 1, type: null, color: '#9fe0ff' });
      }
      Q.bubbles.push({ text: '噴口水！', x: e.x, y: e.y - 225, t: 0, life: 1.2 });
    }
  }

  function scoutAI(dt, e, pl) {
    chase(dt, e, pl, e.spd);
    Q.atkT -= dt;
    if (Q.atkT <= 0) {                         // 綁繩結
      Q.atkT = 2.2;
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      Q.ropes.push({ x: e.x, y: e.y - 40, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 0, life: 2.6 });
    }
    Q.skillT -= dt;
    if (Q.skillT <= 0) {
      if (Math.random() < 0.5) {               // 營火
        Q.skillT = 4;
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * 6.2832 + Math.random(), d = k ? 90 : 0;
          G.Hazards.add({ kind: 'zone', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d * 0.8, r: 52, delay: 1.1,
                          pct: 0.2, pure: true, dmg: 1, type: null, color: '#ff8a2a' });
        }
        say(e, '生火！', 1.2);
      } else {                                 // 童軍敬禮：四周衝擊波
        Q.skillT = 3.5;
        G.Hazards.add({ kind: 'zone', x: e.x, y: e.y, r: 180, delay: 0.9, pct: 0.3, pure: true, dmg: 1, type: null, color: '#ffd23f' });
        e.anim.play('Attack', { speed: 0.8 });
        say(e, '敬禮！', 1.2);
      }
    }
  }

  function updateWords(dt, pl) {
    const hit = (o, r) => pl && !pl.dead && G.U.dist2(o.x, o.y, pl.x, pl.y - 18) < (r + pl.r) ** 2;
    for (const w of Q.words) {
      w.t += dt; w.x += w.vx * dt; w.y += w.vy * dt;
      if (!w.gone && hit(w, 16)) { w.gone = true; pl.invuln = 0; pl.hurt(pl.maxHp * w.pct, null, true); G.FX.burst(w.x, w.y, '#ff5050', 10, 120); }
    }
    Q.words = Q.words.filter(w => !w.gone && w.t < w.life);
    for (const r of Q.ropes) {
      r.t += dt; r.x += r.vx * dt; r.y += r.vy * dt;
      if (!r.gone && hit(r, 14)) {
        r.gone = true; pl.slowT = Math.max(pl.slowT || 0, 2.5);
        pl.hurt(pl.maxHp * 0.08, null, true);
        G.Spawner.say('俾柒爺綁住咗！', 1.4, true);
      }
    }
    Q.ropes = Q.ropes.filter(r => !r.gone && r.t < r.life);
  }

  function say(e, text, life) { Q.bubbles.push({ text, x: e.x, y: e.y - (Q.mode === 'seven' ? 225 : 100), t: 0, life, big: true }); }

  // ---------------- 畫 ----------------
  // 七頭形態：身、頸、頭（取代普通 sprite）
  // 柒爺自己控制行動：唔用普通敵人嘅 AI
  const eUpdate = G.Enemy.prototype.update;
  G.Enemy.prototype.update = function (dt, pl) {
    if (this !== Q.boss) return eUpdate.call(this, dt, pl);
    this.anim.update(dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.touchCd > 0) this.touchCd -= dt;
    if (this.dead) this.fade -= dt;
  };
  const eDraw = G.Enemy.prototype.draw;
  G.Enemy.prototype.draw = function (ctx) {
    if (this !== Q.boss || Q.mode === 'scout') return eDraw.call(this, ctx);
    if (this.dead) return;
    const e = this, lift = e.drop > 0 ? e.drop * e.drop * 500 : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(0, -lift);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + lift, 78, 22, 0, 0, 6.2832); ctx.fill();
    if (e.flash > 0) ctx.filter = 'brightness(2.2)';
    // 頸（後面先畫）
    for (let i = 7 - Q.heads; i < 7; i++) {
      const p = headPos(e, i, 7);
      ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.bx, p.by); ctx.quadraticCurveTo(p.bx, (p.by + p.hy) / 2, p.hx, p.hy + 14); ctx.stroke();
      ctx.strokeStyle = '#e0a074'; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(p.bx, p.by); ctx.quadraticCurveTo(p.bx, (p.by + p.hy) / 2, p.hx, p.hy + 14); ctx.stroke();
    }
    // 身
    if (body.complete && body.naturalWidth) ctx.drawImage(body, Math.round(e.x - 74), Math.round(e.y - 144), 148, 144);
    // 斷咗嘅頸（跌咗頭）
    for (let i = 0; i < 7 - Q.heads; i++) {
      const p = headPos(e, i, 7);
      ctx.fillStyle = '#c0102a';
      ctx.beginPath(); ctx.ellipse(p.bx, p.by - 4, 7, 4, 0, 0, 6.2832); ctx.fill();
    }
    // 頭
    for (let i = 7 - Q.heads; i < 7; i++) {
      const p = headPos(e, i, 7);
      if (head.complete && head.naturalWidth) ctx.drawImage(head, Math.round(p.hx - 27), Math.round(p.hy - 33), 54, 66);
    }
    ctx.filter = 'none';
    ctx.restore();
  };

  function drawAir(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // 飛走嘅頭
    for (const f of Q.flying) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
      ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      if (head.complete) ctx.drawImage(head, -27, -33, 54, 66);
      ctx.restore();
    }
    // 噴出嚟嘅字
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const w of Q.words) {
      ctx.font = '900 22px "Noto Sans TC","PingFang TC",sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(w.text, w.x, w.y);
      ctx.fillStyle = '#ff4040'; ctx.fillText(w.text, w.x, w.y);
    }
    // 繩
    for (const r of Q.ropes) {
      ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const a = k / 10 * 6.2832 * 2 + r.t * 10, rr = 6 + k;
        const x = r.x + Math.cos(a) * rr * 0.7, y = r.y + Math.sin(a) * rr * 0.5;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // 對話氣泡
    for (const b of Q.bubbles) {
      const a = Math.min(1, (b.life - b.t) * 3, b.t * 8);
      const size = b.big ? 26 : 15;
      ctx.globalAlpha = a;
      ctx.font = `900 ${size}px "Noto Sans TC","PingFang TC",sans-serif`;
      const w = ctx.measureText(b.text).width + size, h = size * 1.6, y = b.y - b.t * 10;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(b.x - w / 2, y - h / 2, w, h, 8); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x - 6, y + h / 2 - 1); ctx.lineTo(b.x, y + h / 2 + 9); ctx.lineTo(b.x + 6, y + h / 2 - 1); ctx.fill();
      ctx.fillStyle = b.big ? '#c0102a' : '#111';
      ctx.fillText(b.text, b.x, y + 1);
    }
    ctx.restore();
  }

  const follow = G.Camera.follow;
  G.Camera.follow = function (tx, ty, dt) {
    const e = Q.boss;
    if (Q.on && e && !e.dead && Q.mode === 'seven') {
      // 鏡頭放喺玩家同柒爺個頭中間，兩個都睇到（玩家優先）
      const top = Math.min(ty, e.y - 215), bot = Math.max(ty, e.y);
      let c = (top + bot) / 2;
      c = Math.min(c, top + this.h / 2 - 100);          // 頭唔好俾頂部 HUD 遮住
      c = Math.max(c, ty - this.h / 2 + 90);             // 玩家唔好出畫
      if (e.drop <= 0) ty = c;
    }
    return follow.call(this, tx, ty, dt);
  };

  const startRun = G.Game.startRun;
  G.Game.startRun = function (...a) {
    Object.assign(Q, { on: false, done: false, boss: null, mode: null, dmgSum: 0, words: [], ropes: [], bubbles: [], flying: [],
                       heads: 7, won: false, challenge: false, prep: 0, calib: 0 });
    timerHide();
    return startRun.apply(this, a);
  };

  // ---------------- 打柒柒爺 Challenge ----------------
  const BEST_KEY = 'qiye_challenge_best';
  const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  function bestTime() { try { const v = parseFloat(localStorage.getItem(BEST_KEY)); return isFinite(v) ? v : null; } catch (e) { return null; } }

  function challenge() {
    G.Flow.play();
    setTimeout(() => {
      const pl = G.Game.player;
      if (!pl) return;
      Q.challenge = true; Q.prep = 0;
      // 60 級（所有形態同必殺都解鎖）：8 張升級卡任揀，揀完先開打
      pl.level = 52;
      for (let i = 0; i < 8; i++) G.Game.debugLevelUp();
      G.Spawner.say('打柒柒爺 Challenge：先揀 8 張升級卡', 3, true);
    }, 400);
  }
  // 揀完卡（返到遊戲 1 秒）→ 招式全滿級 → 柒爺登場
  function prepTick(dt, pl) {
    if (!pl || pl.dead || G.Game.state !== 'playing') { Q.prep = 0; return; }
    Q.prep += dt;
    if (Q.prep < 1) return;
    for (const m of pl.moves) while (G.Moves.levelUp(m));
    pl.hp = pl.maxHp;
    Q.challenge = true;
    if (G.CustomUlt) G.CustomUlt.fill();                     // 開打時必殺計量滿
    begin(pl, 60);
  }

  let timerEl = null;
  function timerShow() {
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.id = 'qiye-timer'; timerEl.setAttribute('translate', 'no');
      document.body.appendChild(timerEl);
    }
    const best = bestTime();
    timerEl.innerHTML = `打柒柒爺 <b>${mmss(Q.chT)}</b>` + (best != null ? ` <small>最快 ${mmss(best)}</small>` : '');
    timerEl.style.display = G.Game.state === 'over' || G.Game.state === 'ui' ? 'none' : 'block';
  }
  function timerHide() { if (timerEl) timerEl.style.display = 'none'; }
  const endHide = setInterval(() => { if (timerEl && (G.Game.state === 'over' || G.Game.state === 'ui')) timerHide(); }, 500);

  // 主選單：「自製角色」下面加一個大掣
  let menuBtn = null;
  function buildMenu() {
    const play = document.querySelector('#scr-menu .menu-item.play');
    if (!play || menuBtn) return;
    menuBtn = document.createElement('button');
    menuBtn.id = 'qiye-btn'; menuBtn.className = 'menu-item'; menuBtn.setAttribute('translate', 'no'); menuBtn.dataset.sfx = 'confirm';
    menuBtn.onclick = e => { e.stopPropagation(); challenge(); };
    play.insertAdjacentElement('afterend', menuBtn);
    refreshMenu();
    new MutationObserver(refreshMenu).observe(document.getElementById('scr-menu'), { attributes: true, attributeFilter: ['class'] });
  }
  function refreshMenu() {
    if (!menuBtn) return;
    const best = bestTime();
    const ico = G.Icons && G.Icons.html ? G.Icons.html('trophy', 26) : '';
    menuBtn.innerHTML = `<span class="mi-ico">${ico}</span><span>打柒柒爺 Challenge</span>` +
      `<small>${best != null ? '最快紀錄 ' + mmss(best) : '60 級起步・用你揀咗嘅夥伴'}</small>`;
  }
  const mIv = setInterval(() => { buildMenu(); if (menuBtn) clearInterval(mIv); }, 500);

  const css = document.createElement('style');
  css.textContent = `
    #qiye-btn { grid-column: 1 / -1; border-color: #ff4a4a !important; background: linear-gradient(#5a1010, #2a0608) !important;
      color: #ffd8d8 !important; }
    #qiye-btn small { color: #ffbcbc; }
    #qiye-timer { position: fixed; left: max(12px, env(safe-area-inset-left)); top: max(64px, calc(env(safe-area-inset-top) + 58px));
      z-index: 25; display: none; pointer-events: none; padding: 3px 12px; border-radius: 10px;
      background: rgba(40,4,8,.75); border: 2px solid #ff4a4a; color: #fff; font: 700 14px/1.3 sans-serif; text-shadow: 1px 1px 0 #000; }
    #qiye-timer b { color: #ffd23f; font-size: 16px; }
    #qiye-timer small { color: #ffcfcf; font-size: 11px; margin-left: 4px; }
  `;
  document.head.appendChild(css);

  G.Qiye = { get state() { return Q; }, debug(pl) { begin(pl || G.Game.player, 120); }, challenge };
})();
