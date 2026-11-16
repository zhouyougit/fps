/* =====================================================================
   SALTLINE · core_loop.js — V32 固定步主循环
   - 60Hz 固定步推进玩法（game/player/weapon/enemies），渲染帧率任意
   - 视角输入每个渲染帧立即生效（不等待固定步）
   - ?dt= 兼容旧测试：按 dt/STEP 步进；window.__SX_LOOP.step(n) 无头步进
   - 提供状态哈希，用于确定性回归
   ===================================================================== */
(function () {
  "use strict";
  var STEP = 1 / 60;
  var MAX_STEPS = 5;
  var G = null;
  var raf = 0;
  var acc = 0;
  var tick = 0;
  var last = 0;
  var booted = false;
  var frameCount = 0;
  var stepsThisFrame = 0;
  // ARCH-3：droppedMs/dropEvents 记录低帧率时被丢弃的模拟时间（<~12fps），
  // 以前是静默慢动作，没有计数。
  var stats = {
    steps: 0, frames: 0, simMs: 0, maxSteps: 0, lastSteps: 0, alpha: 0, dt: 0,
    droppedMs: 0, dropEvents: 0, lastDropMs: 0, slowFrames: 0
  };
  var _look = { dx: 0, dy: 0 };

  function fail(e, where) {
    // ARCH-2：同一位置的持续错误只记一条诊断，避免每秒刷 60 次。
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") {
        window.SXErrors.soft("loop:" + where, e);
        return;
      }
    } catch (_) {}
    try {
      if (window.__errors) window.__errors.push("[loop:" + where + "] " + ((e && e.stack) || e));
    } catch (_) {}
    try { console.error("[loop] " + where, e); } catch (_) {}
  }

  function call(name, fn, arg) {
    var m = G && G[name];
    if (m && typeof m[fn] === "function") {
      try { return m[fn](arg); } catch (e) { fail(e, name + "." + fn); }
    }
    return undefined;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function applyLook(look) {
    var P = G.player;
    if (!look || (!look.dx && !look.dy)) return;
    if (!P || !P.enabled || !P.alive) return;
    if (G.game.state !== "playing") return;
    var scale = typeof P.lookScale === "number" ? P.lookScale : 1;
    P.yaw -= look.dx * scale;
    P.pitch = clamp(P.pitch - look.dy * scale, -1.5, 1.5);
  }

  function applyLookToCamera(look) {
    if (!look || (!look.dx && !look.dy)) return;
    var P = G.player;
    if (!P || !P.enabled || !P.alive || G.game.state !== "playing") return;
    var scale = typeof P.lookScale === "number" ? P.lookScale : 1;
    var cam = G.camera;
    cam.rotation.order = "YXZ";
    cam.rotation.y -= look.dx * scale;
    cam.rotation.x = clamp(cam.rotation.x - look.dy * scale, -1.55, 1.55);
  }

  function isSimState() {
    var s = G.game.state;
    return s === "playing" || s === "intro";
  }

  function fixedStep(noInput) {
    var t0 = performance.now();
    tick++;
    G.time.dt = STEP;
    G.time.t += STEP;
    G.time.frame++;
    var d = false;
    try {
      // 状态机（死亡/结算/暂停的界面计时）必须也推进，否则死亡页/结算页永远不出现
      d = G.game.update(STEP) !== false && (G.game.state === "playing" || G.game.state === "intro");
    } catch (e) { fail(e, "game.update"); }
    if (d) {
      call("player", "update", STEP);
      call("weapon", "update", STEP);
      call("enemies", "update", STEP);
    }
    stats.steps++;
    stats.simMs += performance.now() - t0;
    try {
      if (window.SXErrors && SXErrors.recordCommand) {
        var inp = G.input || {}, mv = inp.move || {}, btns = 0;
        if (inp.fire) btns |= 1;
        if (inp.ads) btns |= 2;
        if (inp.sprint) btns |= 8;
        if (inp.crouch) btns |= 16;
        SXErrors.recordCommand({
          tick: tick, mx: mv.x || 0, my: mv.y || 0,
          yaw: G.player ? G.player.yaw : 0, pitch: G.player ? G.player.pitch : 0,
          buttons: btns
        }, tick);
      }
    } catch (_) {}
  }

  function presentation(dt) {
    try { G.time.real = performance.now() / 1000; } catch (_) {}
    call("fx", "update", dt);
    call("ground", "update", dt);
    call("level", "update", dt);
    call("backdrop", "update", dt);
    call("mats", "update", dt);
    call("audio", "update", dt);
    call("hud", "update", dt);
    // 表现层系统：每个渲染帧都跑（alpha 有效），不能塞进固定步
    try { if (window.SX_SYSTEMS) window.SX_SYSTEMS.update(dt, stats.alpha); } catch (_) {}
    try { if (window.SX_UICLOCK) window.SX_UICLOCK.tick(); } catch (_) {}
    // 枪身湿度（与原主循环一致）
    try {
      var level = G.level;
      if (G.weapon && G.weapon.setWetness && level && level.interiorBoxes && level.interiorBoxes[0] && !G._wet) G._wet = 1;
      if (G._wet != null && G.weapon && G.weapon.setWetness && level && level.interiorBoxes && level.interiorBoxes[0]) {
        var v = level.interiorBoxes[0], g = G.camera.position;
        var inside = g.x > v.min.x && g.x < v.max.x && g.z > v.min.z && g.z < v.max.z && g.y < v.max.y;
        G._wet += ((inside ? 0.3 : 1) - G._wet) * Math.min(1, dt * (inside ? 0.25 : 0.6));
        G.weapon.setWetness(G._wet);
      }
    } catch (e) { fail(e, "wetness"); }
  }

  function applyShotCam() {
    var p = G._shotCam;
    if (!p) return;
    G.camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    G.camera.lookAt(p.look[0], p.look[1], p.look[2]);
  }

  function frame(now) {
    if (!G) return;
    raf = requestAnimationFrame(frame);
    var realDt = Math.min(Math.max(0, (now - last) / 1000), 0.25);
    last = now;
    if (realDt > 1 / 12) stats.slowFrames++;
    var dtParam = G.params && G.params.dt != null && G.params.dt !== "" ? +G.params.dt : null;
    if (!(dtParam > 0)) dtParam = null;
    var dt = dtParam != null ? dtParam : realDt;
    stats.dt = dt;
    stats.frames++;
    frameCount++;

    call("input", "update", realDt);

    // 视角：本渲染帧的鼠标增量立即作用到 yaw/pitch，固定步内不再重复应用
    var look = _look;
    look.dx = 0; look.dy = 0;
    try {
      look.dx = G.input.look.dx || 0;
      look.dy = G.input.look.dy || 0;
      G.input.look.dx = 0;
      G.input.look.dy = 0;
    } catch (_) {}
    applyLook(look);

    var n = 0;
    acc += dt;
    var cap = dtParam != null ? Math.max(1, Math.min(15, Math.round(dtParam / STEP))) : MAX_STEPS;
    var guard = 0;
    while (acc >= STEP - 1e-9 && n < cap && guard++ < 64) {
      fixedStep(n > 0);
      acc -= STEP;
      n++;
      if (n === 1) {
        try { G.input.endFrame(); } catch (_) {}
      }
    }
    if (n >= cap && acc > STEP) {
      // 追帧上限用完仍有剩余时间：丢弃并记账（cap=5 时相当于低于 12fps）。
      var dropped = acc;
      acc = 0;
      stats.droppedMs += dropped * 1000;
      stats.dropEvents++;
      stats.lastDropMs = dropped * 1000;
    }
    if (n === 0) applyLookToCamera(look);
    stepsThisFrame = n;
    stats.lastSteps = n;
    if (n > stats.maxSteps) stats.maxSteps = n;
    stats.alpha = acc / STEP;

    presentation(dt);
    applyShotCam();

    try { G.render.frame(dt); } catch (e) { fail(e, "render.frame"); }

    if (n === 0) {
      // 未执行固定步：保留按键边沿到下一帧，只清理视角增量
      try { G.input.look.dx = 0; G.input.look.dy = 0; } catch (_) {}
    }
    window.__frames++;
    if (window.__frames === 2) window.__ready = true;
  }

  function stepN(count) {
    if (!G) return false;
    var n = Math.max(1, Math.min(200000, count | 0));
    for (var i = 0; i < n; i++) {
      // 无头步进封闭模拟输入：避免浏览器当前按住的键污染回放
      try {
        // 只清理视角增量与“刚按下”边沿；模拟轴/按住状态保留，供测试显式驱动
        if (G.input) G.input.endFrame();
      } catch (_) {}
      fixedStep(true);
    }
    try { G.input.endFrame(); } catch (_) {}
    return true;
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  /* --- ARCH-3：额外哈希片段。全部来自可复现的固定步状态，且逐项 try/catch，
     任一来源缺失/抛错都不会让 hash() 失败（同状态仍然可复现）。 --- */
  function hashBoss(parts, q) {
    try {
      var B = window.__SX_BOSS;
      if (!B || typeof B.logicState !== "function") return;
      var b = B.logicState();
      if (!b) return;
      parts.push("b", b.active ? 1 : 0, b.phase | 0, b.final ? 1 : 0,
        b.hp | 0, b.maxHp | 0, b.move || "-", b.stage || "-",
        q(b.clock || 0), q(b.globalCd || 0), b.queue || "-",
        b.timers | 0, b.summons | 0, b.echoes | 0);
      var cds = b.cooldowns || {};
      var keys = Object.keys(cds).sort();
      for (var i = 0; i < keys.length; i++) {
        parts.push("bc", keys[i], q(cds[keys[i]] || 0));
      }
    } catch (e) { fail(e, "hash.boss"); }
  }

  function hashMove(parts, q) {
    try {
      var M = window.__SX_MOVE;
      if (!M || typeof M.state !== "function") return;
      var m = M.state() || {};
      parts.push("mv", m.sliding ? 1 : 0, m.vaulting ? 1 : 0, q(m.lean || 0),
        q(m.cooldown || 0), q(m.slideT || 0), q(m.vaultT || 0));
    } catch (e) { fail(e, "hash.move"); }
  }

  function hashClock(parts, q) {
    try {
      var C = window.SX_CLOCK;
      if (C && typeof C.now === "number" && isFinite(C.now)) parts.push("ck", q(C.now));
    } catch (e) { fail(e, "hash.clock"); }
  }

  function hashItems(parts) {
    try {
      var sx = window.__SX;
      if (!sx || typeof sx.state !== "function") return;
      var st = sx.state();
      if (!st) return;
      parts.push("it", st.grenades | 0, st.pickups | 0);
    } catch (e) { fail(e, "hash.items"); }
  }

  // RNG 状态：packages/sim 的流当前没有挂到 window；一旦有模块发布
  // __SX_RNG/SX_RNG（或 __MP.rng）就自动并入哈希。
  function hashRng(parts) {
    try {
      var r = window.__SX_RNG || window.SX_RNG || null;
      if (!r) {
        var mp = window.__MP;
        r = mp && mp.rng ? mp.rng : null;
      }
      if (!r) return;
      var seed = typeof r.seed === "number" ? r.seed
        : (typeof r.state === "number" ? r.state : null);
      if (seed == null || !isFinite(seed)) return;
      parts.push("rng", seed >>> 0);
    } catch (e) { fail(e, "hash.rng"); }
  }

  function stateHash() {
    var parts = [];
    var q = function (v) { return Math.round(v * 1000) / 1000; };
    try {
      var P = G.player;
      parts.push("p", q(P.pos.x), q(P.pos.y), q(P.pos.z), q(P.vel.x), q(P.vel.y), q(P.vel.z), q(P.yaw), q(P.pitch), q(P.health), q(P.armor), P.alive ? 1 : 0, P.crouching ? 1 : 0, P.onGround ? 1 : 0);
    } catch (_) {}
    try {
      var list = G.enemies.list;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e.active) continue;
        parts.push("e", e.id, e.type, q(e.pos.x), q(e.pos.y), q(e.pos.z), q(e.hp), e.alive ? 1 : 0, e.mode);
      }
    } catch (_) {}
    try {
      var w = G.weapon;
      parts.push("w", w.activeIndex, w.ammo, w.reserve, q(w.spread), q(w.ads), w.state);
      if (w.list) for (var wi = 0; wi < w.list.length; wi++) {
        var ww = w.list[wi];
        parts.push("ws", wi, ww.ammo | 0, ww.reserve | 0, ww.state || "");
      }
    } catch (_) {}
    try {
      var r = G.game.run || {};
      parts.push("r", r.cut, r.allCut ? 1 : 0, q(r.evacT), r.bossAlive ? 1 : 0, G.game.state, q(r.time || 0));
      if (r.relays) for (var ri = 0; ri < r.relays.length; ri++) {
        var rl = r.relays[ri];
        parts.push("rl", ri, rl.cut ? 1 : 0, q(rl.t || 0));
      }
    } catch (_) {}
    hashBoss(parts, q);
    hashMove(parts, q);
    hashClock(parts, q);
    hashItems(parts);
    hashRng(parts);
    return hashStr(parts.join(","));
  }

  function boot() {
    if (booted) return;
    G = window.__G;
    if (!G || !G.game || !G.renderer || !G.player || !G.weapon || !G.enemies) return;
    booted = true;
    // 引擎在 QC 末尾才启动自己的循环；我们可能恰好抢在它之前接管，
    // 因此在这之后的一小段时间里反复确认接管（只会调用一次 null，无副作用）。
    var origSetLoop = null;
    try { origSetLoop = G.renderer.setAnimationLoop.bind(G.renderer); } catch (_) {}
    if (origSetLoop) {
      // 吸附后续所有非 null 回调：引擎可能在 QC 末尾才启动自己的循环，
      // 这里把那次启动吞掉，保证只有一个主循环在跑。
      G.renderer.setAnimationLoop = function (cb) {
        if (cb === null) { try { origSetLoop(null); } catch (e) { fail(e, "stop-engine-loop"); } }
      };
    }
    function stopEngine() {
      try { G.renderer.setAnimationLoop(null); } catch (e) { fail(e, "stop-engine-loop"); }
    }
    stopEngine();
    [80, 240, 600, 1400].forEach(function (ms) { setTimeout(stopEngine, ms); });
    // ?cam 兼容（截图/基准）
    try {
      if (G.params && G.params.cam) {
        var f = String(G.params.cam).split(",").map(Number);
        if (f.length >= 3) G._shotCam = { pos: [f[0], f[1], f[2]], look: [f[3] || 0, f[4] || 1, f[5] || 0] };
      }
    } catch (_) {}
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
    window.__SX_LOOP = {
      step: stepN,
      tick: function () { return tick; },
      hash: stateHash,
      stats: function () {
        return {
          tick: tick, steps: stats.steps, frames: stats.frames,
          simMs: +stats.simMs.toFixed(1), maxSteps: stats.maxSteps,
          alpha: +stats.alpha.toFixed(3), dt: stats.dt,
          droppedMs: +stats.droppedMs.toFixed(1),
          dropEvents: stats.dropEvents,
          lastDropMs: +stats.lastDropMs.toFixed(1),
          slowFrames: stats.slowFrames
        };
      },
      resetAcc: function () { acc = 0; },
      get stepSize() { return STEP; }
    };
    window.__SX_STEP = function (n) { return stepN(n); };
    try {
      G.events.emit("loop:ready", { step: STEP });
    } catch (_) {}
    console.log("[loop] fixed-step 60Hz started");
  }

  var tries = 0;
  var iv = setInterval(function () {
    boot();
    if (booted || ++tries > 1200) clearInterval(iv);
  }, 50);
})();
