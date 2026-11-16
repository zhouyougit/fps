/* =====================================================================
   SALTLINE — 《几猫》扩展层
   在引擎包之后加载：只通过 window.__G（共享上下文）工作，
   不改动引擎内部闭包，降低回归风险。
   v2.0: 护甲 / 拾取 / 手雷 / 近战 / HUD 扩展 / 检查点
   ===================================================================== */
(function () {
  "use strict";

  var G = null;
  var booted = false;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var CLOCK = null, UICLOCK = null, TEST_MODE = false;

  // V53 ARCH-2：不再用空 catch 静默吞错。软错误统一走 SXErrors.soft("ext:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 __errors。
  function soft(tag, e) {
    try {
      if (typeof window !== "undefined" && window.SXErrors && typeof window.SXErrors.soft === "function") {
        window.SXErrors.soft("ext:" + tag, e);
        return;
      }
    } catch (_) { /* 诊断失败不能影响调用方 */ }
    try {
      if (typeof window !== "undefined" && window.__errors) {
        window.__errors.push("[ext:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { /* 只读 / 被冻结的 __errors：仍然吞掉并继续 */ }
  }

  function gameAfter(sec, fn, group) {
    var done = false;
    function once() { if (done) return; done = true; try { fn(); } catch (e) { soft("timer", e); } }
    var cancel = null;
    if (CLOCK) { try { cancel = CLOCK.after(sec, once, group || "mission"); } catch (e) { soft("clock", e); } }
    // ?dt= 快进模式同时挂真实定时器：固定步测试与真实等待都能触发同一事件
    if (TEST_MODE) setTimeout(once, sec * 1000);
    return cancel || function () {};
  }

  /* ---------------------------------------------------------------- utils */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function dist2d(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  /* ------------------------------------------------------------ CSS */
  function injectCSS() {
    if (document.getElementById("sx-css")) return;
    var css = document.createElement("style");
    css.id = "sx-css";
    css.textContent = [
      "/* ---- v2 HUD extensions ---- */",
      ".x-armor{position:absolute;left:var(--gl);bottom:calc(96px + var(--sab));opacity:0;transition:opacity .35s;text-shadow:var(--shadow);}",
      ".x-armor.on{opacity:1;}",
      ".x-armor .h-k{font-size:10px;letter-spacing:.28em;}",
      ".x-armor-row{display:flex;align-items:center;gap:9px;margin-top:6px;}",
      ".x-armor-n{font:700 20px/.8 var(--f-display);letter-spacing:.02em;color:#9fd4e3;min-width:1.6em;}",
      ".x-armor-bar{display:flex;gap:3px;}",
      ".x-armor-bar i{width:13px;height:5px;background:#9fd4e3;box-shadow:0 0 2px rgba(0,0,0,.6);}",
      ".x-armor-bar i.off{background:transparent;box-shadow:inset 0 0 0 1px rgba(159,212,227,.28);}",
      ".x-armor.hit .x-armor-n{color:#ffd9a0;}",
      ".x-loadout{position:absolute;right:var(--gr);bottom:calc(150px + var(--sab));display:flex;gap:8px;align-items:flex-end;text-shadow:var(--shadow);}",
      ".x-slot{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 6px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.42);opacity:.52;transition:opacity .2s,border-color .2s;}",
      ".x-slot.on{opacity:1;border-color:var(--signal);background:rgba(255,179,71,.12);}",
      ".x-slot b{font:700 11px/1 var(--f-display);width:14px;height:14px;line-height:13px;text-align:center;border:1px solid rgba(232,228,218,.4);color:var(--bone);}",
      ".x-slot.on b{border-color:var(--signal);color:var(--signal);}",
      ".x-slot span{font:600 10px/1 var(--f-label);letter-spacing:.14em;text-transform:uppercase;color:rgba(232,228,218,.85);}",
      ".x-slot em{font-style:normal;font:500 9px/1 var(--f-mono);color:rgba(232,228,218,.5);}",
      ".x-gren{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.42);}",
      ".x-gren.idle{opacity:.5;}",
      ".x-gren svg{width:16px;height:16px;display:block;}",
      ".x-gren b{font:700 13px/1 var(--f-display);color:var(--bone);}",
      ".x-gren.empty b{color:var(--alarm);}",
      ".x-gren .k{font:600 9px/1 var(--f-label);letter-spacing:.1em;color:rgba(232,228,218,.45);}",
      ".x-toast{position:absolute;left:50%;bottom:calc(27% + var(--sab));transform:translate(-50%,8px);padding:7px 14px 6px;background:rgba(11,13,15,.66);border-left:2px solid var(--signal);",
      "  font:600 13px/1.2 var(--f-label);letter-spacing:.16em;color:var(--bone);opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap;text-shadow:var(--shadow);}",
      ".x-toast.on{opacity:1;transform:translate(-50%,0);}",
      ".x-toast.warn{border-left-color:var(--alarm);color:#ffb4a8;}",
      ".x-gren-fade{position:absolute;left:50%;bottom:calc(20% + var(--sab));transform:translateX(-50%);font:700 12px/1 var(--f-label);letter-spacing:.3em;color:var(--signal);opacity:0;transition:opacity .15s;}",
      ".x-gren-fade.on{opacity:.9;}",
      ".m-dead .btn.x-cp{margin-top:0;}",
      ".x-hint{position:absolute;right:var(--gr);bottom:calc(176px + var(--sab));font:500 10px/1.4 var(--f-mono);letter-spacing:.12em;color:rgba(232,228,218,.4);text-align:right;transition:opacity .3s;}",
      ".x-hint b{color:rgba(232,228,218,.72);}",
      "@media (max-width:760px){.x-loadout{bottom:calc(214px + var(--sab));}.x-hint{display:none;}}",
      ".is-touch .x-armor{top:calc(196px + var(--sat));bottom:auto;}",
      ".is-touch .x-loadout{bottom:auto;top:calc(18px + var(--sat));right:auto;left:50%;transform:translateX(-50%);}",
      "/* ---- v3 campaign ---- */",
      ".x-camp{position:absolute;inset:0;z-index:70;display:none;color:var(--bone);pointer-events:auto;}",
      ".x-camp.on{display:block;}",
      ".x-camp-veil{position:absolute;inset:0;background:rgba(6,8,10,.9);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}",
      ".x-camp-panel{position:relative;max-width:1080px;margin:0 auto;padding:5vh 4vw 4vh;height:100%;display:flex;flex-direction:column;overflow:hidden;}",
      ".x-camp-h{font:900 clamp(28px,4vw,48px)/1.05 var(--f-display);letter-spacing:.1em;margin:8px 0 6px;}",
      ".x-camp-sub{font:500 12px/1.7 var(--f-mono);letter-spacing:.12em;color:var(--steel);margin-bottom:26px;}",
      ".x-camp-list{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;flex:1 1 auto;min-height:0;overflow-y:auto;align-content:start;}",
      ".x-mcard{position:relative;text-align:left;padding:20px 20px 18px;background:rgba(11,13,15,.55);border:1px solid rgba(232,228,218,.16);color:var(--bone);cursor:pointer;transition:border-color .2s,background .2s;min-height:196px;font-family:var(--f-label);}",
      ".x-mcard:hover{border-color:rgba(232,228,218,.42);}",
      ".x-mcard.sel{border-color:var(--signal);background:rgba(255,179,71,.1);}",
      ".x-mcard.locked{opacity:.4;cursor:not-allowed;}",
      ".x-mcard .code{font:700 11px/1 var(--f-mono);letter-spacing:.3em;color:var(--signal);}",
      ".x-mcard h3{font:900 24px/1.1 var(--f-display);letter-spacing:.06em;margin:10px 0 4px;}",
      ".x-mcard .sub{font:500 11px/1.4 var(--f-mono);letter-spacing:.1em;color:var(--steel);}",
      ".x-mcard p{font:400 12px/1.7 var(--f-label);color:var(--bone-dim);margin:12px 0 0;}",
      ".x-mcard .meta{margin-top:14px;font:500 10px/1.5 var(--f-mono);color:rgba(232,228,218,.5);letter-spacing:.06em;}",
      ".x-mcard .lock{position:absolute;right:14px;top:14px;font:600 10px/1 var(--f-label);letter-spacing:.2em;color:var(--bone-faint);}",
      ".x-camp-actions{display:flex;gap:10px;margin-top:18px;flex:0 0 auto;}",
      ".x-camp-note{margin-top:16px;font:400 11px/1.6 var(--f-mono);color:var(--bone-faint);letter-spacing:.06em;}",
      "/* ---- v4 boss ---- */",
      ".x-boss{position:absolute;left:50%;top:calc(88px + var(--sat));transform:translate(-50%,-10px);width:min(560px,72vw);opacity:0;transition:opacity .45s,transform .45s;text-align:center;pointer-events:none;}",
      ".x-boss.on{opacity:1;transform:translate(-50%,0);}",
      ".x-boss-k{font:700 12px/1 var(--f-label);letter-spacing:.34em;margin-right:-.34em;color:var(--signal);text-transform:uppercase;margin-bottom:9px;text-shadow:var(--shadow);}",
      ".x-boss-track{height:6px;background:rgba(232,228,218,.14);border:1px solid rgba(232,228,218,.22);}",
      ".x-boss-track i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--rust),var(--signal));transform-origin:left center;transition:transform .1s linear;}",
      ".x-boss-pips{display:flex;gap:6px;justify-content:center;margin-top:7px;}",
      ".x-boss-pips em{width:20px;height:3px;background:rgba(232,228,218,.18);}",
      ".x-boss-pips em.on{background:var(--alarm);box-shadow:0 0 6px rgba(255,90,64,.5);}",
      "/* ---- v5 scope ---- */",
      ".x-scope{position:absolute;inset:0;opacity:0;transition:opacity .1s;pointer-events:none;}",
      ".x-scope.on{opacity:1;}",
      ".x-scope::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 30vmin, rgba(4,6,9,.82) 33vmin, rgba(4,6,9,.96) 48vmin);}",
      ".x-scope::after{content:'';position:absolute;left:50%;top:50%;width:62vmin;height:62vmin;transform:translate(-50%,-50%);border-radius:50%;box-shadow:inset 0 0 0 2px rgba(0,0,0,.9), inset 0 0 44px rgba(0,0,0,.5);}",
      ".x-scope-dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;background:#ff5a40;border-radius:50%;box-shadow:0 0 6px rgba(255,90,64,.9);}",
      ".x-scope-h,.x-scope-v{position:absolute;left:50%;top:50%;background:rgba(10,12,14,.55);}",
      ".x-scope-h{width:44vmin;height:1px;transform:translate(-50%,-0.5px);}",
      ".x-scope-v{width:1px;height:38vmin;transform:translate(-0.5px,-50%);}",
      ".hud.scoped .h-cross{opacity:0 !important;}",
      "/* ---- v6 tactics ---- */",
      ".x-scan{position:absolute;right:var(--gr);bottom:calc(196px + var(--sab));display:flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.42);font:600 10px/1 var(--f-label);letter-spacing:.14em;color:rgba(232,228,218,.75);text-shadow:var(--shadow);}",
      ".x-scan b{width:15px;height:15px;line-height:14px;text-align:center;border:1px solid rgba(232,228,218,.45);color:var(--bone);}",
      ".x-scan.cd{opacity:.55;}",
      ".x-scan.cd b{border-color:rgba(232,228,218,.2);color:rgba(232,228,218,.4);}",
      ".x-scan-cd{font:500 9px/1 var(--f-mono);color:var(--signal);min-width:1.1em;text-align:right;}",
      ".x-scan-marks{position:absolute;inset:0;pointer-events:none;}",
      ".x-sm{position:absolute;left:0;top:0;width:0;height:0;color:#8fd8ff;will-change:transform;text-shadow:var(--shadow);}",
      ".x-sm i{position:absolute;left:-6px;top:-6px;width:12px;height:12px;border:1.5px solid currentColor;transform:rotate(45deg);background:rgba(8,14,18,.35);}",
      ".x-sm b{position:absolute;left:-40px;width:80px;top:10px;text-align:center;font:600 10px/1 var(--f-mono);color:#c8ecff;}",
      ".x-sm.near i{background:rgba(143,216,255,.3);}",
      ".x-scan-pulse{position:absolute;left:50%;top:50%;width:22vmin;height:22vmin;margin:-11vmin;border:2px solid rgba(143,216,255,.55);border-radius:50%;opacity:0;pointer-events:none;}",
      ".x-scan-pulse.on{animation:scanring .75s ease-out;}",
      "@keyframes scanring{0%{opacity:.8;transform:scale(.15);}100%{opacity:0;transform:scale(4.2);}}",
      "@media (max-width:760px){.x-scan{display:none;}}",
      "@media(max-width:1180px){.x-camp-list{grid-template-columns:repeat(2,1fr);}}",
      "@media(max-height:760px){.x-camp-panel{padding:3vh 4vw 3vh;}.x-camp-h{font-size:30px;margin:4px 0 4px;}.x-camp-sub{margin-bottom:14px;}.x-mcard{min-height:0;padding:14px 16px;}.x-mcard h3{font-size:20px;margin:6px 0 2px;}.x-mcard p{display:none;}.x-camp-actions{margin-top:12px;}}",
      "@media(max-width:760px){.x-camp-list{grid-template-columns:1fr;}.x-mcard{min-height:0;}}",
      "/* ---- v7 training ---- */",
      ".x-train-card{border-style:dashed;}",
      ".x-train-card .code{color:#8fd8ff;}",
      ".x-train-hud{position:absolute;left:50%;top:calc(78px + var(--sat));transform:translate(-50%,-8px);text-align:center;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;}",
      ".x-train-hud.on{opacity:1;transform:translate(-50%,0);}",
      ".x-train-hud .k{font:600 10px/1 var(--f-label);letter-spacing:.34em;margin-right:-.34em;color:var(--signal);text-transform:uppercase;margin-bottom:7px;text-shadow:var(--shadow);}",
      ".x-train-hud .row{display:flex;align-items:baseline;justify-content:center;gap:8px;}",
      ".x-train-hud .t{font:700 30px/.9 var(--f-display);color:var(--bone);min-width:2.4em;text-align:right;font-variant-numeric:tabular-nums;text-shadow:var(--shadow);}",
      ".x-train-hud .s{font:700 30px/.9 var(--f-display);color:var(--signal);min-width:2em;text-align:left;font-variant-numeric:tabular-nums;text-shadow:var(--shadow);}",
      ".x-train-hud span{font:500 10px/1 var(--f-mono);color:var(--bone-dim);letter-spacing:.1em;}",
      ".x-train-result{position:absolute;inset:0;z-index:75;display:none;color:var(--bone);pointer-events:auto;}",
      ".x-train-result.on{display:block;}",
      ".x-tr-veil{position:absolute;inset:0;background:rgba(5,7,9,.9);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);}",
      ".x-tr-panel{position:relative;max-width:560px;margin:0 auto;top:50%;transform:translateY(-50%);padding:34px 38px 30px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.75);text-align:left;}",
      ".x-tr-panel h2{font:900 40px/1.05 var(--f-display);letter-spacing:.12em;margin:8px 0 18px;}",
      ".x-tr-score{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;}",
      ".x-tr-score b{font:700 64px/.85 var(--f-display);color:var(--signal);}",
      ".x-tr-score span{font:600 10px/1 var(--f-mono);letter-spacing:.24em;color:var(--bone-dim);}",
      ".x-tr-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin:0 0 22px;}",
      ".x-tr-stats div{display:flex;justify-content:space-between;border-bottom:1px solid rgba(232,228,218,.12);padding-bottom:6px;}",
      ".x-tr-stats dt{font:500 11px/1 var(--f-mono);letter-spacing:.1em;color:var(--steel);}",
      ".x-tr-stats dd{font:700 15px/1 var(--f-display);margin:0;}",
      ".x-tr-actions{display:flex;gap:10px;}",
      "@media(max-width:620px){.x-tr-panel{padding:24px;}.x-tr-panel h2{font-size:30px;}}",
      "/* ---- v8 armory ---- */",
      ".x-armory{position:absolute;inset:0;z-index:78;display:none;color:var(--bone);pointer-events:auto;}",
      ".x-armory.on{display:block;}",
      ".x-ar-veil{position:absolute;inset:0;background:rgba(5,7,9,.9);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);}",
      ".x-ar-panel{position:relative;max-width:980px;margin:0 auto;top:50%;transform:translateY(-50%);padding:28px 32px 26px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.82);max-height:94vh;overflow:auto;}",
      ".x-ar-panel h2{font:900 38px/1.05 var(--f-display);letter-spacing:.14em;margin:6px 0 16px;}",
      ".x-ar-tabs{display:flex;gap:8px;margin:0 0 18px;}",
      ".x-ar-tab{display:flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.5);color:var(--bone);cursor:pointer;font:600 11px/1 var(--f-label);letter-spacing:.12em;}",
      ".x-ar-tab b{width:16px;height:16px;line-height:15px;text-align:center;border:1px solid rgba(232,228,218,.35);font:700 10px/1 var(--f-display);}",
      ".x-ar-tab.on{border-color:var(--signal);color:var(--signal);background:rgba(255,179,71,.1);}",
      ".x-ar-body{display:grid;grid-template-columns:1fr 220px;gap:24px;align-items:start;}",
      ".x-ar-row{margin-bottom:14px;}",
      ".x-ar-row-h{font:600 10px/1 var(--f-label);letter-spacing:.26em;color:var(--steel);text-transform:uppercase;margin-bottom:7px;}",
      ".x-ar-opts{display:flex;flex-wrap:wrap;gap:8px;}",
      ".x-ar-opt{text-align:left;min-width:150px;padding:9px 11px;border:1px solid rgba(232,228,218,.16);background:rgba(11,13,15,.5);color:var(--bone);cursor:pointer;font-family:var(--f-label);}",
      ".x-ar-opt b{display:block;font:600 12px/1.2 var(--f-label);letter-spacing:.06em;}",
      ".x-ar-opt span{display:block;margin-top:4px;font:400 10px/1.4 var(--f-mono);color:var(--steel);}",
      ".x-ar-opt.on{border-color:var(--signal);background:rgba(255,179,71,.12);}",
      ".x-ar-stats{border-left:1px solid rgba(232,228,218,.12);padding-left:18px;}",
      ".x-ar-stat{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(232,228,218,.08);padding:7px 0;}",
      ".x-ar-stat span{font:500 10px/1 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-ar-stat b{font:700 14px/1 var(--f-display);color:var(--bone);}",
      ".x-ar-actions{display:flex;gap:10px;margin-top:20px;}",
      "/* ---- v9 access / perf ---- */",
      ".hud .h-cross i{background:var(--cross-col,var(--bone));}",
      ".x-perf{position:absolute;left:var(--gl);top:calc(96px + var(--sat));z-index:60;display:none;pointer-events:none;}",
      ".x-perf.on{display:block;}",
      ".x-perf pre{margin:0;padding:8px 11px;font:11px/1.55 var(--f-mono);color:#cfe8d0;background:rgba(4,6,8,.74);border-left:2px solid var(--signal);white-space:pre;text-shadow:none;}",
      ".x-final{margin:16px 0 0;padding:10px 12px;border-left:2px solid var(--signal);background:rgba(255,179,71,.08);font:600 12px/1.5 var(--f-label);letter-spacing:.12em;color:var(--signal);}",
      ".x-final-back{margin-top:10px;}",
      "/* ---- V10 UX polish ---- */",
      ".m-debrief .m-h{white-space:normal;font-size:clamp(24px,5.4vw,34px);line-height:1.08;overflow-wrap:anywhere;}",
      ".m-debrief{max-width:min(520px,92vw);}",
      ".hud .h-health{opacity:.55;transition:opacity .3s;}",
      ".hud .h-health.on{opacity:1;}",
      ".hud.scoped .h-obj,.hud.scoped .comms,.hud.scoped .h-feed,.hud.scoped .h-msg,.hud.scoped .h-marks{opacity:0;}",
      "@media(min-width:1180px){.m-only-narrow{display:none;}}",
      "@media(max-width:420px){.m-actions .btn{flex:1 1 45%;min-width:88px;}}",
      ".x-camp-veil{background:rgba(6,8,10,.96);}",
      "/* ---- V11 briefing ---- */",
      ".x-brief{position:absolute;inset:0;z-index:76;display:none;pointer-events:auto;color:var(--bone);}",
      ".x-brief.on{display:block;}",
      ".x-br-veil{position:absolute;inset:0;background:rgba(5,7,9,.94);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);}",
      ".x-br-panel{position:relative;max-width:660px;margin:0 auto;top:50%;transform:translateY(-50%);padding:30px 34px 26px;border:1px solid rgba(232,228,218,.18);background:rgba(11,13,15,.86);}",
      ".x-br-h{font:900 42px/1.05 var(--f-display);letter-spacing:.12em;margin:6px 0 4px;}",
      ".x-br-sub{font:500 12px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-br-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;margin:16px 0 14px;padding:12px 0;border-top:1px solid rgba(232,228,218,.12);border-bottom:1px solid rgba(232,228,218,.12);}",
      ".x-br-meta div{display:flex;justify-content:space-between;gap:12px;}",
      ".x-br-meta span{font:500 10px/1.4 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-br-meta b{font:600 12px/1.4 var(--f-label);color:var(--bone);text-align:right;}",
      ".x-br-list{margin:0 0 20px;padding-left:18px;font:500 13px/1.9 var(--f-label);color:var(--bone-dim);}",
      ".x-br-list li::marker{color:var(--signal);}",
      ".x-br-actions{display:flex;gap:10px;}",
      "@media(max-width:620px){.x-br-panel{padding:22px;}.x-br-h{font-size:30px;}.x-br-meta{grid-template-columns:1fr;}}",
      "/* ---- V13 challenges ---- */",
      ".x-mcard .x-mchal{position:absolute;right:12px;bottom:10px;font:600 9px/1 var(--f-mono);letter-spacing:.12em;color:var(--signal);opacity:.85;}",
      ".x-chal{margin:14px 0 0;padding:10px 12px;border-left:2px solid var(--signal);background:rgba(255,179,71,.06);font:500 11px/1.6 var(--f-label);color:var(--bone-dim);}",
      ".x-chal b{display:block;color:var(--signal);font:600 10px/1.4 var(--f-mono);letter-spacing:.12em;margin-bottom:4px;}",
      ".x-chal i{display:inline-block;margin-right:10px;font-style:normal;color:var(--steel);}",
      ".x-chal i.ok{color:#9cff6a;}",
      ".x-chal em{display:block;margin-top:6px;font-style:normal;color:var(--bone);}",
      ".x-chal em.unlock{color:var(--signal);}",
      ".x-br-chal-wrap{margin:-6px 0 18px;}",
      ".x-br-chal-wrap>b{font:600 10px/1.4 var(--f-mono);letter-spacing:.12em;color:var(--steel);}",
      ".x-br-chal{display:flex;flex-wrap:wrap;gap:8px 18px;list-style:none;margin:8px 0 0;padding:0;font:500 11px/1.4 var(--f-label);color:var(--steel);}",
      ".x-br-chal li.ok{color:#9cff6a;}",
      ".seg button.locked{opacity:.32;cursor:not-allowed;}",
      "/* ---- V14 accessibility ---- */",
      "body.reduce-motion *{animation-duration:.001s!important;animation-iteration-count:1!important;transition-duration:.001s!important;}",
      ".panel-b h3{margin:18px 0 8px;font:600 10px/1.4 var(--f-mono);letter-spacing:.16em;color:var(--signal);text-transform:uppercase;}",
      ".panel-b h3:first-child{margin-top:0;}",
      ".loc-card{pointer-events:none!important;}",
      ".x-end-choice{display:flex;gap:10px;margin:14px 0 4px;}",
      ".x-interlude{position:absolute;inset:0;z-index:77;display:none;pointer-events:auto;color:var(--bone);}",
      ".x-interlude.on{display:block;}",
      ".x-int-veil{position:absolute;inset:0;background:rgba(4,6,8,.94);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
      ".x-int-card{position:relative;max-width:640px;margin:0 auto;top:50%;transform:translateY(-50%);padding:34px 38px;border-left:2px solid var(--signal);background:rgba(8,10,12,.9);}",
      ".x-int-card h2{font:900 40px/1.05 var(--f-display);letter-spacing:.14em;margin:6px 0 4px;}",
      ".x-int-card .sub{font:500 11px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--steel);margin-bottom:20px;}",
      ".x-int-lines p{font:500 14px/1.9 var(--f-label);color:var(--bone-dim);margin:0 0 10px;max-width:52ch;}",
      ".x-int-card .btn{margin-top:18px;}",
      ".x-archive{position:absolute;inset:0;z-index:77;display:none;pointer-events:auto;color:var(--bone);}",
      ".x-archive.on{display:block;}",
      ".x-arc-veil{position:absolute;inset:0;background:rgba(4,6,8,.94);}",
      ".x-arc-panel{position:relative;max-width:680px;margin:0 auto;top:50%;transform:translateY(-50%);padding:28px 32px;border:1px solid rgba(232,228,218,.18);background:rgba(10,12,14,.92);}",
      ".x-arc-panel h2{font:900 34px/1.05 var(--f-display);letter-spacing:.16em;margin:4px 0;}",
      ".x-arc-sub{font:500 11px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--steel);margin-bottom:14px;}",
      ".x-arc-row{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:12px;align-items:center;padding:9px 0;border-top:1px solid rgba(232,228,218,.09);font:500 12px/1.4 var(--f-label);}",
      ".x-arc-row b{color:var(--bone);font-weight:600;}",
      ".x-arc-row span{font:500 10px/1.4 var(--f-mono);color:var(--steel);letter-spacing:.08em;}",
      ".x-arc-row em{font-style:normal;color:var(--signal);text-align:right;font-size:11px;}",
      ".x-arc-row.lock{opacity:.45;}",
      ".x-arc-final{margin-top:14px;padding:10px 12px;border-left:2px solid var(--signal);background:rgba(255,179,71,.06);font:500 11px/1.8 var(--f-label);color:var(--bone-dim);}",
      ".x-arc-actions{margin-top:18px;display:flex;justify-content:flex-end;}",
      "/* ---- V27 accessibility ---- */",
      ".hud{zoom:var(--hud-scale,1);}",
      ".comms-t{font-size:calc(15px * var(--sub-scale,1)) !important;line-height:1.5 !important;}",
      ".comms-who{font-size:calc(9px * var(--sub-scale,1)) !important;}",
      "body.hc .hud{text-shadow:0 2px 8px #000,0 0 2px #000;}",
      "body.hc .comms{background:rgba(0,0,0,.62);}",
      "body.hc .h-obj-t,body.hc .h-k,body.hc .h-health,body.hc .x-scan{color:#fff;}",
      ".m-ver{position:absolute;right:calc(var(--gr) + 8px);top:calc(clamp(14px, 5.5vh, 52px) + var(--sat) + 12px);font:500 9px/1.4 var(--f-mono);letter-spacing:.18em;color:var(--steel);opacity:.8;}",
      "/* ---- V28 onboarding ---- */",
      ".x-guide{position:absolute;right:calc(var(--gr) + 6px);top:38%;z-index:64;display:none;pointer-events:auto;max-width:300px;padding:14px 16px;background:rgba(6,8,10,.82);border-left:2px solid var(--signal);font:500 11px/1.7 var(--f-label);color:var(--bone-dim);}",
      ".x-guide.on{display:block;}",
      ".x-guide>b{display:block;font:600 10px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--signal);margin-bottom:8px;}",
      ".x-guide-row{margin:4px 0;}",
      ".x-guide kbd{display:inline-block;min-width:20px;padding:1px 4px;margin:0 2px;border:1px solid rgba(232,228,218,.3);font:600 9px/1.3 var(--f-mono);color:var(--bone);text-align:center;}",
      ".x-guide-actions{display:flex;gap:8px;margin-top:10px;}",
      ".x-train-step{position:absolute;right:calc(var(--gr) + 6px);top:32%;z-index:64;display:none;pointer-events:none;padding:12px 14px;background:rgba(6,8,10,.72);border-left:2px solid var(--signal);font:500 11px/1.8 var(--f-label);color:var(--steel);}",
      ".x-train-step.on{display:block;}",
      ".x-train-step b{display:block;font:600 10px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--signal);margin-bottom:6px;}",
      ".x-train-step i{display:block;font-style:normal;}",
      ".x-train-step i em{font-style:normal;color:var(--bone-dim);}",
      ".x-train-step i.done{color:#9cff6a;}",
      ".x-train-step.done b{color:#9cff6a;}",
      ".x-end-choice .btn{flex:1;}",
      ".x-final.x-ending{line-height:1.9;font-size:12px;}",
      ".x-final.x-ending b{color:var(--signal);}",
      "@media(max-width:760px){.x-ar-body{grid-template-columns:1fr;}.x-ar-stats{border-left:0;padding-left:0;display:grid;grid-template-columns:1fr 1fr;gap:0 18px;}.x-ar-panel{padding:20px;}}"
    ].join("\n");
    document.head.appendChild(css);
  }

  /* ------------------------------------------------------------ HUD */
  var HUD = null;

  // V53 PERF-4：没有武器系统（无 w.list / w.slots）时的缓存槽位数组。
  // 复用同一个对象、只原地改 ammo，固定步不再新建数组。
  var SLOT_FALLBACK = [{ short: "九式", ammo: 0 }];

  // 槽位 HTML：纯函数，便于单测；输出与旧实现一致（槽位 + 手雷数字/空态）。
  function buildSlotsHtml(list, active, grenades) {
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      html += '<div class="x-slot' + (i === active ? " on" : "") + '"><b>' + (i + 1) + "</b><span>" + w.short + "</span><em>" + (w.ammo | 0) + "</em></div>";
    }
    html += '<div class="x-gren' + (grenades > 0 ? "" : " empty") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 8.5a5.5 5.5 0 1 0 6 0V6H9v2.5Z"/><path d="M11 6V4h2v2M13 3.2l2.6-1.1"/></svg><b>' + grenades + '</b><span class="k">G</span></div>';
    return html;
  }

  // 槽位脏检查：只比较值，不建数组/字符串（PERF-4）。cache 由 HUD 持有。
  function slotsChanged(cache, list, active, grenades) {
    if (cache.n !== list.length || cache.active !== active || cache.gren !== grenades) return true;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (cache.shorts[i] !== w.short || cache.ammos[i] !== w.ammo) return true;
    }
    return false;
  }
  function rememberSlots(cache, list, active, grenades) {
    var n = list.length;
    cache.n = n; cache.active = active; cache.gren = grenades;
    for (var i = 0; i < n; i++) {
      cache.shorts[i] = list[i].short;
      cache.ammos[i] = list[i].ammo;
    }
    if (cache.shorts.length > n) { cache.shorts.length = n; cache.ammos.length = n; }
  }

  function buildHUD() {
    var root = G.hud.root;
    var armor = el("div", "x-armor", '<div class="h-k">护甲</div><div class="x-armor-row"><b class="x-armor-n">0</b><div class="x-armor-bar">' +
      new Array(11).join("<i class='off'></i>") + "</div></div>");
    var loadout = el("div", "x-loadout");
    var toast = el("div", "x-toast");
    var scope = el("div", "x-scope", '<i class="x-scope-dot"></i><b class="x-scope-h"></b><b class="x-scope-v"></b>');
    var scanChip = el("div", "x-scan", '<b>Q</b><span>战术扫描</span><i class="x-scan-cd"></i>');
    var scanMarks = el("div", "x-scan-marks");
    var scanPulse = el("div", "x-scan-pulse");
    root.appendChild(armor);
    root.appendChild(loadout);
    root.appendChild(toast);
    root.appendChild(scope);
    root.appendChild(scanMarks);
    root.appendChild(scanPulse);
    root.appendChild(scanChip);
    HUD = {
      scopeEl: scope,
      scopeOn: false,
      scanEl: scanChip,
      scanCdEl: scanChip.querySelector(".x-scan-cd"),
      marksEl: scanMarks,
      pulseEl: scanPulse,
      armorEl: armor,
      armorNum: armor.querySelector(".x-armor-n"),
      armorSegs: [].slice.call(armor.querySelectorAll(".x-armor-bar i")),
      loadoutEl: loadout,
      toastEl: toast,
      toastT: 0,
      armorHitT: 0,
      lastArmor: -1,
      setArmor: function (v) {
        v = Math.max(0, Math.round(v));
        if (v === this.lastArmor) return;
        this.lastArmor = v;
        this.armorNum.textContent = String(v);
        var segs = Math.ceil(v / 10);
        for (var i = 0; i < this.armorSegs.length; i++)
          this.armorSegs[i].className = i < segs ? "" : "off";
        this.armorEl.classList.toggle("on", v > 0);
      },
      hit: function () { this.armorEl.classList.add("hit"); this.armorHitT = 0.35; },
      toast: function (text, warn) {
        this.toastEl.textContent = text;
        this.toastEl.classList.toggle("warn", !!warn);
        this.toastEl.classList.add("on");
        this.toastT = 1.8;
      },
      tick: function (dt) {
        if (this.toastT > 0) {
          this.toastT -= dt;
          if (this.toastT <= 0) this.toastEl.classList.remove("on");
        }
        if (this.armorHitT > 0) {
          this.armorHitT -= dt;
          if (this.armorHitT <= 0) this.armorEl.classList.remove("hit");
        }
      },
      setScope: function (on) {
        if (on === this.scopeOn) return;
        this.scopeOn = on;
        this.scopeEl.classList.toggle("on", on);
        G.hud.root.classList.toggle("scoped", on);
      },
      _slotHtml: "",
      _slotCache: { n: -1, active: -1, gren: -1, shorts: [], ammos: [] },
      setSlots: function (list, active, grenades) {
        if (!list) list = SLOT_FALLBACK;
        // V53 PERF-4：值没变就整步跳过——不建 HTML 字符串、不写 DOM。
        if (!slotsChanged(this._slotCache, list, active, grenades)) return;
        var html = buildSlotsHtml(list, active, grenades);
        if (html !== this._slotHtml) { this._slotHtml = html; this.loadoutEl.innerHTML = html; }
        rememberSlots(this._slotCache, list, active, grenades);
      }
    };
    return HUD;
  }

  /* ------------------------------------------------------------ STATE */
  var S = {
    armor: 0, maxArmor: 100,
    grenades: 2, maxGrenades: 4,
    pickupTimer: 0,
    pickups: [],
    grenadeList: [],
    throwCd: 0,
    meleeCd: 0,
    checkpoint: null,
    lastRelayCut: 0,
    damageScale: 1,
    hpScale: 1,
    scanCd: 0,
    scanMarks: [],
    grenadeAim: false,
    grenadeTouch: false,
    arc: null,
    killTimes: [],
    lastStreak: 0,
    alertTipShown: false
  };

  /* --------------------------------------------------------- ARMOR */
  function installArmor() {
    var P = G.player;
    P.armor = 50; P.maxArmor = 100;
    S.armor = P.armor;
    var baseDamage = P.damage;
    P.damage = function (amount, from) {
      if (!P.alive || P.invulnerable || !(amount > 0)) return baseDamage(amount, from);
      amount *= S.damageScale || 1;
      if (P.armor > 0) {
        var absorb = Math.min(P.armor, amount * 0.65);
        P.armor = Math.max(0, P.armor - absorb);
        amount -= absorb;
        if (absorb > 0.4 && HUD) HUD.hit();
        G.events.emit("sx:armor-absorb", { amount: absorb, armor: P.armor });
      }
      S.armor = P.armor;
      return baseDamage(amount, from);
    };
    var baseReset = P.reset;
    P.reset = function (start) {
      baseReset(start);
      P.armor = 50; S.armor = P.armor;
      S.grenades = 2; S.throwCd = 0; S.meleeCd = 0;
      S.pickupTimer = 0;
      if (HUD) { HUD.setArmor(P.armor); HUD.lastArmor = -1; }
      respawnPickups();
      hideDeadCheckpointButton();
    };
    G.events.on("player:dead", function () { showDeadCheckpointButton(); });
  }

  /* --------------------------------------------------------- PICKUPS */
  var PICKUP_DEF = {
    medkit: { color: 0x63e6a0, label: "医疗包", short: "MED", icon: "cross" },
    armor: { color: 0x7fc8e8, label: "护甲板", short: "ARM", icon: "plate" },
    ammo: { color: 0xffb347, label: "弹药箱", short: "AMMO", icon: "ammo" },
    grenade: { color: 0xff8a5c, label: "手雷箱", short: "FRAG", icon: "grenade" }
  };

  function makePickupMesh(type) {
    var T = G.THREE, def = PICKUP_DEF[type], g = new T.Group();
    var bodyColor = type === "medkit" ? 0xd8ded9 : type === "armor" ? 0x2c3940 : type === "ammo" ? 0x3a4032 : 0x3d3230;
    var body = new T.Mesh(
      new T.BoxGeometry(type === "armor" ? 0.36 : 0.46, type === "armor" ? 0.34 : 0.22, 0.3),
      new T.MeshStandardMaterial({ color: bodyColor, roughness: 0.62, metalness: type === "armor" ? 0.55 : 0.25 })
    );
    body.position.y = 0.11;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // 发光识别条
    var strip = new T.Mesh(
      new T.BoxGeometry(type === "armor" ? 0.3 : 0.4, 0.035, 0.012),
      new T.MeshBasicMaterial({ color: def.color })
    );
    strip.position.set(0, 0.16, 0.156);
    g.add(strip);
    var strip2 = strip.clone(); strip2.position.z = -0.156; g.add(strip2);
    // 图标
    if (type === "medkit") {
      var c1 = new T.Mesh(new T.BoxGeometry(0.05, 0.16, 0.02), new T.MeshBasicMaterial({ color: 0x9dffc4 }));
      var c2 = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.02), new T.MeshBasicMaterial({ color: 0x9dffc4 }));
      c1.position.set(0, 0.2, 0.152); c2.position.set(0, 0.2, 0.152);
      g.add(c1, c2);
    } else if (type === "armor") {
      var plate = new T.Mesh(new T.BoxGeometry(0.16, 0.2, 0.02), new T.MeshStandardMaterial({ color: 0x9fd4e3, emissive: 0x335566, metalness: 0.8, roughness: 0.3 }));
      plate.position.set(0, 0.18, 0.155); plate.rotation.z = 0.2;
      g.add(plate);
    } else if (type === "ammo") {
      for (var i = 0; i < 3; i++) {
        var round = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.09, 8), new T.MeshBasicMaterial({ color: 0xffd27a }));
        round.position.set(-0.09 + i * 0.09, 0.23, 0.14);
        round.rotation.z = Math.PI / 2;
        g.add(round);
      }
    } else {
      var gren = new T.Mesh(new T.SphereGeometry(0.055, 12, 10), new T.MeshStandardMaterial({ color: 0x4a4f46, metalness: 0.4, roughness: 0.55 }));
      gren.position.set(0, 0.24, 0.13); g.add(gren);
    }
    // 地面光环
    var ring = new T.Mesh(
      new T.RingGeometry(0.42, 0.5, 32),
      new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    g.userData.ring = ring;
    return g;
  }

  var PICKUP_SPOTS = [
    { type: "ammo", x: -29.5, z: 9.6 },
    { type: "medkit", x: -26.5, z: 1.6 },
    { type: "armor", x: 4.6, z: 16.1 },
    { type: "ammo", x: 9.2, z: 4.4 },
    { type: "medkit", x: -8.1, z: 15.4 },
    { type: "armor", x: -12, z: -25.4 },
    { type: "ammo", x: -7.9, z: -13.9 },
    { type: "medkit", x: 9.6, z: -21.9 },
    { type: "grenade", x: 4.6, z: -14.9 },
    { type: "ammo", x: 25.3, z: 4.4 },
    { type: "armor", x: 21, z: 14.8 },
    { type: "medkit", x: 26.8, z: 14.4 },
    { type: "grenade", x: 27.4, z: -15.8 },
    { type: "ammo", x: 20.2, z: -15.4 }
  ];

  // V32：拾取物改为读地图数据（packages/data/maps/*.map.json），
  // 只有数据缺失时才回退到港区的旧硬编码点位。
  function pickupSpotsForMap() {
    var id = "harbor";
    // MapKit 是可选的全局（展示模式/部分构建里尚未定义）：探测失败保持静默，回退 harbor。
    try { id = MapKit && MapKit.current ? MapKit.current() : "harbor"; } catch (e) { /* 可选全局未就绪 */ }
    var data = window.__SX_MAPS_DATA;
    var m = data && data.maps && data.maps[id];
    if (m && m.pickups && m.pickups.length) {
      return m.pickups.map(function (p) {
        return { type: p.kind, x: p.pos[0], y: p.pos[1], z: p.pos[2], respawn: p.respawn || 0 };
      });
    }
    return PICKUP_SPOTS.map(function (p) { return { type: p.type, x: p.x, y: null, z: p.z }; });
  }

  function spawnPickups() {
    var T = G.THREE;
    for (var k = 0; k < S.pickups.length; k++) {
      var old = S.pickups[k];
      if (old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
    }
    S.pickups.length = 0;
    var spots = pickupSpotsForMap();
    for (var i = 0; i < spots.length; i++) {
      var sp = spots[i];
      var y = sp.y;
      if (y == null) { try { y = G.physics.groundHeight(sp.x, sp.z, 12); } catch (e) { y = 0; } }
      var mesh = makePickupMesh(sp.type);
      mesh.position.set(sp.x, y + 0.02, sp.z);
      mesh.rotation.y = (i * 1.7) % 6.28;
      G.scene.add(mesh);
      S.pickups.push({ type: sp.type, x: sp.x, y: y, z: sp.z, mesh: mesh, taken: false, bob: i * 0.9, respawn: sp.respawn || 0, respawnT: 0 });
    }
  }

  function respawnPickups() {
    for (var i = 0; i < S.pickups.length; i++) {
      var p = S.pickups[i];
      p.taken = false;
      p.mesh.visible = true;
    }
  }

  function applyPickup(p) {
    var P = G.player, ok = false, msg = "";
    if (p.type === "medkit") {
      if (P.health < P.maxHealth - 0.5) { P.heal(45); ok = true; msg = "医疗包  +45"; }
    } else if (p.type === "armor") {
      if (P.armor < P.maxArmor - 0.5) { P.armor = Math.min(P.maxArmor, P.armor + 50); S.armor = P.armor; ok = true; msg = "护甲板  +50"; }
    } else if (p.type === "ammo") {
      var w = G.weapon;
      if (w && w.addAmmoAll) { ok = w.addAmmoAll(0.45); }
      else if (w && w.addAmmo) { w.addAmmo(60); ok = true; }
      if (ok) msg = "弹药补给";
      if (S.grenades < S.maxGrenades) { S.grenades = Math.min(S.maxGrenades, S.grenades + 1); ok = true; msg = msg ? msg + " · 手雷 +1" : "手雷 +1"; }
    } else if (p.type === "grenade") {
      if (S.grenades < S.maxGrenades) { S.grenades = Math.min(S.maxGrenades, S.grenades + 2); ok = true; msg = "手雷  +2"; }
    }
    if (!ok) return false;
    p.taken = true;
    p.mesh.visible = false;
    if (HUD) HUD.toast(msg);
    G.hud.message(msg, 1.5);
    try { G.audio.play("reload_magin", { gain: 0.5, pitch: 1.35 }); } catch (e) { soft("pickup-sfx", e); }
    G.events.emit("sx:pickup", { type: p.type });
    return true;
  }

  function updatePickups(dt) {
    var P = G.player, t = G.time.t;
    for (var i = 0; i < S.pickups.length; i++) {
      var p = S.pickups[i];
      if (p.taken) continue;
      p.mesh.position.y = p.y + 0.02 + Math.sin(t * 2 + p.bob) * 0.035;
      p.mesh.rotation.y += dt * 0.5;
      if (p.mesh.userData.ring) p.mesh.userData.ring.material.opacity = 0.2 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.4 + p.bob));
      if (!P.alive) continue;
      var d = dist2d(P.pos, p.mesh.position);
      if (d < 1.45 && Math.abs(P.pos.y - p.y) < 2.2) applyPickup(p);
    }
  }

  /* ---------------------------------------------------------- GRENADE */
  function makeGrenadeMesh() {
    var T = G.THREE;
    var g = new T.Group();
    var body = new T.Mesh(new T.SphereGeometry(0.07, 14, 12),
      new T.MeshStandardMaterial({ color: 0x3b4238, roughness: 0.5, metalness: 0.45 }));
    g.add(body);
    var band = new T.Mesh(new T.TorusGeometry(0.066, 0.008, 6, 18),
      new T.MeshBasicMaterial({ color: 0xff8a5c }));
    band.rotation.x = Math.PI / 2;
    g.add(band);
    var led = new T.Mesh(new T.SphereGeometry(0.014, 8, 8),
      new T.MeshBasicMaterial({ color: 0xff4a2a }));
    led.position.y = 0.07;
    g.add(led);
    g.userData.led = led;
    return g;
  }

  function throwGrenade() {
    if (S.grenades <= 0 || S.throwCd > 0) return;
    S.grenades--;
    S.throwCd = 0.55;
    try { G.events.emit("sx:grenade", {}); } catch (e) { soft("grenade-emit", e); }
    var T = G.THREE, P = G.player;
    var dir = P.forward.clone ? P.forward.clone() : new T.Vector3(P.forward.x, P.forward.y, P.forward.z);
    var fwd = new T.Vector3(dir.x, dir.y, dir.z).normalize();
    var origin = new T.Vector3(P.eye.x, P.eye.y, P.eye.z).addScaledVector(fwd, 0.45);
    var vel = fwd.clone().multiplyScalar(15.5);
    vel.y += 4.2;
    vel.x += P.vel.x * 0.5; vel.z += P.vel.z * 0.5;
    var mesh = makeGrenadeMesh();
    mesh.position.copy(origin);
    G.scene.add(mesh);
    S.grenadeList.push({ mesh: mesh, pos: origin.clone(), vel: vel, fuse: 2.25, spin: new T.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), bounced: false });
    G.player.addRecoil(-0.004, 0);
    G.player.addShake(0.08);
    try { G.audio.play("weapon:melee", { gain: 0.4 }); } catch (e) { soft("grenade-sfx", e); }
    G.events.emit("weapon:fire", { origin: origin, dir: fwd, muzzle: origin, ads: 0 });
  }

  function explodeGrenade(n) {
    var pos = n.pos;
    try { G.combat.explode(pos, 6.5, 110, "player"); } catch (e) { console.error("[ext] explode", e); }
    try { G.fx.explosion(pos, 1.7); } catch (e) { soft("explode-fx", e); }
    try { G.events.emit("explosion", { pos: pos, size: 1.8 }); } catch (e) { soft("explode-emit", e); }
    try {
      if (G.render && G.render.lightPool && G.render.lightPool.flash)
        G.render.lightPool.flash(pos, 0xffb066, 90, 16, 0.22);
    } catch (e) { soft("explode-light", e); }
    var d = dist2d(G.player.pos, pos);
    if (d < 12) G.player.addShake(clamp(1 - d / 12, 0, 1) * 0.75);
    if (n.mesh.parent) n.mesh.parent.remove(n.mesh);
  }

  function updateGrenades(dt) {
    var T = G.THREE;
    if (S.throwCd > 0) S.throwCd -= dt;
    for (var i = S.grenadeList.length - 1; i >= 0; i--) {
      var n = S.grenadeList[i];
      n.fuse -= dt;
      n.vel.y -= 21 * dt;
      var step = new T.Vector3(n.vel.x * dt, n.vel.y * dt, n.vel.z * dt);
      var len = step.length();
      var hit = null;
      if (len > 1e-5) {
        var dir = step.clone().multiplyScalar(1 / len);
        try { hit = G.physics.raycast(n.pos, dir, len + 0.06); } catch (e) { hit = null; }
      }
      if (hit && hit.normal) {
        var remain = Math.max(0, len - hit.dist);
        n.pos.addScaledVector(step.clone().normalize(), Math.max(0, hit.dist - 0.02));
        var vn = n.vel.dot(hit.normal);
        if (vn < 0) n.vel.addScaledVector(hit.normal, -vn * 1.45);
        n.vel.multiplyScalar(0.62);
        n.pos.addScaledVector(hit.normal, 0.02);
        if (hit.surface === "water") n.fuse = Math.min(n.fuse, 0.15);
        if (!n.bounced) { n.bounced = true; try { G.audio.play("shell_bounce", { pos: n.pos, gain: 0.5, pitch: 0.7 }); } catch (e) { soft("grenade-bounce-sfx", e); } }
      } else {
        n.pos.add(step);
      }
      if (n.pos.y < -1.5) n.fuse = Math.min(n.fuse, 0.05);
      n.mesh.position.copy(n.pos);
      n.mesh.rotation.x += n.spin.x * dt;
      n.mesh.rotation.y += n.spin.y * dt;
      n.mesh.rotation.z += n.spin.z * dt;
      var blink = (Math.sin(G.time.t * (n.fuse < 0.6 ? 40 : 14)) > 0);
      n.mesh.userData.led.material.color.setHex(blink ? 0xff6a3a : 0x551005);
      if (n.fuse <= 0) { explodeGrenade(n); S.grenadeList.splice(i, 1); }
    }
  }

  /* ----------------------------------------------------------- MELEE */
  function meleeAttack() {
    if (S.meleeCd > 0) return;
    S.meleeCd = 0.72;
    var P = G.player;
    if (!P.alive) return;
    var T = G.THREE;
    var eye = new T.Vector3(P.eye.x, P.eye.y, P.eye.z);
    var fwd = new T.Vector3(P.forward.x, P.forward.y, P.forward.z).normalize();
    var hit = null;
    try { hit = G.combat.playerShot(eye, fwd, { damage: 55, range: 2.4 }); } catch (e) { soft("melee-shot", e); }
    try { G.events.emit("weapon:melee", {}); } catch (e) { soft("melee-emit", e); }
    P.addRecoil(-0.008, (Math.random() - 0.5) * 0.004);
    P.addShake(0.1);
    if (hit && hit.surface === "enemy") HUD && HUD.toast("近战击杀", false);
  }

  /* ------------------------------------------------------- CHECKPOINT */
  function saveCheckpoint() {
    var P = G.player, w = G.weapon;
    S.checkpoint = {
      pos: P.pos.clone(), yaw: P.yaw, health: P.health, armor: P.armor,
      ammo: w ? w.ammo : 0, reserve: w ? w.reserve : 0, grenades: S.grenades,
      cut: (G.game && G.game.run && G.game.run.cut) || 0
    };
  }

  var cpBtn = null;
  function deadScreen() { return document.querySelector('.m-screen[data-s="dead"]'); }
  function showDeadCheckpointButton() {
    var scr = deadScreen();
    if (!scr || !S.checkpoint) return;
    if (!cpBtn) {
      cpBtn = el("button", "btn primary x-cp", "从检查点继续");
      cpBtn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        reviveFromCheckpoint();
      });
    }
    var acts = scr.querySelector(".m-actions");
    var retry = scr.querySelector('[data-act="retry"]');
    if (retry) retry.classList.remove("primary");
    if (acts && !cpBtn.parentNode) acts.insertBefore(cpBtn, acts.firstChild);
  }
  function hideDeadCheckpointButton() {
    if (cpBtn && cpBtn.parentNode) cpBtn.parentNode.removeChild(cpBtn);
  }

  function reviveFromCheckpoint() {
    var cp = S.checkpoint;
    if (!cp) return;
    var P = G.player;
    G.game.menus.show("none");
    P.reset({ pos: cp.pos.clone(), yaw: cp.yaw });
    P.health = Math.max(45, cp.health);
    P.armor = Math.max(25, cp.armor);
    S.armor = P.armor;
    S.grenades = Math.max(1, cp.grenades);
    if (G.weapon) {
      if (G.weapon.ammo !== undefined) G.weapon.ammo = Math.max(G.weapon.ammo, cp.ammo);
      if (G.weapon.reserve !== undefined) G.weapon.reserve = Math.max(G.weapon.reserve, cp.reserve);
    }
    try { G.enemies.clear(); } catch (e) { soft("revive-clear", e); }
    try { G.game.run.queue.length = 0; G.game.run.waveHot = 0; } catch (e) { soft("revive-run", e); }
    // 检查点复活若发生在 BOSS 战：重置并重新投放 BOSS，避免目标卡死
    if (G.game.run && G.game.run.bossAlive) {
      try {
        G.game.run.bossAlive = false;
        if (typeof bossRef !== "undefined") bossRef = null;
        if (typeof bossBar !== "undefined" && bossBar) bossBar.el.classList.remove("on");
        gameAfter(2.5, function () { if (G.game.state === "playing") startBossEncounter(); }, "mission");
      } catch (e) { soft("revive-boss", e); }
    }
    G.game.state = "playing";
    G.hud.show(true);
    G.render.post.fade = 0;
    try { G.input.setGameplay(true); G.input.requestLock && G.input.requestLock(); } catch (e) { soft("revive-input", e); }
    hideDeadCheckpointButton();
    G.hud.message("检查点已恢复", 2.2);
    G.events.emit("game:state", { state: "playing", prev: "dead" });
    G.events.emit("sx:revive", {});
  }

  /*__ACCESS__*/

  /*__ARMORY__*/

  /*__TACTICS__*/

  /* ------------------------------------------------------- per-frame */
  // V53 CLI-2：模拟时钟只在这些状态推进；暂停/标题/死亡/结算必须冻结。
  function simTimeActive(state) {
    return state === "playing" || state === "intro";
  }
  function update(dt) {
    if (!G || !booted) return;
    var simActive = simTimeActive(G.game.state);
    if (simActive) {
      try { if (CLOCK) CLOCK.tick(dt); } catch (e) { soft("clock-tick", e); }
      try { if (window.SX_SYSTEMS) SX_SYSTEMS.fixedUpdate(null, dt); } catch (e) { soft("systems-tick", e); }
    }
    try { updatePerf(dt); } catch (e) { soft("perf", e); }
    try { AudioExt.update(dt); } catch (e) { soft("audio-update", e); }
    if (G.game.state !== "playing") {
      if (HUD) HUD.tick(dt);
      return;
    }
    var P = G.player;
    HUD.setArmor(P.armor);
    if (S.meleeCd > 0) S.meleeCd -= dt;
    updatePickups(dt);
    updateGrenades(dt);
    updateScan(dt);
    updateCombatFeedback();
    updateHeartbeat(dt);
    try { updateTraining(dt); } catch (e) { console.error("[ext] training update", e); }
    // 同一张地图重开行动时也要重置拾取物
    if (S._lastMapCheck === undefined || S._lastMapCheck <= 0) {
      S._lastMapCheck = 0.5;
      var mid = "harbor";
      try { mid = MapKit.current(); } catch (e) { soft("map-probe", e); }
      if (mid !== S._lastMap) { S._lastMap = mid; spawnPickups(); }
    } else S._lastMapCheck -= dt;
    HUD.tick(dt);

    var inp = G.input;
    if (P.alive && P.enabled) {
      if (inp.pressed("scan")) triggerScan();
      if (inp.pressed("grenade")) beginGrenadeAim();
      else if (S.grenadeAim && !S.grenadeTouch && !inp.down("grenade")) releaseGrenade();
      if (S.grenadeAim) {
        if (P.enabled) updateGrenadeAim();
        else cancelGrenadeAim();
      }
      if (inp.pressed("melee")) meleeAttack();
    } else if (S.grenadeAim) cancelGrenadeAim();

    try { updateBoss(dt); } catch (e) { console.error("[ext] boss update", e); }

    // HUD loadout
    // V53 PERF-4：直接复用武器系统持有的数组（w.list 元素自带 short/ammo），
    // 不再每步 map 出新数组；没有 list 时用模块级缓存数组原地改 ammo。
    var w = G.weapon;
    var slots = SLOT_FALLBACK;
    if (w && w.list) slots = w.list;
    else if (w && w.slots && w.slots.length) slots = w.slots;
    else SLOT_FALLBACK[0].ammo = (w && w.ammo) | 0;
    HUD.setSlots(slots, w && w.activeIndex || 0, S.grenades);
    var act = w && w.list && w.list[w.activeIndex];
    HUD.setScope(!!(act && act.scope && act.ads > 0.82));
  }

  /*__MAPKIT__*/

  /*__CAMPAIGN__*/

  /*__ONBOARD__*/

  /*__AUDIO__*/

  /*__MP__*/

  function setSpeaker(name) {
    var el = document.querySelector(".comms-who");
    if (el) el.textContent = name || "指挥中心";
  }

  /* ------------------------------------------------- V10 enemy feedback */
  var shieldFxT = 0;
  function initEnemyFeedback() {
    G.events.on("player:hitEnemy", function (ev) {
      if (ev && ev.weak && ev.killed) S.runHeadshots = (S.runHeadshots || 0) + 1;
    });
    G.events.on("sx:shield-hit", function (ev) {
      var now = performance.now();
      if (now - shieldFxT < 90) return;
      shieldFxT = now;
      try { G.fx.sparks(ev.point, new G.THREE.Vector3(0, 0, 1), 4); } catch (e) { soft("shield-sparks", e); }
      try { G.audio.play("impact_metal", { pos: ev.point, gain: 0.5, pitch: 1.5 }); } catch (e) { soft("shield-sfx", e); }
    });
    G.events.on("sx:shield-break", function (ev) {
      var e = ev && ev.enemy;
      if (e && e.pos) {
        try { G.fx.sparks(e.pos, new G.THREE.Vector3(0, 1, 0), 14); } catch (err) { soft("shield-break-sparks", err); }
        try { G.audio.play("impact_metal", { pos: e.pos, gain: 1, pitch: 0.7 }); } catch (err) { soft("shield-break-sfx", err); }
      }
      G.hud.feed("<b>重装盾卫</b> 护盾破碎");
    });
  }

  /* ------------------------------------------------- V9 audio polish */
  function initAudioPolish() {
    S.hbT = 0;
    G.events.on("weapon:switch", function () {
      try { G.audio.play("reload_magout", { gain: 0.32, pitch: 1.45 }); } catch (e) { soft("switch-sfx", e); }
    });
    G.events.on("sx:boss-phase", function (ev) {
      try { G.audio.play("alert", { gain: 0.85, pitch: ev && ev.phase === 2 ? 0.55 : 0.72 }); } catch (e) { soft("boss-phase-sfx", e); }
      try { G.audio.play("explosion", { gain: 0.25, pitch: 1.6 }); } catch (e) { soft("boss-phase-sfx", e); }
    });
    G.events.on("game:state", function (e) {
      if (e && (e.state === "playing" || e.state === "intro"))
        try { G.audio.play("ui:click", { gain: 0.35 }); } catch (err) { soft("state-sfx", err); }
    });
  }

  function updateHeartbeat(dt) {
    var P = G.player;
    if (!P || !P.alive || G.game.state !== "playing") return;
    if (P.health < P.maxHealth * 0.35) {
      S.hbT -= dt;
      if (S.hbT <= 0) {
        S.hbT = P.health < P.maxHealth * 0.2 ? 0.78 : 1.15;
        try { G.audio.play("hurt", { gain: 0.15, pitch: 0.82 }); } catch (e) { soft("heartbeat-sfx", e); }
      }
    } else {
      S.hbT = 0;
    }
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    if (booted) return;
    G = window.__G;
    if (G.level && G.level.stub) {
      booted = true;
      console.log("[ext] showcase mode — extension skipped");
      return;
    }
    injectCSS();
    try { if (window.SXBridge) SXBridge.init(); } catch (e) { console.error("[ext] save bridge", e); }
    try {
      if (window.SXClock) {
        // 测试/快进模式（?dt=）沿用真实时间，避免低帧率下模拟时钟拖慢旧用例；
        // 正式游玩使用固定步模拟时钟（暂停即停、可倍速、可整组取消）。
        TEST_MODE = !!(G.params && G.params.dt != null && G.params.dt !== "");
        CLOCK = SXClock.createClock();
        UICLOCK = SXClock.createRealClock();
        window.SX_CLOCK = CLOCK;
        window.SX_UICLOCK = UICLOCK;
      }
      if (window.SXSystems) {
        window.SX_SYSTEMS = SXSystems.create({ G: G, clock: CLOCK, uiClock: UICLOCK, events: G.events, THREE: G.THREE });
        window.SX_SYSTEMS.initAll();
        G.events.on("game:state", function (e) {
          try { window.SX_SYSTEMS.onState(e.state, e.prev); } catch (err) { soft("systems-state", err); }
        });
      }
    } catch (e) { console.error("[ext] systems", e); }
    try { installArmor(); } catch (e) { console.error("[ext] armor", e); }
    HUD = buildHUD();
    HUD.setArmor(G.player.armor || 0);
    spawnPickups();
    booted = true;

    try {
      MapKit.init(G);
      // V42：地图/灯光扩展需要通过全局访问 MapKit（此前只在 ext 闭包里）
      window.MapKit = MapKit;
      var baseMapLoad = MapKit.load;
      MapKit.load = function (id) {
        var changed = baseMapLoad.call(MapKit, id);
        if (changed) {
          try { spawnPickups(); } catch (e) { console.error("[ext] pickups", e); }
          try { G.events.emit("map:loaded", { id: id }); } catch (e) { soft("map-loaded-emit", e); }
        }
        return changed;
      };
    } catch (e) { console.error("[ext] mapkit init", e); }
    try { initCampaign(); } catch (e) { console.error("[ext] campaign init", e); }
    try { MP.init(G, MapKit); window.__MP = MP; } catch (e) { console.error("[ext] mp init", e); }
    try { AudioExt.init(G); } catch (e) { console.error("[ext] audio ext init", e); }
    try { Onboarding.init(G); } catch (e) { console.error("[ext] onboarding init", e); }
    try { initArmory(); } catch (e) { console.error("[ext] armory init", e); }
    try { initAccess(); } catch (e) { console.error("[ext] access init", e); }
    try { initAudioPolish(); } catch (e) { console.error("[ext] audio init", e); }
    initEnemyFeedback();
    initCombatFeedback();

    // 触屏：手雷 / 换枪
    if (G.input && G.input.touch) {
      try {
        var ui = document.getElementById("ui");
        var gb = el("button", "t-btn", "手雷");
        gb.style.cssText = "width:56px;height:56px;right:calc(20px + var(--sar));bottom:calc(258px + var(--sab));";
        gb.addEventListener("pointerdown", function (e) { e.preventDefault(); S.grenadeTouch = true; beginGrenadeAim(); });
        gb.addEventListener("pointerup", function (e) { e.preventDefault(); S.grenadeTouch = false; releaseGrenade(); });
        gb.addEventListener("pointercancel", function () { S.grenadeTouch = false; cancelGrenadeAim(); });
        ui.appendChild(gb);
        var scb = el("button", "t-btn", "扫描");
        scb.style.cssText = "width:56px;height:56px;right:calc(156px + var(--sar));bottom:calc(258px + var(--sab));";
        scb.addEventListener("pointerdown", function (e) { e.preventDefault(); triggerScan(); });
        ui.appendChild(scb);
        var sb = el("button", "t-btn", "换枪");
        sb.style.cssText = "width:56px;height:56px;right:calc(88px + var(--sar));bottom:calc(196px + var(--sab));";
        sb.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          if (G.weapon && G.weapon.cycle) G.weapon.cycle();
        });
        ui.appendChild(sb);
      } catch (e) { soft("touch-ui", e); }
    }

    // 敌人 HP 缩放（战役难度）
    var baseSpawn = G.enemies.spawn;
    G.enemies.spawn = function (type, pos, opts) {
      var en = baseSpawn.call(G.enemies, type, pos, opts);
      if (en && (S.hpScale || 1) !== 1 && en.alive) { en.hp *= S.hpScale; if (en.maxHp) en.maxHp *= S.hpScale; }
      return en;
    };

    // 挂接游戏更新：在导演更新后、武器更新前
    // V53 ARCH-1：防重入标记挂在宿主对象上（别人再包一层也不会让标记失效）；
    // 重复 init 直接跳过，避免二次包覆。调用顺序保持不变：先原 update，再 ext update。
    if (!G.game.__sxExtUpdate) {
      var baseUpdate = G.game.update;
      G.game.__sxExtUpdate = true;
      G.game.update = function (dt) {
        var r = baseUpdate.call(G.game, dt);
        try { update(dt); } catch (e) { console.error("[ext] update", e); }
        return r;
      };
    }
    G.events.on("game:state", function (e) {
      if (e && (e.state === "intro" || e.state === "title" || e.state === "dead" || e.state === "complete") && CLOCK) CLOCK.cancelGroup("mission");
    });
    // 每完成一处中继 → 存档检查点
    G.events.on("objective:done", function () { saveCheckpoint(); });
    G.events.on("objective:all", function () {
      saveCheckpoint();
      gameAfter(0.6, function () {
        if (G.game.state === "playing") {
          G.hud.message("接驳准备中 · 坚守撤离点", 3.5);
          G.events.emit("sx:hold-start", {});
        }
      }, "mission");
    });

    // 任务专属无线电：覆盖引擎默认的开场/全断文案
    // V53 ARCH-1：宿主对象标记，重复 init 不再二次包覆；命中任务文案时依旧只调用一次 baseRadio。
    if (!G.hud.__sxExtRadio) {
      var baseRadio = G.hud.radio;
      G.hud.__sxExtRadio = true;
      G.hud.radio = function (text, secs) {
        var m = G.game.currentMission;
        if (m && typeof text === "string") {
          if (m.intro && text.indexOf("几猫队员，这里是指挥中心") === 0)
            return baseRadio.call(G.hud, m.intro, secs || 4.2);
          if (m.all && text.indexOf("三处中继全部断开") === 0)
            return baseRadio.call(G.hud, m.all, secs || 4.5);
        }
        return baseRadio.call(G.hud, text, secs);
      };
    }

    // 首次进入战斗的操作提示
    var tipsShown = false;
    G.events.on("game:state", function (e) {
      if (e && e.state === "playing" && !tipsShown) {
        tipsShown = true;
        (UICLOCK ? UICLOCK.after(2.6, function () {
          if (G.game.state !== "playing") return;
          var m = G.game.currentMission;
          var label = m && m.id === "train" ? "训练 · 靶场" : m ? "行动 " + (m.code || "") + " · " + (m.name || "") : "";
          G.hud.message((label ? label + "  |  " : "") + "1/2 切换武器 · G 手雷 · V 近战", 5);
        }) : setTimeout(function () {
          if (G.game.state !== "playing") return;
          var m = G.game.currentMission;
          var label = m && m.id === "train" ? "训练 · 靶场" : m ? "行动 " + (m.code || "") + " · " + (m.name || "") : "";
          G.hud.message((label ? label + "  |  " : "") + "1/2 切换武器 · G 手雷 · V 近战", 5);
        }, 2600));
      }
    });

    addEventListener("beforeunload", function () {
      try { if (window.SXBridge) SXBridge.flush(); } catch (e) { soft("save-flush", e); }
    });

    // 调试/测试 API
    window.__SX = {
      G: G, S: S,
      armor: function (n) { G.player.armor = clamp(n, 0, 100); S.armor = G.player.armor; },
      grenades: function (n) { S.grenades = clamp(n, 0, S.maxGrenades); },
      throwGrenade: throwGrenade,
      melee: meleeAttack,
      pickup: function (i) { return applyPickup(S.pickups[i]); },
      save: saveCheckpoint,
      revive: reviveFromCheckpoint,
      god: function () { G.player.invulnerable = true; },
      tp: function (x, y, z) { G.player.pos.set(x, y, z); G.player.vel.set(0, 0, 0); },
      killAll: function () { for (var i = 0; i < G.enemies.list.length; i++) { var e = G.enemies.list[i]; if (e.alive && e.damage) e.damage(9999, e.pos, new G.THREE.Vector3(0, 0, 1), "body"); } },
      state: function () { return { armor: G.player.armor, hp: G.player.health, grenades: S.grenades, pickups: S.pickups.filter(function (p) { return !p.taken; }).length, cp: !!S.checkpoint, fps: window.__stats ? window.__stats().fps : 0 }; },
      campaign: function () {
        return {
          unlocked: camp.unlocked, current: camp.current, best: camp.best,
          mission: G.game.currentMission && G.game.currentMission.id,
          objectives: (G.level.objectives || []).map(function (o) { return o.label; }),
          extraction: G.level.extraction.pos.toArray(),
          evac: G.game.run && G.game.run.evacT
        };
      },
      unlockAll: function () { camp.unlocked = MISSIONS.length; saveCamp(); renderMissionCards(); },
      launch: function (i) { camp.unlocked = Math.max(camp.unlocked, i + 1); launchMission(i); },
      launchFast: function (i) { camp.unlocked = Math.max(camp.unlocked, i + 1); applyMission(i); G.game.start({ skipIntro: true }); },
      cutAll: function () { for (var i = 0; i < 8; i++) { try { G.game.debugCut(); } catch (e) { soft("debug-cut", e); } } },
      scan: function () { return triggerScan(); },
      aim: function () { return beginGrenadeAim(); },
      release: function () { releaseGrenade(); },
      marks: function () { return S.scanMarks.length; },
      arc: function () { return !!(S.arc && S.arc.pts.visible); },
      scanCd: function () { return S.scanCd; },
      armory: function () { return armorySel; },
      armorySet: function (wid, slot, opt) {
        // 调试/验收接口：直接装备视为已拥有，避免所有权回退把测试装备成默认件
        try { if (window.__SX_PROGRESS && window.__SX_PROGRESS.unlock) window.__SX_PROGRESS.unlock(wid + ":" + slot + ":" + opt); } catch (e) { soft("progress-unlock", e); }
        armorySel[wid][slot] = opt; saveArmory(); armoryApply(); return armoryStat(armoryWeapon(wid));
      },
      // V45：只改选择、不做所有权解锁。用于验证“锁定价配件不生效”的真实 UI/结算路径。
      armorySelect: function (wid, slot, opt) {
        if (!armorySel[wid]) armorySel[wid] = {};
        armorySel[wid][slot] = opt; saveArmory(); armoryApply(); return armoryStat(armoryWeapon(wid));
      },
      armoryOpen: function () { openArmory(); },
      armoryStats: function (wid) { var w = armoryWeapon(wid); return w ? armoryStat(w) : null; },
      speaker: function (n) { setSpeaker(n); },
      audio: function () { return AudioExt.state(); },
      audioKick: function () { AudioExt.begin(); },
      applyMission: function (i) { applyMission(i); },
      validateObjectives: function () { return validateObjectives(); },
      interlude: function (a, b) { openInterlude(a, b); },
      archive: function () { openArchive(); },
      maps: function () { return MapKit.maps(); },
      mapId: function () { return MapKit.current(); },
      switchMap: function (id) { return MapKit.load(id); },
      mapRelays: function (id) { return MapKit.relays(id); },
      mapInfo: function (id) {
        var d = MapKit.def(id || MapKit.current());
        return d ? { id: d.id, built: !!d.built, merged: !!(d.merged && d.merged.visible), lights: !!(d.lights && d.lights.visible), boxes: (d.boxes || []).length } : null;
      },
      challenges: function () { return { count: challengeCount(), map: camp.challenges }; },
      challengeCheck: function (st) { return challengeCheck(st); },
      challengeGrant: function (mid, obj) {
        camp.challenges[mid] = Object.assign({}, camp.challenges[mid], obj);
        saveCamp();
        if (typeof updateAccessButtons === "function") updateAccessButtons();
      },
      environment: function () {
        var r = G.render, u = r.sky && r.sky.material && r.sky.material.uniforms;
        return u ? {
          sun: u.uSunDir.value.toArray().map(function (x) { return +x.toFixed(3); }),
          zen: u.uZen.value.toArray().map(function (x) { return +x.toFixed(3); }),
          col: u.uSunCol.value.toArray().map(function (x) { return +x.toFixed(3); }),
          intensity: r.sun.intensity, exposure: r.exposure,
          rain: G.ground.rainLevel, env: G.scene.environmentIntensity
        } : null;
      },
      openMissions: function () { openMissionScreen(); },
      saveState: function () { return window.SXBridge ? SXBridge.get() : null; },
      saveExport: function () { return window.SXBridge ? SXBridge.exportJSON() : "{}"; },
      saveImport: function (t) { return window.SXBridge ? SXBridge.importJSON(t) : { ok: false }; }
    };
    console.log("[ext] SALTLINE v2 战斗扩展已加载");
  }

  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      var G0 = window.__G;
      if (G0 && G0.game && G0.game.menus && G0.hud && G0.player && G0.weapon && G0.fx && G0.combat) {
        clearInterval(iv);
        boot();
      } else if (++tries > 600) { clearInterval(iv); console.error("[ext] engine not ready"); }
    }, 100);
  }
  wait();
})();
