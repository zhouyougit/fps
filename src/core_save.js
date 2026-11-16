/* =====================================================================
   V32 · 核心底座：统一存档（WP32-8）
   UMD：浏览器 window.SXSave / Node module.exports
   主档 saltline.save（v=2），备份 saltline.save.bak，旧六组键只读迁移。
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SXSave = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CURRENT = 2;
  var KEY = "saltline.save";
  var BAK = "saltline.save.bak";
  var LEGACY = {
    campaign: "saltline.campaign.v1",
    armory: "saltline.armory.v1",
    access: "saltline.access.v1",
    settings: "saltline.settings.v1",
    guide: "saltline.guide.v1",
    mpUrl: "saltline.mp.url",
    mpName: "saltline.mp.name",
    mpMap: "saltline.mp.map",
    mpMode: "saltline.mp.mode"
  };
  var LEGACY_KEYS = [
    LEGACY.campaign, LEGACY.armory, LEGACY.access, LEGACY.settings,
    LEGACY.guide, LEGACY.mpUrl, LEGACY.mpName, LEGACY.mpMap, LEGACY.mpMode
  ];
  var INVALID = {};
  var MAPS = ["harbor", "depot", "ship", "core"];
  var MODES = ["tdm", "chaos"];
  var CROSSES = ["white", "bone", "amber", "cyan", "lime", "crimson", "gold"];
  var QUALITY = ["auto", "low", "medium", "high", "ultra"];
  var DIFFICULTY = ["recruit", "normal", "veteran", "nightmare"];

  /* ---------------------------------------------------------------- utils */

  function isPlain(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  function copy(obj) {
    if (!isPlain(obj)) return {};
    var out = {};
    for (var k in obj) if (has(obj, k)) out[k] = obj[k];
    return out;
  }
  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }
  function safeClone(value, depth) {
    depth = depth || 0;
    if (depth > 8) throw new Error("save: object nesting too deep");
    if (value === null) return null;
    var t = typeof value;
    if (t === "string" || t === "boolean") return value;
    if (t === "number") {
      if (!isFinite(value)) throw new Error("save: non-finite number");
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length > 1000) throw new Error("save: array too large");
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        if (value[i] === undefined) { arr.push(null); continue; }
        arr.push(safeClone(value[i], depth + 1));
      }
      return arr;
    }
    if (isPlain(value)) {
      var keys = Object.keys(value);
      if (keys.length > 1000) throw new Error("save: object too large");
      var out = {};
      for (var j = 0; j < keys.length; j++) {
        var v = value[keys[j]];
        if (v === undefined) continue;
        out[keys[j]] = safeClone(v, depth + 1);
      }
      return out;
    }
    throw new Error("save: unsupported value");
  }
  function cloneDefault(v) {
    try { return safeClone(v, 0); } catch (e) { return null; }
  }
  function memoryStorage() {
    var map = {};
    return {
      get length() { return Object.keys(map).length; },
      key: function (i) { return Object.keys(map)[i] == null ? null : Object.keys(map)[i]; },
      getItem: function (k) { return has(map, String(k)) ? map[String(k)] : null; },
      setItem: function (k, v) { map[String(k)] = String(v); },
      removeItem: function (k) { delete map[String(k)]; },
      clear: function () { map = {}; }
    };
  }
  var memory = null;
  function storage() {
    try {
      if (typeof localStorage !== "undefined" && localStorage &&
          typeof localStorage.getItem === "function" &&
          typeof localStorage.setItem === "function") return localStorage;
    } catch (e) { /* sandboxed storage falls through to memory */ }
    if (!memory) memory = memoryStorage();
    return memory;
  }
  function raw(key) {
    try { return storage().getItem(key); } catch (e) { return null; }
  }
  function readJSON(key) {
    var text = raw(key);
    if (text == null) return null;
    try {
      var parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) { return null; }
  }
  function storageKeys() {
    var out = [];
    try {
      var s = storage();
      if (typeof s.length === "number" && typeof s.key === "function") {
        for (var i = 0; i < s.length; i++) {
          var k = s.key(i);
          if (k != null) out.push(k);
        }
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  /* --------------------------------------------------------------- schema */
  /* 字段：type / def / enum / min / max / int / maxLen / nullable / norm /
     fields（对象）/ items（数组）/ values（字典值类型）/ objectOnly          */

  function num(def, min, max, int) {
    return { type: "number", def: def, min: min, max: max, int: !!int };
  }
  function str(def, maxLen, nonEmpty) {
    return { type: "string", def: def, maxLen: maxLen || 0, nonEmpty: !!nonEmpty };
  }
  function bool(def) { return { type: "boolean", def: def }; }
  function en(def, values, nullable) {
    return { type: "enum", def: def, enum: values, nullable: !!nullable };
  }
  function obj(fields) { return { type: "object", fields: fields }; }
  function json(def, objectOnly) {
    return { type: "json", def: def, objectOnly: !!objectOnly };
  }
  function dict(def, values, maxLen) {
    return { type: "dict", def: def, values: values || "string", maxLen: maxLen || 64, maxKeys: 128 };
  }

  var SCHEMA = {
    v: num(CURRENT, 1, 99, true),
    profile: obj({
      name: str("几猫", 24, true),
      createdAt: num(0, 0, Number.MAX_SAFE_INTEGER, true)
    }),
    settings: obj({
      quality: en("auto", QUALITY),
      sens: num(1, 0.2, 3),
      invertY: bool(false),
      fov: num(74, 60, 95),
      volume: obj({
        master: num(0.9, 0, 1),
        music: num(0.8, 0, 1),
        sfx: num(1, 0, 1),
        voice: num(1, 0, 1)
      }),
      binds: json({}, true)
    }),
    access: obj({
      difficulty: en("normal", DIFFICULTY),
      cross: en("white", CROSSES),
      shake: {
        type: "number", def: 1, min: 0, max: 2,
        norm: function (v) {
          if (typeof v === "number") return v;
          if (v === "low") return 0.45;
          if (v === "std") return 1;
          if (v === "high") return 1.6;
          return INVALID;
        }
      },
      reduceMotion: bool(false),
      hudScale: {
        type: "number", def: 1, min: 0.75, max: 1.5,
        norm: function (v) {
          if (typeof v === "number") return v;
          if (typeof v === "string") {
            var n = parseFloat(v);
            if (!isFinite(n)) return INVALID;
            if (n > 4) n = n / 100;
            return n;
          }
          return INVALID;
        }
      },
      subSize: {
        type: "enum", def: "m", enum: ["s", "m", "l"],
        norm: function (v) {
          return typeof v === "string" ? v.toLowerCase() : INVALID;
        }
      },
      contrast: bool(false),
      // V35 界面/可访问性扩展（旧版本没有，缺失时回退默认）
      colorblind: en("none", ["none", "rg", "by"]),
      subBg: num(0.55, 0, 1),
      safe: num(16, 0, 64),
      textScale: en("m", ["s", "m", "l"]),
      hudOpacity: num(1, 0.55, 1),
      hud: json({})
    }),
    campaign: obj({
      unlocked: num(1, 1, 8, true),
      current: {
        type: "string", def: "m1",
        norm: function (v) {
          if (typeof v === "string" && /^m[1-8]$/.test(v)) return v;
          if (typeof v === "number" && isFinite(v)) {
            var i = Math.round(v);
            if (i >= 0 && i <= 7) return "m" + (i + 1);
          }
          return INVALID;
        }
      },
      best: json({}, true),
      challenges: json({}, true),
      ending: en(null, ["silent", "open"], true),
      checkpoint: json(null, true)
    }),
    armory: obj({
      // V38：六把枪都能改装（旧档缺 smg/lmg/sidearm 时由 sanitize 补默认空对象）
      pac9: dict({}, "string"),
      breaker12: dict({}, "string"),
      dmr: dict({}, "string"),
      smg: dict({}, "string"),
      lmg: dict({}, "string"),
      sidearm: dict({}, "string")
    }),
    economy: obj({
      credits: num(0, 0, Number.MAX_SAFE_INTEGER, true),
      unlocked: { type: "array", def: [], items: "string", maxItems: 256 }
    }),
    stats: json({}, true),
    achievements: json({}, true),
    guide: obj({ dismissed: bool(false) }),
    mp: obj({
      url: str("", 200),
      name: str("", 24),
      map: en("harbor", MAPS),
      mode: en("tdm", MODES)
    })
  };

  function defaultsFor(field) {
    if (!field) return null;
    if (field.type === "object" && field.fields) {
      var out = {};
      var names = Object.keys(field.fields);
      for (var i = 0; i < names.length; i++) out[names[i]] = defaultsFor(field.fields[names[i]]);
      return out;
    }
    if (has(field, "def")) return cloneDefault(field.def);
    return null;
  }

  function sanitizeValue(field, value, def) {
    if (!field) return def;
    if (value === undefined) return def;
    if (value === null) return field.nullable ? null : def;
    if (typeof field.norm === "function") {
      var normalized;
      try { normalized = field.norm(value); } catch (e) { normalized = INVALID; }
      if (normalized === INVALID) return def;
      // 规范化之后仍然要过类型 / 枚举 / 范围校验（例如 hudScale=5、subSize='XL'）
      if (field.type === "number") {
        if (typeof normalized !== "number" || !isFinite(normalized)) return def;
        if (field.int && Math.floor(normalized) !== normalized) return def;
        // V53 SAVE-2：越界值钳制到合法区间，而不是整段重置为默认值
        if (field.min != null && normalized < field.min) normalized = field.min;
        if (field.max != null && normalized > field.max) normalized = field.max;
        return normalized;
      }
      if (field.type === "enum") {
        return field.enum.indexOf(normalized) >= 0 ? normalized : def;
      }
      if (field.type === "string") {
        if (typeof normalized !== "string") return def;
        if (field.maxLen && normalized.length > field.maxLen) return normalized.slice(0, field.maxLen);
        if (field.nonEmpty && !normalized) return def;
        return normalized;
      }
      return normalized;
    }
    var type = field.type;
    if (type === "object") {
      if (!isPlain(value)) return def;
      var out = {};
      var keys = Object.keys(field.fields);
      for (var i = 0; i < keys.length; i++) {
        var f = field.fields[keys[i]];
        out[keys[i]] = sanitizeValue(f, value[keys[i]], defaultsFor(f));
      }
      return out;
    }
    if (type === "string") {
      if (typeof value !== "string") return def;
      var s = value.trim();
      if (field.maxLen && s.length > field.maxLen) s = s.slice(0, field.maxLen);
      if (field.nonEmpty && !s) return def;
      return s;
    }
    if (type === "number") {
      if (typeof value !== "number" || !isFinite(value)) return def;
      if (field.int && Math.floor(value) !== value) return def;
      // V53 SAVE-2：越界值钳制而不是重置（旧档 sens=99 保留为 3 而不是回到 1）
      if (field.min != null && value < field.min) value = field.min;
      if (field.max != null && value > field.max) value = field.max;
      return value;
    }
    if (type === "boolean") return typeof value === "boolean" ? value : def;
    if (type === "enum") return field.enum.indexOf(value) >= 0 ? value : def;
    if (type === "array") {
      if (!Array.isArray(value)) return def;
      var arr = [];
      for (var j = 0; j < value.length && arr.length < (field.maxItems || 256); j++) {
        if (field.items === "string" && typeof value[j] === "string" && value[j]) arr.push(value[j]);
        else if (field.items === "number" && typeof value[j] === "number" && isFinite(value[j])) arr.push(value[j]);
      }
      return arr;
    }
    if (type === "dict") {
      if (!isPlain(value)) return def;
      var map = {};
      var ks = Object.keys(value);
      for (var n = 0; n < ks.length && n < (field.maxKeys || 128); n++) {
        var key = ks[n];
        var val = value[key];
        if (field.values === "string" && typeof val === "string") {
          map[key] = val.slice(0, field.maxLen || 64);
        } else if (field.values === "number" && typeof val === "number" && isFinite(val)) {
          map[key] = val;
        }
      }
      return map;
    }
    if (type === "json") {
      if (field.objectOnly && !isPlain(value)) return def;
      try { return safeClone(value, 0); } catch (e) { return def; }
    }
    return def;
  }

  function sanitize(input, schema) {
    schema = schema || SCHEMA;
    if (!isPlain(input)) input = {};
    var out = {};
    var keys = Object.keys(schema);
    for (var i = 0; i < keys.length; i++) {
      var f = schema[keys[i]];
      out[keys[i]] = sanitizeValue(f, input[keys[i]], defaultsFor(f));
    }
    return out;
  }

  function DEFAULTS() {
    return sanitize({}, SCHEMA);
  }

  /* -------------------------------------------------------------- migration */

  function missionIndex(id) {
    if (typeof id === "string" && /^m[1-8]$/.test(id)) return parseInt(id.slice(1), 10) - 1;
    if (typeof id === "number" && isFinite(id)) return Math.max(0, Math.min(7, Math.round(id)));
    return 0;
  }

  function normalizeLegacyShape(s) {
    if (!isPlain(s)) return s;
    // campaign.current：V31 存的是 0..5 的下标，V32 用 m1..m6
    if (s.campaign && typeof s.campaign.current === "number") {
      s.campaign.current = "m" + (missionIndex(s.campaign.current) + 1);
    }
    // settings.volume：V31 是一个 number（主音量），V32 分四路
    if (s.settings && typeof s.settings.volume === "number") {
      s.settings.volume = { master: clamp01(s.settings.volume), music: 0.8, sfx: 1, voice: 1 };
    }
    // access：V31 用字符串枚举，V32 用数值/小写
    var a = s.access;
    if (isPlain(a)) {
      if (typeof a.shake === "string") {
        a.shake = a.shake === "low" ? 0.45 : a.shake === "high" ? 1.6 : 1;
      }
      if (typeof a.hudScale === "string") {
        var hs = parseFloat(a.hudScale);
        if (isFinite(hs)) a.hudScale = hs > 4 ? hs / 100 : hs;
      }
      if (typeof a.subSize === "string") a.subSize = a.subSize.toLowerCase();
    }
    // profile.name 可能是旧档里的空字符串
    if (s.profile && (typeof s.profile.name !== "string" || !s.profile.name.trim())) {
      s.profile.name = "几猫";
    }
    return s;
  }

  function mergeKnown(target, source) {
    if (!isPlain(source)) return target;
    var keys = Object.keys(SCHEMA);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!has(source, key) || source[key] === undefined) continue;
      var field = SCHEMA[key];
      if (field.type === "object" && isPlain(source[key]) && isPlain(target[key])) {
        var sub = Object.keys(source[key]);
        for (var j = 0; j < sub.length; j++) target[key][sub[j]] = source[key][sub[j]];
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  /* V53 SAVE-2：收集 schema 之外的字段（顶层 + 已知对象段里的未知子键）。
     高版本存档（v > CURRENT）只做尽力读取，但任何后续写回都不能把这些字段裁掉。 */
  function collectUnknown(raw, schema, into) {
    if (!isPlain(raw) || !isPlain(schema)) return false;
    var found = false;
    var keys = Object.keys(raw);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!has(schema, key)) { into[key] = raw[key]; found = true; continue; }
      var field = schema[key];
      if (field && field.type === "object" && isPlain(field.fields) && isPlain(raw[key])) {
        var sub = {}, any = false;
        var subKeys = Object.keys(raw[key]);
        for (var j = 0; j < subKeys.length; j++) {
          if (!has(field.fields, subKeys[j])) { sub[subKeys[j]] = raw[key][subKeys[j]]; any = true; }
        }
        if (any) { into[key] = sub; found = true; }
      }
    }
    return found;
  }

  function withFutureFields(base) {
    if (!futureFields) return base;
    var out = copy(base);
    for (var key in futureFields) {
      if (!has(futureFields, key)) continue;
      var extra = futureFields[key];
      if (isPlain(out[key]) && isPlain(extra)) {
        var merged = copy(out[key]);
        for (var sub in extra) if (has(extra, sub) && !has(merged, sub)) merged[sub] = extra[sub];
        out[key] = merged;
      } else if (!has(out, key)) {
        out[key] = extra;
      }
    }
    return out;
  }

  function migrateLegacySix() {
    var s = DEFAULTS();
    var camp = readJSON(LEGACY.campaign);
    if (isPlain(camp)) {
      var ck = ["unlocked", "current", "best", "challenges", "ending", "checkpoint"];
      for (var i = 0; i < ck.length; i++) if (has(camp, ck[i])) s.campaign[ck[i]] = camp[ck[i]];
    }
    var arm = readJSON(LEGACY.armory);
    if (isPlain(arm)) {
      var ws = ["pac9", "breaker12", "dmr", "smg", "lmg", "sidearm"];
      for (var w = 0; w < ws.length; w++) if (isPlain(arm[ws[w]])) s.armory[ws[w]] = copy(arm[ws[w]]);
    }
    var acc = readJSON(LEGACY.access);
    if (isPlain(acc)) {
      var ak = ["difficulty", "cross", "shake", "reduceMotion", "hudScale", "subSize", "contrast"];
      for (var k = 0; k < ak.length; k++) if (has(acc, ak[k])) s.access[ak[k]] = acc[ak[k]];
    }
    var set = readJSON(LEGACY.settings);
    if (isPlain(set)) {
      if (has(set, "quality")) s.settings.quality = set.quality;
      if (has(set, "sens")) s.settings.sens = set.sens;
      if (has(set, "invertY")) s.settings.invertY = !!set.invertY;
      if (has(set, "fov")) s.settings.fov = set.fov;
      if (typeof set.volume === "number") s.settings.volume.master = clamp01(set.volume);
      else if (isPlain(set.volume)) {
        var vk = ["master", "music", "sfx", "voice"];
        for (var n = 0; n < vk.length; n++) if (has(set.volume, vk[n])) s.settings.volume[vk[n]] = set.volume[vk[n]];
      }
      // V38：镜像里额外保存分轨，避免旧键往返把 music/sfx/voice 冲回默认。
      if (isPlain(set.volumeTracks)) {
        var tk = ["music", "sfx", "voice"];
        for (var t = 0; t < tk.length; t++) {
          var tv = set.volumeTracks[tk[t]];
          if (typeof tv === "number" && isFinite(tv)) s.settings.volume[tk[t]] = clamp01(tv);
        }
      }
      if (isPlain(set.binds)) s.settings.binds = safeClone(set.binds, 0);
    }
    var guide = raw(LEGACY.guide);
    s.guide.dismissed = guide === "1" || guide === 1 || guide === true;
    var mu = raw(LEGACY.mpUrl); if (mu != null) s.mp.url = mu;
    var mn = raw(LEGACY.mpName); if (mn != null) s.mp.name = mn;
    var mm = raw(LEGACY.mpMap); if (mm != null) s.mp.map = mm;
    var md = raw(LEGACY.mpMode); if (md != null) s.mp.mode = md;
    normalizeLegacyShape(s);
    s.v = CURRENT;
    return s;
  }

  var MIGRATIONS = {
    1: function (legacyState) {
      var s = DEFAULTS();
      if (isPlain(legacyState)) mergeKnown(s, legacyState);
      normalizeLegacyShape(s);
      s.v = CURRENT;
      return s;
    }
  };

  function migrateRaw(input) {
    if (!isPlain(input)) return input;
    var v = input.v;
    if (v === undefined || v === null) {
      var s = DEFAULTS();
      mergeKnown(s, input);
      normalizeLegacyShape(s);
      s.v = CURRENT;
      return s;
    }
    if (typeof v !== "number" || !isFinite(v) || v < 1) {
      var s2 = DEFAULTS();
      mergeKnown(s2, input);
      normalizeLegacyShape(s2);
      s2.v = CURRENT;
      return s2;
    }
    var out = input;
    var guard = 0;
    while (out.v < CURRENT && guard++ < 20) {
      var fn = MIGRATIONS[out.v];
      if (!fn) break;
      out = fn(out);
    }
    return out;
  }

  function hasLegacyKeys() {
    for (var i = 0; i < LEGACY_KEYS.length; i++) {
      if (raw(LEGACY_KEYS[i]) != null) return true;
    }
    var keys = storageKeys();
    for (var j = 0; j < keys.length; j++) {
      if (typeof keys[j] === "string" && keys[j].indexOf("saltline.mp.") === 0) return true;
    }
    return false;
  }

  /* -------------------------------------------------------------- runtime */

  var state = null;
  var loadedSource = "none";
  // V49：记录本次页面首次 load 的来源（boot 之后再次 load 会看到已迁移的 main）
  var bootSource = null;
  var listeners = [];
  var timer = null;
  var dirty = false;
  var debounceMs = 250;
  // V53 SAVE-2：更高版本存档里 schema 之外的字段。写回时原样保留，避免降级裁字段。
  var futureFields = null;
  var lastWriteError = null;
  var writeRetries = 0;
  var retryTimer = null;
  var lifecycleBound = false;

  function notify(reason) {
    var snapshot = listeners.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try { snapshot[i](state, { reason: reason, source: loadedSource }); } catch (e) { /* listener 隔离 */ }
    }
  }

  function writeState(next) {
    var text;
    try { text = JSON.stringify(withFutureFields(next)); }
    catch (e) { lastWriteError = "序列化失败"; return false; }
    // V53 SAVE-2：写失败重试一次（配额/瞬时异常），仍失败时保留内存态并交给 retryLater。
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var store = storage();
        var prev = store.getItem(KEY);
        var prevValid = false;
        if (prev != null) {
          try { prevValid = isPlain(JSON.parse(prev)); } catch (e) { prevValid = false; }
        }
        // 只有合法旧主档才允许写进备份；否则会把唯一可用的备份覆盖成坏文本
        try {
          if (!prevValid) store.setItem(BAK, text);
          else store.setItem(BAK, prev);
        } catch (e) { /* 备份写失败（配额）不应阻止主档写入 */ }
        store.setItem(KEY, text);
        lastWriteError = null;
        writeRetries = 0;
        return true;
      } catch (e) {
        lastWriteError = String((e && e.message) || e);
      }
    }
    return false;
  }

  function retryLater() {
    if (retryTimer || typeof setTimeout !== "function") return false;
    if (writeRetries >= 3) return false;
    var delay = 500 * Math.pow(2, writeRetries++);
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (!dirty) return;
      var ok = writeState(state || DEFAULTS());
      if (ok) { dirty = false; notify("save"); }
      else retryLater();
    }, delay);
    if (retryTimer && typeof retryTimer.unref === "function") retryTimer.unref();
    return true;
  }

  // V53 SAVE-2：移动端切后台/关闭页面时（不只 beforeunload）也落盘，避免丢最后 250ms。
  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    try {
      if (typeof document !== "undefined" && document && typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", function () {
          try { if (document.hidden === true) saveNow(); } catch (e) { /* ignore */ }
        });
      }
    } catch (e) { /* no document */ }
    try {
      if (typeof window !== "undefined" && window && typeof window.addEventListener === "function") {
        window.addEventListener("pagehide", function () {
          try { saveNow(); } catch (e) { /* ignore */ }
        });
      }
    } catch (e) { /* no window */ }
  }

  function readCandidate(key) {
    var text = raw(key);
    if (text == null) return { missing: true };
    try {
      var parsed = JSON.parse(text);
      if (!isPlain(parsed)) return { corrupt: true };
      return { data: parsed };
    } catch (e) { return { corrupt: true }; }
  }

  function load() {
    // 有未落盘的 debounce 改动时先落盘，避免 load() 把最近写入静默丢掉
    if (dirty) { try { saveNow(); } catch (e) {} }
    var main = readCandidate(KEY);
    var parsed = null;
    var source = "default";
    if (main.data) {
      parsed = main.data;
      source = "main";
    } else {
      var bak = readCandidate(BAK);
      if (bak.data) {
        parsed = bak.data;
        source = "backup";
      }
    }
    if (parsed) {
      var v = typeof parsed.v === "number" ? parsed.v : null;
      var needsMigration = v === null || v < CURRENT;
      var isFuture = typeof v === "number" && v > CURRENT;
      var next = migrateRaw(parsed);
      state = sanitize(next, SCHEMA);
      loadedSource = source;
      // V53 SAVE-2：高版本存档只做尽力读取；记下未知字段，后续写回时原样带上。
      if (isFuture) {
        var extra = {};
        futureFields = collectUnknown(parsed, SCHEMA, extra) ? extra : null;
      } else {
        futureFields = null;
      }
      // 主档 v1/无版本或来自备份：迁移/修复后回写主档；旧键保留。
      if ((needsMigration && source === "main") || source === "backup") writeState(state);
    } else if (hasLegacyKeys()) {
      state = sanitize(migrateLegacySix(), SCHEMA);
      loadedSource = "legacy";
      futureFields = null;
      writeState(state); // 旧键不删，新主档落盘
    } else {
      state = DEFAULTS();
      loadedSource = "default";
      futureFields = null;
    }
    if (bootSource === null) bootSource = loadedSource;
    dirty = false;
    if (timer) { clearTimeout(timer); timer = null; }
    bindLifecycle();
    return state;
  }

  function commit(next) {
    if (isPlain(next)) state = next;
    if (!state) state = DEFAULTS();
    var ok = writeState(state);
    if (ok) { dirty = false; notify("commit"); }
    else { dirty = true; retryLater(); } // 写失败时保留内存态并安排重试，别让下次 reload 丢掉
    return ok;
  }

  function saveNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!dirty) return true;
    var ok = writeState(state || DEFAULTS());
    if (ok) { dirty = false; notify("save"); }
    else retryLater();
    return ok;
  }

  function scheduleSave() {
    dirty = true;
    if (debounceMs <= 0) { saveNow(); return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      if (!dirty) return;
      var ok = writeState(state || DEFAULTS());
      if (ok) { dirty = false; notify("save"); }
      else retryLater();
    }, debounceMs);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function set(section, patch) {
    var s = state || load();
    if (typeof section !== "string" || !section) return s;
    if (arguments.length < 2) return s[section];
    if (isPlain(s[section]) && isPlain(patch)) {
      var keys = Object.keys(patch);
      for (var i = 0; i < keys.length; i++) s[section][keys[i]] = patch[keys[i]];
    } else {
      s[section] = patch;
    }
    if (SCHEMA[section]) {
      s[section] = sanitizeValue(SCHEMA[section], s[section], defaultsFor(SCHEMA[section]));
    }
    scheduleSave();
    notify("set");
    return s[section];
  }

  function get(section) {
    var s = state || load();
    if (section === undefined || section === null || section === "") return s;
    return s[section];
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function setDebounce(ms) {
    var n = Number(ms);
    if (isFinite(n) && n >= 0) debounceMs = n;
    return debounceMs;
  }

  function flush() {
    return saveNow();
  }

  function loadSource() { return loadedSource; }
  function bootLoadSource() { return bootSource; }

  function setLoadSourceForTest(v) { loadedSource = String(v); }

  function reset() {
    state = DEFAULTS();
    loadedSource = "reset";
    futureFields = null;
    var ok = writeState(state);
    dirty = !ok;
    if (!ok) retryLater();
    // V53 SAVE-1：重置后同步镜像旧键，避免旧模块再读回重置前进度并推回统一档。
    try { mirrorLegacy(); } catch (e) { /* mirror 失败不影响重置 */ }
    notify("reset");
    return state;
  }

  /* ------------------------------------------------------- export / import */

  function exportJSON() {
    // V53 SAVE-2：高版本存档的未知字段也导出，避免“读入再导出”丢数据
    return JSON.stringify(withFutureFields(state || load()), null, 2);
  }

  function exportFile(filename) {
    var text = exportJSON();
    var doc = typeof document !== "undefined" ? document : null;
    if (!doc || typeof Blob === "undefined" || typeof URL === "undefined" ||
        typeof URL.createObjectURL !== "function") return text;
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = doc.createElement("a");
      a.href = url;
      a.download = filename || "saltline-save.json";
      a.rel = "noopener";
      (doc.body || doc.documentElement).appendChild(a);
      if (typeof a.click === "function") a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 0);
    } catch (e) { /* 下载失败时至少把字符串返回给调用方 */ }
    return text;
  }

  function importJSON(text) {
    var rawState;
    try { rawState = typeof text === "string" ? JSON.parse(text) : text; }
    catch (e) { return { ok: false, error: "存档不是合法 JSON" }; }
    if (!isPlain(rawState)) return { ok: false, error: "存档根节点必须是对象" };
    try {
      var migrated = migrateRaw(rawState);
      var next = sanitize(migrated, SCHEMA);
      var importV = typeof rawState.v === "number" ? rawState.v : null;
      // 先写盘成功再提交内存态；失败时保持原存档不变
      var ok = writeState(next);
      if (!ok) return { ok: false, error: "存档写入失败" };
      // V53 SAVE-2：导入高版本存档时同样保留未知字段。
      if (importV !== null && importV > CURRENT) {
        var extra = {};
        futureFields = collectUnknown(rawState, SCHEMA, extra) ? extra : null;
      } else {
        futureFields = null;
      }
      state = next;
      loadedSource = "import";
      dirty = false;
      // V53 SAVE-1：导入成功写盘后立即镜像旧键，下一次 saveCamp 才不会把旧进度推回。
      try { mirrorLegacy(); } catch (e) { /* mirror 失败不应让导入回滚 */ }
      notify("import");
      return { ok: true, state: state };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  function importFile(input) {
    if (input && typeof input.text === "function") {
      return Promise.resolve(input.text()).then(function (text) {
        return importJSON(text);
      }, function (e) {
        return { ok: false, error: String(e && e.message || e) };
      });
    }
    if (typeof input === "string") return importJSON(input);
    if (isPlain(input)) return importJSON(input);
    return { ok: false, error: "不支持的导入输入" };
  }

  /* --------------------------------------------------------- legacy mirror */

  function mirrorLegacy(options) {
    var s = state || load();
    var wanted = options && options.sections ? options.sections : null;
    var out = {};
    function on(name) { return !wanted || wanted.indexOf(name) >= 0; }
    function put(key, value) {
      try { storage().setItem(key, value); out[key] = value; }
      catch (e) { out[key] = null; }
    }
    if (on("campaign")) {
      put(LEGACY.campaign, JSON.stringify({
        unlocked: s.campaign.unlocked,
        current: missionIndex(s.campaign.current),
        best: s.campaign.best,
        challenges: s.campaign.challenges,
        ending: s.campaign.ending,
        checkpoint: s.campaign.checkpoint
      }));
    }
    if (on("armory")) put(LEGACY.armory, JSON.stringify(s.armory));
    if (on("access")) {
      var shake = s.access.shake <= 0.6 ? "low" : s.access.shake >= 1.3 ? "high" : "std";
      var hud = s.access.hudScale <= 0.95 ? "90" : s.access.hudScale >= 1.075 ? "115" : "100";
      put(LEGACY.access, JSON.stringify({
        difficulty: s.access.difficulty,
        // V31 的 access.js 只认得 bone/amber/cyan/...；white 是新档默认值，镜像时折回 bone
        cross: s.access.cross === "white" ? "bone" : s.access.cross,
        shake: shake,
        reduceMotion: s.access.reduceMotion,
        hudScale: hud,
        subSize: s.access.subSize.toUpperCase(),
        contrast: s.access.contrast
      }));
    }
    if (on("settings")) {
      put(LEGACY.settings, JSON.stringify({
        quality: s.settings.quality,
        sens: s.settings.sens,
        invertY: s.settings.invertY,
        // V31 引擎读 volume 数字；分轨用 volumeTracks 附带，双向迁移都不丢。
        volume: s.settings.volume.master,
        volumeTracks: {
          music: s.settings.volume.music,
          sfx: s.settings.volume.sfx,
          voice: s.settings.volume.voice
        },
        fov: s.settings.fov
      }));
    }
    if (on("guide")) put(LEGACY.guide, s.guide.dismissed ? "1" : "0");
    if (on("mp")) {
      put(LEGACY.mpUrl, s.mp.url || "");
      put(LEGACY.mpName, s.mp.name || "");
      put(LEGACY.mpMap, s.mp.map || "harbor");
      put(LEGACY.mpMode, s.mp.mode || "tdm");
    }
    return out;
  }

  var api = {
    CURRENT: CURRENT,
    KEY: KEY,
    BAK: BAK,
    LEGACY: LEGACY,
    LEGACY_KEYS: LEGACY_KEYS,
    SCHEMA: SCHEMA,
    MIGRATIONS: MIGRATIONS,
    DEFAULTS: DEFAULTS,
    defaults: DEFAULTS,
    sanitize: sanitize,
    load: load,
    commit: commit,
    set: set,
    get: get,
    flush: flush,
    saveNow: saveNow,
    subscribe: subscribe,
    setDebounce: setDebounce,
    getDebounce: function () { return debounceMs; },
    loadSource: loadSource,
    getLoadSource: loadSource,
    bootSource: bootLoadSource,
    _setLoadSourceForTest: setLoadSourceForTest,
    hasLegacyKeys: hasLegacyKeys,
    reset: reset,
    exportJSON: exportJSON,
    exportFile: exportFile,
    importJSON: importJSON,
    importFile: importFile,
    mirrorLegacy: mirrorLegacy,
    // V53 SAVE-2：最近一次写盘失败原因（成功后清空），供 UI/调试提示
    writeError: function () { return lastWriteError; },
    state: function () { return state || load(); }
  };
  return api;
});
