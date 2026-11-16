
  /* =====================================================================
     V33 · WP33-6 音频 2.0：分轨音量 / HRTF / 遮挡 / 分层枪声 / 启动阻塞计时
     独立 IIFE：不改引擎合成，只包装 G.audio 对外 API。
     暴露 window.__SX_AUDIO2
     ===================================================================== */
  (function () {
    "use strict";
    if (window.__SX_AUDIO2) return;

    var KEY = "saltline.audio.v1";
    var ENGINE_KEY = "saltline.settings.v1";
    var DEFAULTS = { master: 0.8, music: 1, sfx: 1, voice: 1, hrtf: false, occlusion: true, layers: true };
    var cfg = {};
    var G = null, started = false;
    var PANNER_CAP = 96;
    var panners = [];                 /* WeakRef（无 WeakRef 时退化为强引用并裁剪） */
    var pannerDesc = null;
    var hrtfMode = false;
    var lastLosT = -1e9;
    var losCache = null;
    var loops = new Set();            /* 存活 loop 句柄；stop 时移除（同名可多个） */
    var stats = { shots: 0, lowOnly: 0, layers: 0, last: null, shotsById: {}, loopStops: 0 };
    var initT0 = 0, initMs = null, initMeasured = false;
    var audioReady = false;

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function copy(o) { var r = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
    function readJSON(key) {
      try { var v = JSON.parse(localStorage.getItem(key) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; }
    }
    function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
    function safe(fn, tag) { try { return fn(); } catch (e) { console.error("[audio2] " + tag, e); return null; } }

    /* ------------------------------------------------------- 配置持久化 */
    function loadCfg() {
      for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
      var raw = readJSON(KEY);
      if (!raw) {
        // 第一次运行：沿用引擎已有主音量，避免突然变响/变轻
        var eng = readJSON(ENGINE_KEY);
        if (eng && isFinite(eng.volume)) cfg.master = clamp(+eng.volume, 0, 1);
        return;
      }
      if (isFinite(raw.master)) cfg.master = clamp(+raw.master, 0, 1);
      if (isFinite(raw.music)) cfg.music = clamp(+raw.music, 0, 1);
      if (isFinite(raw.sfx)) cfg.sfx = clamp(+raw.sfx, 0, 1);
      if (isFinite(raw.voice)) cfg.voice = clamp(+raw.voice, 0, 1);
      cfg.hrtf = !!raw.hrtf;
      cfg.occlusion = raw.occlusion !== false;
      cfg.layers = raw.layers !== false;
    }
    function saveCfg() { writeJSON(KEY, copy(cfg)); }

    /* ------------------------------------------------------- 声像模型 */
    function trackPanner(p) {
      try {
        panners.push(typeof WeakRef === "function" ? new WeakRef(p) : { deref: function () { return p; } });
        if (panners.length > PANNER_CAP * 2) prunePanners();
      } catch (e) {}
    }
    function prunePanners() {
      var out = [];
      for (var i = 0; i < panners.length; i++) {
        var ref = panners[i];
        if (ref && typeof ref.deref === "function" && ref.deref()) out.push(ref);
      }
      panners = out.length > PANNER_CAP ? out.slice(out.length - PANNER_CAP) : out;
    }
    function eachPanner(fn) {
      prunePanners();
      for (var i = 0; i < panners.length; i++) {
        var p = panners[i] && typeof panners[i].deref === "function" ? panners[i].deref() : null;
        if (p) fn(p);
      }
    }
    function patchPanner() {
      var AC = window.AudioContext || window.webkitAudioContext;
      var proto = window.PannerNode && window.PannerNode.prototype;
      if (!AC || !AC.prototype || !AC.prototype.createPanner || !proto) return false;
      if (proto.__sx2hrtf) return true;
      var desc = Object.getOwnPropertyDescriptor(proto, "panningModel");
      if (!desc || !desc.set) return false;
      pannerDesc = desc;
      try {
        Object.defineProperty(proto, "panningModel", {
          configurable: true,
          enumerable: desc.enumerable,
          get: function () { return desc.get.call(this); },
          set: function (v) {
            this.__sx2want = v;
            desc.set.call(this, hrtfMode ? "HRTF" : v);
          }
        });
        proto.__sx2hrtf = true;
        var orig = AC.prototype.createPanner;
        AC.prototype.createPanner = function () {
          var p = orig.apply(this, arguments);
          try {
            /* 新节点立即按当前 hrtfMode 设置；引擎随后显式设置的 HRTF 优先 */
            var want = hrtfMode ? "HRTF" : "equalpower";
            p.__sx2want = want;
            if (pannerDesc && pannerDesc.set) pannerDesc.set.call(p, want);
            trackPanner(p);
          } catch (e) {}
          return p;
        };
        return true;
      } catch (e) {
        console.error("[audio2] panner patch failed", e);
        return false;
      }
    }
    function applyHrtfAll() {
      if (!pannerDesc) return;
      eachPanner(function (p) {
        try {
          /* 引擎显式要求 HRTF 的节点（旋翼/伺服等）不因全局开关而改写 */
          var explicitHrtf = p.__sx2want === "HRTF";
          pannerDesc.set.call(p, (hrtfMode || explicitHrtf) ? "HRTF" : "equalpower");
        } catch (e) {}
      });
    }

    /* ------------------------------------------------------- 分类 / 增益 */
    function category(name) {
      var n = String(name == null ? "" : name).toLowerCase();
      if (n.indexOf("music") === 0 || n.indexOf("ost") >= 0 || n.indexOf("perc") >= 0 || n.indexOf("brass") >= 0) return "music";
      if (n.indexOf("radio") >= 0 || n.indexOf("voice") >= 0 || n.indexOf("speech") >= 0 || n.indexOf("dialog") >= 0 || n.indexOf("comms") >= 0) return "voice";
      if (n.indexOf("ui") >= 0 || n.indexOf("impact") >= 0 || n.indexOf("weapon") >= 0) return "sfx";
      return "sfx";
    }
    function gainFor(name, base) {
      var cat = category(name);
      var g = cfg[cat] == null ? 1 : +cfg[cat];
      return (base == null ? 1 : +base) * g;
    }
    function busLabel(k) {
      return k === "music" ? "音乐" : k === "voice" ? "语音" : k === "sfx" ? "音效" : "主音量";
    }
    function setBus(name, value) {
      if (name === "master") {
        cfg.master = clamp(+value, 0, 1);
        applyMaster();
      } else if (name === "music" || name === "sfx" || name === "voice") {
        cfg[name] = clamp(+value, 0, 1);
        applyLoopBuses();
      } else return null;
      saveCfg();
      syncUnifiedVolume();
      syncAudioUI();
      return cfg[name];
    }
    function resetBuses() {
      cfg.master = DEFAULTS.master; cfg.music = 1; cfg.sfx = 1; cfg.voice = 1;
      applyMaster(); applyLoopBuses(); saveCfg(); syncUnifiedVolume(); syncAudioUI();
      return buses();
    }
    function buses() { return { master: cfg.master, music: cfg.music, sfx: cfg.sfx, voice: cfg.voice }; }

    function applyMaster() {
      if (!G || !G.audio) return;
      try { if (G.audio.setVolume) G.audio.setVolume(cfg.master); } catch (e) {}
      // 同步到引擎设置档，避免下次打开设置页被旧值覆盖
      try {
        var eng = readJSON(ENGINE_KEY) || {};
        if (eng.volume !== cfg.master) { eng.volume = cfg.master; writeJSON(ENGINE_KEY, eng); }
      } catch (e) {}
    }
    /* 分轨音量写统一存档 settings.volume，避免只写 legacy 键被引擎旧缓存覆盖 */
    function syncUnifiedVolume() {
      try {
        var S = window.SXSave;
        if (!S || typeof S.set !== "function") return false;
        S.set("settings", { volume: { master: cfg.master, music: cfg.music, sfx: cfg.sfx, voice: cfg.voice } });
        return true;
      } catch (e) { return false; }
    }
    function pruneLoops() {
      loops.forEach(function (h) {
        if (!h || h.alive === false) loops.delete(h);
      });
    }
    function applyLoopBuses() {
      pruneLoops();
      loops.forEach(function (h) {
        if (!h || !h.__sx2set) return;
        var g = cfg[h.__sx2cat] == null ? 1 : +cfg[h.__sx2cat];
        try { h.__sx2set.call(h, h.__sx2base * g); } catch (e) {}
      });
    }

    /* ------------------------------------------------------- 遮挡 */
    var _lp = null;
    function listenerNow() {
      try { return G && G.camera ? G.camera.position : null; } catch (e) { return null; }
    }
    function cellKey(pos) {
      return Math.floor((pos.x || 0) / 2) + "," + Math.floor((pos.y || 0) / 2) + "," + Math.floor((pos.z || 0) / 2);
    }
    function queryOcclusion(pos, force) {
      var rec = { blocked: false, dist: 0, cached: false, at: 0 };
      if (!pos || typeof pos.x !== "number") return rec;
      var t = now();
      var key = cellKey(pos);
      losCache = losCache || {};
      var hit = losCache[key];
      if (!force && hit && t - hit.at < 700) { hit.cached = true; return hit; }
      // 全局预算：每 0.15s 最多一次射线，避免每发子弹都做 LOS
      if (!force && t - lastLosT < 150) {
        if (hit) { hit.cached = true; return hit; }
        rec.cached = true; rec.skipped = true;
        return rec;
      }
      lastLosT = t;
      var L = listenerNow();
      var blocked = false, dist = 0;
      if (L && G.physics && G.physics.lineOfSight) {
        dist = Math.sqrt(Math.pow(pos.x - L.x, 2) + Math.pow(pos.y - L.y, 2) + Math.pow(pos.z - L.z, 2));
        if (dist > 0.8) {
          try { blocked = !G.physics.lineOfSight({ x: L.x, y: L.y, z: L.z }, { x: pos.x, y: pos.y, z: pos.z }); } catch (e) { blocked = false; }
        }
      }
      rec.blocked = blocked; rec.dist = dist; rec.at = t; rec.cached = false;
      losCache[key] = rec;
      var n = 0;
      for (var k in losCache) n++;
      if (n > 256) losCache = {};
      return rec;
    }
    function occlude(opts) {
      if (!cfg.occlusion || !opts || !opts.pos) return null;
      var rec = queryOcclusion(opts.pos, false);
      if (!rec || !rec.blocked) return null;
      return rec;
    }

    /* ------------------------------------------------------- 包装 play / loop */
    function wrapPlay() {
      if (!G.audio || G.audio.__sx2play) return;
      var orig = G.audio.play;
      if (typeof orig !== "function") return;
      G.audio.__sx2play = true;
      G.audio.play = function (name, opts) {
        opts = opts || {};
        var o = copy(opts);
        var gain = opts.gain != null ? +opts.gain : 1;
        var pitch = opts.pitch != null ? +opts.pitch : 1;
        var cat = category(name);
        o.gain = gain * (cfg[cat] == null ? 1 : +cfg[cat]);
        if (cfg.occlusion && opts.pos) {
          var rec = occlude(opts.pos);
          if (rec) { o.gain *= 0.45; o.pitch = pitch * 0.92; }
        }
        return orig.call(this, name, o);
      };
    }
    function wrapLoop() {
      if (!G.audio || G.audio.__sx2loop) return;
      var orig = G.audio.loop;
      if (typeof orig !== "function") return;
      G.audio.__sx2loop = true;
      G.audio.loop = function (name, opts) {
        opts = opts || {};
        var cat = category(name);
        var o = copy(opts);
        var base = opts.gain != null ? +opts.gain : 1;
        o.gain = base * (cfg[cat] == null ? 1 : +cfg[cat]);
        if (cfg.occlusion && opts.pos) {
          var rec = occlude(opts.pos);
          if (rec) { o.gain *= 0.45; }
        }
        var h = orig.call(this, name, o);
        if (h && typeof h.setGain === "function" && !h.__sx2wrapped) {
          h.__sx2wrapped = true;
          h.__sx2base = base;
          h.__sx2cat = cat;
          h.__sx2set = h.setGain;
          h.setGain = function (v) {
            h.__sx2base = +v || 0;
            return h.__sx2set.call(h, h.__sx2base * (cfg[cat] == null ? 1 : +cfg[cat]));
          };
        }
        /* 句柄用 Set 记录（同名可多个），stop 时移除，bus 变更只影响存活句柄 */
        if (h && typeof h.stop === "function" && !h.__sx2stopWrapped) {
          h.__sx2stopWrapped = true;
          var origStop = h.stop;
          h.stop = function () {
            try { loops.delete(h); } catch (e) {}
            stats.loopStops++;
            return origStop.apply(this, arguments);
          };
        }
        if (h && h.alive !== false) loops.add(h);
        return h;
      };
    }

    /* ------------------------------------------------------- 分层枪声 */
    var WEAPON_LAYER = {
      pac9: { body: 0.6, crack: 1.75, bodyGain: 0.5, crackGain: 0.22 },
      breaker12: { body: 0.5, crack: 1.5, bodyGain: 0.7, crackGain: 0.16 },
      dmr: { body: 0.7, crack: 2.0, bodyGain: 0.55, crackGain: 0.26 },
      gull: { body: 1.1, crack: 1.9, bodyGain: 0.42, crackGain: 0.2 },
      hound: { body: 0.78, crack: 1.7, bodyGain: 0.55, crackGain: 0.22 }
    };
    function distToListener(pos) {
      var L = listenerNow();
      if (!L || !pos) return 0;
      return Math.sqrt(Math.pow(pos.x - L.x, 2) + Math.pow(pos.y - L.y, 2) + Math.pow(pos.z - L.z, 2));
    }
    function layeredShot(ev) {
      if (!cfg.layers || !G || !G.audio || !G.audio.play) return;
      ev = ev || {};
      var pos = ev.muzzle || ev.origin || ev.pos || null;
      var d = pos ? distToListener(pos) : 0;
      var radius = +ev.radius || 45;
      if (d > radius) return;
      var id = ev.weapon || ev.type || "pac9";
      var W = WEAPON_LAYER[id] || WEAPON_LAYER.pac9;
      var near = clamp(1 - d / radius, 0, 1);
      var layers = 0;
      // 低频 body
      try {
        G.audio.play("rifle_shot", {
          gain: W.bodyGain * (0.45 + 0.55 * near), pitch: W.body, jitter: 0.02,
          pos: pos || undefined, variant: 1
        });
        layers++;
      } catch (e) {}
      // 高频 crack：>30m 只保留低频
      if (d <= 30) {
        try {
          G.audio.play("rifle_shot", {
            gain: W.crackGain * (0.55 + 0.45 * near), pitch: W.crack, jitter: 0.04,
            pos: pos || undefined, variant: 2
          });
          layers++;
        } catch (e) {}
      } else {
        stats.lowOnly++;
      }
      stats.shots++;
      stats.layers += layers;
      stats.shotsById[id] = (stats.shotsById[id] || 0) + 1;
      stats.last = { weapon: id, dist: +d.toFixed(2), layers: layers, lowOnly: d > 30, radius: radius };
    }

    /* ------------------------------------------------------- 启动阻塞计时 */
    function armInitTiming() {
      var first = 0;
      addEventListener("keydown", function () { if (!first) first = now(); }, true);
      addEventListener("pointerdown", function () { if (!first) first = now(); }, true);
      var tries = 0;
      function check() {
        if (initMeasured || !first) return;
        var ready = false, hasDebug = false;
        try { var dbg = G.audio && G.audio.debug ? G.audio.debug() : null; hasDebug = !!dbg; ready = !!(dbg && dbg.state && dbg.state !== "none"); } catch (e) {}
        if (!ready) {
          // 只在存在 debug 且确实未就绪时重试；最多 20 次，避免 noaudio/无 AudioContext 时 0ms 自递归
          tries++;
          if (hasDebug && tries < 20) setTimeout(check, 8);
          else if (!initMeasured) { initMeasured = true; initMs = Math.max(0, now() - first); }
          return;
        }
        initMeasured = true;
        initMs = Math.max(0, now() - first);
        initT0 = first;
        if (window.__SX_AUDIO2) window.__SX_AUDIO2.init = { firstInputAt: +first.toFixed(2), ms: +initMs.toFixed(2) };
        try { console.log("[audio2] 首次输入初始化 " + initMs.toFixed(1) + "ms"); } catch (e) {}
      }
      addEventListener("keydown", check, false);
      addEventListener("pointerdown", check, false);
    }

    /* ------------------------------------------------------- 设置页 UI */
    function syncAudioUI() {
      var box = document.querySelector("[data-sx2-audio-ui]");
      if (!box) return;
      for (var i = 0; i < 4; i++) {
        var k = ["master", "music", "sfx", "voice"][i];
        var el = box.querySelector('[data-sx2-audio="' + k + '"]');
        if (el) el.value = Math.round(cfg[k] * 100);
      }
      var outs = box.querySelectorAll("[data-sx2-ao]");
      for (var j = 0; j < outs.length; j++) {
        var kk = outs[j].dataset.sx2Ao;
        outs[j].textContent = Math.round(cfg[kk] * 100) + "%";
      }
      var hb = box.querySelector("[data-sx2-hrtf]");
      if (hb) {
        hb.setAttribute("aria-pressed", String(!!cfg.hrtf));
        hb.querySelector("span").textContent = cfg.hrtf ? "开启" : "关闭";
      }
      var ob = box.querySelector("[data-sx2-occ]");
      if (ob) {
        ob.setAttribute("aria-pressed", String(!!cfg.occlusion));
        ob.querySelector("span").textContent = cfg.occlusion ? "开启" : "关闭";
      }
    }
    function injectAudioUI() {
      var pane = document.querySelector('.panel-b[data-pane="settings"]');
      if (!pane || pane.querySelector("[data-sx2-audio-ui]")) return false;
      var wrap = document.createElement("div");
      wrap.setAttribute("data-sx2-audio-ui", "1");
      wrap.innerHTML =
        "<h3>音频</h3>" +
        '<div class="row"><label for="sx2-am">主音量</label><div class="slider"><input id="sx2-am" type="range" min="0" max="100" step="1" data-sx2-audio="master"><output data-sx2-ao="master"></output></div></div>' +
        '<div class="row"><label for="sx2-amm">音乐</label><div class="slider"><input id="sx2-amm" type="range" min="0" max="100" step="1" data-sx2-audio="music"><output data-sx2-ao="music"></output></div></div>' +
        '<div class="row"><label for="sx2-as">音效</label><div class="slider"><input id="sx2-as" type="range" min="0" max="100" step="1" data-sx2-audio="sfx"><output data-sx2-ao="sfx"></output></div></div>' +
        '<div class="row"><label for="sx2-av">语音</label><div class="slider"><input id="sx2-av" type="range" min="0" max="100" step="1" data-sx2-audio="voice"><output data-sx2-ao="voice"></output></div></div>' +
        '<div class="row"><label>空间音频（HRTF）</label><button class="toggle" data-sx2-hrtf aria-pressed="false"><i></i><span>关闭</span></button></div>' +
        '<div class="row"><label>声源遮挡</label><button class="toggle" data-sx2-occ aria-pressed="true"><i></i><span>开启</span></button></div>';
      var volRow = pane.querySelector("#s-vol") ? pane.querySelector("#s-vol").closest(".row") : null;
      if (volRow) { volRow.style.display = "none"; volRow.parentNode.insertBefore(wrap, volRow); }
      else { var note = pane.querySelector(".panel-note"); pane.insertBefore(wrap, note || null); }
      for (var i = 0; i < 4; i++) {
        var k = ["master", "music", "sfx", "voice"][i];
        (function (keyName) {
          var el = wrap.querySelector('[data-sx2-audio="' + keyName + '"]');
          el.addEventListener("input", function () {
            setBus(keyName, (+el.value) / 100);
            try { G.events.emit("ui:click", {}); } catch (e) {}
          });
        })(k);
      }
      wrap.querySelector("[data-sx2-hrtf]").addEventListener("click", function () { setHrtf(!cfg.hrtf); });
      wrap.querySelector("[data-sx2-occ]").addEventListener("click", function () {
        cfg.occlusion = !cfg.occlusion; saveCfg(); syncAudioUI();
      });
      syncAudioUI();
      return true;
    }
    function setHrtf(on) {
      cfg.hrtf = !!on;
      hrtfMode = cfg.hrtf;
      saveCfg();
      applyHrtfAll();
      syncAudioUI();
      return hrtfMode;
    }

    /* ------------------------------------------------------- 初始化 */
    function init(G0) {
      if (started) return;
      G = G0;
      started = true;
      loadCfg();
      patchPanner();
      armInitTiming();
      try {
        audioReady = !!(G.audio && G.audio.debug && G.audio.debug().state && G.audio.debug().state !== "none");
      } catch (e) { audioReady = false; }
      wrapPlay();
      wrapLoop();
      applyMaster();
      syncUnifiedVolume();
      try { hrtfMode = !!cfg.hrtf; if (hrtfMode) applyHrtfAll(); } catch (e) {}
      if (G.events) {
        G.events.on("weapon:fire", layeredShot);
        G.events.on("enemy:fire", layeredShot);
      }
      injectAudioUI();
      var api = {
        version: "V33",
        buses: buses,
        setBus: setBus,
        resetBuses: resetBuses,
        gainFor: gainFor,
        category: category,
        hrtf: setHrtf,
        hrtfOn: function () { return hrtfMode; },
        occlusion: function (on) { cfg.occlusion = !!on; saveCfg(); syncAudioUI(); return cfg.occlusion; },
        probe: function (pos, force) { return queryOcclusion(pos, force !== false); },
        gunshot: function () { return { shots: stats.shots, layers: stats.layers, lowOnly: stats.lowOnly, last: stats.last, byId: copy(stats.shotsById) }; },
        loopStats: function () {
          pruneLoops();
          var live = 0, dead = 0, names = [];
          loops.forEach(function (h) {
            if (!h) return;
            if (h.alive === false) dead++; else live++;
            if (h.name && names.length < 12) names.push(h.name);
          });
          return { size: loops.size, live: live, dead: dead, stops: stats.loopStops, names: names };
        },
        pannerStats: function () {
          prunePanners();
          var n = 0;
          eachPanner(function () { n++; });
          return { tracked: n, cap: PANNER_CAP, weak: typeof WeakRef === "function" };
        },
        layers: function (on) { cfg.layers = !!on; saveCfg(); return cfg.layers; },
        settingsUI: function () { return !!document.querySelector("[data-sx2-audio-ui]"); },
        audio: function () {
          var dbg = null;
          try { dbg = G.audio && G.audio.debug ? G.audio.debug() : null; } catch (e) {}
          return { available: audioReady, ctx: !!(G.audio && G.audio.ctx), state: dbg && dbg.state, bootMs: dbg && dbg.bootMs, genMs: dbg && dbg.genMs, initMs: initMs };
        }
      };
      Object.defineProperty(api, "initMs", { enumerable: true, get: function () { return initMs; } });
      api.init = null;
      window.__SX_AUDIO2 = api;
      console.log("[audio2] V33 音频扩展已加载 · HRTF " + (hrtfMode ? "开" : "关") + " · 遮挡 " + (cfg.occlusion ? "开" : "关"));
    }

    patchPanner();
    function bootWait() {
      var tries = 0;
      var iv = setInterval(function () {
        var G0 = window.__G;
        if (G0 && G0.audio && G0.game && G0.hud && G0.player && G0.physics) {
          clearInterval(iv);
          try { init(G0); } catch (e) { console.error("[audio2] init failed", e); }
        } else if (++tries > 900) { clearInterval(iv); console.error("[audio2] engine not ready"); }
      }, 80);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootWait, { once: true });
    else bootWait();
  })();