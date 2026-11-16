/* =====================================================================
   SALTLINE · ext_lights.js — V41 固定点光源预算
   ---------------------------------------------------------------------
   问题：前向渲染的片元着色器会遍历所有可见 PointLight，地图灯从 16 盏
   一路涨到冷库 55 盏，逐像素成本超线性上升；灯数变化还会触发材质重编译。
   做法：
     · MapKit 的 K.light() 只登记“灯光记录”（位置/颜色/强度/范围）；
     · 场景里常驻固定 8 盏 PointLight，数量恒定 → NUM_POINT_LIGHTS 稳定；
     · 每 0.1s 按“距离 - 范围 + 视野方向 + 强度”选前 8 条记录装入灯池，
       换灯时 0.12s 淡出 / 0.18s 淡入，避免跳变；
     · 闪光池 2 盏、第一人称补光 1 盏，总预算 11 盏；
     · 地图切换时自动重建记录索引；可选的 sxBlink 闪灯也在这里驱动。
   调试：window.__SX_LIGHTS = { stats, setEnabled, refresh, records }
   ===================================================================== */
(function () {
  "use strict";
  // V54 ARCH-2：空 catch 不再静默吞错。软错误统一走 window.SXErrors.soft("lights:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 window.__errors。
  function soft(tag, e) {
    if (typeof window === "undefined" || !window) return;
    var forwarded = false;
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") { window.SXErrors.soft("lights:" + tag, e); forwarded = true; }
    } catch (_) { forwarded = false; }
    if (forwarded) return;
    try {
      if (window.__errors) {
        window.__errors.push("[lights:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { return; }
  }

  if (window.__SX_LIGHTS_LOADED) return;
  window.__SX_LIGHTS_LOADED = true;

  var VERSION = "V42.1";
  // V42：灯池预算来自 src/config/balance.js 的 lights 段
  var LB = (window.SX_BALANCE && window.SX_BALANCE.lights) || {};
  var POOL = LB.pool || 8;             // 地图灯池容量（固定）
  var SELECT_EVERY = LB.selectEvery || 0.1;
  var FADE_OUT = LB.fadeOut || 0.12;
  var FADE_IN = LB.fadeIn || 0.18;

  var G = null, T = null, scene = null;
  var booted = false, enabled = true, failed = null;
  var allRecords = [];     // 所有地图灯记录
  var byMap = {};          // mapId -> 记录数组
  var slots = [];          // { light, rec, next, fade }
  var activeMap = "";
  var time = 0, selT = 0, switches = 0, recruits = 0, harvested = 0;
  var lastX = 1e9, lastZ = 1e9;
  var fwd = null;
  var statsCache = null;

  function fail(where, e) {
    if (!failed) failed = where + ": " + ((e && e.message) || e);
    console.error("[lights] " + where, e);
  }

  /* 供 mapkit.js 调用的记录工厂（MapKit.build 时已经能拿到全局 API） */
  function createRecord(x, y, z, color, intensity, dist, map) {
    T = T || (window.__G && window.__G.THREE);
    var r = {
      isSxLightRecord: true,
      map: map || "",
      position: T ? new T.Vector3(x, y, z) : { x: x, y: y, z: z },
      color: T ? new T.Color(color == null ? 0xffd2a0 : color) : { r: 1, g: 0.8, b: 0.6 },
      intensity: intensity == null ? 20 : intensity,
      distance: dist == null ? 18 : dist,
      decay: 2,
      visible: true,
      userData: {}
    };
    r.baseIntensity = r.intensity;
    allRecords.push(r);
    return r;
  }
  window.__SX_LIGHTS = { createRecord: createRecord, version: VERSION };

  function isPoolLight(o) {
    return !!(o.userData && o.userData.sxLightPool);
  }

  /* 把仍然直接创建在场景里的 PointLight（港区原有灯、第一人称补光等）
     收编成记录并移出场景；闪光池与灯池本身必须保留。 */
  function harvest() {
    if (!scene) return 0;
    var keep = [];
    var lp = G.render && G.render.flashLights;
    if (lp) keep = keep.concat(lp);
    var vf = window.__SX_VISUAL && window.__SX_VISUAL.debug && window.__SX_VISUAL.debug.fill;
    if (vf) keep.push(vf);
    var found = [];
    scene.traverse(function (o) {
      if (!o.isPointLight || isPoolLight(o) || keep.indexOf(o) >= 0) return;
      found.push(o);
    });
    for (var i = 0; i < found.length; i++) {
      var o = found[i];
      var p = new T.Vector3();
      try { o.getWorldPosition(p); } catch (e) { p.copy(o.position); }
      var r = createRecord(p.x, p.y, p.z, o.color ? o.color.getHex() : 0xffd2a0, o.intensity, o.distance || 18, activeMap || "harbor");
      r.userData = o.userData || {};
      r.baseIntensity = o.intensity;
      if (o.parent) o.parent.remove(o);
      try { if (o.dispose) o.dispose(); } catch (e) { soft("dispose-harvest", e); }
      harvested++;
    }
    return found.length;
  }

  function addRecord(r, mapId) {
    if (!r) return;
    if (mapId) r.map = mapId;
    if (!r.map) return;
    if (!byMap[r.map]) byMap[r.map] = [];
    if (byMap[r.map].indexOf(r) < 0) byMap[r.map].push(r);
  }

  function collect() {
    if (T === null) T = (window.__G && window.__G.THREE) || T;
    byMap = {};
    for (var i = 0; i < allRecords.length; i++) {
      var r = allRecords[i];
      // 地图记录以 MapKit.def(id).records 为准；旧的已释放记录跳过
      if (r.map && !r.__mapRecord) addRecord(r, r.map);
    }
    try {
      if (window.MapKit && MapKit.maps) {
        var ids = MapKit.maps();
        for (var m = 0; m < ids.length; m++) {
          var d = MapKit.def(ids[m]);
          if (!d || !d.records) continue;
          for (var k = 0; k < d.records.length; k++) addRecord(d.records[k], ids[m]);
        }
      }
    } catch (e) { fail("collect", e); }
    recruits = allRecords.length;
  }

  function makePool() {
    for (var i = 0; i < POOL; i++) {
      var l = new T.PointLight(0xffffff, 0, 18, 2);
      l.name = "sx-light-pool-" + i;
      l.castShadow = false;
      l.userData.sxLightPool = true;
      scene.add(l);
      slots.push({ light: l, rec: null, next: null, fade: 0 });
    }
  }

  function ensureTargets() {
    var cam = G.camera;
    // 以渲染相机为准（正常游玩时相机 = 玩家眼位；截图/过场时玩家 pos 可能不动）
    var p = (cam && cam.position) || (G.player && G.player.pos);
    fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); else fwd.normalize();
    var list = byMap[activeMap] || [];
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      if (!rec || rec.visible === false) continue;
      var dx = rec.position.x - p.x, dy = rec.position.y - p.y, dz = rec.position.z - p.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var horiz = Math.sqrt(dx * dx + dz * dz) || 0.001;
      var dot = (dx * fwd.x + dz * fwd.z) / horiz;
      var gap = d - (rec.distance || 18);
      if (gap < 0) gap = 0;
      // 重要度：能照到玩家 > 视野内 > 强度；背后的灯重罚，避免近处背灯
      // 把前方走廊/冷库的大范围灯挤出灯池。仍持有灯槽的记录给小加成做迟滞。
      var behind = dot < 0 ? -dot * 10 : 0;
      var score = gap * 1.7 + d * 0.22 - dot * 2.4 + behind - Math.min(rec.intensity || 0, 220) * 0.006;
      if (isSlotted(rec)) score -= 2.4;
      scored.push({ s: score, r: rec });
    }
    scored.sort(function (a, b) { return a.s - b.s; });
    for (var s = 0; s < slots.length; s++) {
      slots[s].next = s < scored.length ? scored[s].r : null;
    }
  }

  function isSlotted(rec) {
    for (var i = 0; i < slots.length; i++) if (slots[i].rec === rec) return true;
    return false;
  }

  function blink() {
    for (var i = 0; i < allRecords.length; i++) {
      var r = allRecords[i];
      var b = r.userData && r.userData.sxBlink;
      if (!b) continue;
      var mn = b.min == null ? 0.1 : b.min;
      var mx = b.max == null ? (r.baseIntensity || 1) : b.max;
      var v = mn + (mx - mn) * (0.5 + 0.5 * Math.sin(time * (b.speed || 2.2) + (b.phase || 0)));
      r.intensity = v;
    }
  }

  function assign(slot, rec) {
    slot.rec = rec || null;
    if (!slot.rec) return;
    slot.light.position.copy(slot.rec.position);
    slot.light.color.copy(slot.rec.color);
    slot.light.distance = slot.rec.distance || 18;
    slot.light.decay = slot.rec.decay == null ? 2 : slot.rec.decay;
  }

  function step(dt) {
    if (!booted || failed) return;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.25) dt = 0.25;
    time += dt;
    blink();
    // 玩家移动超过 2m 立即重选，避免跑动时灯池滞后
    var p = (G.camera && G.camera.position) || (G.player && G.player.pos);
    var moved = (p.x - lastX) * (p.x - lastX) + (p.z - lastZ) * (p.z - lastZ);
    selT -= dt;
    if (enabled && (selT <= 0 || moved > 4)) {
      selT = SELECT_EVERY;
      lastX = p.x; lastZ = p.z;
      try { ensureTargets(); } catch (e) { fail("select", e); }
    }
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (s.next !== s.rec) {
        // 首次装灯/切图：直接满强度，避免画面先黑 0.18s 再亮起。
        if (s.rec === null && s.next) {
          assign(s, s.next);
          s.fade = 1;
        } else {
          s.fade -= dt / FADE_OUT;
          if (s.fade <= 0) {
            assign(s, s.next);
            s.fade = 0;
          }
        }
      } else if (s.rec) {
        s.fade = Math.min(1, s.fade + dt / FADE_IN);
      }
      var base = s.rec && enabled ? (s.rec.intensity || 0) : 0;
      var f = s.fade;
      if (f < 0) f = 0; else if (f > 1) f = 1;
      s.light.intensity = base * f;
    }
    statsCache = null;
  }

  function countSceneLights() {
    var n = 0, lit = 0;
    if (!scene) return { total: 0, lit: 0 };
    scene.traverse(function (o) {
      if (!o.isPointLight) return;
      var vis = true;
      for (var x = o; x; x = x.parent) if (!x.visible) { vis = false; break; }
      if (!vis || !o.layers.test(G.camera.layers)) return;
      n++;
      if (o.intensity > 0.001) lit++;
    });
    return { total: n, lit: lit };
  }

  function stats() {
    if (statsCache) return statsCache;
    var c = countSceneLights();
    var list = byMap[activeMap] || [];
    statsCache = {
      version: VERSION,
      pool: POOL,
      map: activeMap,
      records: list.length,
      totalRecords: allRecords.length,
      indexed: recruits,
      harvested: harvested,
      switches: switches,
      enabled: enabled,
      sceneLights: c.total,
      litLights: c.lit,
      visible: c.total,
      budget: POOL + 2 + 1,
      failed: failed || null
    };
    return statsCache;
  }

  function refresh(mapId) {
    collect();
    if (mapId) activeMap = mapId;
    selT = 999;
    lastX = 1e9; lastZ = 1e9;
    statsCache = null;
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) {
      for (var i = 0; i < slots.length; i++) slots[i].light.intensity = 0;
    } else {
      refresh();
      selT = 0;
    }
    statsCache = null;
    return enabled;
  }

  function init() {
    G = window.__G;
    if (!G || !G.render || !G.render.scene || !G.THREE) return false;
    T = G.THREE;
    scene = G.render.scene;
    if (!G.render.lightPool) return false;
    if (!G.render.flashLights || G.render.flashLights.length !== 2) {
      // 兼容旧构建：没有暴露闪光池时，用名字兜底识别，不能误收编为地图灯
      G.render.flashLights = G.render.flashLights || [];
    }
    fwd = new T.Vector3();
    activeMap = (window.MapKit && MapKit.current && MapKit.current()) || "harbor";
    collect();
    harvest();
    makePool();
    // 重新索引一次（收编进来的港区灯）
    collect();
    booted = true;
    window.__SX_LIGHTS.createRecord = createRecord;
    window.__SX_LIGHTS.stats = stats;
    window.__SX_LIGHTS.setEnabled = setEnabled;
    window.__SX_LIGHTS.refresh = refresh;
    window.__SX_LIGHTS.records = function () { return (byMap[activeMap] || []).slice(); };
    window.__SX_LIGHTS.all = function () { return allRecords.slice(); };

    if (G.events && G.events.on) {
      G.events.on("map:loaded", function (e) {
        var id = (e && e.id) || (window.MapKit && MapKit.current && MapKit.current());
        switches++;
        refresh(id);
      });
    }
    // 保证 update 在任何 render.frame 调用（含测试同步帧）之前运行
    // V54 ARCH-1：防重入标记挂在宿主对象（G.render）上，先写标记再包覆。
    var baseFrame = G.render.frame;
    if (baseFrame && !G.render.__sxLightsFrame) {
      G.render.__sxLightsFrame = true;
      var wrapped = function (dt) {
        try { step(dt); } catch (e) { fail("update", e); }
        return baseFrame.apply(this, arguments);
      };
      G.render.frame = wrapped;
    }
    refresh(activeMap);
    console.log("[lights] 固定灯池 " + POOL + " 盏，记录 " + allRecords.length + " 条，地图 " + activeMap);
    return true;
  }

  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      if (window.__G && window.__G.render && window.__G.render.scene && window.MapKit) {
        try {
          if (init()) { clearInterval(iv); return; }
        } catch (e) { fail("init", e); clearInterval(iv); return; }
      }
      if (++tries > 600) { clearInterval(iv); fail("boot", "engine not ready"); }
    }, 50);
  }
  wait();
})();
