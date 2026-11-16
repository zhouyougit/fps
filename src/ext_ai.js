/* =====================================================================
   SALTLINE — V34 · WP34-1/2/3 AI 层
   独立 IIFE：只通过 window.__G / window.__SX_MAPS_DATA 工作。
   - 包装 G.enemies.debug.ctx.think（所有敌人共用的 think 闭包对象），
     在原有感知/模式切换之后叠加效用选择（engage/flank/cover/suppress/retreat）
   - 真掩体：从地图数据 map.cover 筛选，实射线验证玩家眼→掩体后眼位被挡
   - 小队：3–4 人一组，assault/support/flanker/guard，同队至多 1 人开火
   - F7 可视化掩体点
   ===================================================================== */
(function () {
  "use strict";
  // V54 ARCH-2：空 catch 不再静默吞错。软错误统一走 window.SXErrors.soft("ai:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 window.__errors。
  function soft(tag, e) {
    if (typeof window === "undefined" || !window) return;
    var forwarded = false;
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") { window.SXErrors.soft("ai:" + tag, e); forwarded = true; }
    } catch (_) { forwarded = false; }
    if (forwarded) return;
    try {
      if (window.__errors) {
        window.__errors.push("[ai:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { return; }
  }

  var G = null, T = null, booted = false;
  var ctx = null;
  var params = null;           // G.params（URL 查询参数）
  var aiEnabled = true;        // 运行时开关：window.__SX_AI.enabled / params.ai2=0
  var debugOn = false;
  var DBG = null;              // THREE.Group
  var dbgT = 0;

  var state = {
    t: 0,
    mapId: "",
    covers: [],                // 静态掩体
    coversMap: "",
    coverT: 0,
    coverValid: 0,
    coverHot: [],              // 0.5s 节拍缓存：protectedNow && walkable && 距离合理的掩体
    coverHotT: 0,
    squads: [],
    squadT: 0,
    lastPlayer: null,
    playerStationaryFor: 0,
    playerMoveT: 0,
    empT: 0,
    seen: {},                  // 事件统计（调试/测试）
    throws: 0
  };

  var tmpA = null, tmpB = null, tmpC = null, tmpEye = null;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function distXZ(a, b) {
    var dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function alive(e) { return !!e && e.alive !== false && e.active !== false; }
  function currentMapId() {
    try { if (window.__SX && window.__SX.mapId) return window.__SX.mapId(); } catch (e) { soft("map-id", e); }
    try { if (window.SX_MAPKIT && window.SX_MAPKIT.current) return window.SX_MAPKIT.current(); } catch (e) { soft("mapkit-current", e); }
    return (G && G.level && (G.level.mapId || G.level.id)) || "harbor";
  }
  function interfaceEye(out) {
    var p = G.player;
    if (!p) return out.set(0, 0, 0);
    if (p.eye) return out.copy(p.eye);
    return out.set(p.pos.x, p.pos.y + (p.crouching ? 1.2 : 1.6), p.pos.z);
  }

  /* --------------------------------------------------------------- 生命周期 */
  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      var g = window.__G;
      if (g && g.enemies && g.enemies.debug && g.enemies.debug.ctx &&
          g.enemies.spawn && g.physics && g.physics.nav && g.combat) {
        clearInterval(iv);
        boot(g);
      } else if (++tries > 900) {
        clearInterval(iv);
        console.error("[sx-ai] engine not ready");
      }
    }, 100);
  }

  function boot(g) {
    if (booted) return;
    G = g;
    T = g.THREE;
    params = g.params || {};
    // 运行时开关：?ai2=0 关闭整层（think 包装退化为原逻辑）
    aiEnabled = !(params.ai2 === "0" || params.ai2 === 0 || params.ai2 === false);
    tmpA = new T.Vector3(); tmpB = new T.Vector3(); tmpC = new T.Vector3();
    tmpEye = new T.Vector3();
    ctx = g.enemies.debug.ctx;
    state.mapId = currentMapId();
    state.lastPlayer = g.player ? g.player.pos.clone() : null;
    installThink();
    installUpdate();
    installEvents();
    installCSS();
    installKeys();
    expose();
    booted = true;
    console.log("[sx-ai] V34 AI 层已加载 ·", state.mapId);
  }

  // V54 ARCH-1：防重入标记挂在宿主对象（ctx / G.enemies）上，先写标记再包覆；
  // 别人之后再包一层也不会让标记失效。重复 init 直接返回，包覆顺序不变。
  function installThink() {
    if (ctx.__sxAIThink) return;
    var baseThink = ctx.think;
    ctx.__sxAIThink = true;
    var wrapped = function (e, dt, thr) {
      if (!aiEnabled) return baseThink.call(ctx, e, dt, thr);
      baseThink.call(ctx, e, dt, thr);
      try { aiThink(e, dt); } catch (err) { if (!state.err) { state.err = String(err && err.message || err); console.error("[sx-ai] think", err); } }
    };
    ctx.think = wrapped;
  }

  function installUpdate() {
    if (G.enemies.__sxAIUpdate) return;
    var baseUpdate = G.enemies.update;
    G.enemies.__sxAIUpdate = true;
    var wrapped = function (dt) {
      var r = baseUpdate.call(G.enemies, dt);
      if (aiEnabled) {
        try { aiTick(dt); } catch (err) { if (!state.err) { state.err = String(err && err.message || err); console.error("[sx-ai] tick", err); } }
      }
      return r;
    };
    G.enemies.update = wrapped;
  }

  function installEvents() {
    G.events.on("enemy:hit", function (ev) {
      var e = ev && ev.enemy;
      if (!e) return;
      var ai = e.ai;
      if (ai) { ai.hitT = 1.6; ai.hits = (ai.hits || 0) + 1; }
      state.seen.hits = (state.seen.hits || 0) + 1;
    });
    G.events.on("sx:scout-mark", function (ev) {
      if (!ev || !ev.pos) return;
      state.seen.scoutMarks = (state.seen.scoutMarks || 0) + 1;
      markSquads(ev.pos, ev.enemy);
    });
    G.events.on("enemy:alert", function (ev) {
      var e = ev && ev.enemy;
      if (!e || !e.ai || !e.ai.squad) return;
      e.ai.squad.target.copy(e.lastKnown);
      e.ai.squad.contactT = state.t;
    });
    G.events.on("sx:emp", function (ev) {
      state.seen.emp = (state.seen.emp || 0) + 1;
      flashEMP((ev && ev.duration) || 1.6);
    });
    G.events.on("sx:warden-shield", function () {
      state.seen.warden = (state.seen.warden || 0) + 1;
    });
    G.events.on("game:state", function (ev) {
      if (ev && (ev.state === "title" || ev.state === "intro")) {
        state.squads.length = 0;
        state.covers.length = 0;
        state.coverHot.length = 0;
        state.coversMap = "";
        state.coverT = 0;
        state.coverHotT = 0;
      }
    });
    G.events.on("map:loaded", function () {
      state.squads.length = 0;
      state.covers.length = 0;
      state.coverHot.length = 0;
      state.coversMap = "";
      state.coverT = 0;
      state.coverHotT = 0;
      state.squadT = 0;
      state.mapId = currentMapId();
      // 换图后旧的掩体引用 / 寻路目标都已失效
      var list = (G.enemies && G.enemies.list) || [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e) continue;
        if (e.ai) {
          e.ai.cover = null;
          e.ai.hasCover = false;
          e.ai.repickT = 0;
        }
        if (e.goal && e.goal.set) e.goal.set(0, 0, 0);
        e.hasGoal = false;
      }
    });
  }

  /* --------------------------------------------------------------- 小队 */
  function squadOf(e) { return e && e.ai ? e.ai.squad : null; }

  function pruneSquads() {
    for (var i = state.squads.length - 1; i >= 0; i--) {
      var sq = state.squads[i];
      sq.members = sq.members.filter(alive);
      if (!sq.members.length) { state.squads.splice(i, 1); continue; }
      // claimed 里 owner 已不在 members 的占位要释放，否则掩体会被死号永久占用
      var ids = {};
      for (var m = 0; m < sq.members.length; m++) ids[sq.members[m].id] = true;
      for (var cid in sq.claimed) {
        if (!ids[sq.claimed[cid]]) delete sq.claimed[cid];
      }
    }
  }

  function assignSquad(e) {
    if (e.ai.squad && state.squads.indexOf(e.ai.squad) >= 0) return e.ai.squad;
    var best = null, bestD = 14;
    for (var i = 0; i < state.squads.length; i++) {
      var sq = state.squads[i];
      if (sq.members.length >= 4) continue;
      var d = 1e9;
      for (var j = 0; j < sq.members.length; j++) d = Math.min(d, distXZ(e.pos, sq.members[j].pos));
      if (d < bestD) { bestD = d; best = sq; }
    }
    if (best) { best.members.push(e); e.ai.squad = best; return best; }
    var ns = {
      id: "sq" + (++state.squadSeq),
      members: [e],
      target: (G.player ? G.player.pos.clone() : new T.Vector3()),
      contactT: -99,
      claimed: {},           // coverId -> enemyId
      roles: {},
      shooter: null,
      center: e.pos.clone()
    };
    e.ai.squad = ns;
    state.squads.push(ns);
    return ns;
  }

  function roleFor(e) {
    if (!e) return "assault";
    if (e.variant === "warden") return "guard";
    if (e.variant === "siege") return "support";
    if (e.variant === "scout") return "flanker";
    if (e.type === "gull") return "flanker";
    if (e.variant === "marksman" || e.variant === "turret") return "support";
    if (e.variant === "heavy") return "guard";
    return "assault";
  }

  function updateSquads() {
    state.squadSeq = state.squadSeq || 0;
    pruneSquads();
    var list = G.enemies.list || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!alive(e) || e.trainTarget || e.boss) continue;
      var ai = aiOf(e);
      if (!ai) continue;
      assignSquad(e);
    }
    var player = G.player;
    var low = player && player.health < 35;
    for (var s = 0; s < state.squads.length; s++) {
      var sq = state.squads[s];
      sq.members = sq.members.filter(alive);
      if (!sq.members.length) continue;
      // 中心 & 目标
      var cx = 0, cz = 0, cy = 0;
      for (var m = 0; m < sq.members.length; m++) {
        cx += sq.members[m].pos.x; cy += sq.members[m].pos.y; cz += sq.members[m].pos.z;
      }
      sq.center.set(cx / sq.members.length, cy / sq.members.length, cz / sq.members.length);
      for (var k = 0; k < sq.members.length; k++) {
        var mm = sq.members[k];
        if (mm.los) { sq.target.copy(mm.lastKnown); sq.contactT = state.t; }
      }
      // 角色分配：默认兵种 + 态势补齐（assault/support/flanker/guard）
      var alive_ = sq.members;
      sq.roles = {};                 // 每轮重算，避免历史计数无限累积
      var roles = alive_.map(roleFor);
      var has = function (r) { return roles.indexOf(r) >= 0; };
      if (!has("assault")) roles[0] = "assault";
      if (alive_.length >= 2 && !has("support")) roles[alive_.length - 1] = "support";
      if (alive_.length >= 3 && !has("flanker")) roles[1] = "flanker";
      if (alive_.length >= 4 && !has("guard")) roles[2] = "guard";
      // 玩家低血：提高侧翼压力，保证至少 1 个 flanker
      if (low && !has("flanker")) {
        var pick = 0;
        for (var q = 0; q < alive_.length; q++) if (alive_[q].type === "hound") { pick = q; break; }
        roles[pick] = "flanker";
      }
      for (var r = 0; r < alive_.length; r++) {
        alive_[r].ai.role = roles[r];
        sq.roles[roles[r]] = (sq.roles[roles[r]] || 0) + 1;
      }
      // 同队至多 1 人开火
      sq.shooter = null;
      var bestFire = -1;
      for (var f = 0; f < alive_.length; f++) {
        var en = alive_[f];
        var firing = isFiring(en);
        var sc = (firing ? 100 : 0) + (en.ai && en.ai.threat ? 10 : 0) + (en.type === "hound" ? 3 : 0);
        if ((firing || en.ai.intent === "suppress" || en.ai.intent === "engage") && sc > bestFire) {
          bestFire = sc; sq.shooter = en;
        }
      }
      sq.firing = !!(sq.shooter && isFiring(sq.shooter));
    }
  }

  function isFiring(e) {
    if (!e || !alive(e)) return false;
    if (e.type === "hound") return e.es === "tele" || e.es === "burst";
    if (e.type === "gull") return e.atk === "tele" || e.atk === "burst";
    return false;
  }

  function markSquads(pos, from) {
    for (var i = 0; i < state.squads.length; i++) {
      var sq = state.squads[i];
      if (from && from.ai && from.ai.squad === sq) {
        sq.target.copy(pos); sq.contactT = state.t;
      }
      for (var m = 0; m < sq.members.length; m++) {
        var e = sq.members[m];
        if (!alive(e) || e === from || e.passive) continue;
        if (distXZ(e.pos, pos) > 34) continue;
        if (e.mode === "engage") continue;
        e.lastKnown.copy(pos);
        e.mode = "investigate";
        e.modeT = 8 + Math.random() * 3;
        e.senseT = 0;
      }
    }
  }

  /* --------------------------------------------------------------- 掩体 */
  function buildCovers(mapId) {
    var data = window.__SX_MAPS_DATA && window.__SX_MAPS_DATA.maps && window.__SX_MAPS_DATA.maps[mapId];
    var out = [];
    if (!data || !data.cover) return out;
    for (var i = 0; i < data.cover.length; i++) {
      var c = data.cover[i];
      if (!c || !c.pos || !c.normal) continue;
      var n = new T.Vector3(c.normal[0], 0, c.normal[2]);
      if (n.lengthSq() < 1e-6) continue;
      n.normalize();
      out.push({
        id: mapId + ":" + i,
        mapId: mapId,
        index: i,
        pos: new T.Vector3(c.pos[0], c.pos[1], c.pos[2]),
        normal: n,
        height: c.height === "high" ? "high" : "low",
        zone: c.zone || "",
        hard: c.height === "high",
        eyeY: c.height === "high" ? 1.5 : 1.05,
        stand: new T.Vector3(c.pos[0], c.pos[1], c.pos[2]),
        protectedNow: false,
        blockedByCover: false,
        hitDist: 0,
        walkable: true
      });
    }
    return out;
  }

  function ensureCovers() {
    var id = currentMapId();
    if (state.coversMap !== id || !state.covers.length) {
      state.covers = buildCovers(id);
      state.coverHot.length = 0;
      state.coversMap = id;
      state.coverT = 0;
      state.coverHotT = 0;
      state.coverValid = 0;
      var nav = G.physics.nav;
      for (var i = 0; i < state.covers.length; i++) {
        var c = state.covers[i];
        var cands = [c.pos, tmpA.copy(c.pos).addScaledVector(c.normal, 0.62), tmpB.copy(c.pos).addScaledVector(c.normal, 1.05)];
        c.walkable = false;
        for (var ci = 0; ci < cands.length; ci++) {
          var okw = true;
          try { okw = nav.isWalkable ? !!nav.isWalkable(cands[ci].x, cands[ci].z) : true; } catch (e) { okw = true; }
          if (okw) { c.stand.copy(cands[ci]); c.walkable = true; break; }
        }
        if (!c.walkable) c.stand.copy(c.pos);
      }
      rebuildDebug();
    }
    if (state.mapId !== id) state.mapId = id;
    return state.covers;
  }

  function evalCovers() {
    var covers = ensureCovers();
    var p = G.player;
    if (!p) return;
    var eye = interfaceEye(tmpEye);
    var eyeCur = eye.clone();
    var valid = 0;
    for (var i = 0; i < covers.length; i++) {
      var c = covers[i];
      var ce = tmpA.set(c.stand.x, G.physics.groundHeight(c.stand.x, c.stand.z, c.pos.y + 2) + c.eyeY, c.stand.z);
      var d = tmpB.copy(ce).sub(eyeCur);
      var len = d.length();
      if (len < 0.8) { c.protectedNow = true; c.blockedByCover = true; c.hitDist = 0; valid++; continue; }
      if (len > 42) { c.protectedNow = false; c.blockedByCover = false; c.hitDist = len; continue; }
      d.multiplyScalar(1 / len);
      var hit = G.physics.raycast(eyeCur, d, Math.max(0.05, len - 0.15));
      c.hitDist = hit ? hit.dist : len;
      c.protectedNow = !!hit;
      c.blockedByCover = !!(hit && hit.point.distanceTo(ce) < 2.4);
      if (c.protectedNow && c.walkable) valid++;
    }
    state.coverValid = valid;
    if (debugOn) rebuildDebug();
  }

  // 0.5s 节拍：缓存"当前对玩家眼位有效且可站立"的掩体，aiThink 只读这份热列表
  function updateCoverHot() {
    var covers = ensureCovers();
    var hot = state.coverHot;
    hot.length = 0;
    var p = G.player;
    var px = p ? p.pos.x : 0, pz = p ? p.pos.z : 0;
    for (var i = 0; i < covers.length; i++) {
      var c = covers[i];
      if (!c.protectedNow || !c.walkable) continue;
      if (p) {
        var dx = c.pos.x - px, dz = c.pos.z - pz;
        if (dx * dx + dz * dz > 44 * 44) continue;   // evalCovers 已按 42m 眼距过滤，这里再兜底
      }
      hot.push(c);
    }
  }

  function coversForPick(e, mode) {
    var covers = ensureCovers();
    var p = G.player;
    var sq = e.ai && e.ai.squad;
    var ideal = e.rangeMax ? (e.rangeMin || 0) * 0.5 + e.rangeMax * 0.5 : 14;
    var width = e.rangeMax ? Math.max(6, e.rangeMax - (e.rangeMin || 0)) : 12;
    var best = null, bestS = -1e9;
    var clearCalls = 0;                       // nav.clearLine 每次挑点限流（最贵的一步）
    var CLEAR_MAX = 5;
    var target = (p && p.pos) || e.lastKnown;
    for (var i = 0; i < covers.length; i++) {
      var c = covers[i];
      if (!c.walkable || !c.protectedNow) continue;
      var de = distXZ(e.pos, c.stand);
      if (de > 24 || de < 0.3) continue;
      if (sq && sq.claimed[c.id] && sq.claimed[c.id] !== e.id) continue;
      var toT = tmpA.copy(target).sub(c.stand); toT.y = 0;
      var tl = toT.length() || 1; toT.multiplyScalar(1 / tl);
      var face = c.normal.dot(toT);
      var dT = distXZ(c.stand, target);
      var bell = Math.max(0, 1 - Math.abs(dT - ideal) / width);
      var s = (c.hard ? 3 : 1) + (c.height === "high" ? 1 : 0.5);
      s += bell * 4;
      s -= de * 0.15;
      s += -face * 1.5;
      s += (c.blockedByCover ? 2.5 : 0.8);
      if (mode === "flank") {
        var out = tmpB.copy(sq ? sq.center : e.pos).sub(target); out.y = 0;
        var ol = out.length() || 1; out.multiplyScalar(1 / ol);
        var ang = Math.acos(clamp(out.dot(toT), -1, 1));
        if (ang < Math.PI / 3 || ang > Math.PI * 2 / 3) s -= 4; else s += 3;
      }
      // 别扎堆
      if (sq) {
        for (var m = 0; m < sq.members.length; m++) {
          var mm = sq.members[m];
          if (mm === e || !alive(mm)) continue;
          if (distXZ(mm.pos, c.stand) < 3) s -= 1.5;
        }
      }
      // 只有可能超过当前最优的候选才做寻路直线检查；每次挑点最多 5 次
      if (clearCalls < CLEAR_MAX && s + 1.5 > bestS) {
        clearCalls++;
        try { if (G.physics.nav.clearLine && G.physics.nav.clearLine(e.pos, c.stand)) s += 1.5; else s -= 0.5; } catch (err) { soft("nav-clear-line", err); }
      }
      if (s > bestS) { bestS = s; best = c; }
    }
    if (best) {
      // 占位
      if (sq) {
        for (var k in sq.claimed) if (sq.claimed[k] === e.id) delete sq.claimed[k];
        sq.claimed[best.id] = e.id;
      }
      e.ai.coverScore = +bestS.toFixed(2);
    }
    return best;
  }

  /* --------------------------------------------------------------- 效用 */
  function playerStationary() {
    return state.playerStationaryFor;
  }

  function weightsFor(e) {
    var p = G.player;
    var low = !!(p && p.health < 35);
    var hp01 = e ? clamp((e.hp || 1) / (e.maxHp || e.hp || 1), 0, 1) : 1;
    var role = (e && e.ai && e.ai.role) || "assault";
    var w = { engage: 0.9, flank: 0.8, cover: 1.0, suppress: 0.75, retreat: 1.1 };
    if (role === "assault") { w.engage *= 1.25; w.cover *= 0.95; }
    else if (role === "support") { w.suppress *= 1.35; w.engage *= 0.9; }
    else if (role === "flanker") { w.flank *= 1.45; w.engage *= 0.8; }
    else if (role === "guard") { w.cover *= 1.35; w.suppress *= 0.8; }
    if (low) { w.flank *= 1.8; w.engage *= 1.15; w.cover *= 0.9; }
    w.retreat *= (hp01 < 0.25 ? 2.2 : hp01 < 0.45 ? 1.3 : 0.55);
    if (playerStationary() > 3) w.flank *= 1.25;
    return w;
  }

  function evaluate(e, ai) {
    var p = G.player;
    if (!p) return;
    var hp01 = clamp((e.hp || 1) / (e.maxHp || e.hp || 1), 0, 1);
    var d = distXZ(e.pos, p.pos);
    var los = !!e.los;
    var w = weightsFor(e);
    var ideal = e.rangeMax ? (e.rangeMin || 0) * 0.5 + e.rangeMax * 0.5 : 14;
    var inRange = d < (e.rangeMax || 22) + 4 && d > (e.rangeMin || 0) - 3;
    var inCover = !!(ai.cover && ai.cover.protectedNow && distXZ(e.pos, ai.cover.pos) < 1.8);
    var hasCover = ai.hasCover;
    var lowPlayer = p.health < 35;
    var sq = ai.squad;
    var teamFiring = !!(sq && sq.shooter && sq.shooter !== e && isFiring(sq.shooter));
    var roleFlank = ai.role === "flanker";
    var threatened = ai.hitT > 0 || (e.exposure || 0) > 0.65;

    var engage = w.engage * (los ? 1 : 0.12) * (inRange ? 1.15 : 0.45) * (inCover ? 1.2 : 1) * (1 + (e.exposure || 0) * 0.3);
    var flank = w.flank * (los ? 0.9 : 0.75) * (roleFlank ? 1.3 : 0.85) * (playerStationary() > 3 ? 1.2 : 1) * (lowPlayer ? 1.5 : 1) * (hasCover ? 1 : 0.5);
    var cover = w.cover * (threatened ? 1.6 : 1) * (hp01 < 0.5 ? 1.5 : 1) * (hasCover ? 1 : 0.35) * (inCover ? 0.55 : 1);
    var suppress = w.suppress * (los ? 1.2 : 0.45) * (inRange ? 1 : 0.5) * (1 + (sq ? 1 - sq.members.length / 5 : 0));
    var retreat = w.retreat * (hp01 < 0.22 ? 3 : 1) * (e.exposure > 0.8 ? 1.2 : 1) * (hasCover ? 1 : 0.4);
    if (e.variant === "siege") { engage *= 1.7; cover *= 0.35; suppress *= 0.5; }
    if (teamFiring && !isFiring(e)) { engage *= 0.18; suppress *= 0.12; }
    if (!hasCover) cover *= 0.4;
    // 压制值（被玩家火力压制）→ 缩回
    if (ai.suppressT > 0.6) { cover *= 1.5; flank *= 0.5; engage *= 0.5; }

    ai.utility = {
      engage: +engage.toFixed(3),
      flank: +flank.toFixed(3),
      cover: +cover.toFixed(3),
      suppress: +suppress.toFixed(3),
      retreat: +retreat.toFixed(3)
    };
    ai.threat = threatened ? 1 : 0;
    ai.dist = +d.toFixed(2);
    ai.los = los;
    ai.inCover = inCover;
  }

  function pickIntent(ai) {
    var keys = ["engage", "flank", "cover", "suppress", "retreat"];
    var best = keys[0], bestS = -1e9;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var s = ai.utility[k] || 0;
      if (k === ai.intent) s *= 1.15;          // 15% 滞回，防抖动
      if (s > bestS) { bestS = s; best = k; }
    }
    return best;
  }

  function applyIntent(e, ai, dt) {
    var p = G.player;
    if (!p || p.alive === false) return;
    if (e.passive) return;
    if (e.boss) return;              // BOSS 由 ext_boss2 驱动
    if (ai.intent === "cover" || ai.intent === "flank" || ai.intent === "retreat") {
      // 只在当前掩体失效且冷却结束时重选；无候选也进冷却，避免每帧重打分
      if (ai.repickT <= 0 && (!ai.cover || !ai.cover.protectedNow)) {
        var mode = ai.intent === "flank" ? "flank" : "defensive";
        var c = coversForPick(e, mode);
        if (c) ai.cover = c;
        ai.repickT = 1.2;
      }
      if (!ai.cover) return;
      var cp = ai.cover.stand || ai.cover.pos;
      if (e.type === "hound" && !e.fixed) {
        if (!e.hasGoal || ai.moveTo.distanceToSquared(cp) > 0.36) {
          ai.moveTo.copy(cp);
          e.goal.copy(cp);
          e.hasGoal = true;
          e.planT = 0;
          e.stuckT = 0;
          try { e.firePlayer.copy(p.pos); } catch (err) { soft("fire-player", err); }
        }
        if (e.es !== "tele" && e.es !== "burst" && e.es !== "wind" && e.es !== "lunge" && e.es !== "recover") {
          e.es = "move";
          e.moveT = 0;
        }
      } else if (e.type === "gull") {
        e.orbitR = clamp(distXZ(cp, p.pos), 7, 18);
        e.orbitA = Math.atan2(cp.z - p.pos.z, cp.x - p.pos.x);
        e.alt = (ai.cover.height === "high" ? 6 : 4.2) + p.pos.y;
      }
    } else {
      // engage / suppress：交给原有闭包开火，仅在无视线/超距时推进到 lastKnown
      if (e.type === "hound" && !e.fixed && (!e.los || distXZ(e.pos, p.pos) > (e.rangeMax || 22) + 5)) {
        if (!e.hasGoal || ai.moveTo.distanceToSquared(e.lastKnown) > 1) {
          ai.moveTo.copy(e.lastKnown);
          e.goal.copy(e.lastKnown);
          e.hasGoal = true;
          e.planT = 0;
        }
        if (e.es !== "tele" && e.es !== "burst" && e.es !== "wind" && e.es !== "lunge" && e.es !== "recover") e.es = "move";
      }
      if (e.variant === "siege" && e.type === "hound" && e.es === "aim" && e.los) {
        if (e.cool > 0.3) e.cool = 0.3;
      }
      if (ai.intent === "suppress" && e.type === "hound" && e.es === "aim" && e.hasToken) {
        if (e.cool > 0.05) e.cool = 0.05;
        ai.suppressT = Math.min(2, ai.suppressT + dt);
      }
    }
  }

  function enforceSquadFire(e, ai) {
    var sq = ai.squad;
    if (!sq || !sq.shooter || sq.shooter === e) return;
    if (e.variant === "siege") return;   // 曲射机体不受单发令牌约束
    if (e.type === "hound" && e.es === "tele") {
      try { ctx.releaseToken(e); } catch (err) { soft("squad-token-hound", err); }
      e.es = "aim";
      e.cool = Math.max(e.cool || 0, 0.7);
      ai.holdT = 0.8;
    } else if (e.type === "gull" && e.atk === "tele") {
      try { ctx.releaseToken(e); } catch (err) { soft("squad-token-gull", err); }
      e.atk = "idle";
      e.cool = Math.max(e.cool || 0, 0.6);
      ai.holdT = 0.8;
    }
  }

  function aiOf(e) {
    if (!e || e.trainTarget) return null;
    var ai = e.ai;
    if (!ai || ai.uid !== e.id) {
      ai = e.ai = {
        uid: e.id,
        role: roleFor(e),
        intent: "engage",
        utility: { engage: 0, flank: 0, cover: 0, suppress: 0, retreat: 0 },
        cover: null,
        coverScore: 0,
        squad: null,
        suppressT: 0,
        retreatT: 0,
        hitT: 0,
        evalT: Math.random() * 0.25,
        repickT: 0,
        hasCoverT: 0,
        moveTo: new T.Vector3(1e9, 0, 0),
        hasCover: false,
        threat: 0,
        los: false,
        dist: 0,
        inCover: false,
        holdT: 0
      };
    }
    return ai;
  }

  function aiThink(e, dt) {
    if (!booted || !G.player || e.trainTarget) return;
    if (!(dt > 0)) return;
    var ai = aiOf(e);
    if (!ai) return;
    if (dt > 0.1) dt = 0.1;
    if (!alive(e)) return;
    ai.hitT = Math.max(0, ai.hitT - dt);
    ai.suppressT = Math.max(0, ai.suppressT - dt);
    ai.retreatT = Math.max(0, ai.retreatT - dt);
    ai.repickT -= dt;
    ai.hasCoverT -= dt;
    ai.evalT -= dt;
    // 有掩体可用？只扫 0.5s 节拍热列表；每敌 0.25s 重算一次
    if (ai.hasCoverT <= 0) {
      ai.hasCoverT = 0.25;
      ai.hasCover = false;
      var hot = state.coverHot;
      for (var i = 0; i < hot.length; i++) {
        if (distXZ(e.pos, hot[i].pos) < 24) { ai.hasCover = true; break; }
      }
    }
    if (ai.evalT <= 0) {
      ai.evalT = 0.3 + (e.id % 5) * 0.02;
      evaluate(e, ai);
      ai.intent = pickIntent(ai);
      if (ai.intent === "retreat") ai.retreatT = 2;
      applyIntent(e, ai, dt);
    } else {
      applyIntent(e, ai, dt);
    }
    enforceSquadFire(e, ai);
  }

  /* --------------------------------------------------------------- tick */
  function aiTick(dt) {
    if (!booted || !(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    state.t += dt;
    var p = G.player;
    if (p) {
      if (state.lastPlayer) {
        var moved = distXZ(p.pos, state.lastPlayer);
        if (moved > 0.05) {
          state.playerStationaryFor = 0;
          state.lastPlayer.copy(p.pos);
        } else {
          state.playerStationaryFor += dt;
        }
      } else state.lastPlayer = p.pos.clone();
    }
    ensureCovers();
    state.coverT -= dt;
    if (state.coverT <= 0) {
      state.coverT = 0.6;
      try { evalCovers(); } catch (err) { soft("eval-covers", err); }
    }
    state.coverHotT -= dt;
    if (state.coverHotT <= 0) {
      state.coverHotT = 0.5;
      try { updateCoverHot(); } catch (err) { soft("cover-hot", err); }
    }
    state.squadT -= dt;
    if (state.squadT <= 0) {
      state.squadT = 0.5;
      try { updateSquads(); } catch (err) { soft("update-squads", err); }
    }
    if (debugOn) {
      dbgT -= dt;
      if (dbgT <= 0) { dbgT = 0.25; rebuildDebug(); }
      if (DBG) DBG.visible = true;
    } else if (DBG) DBG.visible = false;
  }

  /* --------------------------------------------------------------- 调试 F7 */
  function rebuildDebug() {
    if (!debugOn || !booted) { if (DBG) DBG.visible = false; return; }
    if (!DBG) {
      DBG = new T.Group();
      DBG.name = "sx-ai-covers";
      G.scene.add(DBG);
    }
    while (DBG.children.length) DBG.remove(DBG.children[0]);
    var geo = new T.BoxGeometry(0.26, 0.26, 0.26);
    for (var i = 0; i < state.covers.length; i++) {
      var c = state.covers[i];
      if (!c.walkable) continue;
      var mat = new T.MeshBasicMaterial({ color: c.protectedNow ? 0xffb347 : 0x2b3740, transparent: true, opacity: c.protectedNow ? 0.95 : 0.4 });
      var m = new T.Mesh(geo, mat);
      m.position.set(c.pos.x, G.physics.groundHeight(c.pos.x, c.pos.z, c.pos.y + 2) + 0.35, c.pos.z);
      m.scale.setScalar(c.height === "high" ? 1.15 : 0.8);
      DBG.add(m);
    }
    DBG.visible = true;
  }

  /* --------------------------------------------------------------- EMP 屏效 */
  function installCSS() {
    if (document.getElementById("sx-ai-css")) return;
    var css = document.createElement("style");
    css.id = "sx-ai-css";
    css.textContent = [
      ".sx-emp-veil{position:fixed;inset:0;pointer-events:none;z-index:96;opacity:0;transition:opacity .12s;",
      "  background:repeating-linear-gradient(0deg,rgba(120,220,255,.16) 0 1px,transparent 1px 3px),",
      "  repeating-linear-gradient(90deg,rgba(255,60,60,.10) 0 2px,transparent 2px 7px);",
      "  mix-blend-mode:screen;filter:contrast(1.4);}",
      ".sx-emp-veil.on{opacity:1;animation:sx-emp-glitch .18s steps(2,end) infinite;}",
      ".sx-emp-shift{filter:blur(.6px) saturate(.55) hue-rotate(18deg);}",
      "@keyframes sx-emp-glitch{0%{transform:translate(0,0);}25%{transform:translate(-3px,1px);}50%{transform:translate(2px,-2px);}75%{transform:translate(-1px,2px);}100%{transform:translate(0,0);}}",
      ".sx-emp-tag{position:fixed;left:50%;top:calc(14% + var(--sat,0px));transform:translateX(-50%);z-index:97;",
      "  font:700 11px/1 var(--f-label,monospace);letter-spacing:.34em;color:#9fe8ff;background:rgba(8,14,18,.72);",
      "  border:1px solid rgba(120,220,255,.45);padding:6px 12px;opacity:0;transition:opacity .12s;pointer-events:none;}",
      ".sx-emp-tag.on{opacity:1;}",
      "@media (prefers-reduced-motion: reduce){.sx-emp-veil.on{animation:none;}}"
    ].join("");
    document.head.appendChild(css);
    var veil = document.createElement("div");
    veil.className = "sx-emp-veil"; veil.id = "sx-emp-veil";
    var tag = document.createElement("div");
    tag.className = "sx-emp-tag"; tag.id = "sx-emp-tag";
    tag.textContent = "EMP · 视觉系统干扰";
    document.body.appendChild(veil);
    document.body.appendChild(tag);
  }

  function flashEMP(dur) {
    var veil = document.getElementById("sx-emp-veil");
    var tag = document.getElementById("sx-emp-tag");
    var ui = document.getElementById("ui");
    if (!veil) return;
    veil.classList.add("on");
    if (tag) tag.classList.add("on");
    if (ui) ui.classList.add("sx-emp-shift");
    state.empT = Math.max(state.empT || 0, dur);
    setTimeout(function () {
      if (veil) veil.classList.remove("on");
      if (tag) tag.classList.remove("on");
      if (ui) ui.classList.remove("sx-emp-shift");
    }, Math.max(200, dur * 1000));
    try { if (G.player && G.player.addShake) G.player.addShake(0.35); } catch (e) { soft("emp-shake", e); }
  }

  function installKeys() {
    window.addEventListener("keydown", function (ev) {
      if (ev.code === "F7" || ev.key === "F7") {
        debugOn = !debugOn;
        rebuildDebug();
        try { if (G.hud && G.hud.message) G.hud.message("AI 掩体可视化 " + (debugOn ? "ON" : "OFF"), 1.2); } catch (e) { soft("debug-toggle-hud", e); }
        ev.preventDefault();
      }
    });
  }

  /* --------------------------------------------------------------- API */
  function expose() {
    window.__SX_AI = {
      state: function () {
        var list = (G.enemies.list || []).filter(alive).map(function (e) {
          var ai = e.ai || {};
          return {
            id: e.id, type: e.type, variant: e.variant || "", hp: e.hp, maxHp: e.maxHp,
            pos: [e.pos.x, e.pos.y, e.pos.z].map(function (v) { return +v.toFixed(2); }),
            mode: e.mode, role: ai.role, intent: ai.intent,
            utility: ai.utility, cover: ai.cover ? ai.cover.id : null,
            squad: ai.squad ? ai.squad.id : null,
            suppressT: ai.suppressT, retreatT: ai.retreatT,
            los: !!ai.los, dist: ai.dist
          };
        });
        return {
          ok: true, enabled: aiEnabled, debug: debugOn, mapId: state.mapId,
          covers: state.covers.length, validCovers: state.coverValid, hotCovers: state.coverHot.length,
          squads: state.squads.length, enemies: list,
          weights: weightsFor(null),
          stats: state.seen,
          err: state.err || null,
          t: +state.t.toFixed(2)
        };
      },
      squads: function () {
        return state.squads.map(function (sq) {
          var rolesCopy = {};                   // 返回拷贝，外部改动不污染内部统计
          for (var k in sq.roles) rolesCopy[k] = sq.roles[k];
          return {
            id: sq.id, size: sq.members.length,
            roles: rolesCopy,
            firing: sq.firing ? sq.firing.id : null,
            members: sq.members.map(function (e) {
              return { id: e.id, type: e.type, variant: e.variant || "", role: e.ai && e.ai.role, intent: e.ai && e.ai.intent, hp: e.hp };
            })
          };
        });
      },
      covers: function (mapId, all) {
        var id = mapId || currentMapId();
        var list;
        if (id === state.coversMap) { list = state.covers.slice(); }
        else list = buildCovers(id);
        var out = list.map(function (c) {
          return {
            id: c.id, index: c.index, zone: c.zone, height: c.height, hard: c.hard,
            pos: [c.pos.x, c.pos.y, c.pos.z].map(function (v) { return +v.toFixed(3); }),
            stand: [c.stand.x, c.stand.y, c.stand.z].map(function (v) { return +v.toFixed(3); }),
            normal: [c.normal.x, c.normal.y, c.normal.z].map(function (v) { return +v.toFixed(3); }),
            walkable: c.walkable, eyeY: c.eyeY, protectedNow: !!c.protectedNow,
            blockedByCover: !!c.blockedByCover, hitDist: +(c.hitDist || 0).toFixed(2)
          };
        });
        if (!all) out = out.filter(function (c) { return c.walkable && c.protectedNow; });
        return out;
      },
      setDebug: function (on) { debugOn = !!on; rebuildDebug(); return debugOn; },
      weights: function () { return weightsFor(null); },
      refresh: function () { state.coverT = 0; state.coverHotT = 0; state.squadT = 0; evalCovers(); updateCoverHot(); updateSquads(); return true; },
      table: function () {
        return [
          { intent: "engage", base: 0.90, cons: "有视线 · 在射程 · 掩体内加成", role: "assault" },
          { intent: "flank", base: 0.80, cons: "玩家站桩>3s · 玩家<35HP ×1.8 · flanker ×1.45", role: "flanker" },
          { intent: "cover", base: 1.00, cons: "最近被命中 · 低血 · 真掩体可用", role: "guard" },
          { intent: "suppress", base: 0.75, cons: "有视线 · 同队开火令牌", role: "support" },
          { intent: "retreat", base: 1.10, cons: "HP<22% ×3 · 无掩体降权", role: "assault" }
        ];
      }
    };
    // 运行时开关：__SX_AI.enabled = false 时 think/update 包装直接退化为原逻辑
    try {
      Object.defineProperty(window.__SX_AI, "enabled", {
        get: function () { return aiEnabled; },
        set: function (v) { aiEnabled = !!v; },
        configurable: true
      });
    } catch (e) { soft("expose-enabled", e); }
    window.__SX_AI.setEnabled = function (on) { aiEnabled = !!on; return aiEnabled; };
    window.__SX_AI_VERSION = "V34.1";
  }

  wait();
})();