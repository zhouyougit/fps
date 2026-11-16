/* =====================================================================
   SALTLINE · ext_movement.js — V33 移动 2.0（WP33-1）
   滑铲 / 翻越（mantle·vault）/ 探身（lean），独立 IIFE，构建时自动
   排在 ext.js 之后。不改引擎闭包，不覆盖 G.player.update：

   - 通过 window.SX_SYSTEMS.register({ id:'movement2', fixedUpdate, update })
     注册；SX_SYSTEMS 未就绪时用 setInterval 兜底。
   - fixedUpdate 在玩家 update 之前整备意图（蹲/冲刺/跳跃边沿）；
   - 真正“玩家 update 之后”的位移修正挂在 G.physics.moveCapsule 上：
     仅当 pos === G.player.pos 时追加一次 moveCapsule（防穿墙），
     对其它实体完全透传；
   - 相机横移/滚转/滑铲压低挂在 G.hud.update（每帧、渲染之前）上，
     只做加性偏移，不动机瞄/后坐/晃动。

   参数集中在 C 常量，便于调参。
   ===================================================================== */
(function () {
  "use strict";

  var G = null;
  var booted = false;
  var registered = false;
  var fallbackTimer = 0;
  var baseMoveCapsule = null;
  var cameraHook = "";
  var reportCount = 0;

  /* ------------------------------------------------------------ 参数表 */
  // V42：滑铲/翻越/探身参数统一在 src/config/balance.js 的 movement 段
  var C = (window.SX_BALANCE && window.SX_BALANCE.movement) || {};
  C.step = 1 / 60;

  /* ------------------------------------------------------------ 状态 */
  var slide = { active: false, t: 0, cd: 0, vx: 0, vz: 0, speed: 0, dirX: 0, dirZ: -1 };
  var padLean = { L: false, R: false };
  var bindsSig = "";
  var vault = {
    active: false, t: 0, dur: C.vault.lowTime, rise: 0, fx: 0, fz: 1,
    fromX: 0, fromY: 0, fromZ: 0, toX: 0, toY: 0, toZ: 0
  };
  var lean = { cur: 0, prog: 0, keyL: false, keyR: false, bindL: "KeyZ", bindR: "KeyN" };
  var slideBlend = 0;
  var lastControlFrame = -1;
  var camApplied = { frame: -1, dx: 0, dy: 0, dz: 0, roll: 0 };
  var lastAppliedOffset = 0;   // 供测试读取（实际生效的横向偏移）
  var prevCrouchDown = false;
  var prevJumpDown = false;
  var bindHeld = Object.create(null);
  var keysInstalled = false;
  var navTick = 0;

  /* ------------------------------------------------------------ 工具 */
  function report(e, where) {
    try {
      if (window.SXErrors && window.SXErrors.report) {
        window.SXErrors.report(e, { system: "movement2", phase: where });
        return;
      }
    } catch (_) {}
    if (reportCount < 4) {
      reportCount++;
      try { console.warn("[movement2] " + where, (e && (e.stack || e)) || e); } catch (_) {}
    }
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrapPi(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
  }
  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }
  function finite(v) { return typeof v === "number" && isFinite(v); }
  function emit(name, data) {
    try { if (G && G.events && G.events.emit) G.events.emit(name, data); } catch (e) { report(e, "emit"); }
  }
  function P() { return G && G.player; }
  function playing() { return !!(G && G.game && G.game.state === "playing"); }

  /* ------------------------------------------------------------ 绑定 */
  function normBind(v, def) {
    if (v == null) return def;
    var s = String(v).trim();
    if (!s) return def;
    try {
      if (s.charAt(0) === "[") {
        var a = JSON.parse(s);
        if (a && a.length) s = String(a[0]);
      } else if (s.charAt(0) === "\"") {
        s = String(JSON.parse(s));
      }
    } catch (_) {}
    s = s.replace(/^"+|"+$/g, "").trim();
    return s || def;
  }

  function loadBinds() {
    var def = { leanL: "KeyZ", leanR: "KeyN" };
    var found = { leanL: null, leanR: null };
    try {
      var raw = localStorage.getItem("saltline.binds");
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === "object") {
          if (obj.leanL != null) found.leanL = obj.leanL;
          if (obj.leanR != null) found.leanR = obj.leanR;
        }
      }
    } catch (_) {}
    try { var l = localStorage.getItem("saltline.binds.leanL"); if (l != null) found.leanL = l; } catch (_) {}
    try { var r = localStorage.getItem("saltline.binds.leanR"); if (r != null) found.leanR = r; } catch (_) {}
    // V33 统一存档：settings.binds.leanL/R（存在则优先）
    try {
      if (window.SXSave && window.SXSave.get) {
        var st = window.SXSave.get("settings");
        if (st && st.binds) {
          if (st.binds.leanL != null) found.leanL = st.binds.leanL;
          if (st.binds.leanR != null) found.leanR = st.binds.leanR;
        }
      }
    } catch (_) {}
    lean.bindL = normBind(found.leanL, def.leanL);
    lean.bindR = normBind(found.leanR, def.leanR);
    try { bindsSig = (localStorage.getItem("saltline.binds") || "") + "|" + (localStorage.getItem("saltline.binds.leanL") || "") + "|" + (localStorage.getItem("saltline.binds.leanR") || ""); } catch (_) {}
  }

  // 玩家可在设置里重绑（ext_input 写 saltline.binds），定期同步一次
  function refreshBinds() {
    try {
      var sig = (localStorage.getItem("saltline.binds") || "") + "|" + (localStorage.getItem("saltline.binds.leanL") || "") + "|" + (localStorage.getItem("saltline.binds.leanR") || "");
      if (sig !== bindsSig) loadBinds();
    } catch (_) {}
  }

  function bindMatch(bind, e) {
    if (!bind || !e) return false;
    if (e.code && e.code === bind) return true;
    if (bind.length === 1 && e.key && e.key.toLowerCase() === bind.toLowerCase()) return true;
    if (e.key && bind.toLowerCase() === e.key.toLowerCase()) return true;
    return false;
  }

  function onKey(e) {
    try {
      var t = e && e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      var down = e.type === "keydown";
      if (e.code) {
        if (bindMatch(lean.bindL, e)) {
          lean.keyL = down;
          if (down && e.stopPropagation) e.stopPropagation();
        } else if (bindMatch(lean.bindR, e)) {
          lean.keyR = down;
          if (down && e.stopPropagation) e.stopPropagation();
        }
      }
      if (e.code) bindHeld[e.code] = down;
      // 失焦/ESC 收紧
      if (e.code === "Escape") { lean.keyL = false; lean.keyR = false; }
    } catch (err) { report(err, "key"); }
  }

  function installKeys() {
    if (keysInstalled) return;
    keysInstalled = true;
    try {
      addEventListener("keydown", onKey, true);
      addEventListener("keyup", onKey, true);
      addEventListener("blur", function () {
        lean.keyL = false; lean.keyR = false;
        bindHeld = Object.create(null);
      });
    } catch (e) { report(e, "installKeys"); }
  }

  /* ------------------------------------------------------------ 碰撞辅助 */
  function clearAt(x, y, z, r, height) {
    var ph = G && G.physics;
    var boxes = ph && ph.boxes;
    if (!boxes) return true;
    var y0 = y + 0.05;
    var y1 = y + height;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.bulletOnly) continue;
      if (b.max.y <= y0 || b.min.y >= y1) continue;
      var cx = Math.max(b.min.x, Math.min(b.max.x, x));
      var cz = Math.max(b.min.z, Math.min(b.max.z, z));
      var dx = x - cx;
      var dz = z - cz;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  }

  function boxTopAt(x, z, top) {
    var boxes = G && G.physics && G.physics.boxes;
    if (!boxes) return false;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.bulletOnly) continue;
      if (Math.abs(b.max.y - top) > 0.16) continue;
      if (x < b.min.x - 0.02 || x > b.max.x + 0.02) continue;
      if (z < b.min.z - 0.02 || z > b.max.z + 0.02) continue;
      return true;
    }
    return false;
  }

  function solidTop(x, z, top) {
    if (boxTopAt(x, z, top)) return true;
    var ph = G && G.physics;
    if (!ph || !ph.raycast) return false;
    var hit = ph.raycast({ x: x, y: top + 0.15, z: z }, { x: 0, y: -1, z: 0 }, 0.55);
    return !!(hit && hit.point && Math.abs(hit.point.y - top) < 0.2);
  }

  function isWalkable(x, z) {
    try {
      var nav = G && G.physics && G.physics.nav;
      return !!(nav && nav.isWalkable && nav.isWalkable(x, z));
    } catch (_) { return false; }
  }

  /* ------------------------------------------------------------ 滑铲 */
  function startSlide(force) {
    var p = P();
    if (!p || !p.alive || !p.enabled || vault.active) return false;
    if (!playing()) return false;
    if (slide.cd > 0) return false;
    var sp = Math.hypot(p.vel.x, p.vel.z);
    if (!force && (!p.onGround || sp < C.slide.minSpeed)) return false;
    var dx, dz;
    if (sp > 0.25) { dx = p.vel.x / sp; dz = p.vel.z / sp; }
    else { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); }
    slide.active = true;
    slide.t = 0;
    slide.dirX = dx;
    slide.dirZ = dz;
    slide.speed = C.slide.startSpeed;
    slide.vx = dx * C.slide.startSpeed;
    slide.vz = dz * C.slide.startSpeed;
    p.vel.x = slide.vx;
    p.vel.z = slide.vz;
    p.crouching = true;
    if (G.input) G.input.crouch = true;
    slideBlend = Math.max(slideBlend, 0.3);
    emit("sx:slide", {
      pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
      speed: slide.speed,
      dir: { x: dx, z: dz }
    });
    return true;
  }

  function endSlide() {
    if (!slide.active) return;
    slide.active = false;
    slide.cd = C.slide.cooldown;
    slide.vx = 0;
    slide.vz = 0;
    slide.speed = 0;
  }

  function slideStep(h) {
    var p = P();
    var inp = G.input || {};
    slide.t += h;
    var speed = C.slide.startSpeed - C.slide.friction * slide.t;
    // 有限转向：把速度方向朝视角前向旋转，至多 steer*h
    var cur = Math.atan2(slide.dirX, slide.dirZ);
    var want = p.yaw + Math.PI;
    var diff = wrapPi(want - cur);
    var maxTurn = C.slide.steer * h;
    diff = clamp(diff, -maxTurn, maxTurn);
    var a = cur + diff;
    slide.dirX = Math.sin(a);
    slide.dirZ = Math.cos(a);
    slide.speed = speed;
    slide.vx = slide.dirX * speed;
    slide.vz = slide.dirZ * speed;
    p.vel.x = slide.vx;
    p.vel.z = slide.vz;
    p.crouching = true;
    inp.crouch = true;   // 滑铲期间保持蹲碰撞高度
    if (!p.onGround || slide.t >= C.slide.maxTime || speed <= C.slide.exitSpeed + 1e-4) endSlide();
  }

  /* ------------------------------------------------------------ 翻越 */
  function findVault() {
    var p = P();
    var ph = G && G.physics;
    if (!p || !ph || !ph.raycast || !ph.groundHeight) return null;
    var fx = -Math.sin(p.yaw);
    var fz = -Math.cos(p.yaw);
    var ox = p.pos.x + fx * 0.06;
    var oz = p.pos.z + fz * 0.06;
    var oy = p.pos.y + 1.05;
    var hit = ph.raycast({ x: ox, y: oy, z: oz }, { x: fx, y: 0, z: fz }, C.vault.reach);
    if (!hit || !hit.point || !hit.normal) return null;
    if (hit.normal.y > 0.5) return null;                       // 打到地面/顶面
    if (hit.normal.x * fx + hit.normal.z * fz > -0.55) return null; // 斜蹭墙不触发
    var wallD = num(hit.dist, 0);
    if (wallD < 0.02) return null;
    var fromY = p.pos.y;
    var maxTop = fromY + C.vault.maxRise + 0.02;
    for (var d = wallD + 0.24; d <= wallD + 1.15; d += 0.07) {
      var x = ox + fx * d;
      var z = oz + fz * d;
      var gy = ph.groundHeight(x, z, maxTop + 0.1);
      if (!finite(gy)) continue;
      var rise = gy - fromY;
      if (rise < C.vault.minRise || rise > C.vault.maxRise) continue;
      if (!solidTop(x, z, gy)) continue;
      if (!clearAt(x, gy + 0.02, z, 0.32 * 0.95, 1.7)) continue;
      // 沿顶还要有支撑，避免翻到薄边 / 空中
      var nx = x + fx * 0.32;
      var nz = z + fz * 0.32;
      var gy2 = ph.groundHeight(nx, nz, gy + 0.12);
      if (!(gy2 >= gy - 0.12) && !isWalkable(x, z)) continue;
      return { x: x, y: gy, z: z, rise: rise, fx: fx, fz: fz, wallD: wallD };
    }
    return null;
  }

  function startVault(target) {
    var p = P();
    if (!p || !p.alive || !p.enabled || !playing() || vault.active) return false;
    var to = null;
    if (target && finite(target.x) && finite(target.y) && finite(target.z)) {
      to = { x: target.x, y: target.y, z: target.z, fx: -Math.sin(p.yaw), fz: -Math.cos(p.yaw) };
      to.rise = to.y - p.pos.y;
      if (to.rise < -0.2 || to.rise > C.vault.maxRise + 0.05) return false;
      if (!clearAt(to.x, to.y + 0.02, to.z, 0.32 * 0.95, 1.7)) return false;
    } else {
      var found = findVault();
      if (!found) return false;
      to = { x: found.x, y: found.y, z: found.z, fx: found.fx, fz: found.fz, rise: found.rise };
    }
    if (slide.active) endSlide();
    vault.active = true;
    vault.t = 0;
    vault.rise = to.rise;
    vault.fx = to.fx;
    vault.fz = to.fz;
    vault.dur = to.rise <= C.vault.lowRise ? C.vault.lowTime : C.vault.highTime;
    vault.fromX = p.pos.x;
    vault.fromY = p.pos.y;
    vault.fromZ = p.pos.z;
    vault.toX = to.x;
    vault.toY = to.y;
    vault.toZ = to.z;
    p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
    p.crouching = false;
    p.onGround = false;
    if (G.input) { G.input.move.x = 0; G.input.move.y = 0; }
    emit("sx:vault:start", { rise: vault.rise, dur: vault.dur });
    return true;
  }

  function applyVaultPose(pos) {
    var k = vault.dur > 1e-6 ? Math.min(1, vault.t / vault.dur) : 1;
    var ky = 1 - (1 - k) * (1 - k);   // 先升
    var kxz = k * k;                  // 后进
    pos.x = vault.fromX + (vault.toX - vault.fromX) * kxz;
    pos.z = vault.fromZ + (vault.toZ - vault.fromZ) * kxz;
    pos.y = vault.fromY + (vault.toY - vault.fromY) * ky;
  }

  function finishVault() {
    var p = P();
    vault.active = false;
    if (!p || p.alive === false) return;
    p.pos.x = vault.toX;
    p.pos.y = vault.toY;
    p.pos.z = vault.toZ;
    p.vel.x = vault.fx * C.vault.fwdSpeed;
    p.vel.z = vault.fz * C.vault.fwdSpeed;
    p.vel.y = 0;
    p.onGround = true;
    p.crouching = !clearAt(p.pos.x, p.pos.y + 0.02, p.pos.z, 0.32, 1.8);
    emit("sx:vault", {
      pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
      rise: vault.rise,
      dur: vault.dur
    });
  }

  function vaultStep(h) {
    var p = P();
    vault.t += h;
    if (vault.t >= vault.dur) { finishVault(); return; }
    applyVaultPose(p.pos);
    p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
    p.onGround = false;
    p.crouching = false;
    if (G.input) { G.input.move.x = 0; G.input.move.y = 0; }   // 动画期间禁用输入移动
  }

  /* ------------------------------------------------------------ 探身 */
  function leanStep(h) {
    var p = P();
    if (!p) return;
    var target = lean.prog;
    if (!target) target = ((lean.keyR || padLean.R) ? 1 : 0) + ((lean.keyL || padLean.L) ? -1 : 0);
    if (!playing() || !p.alive || !p.enabled || vault.active || slide.active) target = 0;
    else if (p.sprinting) target *= 0.45;      // 冲刺中限制探身
    if (!p.onGround) target *= 0.5;
    var k = 1 - Math.exp(-h / C.lean.time);
    lean.cur += (target - lean.cur) * k;
    if (Math.abs(lean.cur) < 1e-4) lean.cur = 0;
  }

  /* ------------------------------------------------------------ 主状态机 */
  function stepControl(h) {
    if (!G || !booted) return;
    var frame = (G.time && typeof G.time.frame === "number") ? G.time.frame : -1;
    if (frame === lastControlFrame) return;
    lastControlFrame = frame;
    h = (finite(h) && h > 0 && h < 0.5) ? h : C.step;

    if (slide.cd > 0) slide.cd = Math.max(0, slide.cd - h);
    slideBlend += ((slide.active ? 1 : 0) - slideBlend) * (1 - Math.exp(-10 * h));

    var p = P();
    var inp = G.input || {};
    if (!p || !playing() || !p.alive || !p.enabled) {
      endSlide();
      if (vault.active) finishVault();
      lean.prog = 0;
      leanStep(h);
      prevCrouchDown = false;
      prevJumpDown = false;
      return;
    }

    var crouchDown = false, jumpDown = false, sprintDown = false;
    try {
      crouchDown = typeof inp.down === "function" ? !!inp.down("crouch") : !!inp.crouch;
      jumpDown = typeof inp.down === "function" ? !!inp.down("jump") : false;
      sprintDown = typeof inp.down === "function" ? !!inp.down("sprint") : !!inp.sprint;
    } catch (e) { report(e, "readInput"); }
    var crouchEdge = crouchDown && !prevCrouchDown;
    // 只用“按住态”的上升沿：固定步批量推进（__SX_LOOP.step）时 pressed 不会逐帧清除
    var jumpEdge = jumpDown && !prevJumpDown;

    if (vault.active) {
      prevCrouchDown = crouchDown;
      prevJumpDown = jumpDown;
      vaultStep(h);
      return;
    }

    if (slide.active) {
      if (jumpEdge) {
        endSlide();
        if (G.input && !crouchDown) G.input.crouch = false;   // 滑跳：让引擎起跳
      } else {
        slideStep(h);
      }
    } else {
      // 翻越：跳跃边沿 + 前方有可站立沿顶（空中也可）
      if (jumpEdge) {
        var started = false;
        try { started = startVault(null); } catch (e) { report(e, "vault"); }
        if (started) {
          prevCrouchDown = crouchDown;
          prevJumpDown = jumpDown;
          vaultStep(h);
          return;
        }
      }
      if (crouchEdge && slide.cd <= 0 && (sprintDown || p.sprinting) &&
          p.onGround && Math.hypot(p.vel.x, p.vel.z) >= C.slide.minSpeed) {
        startSlide(false);
      }
    }

    prevCrouchDown = crouchDown;
    prevJumpDown = jumpDown;
    leanStep(h);
    ensureHooks();
  }

  /* ------------------------------------------------------------ 后置位移 */
  function postPlayerMove(pos, vel, h, radius, height, snap, preX, preZ, res) {
    if (!G || !G.player) return;
    var p = G.player;

    // 兜底：若系统钩子没跑到这一步（注册表缺失/顺序异常），这里补一次
    if (G.time && G.time.frame !== lastControlFrame) {
      try { stepControl(h); } catch (e) { report(e, "fallbackStep"); }
    }

    if (vault.active) {
      applyVaultPose(pos);
      vel.x = 0; vel.y = 0; vel.z = 0;
      if (res) { res.onGround = false; res.hitWall = false; res.hitCeil = false; }
      p.onGround = false;
      p.crouching = false;
      if (G.input) { G.input.move.x = 0; G.input.move.y = 0; }
      return;
    }

    if (slide.active) {
      // 玩家 update 用加速后的速度走了一部分，这里补齐到滑铲速度
      var dvx = slide.vx - preX;
      var dvz = slide.vz - preZ;
      if (Math.abs(dvx) + Math.abs(dvz) > 1e-6) {
        try {
          baseMoveCapsule.call(G.physics, pos, { x: dvx, y: 0, z: dvz }, h, radius, height, false);
        } catch (e) { report(e, "slideMove"); }
      }
      vel.x = slide.vx;
      vel.z = slide.vz;
      p.crouching = true;
      if (G.input) G.input.crouch = true;
    }
  }

  function ensureHooks() {
    if (++navTick % 45 !== 0) return;
    var ph = G && G.physics;
    if (ph && !ph.__sxMovement2) { try { installPhysics(); } catch (e) { report(e, "rehook"); } }
    refreshBinds();
  }

  function installPhysics() {
    var ph = G && G.physics;
    if (!ph || ph.__sxMovement2) return;
    var base = ph.moveCapsule;
    if (typeof base !== "function") return;
    baseMoveCapsule = base;
    ph.moveCapsule = function (pos, vel, h, radius, height, snap) {
      var isPlayer = !!(G && G.player && pos === G.player.pos);
      if (!isPlayer) return base.call(ph, pos, vel, h, radius, height, snap);
      var preX = vel.x, preZ = vel.z;
      var res = base.call(ph, pos, vel, h, radius, height, snap);
      try { postPlayerMove(pos, vel, h, radius, height, snap, preX, preZ, res); }
      catch (e) { report(e, "postMove"); }
      return res;
    };
    ph.__sxMovement2 = true;
  }

  /* ------------------------------------------------------------ 相机 */
  function computeCamOffset() {
    var out = { dx: 0, dy: 0, dz: 0, roll: 0 };
    var p = P();
    lastAppliedOffset = 0;
    if (!p || !p.eye || !G.camera) return out;
    if (!playing() || !p.alive || !p.enabled) return out;

    var rightX = Math.cos(p.yaw);
    var rightZ = -Math.sin(p.yaw);
    var off = lean.cur * C.lean.offset;
    if (Math.abs(off) > 1e-4) {
      var sign = off < 0 ? -1 : 1;
      var avail = Math.abs(off) + C.lean.clipPad;
      var hit = null;
      try {
        hit = G.physics.raycast(
          { x: p.eye.x, y: p.eye.y, z: p.eye.z },
          { x: rightX * sign, y: 0, z: rightZ * sign },
          avail
        );
      } catch (e) { report(e, "leanRay"); }
      if (hit && finite(hit.dist)) off = sign * Math.max(0, Math.min(Math.abs(off), hit.dist - C.lean.clipPad));
      out.dx = rightX * off;
      out.dz = rightZ * off;
      lastAppliedOffset = off;
    }

    // 滑铲：额外下压 + 横滚（引擎蹲眼 1.05，这里补到 ~0.95）
    if (slideBlend > 0.001) {
      out.dy = -C.slide.eyeDip * slideBlend;
      var speed = Math.max(0.001, Math.hypot(p.vel.x, p.vel.z));
      var lat = (p.vel.x * rightX + p.vel.z * rightZ) / speed;
      out.roll = -lat * C.slide.roll * slideBlend;
    }
    out.roll += -lean.cur * C.lean.angle;
    return out;
  }

  function postFrameCamera() {
    if (!G || !G.camera || !G.player) return;
    var cam = G.camera;
    var want = computeCamOffset();
    var frame = (G.time && typeof G.time.frame === "number") ? G.time.frame : camApplied.frame;
    if (frame !== camApplied.frame) {
      cam.position.x += want.dx;
      cam.position.y += want.dy;
      cam.position.z += want.dz;
      cam.rotation.z += want.roll;
      camApplied.frame = frame;
      camApplied.dx = want.dx;
      camApplied.dy = want.dy;
      camApplied.dz = want.dz;
      camApplied.roll = want.roll;
    } else {
      var ddx = want.dx - camApplied.dx;
      var ddy = want.dy - camApplied.dy;
      var ddz = want.dz - camApplied.dz;
      var dr = want.roll - camApplied.roll;
      if (Math.abs(ddx) + Math.abs(ddy) + Math.abs(ddz) + Math.abs(dr) > 1e-6) {
        cam.position.x += ddx;
        cam.position.y += ddy;
        cam.position.z += ddz;
        cam.rotation.z += dr;
        camApplied.dx = want.dx;
        camApplied.dy = want.dy;
        camApplied.dz = want.dz;
        camApplied.roll = want.roll;
      }
    }
  }

  function installCamera() {
    if (cameraHook) return;
    var hud = G.hud;
    if (hud && typeof hud.update === "function" && !hud.__sxMoveCam) {
      var base = hud.update;
      hud.__sxMoveCam = true;
      hud.update = function (dt) {
        var r;
        try {
          r = base.apply(hud, arguments);
        } finally {
          try { postFrameCamera(); } catch (e) { report(e, "camera"); }
        }
        return r;
      };
      cameraHook = "hud";
      return;
    }
    var render = G.render;
    if (render && typeof render.frame === "function" && !render.__sxMoveCam) {
      var baseR = render.frame;
      render.__sxMoveCam = true;
      render.frame = function (dt) {
        try { postFrameCamera(); } catch (e) { report(e, "camera"); }
        return baseR.apply(render, arguments);
      };
      cameraHook = "render";
      return;
    }
    startRafCamera();
  }

  function startRafCamera() {
    if (cameraHook) return;
    cameraHook = "raf";
    try {
      var loop = function () {
        try { postFrameCamera(); } catch (e) { report(e, "cameraRaf"); }
        if (cameraHook === "raf") requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) { report(e, "raf"); }
  }

  /* ------------------------------------------------------------ 系统注册 */
  function ensureSystems() {
    if (registered) return;
    var sys = window.SX_SYSTEMS;
    if (sys && typeof sys.register === "function") {
      registered = true;
      try {
        sys.register({
          id: "movement2",
          deps: [],
          fixedUpdate: function (cmd, h) {
            try { stepControl(h); } catch (e) { report(e, "fixedUpdate"); }
          },
          update: function (dt, alpha) {
            try { stepControl(dt); } catch (e) { report(e, "update"); }
          },
          onState: function (next) {
            try {
              if (next === "playing") return;
              if (slide.active) endSlide();
              if (vault.active) {
                if (next === "paused") { /* 冻结 */ }
                else if (next === "dead" || next === "complete") vault.active = false; // 死亡不瞬移到翻越终点
                else finishVault();
              }
              lean.prog = 0;
            } catch (e) { report(e, "onState"); }
          },
          dispose: function () {
            registered = false;
          }
        });
      } catch (e) { report(e, "register"); }
      if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = 0; }
      return;
    }
    startFallback();
  }

  function startFallback() {
    if (fallbackTimer) return;
    // SX_SYSTEMS 不存在时的兜底：16ms 轮询推进状态机；
    // 真正的逐帧精度由 physics.moveCapsule 后置钩子保证。
    fallbackTimer = setInterval(function () {
      try {
        if (window.SX_SYSTEMS && !registered) { ensureSystems(); return; }
        stepControl(C.step);
      } catch (e) { report(e, "fallback"); }
    }, 16);
  }

  /* ------------------------------------------------------------ 公开 API */
  function state() {
    var p = P();
    return {
      sliding: slide.active,
      vaulting: vault.active,
      lean: lean.cur,
      cooldown: slide.cd,
      // 便于测试/调试
      ready: booted,
      speed: p ? Math.hypot(p.vel.x, p.vel.z) : 0,
      slideT: slide.t,
      vaultT: vault.t,
      leanOffset: lastAppliedOffset,
      leanRoll: lean.cur * C.lean.angle,
      bindL: lean.bindL,
      bindR: lean.bindR,
      padLeanL: padLean.L,
      padLeanR: padLean.R,
      camera: cameraHook,
      systems: !!window.SX_SYSTEMS
    };
  }

  function apiSlide() { try { return startSlide(true); } catch (e) { report(e, "apiSlide"); return false; } }
  function apiVault(target) { try { return startVault(target); } catch (e) { report(e, "apiVault"); return false; } }
  function apiLean(dir) {
    try {
      lean.prog = clamp(num(dir, 0), -1, 1);
      return lean.prog;
    } catch (e) { report(e, "apiLean"); return 0; }
  }

  function publish() {
    window.__SX_MOVE = {
      slide: apiSlide,
      vault: apiVault,
      lean: apiLean,
      state: state,
      reloadBinds: function () { try { loadBinds(); } catch (e) { report(e, "reloadBinds"); } return { leanL: lean.bindL, leanR: lean.bindR }; },
      binds: function () { return { leanL: lean.bindL, leanR: lean.bindR }; },
      tuning: C
    };
  }
  publish();

  /* ------------------------------------------------------------ 启动 */
  function boot() {
    if (booted) return true;
    var g = window.__G;
    if (!g || !g.player || !g.player.pos || !g.physics || !g.input || !g.game || !g.events) return false;
    // 等 ext 的就绪信号（__SX / SX_SYSTEMS）；若 ext 因 showcase 跳过，超时后自行接管
    if (!window.__SX && !window.SX_SYSTEMS) return false;
    G = g;
    try { installPhysics(); } catch (e) { report(e, "physicsHook"); }
    try { installCamera(); } catch (e) { report(e, "cameraHook"); }
    try { loadBinds(); } catch (e) { report(e, "binds"); }
    try { installKeys(); } catch (e) { report(e, "keys"); }
    try {
      // 手柄十字键探身（ext_input 转发的事件），与键盘状态并行
      if (G.events && G.events.on) {
        G.events.on("sx:input2:leanL", function (ev) { padLean.L = !!(ev && ev.down); });
        G.events.on("sx:input2:leanR", function (ev) { padLean.R = !!(ev && ev.down); });
      }
    } catch (e) { report(e, "padLean"); }
    try {
      if (window.SX_SYSTEMS) ensureSystems();
      else startFallback();
    } catch (e) { report(e, "systems"); }
    booted = true;
    try {
      prevCrouchDown = !!(G.input && G.input.crouch);
      prevJumpDown = false;
    } catch (_) {}
    console.log("[movement2] V33 滑铲/翻越/探身已就绪（" + (cameraHook || "no-camera") + "）");
    return true;
  }

  var tries = 0;
  var poll = setInterval(function () {
    var ok = false;
    try { ok = boot(); } catch (e) { report(e, "boot"); }
    if (ok || ++tries > 900) clearInterval(poll);
    if (ok) {
      // 若注册表稍后才出现，补注册
      var iv = setInterval(function () {
        if (registered || !booted) { clearInterval(iv); return; }
        try { ensureSystems(); } catch (e) { report(e, "systemsLate"); }
        if (registered || ++tries > 1200) clearInterval(iv);
      }, 250);
    }
  }, 50);
})();
