/* =====================================================================
   SALTLINE · ext_lod.js — V39 静态装饰距离 LOD
   ---------------------------------------------------------------------
   目标：按玩家距离隐藏/降级 >far（默认 60m）的纯装饰组，绝不触碰碰撞、
   拾取、中继、敌人点位等玩法对象。
   约定：
     · 地图把“纯装饰”放进 THREE.Group（可含 InstancedMesh），并标注
       group.userData.sxLod = true（或 { far, near }）。
     · 可选的远距替身：group.userData.sxLodFarMesh = Object3D，
       超过 far 时显示替身、隐藏原组（真正的“降级”）；没有替身就整体隐藏。
     · 本模块只在 map:loaded 之后扫描（切图重建），逐帧按玩家位置更新，
       4 帧节流 + 迟滞（far / near=far-4），避免边界抖动。
   调试：window.__SX_LOD = { state, stats, setEnabled, setDistance,
                            rebuild, groups }
   ===================================================================== */
(function () {
  "use strict";
  if (window.__SX_LOD_LOADED) return;
  window.__SX_LOD_LOADED = true;

  var VERSION = "V39.1";
  var FAR = 60;          // 默认隐藏距离（米）
  var NEAR_GAP = 4;      // 迟滞：回到 far-4 内才重新显示
  var EVERY = 4;         // 每 4 个渲染帧检查一次

  var G = null, T = null, booted = false;
  var groups = [];       // { obj, pos(Vector3), radius, far, near, farMesh, hidden }
  var enabled = true;
  var mapId = "";
  var frameNo = 0;
  var stats = {
    version: VERSION,
    groups: 0,
    hidden: 0,
    visible: 0,
    checks: 0,
    toggles: 0,
    skipped: 0,
    builds: 0,
    lastBuild: 0,
    frames: 0,
    enabled: true,
    far: FAR,
    map: ""
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 判定：哪些对象算“纯装饰组” ---------- */
  function wantsLod(o) {
    var u = o && o.userData;
    if (!u || !u.sxLod) return false;
    // 碰撞/玩法对象即使被误标注也拒绝
    if (u.sxGameplay || u.sxCollider) return false;
    return true;
  }

  function isTaggedAncestor(o) {
    var p = o && o.parent;
    while (p) {
      if (wantsLod(p)) return true;
      p = p.parent;
    }
    return false;
  }

  function lodCfg(o) {
    var u = o.userData || {};
    var c = u.sxLod;
    if (c && typeof c === "object") {
      return { far: c.far != null ? +c.far : FAR, near: c.near != null ? +c.near : (c.far != null ? +c.far - NEAR_GAP : FAR - NEAR_GAP) };
    }
    return { far: FAR, near: FAR - NEAR_GAP };
  }

  /* ---------- 恢复：清空注册表前把被本模块改过的可见性还原 ---------- */
  function restoreGroup(g) {
    if (!g) return;
    try { if (g.obj) g.obj.visible = g.baseVisible !== false; } catch (e) {}
    try { if (g.farMesh) g.farMesh.visible = !!g.baseFarVisible; } catch (e) {}
    g.hidden = false;
  }
  function restoreAll() {
    for (var i = 0; i < groups.length; i++) restoreGroup(groups[i]);
    stats.hidden = 0;
    stats.visible = groups.length;
  }

  /* ---------- 收集：切图后重建注册表 ---------- */
  function rebuild() {
    // V53 CLI-4：先恢复上一张图（或同一张图）被隐藏的组与远距替身。
    // 否则 rebuild 只清数组不恢复可见性，被隐藏的组会在切图后永久不可见。
    restoreAll();
    groups.length = 0;
    if (!G || !G.scene) return 0;
    var self = this;
    G.scene.updateMatrixWorld(true);
    G.scene.traverse(function (o) {
      if (!wantsLod(o)) return;
      if (isTaggedAncestor(o)) return;
      // 只收集当前可见地图的装饰组：切图后旧图整棵仍留在 scene 中但不可见
      for (var q = o; q; q = q.parent) if (q.visible === false) return;
      var cfg = lodCfg(o);
      var pos = new T.Vector3();
      try { o.getWorldPosition(pos); } catch (e) { return; }
      // 用包围盒中心当半径参考，避免大组（整条管线）被过早隐藏
      var radius = 0;
      try {
        var box = new T.Box3().setFromObject(o);
        if (isFinite(box.min.x) && isFinite(box.max.x)) {
          box.getCenter(pos);
          radius = box.getSize(new T.Vector3()).length() * 0.5;
        }
      } catch (e) {}
      var farMesh = o.userData.sxLodFarMesh || null;
      groups.push({
        obj: o, pos: pos, radius: radius, far: cfg.far, near: cfg.near,
        farMesh: farMesh, hidden: false,
        // 原始可见性：rebuild/setEnabled(false) 时按它还原
        baseVisible: o.visible !== false,
        baseFarVisible: farMesh ? farMesh.visible !== false : false
      });
    });
    stats.groups = groups.length;
    stats.builds++;
    stats.lastBuild = (typeof performance !== "undefined" && performance.now) ? Math.round(performance.now()) : Date.now();
    stats.map = mapId;
    apply(true);
    return groups.length;
  }

  /* ---------- 更新：按玩家距离显隐 ---------- */
  function playerPos(out) {
    var p = null;
    try { p = G.player && G.player.pos; } catch (e) {}
    if (!p) { try { p = G.camera && G.camera.position; } catch (e) {} }
    if (!p) return null;
    return out.set(p.x || 0, p.y || 0, p.z || 0);
  }

  var _pp = null;
  function apply(force) {
    if (!groups.length) return;
    if (!_pp && T) _pp = new T.Vector3();
    var p = playerPos(_pp);
    var hidden = 0, visible = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var d = p ? Math.sqrt((g.pos.x - p.x) * (g.pos.x - p.x) + (g.pos.z - p.z) * (g.pos.z - p.z) + (g.pos.y - p.y) * (g.pos.y - p.y)) : 0;
      // 大组按包围球半径放宽，避免贴着墙的整排货架被切掉
      var dist = Math.max(0, d - g.radius * 0.5);
      var hide = dist > (g.hidden ? g.near : g.far);
      if (!enabled) hide = false;
      if (hide !== g.hidden || force) {
        if (hide !== g.hidden) stats.toggles++;
        g.hidden = hide;
        try {
          g.obj.visible = !hide && g.baseVisible !== false;
          if (g.farMesh) g.farMesh.visible = hide && enabled;
        } catch (e) {}
      }
      if (g.hidden) hidden++; else visible++;
    }
    stats.hidden = hidden;
    stats.visible = visible;
    if (force) stats.checks++;
  }

  /* ---------- 挂接到渲染帧（不改引擎文件） ---------- */
  function hookRender() {
    if (!G || !G.render || typeof G.render.frame !== "function") return false;
    var base = G.render.frame;
    if (base.__sxLod) return true;
    var wrapped = function (dt) {
      frameNo++;
      stats.frames = frameNo;
      if ((frameNo % EVERY) === 0) {
        stats.checks++;
        try { apply(false); } catch (e) { fail("tick", e); }
      }
      return base.call(G.render, dt);
    };
    wrapped.__sxLod = true;
    G.render.frame = wrapped;
    return true;
  }

  function fail(where, e) {
    try { console.error("[sx-lod] " + where, e); } catch (_) {}
    try { (window.__errors || (window.__errors = [])).push("[lod:" + where + "] " + ((e && e.stack) || e)); } catch (_) {}
  }

  function onMap(ev) {
    mapId = (ev && ev.id) || "";
    try { rebuild(); } catch (e) { fail("rebuild", e); }
  }

  /* ---------- 对外 API ---------- */
  function state() {
    return {
      version: VERSION,
      enabled: enabled,
      far: FAR,
      near: FAR - NEAR_GAP,
      map: mapId,
      groups: groups.length,
      visible: stats.visible,
      hidden: stats.hidden,
      active: enabled && groups.length > 0
    };
  }

  function setEnabled(on) {
    enabled = !!on;
    stats.enabled = enabled;
    if (!enabled) {
      restoreAll();
    } else {
      apply(true);
    }
    return enabled;
  }

  function setDistance(m) {
    var v = +m;
    if (!isFinite(v) || v <= 0) return FAR;
    FAR = v;
    stats.far = FAR;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].far === (stats.far || v)) continue;
    }
    // 手动覆盖所有组的阈值
    for (var j = 0; j < groups.length; j++) {
      groups[j].far = FAR;
      groups[j].near = Math.max(1, FAR - NEAR_GAP);
    }
    apply(true);
    return FAR;
  }

  function expose() {
    window.__SX_LOD = {
      version: VERSION,
      state: state,
      stats: function () { return stats; },
      setEnabled: setEnabled,
      get enabled() { return enabled; },
      setDistance: setDistance,
      rebuild: rebuild,
      groups: function () { return groups.map(function (g) { return { far: g.far, near: g.near, hidden: g.hidden, radius: g.radius, pos: [g.pos.x, g.pos.y, g.pos.z] }; }); },
      get ready() { return true; }
    };
  }

  function boot() {
    if (booted) return;
    G = window.__G;
    if (!G || !G.scene || !G.render || !G.player || !G.renderer) return;
    T = G.THREE;
    booted = true;
    expose();
    try { hookRender(); } catch (e) { fail("hook", e); }
    try {
      G.events.on("map:loaded", onMap);
      // 兼容：加载时地图已经就绪但事件已错过
      var cur = "";
      try { cur = window.__SX && window.__SX.mapId ? window.__SX.mapId() : ""; } catch (e) {}
      if (cur && cur !== "harbor") onMap({ id: cur });
    } catch (e) { fail("events", e); }
  }

  var tries = 0;
  var iv = setInterval(function () {
    boot();
    if (booted || ++tries > 2400) clearInterval(iv);
  }, 50);

  // 提前暴露占位 API（构建期被引用时不报 undefined）
  window.__SX_LOD = {
    version: VERSION,
    state: state,
    stats: function () { return stats; },
    setEnabled: setEnabled,
    setDistance: setDistance,
    rebuild: rebuild,
    groups: function () { return []; },
    get ready() { return booted; }
  };
})();