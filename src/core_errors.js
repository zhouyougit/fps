/* =====================================================================
   V32 · 核心底座：错误处理与诊断（WP32-11）
   UMD：浏览器 window.SXErrors / Node module.exports
   - window.__errors 兼容：容量 200 的环形缓冲，不清空既有内容
   - guard：首次 + 每 300 次上报；同一系统连续 600 次失败停用并广播
   - dump：版本 / UA / 最近错误 / 最近 600 步命令，可一键下载
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SXErrors = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CAP = 200;
  var COMMAND_CAP = 600;
  var DISABLE_AFTER = 600;
  var REPORT_EVERY = 300;

  var entries = [];
  var commands = [];
  var lifetime = 0;
  var seq = 0;
  var bySystem = {};
  var byPhase = {};
  var guardStates = Object.create(null);
  var disabledListeners = [];
  var adopted = false;
  // ARCH-2：被吞掉的软错误按标签计数，每个标签只记一条诊断，避免日志刷屏。
  var softCounts = Object.create(null);
  var softSeen = Object.create(null);

  function win() {
    try { return typeof window !== "undefined" ? window : null; }
    catch (e) { return null; }
  }

  function bump(system, phase) {
    var s = String(system || "unknown");
    var p = String(phase || "unknown");
    bySystem[s] = (bySystem[s] || 0) + 1;
    byPhase[s + "::" + p] = (byPhase[s + "::" + p] || 0) + 1;
  }

  function ensureArray() {
    var w = win();
    if (!w) return null;
    var arr = w.__errors;
    if (!Array.isArray(arr)) {
      arr = [];
      w.__errors = arr;
    }
    if (!adopted) {
      adopted = true;
      var existing = arr.slice();
      for (var i = 0; i < existing.length; i++) {
        var item = {
          id: ++seq,
          t: 0,
          level: "legacy",
          system: "legacy",
          phase: "legacy",
          message: String(existing[i]).slice(0, 400)
        };
        entries.push(item);
        lifetime++;
        bump("legacy", "legacy");
      }
      while (entries.length > CAP) entries.shift();
      try { while (arr.length > CAP) arr.shift(); } catch (e) { /* 只读数组：不阻塞诊断 */ }
    }
    return arr;
  }

  function messageOf(e) {
    if (e && typeof e === "object") {
      if (e.message != null) return String(e.message);
      if (e.reason != null) return String(e.reason);
      try { return JSON.stringify(e); } catch (err) { return String(e); }
    }
    return String(e);
  }

  function makeEntry(e, meta) {
    meta = meta || {};
    var entry = {
      id: ++seq,
      t: Date.now(),
      system: String(meta.system != null ? meta.system : (e && e.system) || "unknown"),
      phase: String(meta.phase != null ? meta.phase : (e && e.phase) || "unknown"),
      message: messageOf(e).slice(0, 800),
      stack: e && e.stack ? String(e.stack).slice(0, 4000) : ""
    };
    if (e && e.name) entry.name = String(e.name);
    if (meta.data !== undefined) {
      try { entry.data = JSON.parse(JSON.stringify(meta.data)); }
      catch (err) { entry.data = String(meta.data); }
    }
    return entry;
  }

  function report(e, meta) {
    var entry = makeEntry(e, meta);
    entries.push(entry);
    lifetime++;
    while (entries.length > CAP) entries.shift();
    bump(entry.system, entry.phase);
    var arr = ensureArray();
    if (arr) {
      try {
        arr.push("[" + entry.system + "/" + entry.phase + "] " + entry.message.slice(0, 400));
        while (arr.length > CAP) arr.shift();
      } catch (e) { /* 只读 / 被冻结的 window.__errors：内部环形缓冲仍然生效 */ }
    }
    return entry;
  }

  function soft(tag, e) {
    var key = String(tag == null ? "soft" : tag);
    softCounts[key] = (softCounts[key] || 0) + 1;
    if (!softSeen[key]) {
      softSeen[key] = true;
      try { report(e, { system: "soft", phase: key }); } catch (err) { /* 诊断失败不能影响调用方 */ }
    }
    return undefined;
  }

  function guardState(system) {
    var key = String(system == null ? "unknown" : system);
    if (!guardStates[key]) {
      guardStates[key] = { consecutive: 0, total: 0, disabled: false, phases: {} };
    }
    return guardStates[key];
  }

  function makeEvent(type, detail) {
    var Ctor = null;
    try {
      var w = win();
      Ctor = (w && typeof w.CustomEvent === "function") ? w.CustomEvent
        : (typeof CustomEvent === "function" ? CustomEvent : null);
    } catch (e) { Ctor = null; }
    try {
      if (Ctor) return new Ctor(type, { detail: detail });
    } catch (e) { /* fall through to plain object */ }
    return { type: type, detail: detail };
  }

  function disable(system, phase, g, err) {
    g.disabled = true;
    g.disabledAt = Date.now();
    g.disabledReason = messageOf(err).slice(0, 400);
    // 不额外记一条错误：第 600 次失败本身已经按“每 300 次”上报；
    // 停用通过 sx:system-disabled 事件 + dump() 里的 disabled 列表呈现。
    var detail = {
      system: String(system),
      phase: String(phase),
      count: g.consecutive,
      total: g.total,
      reason: g.disabledReason
    };
    for (var i = 0; i < disabledListeners.length; i++) {
      try { disabledListeners[i](detail); } catch (e) { /* listener 隔离 */ }
    }
    var w = win();
    if (w && typeof w.dispatchEvent === "function") {
      try { w.dispatchEvent(makeEvent("sx:system-disabled", detail)); } catch (e) { /* ignore */ }
    }
  }

  function guard(system, phase, fn) {
    if (typeof fn !== "function") throw new TypeError("[errors] guard() 需要函数");
    var g = guardState(system);
    var phaseName = phase == null ? "default" : String(phase);
    return function guarded() {
      if (g.disabled) return undefined;
      try {
        var out = fn.apply(this, arguments);
        g.consecutive = 0;
        return out;
      } catch (err) {
        g.total++;
        g.consecutive++;
        g.phases[phaseName] = (g.phases[phaseName] || 0) + 1;
        var count = g.phases[phaseName];
        if (count === 1 || count % REPORT_EVERY === 0) {
          report(err, { system: system, phase: phaseName });
        }
        if (g.consecutive >= DISABLE_AFTER && !g.disabled) {
          disable(system, phaseName, g, err);
        }
        return undefined;
      }
    };
  }

  function isDisabled(system) {
    var g = guardStates[String(system == null ? "unknown" : system)];
    return !!(g && g.disabled);
  }

  function enable(system) {
    var g = guardStates[String(system == null ? "unknown" : system)];
    if (!g) return false;
    g.disabled = false;
    g.consecutive = 0;
    g.phases = {};
    g.disabledAt = 0;
    g.disabledReason = "";
    return true;
  }

  function onDisabled(fn) {
    if (typeof fn !== "function") return function () {};
    disabledListeners.push(fn);
    return function () {
      var i = disabledListeners.indexOf(fn);
      if (i >= 0) disabledListeners.splice(i, 1);
    };
  }

  function safeCommand(cmd) {
    if (cmd === undefined) return null;
    try { return JSON.parse(JSON.stringify(cmd)); }
    catch (e) { return String(cmd); }
  }

  function recordCommand(cmd, tick) {
    var item = {
      t: Date.now(),
      tick: typeof tick === "number" && isFinite(tick) ? tick : null,
      cmd: safeCommand(cmd)
    };
    commands.push(item);
    while (commands.length > COMMAND_CAP) commands.shift();
    return item;
  }

  function recentErrors(n) {
    var count = typeof n === "number" && n > 0 ? n : CAP;
    return entries.slice(Math.max(0, entries.length - count));
  }

  function recentCommands(n) {
    var count = typeof n === "number" && n > 0 ? n : COMMAND_CAP;
    return commands.slice(Math.max(0, commands.length - count));
  }

  function detectVersion() {
    try {
      if (typeof globalThis !== "undefined" && globalThis.__SX_VERSION != null) return globalThis.__SX_VERSION;
      if (typeof window !== "undefined" && window && window.__SX_VERSION != null) return window.__SX_VERSION;
    } catch (e) { /* ignore */ }
    return "unknown";
  }
  function detectProfile() {
    try {
      if (typeof window !== "undefined" && window && window.__SX_PROFILE != null) return window.__SX_PROFILE;
      if (typeof globalThis !== "undefined" && globalThis.__SX_PROFILE != null) return globalThis.__SX_PROFILE;
    } catch (e) { /* ignore */ }
    return null;
  }
  function detectUA() {
    try {
      if (typeof navigator !== "undefined" && navigator && navigator.userAgent) return navigator.userAgent;
    } catch (e) { /* ignore */ }
    return "unknown";
  }
  function detectLang() {
    try {
      if (typeof navigator !== "undefined" && navigator && navigator.language) return navigator.language;
    } catch (e) { /* ignore */ }
    return null;
  }
  function detectURL() {
    try {
      if (typeof location !== "undefined" && location && location.href) return location.href;
    } catch (e) { /* ignore */ }
    return null;
  }

  function counts() {
    var byS = {};
    var byP = {};
    var k;
    for (k in bySystem) if (Object.prototype.hasOwnProperty.call(bySystem, k)) byS[k] = bySystem[k];
    for (k in byPhase) if (Object.prototype.hasOwnProperty.call(byPhase, k)) byP[k] = byPhase[k];
    var disabled = [];
    for (k in guardStates) {
      if (guardStates[k].disabled) disabled.push(k);
    }
    return {
      total: lifetime,
      size: entries.length,
      capacity: CAP,
      commandCount: commands.length,
      commandCapacity: COMMAND_CAP,
      bySystem: byS,
      byPhase: byP,
      bySoft: Object.assign({}, softCounts),
      disabled: disabled
    };
  }

  function buildReport() {
    return {
      format: "saltline-crash-report",
      version: detectVersion(),
      profile: detectProfile(),
      ua: detectUA(),
      lang: detectLang(),
      url: detectURL(),
      time: new Date().toISOString(),
      counts: counts(),
      errors: entries.slice(),
      commands: commands.slice()
    };
  }

  function downloadReport(reportObj) {
    try {
      if (typeof document === "undefined" || typeof Blob === "undefined" ||
          typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
      var blob = new Blob([JSON.stringify(reportObj, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "saltline-diagnostics-" + Date.now() + ".json";
      a.rel = "noopener";
      (document.body || document.documentElement).appendChild(a);
      if (typeof a.click === "function") a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 0);
      return true;
    } catch (e) { return false; }
  }

  function dump(options) {
    var reportObj = buildReport();
    if (!options || options.download !== false) downloadReport(reportObj);
    return reportObj;
  }

  function dumpJSON(options) {
    return JSON.stringify(buildReport(), null, 2);
  }

  function clear() {
    entries.length = 0;
    commands.length = 0;
    lifetime = 0;
    bySystem = {};
    byPhase = {};
    softCounts = Object.create(null);
    softSeen = Object.create(null);
    adopted = true;
    var w = win();
    if (w && Array.isArray(w.__errors)) w.__errors.length = 0;
  }

  // 模块加载时接收既有 window.__errors，不清理原内容
  try { ensureArray(); } catch (e) { /* ignore */ }

  return {
    CAP: CAP,
    COMMAND_CAP: COMMAND_CAP,
    DISABLE_AFTER: DISABLE_AFTER,
    REPORT_EVERY: REPORT_EVERY,
    report: report,
    soft: soft,
    guard: guard,
    isDisabled: isDisabled,
    enable: enable,
    onDisabled: onDisabled,
    recordCommand: recordCommand,
    recentErrors: recentErrors,
    recentCommands: recentCommands,
    counts: counts,
    dump: dump,
    dumpJSON: dumpJSON,
    clear: clear
  };
});
