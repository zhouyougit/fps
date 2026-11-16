
  /* =====================================================================
     V35 · WP35-8 音乐与声音设计（补齐 WP33-6 未完成部分）
     ---------------------------------------------------------------------
     独立 IIFE：只通过 window.__G / window.__SX_AUDIO2 / window.__SX / MapKit
     事件工作，不修改 ext.js / game.js / ext_audio2.js。
     能力：
       1. 节拍量化状态机：探索 72 / 交火 96 / BOSS 112 / 联机 100 BPM，
          状态切换落在小节线（4 拍，标题 8 拍），BOSS 抢下一拍；
          交叉淡化 0.6–1.2s（见 FADE）。
       2. intensity(0..1)：最近 6s 伤害 + 敌人距离 + 血量 → perc/brass 增益与低通；
          BOSS 三阶段脉冲；脱战 8s 回 ambient。
       3. 每图三层环境声：底噪（bed）+ 事件（events）+ 混响尾（tail），
          全部复用引擎已有音效，按地图变调组合。
       4. 电台质感：底噪 + 咔哒 + 短促合成音节，不同说话人音高；结局低频 drone。
       5. 音乐走 music bus（G.audio.loop("music_*")），环境走 sfx/amb；
          读取 saltline.audio.v1（音量由 __SX_AUDIO2 落到每条 loop 的基线上）。
       6. 按需创建 + 缓存，记录 synthMs；启动不同时合成全部 stem。
     暴露：window.__SX_MUSIC = { state, bpm, beat, intensity, setIntensity, ... }
     ===================================================================== */
  (function () {
    "use strict";
    if (window.__SX_MUSIC) return;

    var VERSION = "V35 · 世界";
    var AUDIO_KEY = "saltline.audio.v1";

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function num(v, d) { v = +v; return isFinite(v) ? v : d; }
    function readJSON(k) {
      try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; }
    }

    /* ------------------------------------------------------------ 速度/网格 */
    /* 状态 → BPM（需求：探索 72 / 交火 96 / BOSS 112 / 联机 100） */
    var BPM = { title: 72, ambient: 72, combat: 96, boss: 112, mp: 100, ending: 60 };
    /* 状态 → 量化网格（拍）。4 拍 = 一小节；标题用 8 拍；BOSS 抢下一拍 */
    var GRID = { title: 8, ambient: 4, combat: 4, boss: 1, mp: 4, ending: 4 };
    /* 状态 → 交叉淡化（秒），全部落在 0.6–1.2s 区间 */
    var FADE = { title: 1.0, ambient: 1.2, combat: 0.9, boss: 0.7, mp: 0.8, ending: 1.2 };

    /* ------------------------------------------------------------ 更新节流 */
    /* 引擎以 60Hz 固定步调用 step；音乐/环境只需要 20Hz 逻辑（50ms 阈值），
       其余调用只累加 dt 后立即返回，避免每步 computeIntensity / for-in / wireAll。 */
    var LOGIC_HZ = 20;
    var LOGIC_DT = 1 / LOGIC_HZ;          /* 0.05s */
    var MAX_LOGIC_DT = 0.2;               /* 单次逻辑最多消费 200ms，避免大 dt 抖动 */
    var AMB_LRU = 3;                      /* 最多保留 3 张图的 bed loop */
    var BED_STOP_DELAY = 1.2;             /* 旧图 bed 淡出后 stop 的延迟（秒） */

    var STEMS = ["drone", "ost", "perc", "brass", "motif"];
    var SOUND = { drone: "music_drone", ost: "music_ost", perc: "music_perc", brass: "music_brass", motif: "music_motif" };

    /* 每状态的分层配器（stem 基础增益；perc/brass 再由 intensity 塑形） */
    var MIX = {
      title:   { drone: 0.085, ost: 0.030, perc: 0.000, brass: 0.000, motif: 0.020 },
      ambient: { drone: 0.070, ost: 0.045, perc: 0.000, brass: 0.000, motif: 0.025 },
      combat:  { drone: 0.060, ost: 0.075, perc: 0.160, brass: 0.060, motif: 0.035 },
      boss:    { drone: 0.070, ost: 0.085, perc: 0.190, brass: 0.115, motif: 0.045 },
      mp:      { drone: 0.050, ost: 0.070, perc: 0.130, brass: 0.040, motif: 0.030 },
      ending:  { drone: 0.120, ost: 0.030, perc: 0.000, brass: 0.000, motif: 0.015 }
    };

    /* ------------------------------------------------------------ 环境声三层 */
    /*
      bed     底噪循环（relay_hum / wind，按地图变调）
      events  随机一次性事件（压缩机排气、船体呻吟、反应堆阀门…）
      tail    取自 bed 的反馈延迟尾（近似分区混响）
    */
    var AMB = {
      harbor: {
        label: "四号泊位", tone: 9000, ambDuck: 1,
        bed: [
          { s: "relay_hum", p: 0.95, g: 0.022 },
          { s: "wind", p: 1.00, g: 0.020 }
        ],
        events: [
          { s: "gull_cry", p: [0.92, 1.08], g: 0.10, d: [12, 26], ref: 30 },
          { s: "halyard", p: [0.90, 1.10], g: 0.15, d: [6, 14], ref: 10 }
        ],
        tail: { t: 0.18, fb: 0.22, lp: 2400, g: 0.18 },
        suppress: []
      },
      depot: {
        label: "冷链仓库", tone: 4200, ambDuck: 1,
        bed: [
          { s: "relay_hum", p: 0.55, g: 0.055 },   /* 压缩机低频嗡鸣 */
          { s: "wind", p: 0.78, g: 0.028 }         /* 冷风机 */
        ],
        events: [
          { s: "foghorn", p: [0.40, 0.48], g: 0.05, d: [16, 30], ref: 34 }, /* 压缩机排气 */
          { s: "container_bang", p: [0.70, 0.86], g: 0.10, d: [6, 16], ref: 12 },
          { s: "shell_bounce", p: [1.70, 2.10], g: 0.05, d: [3, 9], ref: 6 }, /* 冷凝水滴 */
          { s: "impact_metal", p: [0.40, 0.55], g: 0.07, d: [5, 15], ref: 8 }
        ],
        tail: { t: 0.09, fb: 0.35, lp: 1700, g: 0.28 },
        suppress: ["gull_cry", "halyard", "foghorn"]
      },
      ship: {
        label: "外锚地", tone: 7000, ambDuck: 1,
        bed: [
          { s: "wind", p: 0.95, g: 0.060 },        /* 甲板浪涌风 */
          { s: "relay_hum", p: 0.45, g: 0.035 }    /* 船体低频呻吟 */
        ],
        events: [
          { s: "halyard", p: [0.90, 1.06], g: 0.14, d: [5, 14], ref: 10 },
          { s: "container_bang", p: [0.60, 0.76], g: 0.09, d: [8, 20], ref: 14 },
          { s: "foghorn", p: [0.90, 0.96], g: 0.10, d: [25, 60], ref: 80 }
        ],
        tail: { t: 0.22, fb: 0.30, lp: 2200, g: 0.26 },
        suppress: []
      },
      core: {
        label: "核心舱", tone: 3400, ambDuck: 1,
        bed: [
          { s: "relay_hum", p: 0.38, g: 0.080 },   /* 反应堆基频 */
          { s: "wind", p: 0.50, g: 0.026 }         /* 冷却回路 */
        ],
        events: [
          { s: "relay_cut", p: [0.65, 0.80], g: 0.09, d: [4, 12], ref: 8 },
          { s: "impact_metal", p: [0.32, 0.45], g: 0.08, d: [5, 16], ref: 10 },
          { s: "explosion", p: [2.40, 2.80], g: 0.05, d: [15, 30], ref: 55 },
          { s: "telegraph", p: [0.50, 0.62], g: 0.05, d: [4, 12], ref: 6 }
        ],
        tail: { t: 0.12, fb: 0.45, lp: 1400, g: 0.32 },
        suppress: ["gull_cry", "halyard", "foghorn", "container_bang"]
      }
    };

    /* ------------------------------------------------------------ 运行时状态 */
    var G = null, booted = false, tries = 0;

    var S = {
      started: false,
      t: 0, beatPos: 0, bpm: BPM.title, state: "title",
      gameState: "title",
      pending: null, lastSwitch: null, log: [],
      I: 0, target: 0.1, manualTarget: 0, manualUntil: -1,
      combatT: 0, health: 1, nearest: 999, dmg: [],
      boss: false, phase: 0, mp: false,
      map: "", mapT: 0, modeT: 0, attrT: 0, ambT: 0, ambEvT: 6, mixT: 0, crossUntil: 0,
      duck: 1, duckTarget: 1, ambDuck: 1, ambDuckTarget: 1,
      radioUntil: -1, radioDur: 0, radioPitch: 1, radioSpeaker: "", radioLines: 0, hissT: -1,
      pulses: 0, lastPulse: null, nextPulseBeat: 0, pulseSpec: null, forceUntil: -1,
      pulseOn: false, pulseEvery: 0,
      ambLog: [], ambEvents: 0, ended: false,
      settings: { master: 0.8, music: 1, sfx: 1, voice: 1 },
      hyster: 0,
      /* 节流 / 暂停 / 性能计数 */
      acc: 0, stepCalls: 0, logicSteps: 0, skipped: 0, lastLogicDt: 0,
      paused: false, pauseAt: 0, resumeAt: 0, pausedLogic: 0,
      dmgSum: 0, wirePending: 0
    };

    var stems = {};          /* id -> {h,g,fs,wired,target,created} */
    var created = [];        /* 按创建顺序记录（用于懒加载断言） */
    var synth = { total: 0, calls: 0, byName: {}, last: null };
    var amb = { id: "", layers: {}, list: [], builtFor: {}, order: [], evictions: [], evicted: [] };
    var hissHandle = null;
    /* pulseSpec 复用同一个对象：每步只改字段，避免 20Hz 逻辑里持续分配 */
    var PULSE_SPEC = { on: false, every: 0, offbeat: false, accent: 0, phase: -1 };

    function timed(name, fn) {
      var t0 = now();
      var r = fn();
      var ms = now() - t0;
      synth.total += ms; synth.calls++;
      synth.byName[name] = (synth.byName[name] || 0) + ms;
      synth.last = { name: name, ms: +ms.toFixed(3) };
      return r;
    }

    /* ------------------------------------------------------------ 音频图 */
    function audioCtx() {
      try { return (G && G.audio && G.audio.ctx) || null; } catch (e) { return null; }
    }
    function audioLive() {
      var c = audioCtx();
      return !!c && c.state === "running";
    }
    function readSettings() {
      var raw = readJSON(AUDIO_KEY);
      if (raw) {
        S.settings.master = num(raw.master, 0.8);
        S.settings.music = num(raw.music, 1);
        S.settings.sfx = num(raw.sfx, 1);
        S.settings.voice = num(raw.voice, 1);
      }
      return S.settings;
    }
    function musicMuted() { return S.settings.music <= 0.001; }

    /* 每条 stem 的私有链路：src → lowpass → 私有增益 → 引擎 loop 增益（→ music bus） */
    function ensureStem(id) {
      if (stems[id]) return stems[id];
      var s = { id: id, h: null, g: null, fs: null, wired: false, target: 0, created: -1, alive: false };
      stems[id] = s;
      var h = null;
      try {
        h = timed("loop:" + SOUND[id], function () {
          return G.audio.loop(SOUND[id], { gain: 1, fade: 3 });
        });
      } catch (e) { h = null; }
      s.h = h;
      s.created = S.t;
      created.push(id);
      S.wirePending++;
      if (h) {
        s.alive = !!h.alive;
        try { h.setGain(1); } catch (e) {}          /* 基线 1：音量交给 __SX_AUDIO2 的 music bus */
        try { h.setPitch(1); } catch (e) {}
      }
      return s;
    }
    /* 返回 true 表示已处理完（成功布线/永久不可布线），false 表示等 buffer 就绪后重试 */
    function wireStem(s) {
      if (!s || s.wired) return true;
      var c = audioCtx();
      if (!c) return true;                          /* noaudio：没有音频图，别每步重试 */
      if (!s.h) return true;                        /* 创建失败：永久跳过，别每步重试 */
      if (!s.h.alive || !s.h.src) return false;
      try {
        var f = c.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = cutoffFor(s.id); f.Q.value = 0.4;
        var g = c.createGain();
        g.gain.value = 0.00002;
        s.h.src.disconnect();
        s.h.src.connect(f);
        f.connect(g);
        g.connect(s.h.g);
        s.fs = f; s.g = g; s.wired = true;
      } catch (e) { s.wired = true; }
      return true;
    }
    function setStemTarget(s, v, fade) {
      if (!s) return;
      s.target = clamp(v, 0, 1);
      var c = audioCtx();
      if (s.g && c) {
        try {
          s.g.gain.setTargetAtTime(Math.max(0.00002, s.target), c.currentTime, Math.max(0.04, (fade || 0.3) / 3));
        } catch (e) {}
      }
    }
    /* intensity → 低通（perc/brass 最明显；ost 较缓；drone/motif 固定） */
    function cutoffFor(id) {
      var i = S.I;
      if (id === "perc" || id === "brass") return clamp(900 + 15000 * i, 500, 20000);
      if (id === "ost") return clamp(2400 + 12600 * (0.30 + 0.70 * i), 1200, 20000);
      if (id === "motif") return clamp(1600 + 9000 * (0.25 + 0.75 * i), 900, 20000);
      return 1200;
    }
    function applyFilters(fade) {
      var c = audioCtx();
      for (var i = 0; i < STEMS.length; i++) {
        var s = stems[STEMS[i]];
        if (!s || !s.fs || !c) continue;
        try { s.fs.frequency.setTargetAtTime(cutoffFor(s.id), c.currentTime, fade || 0.25); } catch (e) {}
      }
    }
    function gainFor(id) {
      var mix = (MIX[S.state] || MIX.ambient)[id] || 0;
      if (mix <= 0) return 0;
      if (id === "perc") mix *= 0.12 + 0.88 * S.I;
      else if (id === "brass") mix *= 0.04 + 0.96 * Math.pow(S.I, 1.25);
      else if (id === "ost") mix *= 0.82 + 0.18 * S.I;
      else if (id === "drone") mix *= S.state === "ending" ? 1 : 0.85 + 0.15 * S.I;
      return clamp(mix * S.duck, 0, 1);
    }
    function applyMix(fade, reason) {
      for (var i = 0; i < STEMS.length; i++) {
        var id = STEMS[i];
        var s = stems[id];
        if (!s) continue;
        setStemTarget(s, gainFor(id), fade);
      }
      applyFilters(Math.max(0.25, (fade || 0.3) / 2));
      S.crossUntil = S.t + (fade || 0.4);
      S.mixReason = reason || "";
    }
    function ensureStateStems(st) {
      var mix = MIX[st] || MIX.ambient;
      for (var i = 0; i < STEMS.length; i++) {
        var id = STEMS[i];
        if ((mix[id] || 0) >= 0.03) ensureStem(id);
      }
    }

    /* ------------------------------------------------------------ 环境声 */
    function ensureBed(mapId, spec, isFirst) {
      var key = mapId + "|" + spec.s + "|" + spec.p;
      if (amb.layers[key]) return amb.layers[key];
      var L = {
        key: key, map: mapId, spec: spec, first: !!isFirst,
        h: null, g: null, fs: null, tail: null, wired: false, active: false, createdAt: S.t
      };
      amb.layers[key] = L;
      amb.list.push(L);
      S.wirePending++;
      try {
        L.h = timed("amb:" + mapId + ":" + spec.s, function () {
          return G.audio.loop(spec.s, { gain: 1, fade: 4 });
        });
      } catch (e) { L.h = null; }
      if (L.h) {
        try { L.h.setGain(1); } catch (e) {}
        try { L.h.setPitch(spec.p); } catch (e) {}
      }
      return L;
    }
    function wireBed(L) {
      if (!L || L.wired) return true;
      var c = audioCtx();
      if (!c) return true;                          /* noaudio：没有音频图，别每步重试 */
      if (!L.h) return true;                        /* 创建失败：永久跳过，别每步重试 */
      if (!L.h.alive || !L.h.src) return false;
      var def = AMB[L.map] || AMB.harbor;
      try {
        var f = c.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = def.tone; f.Q.value = 0.5;
        var g = c.createGain();
        g.gain.value = 0.00002;
        L.h.src.disconnect();
        L.h.src.connect(f);
        f.connect(g);
        g.connect(L.h.g);
        L.g = g; L.fs = f; L.wired = true;
        /* 混响尾：只给每图第一条 bed 挂一条反馈延迟网络（近似分区混响） */
        if (L.first && def.tail && !L.tail) {
          var T = def.tail;
          var send = c.createGain(); send.gain.value = T.g;
          var dl = c.createDelay(1.0); dl.delayTime.value = T.t;
          var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = T.lp;
          var fb = c.createGain(); fb.gain.value = T.fb;
          var out = c.createGain(); out.gain.value = 1;
          L.h.src.connect(send);
          send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
          lp.connect(out); out.connect(L.h.g);
          L.tail = { send: send, dl: dl, lp: lp, fb: fb, out: out };
        }
      } catch (e) { L.wired = true; }
      return true;
    }
    /* ------------------------------------------------------------ 环境 LRU（最多 3 张图） */
    function layersOfMap(mapId) {
      var n = 0;
      for (var i = 0; i < amb.list.length; i++) if (amb.list[i] && amb.list[i].map === mapId) n++;
      return n;
    }
    function touchAmbMap(mapId) {
      var i = amb.order.indexOf(mapId);
      if (i >= 0) amb.order.splice(i, 1);
      amb.order.push(mapId);
      /* 又切回来了：撤销尚未执行的回收 */
      for (var j = amb.evictions.length - 1; j >= 0; j--) {
        if (amb.evictions[j].map === mapId) amb.evictions.splice(j, 1);
      }
      while (amb.order.length > AMB_LRU) {
        var victim = amb.order.shift();
        if (victim === amb.id) { amb.order.push(victim); break; }
        scheduleEvict(victim);
      }
    }
    function scheduleEvict(mapId) {
      if (!mapId || mapId === amb.id) return;
      for (var i = 0; i < amb.evictions.length; i++) if (amb.evictions[i].map === mapId) return;
      var n = layersOfMap(mapId);
      if (!n) return;
      amb.evictions.push({ map: mapId, at: S.t + BED_STOP_DELAY, layers: n });
    }
    function processEvictions() {
      if (!amb.evictions.length) return;
      for (var i = amb.evictions.length - 1; i >= 0; i--) {
        var e = amb.evictions[i];
        if (S.t + 1e-9 < e.at) continue;
        amb.evictions.splice(i, 1);
        evictMap(e.map);
      }
    }
    function evictMap(mapId) {
      if (!mapId || mapId === amb.id) return;
      var keys = [], stopped = 0;
      for (var i = amb.list.length - 1; i >= 0; i--) {
        var L = amb.list[i];
        if (!L || L.map !== mapId) continue;
        keys.push(L.key);
        try { if (L.h && typeof L.h.stop === "function") { L.h.stop(0.5); stopped++; } } catch (e) {}
        L.active = false;
        if (amb.layers[L.key] === L) delete amb.layers[L.key];
        amb.list.splice(i, 1);
      }
      delete amb.builtFor[mapId];
      if (!keys.length) return;
      amb.evicted.push({ map: mapId, keys: keys, stopped: stopped, t: +S.t.toFixed(2) });
      if (amb.evicted.length > 12) amb.evicted.shift();
    }
    function ensureAmbience(mapId) {
      var def = AMB[mapId] ? AMB[mapId] : AMB.harbor;
      amb.id = mapId;
      amb.def = def;
      amb.builtFor[mapId] = true;
      for (var i = 0; i < def.bed.length; i++) ensureBed(mapId, def.bed[i], i === 0);
      touchAmbMap(mapId);
      applyAmbience(0.9);
      S.ambEvT = 4 + Math.random() * 6;
    }
    function applyAmbience(fade) {
      var def = amb.def || AMB[amb.id] || AMB.harbor;
      var c = audioCtx();
      for (var i = 0; i < amb.list.length; i++) {
        var L = amb.list[i];
        if (!L) continue;
        var on = L.map === amb.id;
        var target = on ? (L.spec.g * S.ambDuck) : 0;
        if (L.g && c) {
          try { L.g.gain.setTargetAtTime(Math.max(0.00002, target), c.currentTime, Math.max(0.05, (fade || 0.9) / 3)); } catch (e) {}
        }
        L.active = on;
      }
      return def;
    }
    function ambienceLayersDebug() {
      var out = [];
      for (var li = 0; li < amb.list.length; li++) {
        var L = amb.list[li];
        if (!L) continue;
        out.push({
          key: L.key, map: L.map, source: L.spec.s, pitch: L.spec.p,
          gain: +(L.spec.g * (L.active ? S.ambDuck : 0)).toFixed(4), active: !!L.active,
          wired: !!L.wired,
          tail: L.tail
            ? { delay: L.tail.dl.delayTime.value, fb: L.tail.fb.gain.value, lp: L.tail.lp.frequency.value }
            : (L.first && (AMB[L.map] || AMB.harbor).tail
                ? { configured: true, delay: (AMB[L.map] || AMB.harbor).tail.t, fb: (AMB[L.map] || AMB.harbor).tail.fb, lp: (AMB[L.map] || AMB.harbor).tail.lp }
                : null)
        });
      }
      return out;
    }
    function fireAmbEvent(spec) {
      if (!G || !G.audio || !G.audio.play) return;
      if (G.game && (G.game.state === "paused" || G.game.state === "dead")) return;
      var P = G.player;
      var base = P && P.pos ? P.pos : (G.camera ? G.camera.position : null);
      var d = spec.d ? spec.d[0] + Math.random() * (spec.d[1] - spec.d[0]) : 10;
      var ang = Math.random() * Math.PI * 2;
      var pos = base ? { x: base.x + Math.cos(ang) * d, y: base.y + 0.5 + Math.random() * 2.2, z: base.z + Math.sin(ang) * d } : undefined;
      var pitch = spec.p ? spec.p[0] + Math.random() * (spec.p[1] - spec.p[0]) : 1;
      try {
        G.audio.play(spec.s, {
          pos: pos, gain: spec.g * (0.8 + Math.random() * 0.4), pitch: pitch,
          jitter: 0.05, ref: spec.ref || 8, __sxM: 1
        });
        S.ambEvents++;
      } catch (e) {}
    }

    /* ------------------------------------------------------------ 节拍量化状态机 */
    function request(next, opts) {
      if (!next || BPM[next] == null) return null;
      opts = opts || {};
      var immediate = !!opts.immediate;
      if (S.pending && S.pending.state === next && !immediate) return "pending";
      if (!immediate && next === S.state) return "same";
      var grid = GRID[next] || 4;
      var atBeat;
      if (immediate) atBeat = S.beatPos;
      else atBeat = (Math.floor((S.beatPos + 1e-6) / grid) + 1) * grid;
      if (opts.hold != null) S.forceUntil = S.t + Math.max(0, +opts.hold || 0);
      S.pending = {
        state: next, atBeat: atBeat, fade: FADE[next] || 0.9, from: S.state,
        reqT: S.t, reqBeat: S.beatPos, immediate: immediate, reason: opts.reason || "auto"
      };
      ensureStateStems(next);
      if (immediate) commit();
      return "scheduled";
    }
    function commit() {
      var p = S.pending;
      if (!p) return null;
      if (!p.immediate && S.beatPos + 1e-9 < p.atBeat) return null;
      S.pending = null;
      var from = S.state, prevBpm = S.bpm;
      S.state = p.state;
      S.bpm = BPM[p.state];
      var entry = {
        from: from, to: p.state,
        atBeat: +p.atBeat.toFixed(4), beatNow: +S.beatPos.toFixed(4),
        grid: GRID[p.state] || 4, fade: p.fade, bpm: S.bpm, prevBpm: prevBpm,
        t: +S.t.toFixed(3), reqBeat: +p.reqBeat.toFixed(4),
        waitBeats: +(p.atBeat - p.reqBeat).toFixed(4),
        lag: +(S.beatPos - p.atBeat).toFixed(4),
        immediate: !!p.immediate, reason: p.reason
      };
      S.log.push(entry);
      if (S.log.length > 80) S.log.shift();
      S.lastSwitch = entry;
      if (from === "ending") resetEnding();
      applyMix(p.fade, "switch:" + p.state);
      ensureStateStems(S.state);
      enterState(p.state, from);
      resetPulses();
      return entry;
    }
    function enterState(st, from) {
      if (st === "ending") {
        S.ended = true;
        var d = stems.drone;
        if (d) { try { d.h.setPitch(0.62); } catch (e) {} }
        try {
          G.audio.play("foghorn", { gain: 0.16, pitch: 0.32, delay: 0.05, jitter: 0, __sxM: 1 });
        } catch (e) {}
      }
    }
    function resetEnding() {
      S.ended = false;
      var d = stems.drone;
      if (d) { try { d.h.setPitch(1); } catch (e) {} }
    }
    function desiredState() {
      if (G.game && G.game.state === "complete") return "ending";
      if (S.boss) return "boss";
      if (S.mp) return "mp";
      if (S.gameState === "title" || S.gameState === "intro") return "title";
      if (S.gameState === "paused" || S.gameState === "dead") return S.state;
      if (S.combatT > 0) return "combat";
      return "ambient";
    }
    function autoMode(dt) {
      S.modeT -= dt;
      if (S.modeT > 0) return;
      S.modeT = 0.25;
      if (S.t < S.forceUntil) { pollMp(); pollMap(); return; }
      var want = desiredState();
      if (want !== S.state) request(want, { reason: "director" });
      pollMp();
      pollMap();
    }
    function pollMp() {
      var on = false;
      try { on = !!(window.__MP && window.__MP.state && window.__MP.state().active); } catch (e) { on = false; }
      S.mp = on;
    }
    function pollMap() {
      var id = currentMap();
      if (id && id !== S.map) switchMap(id);
    }
    function currentMap() {
      var id = "";
      try { if (window.__SX && window.__SX.mapId) id = window.__SX.mapId(); } catch (e) {}
      if (!id) { try { var m = G.game.currentMission; if (m && m.map) id = m.map; } catch (e) {} }
      return id || S.map || "harbor";
    }
    function switchMap(id) {
      if (!id || id === S.map) return;
      var prev = S.map;
      S.map = id;
      ensureAmbience(id);
      S.ambLog.push({ from: prev, to: id, label: (AMB[id] || AMB.harbor).label, t: +S.t.toFixed(2) });
      if (S.ambLog.length > 24) S.ambLog.shift();
    }
    /* map:loaded：切图时建新图层；同图重载时补回被 LRU 回收的床层 */
    function onMapLoaded(id) {
      if (!id) return;
      if (id !== S.map) { switchMap(id); return; }
      ensureAmbience(id);
    }

    /* ------------------------------------------------------------ 强度 */
    /* 滚动和：入队/出队时增量维护，避免每个逻辑步对 160 条记录全量求和 */
    function pushDamage(amount) {
      var a = Math.max(0, num(amount, 1));
      S.dmg.push({ t: S.t, a: a });
      S.dmgSum += a;
      while (S.dmg.length > 160) S.dmgSum -= S.dmg.shift().a;
      if (S.dmgSum < 0) S.dmgSum = 0;
    }
    function pruneDamage() {
      while (S.dmg.length && S.dmg[0].t < S.t - 6) S.dmgSum -= S.dmg.shift().a;
      if (S.dmgSum < 0) S.dmgSum = 0;
    }
    function dmgTotal() {
      return S.dmgSum;
    }
    function sampleWorld() {
      var P = G.player;
      if (!P) return;
      try {
        S.health = P.maxHealth ? clamp(P.health / P.maxHealth, 0, 1) : 1;
      } catch (e) { S.health = 1; }
      var pos = P.pos || (G.camera && G.camera.position);
      var best = 999;
      try {
        var list = G.enemies && G.enemies.list;
        if (list && pos) {
          var n = Math.min(list.length, 64);
          for (var i = 0; i < n; i++) {
            var e = list[i];
            if (!e || e.alive === false || !e.pos) continue;
            var dx = e.pos.x - pos.x, dy = (e.pos.y || 0) - (pos.y || 0), dz = e.pos.z - pos.z;
            var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < best) best = d;
          }
        }
      } catch (e) { best = 999; }
      S.nearest = best;
    }
    function computeIntensity(dt) {
      var tgt;
      if (S.gameState === "dead") tgt = 0.10;
      else if (S.gameState === "complete") tgt = 0.06;
      else {
        var dmgN = clamp(dmgTotal() / 45, 0, 1);
        var prox = clamp(1 - (S.nearest - 4) / 26, 0, 1);
        var hpN = clamp(1 - S.health, 0, 1);
        tgt = 0.50 * dmgN + 0.32 * prox + 0.18 * hpN;
        if (S.state === "combat") tgt = Math.max(tgt, 0.35);
        if (S.state === "boss") tgt = Math.max(tgt, 0.45 + 0.15 * S.phase);
        if (S.state === "ambient") tgt = Math.min(tgt, 0.28);
        if (S.state === "title") tgt = Math.min(tgt, 0.12);
        if (S.state === "ending") tgt = 0.08;
      }
      if (S.manualUntil > S.t) tgt = S.manualTarget;
      S.target = clamp(tgt, 0, 1);
      var tau = S.target > S.I ? 0.45 : 0.8;
      S.I += (S.target - S.I) * (1 - Math.exp(-dt / tau));
      S.I = clamp(S.I, 0, 1);
      S.attrT -= dt;
      if (S.attrT <= 0) { S.attrT = 0.2; sampleWorld(); }
      updateDuck();
    }
    /* 电台侧链压低：暂停时唯一保留的音频逻辑（外加它触发的 applyMix） */
    function updateDuck() {
      if (S.t < S.radioUntil) { S.duckTarget = 0.5; S.ambDuckTarget = 0.63; }
      else { S.duckTarget = 1; S.ambDuckTarget = 1; }
      if (Math.abs(S.duckTarget - S.duck) > 1e-3) {
        S.duck = S.duckTarget;
        applyMix(0.25, "duck");
      }
      if (Math.abs(S.ambDuckTarget - S.ambDuck) > 1e-3) {
        S.ambDuck = S.ambDuckTarget;
        applyAmbience(0.4);
      }
    }
    function intensityTick() {
      if (S.t < S.crossUntil) { applyFilters(0.3); return; }
      for (var i = 0; i < STEMS.length; i++) {
        var id = STEMS[i];
        var s = stems[id];
        if (!s) continue;
        setStemTarget(s, gainFor(id), 0.35);
      }
      applyFilters(0.3);
    }

    /* ------------------------------------------------------------ BOSS 三阶段脉冲 */
    function resetPulses() {
      var spec = pulseSpec();
      S.pulseSpec = spec;
      S.pulseOn = spec.on;
      S.pulseEvery = spec.every;
      S.nextPulseBeat = spec.on ? Math.ceil((S.beatPos + 1e-4) / spec.every) * spec.every : 0;
    }
    /* 复用同一个对象：20Hz 逻辑里不再每步 new 一个 spec */
    function pulseSpec() {
      var s = PULSE_SPEC;
      if (S.state === "boss") {
        s.on = true; s.every = S.phase >= 2 ? 0.5 : 1; s.offbeat = S.phase >= 2;
        s.accent = 1 + 0.12 * S.phase; s.phase = S.phase;
        return s;
      }
      if (S.state === "combat") {
        s.on = S.I > 0.25; s.every = 2; s.offbeat = false; s.accent = 0.85; s.phase = -1;
        return s;
      }
      if (S.state === "mp") {
        s.on = S.I > 0.20; s.every = 2; s.offbeat = false; s.accent = 0.75; s.phase = -1;
        return s;
      }
      s.on = false; s.every = 0; s.offbeat = false; s.accent = 0; s.phase = -1;
      return s;
    }
    function stepPulses() {
      var spec = pulseSpec();
      var changed = !S.pulseOn || S.pulseEvery !== spec.every;
      S.pulseOn = spec.on;
      S.pulseEvery = spec.every;
      S.pulseSpec = spec;
      if (!spec.on) return;
      if (changed) {
        S.nextPulseBeat = Math.ceil((S.beatPos + 1e-4) / spec.every) * spec.every;
        return;
      }
      if (!stems.perc) ensureStem("perc");
      var horizon = 0.12 * S.bpm / 60;
      var guard = 0;
      while (S.nextPulseBeat <= S.beatPos + horizon && guard++ < 64) {
        var b = S.nextPulseBeat;
        firePulse(b, spec);
        S.nextPulseBeat += spec.every;
      }
    }
    function firePulse(b, spec) {
      var accent = spec.accent * (Math.abs(b % 4) < 1e-6 ? 1.25 : 1);
      S.pulses++;
      S.lastPulse = { beat: +b.toFixed(3), t: +S.t.toFixed(3), phase: spec.phase, accent: +accent.toFixed(2), offbeat: !!spec.offbeat };
      if (!audioLive() || musicMuted()) return;
      var perc = stems.perc;
      var dest = perc && (perc.fs || perc.g);
      if (!dest) return;
      var c = audioCtx();
      var when = c.currentTime + Math.max(0, (b - S.beatPos) * (60 / S.bpm));
      if (when < c.currentTime) when = c.currentTime + 0.005;
      try {
        var o = c.createOscillator(), g = c.createGain();
        o.type = "sine";
        var f0 = spec.offbeat ? 210 : 140, f1 = spec.offbeat ? 90 : 42, dur = spec.offbeat ? 0.11 : 0.30;
        o.frequency.setValueAtTime(f0, when);
        o.frequency.exponentialRampToValueAtTime(f1, when + dur * 0.6);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.20 * accent, when + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g); g.connect(dest);
        o.start(when); o.stop(when + dur + 0.02);
        o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) {} };
      } catch (e) {}
    }

    /* ------------------------------------------------------------ 电台质感 */
    var VOICE = { "指挥中心": 0.94, "舵手": 1.10, "小队频道": 1.02, "蜃": 0.72 };
    function speakerPitch(name) {
      if (VOICE[name] != null) return VOICE[name];
      var h = 0;
      for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
      return 0.90 + (Math.abs(h) % 21) / 100;
    }
    function readSpeaker() {
      try {
        var el = document.querySelector(".comms-who");
        var s = el && el.textContent ? String(el.textContent).trim() : "";
        return s || "指挥中心";
      } catch (e) { return "指挥中心"; }
    }
    function radioHiss(pitch) {
      if (!hissHandle) {
        try {
          hissHandle = timed("loop:radio_hiss", function () {
            return G.audio.loop("rain_interior", { gain: 0, fade: 3 });
          });
          if (hissHandle) hissHandle.setGain(0);
        } catch (e) { hissHandle = null; }
      }
      if (hissHandle) {
        try { hissHandle.setPitch(2.0 * pitch); hissHandle.setGain(0.05); } catch (e) {}
        S.hissT = S.t + Math.min(2.4, S.radioDur);
      }
    }
    function radioLine(text, secs) {
      if (!G || !G.audio || !G.audio.play) return null;
      var speaker = readSpeaker();
      var pitch = speakerPitch(speaker);
      var dur = num(secs, 0) || (0.9 + String(text || "").length * 0.055);
      dur = clamp(dur, 1.0, 5.0);
      S.radioSpeaker = speaker;
      S.radioPitch = pitch;
      S.radioDur = dur;
      S.radioUntil = S.t + dur;
      S.radioLines++;
      /* 底噪 + 开/关咔哒 */
      try {
        G.audio.play("whiz", { gain: 0.045, pitch: 3.2 * pitch, delay: 0.01, jitter: 0.02, __sxM: 1 });
        G.audio.play("whiz", { gain: 0.030, pitch: 2.6, delay: Math.max(0.2, dur - 0.22), jitter: 0.03, __sxM: 1 });
        G.audio.play("ui_click", { gain: 0.045, pitch: 1.85, delay: 0.005, jitter: 0.01, __sxM: 1 });
      } catch (e) {}
      /* 短促合成音节：按说话人音高逐字打点，不生成真实语音 */
      var n = clamp(Math.round(dur / 0.14), 4, 12);
      var step = dur / n;
      var names = ["ui_click", "ui_hover"];
      for (var i = 0; i < n; i++) {
        var at = 0.07 + i * step * (0.85 + Math.random() * 0.3);
        var p = pitch * (0.86 + Math.random() * 0.28);
        try {
          G.audio.play(names[i % 2], {
            gain: 0.045 + Math.random() * 0.03, pitch: p, delay: at, jitter: 0.012, __sxM: 1
          });
        } catch (e) {}
      }
      radioHiss(pitch);
      return { speaker: speaker, pitch: pitch, dur: dur };
    }

    /* ------------------------------------------------------------ 世界采样/事件 */
    function step(dt) {
      if (!booted) return;
      S.started = true;
      S.stepCalls++;
      dt = clamp(num(dt, 0), 0, 0.25);
      S.t += dt;
      S.gameState = (G.game && G.game.state) || S.gameState;

      /* 暂停：冻结 beatPos / 环境事件 / 脉冲，只保留 duck + applyMix（恢复不补拍） */
      if (G.game && G.game.state === "paused") {
        if (!S.paused) {
          S.paused = true;
          S.pauseAt = S.t;
          S.pauseBeat = S.beatPos;
          S.acc = 0;
        }
        S.skipped++;
        updateDuck();
        updateHiss();
        return;
      }
      if (S.paused) {
        S.paused = false;
        S.resumeAt = S.t;
        S.acc = 0;                       /* 恢复不补拍：暂停期间的时间不进入节拍 */
      }

      S.acc += dt;
      if (S.acc + 1e-9 < LOGIC_DT) { S.skipped++; return; }
      /* 20Hz 逻辑：一次消费累积时间（上限 200ms），避免低频帧无限堆积 */
      var ldt = Math.min(S.acc, MAX_LOGIC_DT);
      S.acc = 0;
      S.logicSteps++;
      S.lastLogicDt = ldt;
      logicStep(ldt);
    }
    function logicStep(dt) {
      S.beatPos += dt * S.bpm / 60;
      if (S.combatT > 0) S.combatT = Math.max(0, S.combatT - dt);
      pruneDamage();
      computeIntensity(dt);
      if (S.t - S.mixT > 0.1) { S.mixT = S.t; intensityTick(); }
      autoMode(dt);
      commit();
      stepPulses();
      ambienceStep(dt);
      processEvictions();
      updateHiss();
      wireAll();
    }
    function wireAll() {
      if (S.wirePending <= 0) return;      /* 没有新节点时零成本返回 */
      var remain = 0;
      for (var i = 0; i < STEMS.length; i++) {
        if (!wireStem(stems[STEMS[i]])) remain++;
      }
      for (var j = 0; j < amb.list.length; j++) {
        if (!wireBed(amb.list[j])) remain++;
      }
      S.wirePending = remain;
    }
    function updateHiss() {
      if (hissHandle && S.hissT > 0 && S.t > S.hissT) {
        S.hissT = -1;
        try { hissHandle.setGain(0); } catch (e) {}
      }
    }
    function ambienceStep(dt) {
      if (!amb.builtFor[S.map]) ensureAmbience(S.map);
      S.ambT -= dt;
      if (S.ambT > 0) return;
      S.ambT = 0.5;
      applyAmbience(0.9);
      var def = AMB[S.map] || AMB.harbor;
      S.ambEvT -= 0.5;
      if (S.ambEvT <= 0) {
        S.ambEvT = 8 + Math.random() * 12;
        var evs = def.events || [];
        if (evs.length) fireAmbEvent(evs[(Math.random() * evs.length) | 0]);
      }
    }

    /* ------------------------------------------------------------ 事件绑定 */
    function onThreat(ev) {
      S.combatT = Math.max(S.combatT, 8);
      return ev;
    }
    function bind() {
      var E = G.events;
      E.on("weapon:fire", function () { onThreat(); pushDamage(0.25); });
      E.on("enemy:fire", function () { onThreat(); pushDamage(0.6); });
      E.on("player:hit", function (ev) { onThreat(); pushDamage(ev && ev.amount != null ? +ev.amount : 10); });
      E.on("player:hitEnemy", function (ev) { pushDamage(ev && ev.killed ? 3 : 0.7); });
      E.on("enemy:hit", function () { pushDamage(0.4); });
      E.on("enemy:killed", function () { pushDamage(1.2); });
      E.on("enemy:alert", function () { onThreat(); });
      E.on("enemy:telegraph", function () { onThreat(); });
      E.on("explosion", function () { onThreat(); pushDamage(2); });
      E.on("sx:boss-start", function () {
        S.boss = true; S.phase = 0;
        request("boss", { reason: "boss-start" });
      });
      E.on("sx:boss-phase", function (ev) {
        S.boss = true;
        S.phase = ev && ev.phase != null ? (+ev.phase | 0) : S.phase;
        request("boss", { reason: "boss-phase" });
        resetPulses();
      });
      E.on("sx:boss-dead", function () {
        S.boss = false; S.phase = 0;
        request(S.combatT > 0 ? "combat" : "ambient", { reason: "boss-dead" });
      });
      E.on("game:state", function (ev) {
        if (!ev) return;
        S.gameState = ev.state || S.gameState;
        if (ev.state === "title" || ev.state === "intro") {
          S.boss = false; S.phase = 0; S.combatT = 0;
          request("title", { reason: "state" });
        } else if (ev.state === "playing") {
          if (!S.started) ensureStateStems(S.state);
          request(desiredState(), { reason: "state" });
        } else if (ev.state === "complete") {
          request("ending", { reason: "complete", immediate: true });
        }
      });
      E.on("map:loaded", function (ev) { if (ev && ev.id) onMapLoaded(ev.id); });
    }

    /* 环境事件：屏蔽与地图不符的旧港区随机声（引擎 Os() 不分地图） */
    function gatePlay() {
      if (!G.audio || G.audio.__sxMgate) return;
      var orig = G.audio.play;
      if (typeof orig !== "function") return;
      G.audio.__sxMgate = true;
      G.audio.play = function (name, opts) {
        try {
          var def = AMB[S.map] || AMB.harbor;
          if (!(opts && opts.__sxM) && def.suppress && def.suppress.indexOf(name) >= 0) return false;
        } catch (e) {}
        return orig.apply(this, arguments);
      };
    }
    function wrapRadio() {
      if (!G.hud || !G.hud.radio || G.hud.__sxMradio) return;
      var orig = G.hud.radio;
      G.hud.radio = function (text, secs) {
        try { radioLine(text, secs); } catch (e) { console.error("[music] radio", e); }
        return orig.apply(G.hud, arguments);
      };
      G.hud.__sxMradio = true;
    }

    /* ------------------------------------------------------------ boot / API */
    function boot() {
      if (booted) return;
      booted = true;
      S.gameState = (G.game && G.game.state) || "title";
      S.state = S.gameState === "playing" ? "ambient" : "title";
      S.bpm = BPM[S.state];
      readSettings();
      S.map = "";
      var first = currentMap();
      S.map = first;
      ensureAmbience(first);
      ensureStateStems(S.state);
      wrapRadio();
      gatePlay();
      bind();
      applyAmbience(0.9);
      applyMix(0.8, "boot");
      hookUpdate();
      console.log("[music] V35 分层音乐已加载 · " + S.state + " " + S.bpm + "bpm · map " + first);
    }
    function hookUpdate() {
      if (!G.game || G.game.__sxMhooked) return;
      var base = G.game.update;
      G.game.update = function (dt) {
        var r;
        try {
          r = base.apply(this, arguments);
        } finally {
          try { step(dt); } catch (e) { console.error("[music] step", e); }
        }
        return r;
      };
      G.game.__sxMhooked = true;
    }

    function debug() {
      var st = {};
      for (var i = 0; i < STEMS.length; i++) {
        var id = STEMS[i], s = stems[id];
        if (!s) { st[id] = null; continue; }
        st[id] = {
          created: +s.created.toFixed(2), target: +(+s.target).toFixed(4),
          wired: !!s.wired, alive: !!s.alive,
          gain: s.g ? +s.g.gain.value.toFixed(4) : 0,
          cutoff: s.fs ? Math.round(s.fs.frequency.value) : null
        };
      }
      return {
        version: VERSION,
        state: S.state, bpm: S.bpm,
        beat: Math.floor(S.beatPos), beatFloat: +S.beatPos.toFixed(3),
        bar: Math.floor(S.beatPos / 4) + 1, beatInBar: +(S.beatPos % 4).toFixed(3),
        intensity: +S.I.toFixed(3), targetIntensity: +S.target.toFixed(3),
        pending: S.pending ? { state: S.pending.state, atBeat: +S.pending.atBeat.toFixed(3), fade: S.pending.fade, reqBeat: +S.pending.reqBeat.toFixed(3) } : null,
        lastSwitch: S.lastSwitch, log: S.log.slice(-10),
        stems: st, created: created.slice(), mixReason: S.mixReason || "",
        lowpass: { perc: cutoffFor("perc"), brass: cutoffFor("brass"), ost: cutoffFor("ost") },
        boss: { on: S.boss, phase: S.phase, pulse: S.pulseSpec },
        nearest: +(+S.nearest).toFixed(2), health: +S.health.toFixed(3), combatT: +S.combatT.toFixed(2),
        forceUntil: +S.forceUntil.toFixed(2),
        pulses: S.pulses, lastPulse: S.lastPulse,
        ambience: {
          map: S.map, label: (AMB[S.map] || AMB.harbor).label,
          layers: ambienceLayersDebug(), events: S.ambEvents, eventCount: S.ambEvents,
          layerCount: amb.list.length, lru: amb.order.slice(),
          evicted: amb.evicted.slice(-6),
          pendingEvictions: amb.evictions.map(function (e) { return { map: e.map, at: +e.at.toFixed(2), layers: e.layers }; }),
          tail: (AMB[S.map] || AMB.harbor).tail, log: S.ambLog.slice(-6),
          suppress: (AMB[S.map] || AMB.harbor).suppress,
          roles: (function () {
            var d = AMB[S.map] || AMB.harbor;
            return {
              bed: d.bed.length, events: d.events.length, tail: !!d.tail,
              bedSpec: d.bed.map(function (b) { return { s: b.s, p: b.p, g: b.g }; }),
              eventSpec: d.events.map(function (e) { return e.s; })
            };
          })()
        },
        radio: {
          speaker: S.radioSpeaker, pitch: +S.radioPitch.toFixed(3),
          lines: S.radioLines, until: +S.radioUntil.toFixed(2), speaking: S.t < S.radioUntil,
          duck: S.duck
        },
        ending: { active: S.state === "ending", droneTarget: +gainFor("drone").toFixed(4), dronePitch: S.ended ? 0.62 : 1 },
        settings: { master: S.settings.master, music: S.settings.music, sfx: S.settings.sfx, voice: S.settings.voice },
        synthMs: { total: +synth.total.toFixed(2), calls: synth.calls, byName: synth.byName, last: synth.last },
        audio: (function () { try { return G.audio.debug(); } catch (e) { return null; } })(),
        crossUntil: +S.crossUntil.toFixed(2),
        perf: {
          hz: LOGIC_HZ, stepCalls: S.stepCalls, logicSteps: S.logicSteps,
          skipped: S.skipped, lastLogicDt: +S.lastLogicDt.toFixed(4),
          paused: S.paused, acc: +S.acc.toFixed(4),
          pauseAt: +S.pauseAt.toFixed(2), resumeAt: +S.resumeAt.toFixed(2)
        },
        t: +S.t.toFixed(2), startBeat: +S.beatPos.toFixed(3)
      };
    }

    var api = {
      version: VERSION,
      get state() { return S.state; },
      get bpm() { return S.bpm; },
      get beat() { return Math.floor(S.beatPos); },
      get intensity() { return +S.I.toFixed(3); },
      setIntensity: function (v, hold) {
        var h = hold == null ? 6 : Math.max(0, +hold || 0);
        S.manualTarget = clamp(+v || 0, 0, 1);
        S.manualUntil = S.t + h;
        if (h === 0) { S.I = S.manualTarget; }
        return +S.I.toFixed(3);
      },
      request: function (next, opts) { return request(next, opts); },
      setBoss: function (on) {
        S.boss = !!on;
        if (!on) S.phase = 0;
        return request(S.boss ? "boss" : (S.combatT > 0 ? "combat" : "ambient"), { reason: "api" });
      },
      begin: function () {
        if (!booted) return false;
        try { if (G.audio && G.audio.resume) G.audio.resume(); } catch (e) {}
        ensureStateStems(S.state);
        applyMix(0.8, "begin");
        return true;
      },
      settings: function () { return { master: S.settings.master, music: S.settings.music, sfx: S.settings.sfx, voice: S.settings.voice }; },
      reloadSettings: function () { readSettings(); if (musicMuted()) { /* 静音时不再调度脉冲 */ } return api.settings(); },
      debug: debug,
      snapshot: function () {
        return {
          state: S.state, bpm: S.bpm, beat: Math.floor(S.beatPos), beatFloat: +S.beatPos.toFixed(3),
          bar: Math.floor(S.beatPos / 4) + 1, intensity: +S.I.toFixed(3), map: S.map,
          boss: S.boss, phase: S.phase, pulses: S.pulses, pending: !!S.pending,
          paused: S.paused, logicSteps: S.logicSteps
        };
      },
      tick: function (sec) {
        var n = Math.max(1, Math.min(20000, Math.round((+sec || 0) * 60)));
        for (var i = 0; i < n; i++) step(1 / 60);
        return api.snapshot();
      }
    };
    window.__SX_MUSIC = api;

    function wait() {
      var iv = setInterval(function () {
        var G0 = window.__G;
        if (G0 && G0.game && G0.audio && G0.events && G0.player && G0.enemies) {
          clearInterval(iv);
          G = G0;
          try { boot(); } catch (e) { console.error("[music] boot", e); }
        } else if (++tries > 900) {
          clearInterval(iv);
          console.error("[music] engine not ready");
        }
      }, 80);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
    else wait();
  })();