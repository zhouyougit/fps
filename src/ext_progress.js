/* =====================================================================
   V34 · 成长系统（WP34-8）：信用点 / 配件解锁 / 动态评级 / 成就 / 挑战奖励
   ---------------------------------------------------------------------
   独立 IIFE：只通过 window.__G / window.SXSave / window.__SX / window.__SX_ARMORY
   工作，不修改 ext.js / game.js / campaign.js。
   存档统一写入 saltline.save v2：
     economy.credits / economy.unlocked
     achievements.<id> = { at, v, tier }
     stats.<metric>（成就与精通的共同数据源）
   ===================================================================== */
(function () {
  "use strict";

  var VERSION = "V34 · 对手";
  var G = null;
  var booted = false;
  var tries = 0;

  /* ------------------------------------------------------------ 数值表 */

  /* 信用点（唯一货币，只能游戏内获得） */
  var CREDIT = {
    kill: 8,          // 击杀
    headshot: 12,     // 爆头（在击杀基础上追加）
    elite: 25,        // 精英/重装/狙击/炮台
    boss: 150,        // BOSS
    mission: { recruit: 80, normal: 120, veteran: 170, nightmare: 220 },
    trainRate: 0.05,  // 训练场：得分 × 0.05
    challenge: { 3: 200, 6: 300, 9: 450, 12: 600, 15: 750, 18: 900, 21: 1050, 24: 1200 }
  };
  // V37：8 关 × 3 挑战 = 24；档位与徽章上限同步到 24（不再硬编码 18）。
  var CHALLENGE_TIERS = [3, 6, 9, 12, 15, 18, 21, 24];
  var CROSS_AT = { 3: "progress.cross.3", 6: "progress.cross.6", 9: "progress.cross.9" };

  var DIFF_MUL = { recruit: 0.9, normal: 1, veteran: 1.08, nightmare: 1.16 };
  var DIFF_LABEL = {
    recruit: "progress.diff.recruit", normal: "progress.diff.normal",
    veteran: "progress.diff.veteran", nightmare: "progress.diff.nightmare"
  };

  /* 每关评级参数：标准时间 / 标准受伤 / 标准击杀（可由 mission.timeTarget 覆盖） */
  var PAR = {
    m1: { time: 300, damage: 55, kills: 18 },
    m2: { time: 360, damage: 65, kills: 25 },
    m3: { time: 480, damage: 80, kills: 34 },
    m4: { time: 300, damage: 50, kills: 9 },
    m5: { time: 420, damage: 60, kills: 12 },
    m6: { time: 480, damage: 90, kills: 28 },
    train: { time: 90, damage: 0, kills: 20 }
  };
  var GRADE_LABEL = {
    S: "ui2.rating.perfect", A: "ui2.rating.clean", B: "ui2.rating.solid", C: "ui2.rating.risky"
  };
  var ELITE_VARIANTS = { elite: 1, heavy: 1, marksman: 1 };

  /* 成就：12 个（挑战 9/18 是同一成就的两个阶段）；名称/说明只存 key。 */
  var ACHIEVEMENTS = [
    { id: "first_blood", metric: "kills", need: 1 },
    { id: "headshot50", metric: "headshots", need: 50 },
    { id: "flawless", metric: "flawlessRuns", need: 1 },
    { id: "speedrun", metric: "speedRuns", need: 1 },
    { id: "relays_all", metric: "fullRelayRuns", need: 1 },
    { id: "boss_kill", metric: "bossKills", need: 1 },
    { id: "missions_all", metric: "missionsCleared", need: 8 },
    { id: "challenger", metric: "challenges", need: 9, tier2: 24 },
    { id: "train8000", metric: "trainBest", need: 8000 },
    { id: "mp10", metric: "mpKills", need: 10 },
    { id: "grenade3", metric: "grenadeKills", need: 3 },
    { id: "melee5", metric: "meleeKills", need: 5 }
  ];
  function achName(def) { return t("ui2.ach." + def.id + ".name"); }
  function achDesc(def) { return t("ui2.ach." + def.id + ".desc"); }
  var METRICS = [
    "kills", "headshots", "eliteKills", "bossKills", "grenadeKills", "meleeKills",
    "mpKills", "missionsCleared", "challenges", "trainBest", "flawlessRuns",
    "speedRuns", "fullRelayRuns", "damageTaken", "runs"
  ];

  /* ------------------------------------------------------------- state */
  var stats = null;
  var achCache = null;
  var run = null;
  var runSeq = 0;
  var lastHit = null;
  var lastKill = null;
  var meleeAt = 0;
  var grenadeAt = 0;
  var grenadeBlast = null;
  var mpSeen = 0;
  var badgeAt = 0;
  var achWrap = null;
  var toastEl = null;
  /* 最近一次渲染的结算数据：切换语言时按同数据重绘 */
  var lastRating = null;
  var lastRunCredits = null;
  var lastTraining = null;

  /* ------------------------------------------------------------- utils */
  function n(v, d) {
    v = typeof v === "number" ? v : parseFloat(v);
    return isFinite(v) ? v : (d || 0);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clock(sec) {
    sec = Math.max(0, n(sec));
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function fmt(v) {
    return String(Math.round(n(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) {
    var out = {};
    if (!o || typeof o !== "object") return out;
    for (var k in o) if (has(o, k)) out[k] = o[k];
    return out;
  }
  function nowMs() { return typeof Date !== "undefined" && Date.now ? Date.now() : +new Date(); }
  function sfx(name, opts) {
    try { if (G && G.audio && G.audio.play) G.audio.play(name, opts || {}); } catch (e) {}
  }
  function state() {
    try { return window.__SX ? window.__SX.S : null; } catch (e) { return null; }
  }

  /* ------------------------------------------------------------- i18n */
  /* 所有玩家可见文案在渲染时取词，data 表只存 key：切语言后重绘即可生效。 */
  function i18n() {
    try { return window.SXI18n || null; } catch (e) { return null; }
  }
  function t(key, vars) {
    var I = i18n();
    if (I && typeof I.t === "function") return I.t(key, vars);
    var ex = window.__SX_I18N_EXTRA;
    var s = ex && ex.zh ? ex.zh[key] : null;
    if (s == null) return key;
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (_, name) {
      return vars[name] == null ? "" : String(vars[name]);
    });
  }
  /* 配件 id 形如 wid:slot:opt，直接映射到军械库词典键；拿不到时用调用方给的名称 */
  function attachName(id, fallback) {
    if (id) {
      var parts = String(id).split(":");
      if (parts.length === 3) {
        var I = i18n();
        var key = "ui2.ar.attach." + parts[0] + "." + parts[1] + "." + parts[2] + ".name";
        if (I && typeof I.has === "function" && I.has(key)) return I.t(key);
      }
    }
    return fallback || t("progress.unlock.attachment");
  }

  /* ------------------------------------------------------------ storage */
  var FALLBACK_KEY = "saltline.progress.v1";

  function save() { return window.SXSave && typeof window.SXSave.get === "function" ? window.SXSave : null; }

  function fallbackRead() {
    try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function fallbackWrite(next) {
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(next)); } catch (e) {}
  }

  function readStore(section, def) {
    var sx = save();
    if (sx) {
      try {
        var v = sx.get(section);
        if (v && typeof v === "object") return v;
      } catch (e) {}
    }
    var fb = fallbackRead();
    return fb && fb[section] && typeof fb[section] === "object" ? fb[section] : def;
  }
  function writeStore(section, value) {
    var sx = save();
    if (sx) {
      try { sx.set(section, value); return; } catch (e) {}
    }
    var fb = fallbackRead();
    fb[section] = value;
    fallbackWrite(fb);
  }

  /* ------------------------------------------------------------- economy */
  function readEconomy() {
    var raw = readStore("economy", {});
    var credits = Math.max(0, Math.round(n(raw.credits)));
    var unlocked = [];
    if (raw.unlocked && typeof raw.unlocked.length === "number") {
      for (var i = 0; i < raw.unlocked.length; i++) {
        var id = raw.unlocked[i];
        if (typeof id === "string" && id && unlocked.indexOf(id) < 0) unlocked.push(id);
      }
    }
    return { credits: credits, unlocked: unlocked };
  }
  function writeEconomy(e) {
    writeStore("economy", {
      credits: Math.max(0, Math.round(n(e.credits))),
      unlocked: (e.unlocked || []).slice(0, 256)
    });
    maybeBadge();
  }
  function credits() { return readEconomy().credits; }
  function addCredits(amount, reason) {
    var v = Math.round(n(amount));
    if (!v) return credits();
    var e = readEconomy();
    e.credits = Math.max(0, e.credits + v);
    writeEconomy(e);
    return e.credits;
  }

  function catalog() {
    try { return (window.__SX_ARMORY && window.__SX_ARMORY.catalog) || []; } catch (e) { return []; }
  }
  function catalogEntry(id) {
    var list = catalog();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function isUnlocked(id) {
    if (!id) return false;
    var e = readEconomy();
    if (e.unlocked.indexOf(id) >= 0) return true;
    var c = catalogEntry(id);
    if (c) return (c.price | 0) <= 0;   // 0 档默认拥有
    return true;                         // 未知配件按旧档兼容处理
  }
  function unlockAttachment(id) {
    if (!id) return false;
    var e = readEconomy();
    if (e.unlocked.indexOf(id) >= 0) return true;
    e.unlocked.push(id);
    writeEconomy(e);
    return true;
  }
  function purchase(id, price, name) {
    var e = readEconomy();
    price = Math.max(0, Math.round(n(price)));
    if (e.unlocked.indexOf(id) >= 0) return { ok: true, already: true, credits: e.credits, price: price };
    if (e.credits < price) return { ok: false, reason: "insufficient", credits: e.credits, price: price };
    e.credits -= price;
    e.unlocked.push(id);
    writeEconomy(e);
    notify(t("progress.unlock.notify", { name: attachName(id, name), price: price }));
    sfx("ui:click", { gain: 0.7, pitch: 1.25 });
    return { ok: true, credits: e.credits, price: price };
  }

  /* 旧档：已装配件视为已拥有（V31 迁移，避免更新后装备被锁） */
  function migrateEquipped() {
    var sel = null;
    try { sel = window.__SX && window.__SX.armory ? window.__SX.armory() : null; } catch (e) { sel = null; }
    if (!sel || typeof sel !== "object") return;
    var e = readEconomy();
    var changed = false;
    for (var wid in sel) {
      if (!has(sel, wid) || !sel[wid]) continue;
      for (var slot in sel[wid]) {
        if (!has(sel[wid], slot)) continue;
        var id = wid + ":" + slot + ":" + sel[wid][slot];
        var c = catalogEntry(id);
        if (c && (c.price | 0) > 0 && e.unlocked.indexOf(id) < 0) {
          e.unlocked.push(id);
          changed = true;
        }
      }
    }
    if (changed) writeEconomy(e);
  }

  /* --------------------------------------------------------------- stats */
  function normalizeStats(raw) {
    var out = {};
    raw = raw && typeof raw === "object" ? raw : {};
    for (var i = 0; i < METRICS.length; i++) {
      var k = METRICS[i];
      out[k] = Math.max(0, Math.round(n(raw[k])));
    }
    out.challengeRewards = raw.challengeRewards && typeof raw.challengeRewards === "object" ? copy(raw.challengeRewards) : {};
    return out;
  }
  function saveStats() { writeStore("stats", stats); }

  /* -------------------------------------------------------- achievements */
  function normalizeAchievements(raw) {
    var out = {};
    raw = raw && typeof raw === "object" ? raw : {};
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var id = ACHIEVEMENTS[i].id;
      var rec = raw[id];
      if (rec && typeof rec === "object") {
        out[id] = { at: Math.max(0, Math.round(n(rec.at))), v: Math.max(0, Math.round(n(rec.v))), tier: Math.max(1, Math.min(2, Math.round(n(rec.tier, 1)))) };
      }
    }
    return out;
  }
  function saveAchievements() { writeStore("achievements", achCache); }

  function checkAchievements() {
    if (!achCache) achCache = normalizeAchievements(readStore("achievements", {}));
    var fresh = [];
    var changed = false;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      var val = n(stats[def.metric]);
      var rec = achCache[def.id];
      if (!rec && val >= def.need) {
        achCache[def.id] = { at: nowMs(), v: val, tier: 1 };
        changed = true;
        fresh.push({ def: def, tier: 1 });
      } else if (rec && def.tier2 && n(rec.tier) < 2 && val >= def.tier2) {
        rec.tier = 2;
        changed = true;
        fresh.push({ def: def, tier: 2 });
      }
    }
    if (changed) {
      saveAchievements();
      for (var j = 0; j < fresh.length; j++) showAchievement(fresh[j].def, fresh[j].tier);
      updateBadges();
    }
    return fresh;
  }

  function listAchievements() {
    if (!achCache) achCache = normalizeAchievements(readStore("achievements", {}));
    var out = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      var rec = achCache[def.id];
      out.push({
        id: def.id,
        name: achName(def),
        desc: achDesc(def),
        metric: def.metric,
        need: def.need,
        tier2: def.tier2 || 0,
        value: n(stats[def.metric]),
        progress: Math.min(n(stats[def.metric]), def.need),
        unlocked: !!rec,
        at: rec ? n(rec.at) : 0,
        tier: rec ? n(rec.tier, 1) : 0
      });
    }
    return out;
  }
  function achievementCount() {
    var list = listAchievements(), c = 0;
    for (var i = 0; i < list.length; i++) if (list[i].unlocked) c++;
    return c;
  }

  function evaluate(stat) {
    if (stat && typeof stat === "object") {
      for (var k in stat) {
        if (!has(stat, k) || METRICS.indexOf(k) < 0) continue;
        var v = Math.max(0, Math.round(n(stat[k])));
        if (v > n(stats[k])) stats[k] = v;
      }
      saveStats();
    }
    var fresh = checkAchievements();
    updateBadges();
    var ids = [];
    for (var i = 0; i < fresh.length; i++) ids.push(fresh[i].def.id);
    return { ok: true, unlocked: ids, stats: copy(stats) };
  }

  /* -------------------------------------------------------------- rating */
  function difficultyKey() {
    var keys = { recruit: 1, normal: 1, veteran: 1, nightmare: 1 };
    try {
      var raw = JSON.parse(localStorage.getItem("saltline.access.v1") || "null");
      if (raw && keys[raw.difficulty]) return raw.difficulty;
    } catch (e) {}
    try {
      var sx = save();
      var acc = sx ? sx.get("access") : null;
      if (acc && keys[acc.difficulty]) return acc.difficulty;
    } catch (e) {}
    return "normal";
  }
  function waveKills(m) {
    var total = 0, i, k;
    var waves = (m && m.waves) || [];
    for (i = 0; i < waves.length; i++) {
      for (k in waves[i]) if (has(waves[i], k)) total += n(waves[i][k]);
    }
    if (!total) {
      var patrol = (m && m.patrol) || {};
      for (k in patrol) if (has(patrol, k)) total += n(patrol[k]);
      total *= 3;
    }
    return Math.max(6, total);
  }
  function parFor(mission) {
    var m = mission || {};
    var base = PAR[m.id] || {};
    var time = n(m.timeTarget) || n(base.time) || n(m.challenges && m.challenges.time) || 360;
    var dmg = n(m.damageTarget) || n(base.damage) || 55;
    var kills = n(m.killTarget) || n(base.kills) || waveKills(m);
    return { time: time, damage: dmg, kills: kills };
  }
  function score01(v, lo, hi) {
    if (hi === lo) return v >= hi ? 1 : 0;
    return clamp((v - lo) / (hi - lo), 0, 1);
  }
  function rate(stat, mission, diff) {
    var st = stat || {};
    var par = parFor(mission);
    var d = DIFF_MUL[diff] != null ? diff : difficultyKey();
    var mul = DIFF_MUL[d] || 1;

    var tScore = score01(n(st.time), par.time * 1.6, par.time * 0.8);
    var kScore = score01(n(st.kills), par.kills * 0.55, par.kills * 1.05);
    var sScore = score01(n(st.damageTaken), par.damage * 2, par.damage * 0.4);
    var retries = Math.max(0, Math.min(6, Math.round(n(st.retries))));
    if (retries > 0) sScore *= Math.pow(0.8, retries);
    var totalRelays = n(st.relaysTotal);
    var oScore = totalRelays > 0 ? clamp(n(st.relays) / totalRelays, 0, 1) : 1;

    var raw = (tScore * 0.3 + kScore * 0.25 + sScore * 0.3 + oScore * 0.15) * 100;
    var total = Math.round(clamp(raw * mul, 0, 100));
    var grade = total >= 85 ? "S" : total >= 70 ? "A" : total >= 50 ? "B" : "C";
    return {
      total: total,
      raw: Math.round(raw),
      grade: grade,
      labelKey: GRADE_LABEL[grade],
      label: t(GRADE_LABEL[grade]),
      diff: d,
      mul: mul,
      par: par,
      parts: {
        time: Math.round(tScore * 100),
        kills: Math.round(kScore * 100),
        surv: Math.round(sScore * 100),
        obj: Math.round(oScore * 100)
      }
    };
  }
  function hintFor(r) {
    if (r.total >= 85) return t("progress.hint.max");
    var next = r.total >= 70 ? "S" : r.total >= 50 ? "A" : "B";
    var target = r.total >= 70 ? 85 : r.total >= 50 ? 70 : 50;
    var worst = "time", wv = r.parts.time;
    if (r.parts.kills < wv) { worst = "kills"; wv = r.parts.kills; }
    if (r.parts.surv < wv) { worst = "surv"; wv = r.parts.surv; }
    if (r.parts.obj < wv) { worst = "obj"; wv = r.parts.obj; }
    var names = {
      time: "progress.hint.time", kills: "progress.hint.kills",
      surv: "progress.hint.surv", obj: "progress.hint.obj"
    };
    return t("progress.hint.next", { next: next, n: target - r.total, tip: t(names[worst]) });
  }

  /* ------------------------------------------------------------------ UI */
  function injectCSS() {
    if (document.getElementById("sx-prog-css")) return;
    var css = document.createElement("style");
    css.id = "sx-prog-css";
    css.textContent = [
      "/* ---- V34 成长系统 ---- */",
      ".m-debrief{max-height:88vh;overflow-y:auto;}",
      ".x-rate{margin:10px 0 4px;padding-top:8px;border-top:1px solid var(--line);}",
      ".x-rate .r{display:grid;grid-template-columns:46px 1fr 34px;align-items:center;gap:8px;margin:5px 0;}",
      ".x-rate .k{font:500 10px/1 var(--f-label);letter-spacing:.14em;color:var(--steel);}",
      ".x-rate .bar{height:4px;background:rgba(232,228,218,.14);}",
      ".x-rate .bar i{display:block;height:100%;background:var(--signal);}",
      ".x-rate .v{text-align:right;font:700 11px/1 var(--f-mono);color:var(--bone);}",
      ".x-rate .sum{margin-top:8px;font:500 11px/1.55 var(--f-mono);color:var(--steel);}",
      ".x-rate .sum b{color:var(--signal);font:700 14px/1 var(--f-display);letter-spacing:.06em;}",
      ".x-rate .sum em{display:block;font-style:normal;margin-top:3px;}",
      ".x-credit{margin-top:10px;padding:8px 10px;border:1px solid rgba(255,179,71,.3);background:rgba(255,179,71,.06);font:500 11px/1.5 var(--f-mono);color:var(--bone);}",
      ".x-credit b{font:700 16px/1 var(--f-display);color:var(--signal);margin-right:6px;}",
      ".x-credit em{display:block;font-style:normal;margin-top:3px;font-size:10px;line-height:1.5;color:var(--steel);}",
      ".x-prog-badge{margin-top:10px;font:500 11px/1.7 var(--f-mono);letter-spacing:.08em;color:var(--steel);}",
      ".x-prog-badge b{color:var(--signal);font-weight:700;}",
      ".x-prog-arc{margin:6px 0 12px;font:500 11px/1.7 var(--f-mono);letter-spacing:.08em;color:var(--steel);}",
      ".x-prog-arc b{color:var(--signal);font-weight:700;}",
      ".x-ar-balance{position:absolute;right:32px;top:30px;font:500 11px/1 var(--f-mono);letter-spacing:.08em;color:var(--steel);}",
      ".x-ar-balance b{font:700 17px/1 var(--f-display);color:var(--signal);margin-left:6px;}",
      ".x-ar-price{display:block;margin-top:5px;font:700 10px/1 var(--f-mono);letter-spacing:.08em;color:var(--signal);}",
      ".x-ar-opt.locked{opacity:.62;border-style:dashed;}",
      ".x-ar-opt.locked .x-ar-price{color:#ffb4a8;}",
      ".x-ar-lock{font-style:normal;font:600 8px/1 var(--f-label);letter-spacing:.12em;color:#ffb4a8;border:1px solid rgba(255,180,168,.4);padding:2px 3px;margin-left:4px;vertical-align:middle;}",
      ".x-ach{position:absolute;right:var(--gr);top:calc(96px + var(--sat));display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none;z-index:45;}",
      ".x-ach .i{min-width:210px;max-width:280px;padding:10px 14px 9px;border:1px solid rgba(255,179,71,.42);border-left:3px solid var(--signal);background:rgba(11,13,15,.86);box-shadow:0 12px 30px rgba(0,0,0,.45);opacity:0;transform:translateX(16px);transition:opacity .26s,transform .26s;}",
      ".x-ach .i.on{opacity:1;transform:none;}",
      ".x-ach .k{font:600 9px/1 var(--f-label);letter-spacing:.3em;color:var(--signal);text-transform:uppercase;}",
      ".x-ach .n{display:block;margin-top:5px;font:700 15px/1.1 var(--f-display);color:var(--bone);letter-spacing:.04em;}",
      ".x-ach .d{display:block;margin-top:4px;font:400 10px/1.35 var(--f-mono);color:var(--steel);}",
      ".x-pt{position:absolute;left:50%;bottom:calc(22% + var(--sab));transform:translate(-50%,8px);padding:7px 14px 6px;border-left:2px solid var(--signal);background:rgba(11,13,15,.72);font:600 12px/1.2 var(--f-label);letter-spacing:.1em;color:var(--bone);opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap;z-index:46;}",
      ".x-pt.on{opacity:1;transform:translate(-50%,0);}",
      ".x-pt.warn{border-left-color:var(--alarm);color:#ffb4a8;}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(css);
  }

  function ensureToast() {
    if (toastEl && toastEl.parentNode) return toastEl;
    toastEl = document.createElement("div");
    toastEl.className = "x-pt";
    (document.getElementById("ui") || document.body).appendChild(toastEl);
    return toastEl;
  }
  function notify(text, warn) {
    try {
      var el = ensureToast();
      el.textContent = String(text == null ? "" : text);
      el.classList.toggle("warn", !!warn);
      el.classList.add("on");
      if (el.__t) clearTimeout(el.__t);
      el.__t = setTimeout(function () { el.classList.remove("on"); }, 2200);
    } catch (e) {}
  }

  function ensureAchWrap() {
    if (achWrap && achWrap.parentNode) return achWrap;
    achWrap = document.createElement("div");
    achWrap.className = "x-ach";
    (document.getElementById("ui") || document.body).appendChild(achWrap);
    return achWrap;
  }
  function showAchievement(def, tier) {
    try {
      var wrap = ensureAchWrap();
      var item = document.createElement("div");
      item.className = "i";
      /* 标记 id/tier：ext_ui2 的成就浮层按属性重绘，不依赖中文原文反查 */
      item.setAttribute("data-sx-ach-id", def.id);
      item.setAttribute("data-sx-ach-tier", String(tier > 1 ? 2 : 1));
      item.innerHTML =
        '<div class="k">' + t(tier > 1 ? "ui2.ach.unlocked.master" : "ui2.ach.unlocked") + "</div>" +
        '<b class="n">' + achName(def) + "</b>" +
        '<span class="d">' + achDesc(def) + "</span>";
      wrap.appendChild(item);
      while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
      setTimeout(function () { item.classList.add("on"); }, 30);
      setTimeout(function () {
        item.classList.remove("on");
        setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 320);
      }, 2800);
      notify(t(tier > 1 ? "progress.ach.notifyMaster" : "progress.ach.notify", { name: achName(def) }));
      sfx("objective_done", { gain: 0.55, pitch: tier > 1 ? 1.15 : 1.45 });
      sfx("ui:click", { gain: 0.5, pitch: 1.2 });
    } catch (e) {}
  }

  function updateBadges() {
    if (!booted && !stats) return;
    var e = readEconomy();
    var got = achievementCount();
    var chal = n(stats && stats.challenges);
    var text = t("progress.badge", {
      credits: fmt(e.credits), got: got, total: ACHIEVEMENTS.length,
      chal: chal, chalTotal: challengeTotal()
    });
    var badge = document.querySelector(".x-prog-badge");
    if (!badge) {
      var title = document.querySelector(".m-title");
      if (title) {
        badge = document.createElement("div");
        badge.className = "x-prog-badge";
        var premise = title.querySelector(".m-premise");
        if (premise && premise.parentNode) premise.parentNode.insertBefore(badge, premise.nextSibling);
        else title.appendChild(badge);
      }
    }
    if (badge && badge.innerHTML !== text) badge.innerHTML = text;
    var arc = document.querySelector(".x-arc-panel");
    if (arc) {
      var ab = arc.querySelector(".x-prog-arc");
      if (!ab) {
        ab = document.createElement("div");
        ab.className = "x-prog-arc";
        var sub = arc.querySelector(".x-arc-sub");
        if (sub && sub.parentNode) sub.parentNode.insertBefore(ab, sub.nextSibling);
        else arc.appendChild(ab);
      }
      if (ab.innerHTML !== text) ab.innerHTML = text;
    }
  }
  function maybeBadge() {
    var at = nowMs();
    if (at - badgeAt < 400) return;
    badgeAt = at;
    updateBadges();
  }

  function partRow(label, value) {
    var pct = clamp(Math.round(n(value)), 0, 100);
    return '<div class="r"><span class="k">' + label + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><span class="v">' + pct + "</span></div>";
  }

  function renderDebriefRating(r, r0) {
    var panel = document.querySelector(".m-debrief");
    if (!panel) return;
    var ratingEl = panel.querySelector('[data-f="rating"]');
    if (ratingEl) ratingEl.textContent = r.grade;
    var old = panel.querySelector(".x-rate");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var box = document.createElement("div");
    box.className = "x-rate";
    lastRating = { r: r, r0: r0 };
    var detail = t("progress.debrief.detail", {
      time: clock(r0.time), par: clock(r.par.time),
      kills: r0.kills, parKills: r.par.kills,
      damage: Math.round(r0.damage), relays: r0.relays, total: r0.relaysTotal
    });
    var diffKey = DIFF_LABEL[r.diff];
    box.innerHTML =
      partRow(t("progress.debrief.time"), r.parts.time) +
      partRow(t("progress.debrief.kills"), r.parts.kills) +
      partRow(t("progress.debrief.surv"), r.parts.surv) +
      partRow(t("progress.debrief.obj"), r.parts.obj) +
      '<div class="sum">' + t("progress.debrief.sum", {
        grade: r.grade, label: t(r.labelKey), total: r.total,
        diff: diffKey ? t(diffKey) : r.diff, mul: r.mul.toFixed(2)
      }) + "<em>" + detail + "</em><em>" + hintFor(r) + "</em></div>";
    var rating = panel.querySelector(".m-rating");
    if (rating && rating.parentNode) rating.parentNode.insertBefore(box, rating.nextSibling);
    else panel.appendChild(box);
  }

  function renderDebriefCredits(r0) {
    var panel = document.querySelector(".m-debrief");
    if (!panel) return;
    var old = panel.querySelector(".x-credit");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var parts = r0.creditParts || {};
    var box = document.createElement("div");
    box.className = "x-credit";
    lastRunCredits = r0;
    box.innerHTML = t("progress.credit.run", { n: Math.round(n(r0.earned)) }) +
      "<em>" + t("progress.credit.parts", {
        kill: parts.kill | 0, head: parts.headshot | 0, elite: parts.elite | 0,
        boss: parts.boss | 0, mission: parts.mission | 0, balance: fmt(credits())
      }) + "</em>";
    var actions = panel.querySelector(".m-actions");
    panel.insertBefore(box, actions || null);
  }

  function renderTrainingCredits(gain, score) {
    var panel = document.querySelector(".x-tr-panel");
    if (!panel) return;
    var old = panel.querySelector(".x-credit");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var box = document.createElement("div");
    box.className = "x-credit";
    lastTraining = { gain: gain, score: score };
    box.innerHTML = t("progress.credit.run", { n: Math.round(gain) }) +
      "<em>" + t("progress.credit.train", { score: Math.round(score), balance: fmt(credits()) }) + "</em>";
    var actions = panel.querySelector(".x-tr-actions");
    panel.insertBefore(box, actions || null);
  }

  /* ------------------------------------------------------------- run 状态 */
  function newRun(training) {
    runSeq++;
    run = {
      seq: runSeq,
      training: !!training,
      kills: 0, headshots: 0, elite: 0, boss: 0, grenade: 0, melee: 0,
      damage: 0, earned: 0,
      creditParts: { kill: 0, headshot: 0, elite: 0, boss: 0, mission: 0 },
      time: 0, retries: 0, relays: 0, relaysTotal: 0,
      settled: false
    };
    stats.runs = n(stats.runs) + 1;
    lastHit = null;
    lastKill = null;
  }
  function activeRun() {
    if (!run) newRun(false);
    return run;
  }
  function addDamage(amount) {
    var v = n(amount);
    if (!(v > 0)) return;
    var r = activeRun();
    r.damage += v;
    stats.damageTaken = n(stats.damageTaken) + v;
  }

  /* --------------------------------------------------------------- 事件 */
  function onState(e) {
    if (!e) return;
    if (e.state === "intro") newRun(false);
    else if (e.state === "complete") settleMission();
    else if (e.state === "title") updateBadges();
  }

  /* enemy:hit 先于 enemy:killed 触发，用最后一次命中部位判断爆头 */
  function onEnemyHit(ev) {
    if (!ev || !ev.enemy) return;
    lastHit = { enemy: ev.enemy, part: ev.part || "body", at: nowMs() };
  }

  function grenadeKill(e) {
    if (!grenadeBlast || !e || !e.pos) return false;
    if (nowMs() - grenadeBlast.at > 1600) return false;
    var p = e.pos, b = grenadeBlast.pos;
    if (!b) return true;
    var dx = n(p.x) - n(b.x), dy = n(p.y) - n(b.y), dz = n(p.z) - n(b.z);
    return dx * dx + dy * dy + dz * dz <= 144;
  }

  function onKill(ev) {
    var e = ev && ev.enemy;
    if (!e || !booted) return;
    if (e.trainTarget || e.variant === "target") return;   // 靶机走训练分数折算
    // V37：去重键必须含 e.id —— 对象池复用后同一个 JS 对象会换 id，
    // 只用 runSeq 会把同局后续击杀全部吞掉。
    var killKey = runSeq + ":" + (e.id != null ? e.id : "");
    if (e.__sxProgId === killKey) return;                  // 同一目标只结算一次
    e.__sxProgId = killKey;

    var r = activeRun();
    var isBoss = !!e.boss || e.variant === "boss" || (ev && ev.type === "boss");
    var isElite = !isBoss && (!!e.elite || !!ELITE_VARIANTS[e.variant]);
    var isHead = !!(lastHit && lastHit.enemy === e && lastHit.part === "weak" &&
      nowMs() - lastHit.at < 600);
    var isGrenade = !isHead && grenadeKill(e);

    var gain = CREDIT.kill;
    r.creditParts.kill += CREDIT.kill;
    if (isHead) { gain += CREDIT.headshot; r.creditParts.headshot += CREDIT.headshot; }
    if (isElite) { gain += CREDIT.elite; r.creditParts.elite += CREDIT.elite; }
    if (isBoss) { gain += CREDIT.boss; r.creditParts.boss += CREDIT.boss; }

    r.kills++;
    if (isHead) r.headshots++;
    if (isElite) r.elite++;
    if (isBoss) r.boss++;
    if (isGrenade) { r.grenade++; stats.grenadeKills = n(stats.grenadeKills) + 1; }

    stats.kills = n(stats.kills) + 1;
    if (isHead) stats.headshots = n(stats.headshots) + 1;
    if (isElite) stats.eliteKills = n(stats.eliteKills) + 1;
    if (isBoss) stats.bossKills = n(stats.bossKills) + 1;

    r.earned += gain;
    addCredits(gain, "击杀");
    saveStats();
    lastKill = { enemy: e, at: nowMs() };
    checkAchievements();
  }

  /* 近战：meleeAttack() 先发 playerShot，再发 weapon:melee，回溯最近一次击杀 */
  function onMelee() {
    meleeAt = nowMs();
    if (!booted) return;
    var lk = lastKill;
    if (!lk || nowMs() - lk.at > 320 || lk.__melee) return;
    lk.__melee = true;
    stats.meleeKills = n(stats.meleeKills) + 1;
    var r = activeRun();
    r.melee++;
    saveStats();
    checkAchievements();
  }

  function onTrainingStart() {
    var S = state();
    if (S && S.training) S.training.__sxProgPaid = false;
    newRun(true);
  }

  function onTrainingEnd() {
    var S = state();
    var tr = S && S.training;
    if (!tr || !tr.active || tr.__sxProgPaid) return;
    tr.__sxProgPaid = true;
    var score = Math.max(0, Math.round(n(tr.score)));
    var gain = Math.max(0, Math.round(score * CREDIT.trainRate));
    addCredits(gain, "训练");
    stats.trainBest = Math.max(n(stats.trainBest), score);
    saveStats();
    checkAchievements();
    renderTrainingCredits(gain, score);
    updateBadges();
  }

  function settleMission() {
    var m = (G && G.game && G.game.currentMission) || {};
    if (m.id === "train") return;
    var r = activeRun();
    if (r.settled) return;
    r.settled = true;

    var gameRun = (G && G.game && G.game.run) || {};
    r.time = n(gameRun.time);
    r.retries = n(gameRun.retries);
    r.relays = n(gameRun.cut);
    r.relaysTotal = (gameRun.relays && gameRun.relays.length) || r.relaysTotal || 0;

    var diff = difficultyKey();
    var res = rate({
      time: r.time,
      kills: r.kills,
      damageTaken: r.damage,
      retries: r.retries,
      relays: r.relays,
      relaysTotal: r.relaysTotal
    }, m, diff);

    var missionGain = CREDIT.mission[diff] || CREDIT.mission.normal;
    r.creditParts.mission += missionGain;
    r.earned += missionGain;
    addCredits(missionGain, "任务");

    stats.missionsCleared = Math.max(n(stats.missionsCleared), countMissionsCleared());
    if (r.damage <= 0.001) stats.flawlessRuns = n(stats.flawlessRuns) + 1;
    if (r.time > 0 && r.time <= res.par.time) stats.speedRuns = n(stats.speedRuns) + 1;
    if (r.relaysTotal > 0 && r.relays >= r.relaysTotal) stats.fullRelayRuns = n(stats.fullRelayRuns) + 1;
    saveStats();
    checkAchievements();

    renderDebriefRating(res, r);
    renderDebriefCredits(r);
    updateBadges();
    setTimeout(function () { try { sync(); } catch (e) {} }, 700);
  }

  /* ------------------------------------------------------------ 挑战奖励 */
  function challengeCount() {
    try {
      var c = window.__SX && window.__SX.challenges ? window.__SX.challenges() : null;
      if (c && typeof c.count === "number") return Math.max(0, Math.round(c.count));
    } catch (e) {}
    return 0;
  }
  // V37：挑战总数动态（每关 3 项）；campaign 裁剪到 6 关时自动变 18。
  function challengeTotal() {
    try {
      if (window.__SX_CAMP && typeof window.__SX_CAMP.challengeTotal === "function") {
        var total = Math.round(window.__SX_CAMP.challengeTotal());
        if (total > 0) return total;
      }
      var ms = window.__SX_CAMP && window.__SX_CAMP.missions;
      if (ms && ms.length) return ms.length * 3;
    } catch (e) {}
    return 24;
  }
  function pollChallenges() {
    var count = challengeCount();
    if (count > n(stats.challenges)) stats.challenges = count;
    var awarded = stats.challengeRewards && typeof stats.challengeRewards === "object" ? stats.challengeRewards : {};
    var sum = 0, names = [];
    for (var i = 0; i < CHALLENGE_TIERS.length; i++) {
      var tier = CHALLENGE_TIERS[i];
      var key = String(tier);
      if (count >= tier && !awarded[key]) {
        awarded[key] = true;
        sum += CREDIT.challenge[tier] || 0;
        names.push(t(CROSS_AT[key] ? "progress.chal.tierCross" : "progress.chal.tier", {
          n: tier, reward: CROSS_AT[key] ? t(CROSS_AT[key]) : ""
        }));
      }
    }
    if (sum > 0) {
      stats.challengeRewards = awarded;
      saveStats();
      addCredits(sum, "挑战奖励");
      notify(t("progress.chal.notify", {
        count: count, total: challengeTotal(),
        names: names.join(t("progress.listSep")), sum: sum
      }));
      sfx("objective_done", { gain: 0.6, pitch: 1.15 });
    }
  }

  function countMissionsCleared() {
    var best = null;
    try {
      var c = window.__SX && window.__SX.campaign ? window.__SX.campaign() : null;
      best = c && c.best;
    } catch (e) { best = null; }
    if (!best || typeof best !== "object") return n(stats.missionsCleared);
    var count = 0;
    for (var k in best) if (has(best, k) && k !== "train" && best[k]) count++;
    return count;
  }

  /* --------------------------------------------------------------- 联机 */
  function pollMP() {
    var mp = window.__MP;
    if (!mp || typeof mp.state !== "function" || typeof mp.score !== "function") return;
    var st = null;
    try { st = mp.state(); } catch (e) { return; }
    if (!st || !st.active) { mpSeen = 0; return; }
    var score = null;
    try { score = mp.score(); } catch (e) { return; }
    if (!score || !score.players) return;
    var me = null;
    for (var i = 0; i < score.players.length; i++) if (score.players[i].id === st.selfId) me = score.players[i];
    if (!me) return;
    var kills = n(me.kills);
    if (kills > mpSeen) {
      stats.mpKills = n(stats.mpKills) + (kills - mpSeen);
      mpSeen = kills;
      saveStats();
      checkAchievements();
    }
  }

  /* -------------------------------------------------------------- 语言切换 */
  /* 数据表存 key，切换语言后按最近一次结算数据重绘，避免停留在旧语言 */
  function applyLang() {
    try { updateBadges(); } catch (e) {}
    try { if (lastRating) renderDebriefRating(lastRating.r, lastRating.r0); } catch (e) {}
    try { if (lastRunCredits) renderDebriefCredits(lastRunCredits); } catch (e) {}
    try { if (lastTraining) renderTrainingCredits(lastTraining.gain, lastTraining.score); } catch (e) {}
  }

  /* -------------------------------------------------------------- 观察器 */
  function watchClass(sel, cb) {
    var el = document.querySelector(sel);
    if (!el || el.__sxProgWatch) return;
    el.__sxProgWatch = true;
    try {
      new MutationObserver(function () { cb(el); }).observe(el, { attributes: true, attributeFilter: ["class"] });
    } catch (e) {}
  }

  function sync() {
    if (!booted) return;
    watchClass(".x-arch", function () {});
    watchClass(".x-arc", function () { updateBadges(); });
    watchClass(".x-armory", function (el) {
      if (!el.classList.contains("on")) return;
      try { if (window.__SX_ARMORY && window.__SX_ARMORY.refresh) window.__SX_ARMORY.refresh(); } catch (e) {}
      updateBadges();
    });
    pollChallenges();
    pollMP();
    var mc = countMissionsCleared();
    if (mc > n(stats.missionsCleared)) {
      stats.missionsCleared = mc;
      saveStats();
    }
    checkAchievements();
    updateBadges();
  }

  /* ---------------------------------------------------------- 调试接口 */
  function installDebug() {
    if (!window.__SX) return;
    window.__SX.unlockAllAttachments = function () {
      var e = readEconomy();
      var list = catalog();
      var added = 0;
      for (var i = 0; i < list.length; i++) {
        if ((list[i].price | 0) <= 0) continue;
        if (e.unlocked.indexOf(list[i].id) >= 0) continue;
        e.unlocked.push(list[i].id);
        added++;
      }
      writeEconomy(e);
      try { if (window.__SX_ARMORY && window.__SX_ARMORY.refresh) window.__SX_ARMORY.refresh(); } catch (err) {}
      notify("调试：已解锁全部配件（+" + added + "）");
      return added;
    };
  }

  /* ------------------------------------------------------------ 引导启动 */
  function boot() {
    if (booted) return;
    G = window.__G;
    booted = true;
    stats = normalizeStats(readStore("stats", {}));
    achCache = normalizeAchievements(readStore("achievements", {}));
    injectCSS();
    ensureToast();
    migrateEquipped();
    patchExplode();
    initEvents();
    installDebug();
    updateBadges();
    setTimeout(function () { try { sync(); } catch (e) {} }, 300);
    // PERF-4：页面不可见时不刷新成长/成就 DOM。
    var iv = setInterval(function () {
      if (document.hidden) return;
      try { sync(); } catch (e) {}
    }, 2000);
    if (iv && typeof iv.unref === "function") iv.unref();
    console.log("[ext] " + VERSION + " 成长系统已加载 · 信用点 " + fmt(credits()) + " · 成就 " + achievementCount() + "/" + ACHIEVEMENTS.length);
  }

  function patchExplode() {
    if (!G || !G.combat || typeof G.combat.explode !== "function" || G.combat.__sxProgWrapped) return;
    var base = G.combat.explode;
    G.combat.explode = function (pos, radius, damage, from) {
      var grenade = from === "player" && nowMs() - grenadeAt < 4000;
      var prev = grenadeBlast;
      if (grenade) grenadeBlast = { at: nowMs(), pos: pos };
      try {
        return base.apply(this, arguments);
      } finally {
        grenadeBlast = grenade ? null : prev;
      }
    };
    G.combat.__sxProgWrapped = true;
  }

  function initEvents() {
    G.events.on("game:state", onState);
    G.events.on("enemy:killed", onKill);
    G.events.on("enemy:hit", onEnemyHit);
    G.events.on("player:hit", function (ev) { if (ev && ev.amount > 0) addDamage(ev.amount); });
    G.events.on("sx:armor-absorb", function (ev) { if (ev && ev.amount > 0) addDamage(ev.amount); });
    G.events.on("weapon:melee", onMelee);
    G.events.on("sx:grenade", function () { grenadeAt = nowMs(); });
    G.events.on("sx:boss-dead", function () { try { checkAchievements(); } catch (e) {} });
    G.events.on("sx:training-start", onTrainingStart);
    G.events.on("sx:training-end", onTrainingEnd);
    G.events.on("sx:lang", applyLang);
  }

  /* --------------------------------------------------------- 公共接口 */
  window.__SX_PROGRESS = {
    version: VERSION,
    credits: credits,
    add: function (v) { return addCredits(v, "add"); },
    unlock: function (id) { return unlockAttachment(id); },
    achievements: listAchievements,
    evaluate: evaluate,
    /* 以下为测试 / 内部接口 */
    rate: function (stat, missionId, difficulty) {
      return rate(stat || {}, { id: missionId || (stat && stat.missionId) || "m1" }, difficulty);
    },
    isUnlocked: isUnlocked,
    purchase: purchase,
    notify: notify,
    sync: function () { sync(); return { credits: credits(), challenges: n(stats && stats.challenges) }; },
    stats: function () { return copy(stats || {}); },
    definitions: function () {
      var out = [];
      for (var i = 0; i < ACHIEVEMENTS.length; i++) {
        var src = ACHIEVEMENTS[i];
        var def = copy(src);
        def.name = achName(src);
        def.desc = achDesc(src);
        out.push(def);
      }
      return out;
    }
  };

  function wait() {
    var iv = setInterval(function () {
      var G0 = window.__G;
      if (G0 && G0.game && G0.events && G0.audio && G0.combat && window.__SX) {
        clearInterval(iv);
        try { boot(); } catch (e) {
          console.error("[ext] progress boot", e);
          try { if (window.SXErrors) SXErrors.report(e, { system: "progress", phase: "boot" }); } catch (err) {}
        }
      } else if (++tries > 600) {
        clearInterval(iv);
        console.error("[ext] progress: engine not ready");
      }
    }, 100);
  }
  wait();
})();
