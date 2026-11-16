/* =====================================================================
   SALTLINE · src/ext_net2.js — V36 网络 2.0 扩展（独立 IIFE）
   - 与 src/mp.js 分工：本文件提供可单测的纯函数（协议/预测回放/队列/
     URL/名字/错误码 / V37 id 映射与快照合并），并在浏览器里挂
     window.__SX_NET，补全大厅模式项。
   - Node 可 require 本文件；不会触碰 DOM（安装函数在无 document 时跳过）。
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.SX_NET2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 2;
  var BTN = Object.freeze({
    FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16, RELOAD: 32,
    MELEE: 64, GRENADE: 128, INTERACT: 256, SCAN: 512, LEAN_L: 1024, LEAN_R: 2048
  });
  var CAPS = Object.freeze(['bin']);
  var MAX_PENDING = 120;
  var DEFAULT_STEP = 1 / 30;

  function num(v, d) {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  /* V54 · 错误码/模式名走 SXI18n；词典缺键（Node 单测 / 旧构建）时回退中文。 */
  function netT(key, zh, vars) {
    try {
      var I = root && root.SXI18n;
      if (I && typeof I.t === 'function' && typeof I.has === 'function' && I.has(key)) return I.t(key, vars);
    } catch (e) { /* 取词失败回退中文 */ }
    var s = zh == null ? key : String(zh);
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, name) { return vars[name] == null ? '' : String(vars[name]); });
    return s;
  }

  function protocolLib() {
    if (root && root.SALT_NET && root.SALT_NET.decodeSnapshot) return root.SALT_NET;
    if (typeof require === 'function') {
      try { return require('../packages/net/protocol.js'); } catch (e) {}
    }
    return null;
  }
  function simLib() {
    if (root && root.SALT_SIM && root.SALT_SIM.stepPlayer) return root.SALT_SIM;
    if (typeof require === 'function') {
      try { return require('../packages/sim'); } catch (e) {}
    }
    return null;
  }

  /* ------------------------------------------------------------ 名字 / URL */
  var HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeText(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return HTML_MAP[c]; });
  }
  function sanitizeName(name, fallback) {
    var s = String(name == null ? '' : name)
      .replace(/[\u0000-\u001f\u007f<>"'&\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
    return s || fallback || '猫';
  }
  function validateUrl(raw) {
    var u = String(raw == null ? '' : raw).trim();
    if (!u) return { ok: false, error: 'empty_url', message: netT('ui2.mp.err.empty_url', '请输入服务器地址') };
    var parsed;
    try { parsed = new URL(u); } catch (e) { return { ok: false, error: 'bad_url', message: netT('ui2.mp.err.bad_url', '地址格式无效（只允许 ws:// 或 wss://）') }; }
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { ok: false, error: 'bad_scheme', message: netT('ui2.mp.err.bad_scheme', '只允许 ws:// 或 wss:// 地址') };
    }
    if (!parsed.hostname) return { ok: false, error: 'bad_host', message: netT('ui2.mp.err.bad_host', '服务器地址缺少主机名') };
    return { ok: true, url: parsed.href };
  }

  /* ------------------------------------------------------------ 错误码 */
  var ERR_TEXT = {
    dev_disabled: ['ui2.mp.err.dev_disabled', '服务器未开启调试指令（dev 已禁用）'],
    dev_denied: ['ui2.mp.err.dev_denied', '调试指令令牌无效'],
    room_full: ['ui2.mp.err.room_full', '房间已满，请换一个房间或稍后再试'],
    full: ['ui2.mp.err.full', '房间已满，请换一个房间或稍后再试'],
    bad_name: ['ui2.mp.err.bad_name', '呼号不合法（2–12 个字，仅中英文/数字/下划线/连字符）'],
    bad_json: ['ui2.mp.err.bad_json', '服务器无法解析消息'],
    bad_message: ['ui2.mp.err.bad_message', '消息格式不完整'],
    not_joined: ['ui2.mp.err.not_joined', '尚未加入房间'],
    unknown_type: ['ui2.mp.err.unknown_type', '服务器不认识该指令'],
    version_mismatch: ['ui2.mp.err.version_mismatch', '协议版本不匹配，请刷新页面后重试'],
    protocol_mismatch: ['ui2.mp.err.protocol_mismatch', '协议版本不匹配，请刷新页面后重试'],
    rate_limit: ['ui2.mp.err.rate_limit', '操作过于频繁，已被服务器限速'],
    timeout: ['ui2.mp.err.timeout', '连接超时，请检查服务器地址与网络'],
    offline: ['ui2.mp.err.offline', '网络已断开，正在尝试重连'],
    fire_rejected: ['ui2.mp.err.fire_rejected', '射击被服务器拒绝，弹药已回滚'],
    shot_rejected: ['ui2.mp.err.shot_rejected', '射击被服务器拒绝，弹药已回滚'],
    aim_mismatch: ['ui2.mp.err.aim_mismatch', '射击方向与视角不一致，已被服务器拒绝'],
    reloading: ['ui2.mp.err.reloading', '换弹中，无法开火'],
    dead: ['ui2.mp.err.dead', '已阵亡，等待重生'],
    round_end: ['ui2.mp.err.round_end', '回合已结束，无法开火'],
    no_ammo: ['ui2.mp.err.no_ammo', '弹药不足，已被服务器拒绝'],
    no_reserve: ['ui2.mp.err.no_reserve', '备弹不足'],
    cooldown: ['ui2.mp.err.cooldown', '射速过快，已被服务器拒绝'],
    fire_rate: ['ui2.mp.err.fire_rate', '射速过快，已被服务器拒绝'],
    invalid: ['ui2.mp.err.invalid', '射击数据不合法，已被服务器拒绝'],
    '4001': ['ui2.mp.err.room_full', '房间已满，请换一个房间或稍后再试'],
    '4008': ['ui2.mp.err.rate_limit', '操作过于频繁，已被服务器限速']
  };
  // V54：getter 在调用时取词，切语言后错误提示跟着变（不在模块加载时固化）。
  var ERRORS = {};
  Object.keys(ERR_TEXT).forEach(function (code) {
    Object.defineProperty(ERRORS, code, {
      enumerable: true,
      get: function () { return netT(ERR_TEXT[code][0], ERR_TEXT[code][1]); }
    });
  });
  function friendlyError(code, message) {
    var key = code == null ? '' : String(code);
    if (Object.prototype.hasOwnProperty.call(ERRORS, key) && typeof ERRORS[key] === 'string') return ERRORS[key];
    if (typeof message === 'string' && message.trim()) return String(message).slice(0, 160);
    return key
      ? netT('ui2.mp.err.withCode', '服务器错误（{code}）', { code: key.slice(0, 32) })
      : netT('ui2.mp.err.server', '服务器错误');
  }

  /* ------------------------------------------------------------ id / nid 映射
     服务器二进制快照里的玩家 id 是数值 netId，welcome/join/score 里是字符串
     id（外加数值 nid）。这里维护双向映射，所有协议入口都先 resolve 成字符串
     id，避免“自己认不出自己 / 双份模型 / ack 永不清”。 */
  function IdMap() {
    this.byNid = Object.create(null);
    this.byId = Object.create(null);
  }
  IdMap.prototype.clear = function () {
    this.byNid = Object.create(null);
    this.byId = Object.create(null);
    return this;
  };
  /** 注册 id(nid)；nid 缺失时回退原 id（旧 JSON 服务器 / 无 nid 的 welcome）。 */
  IdMap.prototype.register = function (id, nid) {
    if (id == null && nid == null) return null;
    var sid = String(id != null ? id : nid);
    var nidv = nid != null ? nid : (id != null ? id : null);
    this.byNid[String(nidv)] = sid;
    this.byId[sid] = nidv;
    return sid;
  };
  IdMap.prototype.registerPlayer = function (p) {
    if (!p) return null;
    var id = p.id != null ? p.id : (p.nid != null ? p.nid : null);
    if (id == null) return null;
    var nid = p.nid != null ? p.nid : (p.netId != null ? p.netId : null);
    return this.register(id, nid);
  };
  IdMap.prototype.setSelf = function (id, nid) {
    this.selfId = this.register(id, nid);
    return this.selfId;
  };
  IdMap.prototype.nidOf = function (id) {
    if (id == null) return null;
    return this.byId[String(id)];
  };
  /** 任意协议 id -> 字符串逻辑 id（幂等；未知 id 原样字符串化）。 */
  IdMap.prototype.resolve = function (id) {
    if (id == null) return null;
    var k = String(id);
    if (this.byNid[k] != null) return this.byNid[k];
    if (this.byId[k] != null) return k;
    return k;
  };

  /* ------------------------------------------------------------ 快照 baseline */
  function keyOf(id) { return String(id); }
  function mergeBaseline(prev, list) {
    var out = new Map();
    if (prev instanceof Map) prev.forEach(function (v, k) { out.set(k, v); });
    else if (prev && typeof prev === 'object') Object.keys(prev).forEach(function (k) { out.set(k, prev[k]); });
    (list || []).forEach(function (p) {
      if (!p || p.id == null) return;
      var k = keyOf(p.id);
      var old = out.get(k) || {};
      var merged = {};
      for (var a in old) merged[a] = old[a];
      for (var b in p) merged[b] = p[b];
      out.set(k, merged);
    });
    return out;
  }

  /** 二进制快照帧合并：
   *  - full=true（baseline===0）：按本帧集合重建，返回 removed（离开玩家 key）
   *  - full=false：沿用 baseline 中未出现的玩家（增量帧只带变化玩家）
   *  players 已由调用方把 raw.id 解析成字符串 id。
   */
  function mergeFrame(prev, players, full) {
    var out = new Map();
    var incoming = new Set();
    var list = players || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || p.id == null) continue;
      var k = keyOf(p.id);
      var old = null;
      if (!full && prev) old = prev instanceof Map ? prev.get(k) : prev[k];
      var merged = {};
      if (old) for (var a in old) merged[a] = old[a];
      for (var b in p) merged[b] = p[b];
      merged.id = p.id;
      out.set(k, merged);
      incoming.add(k);
    }
    var removed = [];
    if (prev) {
      var keys = prev instanceof Map ? Array.from(prev.keys()) : Object.keys(prev);
      for (var j = 0; j < keys.length; j++) {
        var pk = keys[j];
        if (incoming.has(pk)) continue;
        if (full) { removed.push(pk); continue; }
        out.set(pk, prev instanceof Map ? prev.get(pk) : prev[pk]);
      }
    }
    return { list: Array.from(out.values()), removed: removed };
  }

  /* ------------------------------------------------------------ 预测队列 */
  function seqLE(a, b) { return Number(a) <= Number(b); }
  /** 丢弃 pending[0].seq <= ack（ACK 帧与快照 self.seq 共用同一清理逻辑）。 */
  function dropAcked(items, ackSeq) {
    var n = 0;
    if (!items) return 0;
    while (items.length && seqLE(items[0].seq, ackSeq)) { items.shift(); n++; }
    return n;
  }
  /** ACK 帧的 seq 是 u32 完整序号：只允许前进（重启后回退则保持原值）。 */
  function nextAck(lastAcked, seq) {
    var last = Number(lastAcked) || 0;
    var v = Number(seq);
    if (!Number.isFinite(v) || v < 0) return last;
    return v > last ? v : last;
  }
  /** resetPrediction 用：lastAcked 不回 0，避免 >1024 的 seq 被当成 u8 回绕。 */
  function clampAck(lastAcked, seq) {
    return Math.max(Number(lastAcked) || 0, Number(seq) || 0);
  }
  function PredictionQueue(max) {
    this.max = Math.max(1, Number(max) || MAX_PENDING);
    this.items = [];
  }
  PredictionQueue.prototype.push = function (item) {
    this.items.push(item);
    var dropped = 0;
    while (this.items.length > this.max) { this.items.shift(); dropped++; }
    return dropped;
  };
  PredictionQueue.prototype.dropAcked = function (ackSeq) { return dropAcked(this.items, ackSeq); };
  PredictionQueue.prototype.pending = function () { return this.items.slice(); };
  PredictionQueue.prototype.size = function () { return this.items.length; };
  PredictionQueue.prototype.clear = function () { this.items.length = 0; };
  /** 8 位 seq 回绕 -> 完整 seq（服务端二进制快照用 u8）。
   *  v >= last 时直接采用：ACK 帧是 u32 完整序号（可能 >1024），
   *  旧实现用 v-last<1024 判定会把 3008 误判成 -120，导致 pending 永不清。 */
  function resolveAck(raw, lastAcked) {
    var v = Number(raw);
    if (!Number.isFinite(v) || v < 0) return null;
    var last = Number(lastAcked) || 0;
    if (v >= last) return v;
    var cand = (last & ~255) | (v & 255);
    if (cand < last - 128) cand += 256;
    if (cand > last + 128) cand -= 256;
    return cand;
  }

  /* ------------------------------------------------------------ 回放 */
  function copyState(st, base) {
    if (!st || !base) return st;
    var pos = base.pos || base;
    if (pos && typeof pos.x === 'number') { st.pos.x = pos.x; st.pos.y = num(pos.y, 0); st.pos.z = num(pos.z, 0); }
    if (base.vel && typeof base.vel.x === 'number') { st.vel.x = base.vel.x; st.vel.y = num(base.vel.y, 0); st.vel.z = base.vel.z; }
    var fields = ['yaw', 'pitch', 'onGround', 'crouching', 'crouch01', 'ads', 'adsLin', 'sprinting',
      'height', 'radius', 'alive', 'health', 'maxHealth', 'prevButtons', 'tick', 'jumpBuf', 'coyote',
      'slideT', 'vaultT', 'lean', 'sinceDamage'];
    for (var i = 0; i < fields.length; i++) {
      var k = fields[i];
      if (base[k] !== undefined) st[k] = base[k];
    }
    if (base.spawnProtect !== undefined) st.spawnProtect = base.spawnProtect;
    return st;
  }
  function replay(world, base, cmds, step, tuning) {
    var S = simLib();
    if (!S || !world) return null;
    base = base || {};
    var st = S.createPlayerState(world, base.pos || base.spawn || base, tuning);
    copyState(st, base);
    var h = Number(step) > 0 ? Number(step) : DEFAULT_STEP;
    for (var i = 0; i < (cmds || []).length; i++) {
      var c = cmds[i] || {};
      S.stepPlayer(st, {
        mx: num(c.mx, 0), my: num(c.my, 0), yaw: num(c.yaw, 0), pitch: num(c.pitch, 0),
        buttons: num(c.buttons, 0) | 0, tick: num(c.tick, i) | 0
      }, world, h, tuning);
    }
    return st;
  }
  function dist(a, b) {
    if (!a || !b) return Infinity;
    var dx = num(a.x, 0) - num(b.x, 0);
    var dy = num(a.y, 0) - num(b.y, 0);
    var dz = num(a.z, 0) - num(b.z, 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /* ------------------------------------------------------------ 射击拒绝 / 回合 */
  /** 按 shotSeq 找到被拒绝的 pendingShots 条目（服务端会回带 shotSeq）；
   *  老服务器没有 shotSeq 时回退为最后一条。返回 { shot, index }。 */
  function takeShotForReject(shots, shotSeq) {
    if (!shots || !shots.length) return { shot: null, index: -1 };
    if (shotSeq != null && Number.isFinite(Number(shotSeq))) {
      var target = Number(shotSeq);
      for (var i = shots.length - 1; i >= 0; i--) {
        if (Number(shots[i] && shots[i].seq) === target) {
          return { shot: shots.splice(i, 1)[0], index: i };
        }
      }
    }
    var idx = shots.length - 1;
    return { shot: shots.pop(), index: idx };
  }
  /** 采用服务端权威弹药（mag/reserve，兼容 ammo 字段）；无字段时回滚到开枪前。 */
  function rollbackAmmo(weapon, msg, shot) {
    if (!weapon) return null;
    msg = msg || {};
    var out = { ammo: null, reserve: null, applied: false };
    var ammo = msg.mag != null ? msg.mag : (msg.ammo != null ? msg.ammo : null);
    if (ammo == null && shot && shot.ammoBefore != null) ammo = shot.ammoBefore;
    if (ammo != null && Number.isFinite(Number(ammo))) {
      var v = Math.max(0, Number(ammo) | 0);
      if (weapon.magSize != null) v = Math.min(v, weapon.magSize | 0);
      weapon.ammo = v;
      out.ammo = v;
      out.applied = true;
    }
    var reserve = msg.reserve != null ? msg.reserve : (shot && shot.reserveBefore != null ? shot.reserveBefore : null);
    if (reserve != null && Number.isFinite(Number(reserve))) {
      weapon.reserve = Math.max(0, Number(reserve) | 0);
      out.reserve = weapon.reserve;
      out.applied = true;
    }
    return out;
  }
  /** roundEnd 比分：优先 m.teams（服务端已改为据点分），其次 m.score，最后沿用旧值。 */
  function roundTeams(m, fallback) {
    if (m && Array.isArray(m.teams) && m.teams.length >= 2) return [m.teams[0] | 0, m.teams[1] | 0];
    if (m && Array.isArray(m.score) && m.score.length >= 2) return [m.score[0] | 0, m.score[1] | 0];
    if (Array.isArray(fallback) && fallback.length >= 2) return [fallback[0] | 0, fallback[1] | 0];
    return [0, 0];
  }

  /* ------------------------------------------------------------ 模式 / 文本 */
  // 服务端只支持 tdm / chaos / domination；个人乱斗已移除，未知模式不再默认 tdm。
  var MODE_TEXT = {
    tdm: ['ui2.mp.modeName.tdm', '团队死斗'],
    chaos: ['ui2.mp.modeName.chaos', '大乱战'],
    domination: ['ui2.mp.modeName.domination', '据点争夺'],
    dom: ['ui2.mp.modeName.domination', '据点争夺'],
    bomb: ['ui2.mp.modeName.bomb', '爆破'],
    coop: ['ui2.mp.modeName.coop', '潮汐防线'],
    pve: ['ui2.mp.modeName.coop', '潮汐防线']
  };
  var MODE_NAMES = {};
  Object.keys(MODE_TEXT).forEach(function (key) {
    Object.defineProperty(MODE_NAMES, key, {
      enumerable: true,
      get: function () { return netT(MODE_TEXT[key][0], MODE_TEXT[key][1]); }
    });
  });
  function modeKey(mode) {
    var m = String(mode == null ? '' : mode).toLowerCase();
    if (!m) return '';
    if (m === 'dom' || m === 'control' || m === 'capture') return 'domination';
    if (m === 'pve' || m === 'coop' || m === 'survival') return 'coop';
    if (m === 'bomb' || m === 'defuse') return 'bomb';
    if (m === 'tdm' || m === 'chaos' || m === 'domination') return m;
    return '';
  }
  function modeName(mode) { return MODE_NAMES[modeKey(mode)] || netT('mp.mode.unknown', '未知模式'); }

  function addLobbyMode() {
    if (typeof document === 'undefined') return false;
    var sel = document.querySelector('[data-mp-mode]');
    if (!sel) return false;
    if (!sel.querySelector('option[value="domination"]')) {
      var opt = document.createElement('option');
      opt.value = 'domination';
      opt.textContent = netT('ui2.mp.mode.domination', '据点争夺 · 5v5');
      sel.appendChild(opt);
    }
    try {
      var stored = localStorage.getItem('saltline.mp.mode');
      if (stored && sel.querySelector('option[value="' + stored + '"]')) sel.value = stored;
    } catch (e) {}
    return true;
  }

  function install(MP) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    var mp = MP || window.__MP;
    if (!mp || !mp.net2) return false;
    window.__SX_NET = {
      version: VERSION,
      state: function () { return mp.net2.state(); },
      sendCmd: function (cmd) { return mp.net2.sendCmd(cmd); },
      pending: function () { return mp.net2.pending(); },
      reconcileStats: function () { return mp.net2.reconcileStats(); },
      rtt: function () { return mp.net2.rtt(); },
      protocol: mp.net2.protocol,
      caps: CAPS,
      escape: escapeText,
      sanitizeName: sanitizeName,
      validateUrl: validateUrl,
      errorText: friendlyError,
      modes: MODE_NAMES,
      ready: true
    };
    addLobbyMode();
    return true;
  }

  var api = {
    VERSION: VERSION,
    CAPS: CAPS,
    BTN: BTN,
    MAX_PENDING: MAX_PENDING,
    DEFAULT_STEP: DEFAULT_STEP,
    protocol: protocolLib,
    sim: simLib,
    escapeText: escapeText,
    sanitizeName: sanitizeName,
    validateUrl: validateUrl,
    friendlyError: friendlyError,
    IdMap: IdMap,
    mergeBaseline: mergeBaseline,
    mergeFrame: mergeFrame,
    PredictionQueue: PredictionQueue,
    dropAcked: dropAcked,
    nextAck: nextAck,
    clampAck: clampAck,
    resolveAck: resolveAck,
    takeShotForReject: takeShotForReject,
    rollbackAmmo: rollbackAmmo,
    roundTeams: roundTeams,
    replay: replay,
    copyState: copyState,
    dist: dist,
    modes: MODE_NAMES,
    modeKey: modeKey,
    modeName: modeName,
    addLobbyMode: addLobbyMode,
    install: install
  };

  /* 浏览器里 ext 脚本先于本文件加载 MP；轮询等待 MP.init 完成。 */
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && root === window) {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (window.__SX_NET && window.__SX_NET.ready) { clearInterval(timer); return; }
      if (window.__MP && window.__MP.net2) {
        try { install(window.__MP); } catch (e) { console.error('[net2] install', e); }
        clearInterval(timer);
        return;
      }
      if (tries > 600) clearInterval(timer);
    }, 50);
  }

  return api;
});
