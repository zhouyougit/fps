/* =====================================================================
   SALTLINE — V34 · WP34-3 四种新机体
   独立 IIFE：包装 G.enemies.spawn，把自定义类型映射到 gull / hound 池。
   scout  侦察蜂  gull 底盘 40HP  不攻击 · 发现玩家为小队 rally
   siege  攻城蛛  hound 底盘 360HP 远程曲射 2 发 · 溅射
   emp    电磁犬  hound 底盘 140HP 命中干扰 HUD · 近身自爆 EMP（不致命）
   warden 盾墙无人机 gull 底盘 220HP 附近敌人减伤 · 护盾可击破
   ===================================================================== */
(function () {
  "use strict";
  // V54 ARCH-2：空 catch 不再静默吞错。软错误统一走 window.SXErrors.soft("enemies2:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 window.__errors。
  function soft(tag, e) {
    if (typeof window === "undefined" || !window) return;
    var forwarded = false;
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") { window.SXErrors.soft("enemies2:" + tag, e); forwarded = true; }
    } catch (_) { forwarded = false; }
    if (forwarded) return;
    try {
      if (window.__errors) {
        window.__errors.push("[enemies2:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { return; }
  }

  var G = null, T = null, booted = false;
  // V42：特殊机体数值统一在 src/config/balance.js 的 enemies.variants
  var DEFS = (window.SX_BALANCE && window.SX_BALANCE.enemies && window.SX_BALANCE.enemies.variants) || {};

  var state = {
    stats: { spawns: 0, scoutMarks: 0, emp: 0, empBursts: 0, shells: 0, shieldHits: 0, shieldBreaks: 0, wardenTicks: 0 },
    shells: [],
    variants: {},
    auraT: 0,
    err: null,
    // V37：m7/m8 固定轮换替换计数（显式、可复现；不使用 Math.random）
    replace: { missionId: "", gull: 0, hound: 0, offset: 0 }
  };

  function alive(e) { return !!e && e.alive !== false && e.active !== false; }
  function distXZ(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function clampx(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      var g = window.__G;
      if (g && g.enemies && g.enemies.spawn && g.enemies.debug && g.physics && g.combat && g.THREE) {
        clearInterval(iv);
        boot(g);
      } else if (++tries > 900) { clearInterval(iv); console.error("[sx-e2] engine not ready"); }
    }, 100);
  }

  function boot(g) {
    if (booted) return;
    G = g; T = g.THREE;
    // V54 ARCH-1：防重入标记挂在宿主对象（g.enemies）上，先写标记再包覆；
    // 别人之后再包一层也不会让标记失效。重复 init 直接返回，包覆顺序不变。
    if (g.enemies.__sxE2Spawn) return;
    var baseSpawn = g.enemies.spawn;
    g.enemies.__sxE2Spawn = true;
    var wrapped = function (type, pos, opts) {
      var def = DEFS[type];
      if (!def) {
        // V37：m7/m8 中把一部分 gull/hound 按固定轮换替换为新机体。
        // 普通六关 currentMission 不是 m7/m8，完全不走这条分支。
        var repl = replacementFor(type);
        if (repl) {
          var rdef = DEFS[repl];
          var er = baseSpawn.call(g.enemies, rdef.base, pos, opts);
          if (er) {
            try { setup(er, repl, rdef, opts || {}); } catch (err) { state.err = String(err && err.message || err); console.error("[sx-e2] setup", err); }
            if (rdef.base === "hound") attachGroundBlob(er);
            return er;
          }
        }
        var en0 = baseSpawn.call(g.enemies, type, pos, opts);
        // V37：对象池复用普通机体时，清掉上一条命的变体状态与 WARDEN 网格。
        if (en0) {
          clearVariant(en0); wrapDamage(en0);
          if (type === "hound" || type === "turret") attachGroundBlob(en0);
        }
        return en0;
      }
      var oe = opts || {};
      var en = baseSpawn.call(g.enemies, def.base, pos, oe);
      if (!en) return null;
      try { setup(en, type, def, oe); } catch (err) { state.err = String(err && err.message || err); console.error("[sx-e2] setup", err); }
      if (def.base === "hound") attachGroundBlob(en);
      return en;
    };
    g.enemies.spawn = wrapped;

    var baseUpdate = g.enemies.update;
    if (!g.enemies.__sxE2Update) {
      g.enemies.__sxE2Update = true;
      var upd = function (dt) {
        var r = baseUpdate.call(g.enemies, dt);
        try { tick(dt); } catch (err) { if (!state.err) state.err = String(err && err.message || err); }
        return r;
      };
      g.enemies.update = upd;
    }

    g.events.on("enemy:fire", onFire);
    // V37：切图 / 重开 / 死亡时清空曲射弹并移除场景网格
    g.events.on("map:loaded", clearShells);
    g.events.on("game:state", function (ev) {
      var st = ev && ev.state;
      if (st === "title" || st === "intro" || st === "dead") clearShells();
      if (st === "intro") {
        state.replace.missionId = "";
        state.replace.gull = 0;
        state.replace.hound = 0;
      }
    });
    g.events.on("enemy:killed", function (ev) {
      var e = ev && ev.enemy;
      if (e && e.variant === "scout" && !e.__sxScoutPaid) {
        e.__sxScoutPaid = true;
        try { if (window.__SX_PROGRESS && window.__SX_PROGRESS.add) window.__SX_PROGRESS.add(5); } catch (err) { soft("progress-add", err); }
        try { G.events.emit("sx:kill-reward", { amount: 5, reason: "scout", enemy: e }); } catch (err) { soft("emit-kill-reward", err); }
      }
    });
    booted = true;
    expose();
    console.log("[sx-e2] V34 新机体已加载");
  }

  /* --------------------------------------------------------------- setup */
  function playerHpScale() {
    try {
      var S = window.__SX && window.__SX.S;
      return (S && S.hpScale) || 1;
    } catch (e) { return 1; }
  }

  // 池复用：恢复引擎原始 _update、移除 WARDEN 网格、清空变体运行态。
  function detachWardenMesh(en) {
    var mesh = en.wardenMesh;
    if (!mesh) return;
    try { if (mesh.parent) mesh.parent.remove(mesh); } catch (e) { soft("detach-mesh", e); }
    try { if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose(); } catch (e) { soft("detach-geo", e); }
    try { if (mesh.material && mesh.material.dispose) mesh.material.dispose(); } catch (e) { soft("detach-mat", e); }
    en.wardenMesh = null;
  }

  function clearVariant(en) {
    if (!en) return;
    if (en._sx2Wrapped) {
      if (en._sx2BaseUpdate) en._update = en._sx2BaseUpdate;
      en._sx2Wrapped = false;
    }
    en._sx2BaseUpdate = null;
    en.sx2 = null;
    detachWardenMesh(en);
    en.wardenShield = 0;
    en.wardenMaxShield = 0;
    en.__sxShieldMul = 1;
  }

  // V37：固定轮换（每 3 次 gull/hound 请求替换 1 次，scout/warden、siege/emp 交替）。
  // offset 只由 G.rng 决定先出哪一个，替换数量恒定，保证可复现。
  function resetReplacements(mid) {
    state.replace.missionId = mid;
    state.replace.gull = 0;
    state.replace.hound = 0;
    var r = 0;
    try { r = G.rng ? G.rng() : 0; } catch (e) { r = 0; }
    state.replace.offset = (Math.abs(Number(r) || 0) < 0.5) ? 0 : 1;
  }

  function replacementFor(type) {
    if (type !== "gull" && type !== "hound") return null;
    var m = G && G.game && G.game.currentMission;
    if (!m || (m.id !== "m7" && m.id !== "m8")) return null;
    if (state.replace.missionId !== m.id) resetReplacements(m.id);
    var n = (state.replace[type] = (state.replace[type] || 0) + 1);
    if (n % 3 !== 0) return null;
    var idx = Math.floor(n / 3) - 1;
    var flip = (idx + state.replace.offset) % 2;
    if (type === "gull") return flip ? "warden" : "scout";
    return flip ? "emp" : "siege";
  }

  var groundBlobGeo = null, groundBlobMat = null;
  function attachGroundBlob(en) {
    if (!en || !en.rig || !en.rig.group || !T) return;
    var g = en.rig.group;
    if (g.getObjectByName("sx-ground-blob")) return;
    if (!groundBlobGeo) {
      groundBlobGeo = new T.CircleGeometry(0.62, 18);
      groundBlobGeo.rotateX(-Math.PI / 2);
      groundBlobMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false });
    }
    var m = new T.Mesh(groundBlobGeo, groundBlobMat);
    m.name = "sx-ground-blob";
    m.position.y = 0.018;
    m.renderOrder = 1;
    m.castShadow = false;
    m.receiveShadow = false;
    g.add(m);
  }

  function setup(en, type, def, opts) {
    clearVariant(en);
    en.variant = type;
    en.sxVariant = type;
    en.credits = def.credits;
    en.threat = def.threat;
    en.maxHp = def.hp * ((opts && opts.hpScale) || playerHpScale());
    en.hp = en.maxHp;
    en.hitScale = def.hitScale;
    en.hitRadiusSq = def.hitRadiusSq;
    if (en.lens && en.lens.color) en.lens.color.setRGB(def.lens[0], def.lens[1], def.lens[2]);
    if (en.rig && en.rig.group) en.rig.group.scale.setScalar(def.hitScale);
    if (type === "siege" || type === "emp") {
      en.runSpeed = def.runSpeed;
      en.rangeMin = def.rangeMin;
      en.rangeMax = def.rangeMax;
      // V37：0.0001 防止引擎的 `shotDamage || fallback(5)` 回退成 5 点直伤；
      // 真正的伤害由曲射弹 / EMP 事件结算。
      en.shotDamage = 0.0001;
      en.telegraph = def.telegraph;
      en.coolMul = def.coolMul;
      // 攻城蛛一次齐射固定 2 发（引擎 burst 状态机），弹道统一走 enemy:fire。
      if (type === "siege") en.burstCount = 2;
      if (def.spreadMul) en.spreadMul = def.spreadMul;
      en.cool = 0.8;
    }
    if (type === "scout" || type === "warden") {
      en.passive = true;                 // 不攻击；由本模块驱动飞行
      en.mode = "patrol";
      en.modeT = 999;
      en.atk = "idle";
      en.cool = 999;
      en.orbitDir = type === "scout" ? 1 : -1;
      en.patrolR = type === "scout" ? 0.5 : 2.2;
      en.hoverFixed = false;
      en.alt = 4.5;
    }
    // 复用对象池：清空本变体状态
    en.sx2 = {
      variant: type, t: 0, markT: Math.random() * 0.5, shieldT: 0,
      shieldUp: type === "warden", shieldCd: 0, empCharge: -1, empCool: 0,
      burstT: 0, dead: false,
      fireCd: 0, seenT: 0
    };
    en.wardenShield = type === "warden" ? def.shield : 0;
    en.wardenMaxShield = type === "warden" ? def.shield : 0;
    if (type === "warden") attachWardenMesh(en);
    if (type === "siege") en.ai2Range = def.rangeMax;

    if (!en._sx2Wrapped) {
      en._sx2Wrapped = true;
      en._sx2BaseUpdate = en._update;
      en._update = function (dt) {
        var base = en._sx2BaseUpdate;
        if (!en.alive) { base.call(en, dt); return; }
        var pre = en.sx2;
        if (pre && (pre.variant === "scout" || pre.variant === "warden")) {
          // 让 gull 保持巡逻控制，位置由 post 接管
          en.mode = "patrol"; en.modeT = 999;
        }
        base.call(en, dt);
        if (!en.alive) return;
        try { post(en, dt); } catch (err) { if (!state.err) state.err = String(err && err.message || err); }
      };
    }
    wrapDamage(en);
    state.variants[type] = (state.variants[type] || 0) + 1;
    state.stats.spawns++;
    try { G.events.emit("sx:enemy-variant", { enemy: en, variant: type, hp: en.hp }); } catch (err) { soft("emit-variant", err); }
  }

  function wrapDamage(en) {
    if (!en || en._sx2DamageWrapped === true || typeof en.damage !== "function") return;
    en._sx2DamageWrapped = true;
    en._sx2BaseDamage = en.damage;
    en.damage = function (amount, point, dir, part) {
      var e = this;
      if (!alive(e)) return false;
      var a = amount;
      // 盾墙光环：附近敌人减伤 35%（缓存每 0.2s，回退则现场找最近 warden）
      var mul = (typeof e.__sxShieldMul === "number") ? e.__sxShieldMul : 1;
      if (mul < 1) a *= mul;
      else {
        var w = nearestWarden(e);
        if (w && w !== e && w.sx2 && w.sx2.shieldUp) a *= 0.65;
      }
      if (e.variant === "warden" && e.wardenShield > 0) {
        var absorbed = Math.min(e.wardenShield, a * 0.8);
        e.wardenShield -= absorbed;
        a -= absorbed;
        state.stats.shieldHits++;
        if (e.sx2) e.sx2.shieldUp = true;
        try { G.events.emit("sx:warden-shield", { enemy: e, shield: e.wardenShield, max: e.wardenMaxShield, hit: true }); } catch (err) { soft("emit-shield-hit", err); }
        if (e.wardenShield <= 0.01) {
          e.wardenShield = 0;
          if (e.sx2) { e.sx2.shieldUp = false; e.sx2.shieldCd = 6; }
          if (e.wardenMesh) e.wardenMesh.visible = false;
          state.stats.shieldBreaks++;
          try { G.events.emit("sx:warden-shield", { enemy: e, broken: true, shield: 0 }); } catch (err) { soft("emit-shield-break", err); }
          try { if (G.fx) G.fx.sparks(e.pos, new T.Vector3(0, 1, 0), 14); } catch (err) { soft("fx-shield-break", err); }
        }
      }
      return e._sx2BaseDamage.call(e, a, point, dir, part);
    };
  }

  function attachWardenMesh(en) {
    if (!en.rig || !en.rig.group || en.wardenMesh) {
      if (en.wardenMesh) en.wardenMesh.visible = true;
      return;
    }
    try {
      var geo = new T.IcosahedronGeometry(1.35, 1);
      var mat = new T.MeshBasicMaterial({ color: 0x58d6ff, transparent: true, opacity: 0.16, wireframe: true, depthWrite: false });
      var mesh = new T.Mesh(geo, mat);
      mesh.position.set(0, 0.35, 0);
      mesh.visible = true;
      en.rig.group.add(mesh);
      en.wardenMesh = mesh;
    } catch (err) { soft("warden-mesh", err); }
  }

  function nearestWarden(e) {
    var list = G.enemies.list || [];
    var best = null, bd = 12;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w === e || !alive(w) || w.variant !== "warden" || !w.sx2 || !w.sx2.shieldUp) continue;
      var d = distXZ(e.pos, w.pos);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  /* --------------------------------------------------------------- post update */
  function post(en, dt) {
    var v = en.variant, sx = en.sx2;
    if (!sx || sx.dead) return;
    sx.t += dt;
    var p = G.player;
    if (v === "scout") {
      if (!p || p.alive === false) return;
      var desired = scoutDesired(en, p);
      flyTo(en, desired, 11, dt);
      en.passive = true;
      en.atk = "idle";
      en.cool = 999;
      sx.markT -= dt;
      if (sx.markT <= 0) {
        sx.markT = 0.8;
        var eye = p.eye || p.pos;
        var from = en.sensor || en.pos;
        if (distXZ(en.pos, p.pos) < 38 && G.physics.lineOfSight(from, eye)) {
          state.stats.scoutMarks++;
          try { G.events.emit("sx:scout-mark", { pos: p.pos.clone(), enemy: en }); } catch (err) { soft("emit-scout-mark", err); }
          try { G.enemies.debug.ctx.rally(en.pos, 26, p.pos, en); } catch (err) { soft("scout-rally", err); }
        }
      }
      if (en.lens && en.lens.color) {
        var pulse = 0.7 + 0.3 * Math.sin(sx.t * 6);
        en.lens.color.setRGB(1.4 * pulse, 5.4 * pulse, 7.6 * pulse);
      }
    } else if (v === "warden") {
      var ally = wardenAlly(en);
      var target = ally ? new T.Vector3(ally.pos.x - 2.5, ally.pos.y + 4.2, ally.pos.z + 2.5) : new T.Vector3(en.home.x, en.home.y + 4, en.home.z);
      flyTo(en, target, 5, dt);
      en.passive = true;
      en.atk = "idle";
      en.cool = 999;
      if (sx.shieldUp) {
        sx.shieldT -= dt;
        if (sx.shieldT <= 0) {
          sx.shieldT = 0.5;
          state.stats.wardenTicks++;
          try { G.events.emit("sx:warden-shield", { enemy: en, shield: en.wardenShield, max: en.wardenMaxShield, targets: wardenTargets(en) }); } catch (err) { soft("emit-shield-tick", err); }
        }
      } else {
        sx.shieldCd -= dt;
        if (sx.shieldCd <= 0) {
          en.wardenShield = en.wardenMaxShield;
          sx.shieldUp = true;
          if (en.wardenMesh) en.wardenMesh.visible = true;
        }
      }
      if (en.wardenMesh) {
        en.wardenMesh.visible = !!sx.shieldUp;
        en.wardenMesh.rotation.y += dt * 0.8;
        en.wardenMesh.rotation.x += dt * 0.35;
      }
      if (en.lens && en.lens.color) {
        var q = 0.65 + 0.35 * Math.sin(sx.t * 3);
        en.lens.color.setRGB(1.2 * q, 4.6 * q, 3.4 * q);
      }
    } else if (v === "siege") {
      state.stats.siegeTicks = (state.stats.siegeTicks || 0) + 1;
      // 保持 14–34m 曲射距离：太近后退，太远靠 think/cover 推进
      if (p && p.alive !== false) {
        var d = distXZ(en.pos, p.pos);
        if (d < 12 && en.es !== "tele" && en.es !== "burst" && en.es !== "wind" && en.es !== "lunge") {
          var ax = en.pos.x - p.pos.x, az = en.pos.z - p.pos.z;
          var al = Math.hypot(ax, az) || 1;
          en.goal.set(en.pos.x + (ax / al) * 3, en.pos.y, en.pos.z + (az / al) * 3);
          en.hasGoal = true;
        }
        if (en.mode === "engage" || en.los) sx.seenT = 1.5; else sx.seenT = Math.max(0, sx.seenT - dt);
        state.stats.siegeSeen = (state.stats.siegeSeen || 0) + (sx.seenT > 0 ? 1 : 0);
        state.stats.siegeRange = (state.stats.siegeRange || 0) + (d > 9 && d < 40 ? 1 : 0);
        // V37：删除 post 里的手动 spawnShell。引擎 burstCount=2 会发 2 次
        // enemy:fire，由 onFire 各产 1 发曲射弹 —— 一次齐射恰好 2 发。
      }
    } else if (v === "emp") {
      if (!p || p.alive === false) return;
      var de = distXZ(en.pos, p.pos);
      sx.empCool = Math.max(0, sx.empCool - dt);
      if (sx.empCharge < 0 && de < 3.3 && sx.empCool <= 0) {
        sx.empCharge = 0.75;
        try { G.events.emit("enemy:telegraph", { enemy: en, type: "emp", time: 0.75, pos: en.pos }); } catch (err) { soft("emit-emp-telegraph", err); }
      }
      if (sx.empCharge >= 0) {
        sx.empCharge -= dt;
        if (de > 4.2) {
          sx.empCharge = -1;
          sx.empCool = 2;
        } else if (sx.empCharge <= 0) {
          sx.empCharge = -1;
          empBurst(en);
          return;
        }
      }
      if (en.lens && en.lens.color) {
        var g2 = 0.7 + 0.3 * Math.sin(sx.t * 9);
        en.lens.color.setRGB(3.2 * g2, 1.8 * g2, 8.2 * g2);
      }
    }
  }

  function scoutDesired(en, p) {
    // 环绕玩家 9–13m，高度 +4.5，避免撞墙时贴地
    var ang = en.sx2.t * 0.9 + (en.phase || 0);
    var r = 10 + Math.sin(en.sx2.t * 0.35 + (en.phase || 0)) * 2.5;
    return new T.Vector3(p.pos.x + Math.cos(ang) * r, p.pos.y + 4.4, p.pos.z + Math.sin(ang) * r);
  }

  function wardenAlly(en) {
    var list = G.enemies.list || [];
    var best = null, bd = 22;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e === en || !alive(e) || e.variant === "scout") continue;
      var d = distXZ(en.pos, e.pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function wardenTargets(en) {
    var list = G.enemies.list || [], out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e === en || !alive(e)) continue;
      if (distXZ(en.pos, e.pos) < 12) out.push(e.id);
    }
    return out;
  }

  function flyTo(en, target, speed, dt) {
    var dx = target.x - en.pos.x, dy = target.y - en.pos.y, dz = target.z - en.pos.z;
    var len = Math.hypot(dx, dy, dz);
    if (len < 0.25) return;
    var step = Math.min(len, speed * dt);
    var dir = new T.Vector3(dx / len, dy / len, dz / len);
    var allowed = step;
    try {
      var hit = G.physics.raycast(en.pos, dir, step + 0.5);
      if (hit) allowed = Math.max(0, Math.min(step, hit.dist - 0.4));
    } catch (err) { soft("raycast", err); }
    en.pos.addScaledVector(dir, allowed);
    en.yaw = Math.atan2(dir.x, dir.z);
    if (en.rig && en.rig.group) en.rig.group.rotation.set(en.pitch || 0, en.yaw, en.roll || 0);
    if (en.vel) en.vel.set(dir.x * speed * 0.6, dir.y * speed * 0.4, dir.z * speed * 0.6);
    if (en.sensor) en.sensor.set(en.pos.x, en.pos.y - 0.2, en.pos.z);
  }

  /* --------------------------------------------------------------- 攻城蛛 / 电磁犬 */
  function onFire(ev) {
    var en = ev && ev.enemy;
    if (!en || !en.alive || !en.variant) return;
    if (en.variant === "siege") spawnShell(en, ev);
    else if (en.variant === "emp") empShot(en, ev);
  }

  function spawnShell(en, ev) {
    var p = G.player;
    if (!p || p.alive === false) return;
    var flight = 1.15;
    var target = new T.Vector3(
      p.pos.x + (p.vel ? p.vel.x : 0) * flight * 0.45,
      p.pos.y,
      p.pos.z + (p.vel ? p.vel.z : 0) * flight * 0.45
    );
    target.y = G.physics.groundHeight(target.x, target.z, target.y + 2);
    var shell = {
      t: 0, flight: flight, target: target, radius: 4.2, damage: 55,
      from: en, mesh: null
    };
    try {
      var geo = new T.RingGeometry(0.3, 4.2, 28);
      var mat = new T.MeshBasicMaterial({ color: 0xff5a40, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false });
      var mesh = new T.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(target.x, target.y + 0.06, target.z);
      G.scene.add(mesh);
      shell.mesh = mesh;
    } catch (err) { soft("shell-mesh", err); }
    state.shells.push(shell);
    state.stats.shells++;
    try { G.events.emit("sx:siege-warn", { pos: target.clone(), radius: 4.2, time: flight, enemy: en }); } catch (err) { soft("emit-siege-warn", err); }
  }

  function clearShells() {
    for (var i = 0; i < state.shells.length; i++) {
      var s = state.shells[i];
      if (!s || !s.mesh) continue;
      try {
        if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
        if (s.mesh.geometry && s.mesh.geometry.dispose) s.mesh.geometry.dispose();
        if (s.mesh.material && s.mesh.material.dispose) s.mesh.material.dispose();
      } catch (e) { soft("clear-shells", e); }
    }
    state.shells.length = 0;
  }

  function updateShells(dt) {
    for (var i = state.shells.length - 1; i >= 0; i--) {
      var s = state.shells[i];
      s.t += dt;
      if (s.mesh) {
        var k = clampx(s.t / s.flight, 0, 1);
        s.mesh.scale.setScalar(0.35 + k * 0.65);
        s.mesh.material.opacity = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(s.t * 18));
      }
      if (s.t < s.flight) continue;
      state.shells.splice(i, 1);
      impact(s);
    }
  }

  function impact(s) {
    var p = G.player;
    try { if (s.mesh) { G.scene.remove(s.mesh); s.mesh.geometry.dispose && s.mesh.geometry.dispose(); s.mesh.material.dispose && s.mesh.material.dispose(); } } catch (err) { soft("shell-remove", err); }
    try { if (G.fx && G.fx.explosion) G.fx.explosion(s.target, 1.1); } catch (err) { soft("fx-impact", err); }
    if (!p || p.alive === false) return;
    var d = Math.hypot(p.pos.x - s.target.x, p.pos.z - s.target.z);
    if (d < s.radius) {
      var dmg = s.damage * (1 - d / s.radius);
      // 曲射溅射：不要求视线（专打掩体后目标）
      try { p.damage(dmg, s.target); } catch (err) { soft("player-damage", err); }
      try { if (p.addShake) p.addShake(0.4); } catch (err) { soft("player-shake", err); }
    }
  }

  function empShot(en, ev) {
    var p = G.player;
    if (!p || p.alive === false) return;
    var eye = p.eye || new T.Vector3(p.pos.x, p.pos.y + 1.5, p.pos.z);
    var muzzle = en.muzzle || en.headPos || en.pos;
    if (distXZ(en.pos, p.pos) > 55) return;
    try {
      if (!G.physics.lineOfSight(muzzle, eye)) return;
      p.damage(5, muzzle);
    } catch (err) { return; }
    state.stats.emp++;
    try { G.events.emit("sx:emp", { duration: 1.5, power: 0.7, enemy: en, pos: p.pos.clone() }); } catch (err) { soft("emit-emp", err); }
  }

  function empBurst(en) {
    var p = G.player;
    if (!p || p.alive === false) return;
    var d = distXZ(en.pos, p.pos);
    if (d < 4.6) {
      // 不致命：最多打到 20HP，剩余伤害被 EMP 吸收
      var lethal = Math.max(0, p.health - 20);
      var dmg = Math.min(14, lethal);
      if (dmg > 0) { try { p.damage(dmg, en.pos); } catch (err) { soft("burst-damage", err); } }
      try { if (p.addShake) p.addShake(0.65); } catch (err) { soft("burst-shake", err); }
    }
    state.stats.empBursts++;
    try { G.events.emit("sx:emp", { duration: 2.6, power: 1, enemy: en, burst: true, pos: en.pos.clone() }); } catch (err) { soft("emit-emp-burst", err); }
    try { if (G.fx && G.fx.explosion) G.fx.explosion(en.pos, 1.25); } catch (err) { soft("burst-fx", err); }
    try { if (G.fx && G.fx.sparks) G.fx.sparks(en.pos, new T.Vector3(0, 1, 0), 18); } catch (err) { soft("burst-sparks", err); }
    if (en.sx2) en.sx2.dead = true;
    try { G.enemies.debug.ctx.retire(en); } catch (err) { soft("emp-retire", err); }
  }

  /* --------------------------------------------------------------- tick */
  function tick(dt) {
    if (!(dt > 0)) return;
    if (dt > 0.05) dt = 0.05;
    updateShells(dt);
    state.auraT -= dt;
    if (state.auraT <= 0) { state.auraT = 0.2; applyAura(); }
  }

  function applyAura() {
    var list = G.enemies.list || [];
    for (var i = 0; i < list.length; i++) if (list[i]) list[i].__sxShieldMul = 1;
    for (var w = 0; w < list.length; w++) {
      var wd = list[w];
      if (!alive(wd) || wd.variant !== "warden" || !wd.sx2 || !wd.sx2.shieldUp) continue;
      for (var k = 0; k < list.length; k++) {
        var e = list[k];
        if (!e || e === wd || !alive(e)) continue;
        if (distXZ(e.pos, wd.pos) <= 12) e.__sxShieldMul = 0.65;
      }
    }
  }

  function expose() {
    window.__SX_ENEMIES2 = {
      defs: DEFS,
      variants: function () { return JSON.parse(JSON.stringify(state.variants)); },
      stats: function () { return JSON.parse(JSON.stringify(state.stats)); },
      replace: function () { return JSON.parse(JSON.stringify(state.replace)); },
      state: function () {
        return {
          ok: true, spawned: state.stats.spawns, variants: state.variants,
          shells: state.shells.length, stats: state.stats, auraT: state.auraT,
          replace: JSON.parse(JSON.stringify(state.replace)),
          shielded: (G.enemies.list || []).filter(function (e) { return e && e.__sxShieldMul && e.__sxShieldMul < 1; }).map(function (e) { return e.id; }),
          err: state.err || null
        };
      },
      spawn: function (type, x, y, z, opts) {
        var v = new T.Vector3(x, y, z);
        return G.enemies.spawn(type, v, opts || {});
      }
    };
    window.__SX_E2 = window.__SX_ENEMIES2;
  }

  wait();
})();