
  /* =====================================================================
     V33 · 手感 —— 弹道 / 穿透 / 后坐模式 / 六把武器接入 / 靶场调参
     独立 IIFE。构建时作为 feature 模块（src/ext_weapons2.js）在 ext.js 之后
     加载，因此可以直接使用 window.__G / window.__SX / window.__SX_WEAPON_EXT。
     不依赖 game.js 改动：若 game.js 的 defs 还没有接入三把新枪，本模块会在
     启动后自动补齐（按 id 去重），接入后自动跳过。
     ===================================================================== */
(function () {
  "use strict";
  // V54 ARCH-2：空 catch 不再静默吞错。软错误统一走 window.SXErrors.soft("weapons2:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 window.__errors。
  function soft(tag, e) {
    if (typeof window === "undefined" || !window) return;
    var forwarded = false;
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") { window.SXErrors.soft("weapons2:" + tag, e); forwarded = true; }
    } catch (_) { forwarded = false; }
    if (forwarded) return;
    try {
      if (window.__errors) {
        window.__errors.push("[weapons2:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { return; }
  }

  if (window.__SX_W2_INSTALLED) return;
  window.__SX_W2_INSTALLED = true;

  var W = window;
  var G = null;
  var READY = false;
  var TRIES = 0;
  var INJECTED = 0;
  var SEED = 4207;
  var T = null;

  /* 穿透：每米消耗的「穿透力」（WP33-2 / 附录 B.1） */
  var PEN = { wood: 1.0, glass: 0.3, sheet: 1.6, metal: 4.0, concrete: 8.0, dirt: 0.5, rubber: 0.8 };

  var ring = [];          // 最近弹着（供 __SX_TUNE / F8）
  var RING_MAX = 40;
  var tuneEl = null;
  var tuneOn = false;

  function log(msg) {
    try { console.log("[weapons2] " + msg); } catch (e) { /* 纯日志输出：诊断通道自身不可用，保持静默（ARCH-2 白名单） */ }
  }

  try {
    var sp = new URLSearchParams(location.search);
    if (sp.get("seed")) SEED = +sp.get("seed") >>> 0;
  } catch (e) { soft("seed-parse", e); }

  /* ------------------------------------------------------------------ 数据 */
  function dataAll() { return W.__SX_WEAPON_DATA || {}; }
  function weaponData(id) { return dataAll()[id] || null; }
  function cfgData(w) {
    if (!w) return null;
    return weaponData(w.id) || weaponData(w.cfg && w.cfg.id) || null;
  }
  function dataForId(id) {
    var d = weaponData(id);
    if (d) return d;
    var list = G && G.weapon && G.weapon.list;
    if (list) for (var i = 0; i < list.length; i++) if (list[i].id === id) return cfgData(list[i]);
    return null;
  }
  function activeWeapon() {
    if (!G || !G.weapon || !G.weapon.list) return null;
    return G.weapon.list[G.weapon.activeIndex | 0] || null;
  }
  function findWeapon(id) {
    var list = G && G.weapon && G.weapon.list;
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ------------------------------------------------------- 距离衰减 / 穿透 */
  function falloffAt(f, d) {
    if (!f) return 1;
    var s = +f.start, e = +f.end, m = f.minMul == null ? 1 : +f.minMul;
    if (!(e > s) || d <= s) return 1;
    if (d >= e) return m;
    return 1 + (m - 1) * ((d - s) / (e - s));
  }

  function point(v) {
    return { x: +v.x || 0, y: +v.y || 0, z: +v.z || 0 };
  }
  function negPoint(dir) { return { x: -dir.x, y: -dir.y, z: -dir.z }; }

  /* 射线在轴对齐盒内的穿行长度（出口参数 - 入口参数）。无盒时返回 1（视为不可穿）。 */
  function boxThickness(box, o, dir, entry) {
    if (!box || !box.min || !box.max) return 1;
    var tmin = -Infinity, tmax = Infinity;
    var axes = ["x", "y", "z"];
    for (var i = 0; i < 3; i++) {
      var a = axes[i], oa = o[a], da = dir[a];
      if (Math.abs(da) < 1e-9) {
        if (oa < box.min[a] || oa > box.max[a]) return 1;
        continue;
      }
      var t1 = (box.min[a] - oa) / da, t2 = (box.max[a] - oa) / da;
      if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return 1;
    }
    var thick = tmax - (entry == null ? tmin : entry);
    if (!(thick > 0) || !isFinite(thick)) return 1;
    return thick;
  }
  function hitThickness(hit, dir, origin) {
    if (!hit || !hit.box) return 1;
    return boxThickness(hit.box, origin || hit.__origin || { x: 0, y: 0, z: 0 }, dir, hit.dist);
  }

  /*
   * 纯函数弹道核心（可单测）：返回命中序列
   *   {kind:'world'|'exit'|'entity', point, normal, dist, surface, enemy, part, damage, falloff, dmgMul, penetrations}
   * api = { raycast(o,d,dist), enemyRaycast(o,d,dist), thickness(hit,dir,o), damage(rec,spec) }
   * spec = { damage, range, falloff, penetration, penetrationMul, headMul, limbMul, maxPen }
   */
  function traceCore(api, origin, dir, spec) {
    spec = spec || {};
    var out = [];
    var range = spec.range > 0 ? +spec.range : 200;
    var power = spec.penetration == null ? 0.5 : +spec.penetration;
    var penMul = spec.penetrationMul == null ? 0.7 : +spec.penetrationMul;
    var maxPen = spec.maxPen == null ? 1 : Math.max(0, spec.maxPen | 0);
    var damage = +spec.damage || 0;
    var dmgMul = 1, travelled = 0, pens = 0;
    var o = point(origin), d = point(dir);

    for (var n = 0; n < 4 && travelled < range - 1e-4; n++) {
      var remain = range - travelled;
      var ent = api.enemyRaycast ? api.enemyRaycast(o, d, remain) : null;
      var wall = api.raycast ? api.raycast(o, d, remain) : null;
      var ed = ent ? +ent.dist : Infinity;
      var wd = wall ? +wall.dist : Infinity;

      if (ent && ed <= wd) {
        var dist = travelled + ed;
        var f = falloffAt(spec.falloff, dist);
        var mul = f * dmgMul * (ent.part === "weak" ? (spec.headMul || 2.2) : (ent.part === "limb" ? (spec.limbMul || 0.8) : 1));
        var rec = {
          kind: "entity", point: ent.point, normal: ent.normal || negPoint(d),
          dist: dist, surface: "enemy", enemy: ent.enemy, part: ent.part,
          dir: dir, from: "player", falloff: f, dmgMul: dmgMul,
          damage: damage * mul, penetrations: pens,
        };
        rec.killed = api.damage ? !!api.damage(rec, spec) : false;
        out.push(rec);
        return out;
      }

      if (!wall) return out;

      var wr = {
        kind: "world", point: wall.point, normal: wall.normal,
        dist: travelled + wd, surface: wall.surface, enemy: null,
        dir: dir, from: "player", falloff: falloffAt(spec.falloff, travelled + wd),
        dmgMul: dmgMul, penetrations: pens,
      };
      out.push(wr);
      if (pens >= maxPen) return out;

      var thick = api.thickness ? +api.thickness(wall, d, o) : boxThickness(wall.box, o, d, wd);
      if (!(thick > 0) || thick > 0.6) return out;
      var surf = String(wall.surface || "concrete").toLowerCase();
      var cost = thick * (PEN[surf] == null ? PEN.concrete : PEN[surf]);
      if (power < cost) return out;
      power -= cost;
      dmgMul *= penMul;
      pens++;

      var advance = wd + thick + 0.01;
      travelled += advance;
      o = { x: o.x + d.x * advance, y: o.y + d.y * advance, z: o.z + d.z * advance };
      out.push({
        kind: "exit", point: { x: o.x, y: o.y, z: o.z }, normal: wall.normal,
        dist: travelled, surface: wall.surface, enemy: null,
        dir: dir, from: "player", dmgMul: dmgMul, penetrations: pens,
      });
    }
    return out;
  }

  /* ------------------------------------------------------------- 运行时 API */
  var _vo = null, _vd = null;
  function vec3(v, out) {
    if (!T) return v;
    out = out || new T.Vector3();
    out.set(+v.x || 0, +v.y || 0, +v.z || 0);
    return out;
  }
  function runtimeApi() {
    return {
      raycast: function (o, d, r) {
        _vo = vec3(o, _vo); _vd = vec3(d, _vd);
        return G.physics.raycast(_vo, _vd, r);
      },
      enemyRaycast: function (o, d, r) {
        _vo = vec3(o, _vo); _vd = vec3(d, _vd);
        return G.enemies.raycast(_vo, _vd, r);
      },
      thickness: function (hit, d, o) {
        return hitThickness(hit, d, o);
      },
      damage: function (rec) {
        var en = rec.enemy;
        if (!en || !en.damage) return false;
        var pt = vec3(rec.point), dv = vec3(rec.dir);
        var killed = false;
        try { killed = en.damage(rec.damage, pt, dv, rec.part) === true; } catch (e) { console.error("[weapons2] damage", e); }
        rec.killed = killed;
        emitImpact(rec);
        try {
          G.events.emit("player:hitEnemy", {
            enemy: en, part: rec.part, killed: killed, weak: rec.part === "weak", damage: rec.damage,
          });
        } catch (e) { soft("emit-hit-enemy", e); }
        return killed;
      },
    };
  }

  function emitImpact(rec) {
    if (!rec || !rec.point) return;
    try {
      G.events.emit("impact", {
        point: rec.point, normal: rec.normal, dist: rec.dist, surface: rec.surface,
        enemy: rec.enemy || null, dir: rec.dir, from: "player", part: rec.part,
        penetration: rec.penetrations || 0, falloff: rec.falloff, dmgMul: rec.dmgMul,
        exit: rec.kind === "exit",
      });
    } catch (e) { soft("emit-impact", e); }
  }

  function toLegacy(rec) {
    if (!rec) return null;
    return {
      point: rec.point, normal: rec.normal, dist: rec.dist, surface: rec.surface,
      enemy: rec.enemy || null, part: rec.part, dir: rec.dir, from: "player",
      killed: !!rec.killed, damage: rec.damage, falloff: rec.falloff,
      dmgMul: rec.dmgMul, penetrations: rec.penetrations || 0,
    };
  }

  function specFor(w, damage, range) {
    var d = cfgData(w) || {};
    var cfg = (w && w.cfg) || {};
    return {
      damage: +damage || 0,
      range: +range || 200,
      falloff: d.falloff || cfg.falloff || null,
      penetration: d.penetration != null ? d.penetration : (cfg.penetration != null ? cfg.penetration : 0.5),
      penetrationMul: d.penetrationMul != null ? d.penetrationMul : (cfg.penetrationMul != null ? cfg.penetrationMul : 0.7),
      headMul: d.headMul != null ? d.headMul : (cfg.headMul || 2.2),
      limbMul: d.limbMul != null ? d.limbMul : (cfg.limbMul || 0.8),
      maxPen: 1,
    };
  }

  function installBallistics() {
    var combat = G.combat;
    if (!combat || combat.__sxW2) return;
    combat.__sxW2 = true;
    var base = combat.playerShot;
    combat.playerShot = function (origin, dir, opts) {
      opts = opts || {};
      var range = +opts.range || 300;
      // 近战 / 手雷 / 非枪械调用保持引擎原路径（保留其 2.2 弱点倍率与统计）
      if (range <= 10 || opts.ballistics === false) return base.call(combat, origin, dir, opts);
      var w = activeWeapon();
      if (!w) return base.call(combat, origin, dir, opts);
      var spec = specFor(w, opts.damage, range);
      var hits;
      try {
        hits = traceCore(runtimeApi(), origin, dir, spec);
      } catch (err) {
        console.error("[weapons2] trace failed", err);
        return base.call(combat, origin, dir, opts);
      }
      if (combat.stats) combat.stats.shots++;
      var primary = null;
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (h.kind === "entity") {
          if (combat.stats) combat.stats.hits++;
          if (!primary) primary = h;
        } else {
          if (!primary) primary = h;
          emitImpact(h);
        }
      }
      recordShot(w, hits, spec);
      return toLegacy(primary);
    };
    log("弹道已接管：距离衰减 + 穿透（最多 1 层，>0.6m 不穿）");
  }

  /* --------------------------------------------------------------- 后坐模式 */
  function hashStr(s) {
    var h = 0x811c9dc5, str = String(s);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = Math.imul(t ^ (t >>> 7), t | 61) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* 每发独立的确定性随机：同一 (武器, 发序, 种子) 永远得到同一抖动 */
  function shotRng(id, index, seed) {
    var s = (seed == null ? SEED : seed) >>> 0;
    var h = (s ^ hashStr(id) ^ Math.imul((index | 0) + 1, 0x9e3779b1)) >>> 0;
    return mulberry32(h);
  }

  function recoilKick(w, index, st, seed) {
    var d = cfgData(w);
    var R = d && d.recoilPattern;
    if (!R || !R.pattern || !R.pattern.length) return { pitch: 0.0068, yaw: 0 };
    var p = R.pattern;
    var from = Math.max(0, Math.min(R.loopFrom | 0, p.length - 1));
    var i = index < p.length ? index : from + ((index - from) % Math.max(1, p.length - from));
    var rnd = shotRng((w && (w.id || (w.cfg && w.cfg.id))) || "gun", index, seed);
    var jit = R.jitter || [0, 0];
    var unit = R.unit || [0.005, 0.0068];
    var st0 = st || {};
    var m = (st0.ads > 0.8 ? (R.adsMul == null ? 1 : R.adsMul) : 1) *
      (st0.crouch ? (R.crouchMul == null ? 1 : R.crouchMul) : 1) *
      (st0.speed01 > 0.5 ? (R.moveMul == null ? 1 : R.moveMul) : 1) *
      ((w && w.mods && w.mods.recoil) || 1);
    return {
      yaw: (p[i][0] + (rnd() * 2 - 1) * jit[0]) * unit[0] * m,
      pitch: (p[i][1] + (rnd() * 2 - 1) * jit[1]) * unit[1] * m,
    };
  }

  var pending = null;
  function installRecoil() {
    var P = G.player;
    if (!P || P.__sxW2Recoil) return;
    P.__sxW2Recoil = true;
    var baseAdd = P.addRecoil;
    P.addRecoil = function (pitch, yaw) {
      if (pending && performance.now() - pending.t < 80) {
        var p = pending;
        pending = null;
        if (p.w && cfgData(p.w)) {
          var k = recoilKick(p.w, p.index, {
            ads: p.ads, crouch: !!P.crouching,
            speed01: Math.min(1, (+P.speed || 0) / 6),
          });
          return baseAdd.call(P, k.pitch, k.yaw);
        }
      }
      return baseAdd.call(P, pitch, yaw);
    };
    G.events.on("weapon:fire", function (e) {
      if (!e || !e.weapon) return;
      var w = findWeapon(e.weapon) || activeWeapon();
      if (!w || !cfgData(w)) return;
      var now = (G.time && G.time.t) || performance.now() / 1000;
      var idx = (w.__sxLastShotT == null || now - w.__sxLastShotT > 0.34) ? 0 : (w.__sxShotIndex | 0) + 1;
      w.__sxShotIndex = idx;
      w.__sxLastShotT = now;
      pending = { w: w, index: idx, ads: e.ads || 0, t: performance.now() };
    });
    log("后坐模式已接管：逐发轨迹 + 有界随机（确定性种子 " + SEED + "）");
  }

  /* --------------------------------------------------------- 弹着记录 / 调参 */
  function round2(v) { return Math.round(v * 100) / 100; }
  function recordShot(w, hits, spec) {
    var first = null;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].kind === "world" || hits[i].kind === "entity") { first = hits[i]; break; }
    }
    var t = G.time ? G.time.t : 0;
    var widened = false, entityHits = 0;
    for (var j = 0; j < hits.length; j++) {
      if (hits[j].kind === "exit") widened = true;
      if (hits[j].kind === "entity") entityHits++;
    }
    var rec = {
      t: round2(t), weapon: (w && w.id) || "unknown",
      point: first && first.point ? { x: round2(first.point.x), y: round2(first.point.y), z: round2(first.point.z) } : null,
      dist: first ? round2(first.dist) : null,
      surface: first ? first.surface : null,
      damage: first && first.damage ? round2(first.damage) : 0,
      falloff: first && first.falloff != null ? round2(first.falloff) : 1,
      penetrated: widened, entityHits: entityHits,
    };
    var last = ring[ring.length - 1];
    if (last && last.t === rec.t && last.weapon === rec.weapon) {
      // 霰弹多弹丸 / 同一帧多发：合并成一条弹着记录
      if (rec.point) last.point = rec.point;
      last.entityHits = (last.entityHits || 0) + entityHits;
      last.penetrated = last.penetrated || widened;
      last.pellets = (last.pellets || 1) + 1;
    } else {
      ring.push(rec);
      if (ring.length > RING_MAX) ring.shift();
    }
    if (tuneOn) renderTune();
  }

  function installTuneHUD() {
    try {
      var style = document.createElement("style");
      style.id = "sx-w2-style";
      style.textContent =
        ".x-loadout{flex-wrap:wrap;justify-content:flex-end;max-width:min(620px,62vw);row-gap:6px;}" +
        ".x-tune{position:absolute;left:calc(var(--gr) + 6px);bottom:calc(150px + var(--sab));z-index:65;max-width:44vw;max-height:36vh;overflow:hidden;padding:10px 12px;background:rgba(5,7,9,.82);border-left:2px solid var(--signal);font:500 9px/1.5 var(--f-mono);color:var(--bone-dim);white-space:pre-wrap;pointer-events:none;display:none;}" +
        ".x-tune.on{display:block;}" +
        ".x-tune b{display:block;color:var(--signal);letter-spacing:.12em;margin-bottom:6px;font:600 9px/1.4 var(--f-mono);}";
      document.head.appendChild(style);
      tuneEl = document.createElement("div");
      tuneEl.className = "x-tune";
      (G.hud.root || document.getElementById("ui")).appendChild(tuneEl);
    } catch (e) { console.error("[weapons2] tune hud", e); }
  }
  function renderTune() {
    if (!tuneEl) return;
    var rows = ring.slice(-10);
    var payload = rows.map(function (r) { return { w: r.weapon, d: r.dist, p: r.point, f: r.falloff, pen: r.penetrated }; });
    tuneEl.innerHTML = "<b>V33 TUNE · 最近 10 发弹着 (F8)</b>" +
      JSON.stringify(payload, null, 1).replace(/\n/g, "<br>");
  }
  function toggleTune(on) {
    tuneOn = on == null ? !tuneOn : !!on;
    if (tuneEl) {
      tuneEl.classList.toggle("on", tuneOn);
      if (tuneOn) renderTune();
    }
    return tuneOn;
  }

  /* ------------------------------------------------------- 按键 / 滚轮 / HUD */
  function selectSlot(i) {
    if (!G || !G.weapon || !G.weapon.list) return false;
    if (i < 0 || i >= G.weapon.list.length) return false;
    return !!G.weapon.select(i);
  }
  function wheelSelect(dir) {
    if (!G || !G.weapon || !G.weapon.list || !G.weapon.list.length) return false;
    var n = G.weapon.list.length;
    var next = (((G.weapon.activeIndex | 0) + (dir > 0 ? 1 : -1)) % n + n) % n;
    return !!G.weapon.select(next);
  }
  function installInput() {
    W.addEventListener("keydown", function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "F8") { e.preventDefault(); toggleTune(); return; }
      var m = /^Digit([1-9])$/.exec(e.code);
      if (!m) return;
      var idx = +m[1] - 1;
      if (idx < 3) return; // 1/2/3 仍由引擎输入映射处理
      if (!G || !G.game || G.game.state !== "playing") return;
      if (selectSlot(idx)) e.preventDefault();
    }, true);

    W.addEventListener("wheel", function (e) {
      if (!G || !G.game || G.game.state !== "playing") return;
      if (!G.input || !(G.input.locked || document.pointerLockElement)) return;
      var dy = e.deltaY;
      if (!dy) return;
      if (wheelSelect(dy > 0 ? 1 : -1)) e.preventDefault();
    }, { passive: false });

    log("按键接入：Digit4/5/6 选择第 4/5/6 把 · 滚轮切枪 · F8 弹着 HUD");
  }

  /* --------------------------------------------------------- 自动补齐武器 */
  function ensureWeapons() {
    var ext = W.__SX_WEAPON_EXT;
    if (!ext || typeof ext.create !== "function" || !ext.defs) return Promise.resolve(0);
    var list = G.weapon.list;
    var have = {};
    for (var i = 0; i < list.length; i++) have[list[i].id] = true;
    var missing = [];
    for (var j = 0; j < ext.defs.length; j++) {
      var d = ext.defs[j];
      if (d && d.cfg && !have[d.cfg.id]) missing.push(d);
    }
    if (!missing.length) {
      log("六把武器已由 game.js defs 接入，跳过自动补齐");
      return Promise.resolve(0);
    }
    log("game.js defs 尚未接入：自动补齐 " + missing.map(function (d) { return d.cfg.id; }).join(","));
    return Promise.all(missing.map(function (d) {
      return ext.create(G, d.cfg, d.build);
    })).then(function (built) {
      var added = 0;
      for (var k = 0; k < built.length; k++) {
        var w = built[k], def = missing[k];
        if (!w) continue;
        w.short = def.short || def.cfg.short || "";
        w.slot = list.length;
        w.setVisible(false);
        list.push(w);
        added++;
      }
      INJECTED = added;
      log("自动补齐完成，当前武器：" + list.length + " 把");
      return added;
    }).catch(function (err) {
      console.error("[weapons2] 自动补齐失败", err);
      return 0;
    });
  }

  /* ------------------------------------------------------------ 调试 API */
  function plot(shots) {
    if (!shots) return ring.slice();
    if (!Array.isArray(shots)) shots = [shots];
    for (var i = 0; i < shots.length; i++) {
      var s = shots[i] || {};
      var p = s.point || s;
      if (!p || p.x == null) continue;
      ring.push({
        t: s.t != null ? s.t : round2(G && G.time ? G.time.t : 0),
        weapon: s.weapon || "manual",
        point: { x: round2(p.x), y: round2(p.y), z: round2(p.z) },
        dist: s.dist != null ? round2(s.dist) : null,
        surface: s.surface || null,
        damage: s.damage != null ? round2(s.damage) : 0,
        falloff: s.falloff != null ? round2(s.falloff) : 1,
        penetrated: !!s.penetrated, entityHits: s.entityHits || 0,
      });
      if (ring.length > RING_MAX) ring.shift();
    }
    if (tuneOn) renderTune();
    return ring.slice();
  }

  function stats() {
    var by = {};
    for (var i = 0; i < ring.length; i++) {
      var r = ring[i], k = r.weapon;
      if (!by[k]) by[k] = { shots: 0, hits: 0, penetrated: 0, avgDist: 0 };
      by[k].shots++;
      by[k].hits += r.entityHits || 0;
      if (r.penetrated) by[k].penetrated++;
      by[k].avgDist += r.dist || 0;
    }
    for (var k2 in by) by[k2].avgDist = round2(by[k2].avgDist / by[k2].shots);
    return {
      version: "v33-w2",
      injected: INJECTED,
      weapons: G && G.weapon && G.weapon.list ? G.weapon.list.map(function (w) { return w.id; }) : [],
      slots: G && G.weapon && G.weapon.list ? G.weapon.list.length : 0,
      shots: ring.length,
      byWeapon: by,
      last10: ring.slice(-10),
      seed: SEED,
    };
  }

  function traceFor(id, origin, dir, opts) {
    var d = dataForId(id);
    var w = findWeapon(id) || { id: id, cfg: {}, mods: {} };
    var spec = specFor(w, (opts && opts.damage) || (d && d.damage) || 20, (opts && opts.range) || (d && d.range) || 200);
    var hits = traceCore(runtimeApi(), origin, dir, spec);
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].kind === "entity") continue;
      // 测试/调参调用不实际造成伤害；这里仅把墙面的弹着补齐给表现层
    }
    return hits;
  }

  W.__SX_TUNE = {
    version: "v33-w2",
    falloff: function (id, d) {
      var data = dataForId(id);
      return falloffAt(data && data.falloff, +d || 0);
    },
    kick: function (id, index, seed) {
      var w = findWeapon(id) || { id: id, cfg: {}, mods: { recoil: 1 } };
      return recoilKick(w, index | 0, { ads: 0, crouch: false, speed01: 0 }, seed);
    },
    pattern: function (id, n, seed) {
      var out = [];
      n = Math.max(0, n | 0);
      for (var i = 0; i < n; i++) out.push(recoilKick({ id: id, cfg: {}, mods: { recoil: 1 } }, i, { ads: 0, crouch: false, speed01: 0 }, seed));
      return out;
    },
    plot: plot,
    stats: stats,
    traceCore: traceCore,
    trace: traceFor,
    data: function (id) { return dataForId(id); },
    select: selectSlot,
    wheel: wheelSelect,
    hud: toggleTune,
    last10: function () { return ring.slice(-10); },
    weapons: function () { return G && G.weapon && G.weapon.list ? G.weapon.list.map(function (w) { return w.id; }) : []; },
  };
  try { window.__SX = window.__SX || {}; window.__SX.tune = W.__SX_TUNE; } catch (e) { soft("expose-tune", e); }

  /* ---------------------------------------------------------------- 启动 */
  function boot() {
    if (READY) return true;
    G = W.__G;
    if (!G || !G.weapon || !G.weapon.list || !G.weapon.list.length) return false;
    if (!G.combat || !G.player || !G.physics || !G.enemies || !G.game || !G.hud) return false;
    READY = true;
    T = G.THREE;
    installTuneHUD();
    installBallistics();
    installRecoil();
    installInput();
    ensureWeapons();
    log("V33 弹道模块就绪（" + G.weapon.list.length + " 把武器）");
    return true;
  }

  (function wait() {
    if (boot()) return;
    if (++TRIES > 1200) {
      console.error("[weapons2] 引擎未就绪");
      return;
    }
    setTimeout(wait, 50);
  })();
})();
