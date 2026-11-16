
  /* =====================================================================
     V33 · WP33-7 输入 2.0：手柄曲线 / 辅助瞄准 / 按键重绑 / 触屏补充 / 菜单导航
     独立 IIFE：只通过 window.__G 工作，不改动引擎与 ext.js。
     暴露 window.__SX_INPUT2
     ===================================================================== */
  (function () {
    "use strict";
    if (window.__SX_INPUT2) return;

    var CFG_KEY = "saltline.input2";
    var BIND_KEY = "saltline.binds";

    var AIM_LEVELS = {
      off: { maxFrac: 0, cone: 0, label: "关" },
      low: { maxFrac: 0.18, cone: 2, label: "低" },
      std: { maxFrac: 0.35, cone: 3, label: "标准" },
      high: { maxFrac: 0.35, cone: 4, label: "高" }
    };

    var cfg = {
      aim: "std",
      padDeadzone: 0.12,
      padSens: 1,
      padExponent: 1.8,
      navKeys: true
    };

    /* 动作 → 默认键位（与引擎 h_ 保持一致；探身/切枪引擎无默认键，留空） */
    var ACTION_ORDER = [
      "forward", "back", "left", "right",
      "fire", "ads", "reload", "grenade", "melee", "scan",
      "slide", "leanL", "leanR", "swap"
    ];
    var DEFAULT_BINDS = {
      forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
      fire: "Mouse0", ads: "Mouse2", reload: "KeyR", grenade: "KeyG",
      melee: "KeyV", scan: "KeyQ", slide: "KeyC",
      leanL: "KeyZ", leanR: "KeyN", swap: ""
    };
    var ACTION_LABEL = {
      forward: "前进", back: "后退", left: "左移", right: "右移",
      fire: "射击", ads: "瞄准", reload: "换弹", grenade: "手雷",
      melee: "近战", scan: "扫描", slide: "滑铲 / 蹲伏",
      leanL: "左探身", leanR: "右探身", swap: "切枪"
    };
    var ACTION_GROUP = {
      forward: "移动", back: "移动", left: "移动", right: "移动",
      fire: "战斗", ads: "战斗", reload: "战斗", grenade: "战斗",
      melee: "战斗", scan: "战斗", slide: "战斗",
      leanL: "机动", leanR: "机动", swap: "机动"
    };

    /* 动作 → 引擎动作（引擎只认自己的动作集） */
    var ENGINE_ACTION = {
      forward: "forward", back: "back", left: "left", right: "right",
      fire: "fire", ads: "ads", reload: "reload", grenade: "grenade",
      melee: "melee", scan: "scan", slide: "crouch",
      leanL: null, leanR: null, swap: null
    };
    /* 需要转译时，目标引擎键 */
    var ENGINE_KEY = {
      forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
      fire: "Enter", ads: null, reload: "KeyR", grenade: "KeyG",
      melee: "KeyV", scan: "KeyQ", slide: "KeyC",
      jump: "Space", pause: "Escape"
    };
    /* 引擎 h_ 的镜像：按下这个键，引擎本身就会触发该动作 */
    var ENGINE_MAP = {
      KeyW: "forward", KeyS: "back", KeyA: "left", KeyD: "right",
      Space: "jump", ShiftLeft: "sprint", ShiftRight: "sprint",
      KeyC: "crouch", ControlLeft: "crouch", ControlRight: "crouch",
      KeyR: "reload", KeyE: "interact", KeyF: "melee", KeyV: "melee",
      KeyG: "grenade", Digit1: "slot1", Digit2: "slot2", Digit3: "slot3",
      KeyX: "scan", Escape: "pause", KeyP: "pause", KeyQ: "scan",
      Enter: "fire", NumpadEnter: "fire",
      ArrowLeft: "turnL", ArrowRight: "turnR", ArrowUp: "turnU", ArrowDown: "turnD",
      KeyJ: "turnL", KeyL: "turnR", KeyI: "turnU", KeyK: "turnD"
    };

    /* 想吞掉原事件再转译的动作；引擎若已原生识别则不吞不转 */
    var binds = {};
    var G = null;
    var started = false;
    var $SX_INPUT2 = null;
    var hold = { fire: false, ads: false, leanL: false, leanR: false };
    var dispatched = {}; // code -> engineKey（当前按下的转译键）
    var capturing = null;
    var realGetPads = null;
    var suppressPad = false;
    var padInfo = { connected: false, id: "", mapping: "", lastSeen: 0, axes: [0, 0, 0, 0], buttons: [] };
    var padPrev = [];
    var padFullT = 0;
    var padHeld = {}; // action -> true（按住类）
    var lastPadMove = { x: 0, y: 0 };
    var lastPadLook = { x: 0, y: 0 };
    var assist = { adsOn: false, budget: null, target: null, window: 0 };
    var rafStyle = false;

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function isKbCode(code) { return !!code && code.indexOf("Mouse") !== 0; }
    function copy(o) { var r = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
    function readJSON(key) {
      try { var v = JSON.parse(localStorage.getItem(key) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; }
    }
    function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
    function safe(fn, tag) { try { return fn(); } catch (e) { console.error("[input2] " + tag, e); return null; } }

    /* ------------------------------------------------------------ 持久化 */
    function loadCfg() {
      var raw = readJSON(CFG_KEY);
      if (!raw) return;
      if (raw.aim && AIM_LEVELS[raw.aim]) cfg.aim = raw.aim;
      if (isFinite(raw.padDeadzone)) cfg.padDeadzone = clamp(+raw.padDeadzone, 0.02, 0.4);
      if (isFinite(raw.padSens)) cfg.padSens = clamp(+raw.padSens, 0.2, 3);
      if (isFinite(raw.padExponent)) cfg.padExponent = clamp(+raw.padExponent, 1, 3);
    }
    function saveCfg() { writeJSON(CFG_KEY, copy(cfg)); }
    function loadBinds() {
      binds = copy(DEFAULT_BINDS);
      var raw = readJSON(BIND_KEY);
      if (!raw) return;
      for (var k in DEFAULT_BINDS) {
        if (Object.prototype.hasOwnProperty.call(raw, k) && typeof raw[k] === "string" && raw[k].length <= 40) binds[k] = raw[k];
      }
    }
    function saveBinds() {
      var o = {};
      for (var k in binds) o[k] = binds[k];
      writeJSON(BIND_KEY, o);
    }

    /* ------------------------------------------------------------ 手柄 */
    function installPadShadow() {
      if (!navigator || typeof navigator.getGamepads !== "function") return;
      var orig = navigator.getGamepads;
      realGetPads = function () { try { return orig.call(navigator) || []; } catch (e) { return []; } };
      try {
        navigator.getGamepads = function () {
          return suppressPad ? [] : realGetPads();
        };
      } catch (e) { realGetPads = null; }
    }

    function padCurve(v, dz, exp) {
      v = +v || 0;
      dz = dz == null ? cfg.padDeadzone : +dz;
      exp = exp == null ? cfg.padExponent : +exp;
      var a = Math.abs(v);
      if (a <= dz) return 0;
      var n = (a - dz) / Math.max(1e-6, 1 - dz);
      return (v < 0 ? -1 : 1) * Math.pow(clamp(n, 0, 1), exp);
    }

    function pickPad() {
      if (!realGetPads) return null;
      var pads;
      try { pads = realGetPads(); } catch (e) { return null; }
      var fallback = null;
      for (var i = 0; pads && i < pads.length; i++) {
        var p = pads[i];
        if (!p || !p.connected) continue;
        if (p.mapping === "standard") return p;
        if (!fallback) fallback = p;
      }
      return fallback;
    }

    function padSnapshot(p) {
      var b = [], i;
      for (i = 0; p.buttons && i < p.buttons.length; i++) b.push(!!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.35)));
      return {
        connected: true, id: p.id || "", mapping: p.mapping || "",
        axes: [p.axes[0] || 0, p.axes[1] || 0, p.axes[2] || 0, p.axes[3] || 0],
        buttons: b, deadzone: cfg.padDeadzone, sens: cfg.padSens, exponent: cfg.padExponent,
        move: { x: lastPadMove.x, y: lastPadMove.y }, look: { x: lastPadLook.x, y: lastPadLook.y },
        aim: cfg.aim, at: now()
      };
    }

    function btn(p, i) {
      var b = p.buttons && p.buttons[i];
      return !!b && (b.pressed || b.value > 0.4);
    }
    function btnEdge(p, i) { return btn(p, i) && !padPrev[i]; }
    function btnRelease(p, i) { return !btn(p, i) && !!padPrev[i]; }

    function menuRoot() { return G && G.game && G.game.menus ? G.game.menus.root : null; }
    function menuOpen() {
      var r = menuRoot();
      return !!(r && r.classList && r.classList.contains("open") && G.game.menus.screen && G.game.menus.screen !== "none");
    }
    function overlayOpen() { var o = document.getElementById("sx2-bind"); return !!(o && o.classList.contains("on")); }
    function panelOpen() {
      try { return !!(G && G.game && G.game.menus && G.game.menus.panelOpen); } catch (e) { return false; }
    }

    function applyPad(dt) {
      if (!realGetPads) return;
      var p = pickPad();
      var playing = !!(G && G.game && G.game.state === "playing" && G.player && G.player.alive);
      if (!p) {
        if (padInfo.connected) { padInfo.connected = false; padInfo.buttons = []; padPrev = []; }
        // 失去连接时释放仍按住的键
        for (var k in padHeld) if (padHeld[k]) releasePadAction(k);
        return;
      }
      padInfo.connected = true;
      padInfo.id = p.id || "";
      padInfo.mapping = p.mapping || "";
      padInfo.lastSeen = now();
      var b = [], i;
      for (i = 0; p.buttons && i < p.buttons.length; i++) b.push(!!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.35)));
      padInfo.buttons = b;
      padInfo.axes = [p.axes[0] || 0, p.axes[1] || 0, p.axes[2] || 0, p.axes[3] || 0];
      if (!padPrev.length) {
        // 首帧只记录状态，避免连接瞬间把按住的键当作边沿触发
        for (i = 0; i < b.length; i++) padPrev[i] = b[i];
        return;
      }

      var open = menuOpen();
      // 菜单 / 重绑浮层使用手柄导航
      if (open || overlayOpen()) {
        var lx = p.axes[0] || 0, ly = p.axes[1] || 0;
        var navEdge = { up: false, down: false, left: false, right: false };
        if (btnEdge(p, 12) || (ly < -0.6 && lastPadLook._navY !== "up")) navEdge.up = true;
        if (btnEdge(p, 13) || (ly > 0.6 && lastPadLook._navY !== "down")) navEdge.down = true;
        lastPadLook._navY = ly < -0.6 ? "up" : ly > 0.6 ? "down" : "";
        if (navEdge.up) navMove(-1);
        else if (navEdge.down) navMove(1);
        if (btnEdge(p, 14)) { if (!open) { /* 面板内左右切标签 */ } else navMove(-1); }
        if (btnEdge(p, 15)) { if (open) navMove(1); }
        if (btnEdge(p, 0)) navConfirm();
        if (btnEdge(p, 1)) navBack();
        if (btnEdge(p, 9) || btnEdge(p, 8)) navBack();
        // 记录按钮状态后返回，避免菜单里误触开火
        for (i = 0; i < b.length; i++) padPrev[i] = b[i];
        lastPadMove.x = lastPadMove.y = lastPadLook.x = lastPadLook.y = 0;
        return;
      }

      // 游戏内
      var dz = cfg.padDeadzone;
      var mx = padCurve(p.axes[0] || 0, dz), my = -padCurve(p.axes[1] || 0, dz);
      lastPadMove.x = mx; lastPadMove.y = my;
      var rx = padCurve(p.axes[2] || 0, dz), ry = padCurve(p.axes[3] || 0, dz);
      lastPadLook.x = rx; lastPadLook.y = ry;

      if (playing && G.input) {
        var inp = G.input;
        // ---- 移动：键盘 + 摇杆合成，长度不超过 1
        if (Math.abs(mx) + Math.abs(my) > 0.02) {
          var tx = (inp.move.x || 0) + mx, ty = (inp.move.y || 0) + my;
          var m = Math.hypot(tx, ty);
          if (m > 1) { tx /= m; ty /= m; }
          inp.move.x = tx; inp.move.y = ty;
        }
        // ---- 视角：径向死区 + |x|^1.8 响应 + 推满加速 + ADS 修正
        var mag = Math.min(1, Math.hypot(rx, ry));
        if (mag > 0.95) padFullT += dt; else padFullT = 0;
        var ramp = 1 + 0.6 * clamp((padFullT - 0.25) / 0.35, 0, 1);
        var adsK = (G.player && G.player.ads > 0.5) ? 0.55 / 0.6 : 1; // 引擎 lookScale 已含 0.6，这里补齐到 0.55
        var yawSpeed = 220 * Math.PI / 180;   // 220°/s
        var pitchSpeed = 150 * Math.PI / 180; // 150°/s
        if (rx || ry) {
          inp.look.dx += rx * mag * yawSpeed * ramp * adsK * cfg.padSens * dt;
          inp.look.dy += ry * mag * pitchSpeed * ramp * adsK * cfg.padSens * dt;
        }
        // ---- 扳机 / 摇杆按键（引擎此时看不到手柄，不会重复触发）
        if (btn(p, 7)) inp.fire = true;
        if (btn(p, 6)) inp.ads = true;
        if (btn(p, 10) || my > 0.9) inp.sprint = true;
      }

      // ---- 按钮：A 跳、B 蹲、X 换弹、Y 交互、RB 近战、LB 手雷、Start/Back 暂停、L3 冲刺
      var tapMap = { 0: "jump", 2: "reload", 5: "melee", 11: "melee", 4: "grenade", 9: "pause", 8: "pause" };
      var holdMap = { 1: "crouch", 3: "interact", 10: "sprint" };
      for (var tb in tapMap) if (btnEdge(p, +tb)) tapEngine(tapMap[tb]);
      for (var hb in holdMap) {
        if (btnEdge(p, +hb)) holdPadAction(holdMap[hb]);
        if (btnRelease(p, +hb)) releasePadAction(holdMap[hb]);
      }
      // 十字键：左右探身（按住），上切枪
      if (btnEdge(p, 14)) holdPadAction("leanL");
      if (btnRelease(p, 14)) releasePadAction("leanL");
      if (btnEdge(p, 15)) holdPadAction("leanR");
      if (btnRelease(p, 15)) releasePadAction("leanR");
      if (btnEdge(p, 12)) doCustomAction("swap");

      for (i = 0; i < b.length; i++) padPrev[i] = b[i];
    }

    /* ------------------------------------------------------- 合成按键 / 动作 */
    function synthKey(code, down) {
      var ev;
      try {
        ev = new KeyboardEvent(down ? "keydown" : "keyup", {
          code: code, key: "", bubbles: true, cancelable: true, view: window
        });
      } catch (e) {
        ev = document.createEvent("KeyboardEvent");
        ev.initKeyboardEvent(down ? "keydown" : "keyup", true, true, window, code, 0, "", false, "");
      }
      try { ev.__sx2synth = true; } catch (e) {}
      try { window.dispatchEvent(ev); } catch (e) {}
    }

    var tapTimers = {};
    function tapEngine(action) {
      var key = ENGINE_KEY[action];
      if (!key) return;
      if (tapTimers[action]) { clearTimeout(tapTimers[action]); tapTimers[action] = null; }
      synthKey(key, true);
      tapTimers[action] = setTimeout(function () {
        tapTimers[action] = null;
        synthKey(key, false);
      }, 90);
    }
    function holdPadAction(action) {
      if (padHeld[action]) return;
      padHeld[action] = true;
      if (action === "leanL" || action === "leanR") { doCustomAction(action, true); return; }
      var key = ENGINE_KEY[action] || (action === "crouch" ? "KeyC" : action === "interact" ? "KeyE" : action === "sprint" ? "ShiftLeft" : null);
      if (key) synthKey(key, true);
    }
    function releasePadAction(action) {
      if (!padHeld[action]) return;
      padHeld[action] = false;
      if (action === "leanL" || action === "leanR") { doCustomAction(action, false); return; }
      var key = ENGINE_KEY[action] || (action === "crouch" ? "KeyC" : action === "interact" ? "KeyE" : action === "sprint" ? "ShiftLeft" : null);
      if (key) synthKey(key, false);
    }
    function doCustomAction(action, down) {
      try { G.events.emit("sx:input2:" + action, { action: action, down: down !== false }); } catch (e) {}
      if (action === "swap" && down !== false) {
        try { if (G.weapon && G.weapon.cycle) G.weapon.cycle(); } catch (e) {}
      }
    }

    /* ------------------------------------------------------------ 辅助瞄准 */
    function forwardOf(yaw, pitch) {
      var cp = Math.cos(pitch);
      return { x: -cp * Math.sin(yaw), y: Math.sin(pitch), z: -cp * Math.cos(yaw) };
    }
    function wrapAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    }
    /* 纯数学：给定视角与目标点，返回受上限约束的 look 增量 */
    function aimStep(view, target, opt) {
      opt = opt || {};
      var coneDeg = opt.coneDeg != null ? +opt.coneDeg : 3;
      var maxFrac = opt.maxFrac != null ? +opt.maxFrac : 0.35;
      var dt = opt.dt != null ? +opt.dt : 1 / 60;
      var lookScale = opt.lookScale != null && opt.lookScale > 0.01 ? +opt.lookScale : 1;
      var yaw = +view.yaw || 0, pitch = +view.pitch || 0;
      var ex = view.eye ? view.eye.x : 0, ey = view.eye ? view.eye.y : 0, ez = view.eye ? view.eye.z : 0;
      var dx0 = target.x - ex, dy0 = target.y - ey, dz0 = target.z - ez;
      var dist = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0);
      if (!(dist > 1e-4)) return { inCone: false, errRad: 0, errDeg: 0, step: 0, dx: 0, dy: 0, dist: 0 };
      var ux = dx0 / dist, uy = dy0 / dist, uz = dz0 / dist;
      var f = forwardOf(yaw, pitch);
      var dot = clamp(f.x * ux + f.y * uy + f.z * uz, -1, 1);
      var errRad = Math.acos(dot);
      var errDeg = errRad * 180 / Math.PI;
      var inCone = errDeg <= coneDeg + 1e-6 && dist <= (opt.range != null ? +opt.range : 45);
      var yawErr = wrapAngle(Math.atan2(-ux, -uz) - yaw);
      var pitchErr = Math.asin(clamp(uy, -1, 1)) - pitch;
      var mag = Math.hypot(yawErr, pitchErr) || 1e-6;
      // 每帧最多 maxFrac * dt/0.2 的比例，0.2s 内累计不超过 maxFrac
      var frac = maxFrac * clamp(dt / 0.2, 0, 1);
      var step = inCone ? Math.min(mag, mag * frac) : 0;
      var out = {
        inCone: inCone, errRad: errRad, errDeg: errDeg, dist: dist,
        yawErr: yawErr, pitchErr: pitchErr, maxStep: inCone ? mag * maxFrac : 0,
        step: step, dx: 0, dy: 0
      };
      if (step > 0) {
        var dyaw = step * (yawErr / mag), dpitch = step * (pitchErr / mag);
        out.dx = -dyaw / lookScale;   // 引擎：yaw -= look.dx * lookScale
        out.dy = -dpitch / lookScale; // 引擎：pitch -= look.dy * lookScale
      }
      return out;
    }

    function pickAssistTarget(coneDeg, range) {
      var G0 = G;
      if (!G0 || !G0.enemies || !G0.enemies.list || !G0.player) return null;
      var p = G0.player;
      var eye = p.eye || p.pos;
      var f = forwardOf(p.yaw || 0, p.pitch || 0);
      var best = null, bestD = 1e9;
      for (var i = 0; i < G0.enemies.list.length; i++) {
        var e = G0.enemies.list[i];
        if (!e || !e.alive || !e.pos) continue;
        var dx = e.pos.x - eye.x, dy = (e.pos.y + 0.15) - eye.y, dz = e.pos.z - eye.z;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 0.5 || d > range) continue;
        var dot = clamp((f.x * dx + f.y * dy + f.z * dz) / d, -1, 1);
        var ang = Math.acos(dot) * 180 / Math.PI;
        if (ang > coneDeg) continue;
        if (d >= bestD) continue;
        var los = true;
        try { los = G0.physics && G0.physics.lineOfSight ? G0.physics.lineOfSight(eye, { x: e.pos.x, y: e.pos.y + 0.15, z: e.pos.z }) : true; } catch (err) { los = true; }
        if (!los) continue;
        best = e; bestD = d;
      }
      return best;
    }

    function applyAimAssist(inp, dt) {
      if (!G || !G.player || !G.player.alive) return null;
      var lvl = AIM_LEVELS[cfg.aim] || AIM_LEVELS.off;
      var deviceOk = padInfo.connected || (G.input && G.input.touch);
      if (cfg.aim === "off" || lvl.maxFrac <= 0 || !deviceOk) { assist.adsOn = false; assist.budget = null; return null; }
      var ads = G.player.ads || 0;
      if (ads < 0.2) {
        if (assist.adsOn) { assist.adsOn = false; assist.budget = null; assist.target = null; }
        return null;
      }
      if (!assist.adsOn) { assist.adsOn = true; assist.budget = null; assist.target = null; }
      var t = pickAssistTarget(lvl.cone, 45);
      if (!t) { assist.target = null; return null; }
      var st = aimStep(
        { yaw: G.player.yaw, pitch: G.player.pitch, eye: G.player.eye && G.player.eye.x != null ? G.player.eye : G.player.pos },
        { x: t.pos.x, y: t.pos.y + 0.15, z: t.pos.z },
        { coneDeg: lvl.cone, maxFrac: lvl.maxFrac, dt: dt, range: 45, lookScale: G.player.lookScale || 1 }
      );
      if (!st.inCone || st.step <= 0) { assist.target = null; return null; }
      if (assist.budget == null) assist.budget = st.errRad * lvl.maxFrac;
      var step = Math.min(st.step, assist.budget);
      if (step <= 1e-6) { assist.target = t; return null; }
      assist.budget -= step;
      assist.target = t;
      var scale = (step / st.step);
      inp.look.dx += st.dx * scale;
      inp.look.dy += st.dy * scale;
      return { errDeg: st.errDeg, step: step, scale: scale, target: t.id };
    }

    /* ------------------------------------------------------------ 按键重绑 */
    var KEY_LABEL = {
      Space: "空格", ShiftLeft: "左Shift", ShiftRight: "右Shift", ControlLeft: "左Ctrl", ControlRight: "右Ctrl",
      Escape: "Esc", Enter: "回车", Tab: "Tab", Backspace: "退格", CapsLock: "Caps",
      ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
      Mouse0: "鼠标左键", Mouse1: "鼠标中键", Mouse2: "鼠标右键"
    };
    function keyLabel(code) {
      if (!code) return "未绑定";
      if (KEY_LABEL[code]) return KEY_LABEL[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      if (/^Digit[0-9]$/.test(code)) return code.slice(5);
      if (/^Numpad[0-9]$/.test(code)) return "小键盘" + code.slice(6);
      if (/^F[0-9]{1,2}$/.test(code)) return code;
      return code;
    }
    function actionForCode(code) {
      for (var i = 0; i < ACTION_ORDER.length; i++) {
        var a = ACTION_ORDER[i];
        if (binds[a] && binds[a] === code) return a;
      }
      return null;
    }
    function setBind(action, code) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_BINDS, action)) return { ok: false, reason: "unknown-action" };
      code = typeof code === "string" ? code.trim() : "";
      if (code && code.length > 40) return { ok: false, reason: "bad-code" };
      var swapped = null;
      if (code) {
        for (var i = 0; i < ACTION_ORDER.length; i++) {
          var other = ACTION_ORDER[i];
          if (other !== action && binds[other] === code) { swapped = other; break; }
        }
      }
      var old = binds[action];
      binds[action] = code;
      if (swapped) binds[swapped] = old;
      saveBinds();
      refreshBindUI();
      return { ok: true, action: action, code: code, swapped: swapped };
    }
    function resetBinds() {
      binds = copy(DEFAULT_BINDS);
      try { localStorage.removeItem(BIND_KEY); } catch (e) {}
      refreshBindUI();
      return copy(binds);
    }

    function onKeyDown(e) {
      if (e.__sx2synth) return;
      var code = e.code;
      if (!code) return;
      if (overlayOpen() && !capturing) {
        // 重绑浮层打开时吞掉其余按键，避免后台游戏同时响应
        if (code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeBindOverlay(); }
        else if (code !== "Tab") { e.preventDefault(); e.stopImmediatePropagation(); }
        return;
      }
      if (capturing) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var act = capturing;
        capturing = null;
        if (code !== "Escape") {
          var r = setBind(act, code);
          setBindNote(r && r.swapped ? "已绑定 " + keyLabel(code) + "，与「" + ACTION_LABEL[r.swapped] + "」交换" : "已绑定 " + keyLabel(code));
        } else {
          setBindNote("已取消");
        }
        renderBindList();
        return;
      }
      // 菜单打开时，方向键/回车交给我们做 DOM 焦点导航
      if (menuOpen() && !overlayOpen() && !panelOpen() && cfg.navKeys &&
          (code === "ArrowUp" || code === "ArrowDown" || code === "ArrowLeft" || code === "ArrowRight" || code === "Enter" || code === "NumpadEnter")) {
        if (code === "ArrowUp" || code === "ArrowLeft") { e.preventDefault(); navMove(-1); return; }
        if (code === "ArrowDown" || code === "ArrowRight") { e.preventDefault(); navMove(1); return; }
        if (code === "Enter" || code === "NumpadEnter") {
          var ae = document.activeElement;
          if (ae && ae.tagName === "BUTTON" && menuRoot() && menuRoot().contains(ae)) return; // 原生回车即可
          e.preventDefault(); navConfirm(); return;
        }
      }
      var action = actionForCode(code);
      if (!action) return;
      var engAction = ENGINE_ACTION[action];
      // 引擎自己就认识这个键 → 不吞、不转译
      if (engAction && ENGINE_MAP[code] === engAction) return;
      if (engAction === "fire" || engAction === "ads" || action === "fire" || action === "ads") {
        if (!isKbCode(code)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        hold[action] = true;
        return;
      }
      if (!engAction) {
        e.preventDefault(); e.stopImmediatePropagation();
        hold[action] = true;
        doCustomAction(action, true);
        return;
      }
      var target = ENGINE_KEY[action];
      if (!target) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (dispatched[code]) return;
      dispatched[code] = target;
      synthKey(target, true);
    }
    function onKeyUp(e) {
      if (e.__sx2synth) return;
      var code = e.code;
      if (!code) return;
      var action = actionForCode(code);
      if (!action) return;
      var engAction = ENGINE_ACTION[action];
      if (engAction && ENGINE_MAP[code] === engAction) return;
      if (action === "fire" || action === "ads") { hold[action] = false; return; }
      if (!engAction) { hold[action] = false; doCustomAction(action, false); return; }
      if (dispatched[code]) {
        var target = dispatched[code];
        delete dispatched[code];
        synthKey(target, false);
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }
    function releaseAll() {
      hold.fire = hold.ads = false;
      for (var c in dispatched) { synthKey(dispatched[c], false); delete dispatched[c]; }
      for (var i = 0; i < ACTION_ORDER.length; i++) if (padHeld[ACTION_ORDER[i]]) releasePadAction(ACTION_ORDER[i]);
      assist.adsOn = false; assist.budget = null;
    }

    /* ------------------------------------------------------------ 菜单导航 */
    function navList() {
      var root = menuRoot();
      if (!root) return [];
      var scope = null;
      if (panelOpen()) scope = root.querySelector(".panel:not([hidden])");
      else {
        var s = G.game.menus.screen;
        scope = root.querySelector('.m-screen[data-s="' + s + '"]');
      }
      if (!scope) return [];
      var all = scope.querySelectorAll("button, input, [data-nav]");
      var out = [];
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.disabled) continue;
        if (el.offsetParent === null && el.getClientRects().length === 0) continue;
        if (el.closest && el.closest("[hidden]")) continue;
        out.push(el);
      }
      return out;
    }
    function navMove(dir) {
      var list = navList();
      if (!list.length) return false;
      var i = list.indexOf(document.activeElement);
      i = i < 0 ? 0 : (i + dir + list.length) % list.length;
      try { list[i].focus({ preventScroll: true }); } catch (e) { try { list[i].focus(); } catch (e2) {} }
      return true;
    }
    function navConfirm() {
      if (overlayOpen()) { var cur = document.querySelector("#sx2-bind .x2-row.sel[data-sx2-bind]"); if (cur) { capturing = cur.dataset.sx2Bind; setBindNote("按下新的按键…（Esc 取消）"); return true; } }
      var list = navList();
      if (!list.length) return false;
      var el = document.activeElement;
      if (!el || list.indexOf(el) < 0) { el = list[0]; try { el.focus({ preventScroll: true }); } catch (e) {} }
      if (el && el.tagName === "BUTTON") { try { el.click(); } catch (e) {} return true; }
      if (el && el.tagName === "INPUT") { try { el.focus(); } catch (e) {} return true; }
      try { el && el.click(); } catch (e) {}
      return true;
    }
    function navBack() {
      if (overlayOpen()) { closeBindOverlay(); return true; }
      if (panelOpen()) { try { G.game.menus.closePanel(); } catch (e) {} return true; }
      if (G && G.game && G.game.state === "paused") { try { G.game.resume(); } catch (e) {} return true; }
      return false;
    }

    /* ------------------------------------------------------------ 重绑 UI */
    function injectCSS() {
      if (document.getElementById("sx2-css")) return;
      var st = document.createElement("style");
      st.id = "sx2-css";
      st.textContent = [
        ".x2-bind{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;background:rgba(6,8,10,.82);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);font-family:var(--f-label,\"PingFang SC\",sans-serif);color:#e8e4da;}",
        ".x2-bind.on{display:flex;}",
        ".x2-card{width:min(720px,92vw);max-height:84vh;overflow:auto;background:rgba(11,13,15,.96);border:1px solid rgba(232,228,218,.22);padding:20px 22px 16px;}",
        ".x2-card h2{font:700 20px/1.2 var(--f-display,\"PingFang SC\",sans-serif);letter-spacing:.12em;margin:0 0 4px;}",
        ".x2-sub{font:400 11px/1.6 var(--f-mono,monospace);color:rgba(232,228,218,.55);letter-spacing:.06em;margin:0 0 14px;}",
        ".x2-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;}",
        ".x2-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 9px;border:1px solid rgba(232,228,218,.12);background:rgba(232,228,218,.03);cursor:pointer;}",
        ".x2-row:hover,.x2-row.sel{border-color:var(--signal,#ffb347);background:rgba(255,179,71,.10);}",
        ".x2-row em{font-style:normal;font:600 10px/1 var(--f-mono,monospace);letter-spacing:.16em;color:rgba(232,228,218,.45);text-transform:uppercase;}",
        ".x2-row b{font:700 12px/1 var(--f-mono,monospace);color:var(--signal,#ffb347);min-width:84px;text-align:right;}",
        ".x2-row span{font:500 12px/1 var(--f-label,sans-serif);letter-spacing:.08em;}",
        ".x2-foot{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap;}",
        ".x2-note{font:500 11px/1.5 var(--f-mono,monospace);color:rgba(232,228,218,.55);flex:1 1 auto;min-width:180px;}",
        ".x2-btn{padding:7px 12px;border:1px solid rgba(232,228,218,.3);background:rgba(232,228,218,.06);color:#e8e4da;font:600 11px/1 var(--f-label,sans-serif);letter-spacing:.14em;cursor:pointer;}",
        ".x2-btn:hover{border-color:var(--signal,#ffb347);color:var(--signal,#ffb347);}",
        ".x2-sect{grid-column:1/-1;font:600 10px/1 var(--f-mono,monospace);letter-spacing:.24em;color:rgba(232,228,218,.35);margin:10px 0 2px;text-transform:uppercase;}",
        ".m-screen button:focus-visible{outline:2px solid var(--signal,#ffb347);outline-offset:3px;}",
        ".x2-touch{position:absolute;width:56px;height:56px;display:flex;align-items:center;justify-content:center;padding:0;}",
        "@media (max-width:760px){.x2-grid{grid-template-columns:1fr;}}"
      ].join("\n");
      (document.head || document.documentElement).appendChild(st);
    }

    function buildBindOverlay() {
      if (document.getElementById("sx2-bind")) return;
      var d = document.createElement("div");
      d.id = "sx2-bind";
      d.className = "x2-bind";
      d.setAttribute("role", "dialog");
      d.setAttribute("aria-modal", "true");
      d.setAttribute("aria-label", "按键重绑");
      d.innerHTML =
        '<div class="x2-card" tabindex="-1">' +
          '<h2>按键重绑</h2>' +
          '<p class="x2-sub">点击一行，然后按下任意键完成绑定。Esc 取消；与已有按键冲突时自动交换。默认键位与引擎一致。</p>' +
          '<div class="x2-grid" data-sx2-list></div>' +
          '<div class="x2-foot">' +
            '<p class="x2-note" data-sx2-note></p>' +
            '<button class="x2-btn" data-sx2-reset>恢复默认</button>' +
            '<button class="x2-btn" data-sx2-close>关闭</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(d);
      var card = d.querySelector(".x2-card");
      d.addEventListener("click", function (e) {
        if (e.target === d) { closeBindOverlay(); return; }
        var row = e.target.closest ? e.target.closest("[data-sx2-bind]") : null;
        if (row) {
          capturing = row.dataset.sx2Bind;
          var rows = d.querySelectorAll(".x2-row");
          for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("sel", rows[i] === row);
          setBindNote("按下新的按键…（Esc 取消）");
          try { row.focus(); } catch (er) {}
          return;
        }
        if (e.target.closest("[data-sx2-reset]")) { resetBinds(); renderBindList(); setBindNote("已恢复默认键位"); }
        if (e.target.closest("[data-sx2-close]")) closeBindOverlay();
      });
      d.addEventListener("keydown", function (e) {
        if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); closeBindOverlay(); }
      });
      card.focus && card.focus();
    }

    function refreshBindUI() {
      if (!document.getElementById("sx2-bind")) return;
      renderBindList();
      var holders = document.querySelectorAll("[data-sx2-bindkey]");
      for (var i = 0; i < holders.length; i++) {
        var a = holders[i].dataset.sx2Bindkey;
        holders[i].textContent = keyLabel(binds[a]);
      }
    }
    function renderBindList() {
      var list = document.querySelector("#sx2-bind [data-sx2-list]");
      if (!list) return;
      var html = "";
      var lastGroup = "";
      for (var i = 0; i < ACTION_ORDER.length; i++) {
        var a = ACTION_ORDER[i];
        if (ACTION_GROUP[a] !== lastGroup) { lastGroup = ACTION_GROUP[a]; html += '<div class="x2-sect">' + lastGroup + "</div>"; }
        html += '<div class="x2-row" data-sx2-bind="' + a + '" tabindex="0">' +
          '<span>' + ACTION_LABEL[a] + "</span><b>" + keyLabel(binds[a]) + "</b></div>";
      }
      list.innerHTML = html;
    }
    function setBindNote(t) {
      var n = document.querySelector("#sx2-bind [data-sx2-note]");
      if (n) n.textContent = t || "";
    }
    function openBindOverlay() {
      buildBindOverlay();
      renderBindList();
      setBindNote("");
      document.getElementById("sx2-bind").classList.add("on");
      var card = document.querySelector("#sx2-bind .x2-card");
      try { card.focus({ preventScroll: true }); } catch (e) {}
    }
    function closeBindOverlay() {
      capturing = null;
      var d = document.getElementById("sx2-bind");
      if (d) d.classList.remove("on");
      setBindNote("");
    }

    /* ------------------------------------------------------------ 设置页 UI */
    function injectSettingsUI() {
      var pane = document.querySelector('.panel-b[data-pane="settings"]');
      if (!pane || pane.querySelector("[data-sx2-ui]")) return false;
      var wrap = document.createElement("div");
      wrap.setAttribute("data-sx2-ui", "1");
      wrap.innerHTML =
        "<h3>操控</h3>" +
        '<div class="row"><label for="sx2-dz">手柄死区</label><div class="slider"><input id="sx2-dz" type="range" min="0.02" max="0.35" step="0.01"><output data-sx2-o="dz"></output></div></div>' +
        '<div class="row"><label for="sx2-sens">手柄灵敏度</label><div class="slider"><input id="sx2-sens" type="range" min="0.3" max="2.5" step="0.05"><output data-sx2-o="sens"></output></div></div>' +
        '<div class="row"><label>辅助瞄准</label><div class="seg" data-sx2-aim><button data-v="off">关</button><button data-v="low">低</button><button data-v="std">标准</button><button data-v="high">高</button></div></div>' +
        '<div class="row"><label>按键重绑</label><button class="btn small" data-sx2-bindopen>打开按键重绑</button></div>';
      var note = pane.querySelector(".panel-note");
      var audioBlock = pane.querySelector("[data-sx2-audio-ui]");
      if (note) pane.insertBefore(wrap, note);
      else pane.appendChild(wrap);
      var dz = wrap.querySelector("#sx2-dz"), sens = wrap.querySelector("#sx2-sens");
      function sync() {
        dz.value = cfg.padDeadzone;
        sens.value = cfg.padSens;
        wrap.querySelector('[data-sx2-o="dz"]').textContent = (+cfg.padDeadzone).toFixed(2);
        wrap.querySelector('[data-sx2-o="sens"]').textContent = (+cfg.padSens).toFixed(2) + "×";
        var seg = wrap.querySelector("[data-sx2-aim]");
        var bs = seg.querySelectorAll("button");
        for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-pressed", String(bs[i].dataset.v === cfg.aim));
      }
      dz.addEventListener("input", function () { cfg.padDeadzone = clamp(+dz.value, 0.02, 0.35); saveCfg(); sync(); });
      sens.addEventListener("input", function () { cfg.padSens = clamp(+sens.value, 0.3, 2.5); saveCfg(); sync(); });
      wrap.querySelector("[data-sx2-aim]").addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("button[data-v]") : null;
        if (!b || !AIM_LEVELS[b.dataset.v]) return;
        cfg.aim = b.dataset.v; saveCfg(); sync();
        try { G.events.emit("ui:click", {}); } catch (er) {}
      });
      wrap.querySelector("[data-sx2-bindopen]").addEventListener("click", function () { openBindOverlay(); });
      sync();
      return true;
    }

    function addPauseBindButton() {
      var sets = document.querySelectorAll('.m-screen[data-s="paused"] .m-actions, .m-screen[data-s="title"] .m-actions');
      for (var i = 0; i < sets.length; i++) {
        if (sets[i].querySelector("[data-sx2-pausebind]")) continue;
        var b = document.createElement("button");
        b.className = "btn";
        b.setAttribute("data-sx2-pausebind", "1");
        b.textContent = "按键重绑";
        b.addEventListener("click", function (e) { e.preventDefault(); openBindOverlay(); });
        sets[i].appendChild(b);
      }
      // 设置 / 操作说明面板里也放一个入口
      var panes = document.querySelectorAll('.panel-b[data-pane="settings"], .panel-b[data-pane="controls"]');
      for (var j = 0; j < panes.length; j++) {
        if (panes[j].querySelector("[data-sx2-pane-bind]")) continue;
        var row = document.createElement("div");
        row.className = "row";
        row.innerHTML = '<label>按键重绑</label><button class="btn small" data-sx2-pane-bind="1">打开按键重绑</button>';
        row.querySelector("button").addEventListener("click", function (e) { e.preventDefault(); openBindOverlay(); });
        panes[j].appendChild(row);
      }
    }

    /* ------------------------------------------------------------ 触屏补充 */
    function addTouchButtons() {
      var ui = document.getElementById("ui");
      if (!ui || !G.input) return;
      function ensure() {
        if (!G.input.touch) return;
        if (ui.querySelector("[data-sx2-touch]")) return;
        var mk = function (label, code, style) {
          var b = document.createElement("button");
          b.className = "t-btn x2-touch";
          b.setAttribute("data-sx2-touch", code);
          b.setAttribute("aria-label", label);
          b.innerHTML = "<span>" + label + "</span>";
          b.style.cssText = style;
          b.addEventListener("pointerdown", function (e) {
            e.preventDefault(); e.stopPropagation();
            b.classList.add("active");
            synthKey(code, true);
          }, { passive: false });
          var up = function (e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            b.classList.remove("active");
            synthKey(code, false);
          };
          b.addEventListener("pointerup", up, { passive: false });
          b.addEventListener("pointercancel", up, { passive: false });
          b.addEventListener("pointerleave", function (e) { if (b.classList.contains("active")) up(e); }, { passive: false });
          b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
          ui.appendChild(b);
          return b;
        };
        // 近战（V）+ 滑铲（C 语义），不覆盖已有按钮
        mk("近战", "KeyV", "right:calc(20px + var(--sar));bottom:calc(322px + var(--sab));");
        mk("滑铲", "KeyC", "right:calc(88px + var(--sar));bottom:calc(322px + var(--sab));");
      }
      ensure();
      addEventListener("touchstart", function () { setTimeout(ensure, 60); }, { passive: true, capture: true });
    }

    /* ------------------------------------------------------------ 引擎挂接 */
    function wrapInput() {
      if (!G || !G.input || typeof G.input.update !== "function") return false;
      if (G.input.__sx2wrapped) return true;
      var orig = G.input.update;
      G.input.__sx2wrapped = true;
      G.input.update = function (dt) {
        var d = dt;
        suppressPad = true;
        try { orig.call(G.input, d); } catch (e) { throw e; } finally { suppressPad = false; }
        if (!started) return;
        safe(function () { applyPad(d || 0.016); }, "pad");
        safe(function () { applyAimAssist(G.input, d || 0.016); }, "aim");
        if (hold.fire) G.input.fire = true;
        if (hold.ads) G.input.ads = true;
      };
      return true;
    }

    function init(G0) {
      if (started) return;
      G = G0;
      started = true;
      loadCfg();
      loadBinds();
      injectCSS();
      installPadShadow();
      wrapInput();
      buildBindOverlay();
      injectSettingsUI();
      addPauseBindButton();
      addTouchButtons();
      addEventListener("keydown", onKeyDown, true);
      addEventListener("keyup", onKeyUp, true);
      addEventListener("blur", releaseAll, true);
      document.addEventListener("visibilitychange", function () { if (document.hidden) releaseAll(); });
      // 菜单出现/切换时聚焦首个控件，保证手柄/键盘都能继续操作
      var root = menuRoot();
      if (root && !root.__sx2nav) {
        root.__sx2nav = true;
        var obs = null;
        if (window.MutationObserver) {
          obs = new MutationObserver(function () {
            if (!menuOpen()) return;
            var act = document.activeElement;
            if (act && root.contains(act)) return;
            var list = navList();
            if (list.length) { try { list[0].focus({ preventScroll: true }); } catch (e) {} }
          });
          obs.observe(root, { attributes: true, attributeFilter: ["data-screen", "class"], subtree: false });
        }
      }
      $SX_INPUT2 = {
        version: "V33",
        binds: function () { return copy(binds); },
        setBind: setBind,
        resetBinds: resetBinds,
        aimAssist: function (on) {
          if (on === true) cfg.aim = cfg.aim === "off" ? "std" : cfg.aim;
          else if (on === false) cfg.aim = "off";
          else if (typeof on === "string" && AIM_LEVELS[on]) cfg.aim = on;
          saveCfg();
          var pane = document.querySelector("[data-sx2-aim]");
          if (pane) {
            var bs = pane.querySelectorAll("button");
            for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-pressed", String(bs[i].dataset.v === cfg.aim));
          }
          return cfg.aim;
        },
        gamepad: function () {
          var p = pickPad();
          if (p) return padSnapshot(p);
          return { connected: false, id: "", mapping: "", axis: [0, 0, 0, 0], buttons: [], deadzone: cfg.padDeadzone, sens: cfg.padSens, exponent: cfg.padExponent, aim: cfg.aim, at: now() };
        },
        settings: function () { return copy(cfg); },
        setSetting: function (k, v) {
          if (k === "aim") return $SX_INPUT2.aimAssist(v);
          if (k === "padDeadzone" || k === "padSens" || k === "padExponent") {
            cfg[k] = +v; saveCfg(); injectSettingsUI();
            var el = document.querySelector(k === "padDeadzone" ? "#sx2-dz" : k === "padSens" ? "#sx2-sens" : null);
            if (el) { el.value = cfg[k]; try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {} }
            return cfg[k];
          }
          return null;
        },
        padCurve: padCurve,
        aimStep: aimStep,
        aimTarget: pickAssistTarget,
        state: function () {
          return {
            started: started, pad: { connected: padInfo.connected, id: padInfo.id, mapping: padInfo.mapping },
            hold: copy(hold), aim: cfg.aim, binds: copy(binds),
            menu: menuRoot() ? G.game.menus.screen : null, panelOpen: panelOpen(),
            overlayOpen: overlayOpen(), capturing: capturing, navKeys: cfg.navKeys
          };
        },
        nav: { move: navMove, confirm: navConfirm, back: navBack, list: navList },
        _debug: { padInfo: padInfo, assist: assist }
      };
      window.__SX_INPUT2 = $SX_INPUT2;
      console.log("[input2] V33 输入扩展已加载 · 手柄 " + (padInfo.connected ? "已连接" : "待连接") + " · 辅助瞄准 " + cfg.aim);
    }

    function bootWait() {
      var tries = 0;
      var iv = setInterval(function () {
        var G0 = window.__G;
        if (G0 && G0.input && G0.game && G0.game.menus && G0.hud && G0.player) {
          clearInterval(iv);
          try { init(G0); } catch (e) { console.error("[input2] init failed", e); }
        } else if (++tries > 900) { clearInterval(iv); console.error("[input2] engine not ready"); }
      }, 80);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootWait, { once: true });
    else bootWait();
  })();