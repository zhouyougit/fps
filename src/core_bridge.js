/* =====================================================================
   SALTLINE · core_bridge.js — V32 统一存档与旧模块桥接
   旧模块继续读写自己的 saltline.*.v1 键（回退兼容），
   每次保存后把最新值折进 saltline.save（v2）；启动时迁移并镜像。
   ===================================================================== */
(function (root) {
  "use strict";
  var SX = root.SXSave;
  var inited = false;

  function safe(fn, fallback) {
    try { return fn(); } catch (e) {
      try { if (root.SXErrors) root.SXErrors.report(e, { system: "save", phase: "bridge" }); } catch (_) {}
      return fallback;
    }
  }

  function toNum(v, def) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : def;
  }
  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }
  function obj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  var AUDIO_KEY = "saltline.audio.v1";

  /**
   * V38：audio 2.0 把 music/sfx/voice 持久化在 saltline.audio.v1，
   * 启动时合并进统一存档的 settings.volume，避免两套存档各说各话。
   */
  function mergeAudioTracks() {
    var raw = root.localStorage ? root.localStorage.getItem(AUDIO_KEY) : null;
    if (!raw) return;
    var au;
    try { au = JSON.parse(raw); } catch (e) { return; }
    if (!obj(au)) return;
    var cur = SX.get("settings") || {};
    var v = obj(cur.volume) ? cur.volume : {};
    var merged = {
      master: clamp01(toNum(v.master, 0.9)),
      music: clamp01(toNum(v.music, 0.8)),
      sfx: clamp01(toNum(v.sfx, 1)),
      voice: clamp01(toNum(v.voice, 1))
    };
    var keys = ["music", "sfx", "voice"];
    var any = false;
    for (var i = 0; i < keys.length; i++) {
      var n = toNum(au[keys[i]], NaN);
      if (isFinite(n)) { merged[keys[i]] = clamp01(n); any = true; }
    }
    if (!any) return;
    SX.set("settings", { volume: merged });
  }

  var Bridge = {
    init: function () {
      if (!SX) return null;
      if (inited) return SX.load();
      inited = true;
      var s = safe(function () { return SX.load(); }, null);
      var src = SX.loadSource ? SX.loadSource() : "main";
      // 只有统一档还不是权威源（首次迁移/全新安装）时才把新档写回旧键。
      // 否则会用 v2 的旧值覆盖玩家在设置/引导/联机里刚改的旧键，造成重启回滚。
      if (src === "legacy" || src === "default") {
        safe(function () { SX.mirrorLegacy(); });
      } else {
        // 旧模块仍以旧键为权威：启动时把这些段合并进统一档，而不是反向覆盖
        safe(function () {
          var raw = localStorage.getItem("saltline.settings.v1");
          if (raw) {
            var st = JSON.parse(raw);
            if (st && typeof st === "object") {
              Bridge.settings({
                quality: st.quality, sens: st.sens, invertY: st.invertY,
                fov: st.fov, volume: st.volume, volumeTracks: st.volumeTracks
              });
            }
          }
          var guide = localStorage.getItem("saltline.guide.v1");
          if (guide != null) SX.set("guide", { dismissed: guide === "1" });
          var mp = {}, anyMp = false;
          var mu = localStorage.getItem("saltline.mp.url");
          var mn = localStorage.getItem("saltline.mp.name");
          var mm = localStorage.getItem("saltline.mp.map");
          var mo = localStorage.getItem("saltline.mp.mode");
          if (mu != null) { mp.url = mu; anyMp = true; }
          if (mn != null) { mp.name = mn; anyMp = true; }
          if (mm != null) { mp.map = mm; anyMp = true; }
          if (mo != null) { mp.mode = mo; anyMp = true; }
          if (anyMp) SX.set("mp", mp);
        });
      }
      // 无论新档/旧档来源，都合并一次 audio 2.0 的分轨音量。
      safe(mergeAudioTracks);
      return s;
    },
    campaign: function (camp) {
      if (!SX || !camp) return;
      safe(function () {
        SX.set("campaign", {
          unlocked: camp.unlocked,
          current: camp.current,
          best: camp.best || {},
          challenges: camp.challenges || {},
          ending: camp.ending || null,
          checkpoint: camp.checkpoint || null
        });
      });
    },
    armory: function (sel) {
      if (!SX || !sel) return;
      safe(function () { SX.set("armory", sel); });
    },
    access: function (a) {
      if (!SX || !a) return;
      safe(function () {
        var shake = a.shake === "low" ? 0.45 : a.shake === "high" ? 1.6 : a.shake === "std" ? 1 : toNum(a.shake, 1);
        var hud = a.hudScale === "90" ? 0.9 : a.hudScale === "115" ? 1.15 : a.hudScale === "100" ? 1 : toNum(a.hudScale, 1);
        var sub = String(a.subSize || "M").toLowerCase();
        if (sub !== "s" && sub !== "m" && sub !== "l") sub = "m";
        SX.set("access", {
          difficulty: a.difficulty || "normal",
          cross: a.cross || "white",
          shake: shake,
          reduceMotion: !!a.reduceMotion,
          hudScale: hud,
          subSize: sub,
          contrast: !!a.contrast,
          colorblind: a.colorblind === "rg" || a.colorblind === "by" ? a.colorblind : "none",
          subBg: isFinite(a.subBg) ? a.subBg : 0.55,
          safe: isFinite(a.safe) ? a.safe : 16,
          textScale: a.textScale === "s" || a.textScale === "l" ? a.textScale : "m",
          hudOpacity: isFinite(a.hudOpacity) ? a.hudOpacity : 1,
          hud: a.hud && typeof a.hud === "object" ? a.hud : {}
        });
      });
    },
    settings: function (st) {
      if (!SX || !st) return;
      safe(function () {
        var prev = SX.get("settings") || {};
        var base = obj(prev.volume) ? prev.volume : {};
        var src = obj(st.volume) ? st.volume : null;
        var tracks = obj(st.volumeTracks) ? st.volumeTracks : null;
        // 旧引擎只传 number：保留已有分轨，不要回退成 0.8/1/1。
        var vol = {
          master: clamp01(toNum(src ? src.master : st.volume, toNum(base.master, 0.9))),
          music: clamp01(toNum(src ? src.music : undefined, toNum(base.music, 0.8))),
          sfx: clamp01(toNum(src ? src.sfx : undefined, toNum(base.sfx, 1))),
          voice: clamp01(toNum(src ? src.voice : undefined, toNum(base.voice, 1)))
        };
        if (tracks) {
          vol.music = clamp01(toNum(tracks.music, vol.music));
          vol.sfx = clamp01(toNum(tracks.sfx, vol.sfx));
          vol.voice = clamp01(toNum(tracks.voice, vol.voice));
        }
        SX.set("settings", {
          quality: st.quality || prev.quality || "auto",
          sens: st.sens != null ? st.sens : prev.sens,
          invertY: st.invertY != null ? !!st.invertY : !!prev.invertY,
          fov: st.fov != null ? st.fov : prev.fov,
          volume: vol
        });
      });
    },
    mp: function (url, name, map, mode) {
      if (!SX) return;
      safe(function () { SX.set("mp", { url: url || "", name: name || "", map: map || "harbor", mode: mode || "tdm" }); });
    },
    flush: function () { safe(function () { SX.flush(); }); },
    get: function (section) { return SX ? SX.get(section) : null; },
    exportJSON: function () { return SX ? SX.exportJSON() : "{}"; },
    importJSON: function (text) { return SX ? SX.importJSON(text) : { ok: false }; }
  };

  root.SXBridge = Bridge;
  if (typeof module === "object" && module.exports) module.exports = Bridge;
})(typeof globalThis !== "undefined" ? globalThis : this);
