/* ============ quickpick.js — 主選單自製角色頭像（個人自玩 mod） ============
 * 主選單夥伴卡下面一排自製角色頭像：撳一下就揀佢做夥伴（未有就自動加入）。
 * 自製角色 = G.DEX 入面 custom: true 嘅（js/data/custom.js），之後加新角色會自動出現。
 */
(() => {
  let row = null;

  function mark() {
    if (!row || !G.DB.save) return;
    row.querySelectorAll('.qp-av').forEach(b => b.classList.toggle('on', +b.dataset.dex === G.DB.save.partner));
  }

  function build() {
    const card = document.querySelector('#scr-menu .partner-card');
    const mons = G.DEX.filter(p => p.custom);
    if (!card || !mons.length || row) return;
    row = document.createElement('div');
    row.id = 'quick-pick';
    row.setAttribute('translate', 'no');
    row.innerHTML = '<div class="qp-t">自製角色</div><div class="qp-list"></div>';
    const list = row.querySelector('.qp-list');
    for (const p of mons) {
      const b = document.createElement('button');
      b.className = 'qp-av';
      b.dataset.dex = p.dex;
      b.dataset.sfx = 'confirm';
      b.appendChild(G.UI.spriteCanvas(p.dex, 64, 60, { scale: 1, shadow: true }));
      b.insertAdjacentHTML('beforeend', `<span>${p.name}</span>`);
      b.onclick = () => {
        const s = G.DB.save;
        if (!s) return;
        if (!s.owned[p.dex]) G.DB.grant(p.dex, 'starter');
        if (s.partner === p.dex) return;
        s.partner = p.dex;
        s.partnerShiny = false;
        G.DB.commit();
        G.UI.toast(p.name + ' 而家係你嘅夥伴');
        G.MenuUI.open();
        mark();
      };
      list.appendChild(b);
    }
    card.insertAdjacentElement('afterend', row);
    // 主選單每次打開都更新邊個係而家嘅夥伴
    new MutationObserver(mark).observe(document.getElementById('scr-menu'), { attributes: true, attributeFilter: ['class'] });
    mark();
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', build); else build();
  // 有啲情況主選單遲啲先砌好：再試多次
  const iv = setInterval(() => { build(); if (row) { mark(); clearInterval(iv); } }, 500);

  const css = document.createElement('style');
  css.textContent = `
    #quick-pick { margin-top: 10px; text-align: center; }
    #quick-pick .qp-t { font-size: 12px; color: var(--muted, #9aa3c0); margin-bottom: 6px; }
    #quick-pick .qp-list { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    #quick-pick .qp-av { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 6px 6px;
      border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: rgba(10,16,40,.55); color: #fff;
      font: 700 12px/1.1 sans-serif; cursor: pointer; }
    #quick-pick .qp-av canvas { width: 64px; height: 60px; image-rendering: pixelated; }
    #quick-pick .qp-av.on { border-color: #ffd23f; box-shadow: 0 0 10px 2px rgba(255,210,63,.55); }
  `;
  document.head.appendChild(css);
})();
