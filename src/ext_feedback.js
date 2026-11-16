/* =====================================================================
   SALTLINE — V33 · WP33-5 命中反馈分层
   独立 IIFE，只通过 window.__G 工作；不改 ext.js / game.js。
   通道：
     · 准星标记：普通白 / 爆头金 / 击杀红扩散 / 护甲蓝
     · 伤害数字：世界坐标投影，上浮 0.7s 渐隐，同目标 80ms 合并
     · 击杀播报：武器名 + 距离 + 爆头标记，连杀 2/3/4/5
     · 受击方向：屏幕边缘红色弧，0.8s 渐隐（联机禁用自绘）
     · 低血量：<35 时屏缘暗红心跳脉冲（reduce-motion 关闭）
     · 设置：saltline.feedback.v1 {numbers, arcs}，F9 切换伤害数字
   调试：window.__SX_FEEDBACK = { state(), hit(kind, opts), toggleNumbers() }
   ===================================================================== */
(function () {
  "use strict";

  var G = null;
  var booted = false;
  var LAYER = null;
  var PARTS = {};
  var HIT_KEY = "saltline.feedback.v1";
  var ACCESS_KEY = "saltline.access.v1";
  var state = { numbers: true, arcs: true };
  var lowOn = false;
  var seq = 0;
  var kills = 0;
  var lastKillInfo = null;
  var lastImpact = null;
  var lastDmg = null;

  try { lastDmg = new WeakMap(); } catch (e) { lastDmg = null; }

  /* ------------------------------------------------------------ utils */
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function safe(fn, arg) { try { return fn(arg); } catch (e) { return null; } }

  function loadFeedback() {
    try {
      var raw = JSON.parse(localStorage.getItem(HIT_KEY) || "null");
      if (raw && typeof raw === "object") {
        if (typeof raw.numbers === "boolean") state.numbers = raw.numbers;
        if (typeof raw.arcs === "boolean") state.arcs = raw.arcs;
      }
    } catch (e) {}
  }
  function saveFeedback() {
    try { localStorage.setItem(HIT_KEY, JSON.stringify({ numbers: !!state.numbers, arcs: !!state.arcs })); } catch (e) {}
  }
  function reduceMotion() {
    try {
      if (document.body && document.body.classList.contains("reduce-motion")) return true;
      var raw = JSON.parse(localStorage.getItem(ACCESS_KEY) || "null");
      return !!(raw && raw.reduceMotion);
    } catch (e) { return false; }
  }
  function mpActive() {
    try { return !!(window.__MP && window.__MP.state && window.__MP.state().active); } catch (e) { return false; }
  }
  function weaponName() {
    try {
      var w = G.weapon;
      if (!w) return "几式";
      var i = w.activeIndex || 0;
      var a = w.list && w.list[i];
      if (a && (a.short || a.name)) return a.short || a.name;
      if (w.short) return w.short;
      if (w.name) return w.name;
    } catch (e) {}
    return "几式";
  }

  /* -------------------------------------------------------------- CSS */
  function injectCSS() {
    if (document.getElementById("xf-css")) return;
    var css = document.createElement("style");
    css.id = "xf-css";
    css.textContent = [
      "/* ---- V33 hit feedback layers ---- */",
      ".xf-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;font-family:var(--f-label),system-ui,sans-serif;}",
      ".xf-layer>div{position:absolute;inset:0;pointer-events:none;}",
      ".xf-hit{position:absolute;left:50%;top:50%;width:26px;height:26px;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity;}",
      ".xf-hit i{position:absolute;width:2px;height:9px;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.65);}",
      ".xf-hit i:nth-child(1){left:3px;top:1px;transform:rotate(-45deg);}",
      ".xf-hit i:nth-child(2){right:3px;top:1px;transform:rotate(45deg);}",
      ".xf-hit i:nth-child(3){left:3px;bottom:1px;transform:rotate(45deg);}",
      ".xf-hit i:nth-child(4){right:3px;bottom:1px;transform:rotate(-45deg);}",
      ".xf-hit--head{width:34px;height:34px;}",
      ".xf-hit--head i{width:2.5px;height:12px;background:#ffd166;box-shadow:0 0 6px rgba(255,209,102,.6);}",
      ".xf-hit--head .xf-dia{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;background:#ffd166;transform:rotate(45deg);box-shadow:0 0 7px rgba(255,209,102,.8);}",
      ".xf-hit--kill{width:42px;height:42px;}",
      ".xf-hit--kill i{width:3px;height:14px;background:#ff4a3d;box-shadow:0 0 8px rgba(255,60,40,.8);}",
      ".xf-hit--kill .xf-ring{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #ff4a3d;border-radius:50%;box-shadow:0 0 10px rgba(255,60,40,.75);}",
      ".xf-hit--armor{width:32px;height:32px;}",
      ".xf-hit--armor i{width:2.5px;height:11px;background:#8fd8ff;box-shadow:0 0 7px rgba(143,216,255,.8);}",
      ".xf-hit--armor .xf-ring{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;border:2px solid rgba(143,216,255,.85);border-radius:50%;}",
      ".xf-dmg{position:absolute;transform:translate(-50%,-50%);font:700 18px/1 var(--f-display),system-ui,sans-serif;letter-spacing:.02em;color:#fff;text-shadow:0 2px 5px rgba(0,0,0,.85),0 0 12px rgba(0,0,0,.4);white-space:nowrap;opacity:0;will-change:transform,opacity;}",
      ".xf-dmg--head{color:#ffd166;font-size:21px;text-shadow:0 2px 6px rgba(0,0,0,.85),0 0 14px rgba(255,209,102,.45);}",
      ".xf-dmg--kill{color:#ff4a3d;font-size:22px;text-shadow:0 2px 6px rgba(0,0,0,.85),0 0 16px rgba(255,60,40,.55);}",
      ".xf-kill{position:absolute;left:50%;top:calc(50% + 44px);transform:translate(-50%,0);display:flex;align-items:center;gap:9px;padding:6px 13px 5px;background:rgba(10,12,14,.78);border-left:2px solid #ff4a3d;color:#e8e4da;white-space:nowrap;opacity:0;will-change:transform,opacity;text-shadow:var(--shadow);}",
      ".xf-kill b{font:700 12px/1 var(--f-display);letter-spacing:.08em;color:#ff8d7f;}",
      ".xf-kill span{font:600 11px/1 var(--f-mono);letter-spacing:.06em;color:rgba(232,228,218,.82);}",
      ".xf-kill em{font:700 10px/1 var(--f-label);font-style:normal;letter-spacing:.16em;color:#ffd166;border:1px solid rgba(255,209,102,.5);padding:3px 5px 2px;}",
      ".xf-streak{position:absolute;left:50%;top:31%;transform:translate(-50%,0);font:900 30px/1 var(--f-display);letter-spacing:.2em;color:#ffd166;text-shadow:0 0 18px rgba(255,150,60,.5),0 2px 8px rgba(0,0,0,.8);opacity:0;will-change:transform,opacity;}",
      ".xf-arcs .xf-arc{position:absolute;left:50%;top:50%;width:min(68vh,92vw);aspect-ratio:1;transform:translate(-50%,-50%);opacity:0;will-change:transform,opacity;}",
      ".xf-arc svg{width:100%;height:100%;display:block;overflow:visible;}",
      ".xf-arc path{fill:none;stroke:#ff3b30;stroke-width:4.5;stroke-linecap:round;opacity:.92;}",
      ".xf-arc path.tip{stroke-width:2.5;}",
      ".xf-armor-flash{position:absolute;inset:0;opacity:0;box-shadow:inset 0 0 90px 14px rgba(143,216,255,.72),inset 0 0 24px 4px rgba(220,244,255,.5);will-change:opacity;}",
      ".xf-lowhp{position:absolute;inset:0;opacity:0;transition:opacity .35s;background:radial-gradient(ellipse at center,rgba(120,0,0,0) 48%,rgba(120,4,4,.34) 82%,rgba(90,0,0,.55) 100%);}",
      ".xf-lowhp.on{opacity:1;}",
      ".xf-lowhp i{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(150,0,0,0) 58%,rgba(150,0,0,.28) 100%);opacity:.35;animation:xf-heartbeat .8s ease-in-out infinite;}",
      "@keyframes xf-heartbeat{0%,100%{opacity:.28;}42%{opacity:.78;}60%{opacity:.42;}78%{opacity:.62;}}",
      "body.reduce-motion .xf-lowhp,body.reduce-motion .xf-lowhp i{display:none;animation:none;}",
      "body.reduce-motion .xf-ring{animation:none !important;}",
      "@media (max-height:520px){.xf-kill{top:calc(50% + 34px);}.xf-streak{top:26%;font-size:24px;}}"
    ].join("\n");
    document.head.appendChild(css);
  }

  /* --------------------------------------------------------- DOM tree */
  function buildLayer() {
    var root = G.hud && G.hud.root;
    if (!root) return false;
    if (LAYER && LAYER.parentNode === root) return true;
    LAYER = document.createElement("div");
    LAYER.className = "xf-layer";
    LAYER.id = "xf-layer";
    LAYER.setAttribute("aria-hidden", "true");
    PARTS.hits = document.createElement("div");
    PARTS.hits.className = "xf-hitmarks";
    PARTS.nums = document.createElement("div");
    PARTS.nums.className = "xf-numbers";
    PARTS.arcs = document.createElement("div");
    PARTS.arcs.className = "xf-arcs";
    PARTS.banners = document.createElement("div");
    PARTS.banners.className = "xf-banners";
    PARTS.low = document.createElement("div");
    PARTS.low.className = "xf-lowhp";
    var lowPulse = document.createElement("i");
    PARTS.low.appendChild(lowPulse);
    LAYER.appendChild(PARTS.hits);
    LAYER.appendChild(PARTS.nums);
    LAYER.appendChild(PARTS.arcs);
    LAYER.appendChild(PARTS.banners);
    LAYER.appendChild(PARTS.low);
    root.appendChild(LAYER);
    return true;
  }

  function removeLater(el, ms) {
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, ms);
  }

  function animate(el, frames, duration, done, easing) {
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      if (done) done();
    };
    try {
      var a = el.animate(frames, { duration: duration, easing: easing || "ease-out", fill: "forwards" });
      a.onfinish = finish;
      a.oncancel = finish;
      setTimeout(finish, duration + 60);
      return a;
    } catch (e) {
      setTimeout(finish, duration);
      return null;
    }
  }

  /* -------------------------------------------------------- hit marks */
  var hitLive = 0;
  function spawnHit(kind) {
    if (!PARTS.hits) return null;
    var el = document.createElement("div");
    el.className = "xf-hit xf-hit--" + kind;
    el.setAttribute("data-kind", kind);
    var html = "";
    for (var i = 0; i < 4; i++) html += "<i></i>";
    if (kind === "head") html += '<b class="xf-dia"></b>';
    if (kind === "kill" || kind === "armor") html += '<b class="xf-ring"></b>';
    el.innerHTML = html;
    PARTS.hits.appendChild(el);
    hitLive++;
    // 上限保护：极端射速下不无限堆 DOM
    while (PARTS.hits.children.length > 18) PARTS.hits.removeChild(PARTS.hits.firstChild);
    var dur = kind === "kill" ? 300 : kind === "head" ? 260 : 200;
    var startScale = kind === "kill" ? 1.45 : kind === "head" ? 1.3 : 1.12;
    el.style.opacity = "1";
    animate(el, [
      { transform: "translate(-50%,-50%) scale(" + startScale + ")", opacity: 1 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.38 },
      { transform: "translate(-50%,-50%) scale(0.94)", opacity: 0 }
    ], dur, function () {
      hitLive = Math.max(0, hitLive - 1);
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    if (kind === "kill" || kind === "head") {
      var ring = el.querySelector(".xf-ring");
      if (ring) {
        try {
          ring.animate([
            { transform: "scale(.55)", opacity: 0.95 },
            { transform: "scale(2.35)", opacity: 0 }
          ], { duration: 420, easing: "ease-out" });
        } catch (e) {}
      }
    }
    // 音效：普通轻、爆头清脆、击杀重、护甲金属
    var sfx = {
      body: ["impact_metal", 0.42, 1.45],
      head: ["impact_metal", 0.62, 2.25],
      kill: ["impact_enemy", 0.8, 0.62],
      armor: ["impact_metal", 0.36, 2.6]
    }[kind];
    if (sfx) safe(function () { G.audio.play(sfx[0], { gain: sfx[1], pitch: sfx[2] }); });
    if (kind === "kill") safe(function () { G.audio.play("hurt", { gain: 0.32, pitch: 0.72 }); });
    if (kind === "head") safe(function () { G.audio.play("ui_click", { gain: 0.16, pitch: 2.1 }); });
    return el;
  }

  /* --------------------------------------------------- damage numbers */
  var numEntries = [];
  function project(point) {
    try {
      var cam = G.camera;
      if (!cam || !point) return null;
      var v = point.clone().project(cam);
      if (!isFinite(v.x) || !isFinite(v.y)) return null;
      var x = (v.x * 0.5 + 0.5) * (window.innerWidth || 960);
      var y = (-v.y * 0.5 + 0.5) * (window.innerHeight || 540);
      return { x: clamp(x, 26, (window.innerWidth || 960) - 26), y: clamp(y, 40, (window.innerHeight || 540) - 40), behind: v.z > 1 };
    } catch (e) { return null; }
  }
  function spawnNumber(screen, amount, kind) {
    if (!PARTS.nums || !state.numbers) return null;
    var el = document.createElement("div");
    el.className = "xf-dmg xf-dmg--" + kind;
    el.setAttribute("data-kind", kind);
    el.textContent = String(Math.max(0, Math.round(amount)));
    el.style.left = screen.x + "px";
    el.style.top = screen.y + "px";
    el.style.opacity = "1";
    PARTS.nums.appendChild(el);
    animate(el, [
      { transform: "translate(-50%,-50%) translateY(0)", opacity: 1 },
      { transform: "translate(-50%,-50%) translateY(-34px)", opacity: 0 }
    ], 700, function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      for (var i = numEntries.length - 1; i >= 0; i--) if (numEntries[i].el === el) numEntries.splice(i, 1);
    });
    removeLater(el, 760);
    return el;
  }
  function damageNumber(point, amount, kind, key) {
    if (!state.numbers) return null;
    var now = performance.now();
    // 同一目标 80ms 内合并；没有目标标识时每次独立
    if (key) {
      for (var i = 0; i < numEntries.length; i++) {
        var en = numEntries[i];
        if (en.key === key && now - en.t < 80 && en.el.parentNode) {
          en.value += amount;
          en.t = now;
          en.el.textContent = String(Math.max(0, Math.round(en.value)));
          try { en.el.animate([{ transform: "translate(-50%,-50%) scale(1.22)" }, { transform: "translate(-50%,-50%) scale(1)" }], { duration: 90 }); } catch (e) {}
          return en.el;
        }
      }
    }
    var screen = project(point) || { x: (window.innerWidth || 960) / 2 + 16, y: (window.innerHeight || 540) / 2 - 18 };
    var el = spawnNumber(screen, amount, kind);
    if (el) numEntries.push({ key: key, el: el, value: amount, t: now });
    return el;
  }

  /* ------------------------------------------------------ kill banner */
  function showKill(info) {
    if (!PARTS.banners) return null;
    var el = document.createElement("div");
    el.className = "xf-kill";
    el.setAttribute("data-kind", "kill");
    var parts = [];
    parts.push('<b class="xf-kill-w">' + esc(info.weapon || weaponName()) + "</b>");
    if (info.distance != null) parts.push('<span class="xf-kill-d">' + esc(String(Math.round(info.distance))) + "m</span>");
    else parts.push('<span class="xf-kill-d">—</span>');
    if (info.headshot) parts.push('<em class="xf-kill-hs">爆头</em>');
    el.innerHTML = parts.join("");
    PARTS.banners.appendChild(el);
    el.style.opacity = "1";
    animate(el, [
      { transform: "translate(-50%,6px)", opacity: 0 },
      { transform: "translate(-50%,0)", opacity: 1, offset: 0.18 },
      { transform: "translate(-50%,-4px)", opacity: 0 }
    ], 1800, function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    removeLater(el, 1880);
    return el;
  }

  /* ---------------------------------------------------------- streaks */
  var streakCount = 0;
  var streakT = 0;
  var STREAK = { 2: "双杀", 3: "三杀", 4: "四杀", 5: "五杀" };
  function bumpStreak() {
    var now = performance.now();
    if (now - streakT > 3500) streakCount = 0;
    streakT = now;
    streakCount++;
    var name = STREAK[streakCount];
    if (!name) return null;
    if (!PARTS.banners) return null;
    var el = document.createElement("div");
    el.className = "xf-streak";
    el.setAttribute("data-kind", "streak");
    el.textContent = name + " · 连杀 " + streakCount;
    PARTS.banners.appendChild(el);
    el.style.opacity = "1";
    animate(el, [
      { transform: "translate(-50%,10px) scale(.82)", opacity: 0 },
      { transform: "translate(-50%,0) scale(1.06)", opacity: 1, offset: 0.22 },
      { transform: "translate(-50%,0) scale(1)", opacity: 0 }
    ], 1500, function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    removeLater(el, 1580);
    try { G.audio.play("objective_done", { gain: 0.3, pitch: 1.3 }); } catch (e) {}
    return el;
  }

  /* ------------------------------------------------------- armor flash */
  function armorFlash() {
    if (!LAYER) return;
    var el = document.createElement("div");
    el.className = "xf-armor-flash";
    LAYER.appendChild(el);
    el.style.opacity = "1";
    animate(el, [{ opacity: 0.9 }, { opacity: 0 }], 320, function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    removeLater(el, 380);
  }

  /* ------------------------------------------------------ damage arcs */
  var arcs = [];
  function ensureArcs() {
    if (!PARTS.arcs) return;
    if (arcs.length) return;
    for (var i = 0; i < 4; i++) {
      var el = document.createElement("div");
      el.className = "xf-arc";
      el.innerHTML = '<svg viewBox="-100 -100 200 200"><path d="M -38 -84 A 92 92 0 0 1 38 -84"/><path class="tip" d="M -7 -97 L 0 -106 L 7 -97"/></svg>';
      PARTS.arcs.appendChild(el);
      arcs.push({ el: el, busy: false });
    }
  }
  function showArc(fromPos) {
    if (!state.arcs || mpActive() || !fromPos || !G.player) return null;
    ensureArcs();
    var slot = null;
    for (var i = 0; i < arcs.length; i++) if (!arcs[i].busy) { slot = arcs[i]; break; }
    if (!slot) slot = arcs[0];
    slot.busy = true;
    var p = G.player.pos;
    var ang = Math.atan2(fromPos.x - p.x, -(fromPos.z - p.z)) + (G.player.yaw || 0);
    var deg = Math.round((ang * 180) / Math.PI);
    slot.el.style.transform = "translate(-50%,-50%) rotate(" + deg + "deg)";
    slot.el.classList.add("on");
    slot.el.style.opacity = "1";
    animate(slot.el, [{ opacity: 0.92 }, { opacity: 0 }], 800, function () {
      slot.busy = false;
      slot.el.classList.remove("on");
    }, "ease-in");
    return slot.el;
  }

  /* ---------------------------------------------------------- low HP */
  function updateLowHealth() {
    if (!PARTS.low) return;
    var low = false;
    try {
      var P = G.player;
      low = !!(P && P.alive && P.health < 35 && G.game.state === "playing");
    } catch (e) {}
    if (low && reduceMotion()) low = false;
    if (low !== lowOn) {
      lowOn = low;
      PARTS.low.classList.toggle("on", low);
    }
  }

  /* -------------------------------------------------- enemy damage probe */
  function probeEnemy(en) {
    if (!en || en.__xfProbe || typeof en.damage !== "function") return;
    en.__xfProbe = true;
    var base = en.damage;
    en.damage = function (amount, point, dir, part) {
      var before = typeof en.hp === "number" ? en.hp : null;
      var r = base.apply(en, arguments);
      var after = typeof en.hp === "number" ? en.hp : null;
      var dealt = before != null && after != null ? Math.max(0, before - Math.max(0, after)) : (typeof amount === "number" ? amount : 0);
      try { lastDmg.set(en, dealt); } catch (e) { en.__xfLastDmg = dealt; }
      return r;
    };
  }
  function installProbe() {
    try {
      var list = G.enemies && G.enemies.list;
      if (list) for (var i = 0; i < list.length; i++) probeEnemy(list[i]);
      if (G.enemies && G.enemies.spawn && !G.enemies.__xfSpawnWrapped) {
        G.enemies.__xfSpawnWrapped = true;
        var baseSpawn = G.enemies.spawn;
        G.enemies.spawn = function () {
          var en = baseSpawn.apply(G.enemies, arguments);
          probeEnemy(en);
          return en;
        };
      }
    } catch (e) {}
  }
  function takeDamage(en) {
    if (!en) return 0;
    if (lastDmg) {
      try {
        if (lastDmg.has(en)) {
          var v = lastDmg.get(en);
          lastDmg.delete(en);
          return v;
        }
      } catch (e) {}
    }
    return en.__xfLastDmg || 0;
  }

  /* ------------------------------------------------------- world point */
  function impactPoint() {
    if (!lastImpact) return null;
    if (performance.now() - lastImpact.t > 40) return null;
    return lastImpact.point || null;
  }
  function fallbackPoint() {
    try {
      var cam = G.camera;
      if (!cam) return null;
      var d = new G.THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(8);
      return cam.position.clone().add(d);
    } catch (e) { return null; }
  }

  /* ----------------------------------------------------------- events */
  function onImpact(ev) {
    if (!ev) return;
    lastImpact = { point: ev.point || null, t: performance.now(), enemy: ev.enemy || null };
  }

  function onHitEnemy(ev) {
    if (!ev) return;
    var part = ev.part || (ev.weak ? "weak" : "body");
    var killed = !!ev.killed;
    var weak = !!(ev.weak || part === "weak" || part === "head");
    var kind = killed ? "kill" : weak ? "head" : "body";
    var point = impactPoint() || (ev.enemy && ev.enemy.pos ? ev.enemy.pos : null) || fallbackPoint();
    var amount = typeof ev.damage === "number" ? ev.damage : (typeof ev.amount === "number" ? ev.amount : takeDamage(ev.enemy));
    if (!(amount > 0)) amount = weak ? 62 : 28;

    spawnHit(kind);
    var key = ev.enemy || null;
    damageNumber(point, amount, kind === "kill" ? "kill" : kind, key);

    if (killed) {
      kills++;
      var en = ev.enemy;
      var dist = null;
      if (en && en.pos && G.player) dist = en.pos.distanceTo(G.player.pos);
      lastKillInfo = { weapon: weaponName(), distance: dist, headshot: weak, at: performance.now() };
      showKill(lastKillInfo);
      bumpStreak();
    }
    return kind;
  }

  function onArmor(ev) {
    if (!ev) return;
    spawnHit("armor");
    armorFlash();
    damageNumber(null, ev.amount || 0, "body", "armor");
  }

  function onPlayerHit(ev) {
    if (!ev) return;
    showArc(ev.fromPos || (ev.src && ev.src.pos) || null);
  }

  function onPlayerDead() {
    streakCount = 0;
    streakT = 0;
    if (PARTS.low) { lowOn = false; PARTS.low.classList.remove("on"); }
  }

  function onStreak(ev) {
    // 若其他模块已发 sx:streak，复用其文案
    if (!ev) return;
    var n = ev.count || ev.streak || 0;
    var name = ev.label || STREAK[n];
    if (!name || !PARTS.banners) return;
    var el = document.createElement("div");
    el.className = "xf-streak";
    el.setAttribute("data-kind", "streak");
    el.textContent = name + (n ? " · 连杀 " + n : "");
    PARTS.banners.appendChild(el);
    el.style.opacity = "1";
    animate(el, [
      { transform: "translate(-50%,10px) scale(.82)", opacity: 0 },
      { transform: "translate(-50%,0) scale(1.06)", opacity: 1, offset: 0.22 },
      { transform: "translate(-50%,0) scale(1)", opacity: 0 }
    ], 1500, function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    removeLater(el, 1580);
  }

  /* ------------------------------------------------------------ F9 */
  function toggleNumbers() {
    state.numbers = !state.numbers;
    saveFeedback();
    try { G.hud.message("伤害数字 " + (state.numbers ? "开启" : "关闭"), 1.4); } catch (e) {}
    try { G.events.emit("sx:feedback-settings", { numbers: state.numbers, arcs: state.arcs }); } catch (e) {}
    return state.numbers;
  }
  function onKey(e) {
    if (e.code !== "F9" && e.key !== "F9") return;
    e.preventDefault();
    e.stopPropagation();
    toggleNumbers();
  }

  /* ---------------------------------------------------------- public */
  function hit(kind, opts) {
    opts = opts || {};
    var k = String(kind || "body").toLowerCase();
    if (k === "normal" || k === "hit" || k === "body") k = "body";
    else if (k === "weak" || k === "head" || k === "headshot" || k === "crit") k = "head";
    else if (k === "kill" || k === "killed") k = "kill";
    else if (k === "armor" || k === "shield") k = "armor";
    else k = "body";

    var point = opts.point || fallbackPoint();
    var res = { kind: k, tier: k, damage: opts.damage, marker: null, number: null, banner: null };
    res.marker = spawnHit(k);
    if (k === "armor") armorFlash();
    var dmg = typeof opts.damage === "number" ? opts.damage : k === "head" ? 62 : k === "kill" ? 40 : 28;
    res.damage = dmg;
    var target = opts.target != null ? opts.target : "sx-" + (++seq);
    res.number = damageNumber(point, dmg, k === "kill" ? "kill" : k, target);
    if (k === "kill") {
      var info = {
        weapon: opts.weapon || weaponName(),
        distance: typeof opts.distance === "number" ? opts.distance : null,
        headshot: !!opts.headshot,
        at: performance.now()
      };
      lastKillInfo = info;
      res.banner = showKill(info);
      var st = bumpStreak();
      res.streak = st;
      kills++;
    }
    return res;
  }

  function publicState() {
    var P = null;
    try { P = G.player; } catch (e) {}
    return {
      numbers: !!state.numbers,
      arcs: !!state.arcs,
      reduceMotion: reduceMotion(),
      mp: mpActive(),
      lowHealth: lowOn,
      hitmarks: PARTS.hits ? PARTS.hits.children.length : 0,
      numbersVisible: PARTS.nums ? PARTS.nums.children.length : 0,
      kills: kills,
      lastKill: lastKillInfo,
      health: P ? P.health : null,
      weapon: weaponName(),
      storageKey: HIT_KEY
    };
  }

  /* -------------------------------------------------------------- boot */
  function boot() {
    if (booted) return;
    G = window.__G;
    if (!G || !G.hud || !G.hud.root) return;
    if (!G.level || !G.camera) return;
    injectCSS();
    loadFeedback();
    if (!buildLayer()) return;
    installProbe();
    try { G.events.on("impact", onImpact); } catch (e) { console.error("[feedback] impact", e); }
    try { G.events.on("player:hitEnemy", onHitEnemy); } catch (e) { console.error("[feedback] hitEnemy", e); }
    try { G.events.on("player:hit", onPlayerHit); } catch (e) { console.error("[feedback] player:hit", e); }
    try { G.events.on("player:dead", onPlayerDead); } catch (e) {}
    try { G.events.on("sx:armor-absorb", onArmor); } catch (e) {}
    try { G.events.on("sx:streak", onStreak); } catch (e) {}
    addEventListener("keydown", onKey, true);
    // 周期刷新低血量与敌人探针
    var tick = 0;
    var iv = setInterval(function () {
      tick++;
      try { updateLowHealth(); } catch (e) {}
      if (tick % 20 === 0) installProbe();
      if (!G || !G.hud || !G.hud.root) {
        clearInterval(iv);
      }
    }, 100);
    // 独立 RAF：只做极轻量的状态同步
    var raf = function () {
      try { updateLowHealth(); } catch (e) {}
      requestAnimationFrame(raf);
    };
    try { requestAnimationFrame(raf); } catch (e) {}
    booted = true;
    window.__SX_FEEDBACK = {
      state: publicState,
      hit: hit,
      toggleNumbers: toggleNumbers
    };
    console.log("[feedback] V33 命中反馈分层已加载");
  }

  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      if (booted) { clearInterval(iv); return; }
      boot();
      if (booted) clearInterval(iv);
      else if (++tries > 900) { clearInterval(iv); console.error("[feedback] engine not ready"); }
    }, 100);
    boot();
  }

  /* 小工具：转义（避免用户/武器名注入 DOM） */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  wait();
})();
