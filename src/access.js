
  /* =====================================================================
     V9 体验与性能：难度 / 准星颜色 / 镜头晃动 / 性能面板
     ===================================================================== */
  /* V54 · 辅助设置文案：词典缺键（旧构建）时回退中文。 */
  function acI18n() {
    try { return (typeof window !== "undefined" && window.SXI18n) || null; } catch (e) { return null; }
  }
  function acHas(key) {
    var I = acI18n();
    if (!I) return false;
    try {
      if (typeof I.has === "function") return !!I.has(key);
      return !!(I.dict && I.dict["zh-CN"] && I.dict["zh-CN"][key] != null);
    } catch (e) { return false; }
  }
  function acT(key, zh, vars) {
    var I = acI18n();
    if (I && typeof I.t === "function" && acHas(key)) {
      try { return I.t(key, vars); } catch (e) { /* 取词失败回退中文 */ }
    }
    var s = zh == null ? key : String(zh);
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (_, name) {
        return vars[name] == null ? "" : String(vars[name]);
      });
    }
    return s;
  }

  var ACCESS_KEY = "saltline.access.v1";
  var DIFFICULTY = {
    recruit: { label: "新兵", damage: 0.7, hp: 0.9 },
    normal: { label: "标准", damage: 1, hp: 1 },
    veteran: { label: "老兵", damage: 1.3, hp: 1.15 },
    nightmare: { label: "噩梦", damage: 1.6, hp: 1.35 }
  };
  var CROSS_COLORS = { bone: "#e8e4da", amber: "#ffb347", cyan: "#8fd8ff", lime: "#9cff6a", crimson: "#ff5a5a", gold: "#ffd166" };
  var CROSS_NEED = { bone: 0, amber: 0, cyan: 0, lime: 3, crimson: 6, gold: 9 };
  function crossUnlocked(k) {
    var need = CROSS_NEED[k] || 0;
    return need === 0 || (typeof challengeCount === "function" && challengeCount() >= need);
  }
  var access = { difficulty: "normal", cross: "bone", shake: "std", reduceMotion: false, hudScale: "100", subSize: "M", contrast: false };
  var perfUI = null;
  var perfLast = 0;
  var perfFrames = [];

  function loadAccess() {
    try {
      var raw = JSON.parse(localStorage.getItem(ACCESS_KEY) || "null");
      if (raw && typeof raw === "object") {
        if (DIFFICULTY[raw.difficulty]) access.difficulty = raw.difficulty;
        if (CROSS_COLORS[raw.cross]) access.cross = raw.cross;
        if (raw.shake === "low" || raw.shake === "std" || raw.shake === "high") access.shake = raw.shake;
        access.reduceMotion = !!raw.reduceMotion;
        if (raw.hudScale === "90" || raw.hudScale === "100" || raw.hudScale === "115") access.hudScale = raw.hudScale;
        if (raw.subSize === "S" || raw.subSize === "M" || raw.subSize === "L") access.subSize = raw.subSize;
        access.contrast = !!raw.contrast;
      }
    } catch (e) {}
  }
  function saveAccess() {
    try { localStorage.setItem(ACCESS_KEY, JSON.stringify(access)); } catch (e) {}
    try { if (window.SXBridge) SXBridge.access(access); } catch (e) {}
  }

  function recomputeScales() {
    var d = (S.missionDamage == null ? 1 : S.missionDamage) * (S.diffDamage == null ? 1 : S.diffDamage);
    var h = (S.missionHp == null ? 1 : S.missionHp) * (S.diffHp == null ? 1 : S.diffHp);
    S.damageScale = d;
    S.hpScale = h;
  }

  function applyAccess() {
    if (!crossUnlocked(access.cross)) access.cross = "bone";
    var d = DIFFICULTY[access.difficulty] || DIFFICULTY.normal;
    S.diffDamage = d.damage;
    S.diffHp = d.hp;
    S.shakeScale = access.reduceMotion ? 0.18 : access.shake === "low" ? 0.45 : access.shake === "high" ? 1.6 : 1;
    try { document.body.classList.toggle("reduce-motion", !!access.reduceMotion); } catch (e) {}
    try {
      document.documentElement.style.setProperty("--hud-scale", (parseInt(access.hudScale, 10) || 100) / 100);
      document.documentElement.style.setProperty("--sub-scale", access.subSize === "S" ? 0.85 : access.subSize === "L" ? 1.22 : 1);
      document.body.classList.toggle("hc", !!access.contrast);
    } catch (e) {}
    recomputeScales();
    try {
      document.documentElement.style.setProperty("--cross-col", CROSS_COLORS[access.cross] || CROSS_COLORS.bone);
    } catch (e) {}
    updateAccessButtons();
  }

  function updateAccessButtons() {
    var rows = document.querySelectorAll("[data-x-seg]");
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].dataset.xSeg;
      var val = access[key];
      if (key === "contrast") {
        var cbtn = rows[i].querySelector("[data-x-contrast]");
        if (cbtn) {
          cbtn.setAttribute("aria-pressed", access.contrast ? "true" : "false");
          var clab = cbtn.querySelector("span");
          if (clab) clab.textContent = access.contrast ? acT("ui2.access.on", "开启") : acT("ui2.access.off", "关闭");
        }
        continue;
      }
      if (key === "reduce") {
        var tbtn = rows[i].querySelector("[data-x-reduce]");
        if (tbtn) {
          tbtn.setAttribute("aria-pressed", access.reduceMotion ? "true" : "false");
          var lab = tbtn.querySelector("span");
          if (lab) lab.textContent = access.reduceMotion ? acT("ui2.access.on", "开启") : acT("ui2.access.off", "关闭");
        }
        continue;
      }
      var btns = rows[i].querySelectorAll("button");
      for (var k = 0; k < btns.length; k++) {
        var b = btns[k];
        var need = parseInt(b.dataset.need || "0", 10);
        var locked = need > 0 && (!(typeof challengeCount === "function") || challengeCount() < need);
        b.disabled = locked;
        b.classList.toggle("locked", locked);
        b.title = locked ? acT("access.lockedHint", "完成 {n} 个挑战解锁", { n: need }) : "";
        b.setAttribute("aria-pressed", b.dataset.v === val ? "true" : "false");
      }
    }
  }

  function buildAccessUI() {
    var pane = document.querySelector('.panel-b[data-pane="settings"]');
    if (!pane) return;
    // 标题独立幂等：无论其它模块先插入多少行，都保证「画面与音频」分组存在
    if (!pane.querySelector("h3[data-sx-av]")) {
      var avh = document.createElement("h3");
      avh.setAttribute("data-sx-av", "1");
      avh.textContent = acT("ui2.settings.av", "画面与音频");
      var avAnchor = pane.querySelector(".row");
      if (avAnchor && avAnchor.parentNode) avAnchor.parentNode.insertBefore(avh, avAnchor);
      else pane.insertBefore(avh, pane.firstChild);
    }
    if (pane.querySelector("[data-x-seg]")) return;
    if (!pane.querySelector("h3")) {
      var qrow = pane.querySelector(".row");
      var volRow = pane.querySelector("#s-vol") && pane.querySelector("#s-vol").closest(".row");
      var fovRow = pane.querySelector("#s-fov") && pane.querySelector("#s-fov").closest(".row");
      if (qrow && volRow && volRow !== qrow) qrow.after(volRow);
      if (volRow && fovRow && fovRow !== volRow) volRow.after(fovRow);
      var first = qrow;
      var sens = pane.querySelector("#s-sens");
      var sensRow = sens && sens.closest(".row");
      if (sensRow) sensRow.insertAdjacentHTML("beforebegin", '<h3 data-sx-controls="1">' + acT("access.controls", "操控") + "</h3>");
    }
    var note = pane.querySelector(".panel-note");
    var box = document.createElement("div");
    var crossRow = null;
    box.innerHTML =
      '<div class="row"><label>' + acT("ui2.settings.difficulty", "作战难度") + '</label><div class="seg" data-x-seg="difficulty">' +
        '<button data-v="recruit">' + acT("ui2.settings.diff.recruit", "新兵") + '</button><button data-v="normal">' + acT("ui2.settings.diff.normal", "标准") + '</button>' +
        '<button data-v="veteran">' + acT("ui2.settings.diff.veteran", "老兵") + '</button><button data-v="nightmare">' + acT("ui2.settings.diff.nightmare", "噩梦") + '</button></div></div>' +
      '<h3 data-sx-aux="1">' + acT("ui2.settings.aux", "辅助") + '</h3><div class="row"><label>' + acT("ui2.settings.cross", "准星颜色") + '</label><div class="seg" data-x-seg="cross">' +
        '<button data-v="bone">' + acT("ui2.settings.cross.bone", "白") + '</button><button data-v="amber">' + acT("ui2.settings.cross.amber", "琥珀") + '</button>' +
        '<button data-v="cyan">' + acT("ui2.settings.cross.cyan", "青") + '</button>' +
        '<button data-v="lime" data-need="3">' + acT("access.cross.lime", "绿 · 3") + '</button><button data-v="crimson" data-need="6">' + acT("access.cross.crimson", "红 · 6") + '</button>' +
        '<button data-v="gold" data-need="9">' + acT("access.cross.gold", "金 · 9") + '</button></div></div>' +
      '<div class="row"><label>' + acT("ui2.settings.shake", "镜头晃动") + '</label><div class="seg" data-x-seg="shake">' +
        '<button data-v="low">' + acT("access.shake.low", "低") + '</button><button data-v="std">' + acT("access.shake.std", "标准") + '</button>' +
        '<button data-v="high">' + acT("access.shake.high", "高") + '</button></div></div>' +
      '<div class="row"><label>' + acT("ui2.settings.reduce", "减少动态") + '</label><button class="toggle" data-x-reduce aria-pressed="false"><i></i><span>' + acT("ui2.access.off", "关闭") + '</span></button></div>' +
      '<div class="row"><label>' + acT("ui2.settings.hudScale", "HUD 缩放") + '</label><div class="seg" data-x-seg="hudScale"><button data-v="90">90%</button><button data-v="100">100%</button><button data-v="115">115%</button></div></div>' +
      '<div class="row"><label>' + acT("ui2.settings.subSize", "字幕大小") + '</label><div class="seg" data-x-seg="subSize"><button data-v="S">' + acT("ui2.settings.textSize.s", "小") + '</button>' +
        '<button data-v="M">' + acT("ui2.settings.textSize.m", "中") + '</button><button data-v="L">' + acT("ui2.settings.textSize.l", "大") + '</button></div></div>' +
      '<div class="row"><label>' + acT("ui2.settings.contrast", "高对比") + '</label><button class="toggle" data-x-contrast aria-pressed="false"><i></i><span>' + acT("ui2.access.off", "关闭") + '</span></button></div>';
    box.insertAdjacentHTML("afterbegin", '<h3 data-sx-gameplay="1">' + acT("ui2.settings.gameplay", "游戏性") + "</h3>");
    while (box.firstChild) pane.insertBefore(box.firstChild, note || null);
    var contrast = pane.querySelector("[data-x-contrast]");
    if (contrast)
      contrast.addEventListener("click", function () {
        access.contrast = !access.contrast;
        saveAccess();
        applyAccess();
        G.events.emit("ui:click", {});
      });
    var reduce = pane.querySelector("[data-x-reduce]");
    if (reduce)
      reduce.addEventListener("click", function () {
        access.reduceMotion = !access.reduceMotion;
        saveAccess();
        applyAccess();
        G.events.emit("ui:click", {});
      });
    var segs = pane.querySelectorAll("[data-x-seg]");
    for (var i = 0; i < segs.length; i++) {
      segs[i].addEventListener("click", function (e) {
        var b = e.target.closest("button[data-v]");
        if (!b) return;
        var key = this.dataset.xSeg;
        access[key] = b.dataset.v;
        saveAccess();
        applyAccess();
        G.events.emit("ui:click", {});
      });
    }
  }

  function buildPerfUI() {
    var elp = el("div", "x-perf", '<pre></pre>');
    document.getElementById("ui").appendChild(elp);
    perfUI = { el: elp, pre: elp.querySelector("pre") };
    addEventListener("keydown", function (e) {
      if (e.code !== "F3") return;
      e.preventDefault();
      e.stopPropagation();
      perfUI.el.classList.toggle("on");
    }, true);
  }

  function updatePerf(dt) {
    if (!perfUI || !perfUI.el.classList.contains("on")) return;
    perfFrames.push(dt);
    if (perfFrames.length > 90) perfFrames.shift();
    var now = performance.now();
    if (now - perfLast < 260) return;
    perfLast = now;
    var avg = 0;
    for (var i = 0; i < perfFrames.length; i++) avg += perfFrames[i];
    avg = perfFrames.length ? avg / perfFrames.length : dt;
    var st = {};
    try { st = window.__stats ? window.__stats() : {}; } catch (e) {}
    var res = st.res ? st.res[0] + "x" + st.res[1] : "?";
    var q = (G.quality && G.quality.name) || "?";
    var enemies = G.enemies && G.enemies.aliveCount ? G.enemies.aliveCount() : 0;
    perfUI.pre.textContent =
      "FPS " + (avg > 0 ? (1 / avg).toFixed(1) : "—") + "   frame " + (avg * 1000).toFixed(1) + "ms\n" +
      "calls " + (st.calls != null ? st.calls : "?") + "   tris " + (st.tris ? (st.tris / 1000).toFixed(0) + "k" : "?") + "   tex " + (st.tex != null ? st.tex : "?") + "\n" +
      "res " + res + "   quality " + q + "\n" +
      "state " + (G.game && G.game.state) + "   enemies " + enemies + "   dmg x" + (S.damageScale || 1).toFixed(2);
  }

  /* 语言切换：静态标题 / 行标签 / 分段按钮 / 动态 tooltip 重绘（ext_ui2 也会刷新，二者幂等）。 */
  function refreshAccessText() {
    var pane = document.querySelector('.panel-b[data-pane="settings"]');
    if (!pane) return;
    var h3 = function (sel, key, zh) {
      var el = pane.querySelector(sel);
      if (el) el.textContent = acT(key, zh);
    };
    h3("h3[data-sx-av]", "ui2.settings.av", "画面与音频");
    h3("h3[data-sx-controls]", "access.controls", "操控");
    h3("h3[data-sx-gameplay]", "ui2.settings.gameplay", "游戏性");
    h3("h3[data-sx-aux]", "ui2.settings.aux", "辅助");
    var setLabel = function (sel, key, zh) {
      var anchor = pane.querySelector(sel);
      var row = anchor && anchor.closest && anchor.closest(".row");
      var lb = row && row.querySelector("label");
      if (lb) lb.textContent = acT(key, zh);
    };
    setLabel('[data-x-seg="difficulty"]', "ui2.settings.difficulty", "作战难度");
    setLabel('[data-x-seg="cross"]', "ui2.settings.cross", "准星颜色");
    setLabel('[data-x-seg="shake"]', "ui2.settings.shake", "镜头晃动");
    setLabel('[data-x-seg="hudScale"]', "ui2.settings.hudScale", "HUD 缩放");
    setLabel('[data-x-seg="subSize"]', "ui2.settings.subSize", "字幕大小");
    setLabel("[data-x-reduce]", "ui2.settings.reduce", "减少动态");
    setLabel("[data-x-contrast]", "ui2.settings.contrast", "高对比");
    var diff = pane.querySelector('[data-x-seg="difficulty"]');
    if (diff) {
      var dmap = { recruit: ["ui2.settings.diff.recruit", "新兵"], normal: ["ui2.settings.diff.normal", "标准"], veteran: ["ui2.settings.diff.veteran", "老兵"], nightmare: ["ui2.settings.diff.nightmare", "噩梦"] };
      var db = diff.querySelectorAll("button");
      for (var i = 0; i < db.length; i++) {
        var dv = db[i].getAttribute("data-v"), dm = dmap[dv];
        if (dm) db[i].textContent = acT(dm[0], dm[1]);
      }
    }
    var cross = pane.querySelector('[data-x-seg="cross"]');
    if (cross) {
      var cmap = { bone: ["ui2.settings.cross.bone", "白"], amber: ["ui2.settings.cross.amber", "琥珀"], cyan: ["ui2.settings.cross.cyan", "青"], lime: ["access.cross.lime", "绿 · 3"], crimson: ["access.cross.crimson", "红 · 6"], gold: ["access.cross.gold", "金 · 9"] };
      var cb = cross.querySelectorAll("button");
      for (var j = 0; j < cb.length; j++) {
        var cv = cb[j].getAttribute("data-v"), cm = cmap[cv];
        if (cm) cb[j].textContent = acT(cm[0], cm[1]);
      }
    }
    var shake = pane.querySelector('[data-x-seg="shake"]');
    if (shake) {
      var smap = { low: ["access.shake.low", "低"], std: ["access.shake.std", "标准"], high: ["access.shake.high", "高"] };
      var sb = shake.querySelectorAll("button");
      for (var k = 0; k < sb.length; k++) {
        var sv = sb[k].getAttribute("data-v"), sm = smap[sv];
        if (sm) sb[k].textContent = acT(sm[0], sm[1]);
      }
    }
    var sub = pane.querySelector('[data-x-seg="subSize"]');
    if (sub) {
      var tmap = { S: ["ui2.settings.textSize.s", "小"], M: ["ui2.settings.textSize.m", "中"], L: ["ui2.settings.textSize.l", "大"] };
      var tb = sub.querySelectorAll("button");
      for (var q = 0; q < tb.length; q++) {
        var tv = tb[q].getAttribute("data-v"), tm = tmap[tv];
        if (tm) tb[q].textContent = acT(tm[0], tm[1]);
      }
    }
    updateAccessButtons();
  }

  function initAccess() {
    loadAccess();
    buildAccessUI();
    applyAccess();
    buildPerfUI();
    try { if (G && G.events) G.events.on("sx:lang", refreshAccessText); } catch (e) { /* 语言事件不可用 */ }
    try { addEventListener("sx:i18n-extra", refreshAccessText); } catch (e) { /* 非浏览器环境 */ }
    // 镜头晃动缩放（只包装一次）
    if (G.player && !G.player.__sxShakeWrapped) {
      var baseShake = G.player.addShake;
      G.player.addShake = function (v) {
        return baseShake.call(G.player, (v || 0) * (S.shakeScale || 1));
      };
      G.player.__sxShakeWrapped = true;
    }
  }
