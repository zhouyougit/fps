/* =====================================================================
   V32 · 核心底座：本地化底座（WP32-9）
   UMD：浏览器 window.SXI18n / Node module.exports
   zh-CN 为全量基础文案；en 提供同键翻译；缺失键回退 zh-CN 再回退 key。
   DOM 约定：data-i18n="key" / data-i18n-attr="title:key,aria-label:key2"
            可选 data-i18n-vars='{"n":3}'
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SXI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LANG_KEY = "saltline.lang";
  var LANGS = ["zh-CN", "en"];

  var ZH = {
    "ui.title.game": "几猫 · SALTLINE",
    "ui.title.sub": "单兵行动 · 潮线协议",
    "ui.menu.start": "开始行动",
    "ui.menu.continue": "继续行动",
    "ui.menu.campaign": "战役",
    "ui.menu.training": "训练场",
    "ui.menu.armory": "军械库",
    "ui.menu.settings": "设置",
    "ui.menu.mp": "联机对战",
    "ui.menu.quit": "返回标题",
    "ui.menu.resume": "继续",
    "ui.menu.confirm": "确认",
    "ui.menu.cancel": "取消",
    "ui.menu.back": "返回",
    "ui.menu.close": "关闭",
    "ui.menu.apply": "应用",
    "ui.menu.reset": "恢复默认",
    "ui.menu.export": "导出存档",
    "ui.menu.import": "导入存档",
    "ui.pause.title": "已暂停",
    "ui.pause.resume": "继续行动",
    "ui.pause.settings": "设置",
    "ui.pause.restart": "重新开始",
    "ui.pause.exit": "返回标题",
    "ui.pause.confirmRestart": "确认重新开始？",
    "ui.pause.hint": "按 Esc 继续",
    "ui.settings.title": "设置",
    "ui.settings.graphics": "画面",
    "ui.settings.audio": "音频",
    "ui.settings.controls": "操控",
    "ui.settings.accessibility": "可访问性",
    "ui.settings.quality": "画质",
    "ui.settings.quality.auto": "自动",
    "ui.settings.quality.low": "低",
    "ui.settings.quality.medium": "中",
    "ui.settings.quality.high": "高",
    "ui.settings.quality.ultra": "极高",
    "ui.settings.sens": "鼠标灵敏度",
    "ui.settings.invertY": "反转 Y 轴",
    "ui.settings.fov": "视野",
    "ui.settings.volume.master": "主音量",
    "ui.settings.volume.music": "音乐",
    "ui.settings.volume.sfx": "音效",
    "ui.settings.volume.voice": "语音",
    "ui.settings.hudScale": "HUD 缩放",
    "ui.settings.subtitle": "字幕大小",
    "ui.settings.contrast": "高对比度",
    "ui.settings.reduceMotion": "减少动态",
    "ui.settings.difficulty": "难度",
    "ui.settings.difficulty.recruit": "新兵",
    "ui.settings.difficulty.normal": "标准",
    "ui.settings.difficulty.veteran": "老兵",
    "ui.settings.difficulty.nightmare": "噩梦",
    "ui.settings.shake": "镜头晃动",
    "ui.settings.shake.low": "弱",
    "ui.settings.shake.std": "标准",
    "ui.settings.shake.high": "强",
    "ui.settings.crosshair": "准星颜色",
    "ui.settings.lang": "语言",
    "ui.settings.lang.zh": "中文",
    "ui.settings.lang.en": "English",
    "ui.settings.binds": "按键绑定",
    "ui.settings.on": "开启",
    "ui.settings.off": "关闭",
    "hud.health": "生命",
    "hud.armor": "护甲",
    "hud.ammo": "弹药",
    "hud.objective": "目标",
    "hud.objective.cut_relays": "切断中继",
    "hud.objective.survive": "坚守撤离点",
    "hud.objective.extract": "前往撤离点",
    "hud.objective.destroy": "摧毁目标",
    "hud.wave": "第 {n} 波",
    "hud.enemies": "剩余敌人",
    "hud.kills": "击杀",
    "hud.deaths": "死亡",
    "hud.score": "比分",
    "hud.time": "剩余时间",
    "hud.ping": "延迟",
    "hud.reload": "换弹中",
    "hud.noAmmo": "弹药耗尽",
    "hud.lowHealth": "生命垂危",
    "hud.grenade": "手雷",
    "hud.scan": "战术扫描",
    "hud.interact": "按住 {key} 互动",
    "hud.checkpoint": "检查点",
    "hud.dead": "阵亡",
    "hud.respawn": "{n} 秒后重生",
    "hud.team.blue": "蓝队",
    "hud.team.red": "红队",
    "action.start": "开始",
    "action.resume": "继续",
    "action.restart": "重新开始",
    "action.retry": "重试",
    "action.exit": "退出",
    "action.join": "加入战斗",
    "action.leave": "离开",
    "action.ready": "准备",
    "action.vote": "投票",
    "action.skip": "跳过",
    "action.next": "下一步",
    "action.confirm": "确认",
    "action.cancel": "取消",
    "action.save": "保存",
    "action.load": "读取",
    "result.title": "行动结算",
    "result.success": "行动完成",
    "result.failure": "行动失败",
    "result.time": "用时",
    "result.kills": "击杀",
    "result.accuracy": "命中率",
    "result.damage": "承受伤害",
    "result.rank": "评级",
    "result.rank.s": "S 级",
    "result.rank.a": "A 级",
    "result.rank.b": "B 级",
    "result.rank.c": "C 级",
    "result.newRecord": "新纪录",
    "result.challenge": "挑战",
    "result.continue": "继续",
    "result.retry": "再试一次",
    "result.exit": "返回标题",
    "result.ending.silent": "静默结局",
    "result.ending.open": "公开结局",
    "radio.command": "指挥中心",
    "radio.squad": "小队频道",
    "radio.enemy": "敌方信号",
    "system.disabled": "{system} 已停用",
    "system.error": "系统错误",
    "system.saved": "已保存",
    "system.loaded": "已读取",
    "system.importFailed": "存档读取失败",
    "system.exported": "存档已导出",
    "mission.m1.name": "四号泊位",
    "mission.m2.name": "仓库区",
    "mission.m3.name": "码头封锁",
    "mission.m4.name": "冷链仓库",
    "mission.m5.name": "外锚地",
    "mission.m6.name": "归途",
    "enemy.hound": "机械猎犬",
    "enemy.gull": "机械飞鸥",
    "enemy.drone": "自爆无人机",
    "enemy.turret": "固定炮台",
    "enemy.boss": "蜃",
    "ui.mp.name": "呼号",
    "ui.mp.room": "房间",
    "ui.mp.url": "服务器",
    "ui.mp.map": "地图",
    "ui.mp.mode": "模式",
    "ui.mp.join": "加入战斗",
    "ui.mp.vote": "下一张地图",
    "ui.mp.waiting": "等待玩家",
    "ui.mp.players": "{n} 在线"
  };

  var EN = {
    "ui.title.game": "SALTLINE",
    "ui.title.sub": "Solo Operation · Saltline Protocol",
    "ui.menu.start": "Start Operation",
    "ui.menu.continue": "Continue",
    "ui.menu.campaign": "Campaign",
    "ui.menu.training": "Training",
    "ui.menu.armory": "Armory",
    "ui.menu.settings": "Settings",
    "ui.menu.mp": "Multiplayer",
    "ui.menu.quit": "Return to Title",
    "ui.menu.resume": "Resume",
    "ui.menu.confirm": "Confirm",
    "ui.menu.cancel": "Cancel",
    "ui.menu.back": "Back",
    "ui.menu.close": "Close",
    "ui.menu.apply": "Apply",
    "ui.menu.reset": "Reset to Defaults",
    "ui.menu.export": "Export Save",
    "ui.menu.import": "Import Save",
    "ui.pause.title": "Paused",
    "ui.pause.resume": "Resume",
    "ui.pause.settings": "Settings",
    "ui.pause.restart": "Restart",
    "ui.pause.exit": "Return to Title",
    "ui.pause.confirmRestart": "Restart this operation?",
    "ui.pause.hint": "Press Esc to resume",
    "ui.settings.title": "Settings",
    "ui.settings.graphics": "Graphics",
    "ui.settings.audio": "Audio",
    "ui.settings.controls": "Controls",
    "ui.settings.accessibility": "Accessibility",
    "ui.settings.quality": "Quality",
    "ui.settings.quality.auto": "Auto",
    "ui.settings.quality.low": "Low",
    "ui.settings.quality.medium": "Medium",
    "ui.settings.quality.high": "High",
    "ui.settings.quality.ultra": "Ultra",
    "ui.settings.sens": "Mouse Sensitivity",
    "ui.settings.invertY": "Invert Y Axis",
    "ui.settings.fov": "Field of View",
    "ui.settings.volume.master": "Master Volume",
    "ui.settings.volume.music": "Music",
    "ui.settings.volume.sfx": "SFX",
    "ui.settings.volume.voice": "Voice",
    "ui.settings.hudScale": "HUD Scale",
    "ui.settings.subtitle": "Subtitle Size",
    "ui.settings.contrast": "High Contrast",
    "ui.settings.reduceMotion": "Reduce Motion",
    "ui.settings.difficulty": "Difficulty",
    "ui.settings.difficulty.recruit": "Recruit",
    "ui.settings.difficulty.normal": "Normal",
    "ui.settings.difficulty.veteran": "Veteran",
    "ui.settings.difficulty.nightmare": "Nightmare",
    "ui.settings.shake": "Camera Shake",
    "ui.settings.shake.low": "Low",
    "ui.settings.shake.std": "Standard",
    "ui.settings.shake.high": "High",
    "ui.settings.crosshair": "Crosshair Color",
    "ui.settings.lang": "Language",
    "ui.settings.lang.zh": "中文",
    "ui.settings.lang.en": "English",
    "ui.settings.binds": "Key Binds",
    "ui.settings.on": "On",
    "ui.settings.off": "Off",
    "hud.health": "Health",
    "hud.armor": "Armor",
    "hud.ammo": "Ammo",
    "hud.objective": "Objective",
    "hud.objective.cut_relays": "Cut the relays",
    "hud.objective.survive": "Hold the extraction point",
    "hud.objective.extract": "Reach extraction",
    "hud.objective.destroy": "Destroy the target",
    "hud.wave": "Wave {n}",
    "hud.enemies": "Enemies Remaining",
    "hud.kills": "Kills",
    "hud.deaths": "Deaths",
    "hud.score": "Score",
    "hud.time": "Time Left",
    "hud.ping": "Ping",
    "hud.reload": "Reloading",
    "hud.noAmmo": "Out of Ammo",
    "hud.lowHealth": "Critical Health",
    "hud.grenade": "Grenade",
    "hud.scan": "Tactical Scan",
    "hud.interact": "Hold {key} to interact",
    "hud.checkpoint": "Checkpoint",
    "hud.dead": "Killed in Action",
    "hud.respawn": "Respawning in {n}s",
    "hud.team.blue": "Blue Team",
    "hud.team.red": "Red Team",
    "action.start": "Start",
    "action.resume": "Resume",
    "action.restart": "Restart",
    "action.retry": "Retry",
    "action.exit": "Exit",
    "action.join": "Join Match",
    "action.leave": "Leave",
    "action.ready": "Ready",
    "action.vote": "Vote",
    "action.skip": "Skip",
    "action.next": "Next",
    "action.confirm": "Confirm",
    "action.cancel": "Cancel",
    "action.save": "Save",
    "action.load": "Load",
    "result.title": "Operation Report",
    "result.success": "Operation Complete",
    "result.failure": "Operation Failed",
    "result.time": "Time",
    "result.kills": "Kills",
    "result.accuracy": "Accuracy",
    "result.damage": "Damage Taken",
    "result.rank": "Rating",
    "result.rank.s": "Rank S",
    "result.rank.a": "Rank A",
    "result.rank.b": "Rank B",
    "result.rank.c": "Rank C",
    "result.newRecord": "New Record",
    "result.challenge": "Challenge",
    "result.continue": "Continue",
    "result.retry": "Try Again",
    "result.exit": "Return to Title",
    "result.ending.silent": "Silent Ending",
    "result.ending.open": "Open Ending",
    "radio.command": "Command",
    "radio.squad": "Squad Channel",
    "radio.enemy": "Hostile Signal",
    "system.disabled": "{system} disabled",
    "system.error": "System error",
    "system.saved": "Saved",
    "system.loaded": "Loaded",
    "system.importFailed": "Failed to load save",
    "system.exported": "Save exported",
    "mission.m1.name": "Berth Four",
    "mission.m2.name": "Warehouse",
    "mission.m3.name": "Dock Blockade",
    "mission.m4.name": "Cold Storage",
    "mission.m5.name": "Outer Anchorage",
    "mission.m6.name": "Homeward",
    "enemy.hound": "Mechanical Hound",
    "enemy.gull": "Mechanical Gull",
    "enemy.drone": "Suicide Drone",
    "enemy.turret": "Fixed Turret",
    "enemy.boss": "Shen",
    "ui.mp.name": "Callsign",
    "ui.mp.room": "Room",
    "ui.mp.url": "Server",
    "ui.mp.map": "Map",
    "ui.mp.mode": "Mode",
    "ui.mp.join": "Join Match",
    "ui.mp.vote": "Next Map",
    "ui.mp.waiting": "Waiting for players",
    "ui.mp.players": "{n} online"
  };

  var dict = { "zh-CN": ZH, en: EN };
  var fallback = ZH;
  var lang = "zh-CN";
  var listeners = [];

  function normalizeLang(value) {
    if (!value) return "zh-CN";
    var s = String(value).replace("_", "-").toLowerCase();
    if (s === "en" || s.indexOf("en-") === 0) return "en";
    return "zh-CN";
  }

  function storageGet(key) {
    try {
      if (typeof localStorage !== "undefined" && localStorage &&
          typeof localStorage.getItem === "function") return localStorage.getItem(key);
    } catch (e) { /* ignore */ }
    return null;
  }
  function storageSet(key, value) {
    try {
      if (typeof localStorage !== "undefined" && localStorage &&
          typeof localStorage.setItem === "function") {
        localStorage.setItem(key, value);
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // 启动时读取浏览器语言偏好
  (function () {
    var saved = storageGet(LANG_KEY);
    if (saved) lang = normalizeLang(saved);
  })();

  function activeDict() {
    return dict[lang] || fallback;
  }

  function t(key, vars) {
    var s = activeDict()[key];
    if (s == null) s = fallback[key];
    if (s == null) {
      try {
        if (typeof globalThis !== "undefined" && globalThis.__DEV__ &&
            typeof console !== "undefined" && console.warn) console.warn("[i18n] missing", key);
      } catch (e) { /* ignore */ }
      return key;
    }
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (_, name) {
      var v = vars[name];
      return v == null ? "" : String(v);
    });
  }

  function setLang(next, options) {
    lang = normalizeLang(next);
    storageSet(LANG_KEY, lang);
    try {
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
      }
    } catch (e) { /* ignore */ }
    var snapshot = listeners.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try { snapshot[i](lang); } catch (e) { /* listener 隔离 */ }
    }
    if (!options || options.apply !== false) applyDom();
    return lang;
  }

  function getLang() { return lang; }

  function readVars(el) {
    if (!el || typeof el.getAttribute !== "function") return null;
    var text = el.getAttribute("data-i18n-vars");
    if (!text) return null;
    try {
      var parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) { return null; }
  }

  function applyAttrSpec(el, spec, vars) {
    var changed = 0;
    var pairs = String(spec).split(/[;,]/);
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      if (!pair) continue;
      var idx = pair.indexOf(":");
      if (idx < 0) idx = pair.indexOf("=");
      if (idx <= 0) continue;
      var attr = pair.slice(0, idx).trim();
      var key = pair.slice(idx + 1).trim();
      if (!attr || !key) continue;
      try {
        if (typeof el.setAttribute === "function") {
          el.setAttribute(attr, t(key, vars));
          changed++;
        }
      } catch (e) { /* ignore */ }
    }
    return changed;
  }

  function applyDom(root) {
    if (!root) {
      if (typeof document === "undefined") return 0;
      root = document;
    }
    if (!root || typeof root.querySelectorAll !== "function") return 0;
    var count = 0;
    var nodes = [];
    try { nodes = root.querySelectorAll("[data-i18n]"); } catch (e) { nodes = []; }
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || typeof el.getAttribute !== "function") continue;
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      try {
        el.textContent = t(key, readVars(el));
        count++;
      } catch (e) { /* ignore */ }
    }
    try { nodes = root.querySelectorAll("[data-i18n-attr]"); } catch (e) { nodes = []; }
    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      if (!node || typeof node.getAttribute !== "function") continue;
      var spec = node.getAttribute("data-i18n-attr");
      if (!spec) continue;
      count += applyAttrSpec(node, spec, readVars(node));
    }
    return count;
  }

  function has(key) {
    return activeDict()[key] != null || fallback[key] != null;
  }

  function keys() { return Object.keys(activeDict()); }

  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }
  function offChange(fn) {
    var i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  }

  function extend(language, map) {
    var l = normalizeLang(language);
    if (!dict[l]) dict[l] = {};
    if (map && typeof map === "object") {
      for (var k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k)) dict[l][k] = map[k];
      }
    }
    return dict[l];
  }

  return {
    LANG_KEY: LANG_KEY,
    LANGS: LANGS,
    dict: dict,
    fallback: fallback,
    t: t,
    setLang: setLang,
    getLang: getLang,
    normalizeLang: normalizeLang,
    applyDom: applyDom,
    has: has,
    keys: keys,
    onChange: onChange,
    offChange: offChange,
    extend: extend,
    translate: t
  };
});
