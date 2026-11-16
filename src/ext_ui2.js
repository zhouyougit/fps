/* =====================================================================
   V35 · WP35-10 界面与本地化（ext_ui2）
   - 设置页语言切换（中文 / English，写 saltline.lang），即时重绘
     标题 / 暂停 / 设置 / 行动档案 / 简报 / 结算 / HUD 关键标签 / 字幕
   - 设计令牌组件、色盲主题（红绿 / 蓝黄）、字幕背景、安全区、文字大小
   - 持久化 saltline.access.v1（不破坏 access.js 已有字段）
   - window.__SX_LANG = { set, t, get, missing }
   - 键盘焦点环 + 方向键 / Enter 菜单导航
   本文件是 IIFE，构建时由 tools/build.cjs 的 ext_* 清单自动包含。
   ===================================================================== */
(function () {
  "use strict";

  var VERSION = "V35 · WP35-10";
  var LANG_KEY = "saltline.lang";
  var ACCESS_KEY = "saltline.access.v1";
  var I = null;              // window.SXI18n
  var G = null;              // window.__G
  var booted = false;
  var applying = false;
  var mo = null;

  /* ------------------------------------------------------------------ state */
  var state = {
    colorblind: "none",      // none | rg | by
    subBg: 0.55,             // 0..1
    safe: 16,                // px
    textScale: "m",          // s | m | l
    hudOpacity: 1,           // .55..1
    hud: { compass: true, objective: true, ammo: true, health: true, feed: true, cross: true }
  };

  function clamp01(n) { n = +n; return isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; }

  function readAccessRaw() {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || "null"); } catch (e) { return null; }
  }
  function loadState() {
    var raw = readAccessRaw();
    if (!raw || typeof raw !== "object") return;
    if (raw.colorblind === "none" || raw.colorblind === "rg" || raw.colorblind === "by") state.colorblind = raw.colorblind;
    if (Number.isFinite(raw.subBg)) state.subBg = clamp01(raw.subBg);
    if (Number.isFinite(raw.safe)) state.safe = Math.min(64, Math.max(0, raw.safe | 0));
    if (raw.textScale === "s" || raw.textScale === "m" || raw.textScale === "l") state.textScale = raw.textScale;
    if (Number.isFinite(raw.hudOpacity)) state.hudOpacity = Math.min(1, Math.max(0.55, raw.hudOpacity));
    if (raw.hud && typeof raw.hud === "object") {
      for (var k in state.hud) {
        if (Object.prototype.hasOwnProperty.call(raw.hud, k) && typeof raw.hud[k] === "boolean") state.hud[k] = raw.hud[k];
      }
    }
  }

  /* access.js 每次保存都会重写整个对象；包一层 setItem，把我们的字段合并回去 */
  function patchStorage() {
    try {
      var ls = window.localStorage;
      if (!ls || ls.__sxPatched) return;
      var orig = ls.setItem.bind(ls);
      ls.setItem = function (key, value) {
        if (key === ACCESS_KEY) {
          try {
            var obj = JSON.parse(value) || {};
            obj.colorblind = state.colorblind;
            obj.subBg = state.subBg;
            obj.safe = state.safe;
            obj.textScale = state.textScale;
            obj.hudOpacity = state.hudOpacity;
            obj.hud = state.hud;
            value = JSON.stringify(obj);
          } catch (e) {}
        }
        return orig(key, value);
      };
      ls.__sxPatched = true;
    } catch (e) {}
  }
  function saveState() {
    try {
      var obj = readAccessRaw() || {};
      obj.colorblind = state.colorblind;
      obj.subBg = state.subBg;
      obj.safe = state.safe;
      obj.textScale = state.textScale;
      obj.hudOpacity = state.hudOpacity;
      obj.hud = state.hud;
      localStorage.setItem(ACCESS_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  /* --------------------------------------------------------------- i18n core */
  function t(key, vars) {
    if (!I) return key;
    if (window.__SX_I18N_EXTRA && I.dict && I.dict.en && !I.dict.en[key]) {
      try { window.__SX_I18N_EXTRA.mount(); } catch (e) {}
    }
    return I.t(key, vars);
  }
  var ZH2KEY = null;
  function buildReverse() {
    if (!I || !I.dict) return;
    var zh = I.dict["zh-CN"] || {}, en = I.dict.en || {};
    var map = {};
    for (var k in zh) {
      if (!Object.prototype.hasOwnProperty.call(zh, k)) continue;
      var z = zh[k];
      if (typeof z !== "string" || z.length > 80) continue;
      if (!map[z]) map[z] = { key: k, same: true };
      else if (map[z].key && en[map[z].key] !== en[k]) map[z].same = false;
    }
    var out = {};
    for (var s in map) {
      if (!Object.prototype.hasOwnProperty.call(map, s)) continue;
      if (map[s].key && map[s].same) out[s] = map[s].key;
    }
    ZH2KEY = out;
  }
  function trText(zh) {
    if (!zh) return zh;
    var s = String(zh).trim();
    var k = ZH2KEY && ZH2KEY[s];
    return k ? t(k) : zh;
  }
  function missingKeys() {
    var out = [];
    if (!I || !I.dict) return out;
    var zh = I.dict["zh-CN"] || {}, en = I.dict.en || {};
    for (var k in zh) {
      if (!Object.prototype.hasOwnProperty.call(zh, k)) continue;
      if (en[k] == null || en[k] === "") out.push(k);
    }
    return out;
  }

  /* 文本节点跟踪：先按中文原文登记键位，切换语言时重写 */
  var tracked = [];
  function tagTextNodes(root) {
    if (!root || !ZH2KEY) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var list = [];
    var n;
    while ((n = walker.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      if (!node || node.__sxKey) continue;
      var raw = node.nodeValue;
      if (!raw) continue;
      var s = raw.trim();
      if (!s || s.length > 48) continue;
      var key = ZH2KEY[s];
      if (!key) continue;
      node.__sxKey = key;
      tracked.push({ n: node, k: key });
      var v = t(key);
      if (node.nodeValue !== v) node.nodeValue = v;
    }
  }
  function applyTracked() {
    for (var i = tracked.length - 1; i >= 0; i--) {
      var rec = tracked[i];
      if (!rec.n || !rec.n.isConnected) { tracked.splice(i, 1); continue; }
      var v = t(rec.k);
      if (rec.n.nodeValue !== v) rec.n.nodeValue = v;
    }
  }
  function text(sel, value, root) {
    var el = (root || document).querySelector(sel);
    if (el && el.textContent !== value) el.textContent = value;
    return el;
  }
  function setHtml(el, html) {
    if (!el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  /* --------------------------------------------------------------- CSS */
  function injectCSS() {
    if (document.getElementById("sx-ui2-css")) return;
    var css = [
      /* 设计令牌（补充 template.head.html 中的基础令牌，不重排原样式） */
      ":root{--sx-space-1:4px;--sx-space-2:8px;--sx-space-3:12px;--sx-space-4:18px;--sx-space-5:26px;--sx-space-6:38px;",
      "--sx-radius-1:2px;--sx-radius-2:4px;--sx-radius-3:8px;--sx-dur-fast:.12s;--sx-dur-base:.25s;--sx-dur-slow:.7s;",
      "--sx-ease:cubic-bezier(.2,.7,.2,1);--sx-fs-xs:11px;--sx-fs-sm:13px;--sx-fs-md:15px;--sx-fs-lg:19px;--sx-fs-xl:26px;",
      /* --sx-text 曾是无效令牌（真正生效的是 html[data-sx-text] 属性选择器），已删除；
         字幕字号统一由 access.js 写入的 --sub-scale 驱动，HUD 缩放由 --hud-scale 驱动，避免双份控制。 */
      "--sx-ring:0 0 0 2px #0b0d0f,0 0 0 4px var(--signal);--sx-sub-alpha:.55;--sx-safe:16px;--sx-hud-op:1;}",
      /* 焦点环：键盘用户始终可见 */
      "#app :focus-visible, .panel :focus-visible, .menu :focus-visible, .x-camp :focus-visible, .x-brief :focus-visible, .x-archive :focus-visible, .x-interlude :focus-visible{outline:none!important;box-shadow:var(--sx-ring)!important;}",
      ".menu button:focus-visible,input[type=range]:focus-visible{outline:none!important;box-shadow:var(--sx-ring)!important;}",
      /* 标题：更清楚的层级与英文排版 */
      ".m-title .m-eyebrow{letter-spacing:.16em;}",
      ".m-title .m-word{text-wrap:balance;}",
      "html[lang=en] .m-word{letter-spacing:.04em!important;font-size:clamp(54px,11vw,150px)!important;}",
      "html[lang=en] .btn,html[lang=en] .tab,html[lang=en] .h-k,html[lang=en] .h-wname,html[lang=en] .comms-who{letter-spacing:.1em!important;text-transform:uppercase;}",
      "html[lang=en] .m-premise{max-width:46em;}",
      ".m-title .m-actions{max-width:min(720px,100%);}",
      /* 暂停 / 结算 / 简报：统一卡片与分割线 */
      ".m-card{box-shadow:0 20px 60px rgba(0,0,0,.5);}",
      ".m-card .m-k{color:var(--signal);}",
      ".m-stats>div{padding:8px 0 7px;}",
      ".sx-pause-meta{margin:8px 0 0;font:500 11px/1.7 var(--f-mono);letter-spacing:.06em;color:var(--bone-dim);border-left:2px solid var(--signal);padding-left:8px;}",
      ".sx-debrief-tag{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;font:600 10px/1 var(--f-mono);letter-spacing:.2em;color:var(--steel);text-transform:uppercase;}",
      ".sx-debrief-tag::before{content:'';width:8px;height:8px;border:1px solid currentColor;transform:rotate(45deg);}",
      /* 设置页辅助行 */
      ".sx-u2-block{border-top:1px solid var(--line);padding-top:2px;}",
      ".sx-u2-block h3{color:var(--signal);}",
      ".sx-hint{margin:2px 0 0;font:400 11px/1.6 var(--f-mono);letter-spacing:.02em;color:var(--steel);max-width:46ch;}",
      ".sx-lang-row .seg button{min-height:44px;}",
      ".sx-u2-toggle{display:flex;flex-wrap:wrap;gap:6px;}",
      ".sx-u2-toggle .btn.small{min-height:32px;font-size:11px;letter-spacing:.1em;opacity:.55;}",
      ".sx-u2-toggle .btn.small[aria-pressed=true]{opacity:1;border-color:var(--signal);color:var(--signal);}",
      /* 字幕：底板透明度、说话人色条、传输动效 */
      ".comms-t{background:rgba(6,8,10,var(--sx-sub-alpha))!important;border-radius:var(--sx-radius-1);}",
      ".comms{--sx-spk:var(--signal);}",
      ".comms[data-speaker=command]{--sx-spk:#ffb347;}",
      ".comms[data-speaker=squad]{--sx-spk:#7fd7ff;}",
      ".comms[data-speaker=pilot]{--sx-spk:#9cffb0;}",
      ".comms[data-speaker=shen]{--sx-spk:#ff6bd6;}",
      ".comms[data-speaker=enemy]{--sx-spk:#ff5a40;}",
      ".comms[data-speaker]{padding-left:12px;border-left:3px solid var(--sx-spk);}",
      ".comms[data-speaker] .comms-who{color:var(--sx-spk);}",
      ".comms[data-speaker] .comms-who::before{content:'';display:inline-block;width:6px;height:6px;margin-right:7px;background:var(--sx-spk);transform:rotate(45deg);vertical-align:1px;}",
      ".comms[data-speaker]::after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:1px;background:linear-gradient(90deg,transparent,var(--sx-spk),transparent);opacity:.5;animation:sxTx 2.4s linear infinite;}",
      "@keyframes sxTx{0%{transform:scaleX(.2);opacity:0;}30%{opacity:.65;}100%{transform:scaleX(1);opacity:0;}}",
      ".comms[data-speaker=shen] .comms-t{animation:sxGlitch 3.2s steps(1,end) infinite;}",
      "@keyframes sxGlitch{0%,92%,100%{transform:none;filter:none;}94%{transform:translateX(1px);filter:hue-rotate(28deg);}96%{transform:translateX(-2px);}98%{transform:translateX(1px);}}",
      ".comms[data-speaker=enemy] .comms-t{text-shadow:1px 0 rgba(255,90,64,.5),-1px 0 rgba(127,215,255,.4);}",
      /* 过场 interlude：缓慢推进 / 淡入 */
      ".x-int-card{animation:sxIntCard 1.1s var(--sx-ease) both;overflow:hidden;}",
      ".x-int-lines p{animation:sxIntLine 1.2s var(--sx-ease) both;}",
      ".x-int-lines p:nth-child(2){animation-delay:.55s;}",
      ".x-int-lines p:nth-child(3){animation-delay:1.1s;}",
      ".x-int-card h2{animation:sxIntLine 1.3s var(--sx-ease) both;}",
      ".x-int-card .sub{animation:sxIntLine 1.3s .2s var(--sx-ease) both;}",
      "@keyframes sxIntCard{from{opacity:0;transform:translateY(18px) scale(.985);}to{opacity:1;transform:none;}}",
      "@keyframes sxIntLine{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}",
      /* 结局：打字机 + 视觉区分 */
      ".x-final.x-ending{white-space:pre-line;border-left:3px solid var(--signal);background:linear-gradient(90deg,rgba(255,179,71,.1),rgba(255,179,71,.02));padding:14px 16px;font:500 13px/1.95 var(--f-label);color:var(--bone);position:relative;}",
      ".x-final.x-ending::before{content:'ENDING';position:absolute;right:10px;top:8px;font:600 9px/1 var(--f-mono);letter-spacing:.28em;color:var(--signal);opacity:.8;}",
      ".x-final.x-ending b{color:var(--signal);letter-spacing:.08em;}",
      ".x-ending-caret{display:inline-block;width:7px;height:1em;background:var(--signal);vertical-align:-2px;animation:sxBlink .7s steps(2,end) infinite;}",
      "@keyframes sxBlink{0%{opacity:1;}100%{opacity:0;}}",
      ".x-end-choice{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;}",
      /* 色盲主题：色板 + 形状冗余 */
      "body.sx-cb-rg{--signal:#5ad1ff;--signal-hot:#9ce6ff;--rust:#ff9f1c;--alarm:#ff9f1c;--steel:#9fb4c8;}",
      "body.sx-cb-by{--signal:#ff77c8;--signal-hot:#ffa8de;--rust:#8ee6a0;--alarm:#8ee6a0;--steel:#c9d1d9;}",
      "body.sx-cb-rg .h-relays i,body.sx-cb-by .h-relays i{border-style:double;border-width:2px;}",
      "body.sx-cb-rg .h-cm i,body.sx-cb-by .h-cm i{border-radius:0;transform:rotate(0);}",
      "body.sx-cb-rg .h-wm i,body.sx-cb-by .h-wm i{border-radius:50%;transform:none;}",
      "body.sx-cb-rg .h-wm.extract i,body.sx-cb-by .h-wm.extract i{border-radius:0;transform:rotate(45deg);background:currentColor;}",
      "body.sx-cb-rg .h-hit.kill i,body.sx-cb-by .h-hit.kill i{width:4px;}",
      "body.sx-cb-rg .h-obj,body.sx-cb-by .h-obj{border-left-style:double;border-left-width:4px;}",
      /* 安全区 / 文字大小 / HUD 开关与透明度 */
      ".hud.on{opacity:var(--sx-hud-op);}",
      "body.sx-hud-op .hud.on{opacity:var(--sx-hud-op);}",
      "body.sx-hide-compass .h-compass,body.sx-hide-objective .h-obj,body.sx-hide-ammo .h-ammo,body.sx-hide-health .h-health,body.sx-hide-feed .h-feed{display:none!important;}",
      "body.sx-hide-cross .h-cross{opacity:0!important;}",
      "html[data-sx-text=s] .m-premise,html[data-sx-text=s] .x-br-list,html[data-sx-text=s] .x-int-lines p{font-size:12px;}",
      "html[data-sx-text=l] .m-premise{font-size:clamp(19px,1.75vw,25px);}",
      "html[data-sx-text=l] .m-h{font-size:clamp(46px,12vw,70px)!important;}",
      "html[data-sx-text=l] .x-br-h{font-size:48px;}",
      "html[data-sx-text=l] .x-br-list{font-size:15px;}",
      "html[data-sx-text=l] .x-int-lines p{font-size:17px;}",
      "html[data-sx-text=l] .x-mcard h3{font-size:26px;}",
      "html[data-sx-text=l] .h-obj-t{font-size:23px;}",
      "html[data-sx-text=s] .m-word{font-size:clamp(44px,9.5vw,120px)!important;}",
      /* 触屏：不重叠、安全区 */
      "@media (max-width:760px){.m-title .m-actions{gap:8px;}.m-title .m-actions .btn{padding-left:12px;padding-right:12px;letter-spacing:.12em;}",
      ".is-touch .h-ammo{top:calc(64px + var(--sat));right:calc(10px + var(--sar));}",
      ".is-touch .h-health{top:calc(128px + var(--sat));left:calc(10px + var(--sal));}",
      ".is-touch .h-obj{max-width:58vw;}",
      ".t-fire{right:calc(18px + var(--sar));bottom:calc(60px + var(--sab));}",
      ".t-jump{right:calc(18px + var(--sar));bottom:calc(158px + var(--sab));}",
      ".t-reload{right:calc(104px + var(--sar));bottom:calc(120px + var(--sab));}",
      ".t-ads{right:calc(114px + var(--sar));bottom:calc(32px + var(--sab));}",
      ".t-interact{right:calc(180px + var(--sar));bottom:calc(92px + var(--sab));}}",
      ".panel{width:min(460px,100vw);}",
      "@media (prefers-reduced-motion:reduce){.x-int-card,.x-int-lines p,.comms::after{animation:none!important;}}",
      /* 方向键提示 */
      ".sx-keyhint{margin-top:10px;font:500 10px/1.6 var(--f-mono);letter-spacing:.14em;color:var(--steel);text-transform:uppercase;}"
    ].join("");
    var st = document.createElement("style");
    st.id = "sx-ui2-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* --------------------------------------------------------- accessibility */
  function applyState() {
    try {
      var de = document.documentElement, body = document.body;
      de.classList.toggle("sx-cb-rg", state.colorblind === "rg");
      de.classList.toggle("sx-cb-by", state.colorblind === "by");
      body.classList.toggle("sx-cb-rg", state.colorblind === "rg");
      body.classList.toggle("sx-cb-by", state.colorblind === "by");
      de.style.setProperty("--sx-sub-alpha", String(state.subBg));
      de.style.setProperty("--sx-safe", state.safe + "px");
      de.style.setProperty("--sx-hud-op", String(state.hudOpacity));
      de.setAttribute("data-sx-text", state.textScale);
      var safe = state.safe;
      de.style.setProperty("--sat", "calc(env(safe-area-inset-top, 0px) + " + safe + "px)");
      de.style.setProperty("--sab", "calc(env(safe-area-inset-bottom, 0px) + " + safe + "px)");
      de.style.setProperty("--sal", "calc(env(safe-area-inset-left, 0px) + " + safe + "px)");
      de.style.setProperty("--sar", "calc(env(safe-area-inset-right, 0px) + " + safe + "px)");
      de.style.setProperty("--gl", "max(" + (16 + safe) + "px, calc(env(safe-area-inset-left, 0px) + " + (16 + safe) + "px))");
      de.style.setProperty("--gr", "max(" + (16 + safe) + "px, calc(env(safe-area-inset-right, 0px) + " + (16 + safe) + "px))");
      body.classList.toggle("sx-hide-compass", !state.hud.compass);
      body.classList.toggle("sx-hide-objective", !state.hud.objective);
      body.classList.toggle("sx-hide-ammo", !state.hud.ammo);
      body.classList.toggle("sx-hide-health", !state.hud.health);
      body.classList.toggle("sx-hide-feed", !state.hud.feed);
      body.classList.toggle("sx-hide-cross", !state.hud.cross);
    } catch (e) {}
    saveState();
    updateControls();
  }

  /* ------------------------------------------------------------ settings UI */
  var UI = null;
  function buildSettings() {
    if (UI) return;
    var pane = document.querySelector('.panel-b[data-pane="settings"]');
    if (!pane) return;
    var box = document.createElement("div");
    box.className = "sx-u2-block";
    box.innerHTML =
      '<h3 data-i18n="ui2.settings.access.title">辅助</h3>' +
      '<div class="row sx-lang-row"><label data-i18n="ui2.settings.language">语言</label>' +
        '<div class="seg" role="group" aria-label="Language">' +
          '<button type="button" data-sx-lang="zh-CN">中文</button>' +
          '<button type="button" data-sx-lang="en">English</button>' +
        '</div>' +
        '<p class="sx-hint" data-i18n="ui2.settings.language.hint"></p></div>' +
      '<div class="row"><label data-i18n="ui2.settings.colorblind">色盲主题</label>' +
        '<div class="seg" role="group" data-sx-cb>' +
          '<button type="button" data-v="none" data-i18n="ui2.settings.colorblind.none"></button>' +
          '<button type="button" data-v="rg" data-i18n="ui2.settings.colorblind.rg"></button>' +
          '<button type="button" data-v="by" data-i18n="ui2.settings.colorblind.by"></button>' +
        '</div><p class="sx-hint" data-i18n="ui2.settings.colorblind.hint"></p></div>' +
      '<div class="row"><label for="sx-sub-bg" data-i18n="ui2.settings.subBg">字幕背景</label>' +
        '<div class="slider"><input id="sx-sub-bg" type="range" min="0" max="100" step="5"><output data-sx-o="subBg"></output></div>' +
        '<p class="sx-hint" data-i18n="ui2.settings.subBg.hint"></p></div>' +
      '<div class="row"><label for="sx-safe" data-i18n="ui2.settings.safeArea">安全区边距</label>' +
        '<div class="slider"><input id="sx-safe" type="range" min="0" max="48" step="4"><output data-sx-o="safe"></output></div></div>' +
      '<div class="row"><label data-i18n="ui2.settings.textSize">文字大小</label>' +
        '<div class="seg" role="group" data-sx-text>' +
          '<button type="button" data-v="s" data-i18n="ui2.settings.textSize.s"></button>' +
          '<button type="button" data-v="m" data-i18n="ui2.settings.textSize.m"></button>' +
          '<button type="button" data-v="l" data-i18n="ui2.settings.textSize.l"></button>' +
        '</div></div>' +
      '<div class="row"><label for="sx-hud-op" data-i18n="ui2.settings.hudOpacity">HUD 不透明度</label>' +
        '<div class="slider"><input id="sx-hud-op" type="range" min="55" max="100" step="5"><output data-sx-o="hudOpacity"></output></div></div>' +
      '<div class="row"><label data-i18n="ui2.settings.hud">HUD 元素</label>' +
        '<div class="sx-u2-toggle">' +
          '<button type="button" class="btn small" data-sx-hud="compass" data-i18n="ui2.settings.hud.compass"></button>' +
          '<button type="button" class="btn small" data-sx-hud="objective" data-i18n="ui2.settings.hud.objective"></button>' +
          '<button type="button" class="btn small" data-sx-hud="ammo" data-i18n="ui2.settings.hud.ammo"></button>' +
          '<button type="button" class="btn small" data-sx-hud="health" data-i18n="ui2.settings.hud.health"></button>' +
          '<button type="button" class="btn small" data-sx-hud="feed" data-i18n="ui2.settings.hud.feed"></button>' +
          '<button type="button" class="btn small" data-sx-hud="cross" data-i18n="ui2.settings.hud.cross"></button>' +
        '</div></div>' +
      '<p class="sx-keyhint" data-i18n="ui2.controls.kbHint"></p>';
    var firstRow = pane.querySelector(".row");
    if (firstRow && firstRow.parentNode === pane) pane.insertBefore(box, firstRow);
    else pane.insertBefore(box, pane.firstChild);

    box.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-sx-lang")) { setLang(b.getAttribute("data-sx-lang")); return; }
      if (b.closest("[data-sx-cb]")) {
        state.colorblind = b.getAttribute("data-v") || "none";
        applyState(); return;
      }
      if (b.closest("[data-sx-text]")) { state.textScale = b.getAttribute("data-v"); applyState(); return; }
      var hudKey = b.getAttribute("data-sx-hud");
      if (hudKey) { state.hud[hudKey] = !state.hud[hudKey]; applyState(); }
    });
    var subBg = box.querySelector("#sx-sub-bg");
    if (subBg) subBg.addEventListener("input", function () { state.subBg = clamp01(+subBg.value / 100); applyState(); });
    var safe = box.querySelector("#sx-safe");
    if (safe) safe.addEventListener("input", function () { state.safe = Math.max(0, +safe.value | 0); applyState(); });
    var hudOp = box.querySelector("#sx-hud-op");
    if (hudOp) hudOp.addEventListener("input", function () { state.hudOpacity = Math.min(1, Math.max(0.55, +hudOp.value / 100)); applyState(); });
    UI = box;
    applyDomI18n(box);
    updateControls();
  }

  function updateControls() {
    if (!UI) return;
    var lang = I ? I.getLang() : "zh-CN";
    var lb = UI.querySelectorAll("[data-sx-lang]");
    for (var i = 0; i < lb.length; i++) lb[i].setAttribute("aria-pressed", String(lb[i].getAttribute("data-sx-lang") === lang));
    var cb = UI.querySelectorAll("[data-sx-cb] button");
    for (var j = 0; j < cb.length; j++) cb[j].setAttribute("aria-pressed", String(cb[j].getAttribute("data-v") === state.colorblind));
    var ts = UI.querySelectorAll("[data-sx-text] button");
    for (var k = 0; k < ts.length; k++) ts[k].setAttribute("aria-pressed", String(ts[k].getAttribute("data-v") === state.textScale));
    var hb = UI.querySelectorAll("[data-sx-hud]");
    for (var m = 0; m < hb.length; m++) hb[m].setAttribute("aria-pressed", String(!!state.hud[hb[m].getAttribute("data-sx-hud")]));
    var sb = UI.querySelector("#sx-sub-bg"), so = UI.querySelector('[data-sx-o="subBg"]');
    if (sb) { sb.value = String(Math.round(state.subBg * 100)); if (so) so.textContent = Math.round(state.subBg * 100) + "%"; }
    var sf = UI.querySelector("#sx-safe"), sfo = UI.querySelector('[data-sx-o="safe"]');
    if (sf) { sf.value = String(state.safe); if (sfo) sfo.textContent = state.safe + "px"; }
    var ho = UI.querySelector("#sx-hud-op"), hoo = UI.querySelector('[data-sx-o="hudOpacity"]');
    if (ho) { ho.value = String(Math.round(state.hudOpacity * 100)); if (hoo) hoo.textContent = Math.round(state.hudOpacity * 100) + "%"; }
  }

  function applyDomI18n(root) {
    if (I && I.applyDom) I.applyDom(root || document);
  }

  /* --------------------------------------------------------------- language */
  function localizeTitle() {
    var title = document.querySelector(".m-title");
    if (!title) return;
    var premiseEl = title.querySelector(".m-premise");
    if (premiseEl) {
      var pc = premiseEl.textContent || "";
      if (pc.indexOf("当前行动") >= 0 || pc.indexOf("Current operation") >= 0) {
        // campaign 写入的动态“当前行动”不能被静态文案覆盖
        if (document.documentElement.lang === "en") premiseEl.textContent = pc.replace("当前行动", "Current operation");
      } else {
        text(".m-title .m-premise", t("ui2.title.premise"));
      }
    }
    text(".m-title .m-note", t("ui2.title.note"));
    var eyebrow = title.querySelector(".m-eyebrow");
    if (eyebrow) {
      var spans = eyebrow.querySelectorAll("span");
      if (spans[1]) { if (spans[1].textContent !== t("ui2.title.kicker")) spans[1].textContent = t("ui2.title.kicker"); }
      var dim = eyebrow.querySelector(".m-dim");
      if (dim) {
        var src = dim.getAttribute("data-sx-src") || dim.textContent || "";
        dim.setAttribute("data-sx-src", src);
        var m = /已解锁\s*(\d+)\/(\d+)/.exec(src), mt = /(\d+)\/(\d+)/.exec(src);
        if (/已封存/.test(src)) dim.textContent = t("ui2.title.sealed");
        else if (mt) dim.textContent = t("ui2.title.status") + " · " + t("ui2.title.unlocked", { n: mt[1], total: mt[2] });
        else if (m) dim.textContent = t("ui2.title.unlocked", { n: m[1], total: m[2] });
        else dim.textContent = t("ui2.title.status");
      }
    }
    /* 标题主词与副标题分属两个 span；主词与副标题之间保留一个空格文本节点，
       否则 .m-word 的 textContent 会拼成 "SALTLINEJI-MAO · 3A"。 */
    var word = title.querySelector(".m-word");
    if (word) {
      var want = t("ui2.title.word"), sub = t("ui2.title.wordSub");
      var main = word.querySelector(".m-main");
      if (!main) {
        main = document.createElement("span");
        main.className = "m-main";
        var lead = "";
        while (word.firstChild && word.firstChild.nodeType === 3) {
          lead += word.firstChild.nodeValue;
          word.removeChild(word.firstChild);
        }
        main.textContent = lead;
        word.insertBefore(main, word.firstChild);
      }
      if (main.textContent !== want) main.textContent = want;
      var sp = word.querySelector(".m-subtitle");
      if (!sp) {
        sp = document.createElement("span");
        sp.className = "m-subtitle";
        word.appendChild(sp);
      }
      if (sp.getAttribute("data-i18n") !== "ui2.title.wordSub") sp.setAttribute("data-i18n", "ui2.title.wordSub");
      if (sp.textContent !== sub) sp.textContent = sub;
      var between = main.nextSibling;
      if (!(between && between.nodeType === 3 && /^[ \t\u00a0]+$/.test(between.nodeValue))) {
        word.insertBefore(document.createTextNode(" "), main.nextSibling);
      }
    }
    var legend = title.querySelector(".m-legend");
    if (legend) {
      var rows = [
        '<div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ' + t("ui2.controls.move") + '</span><span><kbd>' + t("ui2.controls.mouse") + '</kbd> ' + t("ui2.controls.look") + '</span><span><kbd>' + t("ui2.controls.lmb") + '</kbd> ' + t("ui2.controls.fire") + '</span><span><kbd>' + t("ui2.controls.rmb") + '</kbd> ' + t("ui2.controls.aim") + '</span><span><kbd>R</kbd> ' + t("ui2.controls.reload") + '</span></div>',
        '<div><span><kbd>E</kbd> ' + t("ui2.controls.interact") + '</span><span><kbd>Space</kbd> ' + t("ui2.controls.jump") + '</span><span><kbd>Shift</kbd> ' + t("ui2.controls.sprint") + '</span><span><kbd>C</kbd> ' + t("ui2.controls.crouch") + '</span><span><kbd>Esc</kbd> ' + t("ui2.controls.pause") + '</span></div>',
        '<div><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> ' + t("ui2.controls.swap") + '</span><span>' + t("ui2.controls.holdG") + '</span><span><kbd>Q</kbd> ' + t("ui2.controls.scan") + '</span><span><kbd>V</kbd> ' + t("ui2.controls.melee") + '</span></div>',
        '<div class="lg-touch"><em>' + t("ui2.title.touch") + '</em><span>' + t("ui2.controls.touchMove") + '</span><span>' + t("ui2.controls.touchLook") + '</span><span>' + t("ui2.controls.touchFire") + '</span></div>'
      ].join("");
      if (legend.innerHTML !== rows) legend.innerHTML = rows;
    }
    var ver = title.querySelector(".m-ver");
    if (ver) ver.textContent = t("ui2.title.version");
    var badge = document.querySelector(".x-prog-badge");
    if (badge) {
      var html = badge.innerHTML;
      var map = [["信用点", t("ui2.title.credits")], ["成就", t("ui2.title.achievements")], ["挑战", t("ui2.title.challenges")]];
      var changed = false;
      for (var i = 0; i < map.length; i++) {
        if (html.indexOf(map[i][0]) >= 0) { html = html.split(map[i][0]).join(map[i][1]); changed = true; }
      }
      if (changed) badge.innerHTML = html;
    }
  }

  function localizeMenu() {
    var menu = document.querySelector(".menu");
    if (!menu) return;
    var title = document.querySelector(".m-title");
    if (title && menu.dataset.screen === "title") localizeTitle();

    var paused = menu.querySelector('.m-screen[data-s="paused"]');
    if (paused) {
      text('.m-screen[data-s="paused"] .m-k', t("ui2.pause.kicker"));
      text('.m-screen[data-s="paused"] .m-h', t("ui2.pause.title"));
      var meta = paused.querySelector(".sx-pause-meta");
      if (!meta) {
        meta = document.createElement("p");
        meta.className = "sx-pause-meta";
        var line = paused.querySelector('[data-f="lookmode"]');
        if (line) line.parentNode.insertBefore(meta, line.nextSibling); else paused.appendChild(meta);
      }
      var c = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      var ms = c && missionById(c.mission);
      var run = G && G.game && G.game.run;
      var done = 0, total = 0;
      try {
        if (G && G.level && G.level.objectives) { total = G.level.objectives.length; done = G.level.objectives.filter(function (o) { return o.cut; }).length; }
      } catch (e) {}
      var lineText = c ? t("ui2.pause.meta", { code: ms ? ms.code : "", name: ms ? missionField(ms, "name") : (c.mission || "") }) : t("ui2.pause.title");
      if (total) lineText += " · " + t("ui2.pause.progress", { done: done, total: total, time: fmtTime(run && run.time) });
      meta.textContent = lineText;
      var pauseBtns = paused.querySelectorAll(".btn");
      for (var i = 0; i < pauseBtns.length; i++) localizeButton(pauseBtns[i]);
    }

    var dead = menu.querySelector('.m-screen[data-s="dead"]');
    if (dead) {
      text('.m-screen[data-s="dead"] .m-k', t("ui2.dead.kicker"));
      text('.m-screen[data-s="dead"] .m-h', t("ui2.dead.title"));
      var dts = dead.querySelectorAll(".m-stats dt");
      if (dts[0]) dts[0].textContent = t("ui2.dead.time");
      if (dts[1]) dts[1].textContent = t("ui2.dead.relays");
    }

    var deb = menu.querySelector('.m-screen[data-s="complete"]');
    if (deb) {
      var c2 = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      var mission = c2 && missionById(c2.mission);
      var mk = deb.querySelector(".m-k");
      if (mk && mission) mk.textContent = t("ui2.debrief.kicker", { name: missionField(mission, "name") });
      var dts2 = deb.querySelectorAll(".m-stats dt");
      var labels = ["ui2.debrief.time", "ui2.debrief.accuracy", "ui2.debrief.kills", "ui2.debrief.retries"];
      for (var j = 0; j < dts2.length && j < labels.length; j++) dts2[j].textContent = t(labels[j]);
      var rating = deb.querySelector(".m-rating span");
      if (rating) rating.textContent = t("ui2.debrief.rating");
      var rv = deb.querySelector('[data-f="rating"]');
      if (rv) rv.textContent = trText(rv.textContent);
      var fin = deb.querySelector(".x-final:not(.x-ending)");
      if (fin) {
        var fm = /全部\s*(\d+)\s*个行动完成\s*·\s*(.+)$/.exec(fin.textContent || "");
        if (fm) {
          var last = /最后的决定/.test(fm[2]);
          fin.textContent = t(last ? "ui2.final.last" : "ui2.final.all", { n: fm[1] });
        }
      }
      var actions = deb.querySelectorAll(".m-actions .btn");
      for (var q = 0; q < actions.length; q++) {
        var b = actions[q];
        if (b.classList.contains("x-next")) {
          var n = b.getAttribute("data-sx-next-name");
          if (!n) { var mm = /·\s*(.+)$/.exec(b.textContent || ""); n = mm ? mm[1].trim() : ""; b.setAttribute("data-sx-next-name", n); }
          b.textContent = t("ui2.menu.next", { name: trText(n) });
        } else if (b.classList.contains("x-final-back")) b.textContent = t("ui2.menu.title");
        else localizeButton(b);
      }
    }

    var tabs = menu.querySelectorAll(".panel .tab");
    for (var ti = 0; ti < tabs.length; ti++) {
      var tab = tabs[ti];
      var key = "ui2.settings.tab." + (tab.getAttribute("data-tab") || "settings");
      if (I && I.has && I.has(key)) tab.textContent = t(key);
    }
    var close = menu.querySelector('[data-act="close-panel"]');
    if (close) close.textContent = t("ui2.menu.close");
    var panel = menu.querySelector(".panel");
    if (panel) {
      tagTextNodes(panel);
      localizePanelOptions(panel);
      localizeControlsPane(panel);
      localizeSettingsNotes(panel);
    }

    /* 标题 / 暂停按钮 */
    var btns = menu.querySelectorAll(".m-actions .btn, .m-title .btn, .m-screen .btn");
    for (var bi = 0; bi < btns.length; bi++) localizeButton(btns[bi]);
  }

  function localizeButton(b) {
    if (!b) return;
    var act = b.getAttribute("data-act");
    var map = {
      deploy: "ui2.menu.deploy", resume: "ui2.menu.resume", settings: "ui2.menu.settings",
      about: "ui2.menu.about", controls: "ui2.menu.controls", restart: "ui2.menu.restart",
      retry: "ui2.menu.retry", redeploy: "ui2.menu.redeploy", "close-panel": "ui2.menu.close"
    };
    if (act && map[act]) {
      if (b.textContent !== t(map[act])) b.textContent = t(map[act]);
      return;
    }
    var x = b.getAttribute("data-x");
    if (x === "campaign") { b.textContent = t("ui2.menu.campaign"); return; }
    if (x === "to-title") { b.textContent = t("ui2.menu.title"); return; }
    var txt = (b.textContent || "").trim();
    if (b.classList.contains("primary") && /开始行动/.test(txt)) { b.textContent = t("ui2.menu.deploy"); return; }
    if (/^联机对战$/.test(txt) || /Multiplayer/.test(txt)) { b.textContent = t("ui2.menu.mp"); return; }
    if (/^行动简报$/.test(txt)) { b.textContent = t("ui2.menu.campaign"); return; }
    if (/^武器改装$/.test(txt)) { b.textContent = t("ui2.menu.armory"); return; }
    if (/^按键重绑$/.test(txt)) { b.textContent = t("ui2.menu.rebind"); return; }
    if (txt && !/^[\x00-\x7f]+$/.test(txt)) {
      var tr = trText(txt);
      if (tr !== txt) b.textContent = tr;
    }
  }

  function localizePanelOptions(panel) {
    var segs = panel.querySelectorAll(".seg");
    var diffMap = { recruit: "ui2.settings.diff.recruit", normal: "ui2.settings.diff.normal", veteran: "ui2.settings.diff.veteran", nightmare: "ui2.settings.diff.nightmare" };
    var crossMap = { bone: "ui2.settings.cross.bone", amber: "ui2.settings.cross.amber", cyan: "ui2.settings.cross.cyan", lime: "ui2.settings.cross.lime", crimson: "ui2.settings.cross.crimson", gold: "ui2.settings.cross.gold" };
    var qualityMap = { auto: "ui.settings.quality.auto", low: "ui2.opt.low", medium: "ui2.opt.medium", high: "ui2.opt.high", ultra: "ui2.opt.ultra" };
    for (var i = 0; i < segs.length; i++) {
      var group = segs[i];
      var kind = group.getAttribute("data-x-seg") || "";
      var jb = group.querySelectorAll("button");
      for (var j = 0; j < jb.length; j++) {
        var b = jb[j];
        if (b.closest(".sx-u2-block")) continue;
        var v = b.getAttribute("data-v") || b.getAttribute("data-q") || "";
        var key = null;
        if (b.getAttribute("data-q")) key = qualityMap[v];
        else if (kind === "difficulty" && diffMap[v]) key = diffMap[v];
        else if (kind === "cross" && crossMap[v]) key = crossMap[v];
        else if (kind === "shake") key = v === "low" ? "ui2.opt.low" : v === "high" ? "ui2.opt.high" : "ui2.settings.diff.normal";
        else if (kind === "hudScale" || kind === "subSize") key = null;
        if (key && I && I.has(key)) b.textContent = t(key);
        else if (kind === "hudScale") b.textContent = v + "%";
        else if (kind === "subSize") b.textContent = v === "S" ? t("ui2.settings.textSize.s") : v === "L" ? t("ui2.settings.textSize.l") : t("ui2.settings.textSize.m");
      }
    }
    var toggles = panel.querySelectorAll(".toggle span");
    for (var ti = 0; ti < toggles.length; ti++) {
      var sp = toggles[ti];
      var on = sp.closest(".toggle") && sp.closest(".toggle").getAttribute("aria-pressed") === "true";
      sp.textContent = on ? t("ui2.access.on") : t("ui2.access.off");
    }
    /* 其它模块注入的小标题：按中文原文映射，中英双向 */
    var headMap = {
      "画面与音频": "ui2.settings.av", "游戏性": "ui2.settings.gameplay", "辅助": "ui2.settings.aux",
      "音频 · V33": "ui2.settings.audio.section", "操控 · V33": "ui2.settings.controls.section"
    };
    var heads = panel.querySelectorAll("h3");
    for (var hi = 0; hi < heads.length; hi++) {
      var h = heads[hi];
      if (h.closest(".sx-u2-block")) continue;
      if (!h.__sxKey) { h.__sxSrc = h.textContent; }
      var hk = headMap[zhSource(h).trim()];
      if (hk) renderZh(h, t(hk));
    }
    /* ext_input 的辅助瞄准分段：按 data-v 重绘，避免被其它模块回写中文 */
    var aimBtns = panel.querySelectorAll("[data-sx2-aim] button");
    for (var ai = 0; ai < aimBtns.length; ai++) {
      var av = aimBtns[ai].getAttribute("data-v");
      var ak = av === "off" ? "ui2.opt.shortOff" : av === "low" ? "ui2.opt.low" : av === "high" ? "ui2.opt.high" : "ui2.opt.std";
      setText(aimBtns[ai], t(ak));
    }
    var labels = panel.querySelectorAll(".row > label");
    var labelMap = {
      "画面质量": "ui2.settings.quality", "鼠标灵敏度": "ui2.settings.sens", "反转垂直视角": "ui2.settings.invert",
      "主音量": "ui2.settings.volume", "视野范围": "ui2.settings.fov", "显示模式": "ui2.settings.display",
      "作战难度": "ui2.settings.difficulty", "准星颜色": "ui2.settings.cross", "镜头晃动": "ui2.settings.shake",
      "减少动态": "ui2.settings.reduce", "HUD 缩放": "ui2.settings.hudScale", "字幕大小": "ui2.settings.subSize",
      "高对比": "ui2.settings.contrast"
    };
    for (var li = 0; li < labels.length; li++) {
      var lb = labels[li];
      if (lb.closest(".sx-u2-block")) continue;
      var src = lb.getAttribute("data-sx-src") || lb.textContent;
      lb.setAttribute("data-sx-src", src);
      var key2 = labelMap[src.trim()];
      if (key2 && I && I.has(key2)) lb.textContent = t(key2);
    }
  }

  function localizeControlsPane(panel) {
    var pane = panel.querySelector('[data-pane="controls"]');
    if (!pane) return;
    var h3 = pane.querySelectorAll("h3");
    if (h3[0]) h3[0].textContent = t("ui2.controls.kbm");
    if (h3[1]) h3[1].textContent = t("ui2.controls.touch");
    if (h3[2]) h3[2].textContent = t("ui2.controls.pad");
    var dtMap = {
      "移动": "ui2.controls.move", "视角": "ui2.controls.look", "开火": "ui2.controls.fire", "瞄准": "ui2.controls.aim",
      "换弹": "ui2.controls.reload", "切断中继": "ui2.controls.interact", "跳跃": "ui2.controls.jump",
      "冲刺": "ui2.controls.sprint", "蹲伏": "ui2.controls.crouch", "近战": "ui2.controls.melee",
      "切换武器": "ui2.controls.swap", "投掷手雷": "ui2.controls.grenade", "战术扫描": "ui2.controls.scan", "暂停": "ui2.controls.pause"
    };
    var dts = pane.querySelectorAll(".keys dt");
    for (var i = 0; i < dts.length; i++) {
      var src = dts[i].getAttribute("data-sx-src") || dts[i].textContent.trim();
      dts[i].setAttribute("data-sx-src", src);
      var k = dtMap[src];
      if (k) dts[i].textContent = t(k);
    }
    var ddMap = {
      "鼠标": "ui2.controls.mouse", "鼠标左键": "ui2.controls.lmb", "鼠标右键": "ui2.controls.rmb",
      "按住 G 预览弹道，松开投掷": "ui2.controls.holdG",
      "左手拇指在左侧任意位置滑动": "ui2.controls.touchMove",
      "在屏幕右侧拖动": "ui2.controls.touchLook",
      "左手拇指移动": "ui2.controls.touchMove", "右手拇指转动视角": "ui2.controls.touchLook",
      "点击“瞄准”切换瞄准状态": "ui2.controls.touchAim",
      "换弹": "ui2.controls.reload", "跳跃": "ui2.controls.jump",
      "将摇杆推到最前方": "ui2.controls.touchSprint",
      "按住“开火”，拖动跟踪目标": "ui2.controls.touchFire"
    };
    var dds = pane.querySelectorAll(".keys dd");
    for (var j = 0; j < dds.length; j++) {
      var dd = dds[j];
      if (dd.querySelector("kbd")) continue;
      var src2 = dd.getAttribute("data-sx-src") || dd.textContent.trim();
      dd.setAttribute("data-sx-src", src2);
      var key = ddMap[src2];
      if (key) dd.textContent = t(key);
    }
    var notes = pane.querySelectorAll(".panel-note");
    if (notes[0]) notes[0].textContent = t("ui2.controls.mouseNote");
    if (notes[1]) notes[1].textContent = t("ui2.controls.padNote");
  }

  /* -------------------------------------------------------------- narrative */
  function missionById(id) {
    var list = window.__SX_I18N_MISSIONS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function missionField(m, field) {
    if (!m) return "";
    var lang = I && I.getLang() === "en" ? "en" : "zh";
    return (m[lang] && m[lang][field] != null) ? m[lang][field] : (m.zh[field] != null ? m.zh[field] : "");
  }
  function missionLang(m) {
    return (m && I && I.getLang() === "en" && m.en) ? m.en : (m ? m.zh : {});
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
  }

  function localizeCampaign() {
    var camp = document.querySelector(".x-camp");
    if (camp) {
      var lang = I && I.getLang() === "en" ? "en" : "zh";
      text(".x-camp .m-k", t("ui2.camp.kicker"), camp);
      text(".x-camp .x-camp-h", t("ui2.camp.title"), camp);
      text(".x-camp .x-camp-sub", t("ui2.camp.sub"), camp);
      text(".x-camp .x-camp-note", t("ui2.camp.note"), camp);
      var bx = camp.querySelectorAll(".x-camp-actions .btn");
      for (var i = 0; i < bx.length; i++) {
        var b = bx[i], x = b.getAttribute("data-x");
        if (x === "go") b.textContent = t("ui2.camp.go");
        else if (x === "close") b.textContent = t("ui2.menu.back");
        else if (x === "arm") b.textContent = t("ui2.menu.armory");
        else if (x === "archive") b.textContent = t("ui2.arc.kicker");
      }
      var data = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      var chal = window.__SX && window.__SX.challenges ? window.__SX.challenges() : null;
      var cards = camp.querySelectorAll(".x-mcard[data-idx]");
      for (var c = 0; c < cards.length; c++) {
        var idx = parseInt(cards[c].getAttribute("data-idx"), 10) || 0;
        var m = (window.__SX_I18N_MISSIONS || [])[idx];
        if (!m) continue;
        var d = missionLang(m);
        var locked = !!(data && idx >= data.unlocked);
        var doneN = chal && chal.map && chal.map[m.id] ? ["time", "head", "clean"].filter(function (k) { return chal.map[m.id][k]; }).length : 0;
        var best = data && data.best ? data.best[m.id] : null;
        var meta;
        if (locked) meta = t("ui2.camp.lockHint");
        else if (best) meta = t("ui2.camp.best", { time: fmtTime(best.time), rating: trText(best.rating || "") });
        else meta = t("ui2.camp.unfinished");
        setHtml(cards[c],
          (locked ? '<span class="lock">' + t("ui2.camp.locked") + "</span>" : "") +
          '<span class="code">' + d.chapter + " · " + m.id.slice(1) + "</span>" +
          "<h3>" + d.name + "</h3><div class=\"sub\">" + d.sub + "</div>" +
          "<p>" + d.desc + "</p>" +
          (locked ? "" : '<div class="x-mchal">' + t("ui2.camp.challenge", { n: doneN }) + "</div>") +
          '<div class="meta">' + meta + "</div>");
      }
      var train = camp.querySelector(".x-train-card");
      if (train && data) {
        setHtml(train, '<span class="code">' + t("ui2.camp.trainingCard", { code: "T1" }) + "</span>" +
          "<h3>" + t("ui2.camp.training") + "</h3><div class=\"sub\">" + t("ui2.camp.trainingMeta") + "</div>" +
          "<p>" + t("ui2.camp.trainingMeta") + "</p>" +
          '<div class="meta">' + (data.best && data.best.train ? t("ui2.camp.trainingBest", { score: data.best.train.score }) : t("ui2.camp.trainingMeta")) + "</div>");
      }
      var go = camp.querySelector('[data-x="go"]');
      if (go && data) {
        var cur = (window.__SX_I18N_MISSIONS || [])[data.current];
        go.textContent = t("ui2.camp.goNamed", { name: cur ? missionField(cur, "name") : "" });
      }
    }

    var brief = document.querySelector(".x-brief");
    if (brief) {
      var data2 = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      var cur2 = data2 ? (window.__SX_I18N_MISSIONS || [])[data2.current] : null;
      if (cur2) {
        var dd = missionLang(cur2);
        text(".x-br-k", dd.chapter + " · " + (I && I.getLang() === "en" ? "Op " : "行动 ") + cur2.id.slice(1) + " · " + dd.name, brief);
        text(".x-br-h", dd.name, brief);
        text(".x-br-sub", dd.sub, brief);
        var metas = brief.querySelectorAll(".x-br-meta > div");
        /* 只改文本、不重建节点：campaign.js 的 openBriefing 依赖 .x-br-threats / .x-br-rec 这两个 b，
           旧实现 setHtml 会丢掉 class，导致再次打开简报时 openBriefing 抛 pageerror 且覆盖层打不开。 */
        if (metas[0]) { setText(metas[0].querySelector("span"), t("ui2.brief.section.threats")); setText(metas[0].querySelector("b"), dd.threats); }
        if (metas[1]) { setText(metas[1].querySelector("span"), t("ui2.brief.section.recommend")); setText(metas[1].querySelector("b"), dd.recommend); }
        if (metas[2]) {
          var msp2 = metas[2].querySelector("span");
          if (msp2) msp2.textContent = t("ui2.brief.section.difficulty");
          var diffEl = metas[2].querySelector("b");
          if (diffEl) diffEl.textContent = trText(diffEl.textContent);
        }
        if (metas[3]) {
          var msp3 = metas[3].querySelector("span");
          if (msp3) msp3.textContent = t("ui2.brief.section.record");
          var bestEl = metas[3].querySelector("b");
          if (bestEl) {
            var bm = /^最佳\s*([\d:]+)\s*·\s*(.+)$/.exec(bestEl.textContent || "");
            bestEl.textContent = bm ? t("ui2.camp.best", { time: bm[1], rating: trText(bm[2]) }) : trText(bestEl.textContent);
          }
        }
        var list = brief.querySelector(".x-br-list");
        if (list) setHtml(list, (dd.brief || []).map(function (x) { return "<li>" + x + "</li>"; }).join(""));
        var wrap = brief.querySelector(".x-br-chal-wrap");
        if (wrap) { var wb = wrap.querySelector("b"); if (wb) wb.textContent = t("ui2.brief.challenge"); }
        var acts = brief.querySelectorAll(".x-br-actions .btn");
        if (acts[0]) acts[0].textContent = t("ui2.brief.go");
        if (acts[1]) acts[1].textContent = t("ui2.brief.armory");
        if (acts[2]) acts[2].textContent = t("ui2.brief.back");
      }
    }

    var arc = document.querySelector(".x-archive");
    if (arc) {
      var data3 = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      var chal3 = window.__SX && window.__SX.challenges ? window.__SX.challenges() : null;
      text(".x-arc-panel .m-k", t("ui2.arc.kicker"), arc);
      text(".x-arc-sub", t("ui2.arc.sub"), arc);
      var rows = arc.querySelectorAll(".x-arc-row");
      var list3 = window.__SX_I18N_MISSIONS || [];
      for (var r = 0; r < rows.length && r < list3.length; r++) {
        var mm = list3[r], dm = missionLang(mm);
        var locked3 = !!(data3 && r >= data3.unlocked);
        var best3 = data3 && data3.best ? data3.best[mm.id] : null;
        var dn = chal3 && chal3.map && chal3.map[mm.id] ? ["time", "head", "clean"].filter(function (k) { return chal3.map[mm.id][k]; }).length : 0;
        var st = locked3 ? t("ui2.arc.locked") : best3 ? t("ui2.arc.done") + " · " + t("ui2.arc.challenge", { n: dn }) : t("ui2.arc.unfinished");
        rows[r].classList.toggle("lock", locked3);
        setHtml(rows[r], "<b>" + t("ui2.arc.row", { code: mm.id.slice(1), name: dm.name }) + "</b><span>" + dm.chapter + "</span><em>" + st + "</em>");
      }
      var end = arc.querySelector(".x-arc-end");
      if (end && data3 && /封存/.test(end.textContent || "")) {
        var kind = /公开/.test(end.textContent) ? "open" : "silent";
        end.innerHTML = '<div class="x-arc-final">' + t("ui2.arc.sealed", { kind: t("ui2.arc.kind." + kind) }) + "</div>";
      }
      var back = arc.querySelector("[data-ar-back]");
      if (back) back.textContent = t("ui2.arc.back");
    }

    var it = document.querySelector(".x-interlude");
    if (it) {
      var to = parseInt(it.getAttribute("data-to"), 10);
      if (isNaN(to)) to = 0;
      var nm = (window.__SX_I18N_MISSIONS || [])[to];
      if (nm) {
        var dn2 = missionLang(nm);
        text(".x-int-card [data-int-k]", dn2.chapter || t("ui2.int.next"), it);
        text(".x-int-card [data-int-h]", dn2.name, it);
        text(".x-int-card [data-int-sub]", dn2.sub, it);
        var prev = (window.__SX_I18N_MISSIONS || [])[to - 1];
        var lines = prev ? missionLang(prev).interlude || [] : [];
        var box = it.querySelector("[data-int-lines]");
        if (box) setHtml(box, lines.map(function (x) { return "<p>" + x + "</p>"; }).join(""));
        var go = it.querySelector("[data-int-go]");
        if (go) go.textContent = t("ui2.int.go");
      }
    }

    var loc = document.querySelector(".loc-card");
    if (loc) {
      var data4 = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      var cm = data4 ? (window.__SX_I18N_MISSIONS || [])[data4.current] : null;
      if (cm) {
        var dl = missionLang(cm);
        var bb = loc.querySelector("b"), ss = loc.querySelector("span");
        if (bb) bb.textContent = t("ui2.title.status") + " · " + dl.name;
        if (ss) ss.textContent = dl.sub;
      }
    }
  }

  function localizeChoices() {
    var choice = document.querySelector(".x-end-choice");
    if (!choice) return;
    var bs = choice.querySelectorAll("[data-end]");
    for (var i = 0; i < bs.length; i++) {
      var txt = t("ui2.end.choice." + bs[i].getAttribute("data-end"));
      if (bs[i].textContent !== txt) bs[i].textContent = txt;
    }
  }

  function localizeEnding() {
    var box = document.querySelector(".x-final.x-ending");
    if (!box) {
      if (typingBox) stopTypewrite();
      return;
    }
    var kind = box.getAttribute("data-sx-kind");
    if (!kind) kind = /核心搬上|核心/.test(box.getAttribute("data-sx-plain") || box.textContent || "") ? "open" : "silent";
    if (box.getAttribute("data-sx-kind") !== kind) box.setAttribute("data-sx-kind", kind);
    var lines = [t("ui2.end." + kind + ".1"), t("ui2.end." + kind + ".2"), t("ui2.end." + kind + ".3")];
    var plain = lines.join("\n");
    /* 仍在打同一段 → 不重启动画；已经打完同一段 → 不重打。
       旧实现只判断 caret 是否存在，打完 caret 被移除后会无限重打并触发全量 refresh。 */
    if (typingBox === box && typingPlain === plain) return;
    if (box.__sxDone === plain) return;
    if (box.getAttribute("data-sx-plain") !== plain) box.setAttribute("data-sx-plain", plain);
    typewrite(box, lines, plain);
    var choice = document.querySelector(".x-end-choice");
    if (choice) {
      var bs = choice.querySelectorAll("[data-end]");
      for (var i = 0; i < bs.length; i++) {
        var key = "ui2.end.choice." + bs[i].getAttribute("data-end");
        if (bs[i].textContent !== t(key)) bs[i].textContent = t(key);
      }
    }
  }

  /* -------------------------------------------------- 打字机 + 观察器节流 */
  var typeTimer = null, typingBox = null, typingPlain = null;
  var TYPE_MS = 26;
  function stopTypewrite() {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    typingBox = null;
    typingPlain = null;
    resumeObserver();
  }
  function typewrite(el, lines, plain) {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    /* 打字期间断开 MutationObserver：每个字都会改 DOM，不节流会引发 26ms 一次的全量 refresh 风暴 */
    suspendObserver();
    typingBox = el;
    typingPlain = plain;
    el.__sxDone = null;
    var reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    var full = lines.join("\n");
    if (reduce) {
      el.textContent = full;
      el.__sxDone = plain;
      typingBox = null;
      typingPlain = null;
      resumeObserver();
      return;
    }
    el.textContent = "";
    var caret = document.createElement("span");
    caret.className = "x-ending-caret";
    el.appendChild(caret);
    var i = 0;
    typeTimer = setInterval(function () {
      if (i >= full.length) {
        clearInterval(typeTimer); typeTimer = null;
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        el.__sxDone = plain;
        typingBox = null;
        typingPlain = null;
        resumeObserver();
        return;
      }
      i += 2;
      var before = document.createTextNode(full.slice(0, i));
      while (el.firstChild && el.firstChild !== caret) el.removeChild(el.firstChild);
      el.insertBefore(before, caret);
    }, TYPE_MS);
  }

  /* -------------------------------------------------------------------- HUD */
  var lastRadio = null, lastPrompt = null, lastObjective = "";
  function patchHud() {
    if (!G || !G.hud || G.hud.__sxUi2) return;
    var hud = G.hud;
    hud.__sxUi2 = true;
    var oSetObjective = hud.setObjective, oRadio = hud.radio, oPrompt = hud.setPrompt, oMsg = hud.message, oMarkers = hud.setMarkers;

    hud.setObjective = function (s) {
      lastObjective = s || "";
      return oSetObjective.call(hud, translateObjective(lastObjective));
    };
    hud.radio = function (s, secs) {
      lastRadio = { src: s, secs: secs || 4.5 };
      return oRadio.call(hud, trText(s), secs);
    };
    hud.setPrompt = function (label, prog) {
      lastPrompt = { label: label, prog: prog || 0 };
      var r = oPrompt.call(hud, label, prog);
      var pl = document.querySelector(".h-plabel");
      if (pl && label) {
        var key = (G.input && G.input.touch) ? "交互" : (G.input && G.input.gamepad && !G.input.locked) ? "Y" : "E";
        pl.textContent = t("ui2.hud.hold", { key: key, label: trText(label) });
      }
      return r;
    };
    hud.message = function (s, secs) {
      return oMsg.call(hud, trText(s), secs);
    };
    hud.setMarkers = function (list) {
      var out = (list || []).map(function (m) {
        var c = {};
        for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) c[k] = m[k];
        if (c.label) c.label = trText(c.label);
        if (c.short) c.short = trText(c.short);
        return c;
      });
      return oMarkers.call(hud, out);
    };
    applyHudLabels();
  }

  function applyHudLabels() {
    var ok = document.querySelector(".h-obj .h-k"); if (ok) ok.textContent = t("ui2.hud.objective");
    var rk = document.querySelector(".h-relays span"); if (rk) rk.textContent = t("ui2.hud.relays");
    var hk = document.querySelector(".h-health .h-k"); if (hk) hk.textContent = t("ui2.hud.vitals");
    var comp = document.querySelectorAll(".h-tape b.card");
    var cardEn = { "北": "N", "东北": "NE", "东": "E", "东南": "SE", "南": "S", "西南": "SW", "西": "W", "西北": "NW" };
    var cardZh = { "N": "北", "NE": "东北", "E": "东", "SE": "东南", "S": "南", "SW": "西南", "W": "西", "NW": "西北" };
    var en = I && I.getLang() === "en";
    for (var i = 0; i < comp.length; i++) {
      var src = comp[i].getAttribute("data-sx-src") || comp[i].textContent;
      comp[i].setAttribute("data-sx-src", src);
      var map = en ? cardEn : cardZh;
      var val = map[src.trim()];
      if (val) comp[i].textContent = val;
    }
  }

  function translateObjective(s) {
    if (!s) return s;
    var m = /^切断剩余\s*(\d+)\s*处中继$/.exec(s);
    if (m) return t("ui2.obj.remain", { n: m[1] });
    m = /^坚守撤离窗口\s*·\s*(\d+)\s*秒$/.exec(s);
    if (m) return t("ui2.obj.hold", { n: m[1] });
    if (s === "据点争夺 · 控制 A / B / C") return t("ui2.mp.domGoal");
    if (s === "摧毁港区主控核心") return t("ui2.obj.boss");
    if (s === "摧毁核心") return t("ui2.obj.boss2");
    return trText(s);
  }

  /* 说话人映射：中英文名都能归类，英文名走小写归一化 */
  var speakerMap = {
    "指挥中心": "command", "小队频道": "squad", "舵手": "pilot", "蜃": "shen", "敌方信号": "enemy", "港区主控": "core",
    "command": "command", "command center": "command", "squad": "squad", "squad channel": "squad",
    "pilot": "pilot", "helm": "pilot", "shen": "shen", "hostile": "enemy", "hostile signal": "enemy",
    "enemy": "enemy", "port core": "core", "core": "core"
  };
  function speakerClass(name) {
    if (!name) return null;
    var s = String(name).trim();
    if (speakerMap[s]) return speakerMap[s];
    return speakerMap[s.toLowerCase()] || null;
  }
  /* 新文本优先：只有当前 textContent 仍是我们上次写入的本地化值时，
     才用 data-sx-src 作为原文；否则说明游戏刚写入了新的说话人，以 DOM 为准并刷新属性。 */
  function localizeComms() {
    var comms = document.querySelector(".comms");
    var who = document.querySelector(".comms-who");
    if (!comms || !who) return;
    var cur = (who.textContent || "").trim();
    var src = who.getAttribute("data-sx-src");
    if (!src || (cur && cur !== who.__sxApplied)) src = cur;
    if (!src) return;
    if (who.getAttribute("data-sx-src") !== src) who.setAttribute("data-sx-src", src);
    var cls = speakerClass(src) || "command";
    if (comms.getAttribute("data-speaker") !== cls) comms.setAttribute("data-speaker", cls);
    var tr = t("ui2.speaker." + cls);
    if (who.textContent !== tr) who.textContent = tr;
    who.__sxApplied = tr;
  }

  /* ------------------------------------------------------- 观察器 / 节流 */
  var OBS_SELECTOR = ".menu, .comms-who, .x-camp, .x-brief, .x-archive, .x-interlude, .x-armory, .x-progress, .x-ach, .x-mp";
  var observedNodes = [], observing = false;
  function observeOptions(node) {
    if (node.classList && node.classList.contains("comms-who")) {
      return { childList: true, characterData: true, subtree: true };
    }
    /* 成就浮层内容由 ext_progress 一次性写入，观察子节点即可；
       联机面板每帧都在刷比分，只观察 class，避免整局每 150ms 全量重绘。 */
    if (node.classList && node.classList.contains("x-ach")) return { childList: true, subtree: true };
    if (node.classList && node.classList.contains("x-mp")) return { attributes: true, attributeFilter: ["class"] };
    return { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-screen", "hidden"] };
  }
  /* 覆盖层（简报 / 档案 / 过场 / 军械库 / 成就 / 联机）建在 #ui 下、不在 .menu 里，
     旧实现只观察 .menu，切语言后打开覆盖层不会触发重绘，内容回落中文。 */
  function observeNodes() {
    if (!mo) return;
    var nodes;
    try { nodes = document.querySelectorAll(OBS_SELECTOR); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.__sxObs) continue;
      try { mo.observe(n, observeOptions(n)); } catch (e) { continue; }
      n.__sxObs = true;
      observedNodes.push(n);
    }
    observing = true;
  }
  function suspendObserver() {
    if (!mo) { observing = false; return; }
    try { mo.disconnect(); } catch (e) {}
    for (var i = 0; i < observedNodes.length; i++) observedNodes[i].__sxObs = false;
    observedNodes.length = 0;
    observing = false;
  }
  function resumeObserver() {
    if (!mo) return;
    observeNodes();
  }

  /* --------------------------------------------------- 覆盖层补充本地化 */
  function setText(el, v) { if (el && el.textContent !== v) el.textContent = v; }
  function campMissions() {
    try { var c = window.__SX_CAMP; if (c && c.missions && c.missions.length) return c.missions; } catch (e) {}
    return [];
  }
  function campIndex() {
    try { var c = window.__SX_CAMP; if (c && typeof c.index === "function") return c.index(); } catch (e) {}
    return 0;
  }
  /* 记录中文原文：若 DOM 已被游戏重写（当前值不等于我们上次渲染的值），以新内容为准，
     避免用陈旧原文覆盖新文本。 */
  function zhSource(el) {
    if (!el) return "";
    var cur = el.textContent;
    if (el.__sxZh == null || (cur && cur !== el.__sxRendered)) el.__sxZh = cur;
    return el.__sxZh || "";
  }
  function renderZh(el, value) {
    if (!el) return;
    if (el.textContent !== value) el.textContent = value;
    el.__sxRendered = value;
  }

  /* 结算挑战行：文案由 campaign.js 以中文写死，按关卡键重新渲染（中英双向稳定） */
  function localizeChallengeNote() {
    var note = document.querySelector(".m-debrief .x-chal") || document.querySelector(".x-chal");
    if (!note) return;
    var missions = campMissions(), m = missions[campIndex()];
    if (!m) return;
    var ch = m.challenges || {};
    var keys = ["time", "head", "clean"];
    var iv = note.querySelectorAll("i");
    for (var i = 0; i < iv.length && i < keys.length; i++) {
      var key = "mission." + m.id + ".chal." + keys[i];
      if (!I || !I.has(key)) continue;
      var ok = iv[i].classList.contains("ok");
      var v = (ok ? "✓ " : "○ ") + t(key, { time: fmtTime(ch.time), n: ch.head });
      if (iv[i].textContent !== v) iv[i].textContent = v;
    }
    setText(note.querySelector("b"), t("ui2.camp.challenge", { n: note.querySelectorAll("i.ok").length }));
    var ems = note.querySelectorAll("em");
    for (var j = 0; j < ems.length; j++) {
      var src = zhSource(ems[j]), out = src;
      var mm = /^新完成[：:]\s*(.+)$/.exec(src);
      if (mm) {
        var names = mm[1].split(/\s*\/\s*/).map(function (nm) {
          var k = { "限时": "ui2.chal.name.time", "爆头": "ui2.chal.name.head", "无死亡": "ui2.chal.name.clean" }[nm.trim()];
          return k ? t(k) : nm;
        });
        out = t("ui2.chal.new", { names: names.join(" / ") });
      } else {
        var mu = /^解锁[：:]\s*(.+)$/.exec(src);
        if (mu) {
          var k2 = { "金色准星": "ui2.chal.unlock.gold", "红色准星": "ui2.chal.unlock.red", "绿色准星": "ui2.chal.unlock.green" }[mu[1].trim()];
          if (k2) out = t(k2);
        }
      }
      renderZh(ems[j], out);
    }
  }

  /* 军械库：只翻译界面骨架与状态词，配件名/描述属于数据内容，保持原样 */
  function localizeArmory() {
    var arm = document.querySelector(".x-armory");
    if (!arm) return;
    setText(arm.querySelector(".x-ar-panel .m-k"), t("ui2.armory.kicker"));
    setText(arm.querySelector(".x-ar-panel h2"), t("ui2.armory.title"));
    var bal = arm.querySelector(".x-ar-balance");
    if (bal) {
      var num = bal.querySelector("b");
      var v0 = num ? num.textContent : "0";
      var label = t("ui2.armory.credits");
      if ((bal.textContent || "").replace(/\s+/g, "") !== (label + v0).replace(/\s+/g, "")) {
        bal.innerHTML = label + ' <b data-x-balance>' + v0 + "</b>";
      }
    }
    var act = arm.querySelectorAll(".x-ar-actions .btn");
    if (act[0]) setText(act[0], t("ui2.armory.back"));
    if (act[1]) setText(act[1], t("ui2.armory.reset"));
    var statKeys = ["damage", "rpm", "mag", "reload", "recoil", "spread", "fov"];
    var spans = arm.querySelectorAll(".x-ar-stat span");
    for (var i = 0; i < spans.length && i < statKeys.length; i++) setText(spans[i], t("ui2.armory.stat." + statKeys[i]));
    var prices = arm.querySelectorAll(".x-ar-opt em.x-ar-price");
    for (var j = 0; j < prices.length; j++) {
      var src = zhSource(prices[j]);
      var mv = /^(\d+)\s*信用点$/.exec(src);
      renderZh(prices[j], src === "已拥有" ? t("ui2.armory.owned") : mv ? t("ui2.armory.price", { n: mv[1] }) : src);
    }
    var locks = arm.querySelectorAll(".x-ar-opt i.x-ar-lock");
    for (var k = 0; k < locks.length; k++) setText(locks[k], t("ui2.armory.lock"));
    var titled = arm.querySelectorAll(".x-ar-opt[title]");
    for (var q = 0; q < titled.length; q++) {
      var ttl = titled[q].getAttribute("title") || "";
      var mt = /^未解锁\s*·\s*(\d+)\s*信用点$/.exec(ttl);
      var want = mt ? t("ui2.armory.lockedHint", { n: mt[1] }) : ttl;
      if (want !== ttl) titled[q].setAttribute("title", want);
    }
  }

  /* 设置页动态注记：game.js 用中文模板拼接（带设备画质），整串无法命中词典，单独按模板重绘 */
  function localizeSettingsNotes(panel) {
    if (!panel) return;
    var qn = panel.querySelector('[data-f="qnote"]');
    if (!qn) return;
    var src = zhSource(qn), out = src;
    var m = /^已根据设备自动选择画质（([^）]+)）/.exec(src);
    if (m) {
      var qmap = { "低": "ui2.opt.low", "中": "ui2.opt.medium", "高": "ui2.opt.high", "极高": "ui2.opt.ultra", "默认": "ui2.settings.quality" };
      var qk = qmap[m[1].trim()];
      out = t("ui2.settings.quality.autoNote", { q: qk ? t(qk) : m[1].trim() });
    } else if (/^画质设置立即生效/.test(src)) {
      out = t("ui2.settings.quality.manualNote");
    }
    renderZh(qn, out);
  }

  /* 联机面板（据点争夺）：模式下拉与副标题按值重绘 */
  function localizeMP() {
    var mp = document.querySelector(".x-mp");
    if (!mp) return;
    var modes = mp.querySelectorAll("[data-mp-mode] option");
    var map = { tdm: "ui2.mp.mode.tdm", chaos: "ui2.mp.mode.chaos", domination: "ui2.mp.mode.domination", bomb: "ui2.mp.mode.bomb", coop: "ui2.mp.mode.coop" };
    for (var i = 0; i < modes.length; i++) {
      var k = map[(modes[i].value || "").trim()];
      if (k && I && I.has(k)) setText(modes[i], t(k));
    }
    var sub = mp.querySelector(".x-mp-sub");
    if (!sub) return;
    var src = zhSource(sub);
    var zhSub = I && I.dict && I.dict["zh-CN"] ? I.dict["zh-CN"]["ui2.mp.sub"] : null;
    if (zhSub && src === zhSub) renderZh(sub, t("ui2.mp.sub"));
    else if (src !== sub.__sxRendered) renderZh(sub, src);
  }

  /* 成就浮层：.x-ach 由 ext_progress 以中文写入，按 id 反查键重绘 */
  var ACH_BY_ZH = null;
  function buildAchIndex() {
    ACH_BY_ZH = {};
    if (!I || !I.dict) return;
    var zh = I.dict["zh-CN"] || {};
    for (var k in zh) {
      if (!Object.prototype.hasOwnProperty.call(zh, k)) continue;
      if (!/^ui2\.ach\.[^.]+\.[a-z]+$/.test(k)) continue;
      if (k.slice(-5) !== ".name") continue;
      ACH_BY_ZH[zh[k]] = k.slice(8, -5);
    }
  }
  function localizeAchievements() {
    var items = document.querySelectorAll(".x-ach .i");
    if (!items.length) return;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var nEl = it.querySelector(".n"), dEl = it.querySelector(".d"), kEl = it.querySelector(".k");
      var cur = nEl ? nEl.textContent : "";
      if (it.__sxZhName == null || (cur && cur !== it.__sxRenderedName)) {
        it.__sxZhName = cur;
        if (ACH_BY_ZH && ACH_BY_ZH[cur]) it.__sxAchId = ACH_BY_ZH[cur];
      }
      if (kEl) {
        var ksrc = zhSource(kEl);
        if (/大师/.test(ksrc)) it.__sxMaster = true;
        else if (/成就解锁/.test(ksrc)) it.__sxMaster = false;
        renderZh(kEl, t(it.__sxMaster ? "ui2.ach.unlocked.master" : "ui2.ach.unlocked"));
      }
      var id = it.__sxAchId;
      if (!id) continue;
      if (nEl) {
        var nv = t("ui2.ach." + id + ".name");
        if (nEl.textContent !== nv) nEl.textContent = nv;
        it.__sxRenderedName = nv;
      }
      if (dEl) setText(dEl, t("ui2.ach." + id + ".desc"));
    }
  }

  /* ------------------------------------------------------------ screen pass */
  var refreshCount = 0, lastRefreshAt = 0;
  function refresh() {
    if (!I || applying) return;
    applying = true;
    refreshCount++;
    try {
      var menu = document.querySelector(".menu");
      if (menu) {
        localizeTitle();
        localizeMenu();
        tagTextNodes(menu);
      }
      var overlays = document.querySelectorAll(".x-camp, .x-brief, .x-archive, .x-interlude, .x-armory, .x-progress, .x-ach, .x-mp");
      for (var i = 0; i < overlays.length; i++) tagTextNodes(overlays[i]);
      localizeCampaign();
      localizeArmory();
      localizeMP();
      localizeAchievements();
      localizeChallengeNote();
      localizeEnding();
      localizeComms();
      applyTracked();
      applyDomI18n();
      applyHudLabels();
      localizeChoices();
      buildSettings();
      if (UI) { tagTextNodes(UI); applyDomI18n(UI); updateControls(); }
      patchHud();
      if (observing) observeNodes();
    } catch (e) {
      try { console.error("[sx-ui2] refresh", e); } catch (err) {}
    }
    applying = false;
    lastRefreshAt = Date.now();
    if (mo && observing) { try { mo.takeRecords(); } catch (e) {} }
  }

  /* 至少 120ms 合并一次：旧实现用 requestAnimationFrame（约 16ms）全量重绘，
     配合打字机 26ms 一次的 DOM 写入会形成 refresh 风暴。 */
  var MIN_REFRESH_GAP = 150, scheduleTimer = null, lastRefreshStart = 0;
  function schedule() {
    if (scheduleTimer) return;
    var wait = Math.max(120, MIN_REFRESH_GAP - (Date.now() - lastRefreshStart));
    scheduleTimer = setTimeout(function () {
      scheduleTimer = null;
      lastRefreshStart = Date.now();
      refresh();
    }, wait);
  }

  function setLang(lang) {
    if (!I) return;
    I.setLang(lang);
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    if (lastRadio) {
      try {
        if (document.querySelector(".comms.on")) {
          G.hud.clearRadio();
          G.hud.radio(lastRadio.src, lastRadio.secs);
        }
      } catch (e) {}
    }
    if (lastObjective) {
      try { G.hud.setObjective(lastObjective); } catch (e) {}
    }
    if (lastPrompt) {
      try { G.hud.setPrompt(lastPrompt.label, lastPrompt.prog); } catch (e) {}
    }
    refresh();
    try {
      if (G && G.events) G.events.emit("sx:lang", { lang: lang });
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- keyboard */
  function isOpen(el) { return !!(el && el.classList && el.classList.contains("on")); }
  function visibleButtons(root) {
    if (!root) return [];
    var out = [];
    var list = root.querySelectorAll("button, [href], input[type=range]");
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.disabled) continue;
      if (b.offsetParent === null && getComputedStyle(b).position !== "fixed") continue;
      out.push(b);
    }
    return out;
  }
  function activeMenuRoot() {
    var layers = [".x-interlude", ".x-archive", ".x-brief", ".x-camp"];
    for (var i = 0; i < layers.length; i++) {
      var el = document.querySelector(layers[i]);
      if (isOpen(el)) return el;
    }
    var menu = document.querySelector(".menu.open");
    return menu || null;
  }
  function keyboardNav(e) {
    if (!e || (e.code !== "ArrowDown" && e.code !== "ArrowUp" && e.code !== "ArrowLeft" && e.code !== "ArrowRight")) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    var root = activeMenuRoot();
    if (!root) return;
    var panel = root.querySelector ? root.querySelector(".panel") : null;
    var scope = panel && !panel.hidden ? panel : root;
    var list = visibleButtons(scope);
    if (!list.length) return;
    var cur = document.activeElement;
    var idx = list.indexOf(cur);
    var step = e.code === "ArrowDown" || e.code === "ArrowRight" ? 1 : -1;
    if (idx < 0) idx = step > 0 ? -1 : 0;
    var next = list[(idx + step + list.length) % list.length];
    if (next) {
      if (next.focus) next.focus({ preventScroll: false });
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function enterConfirm(e) {
    if (!e || e.code !== "Enter") return;
    var root = activeMenuRoot();
    if (!root) return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === "BUTTON" || ae.tagName === "INPUT")) return; /* 原生行为 */
    var panel = root.querySelector(".panel");
    var list = visibleButtons(panel && !panel.hidden ? panel : root);
    if (list.length) { list[0].focus(); e.preventDefault(); }
  }

  function setColorblind(v) {
    state.colorblind = v === "rg" || v === "by" ? v : "none";
    applyState();
    saveState();
    try { refresh(); } catch (e) {}
    return state.colorblind;
  }
  function setAccess(patch) {
    if (!patch || typeof patch !== "object") return state;
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (k === "hud" && patch.hud && typeof patch.hud === "object") {
        for (var h in patch.hud) if (Object.prototype.hasOwnProperty.call(patch.hud, h)) state.hud[h] = !!patch.hud[h];
      } else if (k === "colorblind" || k === "textScale" || k === "subBg" || k === "safe" || k === "hudOpacity") {
        state[k] = patch[k];
      }
    }
    applyState();
    saveState();
    try { refresh(); } catch (e) {}
    return state;
  }
  function exposeAPI() {
    window.__SX_UI2 = {
      version: VERSION,
      state: function () { return JSON.parse(JSON.stringify(state)); },
      setColorblind: setColorblind,
      setAccess: setAccess,
      setLang: setLang,
      refresh: function () { try { refresh(); } catch (e) {} },
      /* 性能计数器（V38）：供测试与调试读取 refresh 频率 / 打字机状态 */
      stats: function () {
        return {
          refresh: refreshCount,
          lastRefreshAt: lastRefreshAt,
          typing: !!typingBox,
          observing: observing,
          scheduled: !!scheduleTimer
        };
      },
      missing: function () {
        try { return window.__SX_LANG && window.__SX_LANG.missing ? window.__SX_LANG.missing() : []; } catch (e) { return []; }
      }
    };
  }

  /* -------------------------------------------------------------------- boot */
  function start() {
    if (booted) return;
    I = window.SXI18n;
    G = window.__G;
    if (!window.__SX_I18N_EXTRA) {
      try { console.warn("[sx-ui2] i18n_extra 未加载，保持原语言"); } catch (e) {}
      try { exposeAPI(); } catch (e) {}
      return;
    }
    booted = true;
    if (window.__SX_I18N_EXTRA && window.__SX_I18N_EXTRA.mount) {
      try { window.__SX_I18N_EXTRA.mount(); } catch (e) {}
    }
    loadState();
    buildReverse();
    buildAchIndex();
    injectCSS();
    patchStorage();
    applyState();
    try { document.documentElement.lang = I.getLang() === "en" ? "en" : "zh-CN"; } catch (e) {}
    buildSettings();

    mo = new MutationObserver(function (records) { if (!records || !records.length) return; schedule(); });
    /* 观察菜单 + 字幕 + 所有覆盖层（简报 / 档案 / 过场 / 军械库 / 成就 / 联机）：
       它们建在 #ui 下，切语言后打开时不会经过 .menu 的变更，必须单独观察才能触发重绘。 */
    observeNodes();
    document.addEventListener("keydown", keyboardNav, true);
    document.addEventListener("keydown", enterConfirm, true);

    window.__SX_LANG = {
      set: setLang,
      get: function () { return I ? I.getLang() : "zh-CN"; },
      t: t,
      missing: missingKeys,
      apply: refresh,
      state: function () { return JSON.parse(JSON.stringify(state)); }
    };

    try { exposeAPI(); } catch (e) {}
    refresh();
    setTimeout(refresh, 400);
    setTimeout(refresh, 1500);
    try { console.log("[ext] " + VERSION + " 界面与本地化已加载"); } catch (e) {}
  }

  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      var ready = window.SXI18n && window.__G && window.__G.game && window.__G.game.menus && document.querySelector(".m-title");
      if (ready) {
        clearInterval(iv);
        if (window.__SX_I18N_EXTRA) start();
        else {
          var s = document.createElement("script");
          s.src = "src/i18n_extra.js";
          s.onload = function () { start(); };
          s.onerror = function () { start(); };
          document.head.appendChild(s);
        }
      } else if (++tries > 900) clearInterval(iv);
    }, 100);
  }
  wait();
})();
