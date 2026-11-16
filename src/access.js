
  /* =====================================================================
     V9 体验与性能：难度 / 准星颜色 / 镜头晃动 / 性能面板
     ===================================================================== */
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
          if (clab) clab.textContent = access.contrast ? "开启" : "关闭";
        }
        continue;
      }
      if (key === "reduce") {
        var tbtn = rows[i].querySelector("[data-x-reduce]");
        if (tbtn) {
          tbtn.setAttribute("aria-pressed", access.reduceMotion ? "true" : "false");
          var lab = tbtn.querySelector("span");
          if (lab) lab.textContent = access.reduceMotion ? "开启" : "关闭";
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
        b.title = locked ? "完成 " + need + " 个挑战解锁" : "";
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
      avh.textContent = "画面与音频";
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
      if (sensRow) sensRow.insertAdjacentHTML("beforebegin", "<h3>操控</h3>");
    }
    var note = pane.querySelector(".panel-note");
    var box = document.createElement("div");
    var crossRow = null;
    box.innerHTML =
      '<div class="row"><label>作战难度</label><div class="seg" data-x-seg="difficulty">' +
        '<button data-v="recruit">新兵</button><button data-v="normal">标准</button>' +
        '<button data-v="veteran">老兵</button><button data-v="nightmare">噩梦</button></div></div>' +
      '<h3>辅助</h3><div class="row"><label>准星颜色</label><div class="seg" data-x-seg="cross">' +
        '<button data-v="bone">白</button><button data-v="amber">琥珀</button><button data-v="cyan">青</button>' +
        '<button data-v="lime" data-need="3">绿 · 3</button><button data-v="crimson" data-need="6">红 · 6</button><button data-v="gold" data-need="9">金 · 9</button></div></div>' +
      '<div class="row"><label>镜头晃动</label><div class="seg" data-x-seg="shake">' +
        '<button data-v="low">低</button><button data-v="std">标准</button><button data-v="high">高</button></div></div>' +
      '<div class="row"><label>减少动态</label><button class="toggle" data-x-reduce aria-pressed="false"><i></i><span>关闭</span></button></div>' +
      '<div class="row"><label>HUD 缩放</label><div class="seg" data-x-seg="hudScale"><button data-v="90">90%</button><button data-v="100">100%</button><button data-v="115">115%</button></div></div>' +
      '<div class="row"><label>字幕大小</label><div class="seg" data-x-seg="subSize"><button data-v="S">小</button><button data-v="M">中</button><button data-v="L">大</button></div></div>' +
      '<div class="row"><label>高对比</label><button class="toggle" data-x-contrast aria-pressed="false"><i></i><span>关闭</span></button></div>';
    box.insertAdjacentHTML("afterbegin", "<h3>游戏性</h3>");
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

  function initAccess() {
    loadAccess();
    buildAccessUI();
    applyAccess();
    buildPerfUI();
    // 镜头晃动缩放（只包装一次）
    if (G.player && !G.player.__sxShakeWrapped) {
      var baseShake = G.player.addShake;
      G.player.addShake = function (v) {
        return baseShake.call(G.player, (v || 0) * (S.shakeScale || 1));
      };
      G.player.__sxShakeWrapped = true;
    }
  }
