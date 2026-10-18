/* ============ portrait.js — 打直玩（個人自玩 mod） ============
 * 原版一打直就叫你轉機。呢度：
 *   - 唔再彈「請轉機」（game.js / settings-ui.js 會睇 G.ALLOW_PORTRAIT）
 *   - 打直時鏡頭用較窄嘅視野，公仔唔會細到睇唔到
 *   - 畫面排位（升級卡、選單）喺窄身畫面改成上下排
 */
(() => {
  G.ALLOW_PORTRAIT = true;

  // 打直時：可見世界闊度 PORTRAIT_VIEW_W（原版橫向係 768）
  const PORTRAIT_VIEW_W = 430, PORTRAIT_MIN_H = 720;
  const resize = G.Camera.resize;
  G.Camera.resize = function (cssW, cssH, dpr = 1) {
    if (cssH > cssW) {
      this.dpr = dpr;
      this.scale = Math.min(cssW / PORTRAIT_VIEW_W, cssH / PORTRAIT_MIN_H);
      this.w = cssW / this.scale;
      this.h = cssH / this.scale;
      return;
    }
    return resize.call(this, cssW, cssH, dpr);
  };

  const css = document.createElement('style');
  css.textContent = `
    #rotate { display: none !important; }
    @media (orientation: portrait) and (max-width: 600px) {
      .scr .box { max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px); overflow-y: auto; }
      /* 頂部列：上下兩行置中，唔再遮住標題 */
      .topbar { left: 6px; right: 6px; top: 6px; flex-wrap: wrap; justify-content: center; gap: 5px; }
      .topbar .pill { padding: 3px 10px; font-size: 13px; }
      .topbar .btn.small { padding: 2px 7px; }
      .credits-line { display: none !important; }
      /* 主選單：上面夥伴，下面兩欄選項 */
      #scr-menu { flex-direction: column; justify-content: flex-start; overflow-y: auto; padding: 0; }
      .menu-left { flex: none; width: 100%; padding: 100px 8px 0; }
      .menu-left .logo .t1 { font-size: 34px; }
      .partner-card { margin-top: 4px; }
      .partner-card .nm { font-size: 20px; }
      #menu-partner { height: min(24vh, 170px); width: auto; }
      .menu-right { width: 100%; padding: 6px 10px 16px; gap: 8px; background: none; overflow: visible; }
      .menu-right > :first-child, .menu-right > :last-child { margin: 0; }
      .menu-right .box { padding: 8px 10px; }
      .menu-list { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; }
      .menu-item { font-size: 17px; padding: 5px 6px; grid-template-columns: 24px 1fr; column-gap: 4px; }
      .menu-item.play { grid-column: span 2; font-size: 24px; }
      .menu-item small { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* 子畫面（圖鑑、強化、扭蛋…）：讓出頂部列，左右兩欄改成上下 */
      #scr-goals, #scr-dex, #scr-upgrades, #scr-gacha, #scr-friends, #scr-rank, #scr-lobby, #scr-profile { padding: 92px 8px 8px !important; overflow-y: auto; }
      #scr-goals:not(.hidden), #scr-dex:not(.hidden), #scr-upgrades:not(.hidden), #scr-gacha:not(.hidden), #scr-friends:not(.hidden), #scr-rank:not(.hidden), #scr-lobby:not(.hidden), #scr-profile:not(.hidden) { display: block !important; }
      #scr-goals .box, #scr-dex .box, #scr-upgrades .box, #scr-gacha .box, #scr-friends .box, #scr-rank .box, #scr-lobby .box, #scr-profile .box { max-height: none; margin: 0 auto; }
      .split { grid-template-columns: 1fr !important; }
      #scr-dex .box { height: auto !important; }
      .gen-tabs { flex-wrap: nowrap; overflow-x: auto; }
    }
  `;
  document.head.appendChild(css);
})();
