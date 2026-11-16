/* =====================================================================
   SALTLINE · ext_boss2.js — V34「对手」WP34-5 · BOSS 编排系统
   两场 BOSS：港区主控 · 蜃（m3）/ 蜃 · 终形（m6）
   - 脚本化状态机 + 数据驱动招式表（telegraph / exec / cooldown）
   - 保留引擎原有 volley / stomp；新增震地 / 扇形弹幕 / 召唤 /
     过载冲刺 / EMP / 残响分身
   - 只从 G.enemies.list 找 boss，复用 boss.js 的血条，不重复创建
   - 所有伤害只在 exec 阶段发生；预警 ≥0.6s，红环 + 激光 + 音效
   - V53 CLI-1：逻辑全部走 fixedUpdate（tickLogic），update 只做表现
   - V53 ARCH-2：高频空 catch 统一走 SXErrors.soft('boss2:<tag>')
   - V53 ARCH-3：__SX_BOSS.logicState() 提供无 DOM 的确定性状态快照
   ===================================================================== */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.__SX_BOSS2_LOADED) return;
  window.__SX_BOSS2_LOADED = true;

  var VERSION = "V34 · WP34-5";
  /* V54 · BOSS 播报/阶段名走 SXI18n；缺键时回退中文。 */
  function boss2T(key, zh, vars) {
    try {
      var I = typeof window !== "undefined" ? window.SXI18n : null;
      if (I && typeof I.t === "function" && typeof I.has === "function" && I.has(key)) return I.t(key, vars);
    } catch (e) { /* 取词失败回退中文 */ }
    var s = zh == null ? key : String(zh);
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, name) { return vars[name] == null ? "" : String(vars[name]); });
    return s;
  }
  function phaseName(i, final) {
    var n = Math.max(0, Math.min(2, i | 0));
    return boss2T((final ? "boss.finalPhase." : "boss.phase.") + n,
      (final ? ["一·防壁", "二·镜像", "三·坍缩"] : ["一·扫描", "二·吊装", "三·过载"])[n]);
  }
  var ORDER = ["volley", "stomp", "barrage", "summon", "dash", "emp", "echo"];
  var WARN_COLOR = 0xff5a2e;
  var HOT_COLOR = 0xffb060;
  var DEG = Math.PI / 180;

  /* ------------------------------------------------------- 招式表 */
  var MOVES = {
    volley: {
      id: "volley", label: "三连导弹", source: "engine",
      phases: [0, 1, 2], telegraph: 0, cooldown: 0, damage: 12,
      channels: ["visual", "audio"]
    },
    stomp: {
      id: "stomp", label: "预警震地", phases: [0, 1, 2],
      telegraph: 1.2, cooldown: 7.0, damage: 22, radius: 9,
      channels: ["ring", "audio"]
    },
    barrage: {
      id: "barrage", label: "扇形弹幕", phases: [1, 2],
      telegraph: 0.75, cooldown: 6.0, damage: 8, shots: 9, spread: 25,
      channels: ["laser", "audio"]
    },
    summon: {
      id: "summon", label: "护盾无人机", phases: [1],
      telegraph: 0.7, cooldown: 999, once: true,
      channels: ["ring", "audio"]
    },
    dash: {
      id: "dash", label: "过载冲刺", phases: [2],
      telegraph: 0.8, cooldown: 5.5, damage: 30, dist: 12,
      channels: ["ring", "laser", "audio"]
    },
    emp: {
      id: "emp", label: "EMP 脉冲", phases: [2],
      telegraph: 0.9, cooldown: 9.0, damage: 0,
      channels: ["ring", "audio"]
    },
    echo: {
      id: "echo", label: "残响分身", phases: [2],
      telegraph: 0.8, cooldown: 999, once: true, finalOnly: true,
      channels: ["ring", "audio"]
    }
  };

  /* ------------------------------------------------------- 运行时 */
  var S = {
    active: false, ref: null, phase: 0, final: false, clock: 0,
    move: null, stage: "", t: 0, lastMove: "",
    globalCd: 0, engineGap: 0, cool: {}, once: {},
    timers: [], fx: [], moveFx: [], telegraphs: 0,
    summons: [], echoes: [],
    announced: {}, barBase: "", lastBarSig: "",
    hudGlitch: 0, empEl: null, queue: [],
    barForce: false, barStale: false, glitchReset: false,
    debug: false, debugEl: null,
    lock: null, dashFrom: null, dashTo: null, dashT: 0, dashDur: 0.26, dashHit: false,
    shotsFired: 0, hits: 0, execCount: 0, telegraphCount: 0,
    cleanupInfo: null
  };

  var G = null;
  var THREE = null;
  var registered = false;

  /* ------------------------------------------------------- 小工具 */
  // V53 ARCH-2：高频路径不再用空 catch 静默吞错。SXErrors.soft 按标签计数、
  // 每个标签只记一条诊断；缺少诊断接口时退回 window.__errors 环形缓冲。
  function soft(tag, e) {
    try {
      if (typeof window !== "undefined" && window.SXErrors && typeof window.SXErrors.soft === "function") {
        window.SXErrors.soft("boss2:" + tag, e);
        return;
      }
    } catch (_) { /* 诊断失败不能影响调用方 */ }
    try {
      if (typeof window !== "undefined" && window.__errors) {
        window.__errors.push("[boss2:" + tag + "] " + ((e && e.stack) || e));
      }
    } catch (_) { /* 只读数组：仍然吞掉并继续 */ }
  }
  function emit(name, payload) {
    try { if (G && G.events && G.events.emit) G.events.emit(name, payload || {}); } catch (e) { soft("emit", e); }
  }
  function sfx(name, opts) {
    try { if (G && G.audio && G.audio.play) G.audio.play(name, opts || {}); } catch (e) { soft("sfx", e); }
  }
  function shake(v) {
    try { if (G && G.player && G.player.addShake) G.player.addShake(v); } catch (e) { soft("shake", e); }
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mission() {
    try { return (G && G.game && G.game.currentMission) || null; } catch (e) { soft("mission", e); return null; }
  }
  function isFinalMission(m) {
    return !!m && (m.id === "m6" || (m.bossHp | 0) >= 2600 || /终形/.test(String(m.bossName || "")));
  }
  function groundY(x, z) {
    try {
      var y = G.physics.groundHeight(x, z, 8);
      return typeof y === "number" && isFinite(y) ? y : 0;
    } catch (e) { soft("groundY", e); return 0; }
  }
  function walkable(x, z) {
    try { return !!G.physics.nav.isWalkable(x, z); } catch (e) { soft("walkable", e); return true; }
  }
  function vec3(v) {
    return v ? { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) } : null;
  }
  function rateMul() { return S.final && S.phase === 2 ? 1.35 : 1; }
  function phaseFrom(e) {
    var mx = e.maxHp || 1600;
    var r = clamp((e.hp || 0) / mx, 0, 1);
    var p = r <= 0.33 ? 2 : r <= 0.66 ? 1 : 0;
    var ep = clamp(e.bossPhase | 0, 0, 2);
    return Math.max(p, ep);
  }
  function attacksFor(phase) {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) {
      var mv = MOVES[ORDER[i]];
      if (!mv || mv.phases.indexOf(phase) < 0) continue;
      if (mv.finalOnly && !S.final) continue;
      out.push(mv.id);
    }
    return out;
  }

  /* ------------------------------------------------------- 视觉 */
  function addFx(obj, mats, geos, life, kind, opts) {
    var rec = {
      obj: obj, mats: mats || [], geos: geos || [],
      ttl: life, max: life, kind: kind || "ring",
      growTo: (opts && opts.growTo) || 0,
      baseOpacity: (opts && opts.opacity != null) ? opts.opacity : 0.85
    };
    S.fx.push(rec);
    if (kind === "telegraph") S.telegraphs++;
    return rec;
  }

  function ringFx(x, y, z, radius, color, life, opts) {
    if (!THREE || !G || !G.scene) return null;
    try {
      opts = opts || {};
      var group = new THREE.Group();
      var mats = [], geos = [];
      var rg = new THREE.RingGeometry(Math.max(0.04, radius * 0.9), radius, 56);
      var rm = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false
      });
      var ring = new THREE.Mesh(rg, rm);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      mats.push(rm); geos.push(rg);
      if (!opts.ringOnly) {
        var dg = new THREE.CircleGeometry(radius * 0.96, 40);
        var dm = new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: 0.12,
          side: THREE.DoubleSide, depthWrite: false
        });
        var disc = new THREE.Mesh(dg, dm);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = -0.006;
        group.add(disc);
        mats.push(dm); geos.push(dg);
      }
      group.position.set(x, y + 0.05, z);
      G.scene.add(group);
      return addFx(group, mats, geos, life, opts.kind || "ring", opts);
    } catch (e) { soft("ringFx", e); return null; }
  }

  function laserFx(from, to, color, life) {
    if (!THREE || !G || !G.scene || !from || !to) return null;
    try {
      var geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
      var mat = new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: 0.9, depthWrite: false
      });
      var line = new THREE.Line(geo, mat);
      G.scene.add(line);
      return addFx(line, [mat], [geo], life, "laser");
    } catch (e) { soft("laserFx", e); return null; }
  }

  function removeFx(rec) {
    if (!rec) return;
    var i = S.fx.indexOf(rec);
    if (i >= 0) S.fx.splice(i, 1);
    if (rec.kind === "telegraph" && S.telegraphs > 0) S.telegraphs--;
    try {
      if (rec.obj && rec.obj.parent) rec.obj.parent.remove(rec.obj);
      for (var k = 0; k < rec.geos.length; k++) { try { rec.geos[k].dispose(); } catch (e) { soft("fx-dispose", e); } }
      for (var m = 0; m < rec.mats.length; m++) { try { rec.mats[m].dispose(); } catch (e) { soft("fx-dispose", e); } }
    } catch (e) { soft("fx-remove", e); }
    var j = S.moveFx.indexOf(rec);
    if (j >= 0) S.moveFx.splice(j, 1);
  }

  function clearFx() {
    var list = S.fx.slice();
    for (var i = 0; i < list.length; i++) removeFx(list[i]);
    S.fx.length = 0;
    S.moveFx.length = 0;
    S.telegraphs = 0;
  }

  function tickFx(dt) {
    for (var i = S.fx.length - 1; i >= 0; i--) {
      var f = S.fx[i];
      f.ttl -= dt;
      if (f.ttl <= 0) { removeFx(f); continue; }
      var k = clamp(f.ttl / f.max, 0, 1);
      var op;
      if (f.kind === "wave") {
        var sc = 0.12 + (1 - k) * (f.growTo || 1);
        try { f.obj.scale.setScalar(sc); } catch (e) { soft("fx-tick", e); }
        op = k * 0.9;
      } else if (f.kind === "telegraph") {
        op = 0.28 + 0.62 * k;
        try { f.obj.scale.setScalar(0.97 + 0.03 * (1 - k)); } catch (e) { soft("fx-tick", e); }
      } else {
        op = k * 0.9;
      }
      for (var m = 0; m < f.mats.length; m++) {
        try {
          f.mats[m].opacity = (m === 0 ? op : op * 0.14);
        } catch (e) { soft("fx-tick", e); }
      }
    }
  }

  /* ------------------------------------------------------- 定时器 */
  function after(sec, fn) {
    S.timers.push({ t: Math.max(0, sec), fn: fn });
  }
  function clearTimers() {
    S.timers.length = 0;
  }
  function tickTimers(dt) {
    if (!G || !G.game || G.game.state !== "playing") return;   // V37：暂停/非 playing 不推进
    if (!S.timers.length) return;
    var due = [];
    for (var i = S.timers.length - 1; i >= 0; i--) {
      var tm = S.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { S.timers.splice(i, 1); due.push(tm); }
    }
    for (var j = 0; j < due.length; j++) {
      if (!G.game || G.game.state !== "playing") continue;      // V37：回调时再守一次
      try { due[j].fn(); } catch (e) { soft("timer", e); }
    }
  }

  /* ------------------------------------------------------- HUD / 血条 */
  // V53 CLI-1：血条是表现层，只在 tickPresentation 里同步；逻辑层只置脏标记。
  function captureBarBase() {
    var base = "";
    try {
      var t = document.querySelector(".x-boss-k");
      if (t) base = String(t.textContent || "").replace(/\s*｜.*$/, "").trim();
    } catch (e) { soft("bar-base", e); }
    if (!base) {
      var m = mission();
      base = (m && m.bossName) || boss2T("boss.core.name", "港区主控 · 蜃");
    }
    S.barBase = base;
  }

  // V37：血条 DOM 节点缓存 + 0.1s 节流（force 时立即刷新）
  var barEl = null, barPips = null, barTitle = null, barAt = 0;
  function syncBar(force) {
    var now = Date.now();
    if (!force && now - barAt < 100) return;
    barAt = now;
    try {
      if (!barEl || !barEl.isConnected) {
        barEl = document.querySelector(".x-boss");
        barPips = barEl ? barEl.querySelectorAll(".x-boss-pips em") : null;
        barTitle = barEl ? barEl.querySelector(".x-boss-k") : null;
      }
      if (!S.active) {
        if (S.barStale && barEl) { S.barStale = false; barEl.classList.remove("on"); }
        return;
      }
      if (!barEl) return;
      if (!S.barBase) captureBarBase();
      var pips = barPips;
      for (var i = 0; pips && i < pips.length; i++) pips[i].classList.toggle("on", i >= S.phase);
      if (barTitle && barTitle.isConnected) {
        var base = S.barBase || boss2T("boss.core.name", "港区主控 · 蜃");
        var tag = phaseName(S.phase, S.final);
        var want = base + " ｜ " + tag;
        if (barTitle.textContent !== want) barTitle.textContent = want;
      } else {
        barTitle = barEl.querySelector(".x-boss-k");
      }
      S.lastBarSig = S.phase + "|" + (S.final ? 1 : 0) + "|" + S.phase;
    } catch (e) { soft("bar-sync", e); }
  }

  /* ------------------------------------------------------- 阶段 */
  function announcePhase(n) {
    if (n <= 0 || S.announced[n]) return;
    S.announced[n] = 1;
    var finalNow = S.final;
    var warn = "", radio = "";
    if (n === 1) {
      warn = finalNow ? boss2T("boss.announce.mirror", "蜃·终形 · 镜像投射") : boss2T("boss.announce.hoist", "主控装甲剥落 · 吊装臂启动");
      radio = finalNow
        ? boss2T("boss.radio.mirror", "它开始投射镜像了。扫描分辨真身——打错会挨反击。")
        : boss2T("boss.radio.hoist", "它把吊机接进了身体。注意地面红环，别站在落点里。");
    } else if (n === 2) {
      warn = finalNow ? boss2T("boss.announce.collapse", "蜃·终形 · 坍缩开始") : boss2T("boss.announce.overload", "主控过载 · 核心脱离吊臂");
      radio = finalNow
        ? boss2T("boss.radio.collapse", "反应堆失稳！安全区在缩小，借柱子躲开贯穿光束。")
        : boss2T("boss.radio.overload", "核心落地了！躲开冲刺，EMP 能让它短路。");
    }
    try { if (G.hud && G.hud.warn) G.hud.warn(warn, 3.4); } catch (e) { soft("announce", e); }
    try { if (G.hud && G.hud.radio) G.hud.radio(radio, 4.2); } catch (e) { soft("announce", e); }
    sfx("alert", { gain: 0.8, pitch: n === 2 ? 0.55 : 0.72 });
    emit("sx:boss2-announce", { phase: n, text: warn, at: S.clock, final: finalNow });
  }

  function applyPhase(n, forced) {
    n = clamp(n | 0, 0, 2);
    var prev = S.phase;
    if (n === prev && !forced) {
      if (S.ref) S.ref.bossPhase = n;
      return;
    }
    S.phase = n;
    if (S.ref) S.ref.bossPhase = n;
    if (!forced) cancelMove();
    for (var id in S.cool) {
      if (MOVES[id] && MOVES[id].phases.indexOf(n) >= 0) S.cool[id] = Math.min(S.cool[id] || 0, 0.25);
    }
    S.globalCd = Math.min(S.globalCd, 0.25);
    if (n === 2) S.queue = ["dash", "emp"];
    else if (n === 1 && !S.once.summon) S.queue = ["summon"];
    if (n !== prev) announcePhase(n);
    S.barForce = true;
    emit("sx:boss2-phase", { phase: n, prev: prev, at: S.clock, final: S.final });
  }

  function updatePhase() {
    var e = S.ref;
    if (!e) return;
    var mx = e.maxHp || 1600;
    var r = clamp((e.hp || 0) / mx, 0, 1);
    var tp = r <= 0.33 ? 2 : r <= 0.66 ? 1 : 0;
    var ep = clamp(e.bossPhase | 0, 0, 2);
    if (ep > tp) tp = ep;
    if (tp > S.phase) applyPhase(tp, false);
    else if (ep !== S.phase) e.bossPhase = S.phase;
  }

  function forcePhase(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    if (n >= 3) n = 2;
    if (n < 0) n = 0;
    var e = S.ref || findBoss();
    if (!e) return { ok: false, reason: "no-boss" };
    if (!S.active) adopt(e);
    if (!S.ref) return { ok: false, reason: "no-boss" };
    var ratios = [0.95, 0.60, 0.20];
    var mx = e.maxHp || 1600;
    e.maxHp = mx;
    e.hp = Math.max(1, Math.round(mx * ratios[n]));
    e.bossPhase = n;
    cancelMove();
    for (var k in S.cool) S.cool[k] = 0;
    S.queue = n === 2 ? ["dash", "emp"] : (n === 1 && !S.once.summon ? ["summon"] : []);
    S.globalCd = 0.15;
    applyPhase(n, true);
    // API/调试入口（不在固定步内）：立即刷新血条，保持 V34 起的外部行为。
    try { syncBar(true); } catch (e) { soft("bar-sync", e); }
    S.barForce = false;
    emit("sx:boss2-forced", { phase: n, at: S.clock });
    return stateSnapshot();
  }

  /* ------------------------------------------------------- 招式调度 */
  function coolOf(id) { return S.cool[id] || 0; }

  function chooseMove() {
    if (!S.active || S.move || S.globalCd > 0 || S.engineGap > 0) return;
    if (S.queue.length) {
      for (var q = 0; q < S.queue.length; q++) {
        var qid = S.queue[q], qm = MOVES[qid];
        if (!qm || qm.phases.indexOf(S.phase) < 0) continue;
        if (qm.finalOnly && !S.final) continue;
        if (qm.once && S.once[qid]) continue;
        if (coolOf(qid) > 0) continue;
        S.queue.splice(q, 1);
        beginMove(qid);
        return;
      }
    }
    var list = [];
    for (var i = 0; i < ORDER.length; i++) {
      var id = ORDER[i], mv = MOVES[id];
      if (!mv || mv.source) continue;
      if (mv.phases.indexOf(S.phase) < 0) continue;
      if (mv.finalOnly && !S.final) continue;
      if (mv.once && S.once[id]) continue;
      if (coolOf(id) > 0) continue;
      var w = id === "summon" || id === "echo" ? 40 :
        id === "emp" ? 3.2 : id === "dash" ? 2.4 : id === "stomp" ? 2 : 1.6;
      if (id === S.lastMove) w *= 0.3;
      list.push({ id: id, w: w });
    }
    if (!list.length) return;
    var total = 0, j;
    for (j = 0; j < list.length; j++) total += list[j].w;
    var roll = Math.random() * total, pick = list[0].id;
    for (j = 0; j < list.length; j++) {
      roll -= list[j].w;
      if (roll <= 0) { pick = list[j].id; break; }
    }
    beginMove(pick);
  }

  function beginMove(id) {
    var mv = MOVES[id];
    if (!mv) return;
    var e = S.ref;
    if (!e) return;
    S.move = id;
    S.stage = "telegraph";
    S.t = 0;
    S.lastMove = id;
    S.moveFx = [];
    S.telegraphCount++;
    if (id === "dash") S.lock = dashTarget();
    var payload = {
      move: id, label: mv.label, phase: S.phase, time: mv.telegraph,
      at: S.clock, channels: mv.channels, final: S.final,
      pos: vec3(e.pos)
    };
    if (id === "dash" && S.lock) payload.target = vec3(S.lock);
    emit("sx:boss-telegraph", payload);
    buildTelegraph(mv);
    sfx("alert", { gain: 0.5, pitch: id === "emp" ? 0.55 : 1.35 });
  }

  function buildTelegraph(mv) {
    var e = S.ref;
    if (!e) return;
    var p = e.pos;
    var gy = groundY(p.x, p.z);
    var f = null;
    if (mv.id === "stomp") {
      f = ringFx(p.x, gy, p.z, 9, WARN_COLOR, mv.telegraph, { kind: "telegraph", opacity: 0.85 });
      if (f) S.moveFx.push(f);
    } else if (mv.id === "barrage") {
      var P = G.player;
      if (P) {
        var t = new THREE.Vector3(P.pos.x, groundY(P.pos.x, P.pos.z) + 0.05, P.pos.z);
        f = ringFx(t.x, t.y - 0.05, t.z, 1.7, WARN_COLOR, mv.telegraph, { kind: "telegraph" });
        if (f) S.moveFx.push(f);
        var muzzle = e.muzzle ? e.muzzle.clone() : p.clone().setY(p.y + 2);
        var l = laserFx(muzzle, new THREE.Vector3(P.pos.x, P.pos.y + 1, P.pos.z), WARN_COLOR, mv.telegraph);
        if (l) S.moveFx.push(l);
      }
    } else if (mv.id === "summon") {
      f = ringFx(p.x, gy, p.z, 4.2, WARN_COLOR, mv.telegraph, { kind: "telegraph" });
      if (f) S.moveFx.push(f);
    } else if (mv.id === "dash") {
      var to = S.lock || p;
      var ty = groundY(to.x, to.z);
      f = ringFx(to.x, ty, to.z, 2.7, WARN_COLOR, mv.telegraph, { kind: "telegraph" });
      if (f) S.moveFx.push(f);
      var l2 = laserFx(new THREE.Vector3(p.x, p.y + 1.1, p.z), new THREE.Vector3(to.x, ty + 1.1, to.z), WARN_COLOR, mv.telegraph);
      if (l2) S.moveFx.push(l2);
    } else if (mv.id === "emp") {
      f = ringFx(p.x, gy, p.z, 6.5, 0xff7a3a, mv.telegraph, { kind: "telegraph" });
      if (f) S.moveFx.push(f);
    } else if (mv.id === "echo") {
      f = ringFx(p.x, gy, p.z, 5.2, WARN_COLOR, mv.telegraph, { kind: "telegraph" });
      if (f) S.moveFx.push(f);
    }
  }

  function fadeMoveTelegraph() {
    for (var i = 0; i < S.moveFx.length; i++) {
      var f = S.moveFx[i];
      if (f && f.ttl > 0.25) f.ttl = 0.25;
    }
  }

  function beginExec() {
    var id = S.move;
    var mv = MOVES[id];
    if (!mv || !S.ref) return;
    S.stage = "exec";
    S.t = 0;
    S.execCount++;
    emit("sx:boss-exec", {
      move: id, label: mv.label, phase: S.phase, at: S.clock,
      telegraph: mv.telegraph
    });
    fadeMoveTelegraph();
    if (id === "stomp") execStomp();
    else if (id === "barrage") execBarrage();
    else if (id === "summon") execSummon();
    else if (id === "emp") execEmp();
    else if (id === "echo") execEcho();
    else if (id === "dash") {
      S.dashFrom = S.ref.pos.clone();
      S.dashTo = (S.lock ? S.lock.clone() : dashTarget());
      if (S.dashFrom.distanceTo(S.dashTo) < 0.4) { finishMove(); return; }
      S.dashT = 0;
      S.dashHit = false;
      sfx("alert", { gain: 0.55, pitch: 0.65 });
      return; // dash 持续到 updateDash 结束
    }
    finishMove();
  }

  function finishMove() {
    var id = S.move;
    var mv = MOVES[id] || { cooldown: 6 };
    if (id) {
      S.cool[id] = (mv.cooldown || 6) / rateMul();
      if (mv.once) S.once[id] = 1;
    }
    S.globalCd = 0.9 / rateMul();
    S.move = null;
    S.stage = "";
    S.t = 0;
    S.dashFrom = S.dashTo = null;
  }

  function cancelMove() {
    for (var i = S.moveFx.length - 1; i >= 0; i--) removeFx(S.moveFx[i]);
    S.moveFx.length = 0;
    S.move = null;
    S.stage = "";
    S.t = 0;
    S.dashFrom = S.dashTo = null;
    S.lock = null;
  }

  function updateMove(dt) {
    if (!S.move) return;
    var mv = MOVES[S.move];
    if (!mv) { cancelMove(); return; }
    S.t += dt;
    if (S.stage === "telegraph") {
      if (S.t >= mv.telegraph) beginExec();
    } else if (S.stage === "exec" && mv.id === "dash") {
      updateDash(dt);
    }
  }

  /* ------------------------------------------------------- 招式实现 */
  function hurtPlayer(amount, from, tag, dist) {
    var P = G && G.player;
    if (!P || !P.alive) return false;
    var ok = true;
    try { P.damage(amount, from); } catch (e) { soft("hurt", e); ok = false; }
    if (!ok) return false;
    try { P.addShake(tag === "dash" ? 0.8 : 0.5); } catch (e) { soft("hurt", e); }
    S.hits++;
    try { if (G.hud && G.hud.hit) G.hud.hit(); } catch (e) { soft("hurt", e); }
    emit("sx:boss-attack-hit", {
      move: tag, damage: amount, at: S.clock,
      dist: +(dist || 0).toFixed(2), telegraph: MOVES[tag] ? MOVES[tag].telegraph : 0
    });
    return true;
  }

  function execStomp() {
    var e = S.ref;
    if (!e) return;
    var p = e.pos.clone();
    var gy = groundY(p.x, p.z);
    ringFx(p.x, gy, p.z, 1, WARN_COLOR, 0.5, { kind: "wave", growTo: 9, ringOnly: true });
    var P = G.player;
    if (P && P.alive) {
      var d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
      if (d <= 9) hurtPlayer(22, p, "stomp", d);
      else shake(0.3);
    }
    sfx("explosion", { gain: 0.55, pitch: 1.35 });
    shake(0.45);
    S.shotsFired++;
  }

  function execBarrage() {
    var e = S.ref;
    if (!e) return;
    var P = G.player;
    var muzzle = e.muzzle ? e.muzzle.clone() : e.pos.clone().setY(e.pos.y + 2.1);
    if (!P || !P.alive) { sfx("impact_metal", { gain: 0.4, pitch: 1.2 }); return; }
    var aim = new THREE.Vector3(P.pos.x, P.pos.y + 1.05, P.pos.z).sub(muzzle).normalize();
    var sets = [[-4, -3, -2], [-1, 0, 1], [2, 3, 4]];
    for (var b = 0; b < sets.length; b++) {
      (function (idx, delay) {
        after(delay, function () {
          if (!G || !G.game || G.game.state !== "playing") return;   // V37：暂停时不落弹
          if (!S.active || !S.ref || !S.ref.alive) return;
          fireFan(muzzle, aim, idx);
        });
      })(sets[b], b * 0.09);
    }
    sfx("impact_metal", { gain: 0.35, pitch: 0.9 });
    shake(0.2);
  }

  function fireFan(muzzle, aim, indices) {
    var baseYaw = Math.atan2(aim.x, aim.z);
    var pitch = Math.asin(clamp(aim.y, -1, 1));
    var anyHit = false;
    for (var i = 0; i < indices.length; i++) {
      var k = indices[i];
      var ang = baseYaw + k * (50 / 8) * DEG;
      var d = new THREE.Vector3(
        Math.sin(ang) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(ang) * Math.cos(pitch)
      ).normalize();
      var hit = false;
      try { hit = G.combat.enemyShot(muzzle, d, { damage: 8, range: 120 }); } catch (e) { soft("fan", e); }
      try {
        G.fx.tracer(muzzle, muzzle.clone().addScaledVector(d, 40), {
          color: HOT_COLOR, speed: 280, width: 0.055
        });
      } catch (e) { soft("fan", e); }
      S.shotsFired++;
      if (hit) { anyHit = true; S.hits++; }
    }
    if (anyHit) {
      emit("sx:boss-attack-hit", {
        move: "barrage", damage: 8, at: S.clock, dist: 0, telegraph: MOVES.barrage.telegraph
      });
    }
  }

  function spawnKind(kinds, pos) {
    for (var i = 0; i < kinds.length; i++) {
      var e = null;
      try { e = G.enemies.spawn(kinds[i], pos, { state: "alert" }); } catch (err) { soft("spawn", err); e = null; }
      if (e) return e;
    }
    return null;
  }

  function execSummon() {
    var e = S.ref;
    if (!e) return;
    var base = e.pos.clone();
    var made = [];
    for (var k = 0; k < 2; k++) {
      var p = base.clone();
      p.x += k ? 4.2 : -4.2;
      p.z += 2.5;
      if (!walkable(p.x, p.z)) { p.x = base.x + (k ? 2.4 : -2.4); p.z = base.z - 2.5; }
      p.y = groundY(p.x, p.z);
      var u = spawnKind(["warden", "scout", "drone"], p);
      if (!u) continue;
      u.__sxBossSummon = true;
      var hp = Math.max(70, (u.maxHp || 60));
      u.maxHp = hp;
      u.hp = hp;
      S.summons.push(u);
      made.push(u.variant || u.type || "drone");
    }
    emit("sx:boss2-summon", { count: made.length, kinds: made, at: S.clock });
    if (made.length) {
      try { G.hud.warn(boss2T("boss.summon.warn", "蜃 · 护盾无人机 ×{n}", { n: made.length }), 2.8); } catch (err) { soft("summon", err); }
      sfx("impact_metal", { gain: 0.6, pitch: 0.7 });
    }
  }

  function dashTarget() {
    var e = S.ref;
    if (!e) return null;
    var P = G.player;
    var from = e.pos.clone();
    var dir;
    if (P && P.alive) {
      dir = new THREE.Vector3(P.pos.x - from.x, 0, P.pos.z - from.z);
    } else {
      dir = new THREE.Vector3(Math.sin(e.yaw || 0), 0, Math.cos(e.yaw || 0));
    }
    var len = dir.length();
    if (len < 0.001) { dir.set(0, 0, 1); len = 1; }
    dir.multiplyScalar(1 / len);
    var dist = clamp(len, 2, 12);
    var to = from.clone().addScaledVector(dir, dist);
    var guard = 6;
    while (guard-- > 0 && !walkable(to.x, to.z)) {
      dist *= 0.8;
      to = from.clone().addScaledVector(dir, dist);
    }
    to.y = groundY(to.x, to.z);
    return to;
  }

  function updateDash(dt) {
    var e = S.ref;
    if (!e || !S.dashFrom || !S.dashTo) { finishMove(); return; }
    S.dashT += dt;
    var k = clamp(S.dashT / S.dashDur, 0, 1);
    var x = S.dashFrom.x + (S.dashTo.x - S.dashFrom.x) * k;
    var z = S.dashFrom.z + (S.dashTo.z - S.dashFrom.z) * k;
    try { e.pos.set(x, groundY(x, z), z); } catch (err) { soft("dash", err); }
    var P = G.player;
    if (!S.dashHit && P && P.alive) {
      var d = Math.hypot(P.pos.x - x, P.pos.z - z);
      if (d < 2.6) {
        S.dashHit = true;
        hurtPlayer(30, e.pos, "dash", d);
        shake(0.8);
      }
    }
    if (k >= 1) {
      try { G.fx.explosion(new THREE.Vector3(x, groundY(x, z) + 0.6, z), 1.1); } catch (err) { soft("dash", err); }
      finishMove();
    }
  }

  function ensureEmpOverlay() {
    if (S.empEl && S.empEl.parentNode) return S.empEl;
    try {
      var d = document.createElement("div");
      d.id = "sx-emp-overlay";
      document.body.appendChild(d);
      S.empEl = d;
      return d;
    } catch (e) { soft("emp-overlay", e); return null; }
  }

  function execEmp() {
    S.hudGlitch = 1.5;
    try { document.body.classList.add("sx-emp"); } catch (e) { soft("emp", e); }
    var over = ensureEmpOverlay();
    if (over) over.style.opacity = "1";
    emit("sx:emp", {
      source: "boss", enemy: S.ref, at: S.clock, duration: 1.5,
      radius: 999, pos: S.ref ? vec3(S.ref.pos) : null
    });
    try { if (G.hud && G.hud.warn) G.hud.warn(boss2T("boss.emp.warn", "EMP 脉冲 · HUD 故障 1.5s"), 2.6); } catch (e) { soft("emp", e); }
    sfx("alert", { gain: 0.7, pitch: 0.5 });
    S.shotsFired++;
  }

  function spawnEchoes() {
    if (!S.final || !S.ref) return 0;
    if (S.echoes.length) return 0;
    var base = S.ref.pos.clone();
    var mx = S.ref.maxHp || 1600;
    var hp = Math.max(120, Math.round(mx * 0.35));
    for (var k = 0; k < 2; k++) {
      var p = base.clone();
      p.x += k ? 4.5 : -4.5;
      p.z += k ? -3.2 : 3.2;
      if (!walkable(p.x, p.z)) { p.x = base.x + (k ? 3 : -3); p.z = base.z + 3; }
      p.y = groundY(p.x, p.z);
      var u = spawnKind(["elite", "hound"], p);
      if (!u) continue;
      u.maxHp = hp;
      u.hp = hp;
      u.elite = true;
      u.__sxEcho = true;
      u.shotDamage = 12;
      u.coolMul = 0.85;
      try { if (u.rig && u.rig.group) u.rig.group.scale.setScalar(1.35); } catch (e) { soft("echo", e); }
      S.echoes.push(u);
    }
    emit("sx:boss2-echo", { count: S.echoes.length, hp: hp, at: S.clock });
    if (S.echoes.length) {
      try { G.hud.warn(boss2T("boss.echo.warn", "残响 · 幻影投射 ×{n}", { n: S.echoes.length }), 3); } catch (e) { soft("echo", e); }
    }
    return S.echoes.length;
  }

  function execEcho() { spawnEchoes(); }

  /* ------------------------------------------------------- 召唤物维护 */
  function retireUnit(e) {
    if (!e) return;
    // V37：引擎没有 G.enemies.retire；回收必须走 debug.ctx.retire。
    // 先标记 sx2.dead，避免回收后残留的 post/召唤逻辑再跑一帧。
    try { if (e.sx2) e.sx2.dead = true; } catch (err) { soft("retire", err); }
    try {
      var ctx = G && G.enemies && G.enemies.debug && G.enemies.debug.ctx;
      if (e.active !== false && ctx && typeof ctx.retire === "function") ctx.retire(e);
    } catch (err) { soft("retire", err); }
  }
  function stepSummons() {
    for (var i = S.summons.length - 1; i >= 0; i--) {
      var e = S.summons[i];
      if (!e || !e.alive || e.active === false) {
        if (e) e.__sxBossSummon = false;
        S.summons.splice(i, 1);
      }
    }
  }
  function stepEchoes() {
    for (var i = S.echoes.length - 1; i >= 0; i--) {
      var e = S.echoes[i];
      if (!e || !e.alive || e.active === false) {
        if (e) e.__sxEcho = false;
        S.echoes.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------- EMP 故障 */
  function tickGlitch(dt) {
    if (S.glitchReset) { S.glitchReset = false; resetGlitch(); }
    if (!G || !G.game || G.game.state !== "playing") return;   // V37：暂停/非 playing 不推进
    if (S.hudGlitch > 0) {
      S.hudGlitch -= dt;
      var o = ensureEmpOverlay();
      if (o) o.style.opacity = String((0.12 + 0.55 * Math.abs(Math.sin(S.clock * 37))).toFixed(3));
      if (S.hudGlitch <= 0) resetGlitch();
    }
  }
  function resetGlitch() {
    S.hudGlitch = 0;
    try { document.body.classList.remove("sx-emp"); } catch (e) { soft("glitch-reset", e); }
    if (S.empEl) { try { S.empEl.style.opacity = "0"; } catch (e) { soft("glitch-reset", e); } }
  }

  /* ------------------------------------------------------- 遭遇管理 */
  function findBoss() {
    if (!G || !G.enemies) return null;
    var list = G.enemies.list || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e && e.boss && e.alive && e.active !== false) return e;
    }
    return null;
  }

  function scanBoss() {
    if (S.active) return;
    if (!G || !G.game || G.game.state !== "playing") return;
    var e = findBoss();
    if (e) adopt(e);
  }

  function adopt(e) {
    if (!e || !e.alive) return false;
    if (S.active && S.ref === e) return true;
    if (S.active) cleanup("re-adopt");
    resetRuntime();
    S.ref = e;
    S.active = true;
    var m = mission();
    S.final = isFinalMission(m) || !!e.__sxFinal;
    S.phase = phaseFrom(e);
    S.announced[0] = 1;
    S.globalCd = 0.6;
    S.barBase = "";
    S.barForce = true;
    emit("sx:boss2-start", { enemy: e, final: S.final, phase: S.phase, at: S.clock });
    return true;
  }

  function cleanup(reason) {
    // V37：无论是否有活动 BOSS，都摘掉血条 on 类，避免死亡后残留。
    // V53 CLI-1：DOM 操作交给下一帧 tickPresentation（逻辑层不查 DOM）。
    S.barStale = true;
    if (!S.active && !S.ref) return;
    var info = {
      reason: reason || "unknown",
      at: +S.clock.toFixed(2),
      timers: S.timers.length,
      summons: S.summons.length,
      echoes: S.echoes.length,
      fx: S.fx.length
    };
    S.cleanupInfo = info;
    clearTimers();
    var i;
    for (i = 0; i < S.summons.length; i++) {
      var su = S.summons[i];
      if (su) { su.__sxBossSummon = false; retireUnit(su); }
    }
    S.summons.length = 0;
    for (i = 0; i < S.echoes.length; i++) {
      var ec = S.echoes[i];
      if (ec) { ec.__sxEcho = false; retireUnit(ec); }
    }
    S.echoes.length = 0;
    cancelMove();
    clearFx();
    S.glitchReset = true;
    S.active = false;
    S.ref = null;
    S.barBase = "";
    S.barForce = true;
    emit("sx:boss2-dead", info);
  }

  function resetRuntime() {
    clearTimers();
    cancelMove();
    clearFx();
    resetGlitch();
    S.queue.length = 0;
    S.summons.length = 0;
    S.echoes.length = 0;
    S.cool = { stomp: 0.8, barrage: 2.6, dash: 4.0, emp: 6.0, summon: 1.6, echo: 2.0 };
    S.once = {};
    S.announced = {};
    S.phase = 0;
    S.final = false;
    S.clock = 0;
    S.move = null;
    S.stage = "";
    S.t = 0;
    S.lastMove = "";
    S.globalCd = 0;
    S.engineGap = 0;
    S.queue = [];
    S.hits = 0;
    S.shotsFired = 0;
    S.execCount = 0;
    S.telegraphCount = 0;
    S.barBase = "";
    S.lastBarSig = "";
    S.barForce = false;
    S.barStale = false;
    S.glitchReset = false;
    S.cleanupInfo = null;
    S.active = false;
    S.ref = null;
    S.dashFrom = S.dashTo = null;
    S.dashT = 0;
    S.dashHit = false;
    S.lock = null;
  }

  /* ------------------------------------------------------- 逻辑（固定步 60Hz） */
  // V53 CLI-1：scanBoss/冷却/阶段/移动/召唤/计时器都在固定步里推进，
  // 与渲染帧率解耦；__SX_LOOP.step(n) 因此能精确驱动 BOSS。
  function tickLogic(h) {
    if (!G || !G.game) return;
    // 暂停/标题/死亡/结算：逻辑与时钟都冻结（不改状态，不推进冷却）
    if (G.game.state !== "playing") return;
    if (!(typeof h === "number" && isFinite(h) && h > 0)) return;
    // V53 修正：BOSS 未激活时不累积 S.clock，避免重开行动后 hash 携带上一局时间。
    if (!S.active) {
      scanBoss();
      if (!S.active) return;
    }
    S.clock += h;
    if (!S.ref || !S.ref.alive || S.ref.active === false) { cleanup("dead"); return; }
    S.globalCd = Math.max(0, S.globalCd - h);
    S.engineGap = Math.max(0, S.engineGap - h);
    for (var id in S.cool) S.cool[id] = Math.max(0, S.cool[id] - h);
    updatePhase();
    updateMove(h);
    chooseMove();
    stepSummons();
    stepEchoes();
    tickTimers(h);
  }

  /* ------------------------------------------------------- 表现（渲染帧） */
  // 只做视觉/DOM：特效淡出、EMP 故障叠加、血条、调试面板。
  function tickPresentation(dt) {
    if (!G) return;
    if (!(typeof dt === "number" && isFinite(dt) && dt > 0)) dt = 0.016;
    var playing = !!(G.game && G.game.state === "playing");
    if (playing) tickFx(dt);          // 暂停时特效定格，恢复后继续
    tickGlitch(dt);                  // 内部自带 playing 门控与待重置标记
    syncBar(!!S.barForce);
    S.barForce = false;
    updateDebug();
  }

  /* ------------------------------------------------------- 调试面板 */
  function ensureDebug() {
    if (S.debugEl && S.debugEl.parentNode) return S.debugEl;
    try {
      var d = document.createElement("div");
      d.id = "sx-boss-debug";
      document.body.appendChild(d);
      S.debugEl = d;
      return d;
    } catch (e) { soft("debug-panel", e); return null; }
  }
  function toggleDebug() {
    S.debug = !S.debug;
    var d = S.debug ? ensureDebug() : S.debugEl;
    if (d) d.style.display = S.debug ? "block" : "none";
    updateDebug();
  }
  function updateDebug() {
    if (!S.debug) return;
    var d = ensureDebug();
    if (!d) return;
    var html = "<b>BOSS 攻击冷却 · F6</b>";
    if (!S.active) {
      try { d.innerHTML = html + '<div class="row">无 BOSS</div>'; } catch (e) { soft("debug-draw", e); }
      return;
    }
    var e = S.ref || {};
    var pct = (e.maxHp ? Math.round((e.hp / e.maxHp) * 100) : 0);
    var name = phaseName(S.phase, S.final);
    html += '<div class="row">' + name + " · HP " + pct + "%" + (S.final ? " · 终形" : "") + "</div>";
    var mv = S.move ? MOVES[S.move] : null;
    html += '<div class="row">当前 ' + (mv ? mv.label + (S.stage === "telegraph" ? "（预警 " + Math.max(0, mv.telegraph - S.t).toFixed(1) + "s）" : "（执行）") : "—") + "</div>";
    var ids = attacksFor(S.phase);
    var parts = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (MOVES[id].source) continue;
      var cd = coolOf(id);
      parts.push(id + " " + (S.once[id] ? "✓" : cd > 0 ? cd.toFixed(1) + "s" : "READY"));
    }
    html += '<div class="row">' + parts.join(" · ") + "</div>";
    try { d.innerHTML = html; } catch (e) { soft("debug-draw", e); }
  }

  /* ------------------------------------------------------- 对外 API */
  function stateSnapshot() {
    var e = S.ref;
    var bar = null;
    try {
      var b = document.querySelector(".x-boss");
      if (b) {
        var pips = b.querySelectorAll(".x-boss-pips em");
        var on = 0;
        for (var i = 0; i < pips.length; i++) if (pips[i].classList.contains("on")) on++;
        var tk = b.querySelector(".x-boss-k");
        bar = {
          exists: true, title: tk ? tk.textContent : "", pipsOn: on,
          pipsTotal: pips.length, visible: b.classList.contains("on")
        };
      }
    } catch (err) { soft("bar-state", err); }
    var cds = {};
    for (var id in S.cool) cds[id] = +S.cool[id].toFixed(2);
    return {
      version: VERSION,
      active: S.active,
      phase: S.phase,
      phaseNo: S.phase + 1,
      phaseName: phaseName(S.phase, S.final),
      final: S.final,
      rateMul: rateMul(),
      hp: e ? Math.round(e.hp) : 0,
      maxHp: e ? Math.round(e.maxHp || 0) : 0,
      ratio: e && e.maxHp ? +(e.hp / e.maxHp).toFixed(3) : 0,
      move: S.move,
      stage: S.stage,
      moveT: +S.t.toFixed(2),
      telegraph: S.move ? MOVES[S.move].telegraph : 0,
      cooldowns: cds,
      attacks: attacksFor(S.phase),
      shots: S.shotsFired,
      hits: S.hits,
      execs: S.execCount,
      telegraphEvents: S.telegraphCount,
      timers: S.timers.length,
      telegraphs: S.telegraphs,
      summons: S.summons.length,
      echoes: S.echoes.length,
      glitch: +S.hudGlitch.toFixed(2),
      debug: S.debug,
      clock: +S.clock.toFixed(2),
      bar: bar,
      engine: e ? {
        bossPhase: e.bossPhase | 0,
        volleyCd: +(e.volleyCd || 0).toFixed(2),
        stompCd: +(e.stompCd || 0).toFixed(2)
      } : null,
      lastCleanup: S.cleanupInfo
    };
  }

  function trySpawnBoss() {
    if (!G || !G.enemies) return null;
    var P = G.player;
    var x = 6, z = 16;
    if (P) {
      x = P.pos.x + Math.sin(P.yaw || 0) * 14;
      z = P.pos.z + Math.cos(P.yaw || 0) * 14;
    }
    if (!walkable(x, z)) { x = 6; z = 16; }
    var e = null;
    try {
      e = G.enemies.spawn("boss", new THREE.Vector3(x, groundY(x, z), z), {
        state: "alert", target: P ? P.pos : null
      });
    } catch (err) { soft("spawn-boss", err); e = null; }
    if (e) { try { G.game.run.bossAlive = true; } catch (err2) { soft("spawn-boss", err2); } }
    return e;
  }

  function spawnFinal() {
    var e = S.ref || findBoss();
    if (!e) e = trySpawnBoss();
    if (!e) return { ok: false, reason: "no-boss" };
    if (!S.active) adopt(e);
    if (!S.ref) return { ok: false, reason: "no-boss" };
    e.__sxFinal = true;
    e.maxHp = 2600;
    var ratios = [0.95, 0.60, 0.20];
    e.hp = Math.max(1, Math.round(2600 * ratios[S.phase]));
    e.bossPhase = S.phase;
    e.variant = boss2T("boss.final.name", "蜃 · 终形");
    S.final = true;
    S.barBase = boss2T("boss.final.name", "蜃 · 终形");
    S.once.echo = 0;
    spawnEchoes();
    syncBar(true);
    emit("sx:boss2-final", { enemy: e, at: S.clock });
    try { if (G.hud && G.hud.warn) G.hud.warn(boss2T("boss.final.warn", "蜃 · 终形 · 残响展开"), 3.5); } catch (err) { soft("final", err); }
    sfx("alert", { gain: 0.8, pitch: 0.55 });
    return stateSnapshot();
  }

  // V53 ARCH-3：确定性状态快照（无 DOM 查询），供 __SX_LOOP 的 stateHash
  // 与无头单测使用；字段全部来自固定步逻辑，不含任何渲染/时间随机量。
  function logicState() {
    var e = S.ref;
    var cds = {};
    for (var id in S.cool) cds[id] = +(+S.cool[id] || 0).toFixed(3);
    return {
      active: !!S.active,
      phase: S.phase | 0,
      final: !!S.final,
      hp: e ? Math.round(e.hp || 0) : 0,
      maxHp: e ? Math.round(e.maxHp || 0) : 0,
      move: S.move || "",
      stage: S.stage || "",
      cooldowns: cds,
      clock: +(+S.clock || 0).toFixed(3),
      globalCd: +(+S.globalCd || 0).toFixed(3),
      timers: S.timers.length,
      summons: S.summons.length,
      echoes: S.echoes.length,
      queue: S.queue.length ? S.queue.join(">") : ""
    };
  }

  window.__SX_BOSS = {
    version: VERSION,
    state: function () { return stateSnapshot(); },
    logicState: logicState,
    attacks: function () { return attacksFor(S.phase); },
    forcePhase: function (n) { return forcePhase(n); },
    spawnFinal: function () { return spawnFinal(); }
  };
  window.__SX_BOSS2 = { version: VERSION, state: function () { return stateSnapshot(); } };

  /* ------------------------------------------------------- 样式 */
  function ensureCss() {
    try {
      if (document.getElementById("sx-boss2-css")) return;
      var css = document.createElement("style");
      css.id = "sx-boss2-css";
      css.textContent = [
        "#sx-emp-overlay{position:fixed;inset:0;pointer-events:none;z-index:70;opacity:0;background:repeating-linear-gradient(0deg,rgba(255,90,46,.28) 0px,rgba(255,90,46,.28) 2px,rgba(0,0,0,0) 2px,rgba(0,0,0,0) 5px);mix-blend-mode:screen;transition:opacity .08s linear;}",
        "body.sx-emp .hud,body.sx-emp #hud{filter:contrast(1.7) saturate(.25) hue-rotate(80deg);animation:sxHudJitter .1s steps(2) infinite;}",
        "@keyframes sxHudJitter{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,-2px)}100%{transform:translate(1px,2px)}}",
        "#sx-boss-debug{position:fixed;left:12px;bottom:96px;z-index:80;display:none;min-width:250px;padding:8px 10px;background:rgba(6,8,10,.82);border-left:2px solid #ff5a2e;font:500 10px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e4da;letter-spacing:.04em;pointer-events:none;}",
        "#sx-boss-debug b{display:block;font-size:9px;letter-spacing:.16em;color:#ff5a2e;margin-bottom:4px;}",
        "#sx-boss-debug .row{white-space:nowrap;}"
      ].join("\n");
      document.head.appendChild(css);
    } catch (e) { soft("css", e); }
  }

  /* ------------------------------------------------------- 事件 */
  function onBossStart(ev) {
    if (ev && ev.enemy && ev.enemy.alive) adopt(ev.enemy);
  }
  function onKilled(ev) {
    if (!ev || !ev.enemy) return;
    var e = ev.enemy;
    if (S.active && e === S.ref) { cleanup("killed"); return; }
    if (e.__sxEcho) {
      var i = S.echoes.indexOf(e);
      if (i >= 0) S.echoes.splice(i, 1);
      e.__sxEcho = false;
    }
    if (e.__sxBossSummon) {
      var j = S.summons.indexOf(e);
      if (j >= 0) S.summons.splice(j, 1);
      e.__sxBossSummon = false;
    }
  }
  function onBossDeadEvent() { cleanup("sx:boss-dead"); }
  function onEnemyFire(ev) {
    if (ev && ev.enemy && ev.enemy === S.ref) S.engineGap = 0.45;
  }
  function onEnemyMelee(ev) {
    if (ev && ev.enemy && ev.enemy === S.ref) S.engineGap = 0.45;
  }
  function onKey(ev) {
    if (!ev) return;
    var k = ev.key || "";
    if (k === "F6" || ev.keyCode === 117) {
      try { ev.preventDefault(); } catch (e) { soft("key", e); }
      toggleDebug();
    }
  }

  try { document.addEventListener("keydown", onKey, true); } catch (e) { soft("key-bind", e); }

  /* ------------------------------------------------------- 系统注册 */
  var sys = {
    id: "boss2",
    deps: [],
    init: function (ctx) {
      G = (ctx && ctx.G) || window.__G;
      THREE = (ctx && ctx.THREE) || (G && G.THREE);
      ensureCss();
      if (G && G.events) {
        G.events.on("sx:boss-start", onBossStart);
        G.events.on("sx:boss-dead", onBossDeadEvent);
        G.events.on("enemy:killed", onKilled);
        G.events.on("enemy:fire", onEnemyFire);
        G.events.on("enemy:melee", onEnemyMelee);
      }
    },
    // V53 CLI-1：玩法逻辑走固定步；update 只做表现（DOM/特效）。
    fixedUpdate: function (cmd, h) {
      try { tickLogic(h); } catch (e) { soft("fixedUpdate", e); }
    },
    update: function (dt) {
      try { tickPresentation(dt); } catch (e) { soft("presentation", e); }
    },
    onState: function (next) {
      if (next === "intro" || next === "title" || next === "dead" || next === "result") cleanup("state:" + next);
      else if (next === "playing") scanBoss();
    },
    dispose: function () { cleanup("dispose"); }
  };

  var registerFails = 0;
  function tryRegister() {
    if (registered) return true;
    try {
      if (window.SX_SYSTEMS && window.SX_SYSTEMS.register) {
        window.SX_SYSTEMS.register(sys);
        registered = true;
        return true;
      }
    } catch (e) {
      // 低频启动失败保留一条 console.error，之后按标签限频
      if (++registerFails === 1) console.error("[boss2] register", e);
      else soft("register", e);
    }
    return false;
  }
  if (!tryRegister()) {
    var tries = 0;
    var iv = setInterval(function () {
      if (tryRegister() || ++tries > 1200) clearInterval(iv);
    }, 50);
  }
})();
