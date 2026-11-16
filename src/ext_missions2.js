/* =====================================================================
   SALTLINE · src/ext_missions2.js — V34 · 对手（WP34-6 / WP34-7）
   ---------------------------------------------------------------------
   1) 任务目标图执行器：读取当前任务的 objectivesGraph（cut/kill/hold/boss/evac），
      在引擎既有「中继 → 撤离」流程之上用事件驱动追加阶段；只有
      mission.objectivesGraph 存在时才启用，六关原流程完全不受影响。
   2) 持久化检查点：把位置/朝向/血量/护甲/弹药/手雷/已切中继/目标图进度
      写入统一存档 campaign.checkpoint（saltline.save），刷新后可恢复；
      重新开始行动（intro）时清空。
   3) 核心舱（core）单机中继：为 m8 在 core 地图上生成 3 处可交互中继
      （复用 G.props.build("relay_node") + G.physics.addBox，等价于
      campaign 的 relayPool 构建逻辑）。
   4) 行动档案：八关 x-eight 网格 + 「继续行动」入口。

   独立 IIFE，由 build.cjs 的 features 段自动加载；只通过
   window.__G / window.__SX / window.__SX_CAMP 与既有模块交互。
   ===================================================================== */
(function () {
  "use strict";
  // V54 ARCH-2：空 catch 不再静默吞错。软错误统一走 window.SXErrors.soft("missions2:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 window.__errors。
  function soft(tag, e) {
    if (typeof window === "undefined" || !window) return;
    var forwarded = false;
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") { window.SXErrors.soft("missions2:" + tag, e); forwarded = true; }
    } catch (_) { forwarded = false; }
    if (forwarded) return;
    try {
      if (window.__errors) {
        window.__errors.push("[missions2:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { return; }
  }

  if (window.__SX_MISSIONS2__) return;
  window.__SX_MISSIONS2__ = true;

  var G = null, S = null, API = null;
  var booted = false;
  var gr = null;                 // 目标图运行态
  var pendingRestore = null;     // 从档案「继续行动」挂起的检查点
  var cpCache = null;            // 最近一次检查点（内存）
  var bossSeen = false, bossDead = false;
  var lastHud = "", hudT = 0, uiT = 0;
  var corePool = {}, coreGroup = null;
  var CORE_RELAYS = [
    { id: "core_r1", label: "西侧冷却中继", x: -13.5, z: 6 },
    { id: "core_r2", label: "东侧回响中继", x: 13.5, z: -6 },
    { id: "core_r3", label: "南侧核心中继", x: 0, z: -9.8 }
  ];

  /* ------------------------------------------------------------- helpers */
  function mission() { return (G && G.game && G.game.currentMission) || null; }
  function run() { return (G && G.game && G.game.run) || null; }
  function mapId() { try { return window.__SX.mapId(); } catch (e) { return null; } }
  function num(v, def) { return typeof v === "number" && isFinite(v) ? v : def; }
  function ceil0(v) { return Math.max(0, Math.ceil(v)); }
  function logErr(where, e) { try { console.error("[missions2] " + where, e); } catch (_) { /* 纯日志输出：诊断通道自身不可用，保持静默（ARCH-2 白名单） */ } }
  function hasGraph(m) { return !!(m && m.objectivesGraph && m.objectivesGraph.length); }
  function missionById(id) {
    var ms = (API && API.missions) || [];
    for (var i = 0; i < ms.length; i++) if (ms[i] && ms[i].id === id) return ms[i];
    return null;
  }
  // V37：联机（__MP）接管时，本模块不注入战役中继 / 检查点目标。
  function mpActive() {
    try {
      var mp = window.__MP;
      if (!mp || typeof mp.state !== "function") return false;
      var st = mp.state();
      return !!(st && (st.active || st.joining));
    } catch (e) { return false; }
  }
  function holdZone(o, m) {
    if (o && o.at) return o.at;
    // V37：hold 阶段必须有区域；数据缺 at 时回退到任务撤离点，避免用 allCut 无限坚守
    if (o && o.type === "hold" && m && m.extraction) {
      return { x: m.extraction.x, z: m.extraction.z, r: m.extraction.radius || 2.6 };
    }
    return null;
  }

  /* --------------------------------------------------------------- CSS */
  function injectCSS() {
    if (document.getElementById("sx2-css")) return;
    var css = document.createElement("style");
    css.id = "sx2-css";
    css.textContent = [
      "/* V34 · 八关行动卡：桌面 4 列 × 2 行，训练卡独占一行（自适应） */",
      ".x-camp-list.x-eight{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}",
      ".x-camp-list.x-eight .x-mcard{min-height:132px;padding:14px 14px 12px;}",
      ".x-camp-list.x-eight .x-mcard h3{font-size:19px;margin:6px 0 2px;}",
      ".x-camp-list.x-eight .x-mcard p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:8px;font-size:11px;line-height:1.55;}",
      ".x-camp-list.x-eight .x-mcard .meta{margin-top:8px;}",
      ".x-camp-list.x-eight .x-train-card{grid-column:1 / -1;min-height:0;display:flex;align-items:center;gap:16px;padding:10px 14px;}",
      ".x-camp-list.x-eight .x-train-card h3{margin:0;font-size:16px;}",
      ".x-camp-list.x-eight .x-train-card p{display:none;}",
      ".x-camp-list.x-eight .x-train-card .meta{margin:0 0 0 auto;}",
      ".x-continue{white-space:nowrap;}",
      "@media (max-width:1060px){.x-camp-list.x-eight{grid-template-columns:repeat(2,minmax(0,1fr));}}",
      "@media (max-width:620px){.x-camp-list.x-eight{grid-template-columns:minmax(0,1fr);}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(css);
  }

  /* =================================================================
     一、目标图执行器
     ================================================================= */
  function resetGraph() {
    gr = null;
    bossSeen = false;
    bossDead = false;
    lastHud = "";
  }

  function initGraph() {
    var m = mission();
    if (!m || !m.objectivesGraph || !m.objectivesGraph.length || m.id === "train") { gr = null; return null; }
    if (gr && gr.missionId === m.id) return gr;
    gr = {
      missionId: m.id,
      phases: m.objectivesGraph.map(function (o) {
        return {
          type: String((o && o.type) || ""),
          count: Math.max(0, (o && o.count) | 0),
          seconds: Math.max(0, num(o && o.seconds, 0)),
          at: holdZone(o, m),
          text: (o && o.text) || "",
          state: "locked",
          progress: 0
        };
      }),
      active: 0,
      evacOpen: false,
      complete: false
    };
    bossSeen = false;
    bossDead = false;
    activate(gr.phases[0]);
    return gr;
  }

  function activate(p) {
    if (!p || p.state !== "locked") return;
    p.state = "active";
    p.progress = 0;
    try { gr.active = gr.phases.indexOf(p); } catch (e) { soft("activate-graph", e); }
    announce(p, true);
    if (p.type === "evac") openEvac();
  }

  function nextPhase(p) {
    if (!gr) return;
    var i = gr.phases.indexOf(p);
    var n = gr.phases[i + 1];
    if (n && n.state === "locked") activate(n);
    else if (!n) gr.complete = true;
  }

  function completePhase(p) {
    if (!gr || !p || p.state !== "active") return;
    p.state = "done";
    if (p.type === "cut") p.progress = p.count;
    if (p.type === "hold") p.progress = p.seconds;
    announce(p, false);
    saveCP();
    nextPhase(p);
  }

  function announce(p, start) {
    if (!p) return;
    var say = null;
    if (p.type === "cut" && start) {
      say = "切断 " + (p.count || 1) + " 处上行中继，先让这片区域安静下来。";
    } else if (p.type === "kill") {
      say = start ? "中继断开，但敌人正在合围——清除 " + p.count + " 个敌对目标。" : "区域清空，撤离区即将暴露。";
      if (start) hudwarn("清除敌对单位 · " + p.count);
    } else if (p.type === "hold") {
      say = start ? "撤离区已暴露，坚守 " + ceil0(p.seconds) + " 秒！" : "坚守完成，撤离通道准备打开。";
      if (start) hudwarn("坚守撤离区 · " + ceil0(p.seconds) + " 秒");
    } else if (p.type === "boss") {
      say = start ? "蜃·残响正在成形——摧毁它！" : "蜃·残响瓦解了。";
    } else if (p.type === "evac" && start) {
      say = "撤离通道已打开，前往撤离点！";
    }
    if (say) { try { G.hud.radio(say, 4); } catch (e) { soft("radio", e); } }
  }

  function hudwarn(text) {
    try { G.hud.warn(text, 3); } catch (e) { soft("warn", e); }
  }

  function openEvac() {
    if (!gr) return;
    gr.evacOpen = true;
    var m = mission(), r = run();
    if (r && !(m && m.boss)) r.evacT = 0; // 非 BOSS 关：阶段全部完成即开放撤离
    refreshMarkers();
  }

  function objectiveText() {
    if (!gr && G && G.game && G.game.state === "playing") { try { initGraph(); } catch (e) { soft("objective-text", e); } }
    if (!gr) return "";
    var p = gr.phases[gr.active];
    var m = mission() || {};
    var r = run() || { cut: 0 };
    if (!p) return m.done || "";
    if (gr.complete) return m.extractText || "前往撤离点";
    switch (p.type) {
      case "cut":
        return (m.goal || "切断上行中继") + " " + Math.min(p.count, r.cut | 0) + "/" + p.count;
      case "kill":
        return "清除敌对单位 " + Math.min(p.count, p.progress | 0) + "/" + p.count;
      case "hold":
        return "坚守撤离区 · " + ceil0(p.seconds - p.progress) + " 秒";
      case "boss":
        return "摧毁 " + (m.bossName || "蜃 · 残响");
      case "evac":
        return m.extractText || "前往撤离点";
      default:
        return p.text || "";
    }
  }

  function inZone(at) {
    if (!at || !G.player) return false;
    var x = num(at.x, 0), z = num(at.z, 0), r = num(at.r, num(at.radius, 6));
    return Math.hypot(G.player.pos.x - x, G.player.pos.z - z) <= r;
  }

  function gateEvac() {
    if (!gr || gr.evacOpen) return;
    var r = run();
    if (!r) return;
    // 阶段未全部完成前锁住撤离窗口（引擎的 ue() 只在 evacT<=0 时允许登船）
    if (r.allCut && !(r.evacT > 0.5)) r.evacT = 0.5;
  }

  function hudTick(dt) {
    hudT -= dt;
    if (hudT > 0) return;
    hudT = 0.12;
    var t = objectiveText();
    if (t && t !== lastHud) {
      lastHud = t;
      try { G.hud.setObjective(t); } catch (e) { soft("hud-objective", e); }
    }
  }

  function updateGraph(dt) {
    if (!gr) return;
    if (G.game.state !== "playing") return;
    var p = gr.phases[gr.active];
    var r = run();
    if (p && p.state === "active" && r) {
      if (p.type === "cut") {
        p.progress = Math.min(p.count, r.cut | 0);
        if (p.progress >= p.count) completePhase(p);
      } else if (p.type === "kill") {
        if (p.progress >= p.count) completePhase(p);
      } else if (p.type === "hold") {
        var open = p.at ? inZone(p.at) : !!r.allCut;
        if (open) {
          p.progress = Math.min(p.seconds, p.progress + dt);
          if (p.progress >= p.seconds) completePhase(p);
        }
      } else if (p.type === "boss") {
        if (bossDead || (!r.bossAlive && bossSeen)) completePhase(p);
      }
    }
    gateEvac();
    hudTick(dt);
  }

  /* =================================================================
     二、核心舱（core）三处中继
     ================================================================= */
  function ensureCoreRelays() {
    if (mpActive()) return null;   // V37：联机绝不注入 core 中继
    if (!G || !G.props || !G.physics || mapId() !== "core") return null;
    var T = G.THREE;
    if (!coreGroup) {
      coreGroup = new T.Group();
      coreGroup.name = "core_relays";
      try { G.scene.add(coreGroup); } catch (e) { return null; }
    }
    coreGroup.visible = true;
    for (var i = 0; i < CORE_RELAYS.length; i++) {
      var def = CORE_RELAYS[i];
      if (corePool[def.id]) continue;
      var y = 0.42;
      try {
        var h = G.physics.groundHeight(def.x, def.z, 3);
        if (typeof h === "number" && isFinite(h)) y = h;
      } catch (e) { soft("ground-height", e); }
      var g = null;
      try { g = G.props.build("relay_node"); } catch (e) { g = null; }
      if (!g) continue;
      g.position.set(def.x, y, def.z);
      coreGroup.add(g);
      g.updateMatrixWorld(true);
      var cols = (g.userData && g.userData.colliders) || [];
      var desc = [];
      for (var c = 0; c < cols.length; c++) {
        var col = cols[c];
        desc.push({
          min: [col.min[0] + def.x, col.min[1] + y, col.min[2] + def.z],
          max: [col.max[0] + def.x, col.max[1] + y, col.max[2] + def.z],
          opts: { surface: col.surface || "metal", bulletOnly: !!col.bulletOnly }
        });
      }
      corePool[def.id] = { object: g, pos: new T.Vector3(def.x, y, def.z), boxes: [], desc: desc };
    }
    ensureCoreColliders();
    var list = CORE_RELAYS.filter(function (d) { return !!corePool[d.id]; }).map(function (d) {
      var p = corePool[d.id];
      return { id: "relay_" + d.id, label: d.label, zone: "core", pos: p.pos, object: p.object };
    });
    if (list.length) G.level.objectives = list;
    return list;
  }

  function ensureCoreColliders() {
    var id, need = false;
    for (id in corePool) {
      var e = corePool[id];
      if (!e.boxes.length || G.physics.boxes.indexOf(e.boxes[0]) < 0) { need = true; break; }
    }
    if (!need) return;
    for (id in corePool) {
      var ent = corePool[id];
      ent.boxes = [];
      for (var i = 0; i < ent.desc.length; i++) {
        var d = ent.desc[i];
        try { ent.boxes.push(G.physics.addBox(d.min, d.max, d.opts)); } catch (err) { soft("add-box", err); }
      }
    }
    try { G.physics.build(); } catch (e) { soft("physics-build", e); }
  }

  /* =================================================================
     三、检查点（WP34-7）
     ================================================================= */
  function buildCP(m, r) {
    var P = G.player, w = G.weapon;
    var p = gr ? gr.phases[gr.active] : null;
    return {
      v: 2,
      missionId: m.id,
      missionIndex: API && API.index ? API.index() : 0,
      tick: +(r.time || 0).toFixed(2),
      objective: p ? objectiveText() : "",
      player: {
        pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
        yaw: +(P.yaw || 0).toFixed(3),
        pitch: +(P.pitch || 0).toFixed(3),
        health: +(P.health || 0).toFixed(1),
        armor: +(P.armor || 0).toFixed(1)
      },
      ammo: (w && w.ammo) | 0,
      reserve: (w && w.reserve) | 0,
      slot: (w && w.activeIndex) | 0,
      grenades: (S && S.grenades) | 0,
      cut: r.cut | 0,
      relays: (r.relays || []).filter(function (x) { return x.cut; }).map(function (x) { return String(x.id); }),
      objectives: gr ? gr.phases.map(function (x) {
        return { type: x.type, state: x.state, progress: +x.progress.toFixed(2) };
      }) : null,
      stats: {
        time: +(r.time || 0).toFixed(2),
        kills: (G.combat && G.combat.stats && G.combat.stats.kills) | 0,
        retries: r.retries | 0
      },
      savedAt: Date.now()
    };
  }

  function hydrate(cp) {
    if (!cp || !cp.player || !G) return null;
    var T = G.THREE, p = cp.player;
    return {
      pos: new T.Vector3(num(p.pos[0], 0), num(p.pos[1], 0), num(p.pos[2], 0)),
      yaw: num(p.yaw, 0),
      pitch: num(p.pitch, 0),
      health: num(p.health, 100),
      armor: num(p.armor, 0),
      ammo: num(cp.ammo, 0),
      reserve: num(cp.reserve, 0),
      grenades: num(cp.grenades, 0),
      cut: num(cp.cut, 0),
      missionId: cp.missionId,
      phases: cp.objectives || null,
      relays: cp.relays || [],
      tick: num(cp.tick, 0)
    };
  }

  function saveCP() {
    if (!booted) return null;
    var m = mission(), r = run();
    if (!m || !r || m.id === "train") return null;
    if (!hasGraph(m)) return null;   // V37：只有 objectivesGraph 任务保存检查点
    var st = G.game.state;
    if (st !== "playing" && st !== "paused" && st !== "dead") return null;
    var cp = buildCP(m, r);
    cpCache = cp;
    try { if (API) API.setCheckpoint(cp); } catch (e) { logErr("save", e); }
    try { S.checkpoint = hydrate(cp); } catch (e) { soft("checkpoint-hydrate", e); }
    try { if (window.SXSave && SXSave.flush) SXSave.flush(); } catch (e) { soft("save-flush", e); }
    return cp;
  }

  function clearCP() {
    cpCache = null;
    try { if (API) API.clearCheckpoint(); } catch (e) { soft("clear-checkpoint", e); }
    try { if (S) S.checkpoint = null; } catch (e) { soft("clear-memory", e); }
    try { if (window.SXSave && SXSave.flush) SXSave.flush(); } catch (e) { soft("save-flush-clear", e); }
  }

  function loadCP() {
    try {
      var cp = API && API.checkpoint ? API.checkpoint() : null;
      if (!cp || cp.v !== 2 || !cp.player || !Array.isArray(cp.player.pos)) return null;
      // V37：旧档里六关检查点不再恢复（只有目标图任务支持检查点）
      var mm = missionById(cp.missionId);
      if (!hasGraph(mm)) return null;
      return cp;
    } catch (e) { return null; }
  }

  function cutOne(x) {
    if (!x || x.cut) return false;
    x.cut = true;
    x.t = 1;
    x.cutting = false;
    setRelayState(x.o && x.o.object, "cut");
    return true;
  }

  // V37：优先按检查点里的 relay id 恢复；缺 id 的旧档才按索引前缀回退。
  function restoreCut(n, ids) {
    var r = run();
    if (!r || !r.relays) return;
    var total = r.relays.length;
    n = Math.max(n | 0, r.cut | 0);
    n = Math.min(n, total);
    var byId = null, i, x, cutCount = 0;
    if (ids && ids.length) {
      byId = {};
      for (i = 0; i < ids.length; i++) byId[String(ids[i])] = 1;
    }
    for (i = 0; i < total; i++) {
      x = r.relays[i];
      if (byId ? byId[String(x.id)] : i < n) cutOne(x);
    }
    // 旧档 / 数据缺失时补足到 cp.cut（只补未切断的，不覆盖按 id 恢复的结果）
    for (i = 0; i < total; i++) if (r.relays[i].cut) cutCount++;
    for (i = 0; i < total && cutCount < n; i++) {
      if (cutOne(r.relays[i])) cutCount++;
    }
    r.cut = cutCount;
    r.allCut = total > 0 && cutCount >= total;
    try { G.hud.setRelays(cutCount, total); } catch (e) { soft("hud-relays", e); }
    refreshMarkers();
  }

  function setRelayState(obj, state) {
    try {
      var d = obj && obj.userData;
      if (d && typeof d.setState === "function") d.setState(state);
    } catch (e) { soft("relay-state", e); }
  }

  function refreshMarkers() {
    var r = run(), s = G.level;
    if (!r || !G.hud.setMarkers) return;
    var out = [];
    for (var i = 0; i < r.relays.length; i++) {
      var x = r.relays[i];
      if (x.cut) continue;
      out.push({ id: x.id, short: x.short, label: (x.o && x.o.label) || ("中继 " + x.short), pos: x.o.pos, kind: "relay" });
    }
    if (r.allCut && r.evacT <= 0 && !r.bossAlive && s.extraction) {
      out.push({ id: "extract", short: "撤离", label: "撤离点", pos: s.extraction.pos, kind: "extract" });
    }
    try { G.hud.setMarkers(out); } catch (e) { soft("hud-markers", e); }
  }

  function restorePhases(list) {
    if (!gr || !list) return;
    var i, p, s;
    for (i = 0; i < gr.phases.length && i < list.length; i++) {
      p = gr.phases[i];
      s = list[i];
      if (!p || !s) continue;
      p.state = s.state === "done" ? "done" : (s.state === "active" ? "active" : "locked");
      p.progress = Math.min(num(s.progress, 0), p.type === "hold" ? p.seconds : p.count);
    }
    gr.complete = true;
    gr.active = gr.phases.length - 1;
    for (i = 0; i < gr.phases.length; i++) {
      if (gr.phases[i].state !== "done") { gr.active = i; gr.complete = false; break; }
    }
    p = gr.phases[gr.active];
    if (p && p.state === "locked") p.state = "active";
    gr.evacOpen = !!(p && p.type === "evac");
    if (gr.evacOpen) {
      var m = mission(), r = run();
      if (m && m.boss) {
        if (bossPhaseDone()) { r.bossAlive = false; r.evacT = num(m.bossEvac, 30); }
      } else r.evacT = 0;
    }
    refreshMarkers();
    lastHud = "";
  }

  function bossPhaseDone() {
    if (!gr) return false;
    for (var i = 0; i < gr.phases.length; i++) {
      if (gr.phases[i].type === "boss" && gr.phases[i].state === "done") return true;
    }
    return false;
  }

  function restoreAll(cp, refill) {
    if (!cp || !cp.player || !G || !G.player) return false;
    var m = mission();
    if (!m || m.id !== cp.missionId) return false;
    if (!hasGraph(m)) return false;   // V37：非目标图任务不恢复检查点
    var P = G.player, r = run();
    try {
      P.reset({ pos: new G.THREE.Vector3(num(cp.player.pos[0], 0), num(cp.player.pos[1], 0), num(cp.player.pos[2], 0)), yaw: num(cp.player.yaw, 0) });
    } catch (e) { logErr("restore-reset", e); }
    if (refill) {
      P.health = Math.max(45, num(cp.player.health, 0));
      P.armor = Math.max(25, num(cp.player.armor, 0));
      if (S) { S.armor = P.armor; S.grenades = Math.max(1, num(cp.grenades, 0)); }
      var w = G.weapon;
      if (w) {
        w.ammo = Math.max(w.ammo || 0, num(cp.ammo, 0));
        w.reserve = Math.max(w.reserve || 0, num(cp.reserve, 0));
      }
    }
    restoreCut(num(cp.cut, 0), cp.relays);
    restorePhases(cp.objectives);
    if (r) r.time = num(cp.tick, 0);   // V37：还原行动计时，避免检查点后计时归零
    if (m.boss && gr) {
      if (bossPhaseDone()) {
        if (r) { r.bossAlive = false; r.evacT = num(m.bossEvac, 30); }
        try { if (m.bossName) G.hud.warn(m.bossName + " 已瓦解 · 登船窗口 " + num(m.bossEvac, 30) + " 秒", 3.5); } catch (e) { soft("boss-warn", e); }
      } else if (r && r.allCut) {
        window.setTimeout(function () {
          try { if (G.game.state === "playing") API.bossStart(); } catch (e) { soft("boss-start", e); }
        }, 1200);
      }
    }
    try { G.hud.message("检查点已恢复", 2.2); } catch (e) { soft("hud-message", e); }
    cpCache = cp;
    try { S.checkpoint = hydrate(cp); } catch (e) { soft("checkpoint-hydrate", e); }
    return true;
  }

  /* =================================================================
     四、事件接线
     ================================================================= */
  function hookEvents() {
    G.events.on("enemy:killed", function (ev) {
      if (!gr) return;
      var p = gr.phases[gr.active];
      if (!p || p.type !== "kill" || p.state !== "active") return;
      var e = ev && ev.enemy;
      if (e && (e.trainTarget || e.variant === "target")) return;
      p.progress = Math.min(p.count, p.progress + 1);
      if (p.progress >= p.count) completePhase(p);
    });

    G.events.on("objective:done", function () {
      if (!gr) return;
      var p = gr.phases[gr.active];
      if (p && p.type === "cut") {
        p.progress = Math.min(p.count, (run() || { cut: 0 }).cut | 0);
        if (p.progress >= p.count) completePhase(p);
      }
      saveCP();
    });

    G.events.on("objective:all", function () {
      if (!gr) return;
      saveCP();
      lastHud = "";
    });

    G.events.on("sx:boss-start", function () { bossSeen = true; });

    G.events.on("sx:boss-dead", function () {
      bossDead = true;
      if (!gr) return;
      var p = gr.phases[gr.active];
      if (p && p.type === "boss") completePhase(p);
      saveCP();
    });

    G.events.on("extraction:reached", function () {
      if (!gr) return;
      var p = gr.phases[gr.active];
      if (p && p.type === "evac") { p.state = "done"; gr.complete = true; }
      // 通关后保留检查点一个版本周期：档案页仍可回看/重打最后一战；
      // 下一次 intro（新行动）会清空。
    });

    G.events.on("sx:revive", function () {
      var cp = cpCache || loadCP();
      if (cp) restoreAll(cp, true);
    });

    G.events.on("game:state", function (e) {
      if (!e) return;
      if (e.state === "intro" || e.state === "title") {
        resetGraph();
        if (e.state === "intro") clearCP();
      }
      if (e.state === "playing") {
        initGraph();
        if (pendingRestore) {
          var cp = pendingRestore;
          pendingRestore = null;
          if (restoreAll(cp, true)) saveCP();
        }
      }
    });

    G.events.on("map:loaded", function (ev) {
      if (ev && ev.id === "core" && coreGroup) {
        try { ensureCoreRelays(); } catch (e) { logErr("core-relays", e); }
      }
    });
  }

  /* =================================================================
     五、启动接线（不改 game.js / ext.js）
     ================================================================= */
  function prepareMission() {
    if (mpActive()) return;   // V37：联机由 __MP 接管，不注入战役中继
    var m = mission();
    if (!m || m.id === "train") return;
    if (m.map === "core" || m.id === "m8") {
      try { ensureCoreRelays(); } catch (e) { logErr("prepare-core", e); }
    }
    if (m.extraction && G.level && G.level.extraction && G.level.extraction.pos) {
      try {
        var y = G.physics.groundHeight(m.extraction.x, m.extraction.z, 3);
        if (typeof y !== "number" || !isFinite(y)) y = G.level.extraction.pos.y;
        G.level.extraction.pos.set(m.extraction.x, y, m.extraction.z);
        G.level.extraction.radius = m.extraction.radius || 2.6;
      } catch (e) { soft("extraction-ground", e); }
    }
  }

  // V54 ARCH-1：防重入标记挂在宿主对象（G.game）上，先写标记再包覆；
  // 别人之后再包一层也不会让标记失效。重复 init 直接返回，包覆顺序不变。
  function wrapStart() {
    if (!G.game || G.game.__sxM2Start) return;
    G.game.__sxM2Start = true;
    var base = G.game.start;
    G.game.start = function (opts) {
      try { prepareMission(); } catch (e) { logErr("prepare", e); }
      var out = base.call(G.game, opts);
      try { if (mission() && mission().objectivesGraph) ensureCoreRelays(); } catch (e) { soft("start-relays", e); }
      return out;
    };
  }

  function wrapUpdate() {
    if (!G.game || G.game.__sxM2Update) return;
    G.game.__sxM2Update = true;
    var base = G.game.update;
    G.game.update = function (dt) {
      var out = base.call(G.game, dt);
      try { update(dt); } catch (e) { logErr("update", e); }
      return out;
    };
  }

  function update(dt) {
    if (!booted) return;
    if (coreGroup) coreGroup.visible = mapId() === "core";
    uiT -= dt;
    if (uiT <= 0) { uiT = 0.4; try { syncScreen(); } catch (e) { soft("sync-screen", e); } }
    if (!gr && G.game.state === "playing") { try { initGraph(); } catch (e) { logErr("initGraph", e); } }
    updateGraph(dt);
  }

  /* =================================================================
     六、行动档案 UI：继续行动入口
     ================================================================= */
  function removeContinueButton() {
    var b = document.querySelector(".x-continue");
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function syncScreen() {
    var list = document.querySelector(".x-camp-list");
    if (list && !list.classList.contains("x-eight") && API && API.missions && API.missions.length >= 8) {
      list.classList.add("x-eight");
    }
    var camp = document.querySelector(".x-camp.on");
    if (!camp) { removeContinueButton(); return; }
    var cp = cpCache;
    if (!cp || !cp.missionId || !API || !API.missions) { removeContinueButton(); return; }
    var ms = API.missions, idx = -1;
    for (var i = 0; i < ms.length; i++) if (ms[i].id === cp.missionId) idx = i;
    if (idx < 0 || !hasGraph(ms[idx])) { removeContinueButton(); return; }
    var actions = camp.querySelector(".x-camp-actions");
    if (!actions) return;
    var btn = actions.querySelector(".x-continue");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "btn primary x-continue";
      btn.setAttribute("data-x", "continue");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        launchWithCheckpoint();
      });
      actions.insertBefore(btn, actions.firstChild);
    }
    var label = "继续行动 " + ms[idx].code + " · " + (cp.objective || ms[idx].name);
    if (btn.textContent !== label) btn.textContent = label;
  }

  function launchWithCheckpoint() {
    var cp = cpCache || loadCP();
    if (!cp || !cp.missionId || !API || !API.missions) return false;
    var ms = API.missions, idx = -1;
    for (var i = 0; i < ms.length; i++) if (ms[i].id === cp.missionId) idx = i;
    if (idx < 0 || !hasGraph(ms[idx])) return false;
    pendingRestore = cp;
    try {
      var st = API.state();
      if (st) st.unlocked = Math.max(st.unlocked || 1, idx + 1);
    } catch (e) { soft("pending-unlock", e); }
    API.launch(idx);
    return true;
  }

  /* =================================================================
     七、自检 / 测试 API
     ================================================================= */
  function exposeAPI() {
    window.__SX2 = {
      missions: function () {
        return ((API && API.missions) || []).map(function (m) {
          return {
            id: m.id, code: m.code, name: m.name, map: m.map || "harbor",
            relays: (m.relays || []).length,
            graph: (m.objectivesGraph || []).map(function (o) {
              return { type: o.type, count: o.count || 0, seconds: o.seconds || 0 };
            }),
            boss: !!m.boss, bossHp: m.bossHp || 0, bossName: m.bossName || "", bossEvac: m.bossEvac || 0
          };
        });
      },
      graph: function () {
        if (!gr && G && G.game && G.game.state === "playing") { try { initGraph(); } catch (e) { soft("graph-init", e); } }
        return gr ? {
          missionId: gr.missionId, active: gr.active, complete: gr.complete, evacOpen: gr.evacOpen,
          phases: gr.phases.map(function (p) {
            return {
              type: p.type, state: p.state, count: p.count, seconds: p.seconds,
              progress: +p.progress.toFixed(2), at: p.at || null
            };
          })
        } : null;
      },
      objective: function () { return objectiveText(); },
      checkpoint: function () { return cpCache || loadCP(); },
      storageCheckpoint: function () {
        try {
          var raw = JSON.parse(localStorage.getItem("saltline.save") || "null");
          return raw && raw.campaign ? raw.campaign.checkpoint || null : null;
        } catch (e) { return null; }
      },
      saveCheckpoint: function () { return saveCP(); },
      clearCheckpoint: function () { clearCP(); return true; },
      loadCheckpoint: function () { cpCache = loadCP(); return cpCache; },
      launchCheckpoint: function () { return launchWithCheckpoint(); },
      restore: function () { return restoreAll(cpCache || loadCP(), true); },
      advance: function (sec) {
        if (!gr) return false;
        var p = gr.phases[gr.active];
        if (!p || p.state !== "active" || p.type !== "hold") return false;
        p.progress = Math.min(p.seconds, p.progress + Math.max(0, num(sec, 0)));
        if (p.progress >= p.seconds) completePhase(p);
        return p.progress;
      },
      kill: function (n) {
        var count = Math.max(1, n | 0), emitted = 0;
        // V37：只走事件路径，由 hookEvents 的 enemy:killed 负责计数。
        // （旧版同时直接 +count，会造成一枪双计数。）
        for (var i = 0; i < count; i++) {
          try {
            G.events.emit("enemy:killed", {
              enemy: { type: "hound", variant: "", id: "testkill-" + i + "-" + Date.now() },
              pos: G.player.pos
            });
            emitted++;
          } catch (e) { soft("test-emit", e); }
        }
        return { emitted: emitted, kills: (G.combat && G.combat.stats && G.combat.stats.kills) | 0 };
      },
      coreRelays: function () {
        return ((G.level && G.level.objectives) || []).map(function (o) {
          return { id: o.id, label: o.label, pos: o.pos.toArray().map(function (v) { return +v.toFixed(2); }) };
        });
      },
      validate: function () { try { return window.__SX.validateObjectives(); } catch (e) { return null; } },
      bossAlive: function () { try { return !!(API && API.bossAlive && API.bossAlive()); } catch (e) { return false; } },
      injectCoreRelays: function () { return ensureCoreRelays(); }
    };
  }

  /* =================================================================
     八、启动
     ================================================================= */
  function boot() {
    if (booted) return;
    G = window.__G;
    S = window.__SX && window.__SX.S;
    API = window.__SX_CAMP;
    if (!G || !G.game || !G.game.start || !G.game.update || !G.player || !G.hud || !G.physics || !G.props) return;
    if (!S || !API) return;
    booted = true;
    injectCSS();
    wrapStart();
    wrapUpdate();
    hookEvents();
    exposeAPI();
    // 档案页是低频界面：独立轮询一次 continue 入口，避免错过 openMissions 的下一帧
    try {
      // PERF-4：页面不可见时不轮询档案页 DOM。
      setInterval(function () { if (booted && !document.hidden) { try { syncScreen(); } catch (e) { soft("screen-poll", e); } } }, 500);
    } catch (e) { soft("poll-install", e); }
    try {
      cpCache = loadCP();
      var m = mission();
      if (cpCache && m && cpCache.missionId === m.id && S) S.checkpoint = hydrate(cpCache);
    } catch (e) { soft("boot-restore", e); }
    console.log("[missions2] V34 目标图执行器 / 检查点已加载 · " + ((API.missions && API.missions.length) || 0) + " 关");
  }

  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      if (window.__G && window.__SX && window.__SX_CAMP) {
        try { boot(); } catch (e) { console.error("[missions2] boot", e); }
        if (booted) clearInterval(iv);
      }
      if (++tries > 1200) clearInterval(iv);
    }, 100);
  }

  wait();
})();
