#!/usr/bin/env node
'use strict';
/**
 * server.cjs — 几猫 · SALTLINE V37 联机服务端（协议 2.0）
 *
 * 关键能力:
 *   - HTTP + WebSocket 同端口；JSON 旧协议完全兼容，caps:['bin'] 客户端走二进制快照
 *   - 模拟 60Hz（TICK_HZ）、快照 30Hz（SNAP_HZ）；二进制快照按玩家变更增量
 *   - 输入回放：每玩家 <=120 条命令，seq 去重 / 乱序丢弃 / 限速；V53 SRV-9 有界追赶
 *     （backlog>4 时每 tick 消费 2-3 条），持续负载下队列不会无界增长
 *   - 延迟补偿：保存 1 秒命中体历史，按 RTT/2（0-200ms）回滚做射线
 *   - 逐武器权威结算：伤害 / 射速 / 弹匣 / 换弹 / 弹丸 / 衰减 / 穿透 / 护甲 / 爆头
 *   - 比赛状态机 warmup -> live -> roundEnd -> next，平分加时
 *   - 模式：tdm / chaos / domination（3 据点、占领、每秒得分）
 *   - 机器人补位到 4v4（BOTS=0 关闭），与真人走同一套模拟与武器路径
 *   - Origin 白名单、名字/房间/模式白名单、消息大小与速率限制、可选 PROFILE_TOKEN
 *   - /healthz 扩展、/metrics Prometheus 文本（可选 METRICS_TOKEN）、可选 JSON 日志
 *   - POST/GET /api/profile + server/profiles.json（异步串行原子写），联机击杀给 XP
 *   - V37 质量修复：逐客户端 ACK 小帧、ws ping/pong 真实 RTT、respawn/roundStart 武器字段、
 *     据点分 roundEnd、未知模式明确报错、命令队列满拒绝、500ms 无输入停走、全 bin 不序列化 JSON
 *   - V53：开火只走显式 fire（人控命令 FIRE 忽略；机器人保留）、shotRejected 回带 shotSeq/弹药、
 *     掉海走正常死亡、输入队列有界追赶、XFF 取最右合法项、metrics 模拟步/回调耗时拆分、
 *     静态读流 error 处理、慢漂移快照强制包含
 *
 * 只依赖 Node 内置模块 + server/node_modules/ws + packages/sim + packages/net/protocol.js。
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const netmod = require('node:net');

const sim = require('../packages/sim');
const SALT_NET = require('../packages/net/protocol.js');

let WebSocketServer;
let WebSocket;
try {
  const ws = require('ws');
  WebSocketServer = ws.WebSocketServer;
  WebSocket = ws.WebSocket;
} catch (e) {
  console.error('[fatal] 缺少 ws 模块。NUC 上应已存在 ~/node_modules/ws；本地可执行 npm install --prefix server ws。');
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
function envNum(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}
function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}
function envList(name) {
  return String(process.env[name] || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

const PORT = envNum('PORT', 9100);
const HOST = process.env.HOST || '0.0.0.0';
const TICK_HZ = Math.max(20, Math.min(120, envInt('TICK_HZ', 60)));
const SNAP_HZ = Math.max(5, Math.min(TICK_HZ, envInt('SNAP_HZ', 30)));
const STEP = 1 / TICK_HZ;
const STEP_MS = 1000 / TICK_HZ;
const SNAP_EVERY = Math.max(1, Math.round(TICK_HZ / SNAP_HZ));
const SNAP_FULL_EVERY = Math.max(30, TICK_HZ * 2); // 每 2 秒发一次全量，纠正增量的链路错误
const MAX_PLAYERS = Math.max(2, Math.min(16, envInt('MAX_PLAYERS', 12)));
const MAX_ROOMS = Math.max(1, envInt('MAX_ROOMS', 128));
const MAX_CONNS_PER_IP = Math.max(1, envInt('MAX_CONNS_PER_IP', 32));
const MAX_MSG_RATE = Math.max(30, envInt('MAX_MSG_RATE', 240));
const MAX_CMD_RATE = Math.max(30, envInt('MAX_CMD_RATE', 240));
const MAX_CMD_QUEUE = Math.max(4, envInt('MAX_CMD_QUEUE', 120));
const MAX_MESSAGE_BYTES = Math.max(1024, envInt('MAX_MESSAGE_BYTES', 16 * 1024));
const JOIN_TIMEOUT_MS = Math.max(1000, envInt('JOIN_TIMEOUT_MS', 5000));
const RESPAWN_MS = Math.max(500, envInt('RESPAWN_MS', 3000));
const WARMUP_SECONDS_RAW = process.env.WARMUP_SECONDS;
// 兼容 WP32 回合计时测试：显式设置 ROUND_SECONDS 且未设置 WARMUP_SECONDS 时视为“测试/运维接管”，
// warmup 归零，回合从加入即开始。生产部署建议显式设置 WARMUP_SECONDS=8。
const WARMUP_SECONDS = WARMUP_SECONDS_RAW !== undefined
  ? Math.max(0, envInt('WARMUP_SECONDS', 8))
  : (process.env.ROUND_SECONDS !== undefined ? 0 : 8);
const ROUND_SECONDS = envNum('ROUND_SECONDS', 0);
const SCORE_LIMIT = envNum('SCORE_LIMIT', 0);
const OVERTIME_SECONDS = envNum('OVERTIME_SECONDS', 60);
const ROUND_END_MS = envNum('ROUND_END_MS', 8000);
const BOTS_TARGET = Math.max(0, Math.min(16, envInt('BOTS', 0)));
const BOT_SKILL = Math.max(0, Math.min(2, envInt('BOT_SKILL', 1)));
const DOM_SCORE_LIMIT = envNum('DOM_SCORE_LIMIT', 200);
const DOM_CAPTURE_SECONDS = envNum('DOM_CAPTURE_SECONDS', 6);
const DOM_SCORE_INTERVAL_MS = envNum('DOM_SCORE_INTERVAL_MS', 1000);
const DEV_TOKEN = process.env.MP_DEV_TOKEN || '';
const PROFILE_TOKEN = process.env.PROFILE_TOKEN || '';
const METRICS_TOKEN = process.env.METRICS_TOKEN || '';
const ORIGIN_WHITELIST = envList('ORIGIN_WHITELIST');
// V37：真实 RTT 由 ws ping/pong 每 2 秒采样；回滚以服务端测得 RTT 为准。
const RTT_PING_MS = 2000;
const REWIND_BASE_MS = 100;
const REWIND_MAX_MS = 250;
const LOG_JSON = envBool('LOG_JSON', false);
const TRUST_PROXY = envBool('TRUST_PROXY', false);
const NAME_MAX = 16;
const MAP_FILE = path.resolve(__dirname, process.env.MAP_FILE || 'map_boxes.json');
const MAPS_FILE = path.resolve(__dirname, process.env.MAPS_FILE || 'maps.json');
const MAP_DATA_DIR = path.resolve(__dirname, process.env.MAP_DATA_DIR || '../packages/data/maps');
const WEAPON_DATA_DIR = path.resolve(__dirname, process.env.WEAPON_DATA_DIR || '../packages/data/weapons');
const PROFILES_FILE = path.resolve(__dirname, process.env.PROFILES_FILE || 'profiles.json');
const PROFILES_BAK_FILE = PROFILES_FILE + '.bak';
// V39：profiles.json 单进程保护。锁文件与数据文件同目录；wx 原子创建。
// V53 SRV-2：锁持有期间每 5 秒刷新心跳；只有「心跳过期」+「持有者进程已退出」才允许回收。
const PROFILE_LOCK_FILE = PROFILES_FILE + '.lock';
const PROFILE_LOCK_STALE_MS = Math.max(100, envInt('PROFILE_LOCK_STALE_MS', 30000));
const PROFILE_LOCK_HEARTBEAT_MS = process.env.PROFILE_LOCK_HEARTBEAT_MS
  ? Math.max(50, envInt('PROFILE_LOCK_HEARTBEAT_MS', 5000))
  : Math.max(50, Math.min(5000, Math.floor(PROFILE_LOCK_STALE_MS / 3)));
// V53 SRV-11：档案数量上限 + 过期清理。0 表示不限制（默认 5000 / 180 天）。
const PROFILE_MAX = envInt('PROFILE_MAX', 5000);
const PROFILE_TTL_DAYS = envNum('PROFILE_TTL_DAYS', 180);
const PROFILE_TTL_MS = PROFILE_TTL_DAYS > 0 ? PROFILE_TTL_DAYS * 86400000 : 0;
// V53 SRV-3：单条 JSON input 最多接受 8 条命令；审计日志按 player+reason 限频。
const MAX_CMDS_PER_INPUT = Math.max(1, envInt('MAX_CMDS_PER_INPUT', 8));
const AUDIT_LOG_INTERVAL_MS = Math.max(0, envInt('AUDIT_LOG_INTERVAL_MS', 2000));
// V53 SRV-7：房间连续模拟异常达到阈值后关闭该房间，避免坏房间拖垮进程。
const ROOM_FAIL_LIMIT = Math.max(1, envInt('ROOM_FAIL_LIMIT', 5));
const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;
const STARTED_AT = Date.now();

// V53 SRV-9：输入队列有界追赶。backlog>4 时每 tick 消费 2 条，>12 时 3 条；
// 持续 60Hz 负载下队列不会再从 120 上限一路堆成约 2 秒的输入延迟。
const CMD_CATCHUP_BACKLOG = 4;
const CMD_CATCHUP_MAX = 3;
// V53 NET-3：增量快照按“每个接收者上次真正发出去的位姿”判定慢漂移。
// 协议自身的 sameSnapshot 阈值是 0.01m/0.002rad，慢速移动每帧都低于它而被永久跳过；
// 这里用更大的强制阈值 + 0.5 秒兜底，保证慢速玩家不会 2 秒不更新。
const SNAP_FORCE_POS = 0.03;
const SNAP_FORCE_YAW = 0.02;
const SNAP_FORCE_AGE_TICKS = Math.max(SNAP_EVERY, Math.round(TICK_HZ * 0.5));

// 指标 / 日志（放在单元导出块之前：SALT_UNIT_EXPORT 会提前 return）。
const metrics = {
  tickRing: [],
  tickLast: 0,
  // V53 SRV-13：模拟步耗时与一次定时器回调的总耗时分开两个 ring，不再混在一起。
  callbackRing: [],
  callbackLast: 0,
  snapWindow: [],
  snapBytesTotal: 0,
  snapFrames: 0,
  snapForced: 0,
  lagcompHits: 0,
  lagcompShots: 0,
  shotsRejected: 0,
  rejectReasons: Object.create(null),
  audit: 0,
  auditReasons: Object.create(null),
  auditSuppressed: 0,
  cmdsTruncated: 0,
  roomErrors: 0,
  roomsClosed: 0,
  msgsIn: 0,
  msgsOut: 0,
  rateLimited: 0,
  cmdDropped: 0,
  cmdOutOfOrder: 0,
  cmdQueueFull: 0,
  cmdCatchup: 0,
  cmdQueueLen: 0,
  cmdQueuePeak: 0,
  acksSent: 0,
  jsonSnapEncodes: 0,
  originRejected: 0,
  profileRequests: 0,
  ioErrors: 0,
  profilesPruned: 0,
  profilesEvicted: 0,
};

// V53 SRV-8：模拟时钟统一为 tick 基准。真实世界时间（ws RTT/ping、HTTP、审计日志、
// 速率窗口）仍用 Date.now；射速/换弹/复活/回合计时/延迟补偿历史全部用 simNowMs()。
// 主循环每次 simulate() 都调用 advanceSimClock()，追帧多步时时间逐步递进，不会同一步内冻结。
let tick = 0;
function simTimeForTick(t) {
  return (Number(t) || 0) * STEP_MS;
}
function simNowMs() {
  return simTimeForTick(tick);
}
function advanceSimClock() {
  tick++;
  return simNowMs();
}

// V53 NET-2：移动常量不再在服务器维护副本，直接复用 packages/sim 的 DEFAULT_TUNING。
// 服务器只覆盖三个“服务器语义”字段：
//   rescueDepth  —— 共享代码的掉海自救在服务器上会绕过 SRV-4 的死亡流程，这里关掉，
//                   由 server 自己的 seaY 判定走 beginDeath。
//   maxHealth/regenRate —— 服务器血量由 p.hp（护甲/伤害管线）权威管理，禁掉 sim 的内部回血。
const SERVER_TUNING = Object.freeze(Object.assign({}, sim.movement.DEFAULT_TUNING, {
  rescueDepth: 1e9,
  maxHealth: Infinity,
  regenRate: 0,
}));

const SIM_STATE_FIELDS = [
  'pos', 'vel', 'onGround', 'crouching', 'sprinting', 'ads', 'adsLin', 'crouch01',
  'coyote', 'jumpBuf', 'slideT', 'slideDirX', 'slideDirZ', 'vaultT',
  'vaultFromX', 'vaultFromY', 'vaultFromZ', 'vaultToX', 'vaultToY', 'vaultToZ',
  'lean', 'height', 'radius', 'speed', 'surface', 'lastSafe', 'airTime',
  'peakFallSpeed', 'prevButtons', 'tick', 'jumped', 'landed', 'landSpeed',
  'hitWall', 'hitCeil', 'rescued', 'vaulted', 'fell',
];

// V53 SRV-10：X-Forwarded-For 解析。只接受合法 IP；从右往左取（最右项由可信代理追加），
// 左侧客户端自填的条目一律忽略。远端连接声称来自回环地址时视为伪造，忽略整条 XFF。
function normalizeIp(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (s.charAt(0) === '[') {
    const end = s.indexOf(']');
    if (end > 0) s = s.slice(1, end);
  } else {
    const first = s.indexOf(':');
    if (first > 0 && first === s.lastIndexOf(':') && s.indexOf('.') > 0) s = s.slice(0, first);
  }
  s = s.split('%')[0];
  if (s.indexOf('::ffff:') === 0) s = s.slice(7);
  return netmod.isIP(s) ? s : '';
}
function parseForwardedFor(xff, fallback) {
  if (typeof xff !== 'string' || !xff) return fallback;
  const parts = xff.split(',');
  for (let i = parts.length - 1; i >= 0; i--) {
    const ip = normalizeIp(parts[i]);
    if (ip) return ip;
  }
  return fallback;
}
function forwardedClientIp(xff, socketIp, trust) {
  if (!trust) return socketIp;
  const ip = parseForwardedFor(xff, '');
  if (!ip) return socketIp;
  if (isLoopbackIp(ip) && !isLoopbackIp(socketIp)) return socketIp;
  return ip;
}
function angleDelta(a, b) {
  let d = (numOr(a, 0) - numOr(b, 0)) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function snapshotForceDue(last, cur, ageTicks) {
  if (!last || !cur) return true;
  if (Math.hypot(cur.x - last.x, cur.z - last.z) > SNAP_FORCE_POS) return true;
  if (Math.abs(cur.y - last.y) > SNAP_FORCE_POS) return true;
  if (Math.abs(angleDelta(cur.yaw, last.yaw)) > SNAP_FORCE_YAW) return true;
  return (Number(ageTicks) || 0) >= SNAP_FORCE_AGE_TICKS;
}

// V53：纯函数便于单元测试。SALT_UNIT_EXPORT=1 时只导出这些函数，不启动服务器/定时器。
function lockReclaimable(heartbeatAgeMs, staleMs, ownerAlive) {
  return heartbeatAgeMs > staleMs && !ownerAlive;
}
function snapshotDue(currentTick, lastSnapTick, every) {
  return currentTick - lastSnapTick >= every;
}
if (process.env.SALT_UNIT_EXPORT === '1') {
  module.exports = {
    lockReclaimable,
    snapshotDue,
    parseForwardedFor,
    forwardedClientIp,
    normalizeIp,
    snapshotForceDue,
    metrics,
    recordTick,
    recordCallback,
    tickP99,
    callbackP99,
    SNAP_FORCE_POS,
    SNAP_FORCE_YAW,
    SNAP_FORCE_AGE_TICKS,
    MAX_CMDS_PER_INPUT,
    PROFILE_LOCK_STALE_MS,
    PROFILE_LOCK_HEARTBEAT_MS,
    PROFILE_MAX,
    PROFILE_TTL_MS,
    PROFILE_TTL_DAYS,
    SERVER_TUNING,
    simTimeForTick,
    simNowMs,
    advanceSimClock,
    // 函数声明会提升，即使 SALT_UNIT_EXPORT 在文件中部 return 也能导出；
    // 单测用它们验证服务器 stepPlayer 与客户端 packages/sim 逐步一致。
    initPlayerMovement,
    stepPlayer,
  };
  return;
}



const DEFAULT_SPAWN = { x: -32, z: 6 };
const TEAM_BASES = [{ x: -32, z: 6 }, { x: 29, z: 20 }];

const MODES = Object.assign(Object.create(null), {
  tdm: { id: 'tdm', name: '团队死斗', maxPlayers: 8, scoreLimit: 50, roundSeconds: 300, domination: false },
  chaos: { id: 'chaos', name: '大乱战', maxPlayers: 12, scoreLimit: 75, roundSeconds: 360, domination: false },
  domination: { id: 'domination', name: '据点争夺', maxPlayers: 10, scoreLimit: DOM_SCORE_LIMIT, roundSeconds: 300, domination: true },
});
const MODE_IDS = Object.keys(MODES);

const BTN = (sim.command && sim.command.BTN) || {
  FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16, RELOAD: 32, MELEE: 64,
  GRENADE: 128, INTERACT: 256, SCAN: 512, LEAN_L: 1024, LEAN_R: 2048,
};
const ALL_BUTTONS = (sim.command && sim.command.ALL_BUTTONS) || 4095;
const ZERO_CMD = Object.freeze({ seq: 0, tick: 0, mx: 0, my: 0, yaw: 0, pitch: 0, buttons: 0, slot: 0, slotExplicit: false });

// ---------------------------------------------------------------------------
// 日志
// ---------------------------------------------------------------------------
function log(level, msg, data) {
  const line = { ts: new Date().toISOString(), level: level || 'info', msg: msg };
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) line[k] = data[k];
  }
  if (LOG_JSON) {
    console.log(JSON.stringify(line));
  } else {
    const extra = data && Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    console.log('[' + line.level + '] ' + msg + extra);
  }
}

// V53 SRV-3：审计日志按 player+reason 限频。指标每一条都计数，日志最多每 2 秒一条，
// 被压掉的条数在下一条日志的 suppressed 字段里汇总，避免一条 5000 命令的消息刷出数千行。
const auditLogState = new Map();
function audit(code, player, detail) {
  metrics.audit++;
  metrics.auditReasons[code] = (metrics.auditReasons[code] || 0) + 1;
  const now = Date.now();
  const key = (player && player.id ? player.id : 'anon') + '|' + code;
  let state = auditLogState.get(key);
  if (!state) {
    if (auditLogState.size >= 4096) auditLogState.clear();
    state = { at: 0, suppressed: 0 };
    auditLogState.set(key, state);
  }
  if (AUDIT_LOG_INTERVAL_MS > 0 && now - state.at < AUDIT_LOG_INTERVAL_MS) {
    state.suppressed++;
    metrics.auditSuppressed++;
    return;
  }
  const suppressed = state.suppressed;
  state.at = now;
  state.suppressed = 0;
  const payload = Object.assign({
    id: player ? player.id : null,
    name: player ? player.name : null,
  }, detail || {});
  if (suppressed) payload.suppressed = suppressed;
  log('warn', 'audit ' + code, payload);
}

// V53 SRV-13：tickRing 只记“单个模拟步”耗时；callbackRing 记一次 tick 定时器回调里
// 所有步骤 + 快照 + 其他工作的总耗时。两者不再混在一个 ring 里。
function pushRing(ring, ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  ring.push(ms);
  if (ring.length > 600) ring.shift();
}
function ringP99(ring) {
  if (!ring.length) return 0;
  const sorted = ring.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
}
function recordTick(ms) {
  metrics.tickLast = ms;
  pushRing(metrics.tickRing, ms);
}
function recordCallback(ms) {
  metrics.callbackLast = ms;
  pushRing(metrics.callbackRing, ms);
}
function tickP99() {
  return ringP99(metrics.tickRing);
}
function callbackP99() {
  return ringP99(metrics.callbackRing);
}
function pruneSnapWindow(now, keepMs) {
  const win = metrics.snapWindow;
  const cutoff = now - (keepMs || 2000);
  let i = 0;
  while (i < win.length && win[i].t < cutoff) i++;
  if (i > 0) win.splice(0, i);
  if (win.length > 50000) win.splice(0, win.length - 50000);
}
function snapKbps(now) {
  pruneSnapWindow(now, 1000);
  const win = metrics.snapWindow;
  let bytes = 0;
  for (let i = 0; i < win.length; i++) bytes += win[i].bytes;
  return (bytes * 8) / 1000;
}
function readRateLimit() {
  return MAX_MSG_RATE;
}

// ---------------------------------------------------------------------------
// 世界 / 地图
// ---------------------------------------------------------------------------
let world;
let spawnPoints = [];
// V53 SRV-5：客户端传入的 map 名只做自有属性查找，__proto__/constructor 不能命中原型。
let MAPS = Object.create(null);

function makeWorld(spec) {
  const g = spec.ground || {};
  return sim.createWorld(spec.boxes || [], {
    bounds: spec.bounds,
    groundY: spec.groundY != null ? spec.groundY : g.y,
    seaY: spec.seaY != null ? spec.seaY : (g.seaY != null ? g.seaY : -9999),
    quayX: spec.quayX != null ? spec.quayX : (g.quayX != null ? g.quayX : 9999),
  });
}

// 据点争夺点位：优先地图数据 modePoints.domination，其次中继站，再次区域中心，最后按边界均分。
function buildDominationPoints(spec, worldObj) {
  const w = worldObj || spec.world;
  const explicit = spec.modePoints && spec.modePoints.domination;
  const raw = [];
  function push(id, x, z, y, radius) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (x < w.bounds.min.x || x > w.bounds.max.x || z < w.bounds.min.z || z > w.bounds.max.z) return;
    const gy = Number.isFinite(y) ? y : w.groundHeight(x, z, 8);
    raw.push({
      id: id, x: x, y: gy, z: z,
      radius: Number.isFinite(radius) && radius > 0 ? radius : 4.0,
      owner: -1, progress: 0, contested: false,
    });
  }
  if (Array.isArray(explicit) && explicit.length >= 3) {
    const ids = ['A', 'B', 'C'];
    for (let i = 0; i < Math.min(3, explicit.length); i++) {
      const p = explicit[i];
      const x = Array.isArray(p.pos) ? p.pos[0] : (p.x != null ? p.x : p.pos && p.pos.x);
      const z = Array.isArray(p.pos) ? p.pos[2] : (p.z != null ? p.z : p.pos && p.pos.z);
      const y = Array.isArray(p.pos) ? p.pos[1] : (p.y != null ? p.y : p.pos && p.pos.y);
      push(p.id || ids[i], x, z, y, p.radius);
    }
  }
  if (raw.length < 3 && Array.isArray(spec.relays) && spec.relays.length >= 3) {
    const ids = ['A', 'B', 'C'];
    for (let i = 0; i < 3; i++) {
      const r = spec.relays[i];
      const pos = r.pos || r.position || [];
      push(r.id || ids[i], pos[0], pos[2], pos[1]);
    }
  }
  if (raw.length < 3 && Array.isArray(spec.zones) && spec.zones.length >= 3) {
    const ids = ['A', 'B', 'C'];
    const zones = spec.zones.filter(function (z) { return z && z.min && z.max; });
    for (let i = 0; i < Math.min(3, zones.length); i++) {
      const z = zones[i];
      push(z.id || ids[i], (z.min[0] + z.max[0]) / 2, (z.min[2] + z.max[2]) / 2);
    }
  }
  if (raw.length < 3) {
    raw.length = 0;
    const b = w.bounds;
    push('A', b.min.x + (b.max.x - b.min.x) * 0.25, (b.min.z + b.max.z) / 2);
    push('B', (b.min.x + b.max.x) / 2, b.min.z + (b.max.z - b.min.z) * 0.75);
    push('C', b.min.x + (b.max.x - b.min.x) * 0.75, b.min.z + (b.max.z - b.min.z) * 0.25);
  }
  return raw.slice(0, 3);
}

function loadDataMaps() {
  const out = Object.create(null);
  try {
    const indexFile = path.join(MAP_DATA_DIR, 'index.json');
    if (!fs.existsSync(indexFile)) return out;
    const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    for (const id of Object.keys(idx.maps || {})) {
      const file = path.join(MAP_DATA_DIR, idx.maps[id].file || (id + '.map.json'));
      if (!fs.existsSync(file)) continue;
      const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
      spec.id = id;
      spec.groundY = spec.groundY != null ? spec.groundY : (spec.ground ? spec.ground.y : 0);
      spec.seaY = spec.seaY != null ? spec.seaY : (spec.ground ? spec.ground.seaY : null);
      spec.quayX = spec.quayX != null ? spec.quayX : (spec.ground ? spec.ground.quayX : null);
      spec.teamBases = (spec.spawns && spec.spawns.team || []).map(function (t) {
        return { x: t.pos[0], z: t.pos[2], yaw: t.yaw || 0, radius: t.radius || 9 };
      });
      const teamSpawns = [];
      for (const t of (spec.spawns && spec.spawns.team) || []) {
        const bx = t.pos[0], bz = t.pos[2];
        teamSpawns.push({ x: bx, z: bz, team: t.team });
        for (const e of (spec.spawns && spec.spawns.enemy) || []) {
          if (Math.hypot(e.pos[0] - bx, e.pos[2] - bz) <= 9) {
            teamSpawns.push({ x: e.pos[0], z: e.pos[2], team: t.team });
          }
        }
      }
      spec.mpSpawns = teamSpawns;
      spec.world = makeWorld(spec);
      spec.modePoints = spec.modePoints || {};
      spec.modePoints.domination = buildDominationPoints(spec, spec.world);
      out[id] = spec;
      log('info', 'map ' + id, { boxes: spec.world.boxes.count, domPoints: spec.modePoints.domination.length });
    }
  } catch (e) {
    log('error', 'map data pipeline failed', { error: e.message });
  }
  return out;
}

function fatalMapsError(message) {
  log('fatal', 'maps.json invalid; refusing to start (no fallback to map_boxes.json)', {
    file: MAPS_FILE,
    error: message,
  });
  console.error('[fatal] maps.json 解析失败，拒绝启动：' + message);
  console.error('[fatal] 数据文件：' + MAPS_FILE);
  console.error('[fatal] 不回退到旧 map_boxes.json；请修复 maps.json 后再启动。');
  process.exit(1);
}

function loadMapsFile() {
  if (!fs.existsSync(MAPS_FILE)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
  } catch (e) {
    fatalMapsError(e.message);
  }
  const list = raw && raw.maps ? raw.maps : raw;
  if (!list || typeof list !== 'object' || Array.isArray(list)) {
    fatalMapsError('根节点不是对象');
  }
  return list;
}

function loadWorldSafe() {
  // V53 SRV-12：maps.json 存在时先解析校验；失败必须 fatal，不能静默回退旧 map_boxes.json。
  const fileMaps = loadMapsFile();
  MAPS = loadDataMaps();
  if (Object.keys(MAPS).length) {
    world = MAPS.harbor.world;
    spawnPoints = buildSpawnPoints(world, DEFAULT_SPAWN);
    return;
  }
  if (fileMaps) {
    for (const id of Object.keys(fileMaps)) {
      const spec = fileMaps[id];
      if (!spec || typeof spec !== 'object') continue;
      spec.id = id;
      spec.world = makeWorld(spec);
      spec.modePoints = spec.modePoints || {};
      spec.modePoints.domination = buildDominationPoints(spec, spec.world);
      MAPS[id] = spec;
      log('info', 'map ' + id, { boxes: spec.world.boxes.count });
    }
    if (!Object.keys(MAPS).length) fatalMapsError('maps.json 中没有任何可用地图');
  }
  if (!Object.keys(MAPS).length) {
    // 只有确实没有 maps.json 时才允许旧 map_boxes.json（或显式 MAP_FILE）回退。
    let spec = { id: 'harbor', boxes: [], teamBases: TEAM_BASES };
    try { spec = Object.assign(spec, JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))); } catch (e) {}
    if (!spec.boxes || !spec.boxes.length) spec.boxes = [];
    spec.world = makeWorld(spec);
    spec.modePoints = { domination: buildDominationPoints(spec, spec.world) };
    MAPS.harbor = spec;
  }
  world = MAPS.harbor.world;
  spawnPoints = buildSpawnPoints(world, DEFAULT_SPAWN);
}

function mapIds() { return Object.keys(MAPS); }
function getMap(mapId) {
  if (typeof mapId === 'string' && Object.prototype.hasOwnProperty.call(MAPS, mapId)) return MAPS[mapId];
  return MAPS.harbor;
}

function spawnIsFree(w, x, z) {
  const g = w.groundHeight(x, z, 3);
  if (g > 0.75) return false;
  const pos = { x: x, y: g + 0.01, z: z };
  const vel = { x: 0, y: 0, z: 0 };
  const r = w.moveCapsule(pos, vel, STEP, SERVER_TUNING.radius, SERVER_TUNING.standHeight, true);
  if (r.hitWall) return false;
  if (Math.hypot(pos.x - x, pos.z - z) > 0.02) return false;
  if (pos.y > g + 0.3) return false;
  return { x: x, y: pos.y, z: z };
}

function buildSpawnPoints(w, baseIn) {
  const points = [];
  const base = baseIn || DEFAULT_SPAWN;
  const rings = [[0, 0]];
  for (let ring = 1; ring <= 4; ring++) {
    const rad = ring * 1.1;
    const n = 6 + ring * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.37;
      rings.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
  }
  for (const ringPoint of rings) {
    const p = spawnIsFree(w, base.x + ringPoint[0], base.z + ringPoint[1]);
    if (p) points.push(p);
  }
  if (!points.length) {
    const y = w.groundHeight(base.x, base.z, 3);
    points.push({ x: base.x, y: y, z: base.z });
    log('error', 'no free spawn, using fallback', { point: points[0] });
  }
  return points;
}

function pickSpawns(w, list, base) {
  const out = [];
  for (const s of (list || [])) {
    const d = Math.hypot(s.x - base.x, s.z - base.z);
    if (d > 9) continue;
    const free = spawnIsFree(w, s.x, s.z);
    if (free) out.push(free);
  }
  if (!out.length) return [];
  out.sort(function (a, b) {
    return Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z);
  });
  return out.slice(0, 12);
}

function spawnForRoom(room, team) {
  const others = [];
  for (const q of room.players.values()) if (q.alive && q.team !== team) others.push(q);
  const list = (team === 1 ? room.spawnsB : room.spawnsA);
  const bases = room.bases || TEAM_BASES;
  const fallback = bases[team === 1 ? 1 : 0] || bases[0];
  let best = null;
  let bestD = -1;
  const now = simNowMs();
  for (const p of (list || [])) {
    const key = p.x.toFixed(2) + ',' + p.z.toFixed(2);
    if ((room.spawnUse[key] || 0) > now) continue;
    let d = Infinity;
    for (const q of others) d = Math.min(d, Math.hypot(p.x - q.pos.x, p.z - q.pos.z));
    if (d > bestD) { bestD = d; best = p; }
  }
  const yaw = fallback && typeof fallback.yaw === 'number' ? fallback.yaw : 0;
  if (best) {
    const k = best.x.toFixed(2) + ',' + best.z.toFixed(2);
    room.spawnUse[k] = now + 1600;
  }
  if (!best) {
    const gy = room.world.groundHeight(fallback.x, fallback.z, 3);
    return { x: fallback.x, y: gy + 0.02, z: fallback.z, yaw: yaw };
  }
  return {
    x: best.x + (Math.random() - 0.5) * 0.3,
    y: best.y + 0.02,
    z: best.z + (Math.random() - 0.5) * 0.3,
    yaw: yaw,
  };
}

// ---------------------------------------------------------------------------
// 武器表（六把：数据唯一来源 packages/data/weapons）
// ---------------------------------------------------------------------------
const WEAPONS = Object.create(null);
const WEAPON_IDS = ['pac9', 'smg', 'dmr', 'lmg', 'breaker12', 'sidearm'];

const FALLBACK_WEAPONS = {
  pac9: { damage: 26, rpm: 720, mag: 30, reserve: 150, pellets: 1, range: 300, falloff: { start: 35, end: 80, minMul: 0.65 }, headMul: 2, limbMul: 0.8, penetration: 0.5, penetrationMul: 0.75, reloadTactical: 2.1, reloadEmpty: 2.72, class: 'ar', slot: 'primary', name: '几猫九式突击步枪' },
  smg: { damage: 18, rpm: 900, mag: 32, reserve: 192, pellets: 1, range: 120, falloff: { start: 15, end: 40, minMul: 0.5 }, headMul: 1.6, limbMul: 0.8, penetration: 0.25, penetrationMul: 0.7, reloadTactical: 1.9, reloadEmpty: 2.3, class: 'smg', slot: 'primary', name: '几猫·短哨 冲锋枪' },
  dmr: { damage: 62, rpm: 240, mag: 10, reserve: 90, pellets: 1, range: 320, falloff: { start: 60, end: 140, minMul: 0.8 }, headMul: 2.4, limbMul: 0.8, penetration: 0.9, penetrationMul: 0.85, reloadTactical: 2.6, reloadEmpty: 3.15, class: 'dmr', slot: 'primary', name: '几猫·长眼 精确射手步枪' },
  lmg: { damage: 34, rpm: 520, mag: 80, reserve: 240, pellets: 1, range: 200, falloff: { start: 40, end: 100, minMul: 0.7 }, headMul: 1.8, limbMul: 0.8, penetration: 0.7, penetrationMul: 0.78, reloadTactical: 4.2, reloadEmpty: 5, class: 'lmg', slot: 'primary', name: '几猫·重锚 轻机枪' },
  breaker12: { damage: 11, rpm: 78, mag: 8, reserve: 48, pellets: 9, pelletSpread: 1.35, range: 90, falloff: { start: 8, end: 22, minMul: 0.3 }, headMul: 1.3, limbMul: 0.8, penetration: 0.1, penetrationMul: 0.6, reloadTactical: 2.85, reloadEmpty: 3.4, class: 'shotgun', slot: 'primary', name: '几猫·破门锤 12 号霰弹枪' },
  sidearm: { damage: 38, rpm: 420, mag: 12, reserve: 60, pellets: 1, range: 90, falloff: { start: 18, end: 45, minMul: 0.55 }, headMul: 2, limbMul: 0.8, penetration: 0.2, penetrationMul: 0.65, reloadTactical: 1.4, reloadEmpty: 1.75, class: 'pistol', slot: 'secondary', name: '几猫·侧牙 手枪' },
};

function normalizeWeaponData(raw, fallback) {
  const f = fallback || {};
  const fire = raw.fire || {};
  const falloff = raw.falloff || f.falloff || { start: 20, end: 90, minMul: 0.7 };
  const reload = raw.reload || {};
  return Object.freeze({
    id: raw.id,
    name: raw.name || f.name || raw.id,
    short: raw.short || f.short || raw.id,
    class: raw.class || f.class || 'ar',
    slot: raw.slot || f.slot || 'primary',
    damage: Number(raw.damage != null ? raw.damage : f.damage) || 10,
    rpm: Number(fire.rpm || raw.rpm || f.rpm) || 300,
    mag: Math.max(1, Number(raw.mag || raw.cfg && raw.cfg.magSize || f.mag) || 10),
    reserve: Math.max(0, Number(raw.reserve || raw.cfg && raw.cfg.reserve || f.reserve) || 0),
    pellets: Math.max(1, Number(fire.pellets || raw.pellets || f.pellets) || 1),
    pelletSpread: Number(fire.pelletSpread || raw.pelletSpread || f.pelletSpread || 1.35),
    range: Number(raw.range || f.range) || 100,
    falloff: {
      start: Number(falloff.start != null ? falloff.start : (f.falloff ? f.falloff.start : 20)),
      end: Number(falloff.end != null ? falloff.end : (f.falloff ? f.falloff.end : 90)),
      minMul: Number(falloff.minMul != null ? falloff.minMul : falloff.min != null ? falloff.min : (f.falloff ? f.falloff.minMul : 0.7)),
    },
    headMul: Number(raw.headMul || f.headMul) || 2,
    limbMul: Number(raw.limbMul || f.limbMul) || 0.8,
    penetration: Number(raw.penetration != null ? raw.penetration : f.penetration) || 0,
    penetrationMul: Number(raw.penetrationMul != null ? raw.penetrationMul : f.penetrationMul) || 0.7,
    reloadTactical: Number(reload.tactical && reload.tactical.time || f.reloadTactical) || 2,
    reloadEmpty: Number(reload.empty && reload.empty.time || f.reloadEmpty) || 2.5,
    fireMode: fire.mode || (raw.cfg && raw.cfg.semi ? 'semi' : 'auto'),
    spreadScale: Number(raw.spreadScale || f.spreadScale) || 1,
    attachments: raw.attachments && typeof raw.attachments === 'object' ? raw.attachments : (f.attachments || null),
  });
}

function loadWeapons() {
  for (const id of WEAPON_IDS) {
    let raw = null;
    try {
      const file = path.join(WEAPON_DATA_DIR, id + '.json');
      if (fs.existsSync(file)) raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      log('warn', 'weapon data load failed', { id: id, error: e.message });
    }
    const fallback = Object.assign({ id: id }, FALLBACK_WEAPONS[id] || {});
    WEAPONS[id] = normalizeWeaponData(raw || fallback, fallback);
  }
  log('info', 'weapons loaded', { count: Object.keys(WEAPONS).length });
}

// V53 SRV-11：服务器权威校验装备解锁等级。武器等级来自 UNLOCKS（weapon.<id>），
// 默认武器 pac9/sidearm 视为 1 级。锁定/非法选择不会被装备，回退到默认并记录 adjusted。
function unlockLevelFor(id) {
  for (const u of UNLOCKS) if (u.id === id) return u.level;
  return 1;
}
function sanitizeAttachments(raw, def, tag, adjusted) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const available = def && def.attachments;
  const out = {};
  for (const slot of Object.keys(raw)) {
    const id = raw[slot];
    const list = available && available[slot];
    if (!Array.isArray(list) || typeof id !== 'string' || list.indexOf(id) < 0) {
      adjusted.push('attachment:' + tag + '.' + slot);
      continue;
    }
    out[slot] = id;
  }
  return Object.keys(out).length ? out : undefined;
}
function resolveLoadout(raw, level) {
  const lvl = Math.max(1, Math.floor(numOr(level, 1)));
  const primaryRaw = raw && (raw.primary || raw.weapon || raw.primaryId);
  const secondaryRaw = raw && (raw.secondary || raw.secondaryId);
  const adjusted = [];
  let primary = 'pac9';
  if (typeof primaryRaw === 'string' && WEAPONS[primaryRaw] && WEAPONS[primaryRaw].slot === 'primary') {
    if (lvl >= unlockLevelFor('weapon.' + primaryRaw)) primary = primaryRaw;
    else adjusted.push('primary:' + primaryRaw);
  } else if (primaryRaw != null) {
    adjusted.push('primary:' + String(primaryRaw).slice(0, 32));
  }
  let secondary = 'sidearm';
  if (typeof secondaryRaw === 'string' && WEAPONS[secondaryRaw] && WEAPONS[secondaryRaw].slot === 'secondary') {
    if (lvl >= unlockLevelFor('weapon.' + secondaryRaw)) secondary = secondaryRaw;
    else adjusted.push('secondary:' + secondaryRaw);
  } else if (secondaryRaw != null) {
    adjusted.push('secondary:' + String(secondaryRaw).slice(0, 32));
  }
  const out = { primary: primary, secondary: secondary };
  const att = raw && raw.attachments;
  if (att && typeof att === 'object') {
    const pAtt = sanitizeAttachments(att.primary, WEAPONS[primary], 'primary', adjusted);
    const sAtt = sanitizeAttachments(att.secondary, WEAPONS[secondary], 'secondary', adjusted);
    const flat = (!att.primary && !att.secondary) ? sanitizeAttachments(att, WEAPONS[primary], 'primary', adjusted) : null;
    if (pAtt || sAtt || flat) out.attachments = { primary: pAtt || flat, secondary: sAtt };
  }
  if (adjusted.length) out.adjusted = adjusted;
  return out;
}

function makeWeaponState(def) {
  return {
    id: def.id,
    def: def,
    mag: def.mag,
    reserve: def.reserve,
    reloadEnd: 0,
    reloadStart: 0,
    reloadEmpty: false,
    lastShotAt: 0,
    shotIndex: 0,
  };
}

// ---------------------------------------------------------------------------
// Profile 账号（server/profiles.json，原子写）
// ---------------------------------------------------------------------------
const profiles = new Map();
let profileDirty = false;
let profileSaveTimer = null;
// V53 SRV-1：只有成功加载（主档或有效备份）后才允许写盘/写 .bak；坏档不得被空数据覆盖。
let profilesLoaded = false;
let lastGoodProfilesJson = null;

function levelForXp(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const lvl = 1 + Math.floor(Math.sqrt(x / 100));
  return Math.max(1, Math.min(50, lvl));
}
function xpForLevel(level) {
  return Math.pow(Math.max(0, level - 1), 2) * 100;
}
const UNLOCKS = [
  { id: 'emblem.salt', level: 1, kind: 'emblem' },
  { id: 'weapon.smg', level: 2, kind: 'weapon' },
  { id: 'weapon.dmr', level: 4, kind: 'weapon' },
  { id: 'weapon.lmg', level: 6, kind: 'weapon' },
  { id: 'weapon.breaker12', level: 8, kind: 'weapon' },
  { id: 'skin.hull.rust', level: 10, kind: 'skin' },
  { id: 'charm.knot', level: 14, kind: 'charm' },
  { id: 'title.oldcat', level: 20, kind: 'title' },
];
function unlocksFor(level) {
  const out = [];
  for (const u of UNLOCKS) if (level >= u.level) out.push(u.id);
  return out;
}
function profileView(profile, includeToken) {
  const xp = Math.max(0, Number(profile.xp) || 0);
  const level = levelForXp(xp);
  const view = {
    uid: profile.uid,
    name: profile.name,
    xp: xp,
    level: level,
    xpForNext: xpForLevel(level + 1),
    nextLevelXp: Math.max(0, xpForLevel(level + 1) - xp),
    unlocks: unlocksFor(level),
    nextUnlocks: UNLOCKS.filter(function (u) { return u.level > level; }).slice(0, 3),
    kills: profile.kills || 0,
    deaths: profile.deaths || 0,
    matches: profile.matches || 0,
    wins: profile.wins || 0,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
  if (includeToken) view.token = profile.token;
  return view;
}

// ---------------------------------------------------------------------------
// V39/V53：PROFILES_FILE 单进程锁
// 同一 PROFILES_FILE 只允许一个 server.cjs 实例写入。启动时用 wx 原子创建
// <PROFILES_FILE>.lock，内容含 pid / 时间 / token。持有期间每 5 秒刷新 at/mtime；
// 只有「心跳超过 stale（默认 30s）」且「持有者进程已退出（ESRCH / pid 不可用）」
// 才允许回收。持有者活着时，即使心跳过期也不回收，第二个实例非 0 退出。
// ---------------------------------------------------------------------------
let profileLockHeld = false;
let profileLockToken = null;
let profileLockHeartbeat = null;

function profileLockOwnerAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // ESRCH = 进程不存在；EPERM 说明进程存在但无权限，保守视为存活。
    if (e && e.code === 'ESRCH') return false;
    return true;
  }
}

function writeProfileLockInfo(token) {
  const now = Date.now();
  fs.writeFileSync(PROFILE_LOCK_FILE, JSON.stringify({
    pid: process.pid,
    at: now,
    time: now,
    token: token,
    file: PROFILES_FILE,
  }), { mode: 0o600 });
  return now;
}

function startProfileLockHeartbeat() {
  if (profileLockHeartbeat) return;
  profileLockHeartbeat = setInterval(refreshProfileLock, PROFILE_LOCK_HEARTBEAT_MS);
  if (profileLockHeartbeat.unref) profileLockHeartbeat.unref();
}

function refreshProfileLock() {
  if (!profileLockHeld || !profileLockToken) return;
  const held = readProfileLock();
  if (!held || held.token !== profileLockToken) {
    log('error', 'profiles lock lost; heartbeat stopped', { file: PROFILE_LOCK_FILE });
    profileLockToken = null;
    if (profileLockHeartbeat) {
      clearInterval(profileLockHeartbeat);
      profileLockHeartbeat = null;
    }
    return;
  }
  try {
    writeProfileLockInfo(profileLockToken);
  } catch (e) {
    metrics.ioErrors++;
    log('error', 'profiles lock heartbeat failed', { file: PROFILE_LOCK_FILE, error: e.message });
  }
}

function readProfileLock() {
  try {
    const stat = fs.statSync(PROFILE_LOCK_FILE);
    let info = null;
    try {
      info = JSON.parse(fs.readFileSync(PROFILE_LOCK_FILE, 'utf8'));
    } catch (e) {}
    const at = info && Number.isFinite(Number(info.at != null ? info.at : info.time))
      ? Number(info.at != null ? info.at : info.time)
      : null;
    return {
      pid: info && Number.isFinite(Number(info.pid)) ? Number(info.pid) : null,
      at: at,
      token: info && typeof info.token === 'string' ? info.token : null,
      mtimeMs: stat.mtimeMs,
      ino: stat.ino,
    };
  } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    return { error: e, pid: null, at: null, token: null, mtimeMs: 0, ino: 0 };
  }
}

function acquireProfileLock() {
  const dir = path.dirname(PROFILES_FILE);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    return { ok: false, reason: 'io', error: e };
  }
  const token = crypto.randomBytes(8).toString('hex');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const fd = fs.openSync(PROFILE_LOCK_FILE, 'wx', 0o600);
      try {
        const now = Date.now();
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: now, time: now, token: token, file: PROFILES_FILE }));
        try { fs.fsyncSync(fd); } catch (e) {}
      } finally {
        fs.closeSync(fd);
      }
      // 防 stale 回收竞态：写完再确认锁内容仍属于本进程。
      const own = readProfileLock();
      if (!own || own.token !== token) return { ok: false, reason: 'race', lock: own };
      profileLockHeld = true;
      profileLockToken = token;
      startProfileLockHeartbeat();
      return { ok: true, token: token };
    } catch (e) {
      if (!e || e.code !== 'EEXIST') return { ok: false, reason: 'io', error: e };
      const held = readProfileLock();
      if (!held) continue; // 锁刚好消失，重试创建
      const at = held.at != null ? held.at : held.mtimeMs;
      const ageMs = Math.max(0, Date.now() - at);
      const ownerAlive = profileLockOwnerAlive(held.pid);
      // V53 SRV-2：心跳过期 + 进程确认退出，两个条件同时满足才可回收。
      if (!lockReclaimable(ageMs, PROFILE_LOCK_STALE_MS, ownerAlive)) {
        return {
          ok: false,
          reason: ownerAlive ? 'held_alive' : 'held',
          lock: held,
          ageMs: ageMs,
          ownerAlive: ownerAlive,
        };
      }
      // 回收前再核对 token/inode，避免把别人刚创建的新锁删掉。
      const again = readProfileLock();
      if (!again || again.token !== held.token || again.ino !== held.ino) continue;
      try {
        fs.unlinkSync(PROFILE_LOCK_FILE);
        log('warn', 'profiles stale lock reclaimed', {
          file: PROFILE_LOCK_FILE,
          pid: held.pid,
          ageMs: ageMs,
          ownerAlive: false,
        });
      } catch (e2) {
        if (!e2 || e2.code !== 'ENOENT') return { ok: false, reason: 'io', error: e2 };
      }
    }
  }
  return { ok: false, reason: 'held', lock: readProfileLock() };
}

function releaseProfileLock() {
  if (profileLockHeartbeat) {
    clearInterval(profileLockHeartbeat);
    profileLockHeartbeat = null;
  }
  if (!profileLockHeld) return;
  profileLockHeld = false;
  const token = profileLockToken;
  profileLockToken = null;
  const held = readProfileLock();
  if (!held || (token && held.token !== token)) return;
  try {
    fs.unlinkSync(PROFILE_LOCK_FILE);
  } catch (e) {}
}

function parseProfilesText(text) {
  const raw = JSON.parse(text);
  const list = raw && typeof raw === 'object' && raw.profiles !== undefined ? raw.profiles : raw;
  const loaded = new Map();
  if (Array.isArray(list)) {
    for (const p of list) {
      if (p && typeof p === 'object' && typeof p.token === 'string' && p.token) loaded.set(p.token, p);
    }
    if (!loaded.size && list.length) throw new Error('profiles 数组中没有有效档案');
  } else if (list && typeof list === 'object') {
    for (const token of Object.keys(list)) {
      const p = list[token];
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        p.token = p.token || token;
        loaded.set(token, p);
      }
    }
    // 有键但全部不是档案对象：说明 schema 不对，不能当成“空档案”覆盖。
    if (!loaded.size && Object.keys(list).length) throw new Error('profiles 对象中没有有效档案');
  } else {
    throw new Error('profiles 数据格式无效');
  }
  return loaded;
}

function tryReadProfilesFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return { ok: true, text: text, map: parseProfilesText(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function adoptProfiles(map, text) {
  profiles.clear();
  let stripped = 0;
  for (const key of map.keys()) {
    const p = map.get(key);
    if (stripProfilePrivate(p)) stripped++;
    profiles.set(key, p);
  }
  profilesLoaded = true;
  // V53 SRV-11：启动即清理过期档案并压到上限内；有删除/脱敏时异步落盘。
  const pruned = pruneProfiles(Date.now());
  const capped = enforceProfileCap(PROFILE_MAX, 0);
  // .bak 也只能保存脱敏后的档案，不能把原文件里的 IP 继续带到备份里。
  lastGoodProfilesJson = JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    profiles: Object.fromEntries(profiles),
  });
  if (pruned || capped || stripped) {
    log('info', 'profiles pruned', {
      file: PROFILES_FILE,
      pruned: pruned,
      strippedIp: stripped,
      evicted: metrics.profilesEvicted,
      count: profiles.size,
      max: PROFILE_MAX,
      ttlDays: PROFILE_TTL_DAYS,
    });
    scheduleProfileSave();
  }
}

// 坏档改名保留原字节；ISO 时间里的 ':' 换成 '-'，兼容 macOS/Windows 文件系统。
function quarantineProfilesFile(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let dest = file + '.corrupt-' + stamp;
  for (let n = 1; fs.existsSync(dest); n++) dest = file + '.corrupt-' + stamp + '-' + n;
  try {
    fs.renameSync(file, dest);
    return dest;
  } catch (e) {
    log('error', 'profiles corrupt file rename failed', { file: file, dest: dest, error: e.message });
    return null;
  }
}

function fsyncDirSync(dir) {
  let fd = null;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch (e) {
    // 目录 fsync 在部分平台不支持；文件本身已 fsync。
  } finally {
    if (fd != null) {
      try { fs.closeSync(fd); } catch (e) {}
    }
  }
}

function atomicWriteFileSync(file, data) {
  const tmp = file + '.tmp';
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeFileSync(fd, data);
    try { fs.fsyncSync(fd); } catch (e) {}
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (e2) {}
    throw e;
  }
  fsyncDirSync(path.dirname(file));
}

function restoreProfilesMain(text) {
  atomicWriteFileSync(PROFILES_FILE, text);
}

function loadProfiles() {
  if (fs.existsSync(PROFILES_FILE)) {
    const main = tryReadProfilesFile(PROFILES_FILE);
    if (main.ok) {
      adoptProfiles(main.map, main.text);
      log('info', 'profiles loaded', { file: PROFILES_FILE, count: profiles.size });
      return true;
    }
    log('error', 'profiles load failed', { file: PROFILES_FILE, error: main.error.message });

    let backup = null;
    if (fs.existsSync(PROFILES_BAK_FILE)) backup = tryReadProfilesFile(PROFILES_BAK_FILE);
    if (backup && backup.ok) {
      const corrupt = quarantineProfilesFile(PROFILES_FILE);
      if (!corrupt) {
        log('fatal', 'profiles.json 损坏但无法改名保留；为避免覆盖坏档，拒绝启动', {
          file: PROFILES_FILE,
          backup: PROFILES_BAK_FILE,
        });
        console.error('[fatal] profiles.json 损坏且无法改名保留，拒绝启动（不会覆盖原文件）。');
        return false;
      }
      try {
        restoreProfilesMain(backup.text);
      } catch (e) {
        log('fatal', 'profiles backup restore failed; refusing to start', {
          file: PROFILES_FILE,
          backup: PROFILES_BAK_FILE,
          error: e.message,
        });
        console.error('[fatal] profiles.json 损坏且备份恢复失败：' + e.message);
        return false;
      }
      adoptProfiles(backup.map, backup.text);
      log('warn', 'profiles recovered from backup', {
        file: PROFILES_FILE,
        backup: PROFILES_BAK_FILE,
        count: profiles.size,
        corrupt: corrupt,
      });
      return true;
    }

    const corrupt = quarantineProfilesFile(PROFILES_FILE);
    log('fatal', 'profiles.json 损坏且没有有效备份，拒绝启动（已保留坏档，不会用空档案覆盖）', {
      file: PROFILES_FILE,
      corrupt: corrupt,
      backup: PROFILES_BAK_FILE,
      backupError: backup && backup.error ? backup.error.message : null,
    });
    console.error('[fatal] profiles.json 损坏且没有有效备份，拒绝启动');
    console.error('[fatal] 坏档已改名保留：' + (corrupt || '（改名失败，请手工备份）'));
    console.error('[fatal] 请修复 profiles.json，或提供有效的 profiles.json.bak 后重启。');
    return false;
  }

  // 主档缺失：若存在有效备份则恢复（防止 rename 期间断电造成主档丢失）。
  if (fs.existsSync(PROFILES_BAK_FILE)) {
    const backup = tryReadProfilesFile(PROFILES_BAK_FILE);
    if (backup.ok) {
      try {
        restoreProfilesMain(backup.text);
        adoptProfiles(backup.map, backup.text);
        log('warn', 'profiles restored from backup (main file missing)', {
          file: PROFILES_FILE,
          backup: PROFILES_BAK_FILE,
          count: profiles.size,
        });
        return true;
      } catch (e) {
        log('error', 'profiles restore from backup failed', { file: PROFILES_FILE, error: e.message });
      }
    } else {
      log('warn', 'profiles backup invalid (main file missing)', { file: PROFILES_BAK_FILE, error: backup.error.message });
    }
  }
  profilesLoaded = true;
  lastGoodProfilesJson = null;
  log('info', 'profiles file missing; starting empty', { file: PROFILES_FILE });
  return true;
}

// V37：异步串行写队列。快照在写线程外构建，writeFile(tmp) + rename 保持原子性；
// 同一时刻只有一个写入者，后到的变更合并成下一次写，避免 tick 线程同步全量写。
let profileSaveRunning = null;
let profileSaveQueued = false;

async function fsyncDirAsync(dir) {
  let handle = null;
  try {
    handle = await fs.promises.open(dir, 'r');
    await handle.sync();
  } catch (e) {
    // 目录 fsync 在部分平台不支持；文件本身已 fsync。
  } finally {
    if (handle) {
      try { await handle.close(); } catch (e) {}
    }
  }
}

async function writeFileAtomicAsync(file, data) {
  const tmp = file + '.tmp';
  let handle = null;
  try {
    handle = await fs.promises.open(tmp, 'w', 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(tmp, file);
    await fsyncDirAsync(path.dirname(file));
  } catch (e) {
    if (handle) {
      try { await handle.close(); } catch (e2) {}
    }
    try { await fs.promises.unlink(tmp); } catch (e2) {}
    throw e;
  }
}

async function writeProfilesAsync() {
  if (!profilesLoaded) throw new Error('profiles_not_loaded');
  const dir = path.dirname(PROFILES_FILE);
  await fs.promises.mkdir(dir, { recursive: true });
  // 无原型对象：token 即使是 "__proto__" 也只会成为普通键。
  const out = { version: 1, savedAt: new Date().toISOString(), profiles: Object.create(null) };
  for (const key of profiles.keys()) out.profiles[key] = profiles.get(key);
  const json = JSON.stringify(out);
  // V53 SRV-1：只有成功加载过有效主档后才写 .bak；.bak 保存的是上一份有效主档。
  if (lastGoodProfilesJson) {
    try {
      await writeFileAtomicAsync(PROFILES_BAK_FILE, lastGoodProfilesJson);
    } catch (e) {
      metrics.ioErrors++;
      log('error', 'profiles backup write failed', { file: PROFILES_BAK_FILE, error: e.message });
    }
  }
  await writeFileAtomicAsync(PROFILES_FILE, json);
  lastGoodProfilesJson = json;
}

function flushProfileWrites() {
  if (!profilesLoaded) return Promise.resolve();
  if (profileSaveRunning) {
    profileSaveQueued = true;
    return profileSaveRunning;
  }
  if (!profileDirty) return Promise.resolve();
  profileDirty = false;
  profileSaveQueued = false;
  profileSaveRunning = writeProfilesAsync()
    .catch(function (e) {
      metrics.ioErrors++;
      log('error', 'profiles save failed', { file: PROFILES_FILE, error: e.message });
    })
    .then(function () {
      profileSaveRunning = null;
      if (profileDirty || profileSaveQueued) {
        profileSaveQueued = false;
        return flushProfileWrites();
      }
    });
  return profileSaveRunning;
}

function scheduleProfileSave() {
  if (!profilesLoaded) return;
  profileDirty = true;
  if (profileSaveTimer) return;
  profileSaveTimer = setTimeout(function () {
    profileSaveTimer = null;
    flushProfileWrites();
  }, 250);
  profileSaveTimer.unref();
}

function profileLastActive(p) {
  const t = Number(p && (p.updatedAt != null ? p.updatedAt : p.createdAt));
  return Number.isFinite(t) && t > 0 ? t : 0;
}

/** V53 SRV-11：档案里不再保留任何客户端网络地址。 */
function stripProfilePrivate(p) {
  if (!p || typeof p !== 'object') return false;
  let changed = false;
  for (const key of ['ip', 'clientIp', 'lastIp']) {
    if (Object.prototype.hasOwnProperty.call(p, key)) {
      delete p[key];
      changed = true;
    }
  }
  return changed;
}

function pruneProfiles(nowMs) {
  if (!(PROFILE_TTL_MS > 0)) return 0;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  let removed = 0;
  for (const token of Array.from(profiles.keys())) {
    const p = profiles.get(token);
    const at = profileLastActive(p);
    // 旧档案/测试可能用 1/2 这类哨兵时间戳；只有 2020 年之后的真实时间才参与过期。
    if (at >= 1577836800000 && now - at > PROFILE_TTL_MS) {
      profiles.delete(token);
      removed++;
    }
  }
  metrics.profilesPruned += removed;
  return removed;
}

function profileInUse(token) {
  if (!token) return false;
  for (const room of rooms.values()) {
    for (const q of room.players.values()) {
      if (!q.isBot && q.profileToken === token) return true;
    }
  }
  return false;
}

/**
 * 上限清理：优先淘汰最久未活跃且当前没有在线的档案。
 * reserve 为即将新建的槽位（create 时传 1）。无法腾出空间则返回 false。
 */
function enforceProfileCap(limit, reserve) {
  if (!(limit > 0)) return true;
  const need = Math.max(0, profiles.size + (reserve || 0) - limit);
  if (need <= 0) return true;
  const candidates = [];
  for (const [token, p] of profiles) {
    if (profileInUse(token)) continue;
    candidates.push({ token: token, at: profileLastActive(p) });
  }
  candidates.sort(function (a, b) { return a.at - b.at; });
  let removed = 0;
  for (const c of candidates) {
    if (removed >= need) break;
    profiles.delete(c.token);
    removed++;
  }
  metrics.profilesEvicted += removed;
  return removed >= need;
}

function createProfile(rawName) {
  const token = crypto.randomBytes(18).toString('hex');
  const now = Date.now();
  // V53 SRV-11：先清过期，再按 LRU 腾出上限内的一个槽位；不再把客户端 IP 写进档案。
  pruneProfiles(now);
  if (!enforceProfileCap(PROFILE_MAX, 1)) return null;
  const name = sanitizeName(rawName, '几猫') || '几猫';
  const profile = {
    uid: 'u' + crypto.randomBytes(6).toString('hex'),
    token: token,
    name: name,
    xp: 0,
    kills: 0,
    deaths: 0,
    matches: 0,
    wins: 0,
    createdAt: now,
    updatedAt: now,
  };
  profiles.set(token, profile);
  scheduleProfileSave();
  return profile;
}

function awardProfileXp(token, amount, opts) {
  if (!token) return null;
  const profile = profiles.get(token);
  if (!profile) return null;
  const add = Math.max(0, Math.round(Number(amount) || 0));
  const before = levelForXp(profile.xp);
  profile.xp = Math.max(0, (Number(profile.xp) || 0) + add);
  const after = levelForXp(profile.xp);
  profile.updatedAt = Date.now();
  if (opts && opts.kill) profile.kills = (profile.kills || 0) + 1;
  if (opts && opts.death) profile.deaths = (profile.deaths || 0) + 1;
  if (after !== before) {
    log('info', 'profile level up', { uid: profile.uid, level: after, xp: profile.xp });
  }
  scheduleProfileSave();
  return profile;
}

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function numOr(v, d) {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function round3(n) {
  return Math.round(n * 1000) / 1000;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function wrapYaw(yaw) {
  if (!Number.isFinite(yaw)) return 0;
  let y = yaw % (Math.PI * 2);
  if (y > Math.PI) y -= Math.PI * 2;
  if (y < -Math.PI) y += Math.PI * 2;
  return y;
}
function makeId() {
  return crypto.randomBytes(4).toString('hex');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

const RESERVED_NAMES = ['admin', 'administrator', 'root', 'system', 'server', 'official', 'moderator', 'gm', 'bot', '管理员', '系统', '官方', '服务器', '几猫官方'];
function sanitizeName(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  let s = raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, '')
    .replace(/[^\p{Script=Han}A-Za-z0-9_\- ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return fallback;
  const chars = Array.from(s);
  if (chars.length > NAME_MAX) s = chars.slice(0, NAME_MAX).join('').trim();
  if (!s) return fallback;
  const lower = s.toLowerCase();
  if (RESERVED_NAMES.indexOf(lower) >= 0) return fallback;
  return s;
}
function nameTaken(room, name) {
  const key = name.toLowerCase();
  for (const q of room.players.values()) if (q.name.toLowerCase() === key) return true;
  return false;
}
function uniqueName(room, base) {
  if (!nameTaken(room, base)) return base;
  const baseChars = Array.from(base);
  for (let n = 2; n <= 99; n++) {
    const suffix = '#' + n;
    const keep = Math.max(1, NAME_MAX - suffix.length);
    const candidate = baseChars.slice(0, keep).join('').trimEnd() + suffix;
    if (!nameTaken(room, candidate)) return candidate;
  }
  return baseChars.slice(0, NAME_MAX - 4).join('').trimEnd() + '#999';
}
function sanitizeRoom(raw) {
  if (typeof raw !== 'string' || !raw) return 'ffa-1';
  const s = raw.trim();
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(s)) return 'ffa-1';
  return s;
}
function isDevAuthorized(msg) {
  if (!DEV_TOKEN || !msg || typeof msg.token !== 'string') return false;
  return safeEqual(msg.token, DEV_TOKEN);
}
function isProfileTokenAuthorized(msg) {
  if (!PROFILE_TOKEN) return true;
  if (!msg) return false;
  return safeEqual(msg.token, PROFILE_TOKEN) || safeEqual(msg.profileToken, PROFILE_TOKEN);
}
function dirFromAngles(yaw, pitch) {
  const cp = Math.cos(pitch || 0);
  return {
    x: -Math.sin(yaw || 0) * cp,
    y: Math.sin(pitch || 0),
    z: -Math.cos(yaw || 0) * cp,
  };
}
function normalizeDir(d) {
  if (!d || typeof d !== 'object') return null;
  let x = numOr(d.x, numOr(Array.isArray(d) ? d[0] : NaN, NaN));
  let y = numOr(d.y, numOr(Array.isArray(d) ? d[1] : NaN, NaN));
  let z = numOr(d.z, numOr(Array.isArray(d) ? d[2] : NaN, NaN));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const len = Math.hypot(x, y, z);
  if (!(len > 1e-4) || len > 10) return null;
  return { x: x / len, y: y / len, z: z / len };
}
function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function eyeHeight(p) {
  return p.crouching || (p.input && p.input.crouch) ? 1.05 : 1.68;
}
function eyePos(p) {
  return { x: p.pos.x, y: p.pos.y + eyeHeight(p), z: p.pos.z };
}

// ---------------------------------------------------------------------------
// 房间 / 玩家
// ---------------------------------------------------------------------------
const rooms = new Map();
// V53 SRV-6：快照按“距上次快照的 tick 数”触发，追帧多步后不会因奇偶相位跳过。
let lastSnapTick = -Infinity;

// V37：统一的武器状态字段。respawn / roundStart / 换枪广播都带同一组字段，
// 客户端收到后可直接写回本地两把枪的 slot/mag/reserve，避免 UI 与权威状态漂移。
function weaponStatePayload(p) {
  const w = p.currentWeaponState();
  const slots = [];
  for (let i = 0; i < p.slots.length; i++) {
    const s = p.slots[i];
    slots.push({ slot: i, wpn: s.def.id, mag: s.mag | 0, reserve: s.reserve | 0 });
  }
  return {
    slot: p.slot,
    wpn: w.def.id,
    mag: w.mag | 0,
    reserve: w.reserve | 0,
    slots: slots,
  };
}

function respawnEvent(p, extra) {
  return Object.assign({
    t: 'respawn',
    id: p.id,
    x: round3(p.pos.x),
    y: round3(p.pos.y),
    z: round3(p.pos.z),
    yaw: round3(p.yaw),
    hp: Math.round(p.hp),
    armor: Math.round(p.armor),
  }, weaponStatePayload(p), extra || {});
}

function broadcastRoundStart(room, extra) {
  const base = Object.assign({
    t: 'roundStart',
    teams: room.matchScore(),
    kills: room.teamKills.slice(),
    mapId: room.mapId,
    mode: room.modeId,
  }, extra || {});
  for (const p of room.players.values()) {
    if (p.isBot) continue;
    p.send(Object.assign({}, base, weaponStatePayload(p)));
  }
}

function broadcastWeaponState(p) {
  const ev = Object.assign({ t: 'weapon', id: p.id }, weaponStatePayload(p));
  p.room.broadcast(ev);
  // 旧客户端仍监听 weaponSwitch；保留同名别名，字段与 weapon 完全一致。
  p.room.broadcast(Object.assign({}, ev, { t: 'weaponSwitch' }));
}

class Player {
  constructor(ws, room, name, team, spawnIn, opts) {
    opts = opts || {};
    this.id = makeId();
    this.netId = room.allocNetId();
    this.team = team == null ? 0 : team;
    this.ws = ws;
    this.room = room;
    this.name = name;
    this.isBot = !!opts.isBot;
    this.botSkill = opts.botSkill != null ? opts.botSkill : BOT_SKILL;
    this.botState = { aimErr: 0, strafe: Math.random() < 0.5 ? -1 : 1, decideAt: 0, targetId: null, senseAt: 0 };
    // joinedAt 只用于“最近加入”的平衡/补位排序，属于会话元数据，保留真实时钟。
    this.joinedAt = Date.now();
    this.lastSeen = simNowMs();
    this.prevCmdButtons = 0;
    this.jumpQueued = false;
    this.yaw = 0;
    this.pitch = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.armor = 50;
    this.alive = true;
    this.respawnAt = 0;
    this.lastFire = 0;
    this.kills = 0;
    this.deaths = 0;
    this.spawnProtectUntil = simNowMs() + 2000;
    this.spawn = spawnIn || { x: DEFAULT_SPAWN.x, y: 0, z: DEFAULT_SPAWN.z };
    this.rtt = 0;              // 服务端 ws ping/pong 实测 RTT（EWMA 0.7/0.3）
    this.clientRtt = 0;        // 客户端 ping.ts 自报，仅用于显示/兼容，不参与回滚
    this.lastPongAt = 0;
    this.lastPingSentAt = 0;
    this.history = [];
    this.profileToken = opts.profileToken || null;
    this.profile = null;
    // V53 SRV-11：按档案等级校验武器/配件；机器人是服务器内部生成，按最高等级信任。
    const loadoutLevel = opts.isBot ? 99 : Math.max(1, Math.floor(numOr(opts.loadoutLevel, 1)));
    this.loadout = resolveLoadout(opts.loadout, loadoutLevel);
    this.loadoutAdjusted = this.loadout.adjusted || [];
    this.slots = [makeWeaponState(WEAPONS[this.loadout.primary]), makeWeaponState(WEAPONS[this.loadout.secondary])];
    this.slot = 0;
    this.cmdQueue = [];
    this.lastQueuedSeq = 0;
    this.lastSimSeq = 0;
    this.lastCmd = ZERO_CMD;
    this.starved = 0;
    this.cmdWindow = { start: Date.now(), count: 0 };
    this._msgWindow = { start: Date.now(), count: 0 };
    this._violations = 0;
    this.bin = !!opts.bin;
    this.snapPrev = null;
    this.snapBaseTick = 0;
    this.snapFullTick = -1;
    // V53 NET-3：netId -> { x, y, z, yaw, tick }，只在“这一帧真的发给该接收者”后更新。
    this.snapSent = new Map();
    this.submergedSince = 0;
    this.stuckSince = 0;
    this.bytesOut = 0;
    this.bytesIn = 0;
    this.lastPingAt = 0;
    // NET-2：共享 stepPlayer 需要的移动状态字段（crouching/slideT/jumpBuf/coyote/...）。
    initPlayerMovement(this, this.spawn);
  }

  currentWeaponState() {
    return this.slots[this.slot] || this.slots[0];
  }
  currentWeapon() {
    return this.currentWeaponState().def;
  }
  send(obj) {
    if (this.isBot || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      const text = JSON.stringify(obj);
      this.ws.send(text);
      const n = Buffer.byteLength(text);
      this.bytesOut += n;
      metrics.msgsOut++;
      metrics.snapWindow.push({ t: Date.now(), bytes: n });
      return true;
    } catch (e) {
      metrics.ioErrors++;
      return false;
    }
  }
  sendRaw(buf) {
    if (this.isBot || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(buf, { binary: true });
      this.bytesOut += buf.byteLength;
      metrics.msgsOut++;
      return true;
    } catch (e) {
      metrics.ioErrors++;
      return false;
    }
  }
  close(code, reason) {
    if (this.isBot || !this.ws) return;
    try { this.ws.close(code, reason); } catch (e) {}
  }
  spawnSnapshot() {
    const w = this.currentWeaponState();
    return {
      id: this.id,
      nid: this.netId,
      name: this.name,
      x: round3(this.pos.x),
      y: round3(this.pos.y),
      z: round3(this.pos.z),
      yaw: round3(this.yaw),
      pitch: round3(this.pitch),
      hp: Math.round(this.hp),
      armor: Math.round(this.armor),
      alive: !!this.alive,
      team: this.team,
      kills: this.kills,
      deaths: this.deaths,
      onGround: !!this.onGround,
      crouch: !!this.crouching,
      sprinting: !!this.sprinting,
      spawnProtect: this.spawnProtectUntil > simNowMs(),
      seq: this.lastSimSeq,
      ack: this.lastSimSeq,
      ping: Math.round(this.rtt),
      bot: !!this.isBot,
      wpn: w.def.id,
      slot: this.slot,
      mag: w.mag,
      reserve: w.reserve,
      slots: this.slots.map(function (s, i) { return { slot: i, wpn: s.def.id, mag: s.mag | 0, reserve: s.reserve | 0 }; }),
      reloading: !!(w.reloadEnd > simNowMs()),
    };
  }
}

class Room {
  constructor(id, mapId, modeId) {
    this.id = id;
    this.mapId = mapId || 'harbor';
    this.modeId = typeof modeId === 'string' && Object.prototype.hasOwnProperty.call(MODES, modeId) ? modeId : 'tdm';
    this.mode = MODES[this.modeId];
    this.maxPlayers = Math.min(this.mode.maxPlayers, MAX_PLAYERS);
    this.setMapState(this.mapId);
    this.players = new Map();
    this.nextNetId = 1;
    this.createdAt = Date.now();
    this.roundStart = simNowMs();
    this.scoreLimit = SCORE_LIMIT || this.mode.scoreLimit;
    this.roundSeconds = ROUND_SECONDS || this.mode.roundSeconds;
    this.overtimeSeconds = OVERTIME_SECONDS;
    this.roundEndMs = ROUND_END_MS;
    this.overtime = false;
    this.roundOver = false;
    this.roundOverAt = 0;
    this.teamKills = [0, 0];
    this.pointScore = [0, 0];
    this.domAccum = 0;
    this.resetT = 0;
    // V53 SRV-5：投票表与失败计数用无原型对象/数字，避免客户端 id 触发原型链查找。
    this.votes = Object.create(null);
    this.spawnUse = Object.create(null);
    this.failCount = 0;
    this.state = WARMUP_SECONDS > 0 ? 'warmup' : 'live';
    this.stateSince = simNowMs();
    this.warmupEndsAt = this.stateSince + WARMUP_SECONDS * 1000;
    this.stateEndsAt = 0;
    this.botNextAt = 0;
    this.roundNumber = 1;
    // 二进制增量的房间级共享基线：同 tick 所有在同步的 bin 客户端复用一次编码。
    this.binPrev = null;
    this.binBaseTick = 0;
  }
  allocNetId() {
    for (let guard = 0; guard < 65535; guard++) {
      const id = this.nextNetId;
      this.nextNetId = this.nextNetId >= 65535 ? 1 : this.nextNetId + 1;
      let used = false;
      for (const q of this.players.values()) if (q.netId === id) { used = true; break; }
      if (!used) return id;
    }
    return 1;
  }
  get size() { return this.players.size; }
  humanCount() {
    let n = 0;
    for (const q of this.players.values()) if (!q.isBot) n++;
    return n;
  }
  botCount() {
    let n = 0;
    for (const q of this.players.values()) if (q.isBot) n++;
    return n;
  }
  setMapState(mapId) {
    const spec = getMap(mapId);
    this.mapId = spec.id;
    this.world = spec.world;
    const bases = spec.teamBases || TEAM_BASES;
    this.bases = bases;
    this.spawnsA = pickSpawns(this.world, spec.mpSpawns || spec.spawns, bases[0]);
    this.spawnsB = pickSpawns(this.world, spec.mpSpawns || spec.spawns, bases[1]);
    if (!this.spawnsA.length) this.spawnsA = buildSpawnPoints(this.world, bases[0]);
    if (!this.spawnsB.length) this.spawnsB = buildSpawnPoints(this.world, bases[1]);
    this.points = (spec.modePoints && spec.modePoints.domination || []).map(function (pt) {
      return { id: pt.id, x: pt.x, y: pt.y, z: pt.z, radius: pt.radius, owner: -1, progress: 0, contested: false };
    });
  }
  broadcast(obj, exceptId) {
    const text = JSON.stringify(obj);
    for (const p of this.players.values()) {
      if (p.isBot) continue;
      if (exceptId && p.id === exceptId) continue;
      if (!p.ws || p.ws.readyState !== WebSocket.OPEN) continue;
      try {
        p.ws.send(text);
        p.bytesOut += Buffer.byteLength(text);
        metrics.msgsOut++;
        metrics.snapWindow.push({ t: Date.now(), bytes: Buffer.byteLength(text) });
      } catch (e) {
        metrics.ioErrors++;
      }
    }
  }
  matchScore() {
    return this.mode.domination ? this.pointScore.slice() : this.teamKills.slice();
  }
  snapshot() {
    const players = [];
    for (const p of this.players.values()) players.push(p.spawnSnapshot());
    return {
      t: 'snap',
      tick: tick,
      ts: Date.now(),
      serverTime: Date.now(),
      state: this.state,
      players: players,
    };
  }
}

function totalPlayers() {
  let n = 0;
  for (const r of rooms.values()) n += r.size;
  return n;
}
function totalHumans() {
  let n = 0;
  for (const r of rooms.values()) n += r.humanCount();
  return n;
}
function totalBots() {
  let n = 0;
  for (const r of rooms.values()) n += r.botCount();
  return n;
}
function teamCounts(room) {
  const counts = [0, 0];
  for (const q of room.players.values()) counts[q.team === 1 ? 1 : 0]++;
  return counts;
}
function humanTeamCounts(room) {
  const counts = [0, 0];
  for (const q of room.players.values()) if (!q.isBot) counts[q.team === 1 ? 1 : 0]++;
  return counts;
}
function roundTimeLeft(room, now) {
  if (room.state === 'warmup') return Math.max(0, Math.ceil((room.warmupEndsAt - now) / 1000));
  if (room.state === 'roundEnd') return Math.max(0, Math.ceil((room.roundOverAt - now) / 1000));
  const total = room.overtime ? room.overtimeSeconds : room.roundSeconds;
  return Math.max(0, total - Math.floor((now - room.roundStart) / 1000));
}
function topPlayer(room) {
  let best = null;
  for (const q of room.players.values()) {
    if (!best || q.kills > best.kills) best = q;
  }
  return best ? { id: best.id, name: best.name, kills: best.kills, bot: !!best.isBot } : null;
}
function leaderTeam(room) {
  const scores = room.matchScore();
  const a = scores[0] || 0;
  const b = scores[1] || 0;
  return a === b ? -1 : a > b ? 0 : 1;
}

function broadcastMatchState(room) {
  room.broadcast({
    t: 'matchState',
    state: room.state,
    timeLeft: roundTimeLeft(room, simNowMs()),
    overtime: !!room.overtime,
    mapId: room.mapId,
    mode: room.modeId,
    teams: room.matchScore(),
    kills: room.teamKills.slice(),
    points: (room.points || []).map(function (p) {
      return { id: p.id, owner: p.owner, progress: round2(p.progress), contested: !!p.contested };
    }),
    warmupSeconds: WARMUP_SECONDS,
  });
}

function startLive(room, now, announce) {
  room.state = 'live';
  room.stateSince = now;
  room.roundStart = now;
  room.roundOver = false;
  room.roundOverAt = 0;
  room.stateEndsAt = 0;
  room.domAccum = 0;
  if (announce !== false) {
    broadcastRoundStart(room, { state: 'live' });
    broadcastMatchState(room);
  }
}

function beginWarmup(room, now) {
  room.state = 'warmup';
  room.stateSince = now;
  room.warmupEndsAt = now + WARMUP_SECONDS * 1000;
  room.roundOver = false;
  room.roundOverAt = 0;
  room.overtime = false;
  broadcastMatchState(room);
}

function endRound(room, winnerTeam, reason, opts) {
  if (room.roundOver) return false;
  opts = opts || {};
  const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : room.roundEndMs;
  room.roundOver = true;
  room.state = 'roundEnd';
  room.stateSince = simNowMs();
  room.roundOverAt = simNowMs() + delayMs;
  room.stateEndsAt = room.roundOverAt;
  // V37：teams 必须是“本模式比分”（据点模式为 pointScore），击杀数单独放 kills。
  const kills = room.teamKills.slice(0, 2);
  const scores = room.matchScore();
  room.broadcast({
    t: 'roundEnd',
    winnerTeam: winnerTeam,
    teams: scores,
    score: scores,
    kills: kills,
    reason: reason || 'score',
    draw: winnerTeam !== 0 && winnerTeam !== 1,
    winner: opts.winner || topPlayer(room),
    mapId: room.mapId,
    mode: room.modeId,
    points: (room.points || []).map(function (p) { return { id: p.id, owner: p.owner }; }),
  });
  room.broadcast({
    t: 'voteStart',
    maps: mapIds(),
    current: room.mapId,
    endsIn: Math.max(1, Math.round(delayMs / 1000)),
  });
  broadcastMatchState(room);
  return true;
}

// 只平衡真人；机器人由 syncBots 补位，避免机器人干扰“最近加入玩家换队”的语义
function balanceTeams(room) {
  let changed = false;
  for (let guard = 0; guard < 16; guard++) {
    const counts = humanTeamCounts(room);
    if (Math.abs(counts[0] - counts[1]) <= 1) break;
    const from = counts[0] > counts[1] ? 0 : 1;
    const to = 1 - from;
    let pick = null;
    for (const q of room.players.values()) {
      if (q.isBot || q.team !== from) continue;
      if (!pick || q.joinedAt > pick.joinedAt) pick = q;
    }
    if (!pick) break;
    pick.team = to;
    changed = true;
    room.broadcast({ t: 'teamChange', id: pick.id, team: to });
  }
  return changed;
}

function assignTeam(room, requested) {
  if (requested === 0 || requested === 1) return requested;
  const counts = humanTeamCounts(room);
  return counts[0] <= counts[1] ? 0 : 1;
}

function resetRoom(room) {
  const counts = Object.create(null);
  for (const id of Object.keys(room.votes)) counts[room.votes[id]] = (counts[room.votes[id]] || 0) + 1;
  let nextMap = room.mapId;
  let best = -1;
  for (const id of Object.keys(counts)) if (counts[id] > best) { best = counts[id]; nextMap = id; }
  room.votes = Object.create(null);
  if (!Object.prototype.hasOwnProperty.call(MAPS, nextMap)) nextMap = room.mapId;
  if (nextMap !== room.mapId) {
    room.setMapState(nextMap);
    room.broadcast({ t: 'mapChange', mapId: nextMap });
  } else {
    room.points = (room.points || []).map(function (pt) {
      return { id: pt.id, x: pt.x, y: pt.y, z: pt.z, radius: pt.radius, owner: -1, progress: 0, contested: false };
    });
  }
  room.roundOver = false;
  room.roundOverAt = 0;
  room.roundStart = simNowMs();
  room.overtime = false;
  room.teamKills = [0, 0];
  room.pointScore = [0, 0];
  room.domAccum = 0;
  room.spawnUse = {};
  room.roundNumber++;
  balanceTeams(room);
  syncBots(room);
  for (const p of room.players.values()) {
    p.kills = 0;
    p.deaths = 0;
    respawn(p);
    room.broadcast(respawnEvent(p));
  }
  if (WARMUP_SECONDS > 0) {
    beginWarmup(room, simNowMs());
    broadcastRoundStart(room, { teams: [0, 0], state: 'warmup' });
  } else {
    startLive(room, simNowMs(), true);
  }
}

// ---------------------------------------------------------------------------
// 权威移动 / 命令
// ---------------------------------------------------------------------------
function respawn(p) {
  const s = p.room ? spawnForRoom(p.room, p.team) : p.spawn;
  p.spawn = s;
  p.pos.x = s.x;
  p.pos.y = s.y;
  p.pos.z = s.z;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.yaw = s.yaw || 0;
  p.pitch = 0;
  p.hp = p.maxHp;
  p.armor = 50;
  p.alive = true;
  p.respawnAt = 0;
  p.onGround = true;
  p.submergedSince = 0;
  p.spawnProtectUntil = simNowMs() + 2000;
  p.history = [];
  initPlayerMovement(p, s);
  p.pos.x = s.x;
  p.pos.y = s.y;
  p.pos.z = s.z;
  p.yaw = s.yaw || 0;
  for (const w of p.slots) {
    w.mag = w.def.mag;
    w.reserve = w.def.reserve;
    w.reloadEnd = 0;
    w.reloadStart = 0;
    w.lastShotAt = 0;
  }
  p.slot = 0;
  recordHistory(p, simNowMs());
}

function recordHistory(p, now) {
  if (!p.alive) return;
  p.history.push({
    t: now,
    tick: tick,
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z,
    crouch: !!p.crouching,
    yaw: p.yaw,
  });
  const cutoff = now - 1000;
  while (p.history.length > 2 && p.history[0].t < cutoff) p.history.shift();
  if (p.history.length > 90) p.history.splice(0, p.history.length - 90);
}

function currentPose(p) {
  return {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z,
    crouch: !!p.crouching,
    yaw: p.yaw,
  };
}

function sampleHistory(p, at) {
  const h = p.history;
  if (!h || !h.length) return currentPose(p);
  if (at <= h[0].t) return h[0];
  if (at >= h[h.length - 1].t) return h[h.length - 1];
  let lo = 0;
  let hi = h.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (h[mid].t <= at) lo = mid;
    else hi = mid;
  }
  const a = h[lo];
  const b = h[hi];
  const span = b.t - a.t;
  const f = span > 0 ? (at - a.t) / span : 0;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    crouch: (a.crouch ? 1 : 0) * (1 - f) + (b.crouch ? 1 : 0) * f >= 0.5,
    yaw: a.yaw,
  };
}

// V53 NET-2：服务器不再维护 MOVE 表/stepPlayer 副本。Player 直接携带 packages/sim
// stepPlayer 需要的完整状态字段，逐步调用共享实现；服务器只保留 seaY 死亡判定。
/** 用共享 createPlayerState 初始化/重置 Player 上的移动字段（复活也走这里）。 */
function initPlayerMovement(p, spawn) {
  const st = sim.movement.createPlayerState(null, spawn, SERVER_TUNING);
  for (let i = 0; i < SIM_STATE_FIELDS.length; i++) {
    const k = SIM_STATE_FIELDS[i];
    p[k] = st[k];
  }
  // 服务器仍用 p.hp/armor 作为权威血量；sim 内部血量设成不可死亡，避免两套血量互相覆盖。
  p.health = SERVER_TUNING.maxHealth;
  p.maxHealth = SERVER_TUNING.maxHealth;
  p.sinceDamage = 0;
  p.simTuning = SERVER_TUNING;
  p.input = { move: { x: 0, y: 0 }, jump: false, sprint: false, crouch: false };
  p.prevCmdButtons = 0;
  p.jumpQueued = false;
  return p;
}

/** 权威一步：输入命令对象必须含 mx/my/yaw/pitch/buttons（tick 可选）。 */
function stepPlayer(p, cmd, dt) {
  if (!p.alive) return;
  const worldObj = p.room && p.room.world;
  if (!worldObj || !cmd) return;
  p.input.move.x = numOr(cmd.mx, 0);
  p.input.move.y = numOr(cmd.my, 0);
  sim.movement.stepPlayer(p, cmd, worldObj, dt, SERVER_TUNING);
  // 快照/角色姿态读取的是“实际姿态”：低顶棚下松蹲仍保持 crouch，滑铲期间也蹲伏。
  p.input.crouch = !!p.crouching;
  p.input.sprint = !!p.sprinting;
  p.input.jump = false;
  // V53 SRV-4：共享代码的掉海自救在服务器关闭（rescueDepth=1e9）；
  // 这里保留服务器自己的 seaY 死亡处理，由 respawnAt 驱动复活。
  if (p.pos.y < worldObj.seaY - 2.2) {
    if (!p.submergedSince) p.submergedSince = simNowMs();
    killByEnvironment(p, 'sea', '坠海');
  } else {
    p.submergedSince = 0;
  }
}

function enqueueCommand(p, cmd) {
  if (!p || !p.alive) return false;
  const now = simNowMs();
  const win = p.cmdWindow;
  // 输入速率窗口是真实世界 1 秒；不能和模拟时钟混用，否则 sim 时间倒退会永远不重置窗口。
  const realNow = Date.now();
  if (realNow - win.start > 1000) {
    win.start = realNow;
    win.count = 0;
  }
  win.count++;
  if (win.count > MAX_CMD_RATE) {
    metrics.rateLimited++;
    metrics.cmdDropped++;
    audit('cmd_rate', p, { count: win.count });
    return false;
  }
  let mx = cmd.mx;
  let my = cmd.my;
  if (!Number.isFinite(mx)) mx = 0;
  if (!Number.isFinite(my)) my = 0;
  const len2 = mx * mx + my * my;
  if (len2 > 1) {
    const inv = 1 / Math.sqrt(len2);
    mx *= inv;
    my *= inv;
    if (!p.isBot) audit('axis_overflow', p, { mx: cmd.mx, my: cmd.my });
  }
  let seq = cmd.seq;
  if (!Number.isFinite(seq) || seq <= 0) seq = p.lastQueuedSeq + 1;
  seq = Math.floor(seq);
  if (seq <= p.lastQueuedSeq) {
    metrics.cmdDropped++;
    metrics.cmdOutOfOrder++;
    audit('cmd_stale', p, { seq: seq, last: p.lastQueuedSeq });
    return false;
  }
  const buttons = (cmd.buttons | 0) & ALL_BUTTONS;
  const illegal = (cmd.buttons | 0) & ~ALL_BUTTONS;
  if (illegal) audit('button_bits', p, { bits: illegal });
  const out = {
    seq: seq,
    tick: Math.floor(numOr(cmd.tick, 0)),
    mx: mx,
    my: my,
    yaw: wrapYaw(numOr(cmd.yaw, p.yaw)),
    pitch: clamp(numOr(cmd.pitch, p.pitch), -sim.command.PITCH_LIMIT, sim.command.PITCH_LIMIT),
    buttons: buttons,
    slot: cmd.slot === 1 ? 1 : 0,
    slotExplicit: !!cmd.slotExplicit,
  };
  // V37：队列满时拒绝“新命令”，不 shift 掉已接受命令，也不推进 lastQueuedSeq。
  // 这样客户端补发的旧 seq 仍会按乱序拒绝，而新 seq 不受影响。
  if (p.cmdQueue.length >= MAX_CMD_QUEUE) {
    metrics.cmdDropped++;
    metrics.cmdQueueFull++;
    audit('cmd_queue_full', p, { queue: p.cmdQueue.length, seq: seq, last: p.lastQueuedSeq });
    return false;
  }
  p.cmdQueue.push(out);
  p.lastQueuedSeq = seq;
  p.lastSeen = now;
  return true;
}

function nextCommand(p) {
  if (p.cmdQueue.length) {
    const cmd = p.cmdQueue.shift();
    p.lastSimSeq = cmd.seq;
    p.lastCmd = cmd;
    p.starved = 0;
    return cmd;
  }
  p.starved++;
  const base = p.lastCmd || ZERO_CMD;
  // 无命令：重复移动轴与视角，但所有按钮为 0（不连发、不换弹、不跳）
  return {
    seq: p.lastSimSeq,
    tick: base.tick,
    mx: base.mx,
    my: base.my,
    yaw: base.yaw,
    pitch: base.pitch,
    buttons: 0,
    slot: p.slot,
    slotExplicit: false,
  };
}

function applyCommand(p, cmd) {
  p.yaw = wrapYaw(cmd.yaw);
  p.pitch = clamp(cmd.pitch, -sim.command.PITCH_LIMIT, sim.command.PITCH_LIMIT);
  p.input.move.x = cmd.mx;
  p.input.move.y = cmd.my;
  p.input.sprint = !!(cmd.buttons & BTN.SPRINT);
  p.input.crouch = !!(cmd.buttons & BTN.CROUCH);
  if (cmd.slotExplicit && cmd.slot !== p.slot) switchSlot(p, cmd.slot, true);
  // 跳跃/蹲/滑铲/翻越的按键边沿由共享 stepPlayer 用 st.prevButtons 统一处理，
  // 服务器不再维护 jumpQueued 副本，避免两套边沿语义分叉。
  if ((cmd.buttons & BTN.RELOAD) && !(p.prevCmdButtons & BTN.RELOAD)) startReload(p, true);
  p.prevCmdButtons = cmd.buttons;
  // V53 NET-1：人控命令里的 FIRE 位只表示“客户端此刻按着扳机”，权威开火只走显式 t:'fire'。
  // 机器人没有独立 fire 消息，仍用命令 FIRE 位开火（p.isBot 分支）。
  if ((cmd.buttons & BTN.FIRE) && p.isBot) attemptFire(p, { explicit: false, viaCommand: true });
}

// V53 SRV-9：有界追赶。每 tick 至少消费 1 条；backlog>4 时消费 2 条，>12 时 3 条。
// 每条命令仍按固定步 dt 依次 apply + stepPlayer，所以 60Hz 模拟与射击/换弹语义不变；
// 追赶只是把该玩家欠下的模拟步在同一 tick 里补完，避免队列堆到 120（约 2 秒延迟）。
function consumeCommands(p, dt, now) {
  if (!p.alive) {
    p.input.move.x = 0;
    p.input.move.y = 0;
    return 0;
  }
  const backlog = p.cmdQueue.length;
  let budget = 1;
  if (backlog > CMD_CATCHUP_BACKLOG * 3) budget = CMD_CATCHUP_MAX;
  else if (backlog > CMD_CATCHUP_BACKLOG) budget = 2;
  let consumed = 0;
  for (let i = 0; i < budget; i++) {
    if (i > 0 && !p.cmdQueue.length) break;
    if (!p.alive) break;
    const cmd = nextCommand(p);
    // V37：超过 500ms 没有收到新输入时停走（保留视角），避免掉线滑行/踩点。
    if (now - p.lastSeen > 500) {
      cmd.mx = 0;
      cmd.my = 0;
    }
    applyCommand(p, cmd);
    stepPlayer(p, cmd, dt);
    recordHistory(p, now);
    consumed++;
  }
  if (consumed > 1) metrics.cmdCatchup += consumed - 1;
  return consumed;
}

// ---------------------------------------------------------------------------
// 武器 / 命中 / 延迟补偿
// ---------------------------------------------------------------------------
const damagePipeline = sim.damage.createDamagePipeline({ defaults: false });
// 与 V31 一致的护甲规则：最多吸收伤害的 65%，且不超过剩余护甲；护甲同时被消耗。
damagePipeline.use('armor', function (ev, res) {
  if (res.stopped) return;
  if (ev.ignoreArmor) return;
  const armor = Math.max(0, numOr(ev.armor, 0));
  const absorb = Math.min(armor, res.amount * 0.65);
  res.amount -= absorb;
  res.absorbed += absorb;
  ev.armor = armor - absorb;
});
damagePipeline.use('apply', function (ev, res) {
  if (res.stopped) return;
  if (typeof ev.health === 'number') ev.health = Math.max(0, ev.health - res.amount);
});
damagePipeline.use('post', function (ev, res) {
  if (res.stopped) return;
  res.final = Math.max(0, res.amount);
  if (typeof ev.health === 'number') res.killed = ev.health <= 0;
});

function switchSlot(p, slot, silent) {
  if (slot !== 0 && slot !== 1) return false;
  if (slot === p.slot) return true;
  const target = p.slots[slot];
  if (!target) return false;
  const prev = p.slots[p.slot];
  if (prev) {
    prev.reloadEnd = 0;
    prev.reloadStart = 0;
  }
  p.slot = slot;
  // V37：换枪统一广播 t:'weapon'（带两把枪状态），并保留 weaponSwitch 旧别名。
  // silent 仅表示“命令路径已由输入 slot 触发”，广播仍然需要让其他客户端同步。
  broadcastWeaponState(p);
  return true;
}

function startReload(p, silent) {
  const w = p.currentWeaponState();
  if (!p.alive) return false;
  if (w.reloadEnd > 0) return false;
  if (w.mag >= w.def.mag) {
    if (!silent && p.ws) p.send({ t: 'reloadDenied', reason: 'full', wpn: w.def.id });
    return false;
  }
  if (w.reserve <= 0) {
    if (!silent && p.ws) p.send({ t: 'reloadDenied', reason: 'no_reserve', wpn: w.def.id });
    return false;
  }
  const duration = (w.mag === 0 ? w.def.reloadEmpty : w.def.reloadTactical) * 1000;
  w.reloadStart = simNowMs();
  w.reloadEnd = w.reloadStart + duration;
  w.reloadEmpty = w.mag === 0;
  p.room.broadcast({ t: 'reloadStart', id: p.id, wpn: w.def.id, ms: Math.round(duration), bot: !!p.isBot });
  return true;
}

function finishReload(p, now) {
  const w = p.currentWeaponState();
  if (!w.reloadEnd) return false;
  if (now < w.reloadEnd) return false;
  const need = w.def.mag - w.mag;
  const take = Math.max(0, Math.min(need, w.reserve));
  w.mag += take;
  w.reserve -= take;
  w.reloadEnd = 0;
  w.reloadStart = 0;
  if (p.ws) p.send({ t: 'reloadDone', wpn: w.def.id, mag: w.mag, reserve: w.reserve });
  return true;
}

// V53 NET-1：拒绝消息必须回带 shotSeq，客户端才能精确回滚对应那一发；
// 同时带上当前权威 mag/reserve/wpn/slot，客户端按服务端状态回滚而不是猜“最后一发”。
function rejectShot(p, reason, def, shotSeq) {
  metrics.shotsRejected++;
  metrics.rejectReasons[reason] = (metrics.rejectReasons[reason] || 0) + 1;
  audit('shot_' + reason, p, { wpn: def ? def.id : null });
  const w = p.currentWeaponState();
  const payload = {
    t: 'shotRejected',
    reason: reason,
    wpn: def ? def.id : (w && w.def ? w.def.id : null),
    shotSeq: Number.isFinite(shotSeq) ? Math.floor(shotSeq) : null,
    slot: p.slot,
    mag: w ? w.mag | 0 : null,
    reserve: w ? w.reserve | 0 : null,
    at: Date.now(),
  };
  // 兼容旧客户端字段名（ammo）
  payload.ammo = payload.mag;
  if (p.ws) p.send(payload);
  return { ok: false, reason: reason, shotSeq: payload.shotSeq };
}

function raySphere(origin, dir, cx, cy, cz, radius) {
  const ox = origin.x - cx;
  const oy = origin.y - cy;
  const oz = origin.z - cz;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0) return null;
  return { t: t };
}

function rayPose(origin, dir, pose) {
  const crouch = !!pose.crouch;
  const scale = crouch ? 0.68 : 1;
  let best = null;
  const headY = pose.y + 1.68 * scale;
  const head = raySphere(origin, dir, pose.x, headY, pose.z, 0.21);
  if (head) best = { t: head.t, part: 'head' };
  const bodyPts = [[1.25, 'body', 0.34], [0.85, 'body', 0.34], [0.45, 'limb', 0.30]];
  for (const bp of bodyPts) {
    const h = raySphere(origin, dir, pose.x, pose.y + bp[0] * scale, pose.z, bp[2]);
    if (h && (!best || h.t < best.t)) best = { t: h.t, part: bp[1] };
  }
  return best;
}

function traceBullet(room, shooter, origin, dir, def, now, rewindMs) {
  let start = 0;
  let mult = 1;
  let wallPass = 0;
  let wallSurface = null;
  let wallPoint = null;
  for (let pass = 0; pass < 2; pass++) {
    const base = {
      x: origin.x + dir.x * start,
      y: origin.y + dir.y * start,
      z: origin.z + dir.z * start,
    };
    const remaining = def.range - start;
    if (!(remaining > 0)) break;
    const wall = room.world.raycast(base, dir, remaining);
    wallSurface = wall.hit ? room.world.surfaceName(wall.surface) : null;
    wallPoint = wall.hit ? { x: wall.point.x, y: wall.point.y, z: wall.point.z } : null;
    const limit = wall.hit ? wall.t : remaining;
    let best = null;
    for (const q of room.players.values()) {
      if (q.id === shooter.id) continue;
      if (!q.alive) continue;
      if (q.team === shooter.team) continue;
      if (q.spawnProtectUntil > now) continue;
      const pose = q.isBot ? currentPose(q) : sampleHistory(q, now - rewindMs);
      const h = rayPose(base, dir, pose);
      if (h && h.t < limit && (!best || h.t < best.t)) best = { q: q, h: h };
    }
    if (best) {
      return {
        hit: true,
        target: best.q,
        part: best.h.part,
        dist: start + best.h.t,
        point: {
          x: base.x + dir.x * best.h.t,
          y: base.y + dir.y * best.h.t,
          z: base.z + dir.z * best.h.t,
        },
        wallPass: wallPass,
        mult: mult,
        rewindMs: rewindMs,
        wallSurface: wallSurface,
      };
    }
    if (!wall.hit) break;
    if (wallPass >= 1) break;
    if (!(def.penetration > 0)) break;
    if (!(wall.t < remaining)) break;
    wallPass++;
    mult *= def.penetrationMul || 0.7;
    start += wall.t + 0.03;
  }
  return {
    hit: false,
    wallSurface: wallSurface,
    wallPoint: wallPoint,
    rewindMs: rewindMs,
  };
}

function rotateDir(base, right, up, x, y) {
  let dx = base.x + right.x * x + up.x * y;
  let dy = base.y + right.y * x + up.y * y;
  let dz = base.z + right.z * x + up.z * y;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

function pelletDirection(base, index, def, seed) {
  const spreadRad = (def.pelletSpread * Math.PI) / 180;
  const r1 = hash01(seed, index * 2, 0x51ed);
  const r2 = hash01(seed, index * 2 + 1, 0x2f6b);
  const ang = r1 * Math.PI * 2;
  const r = Math.tan(spreadRad) * Math.sqrt(r2);
  const x = Math.cos(ang) * r;
  const y = Math.sin(ang) * r;
  const worldUp = Math.abs(base.y) > 0.98 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const right = {
    x: worldUp.y * base.z - worldUp.z * base.y,
    y: worldUp.z * base.x - worldUp.x * base.z,
    z: worldUp.x * base.y - worldUp.y * base.x,
  };
  const rl = Math.hypot(right.x, right.y, right.z) || 1;
  right.x /= rl; right.y /= rl; right.z /= rl;
  const up = {
    x: base.y * right.z - base.z * right.y,
    y: base.z * right.x - base.x * right.z,
    z: base.x * right.y - base.y * right.x,
  };
  return rotateDir(base, right, up, x, y);
}

function hash01(seed, index, salt) {
  let x = (seed >>> 0) ^ Math.imul((index | 0) + 1, 0x9e3779b1) ^ (salt | 0);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

function damageForHit(part, def, dist, mult) {
  const falloff = sim.weapons.damageAtRange(def.damage, dist, {
    start: def.falloff.start,
    end: def.falloff.end,
    min: def.falloff.minMul,
  });
  let partMul = 1;
  if (part === 'head') partMul = def.headMul;
  else if (part === 'limb') partMul = def.limbMul;
  return falloff * partMul * mult;
}

function applyDamageHit(shooter, victim, result, def) {
  const room = shooter.room;
  const now = Date.now();
  const raw = damageForHit(result.part, def, result.dist, result.mult);
  const ev = { amount: raw, armor: victim.armor, health: victim.hp };
  const res = damagePipeline.run(ev);
  const hpBefore = victim.hp;
  victim.armor = Math.max(0, numOr(ev.armor, victim.armor));
  victim.hp = Math.max(0, numOr(ev.health, victim.hp));
  const dealt = Math.max(0, hpBefore - victim.hp);
  if (result.rewindMs > 0) metrics.lagcompHits++;
  room.broadcast({
    t: 'hit',
    by: shooter.id,
    victim: victim.id,
    dmg: Math.round(dealt),
    raw: round2(raw),
    absorbed: round2(raw - Math.max(0, res.final)),
    hp: Math.round(victim.hp),
    armor: Math.round(victim.armor),
    part: result.part,
    hs: result.part === 'head',
    wpn: def.id,
    dist: round2(result.dist),
    lagcomp: result.rewindMs,
    point: [round3(result.point.x), round3(result.point.y), round3(result.point.z)],
    from: [round3(shooter.pos.x), round3(shooter.pos.y), round3(shooter.pos.z)],
    bot: !!shooter.isBot,
  });
  if (victim.hp <= 0 && victim.alive) {
    killPlayer(shooter, victim, result.part === 'head', def, result.dist, result.rewindMs);
  }
  return dealt;
}

// V53 SRV-4：统一的死亡入口。被击杀与掉海/环境死亡都走这里：计死亡、进入复活等待、
// 广播 kill（带 reason），之后由 simulateRoom 的 respawnAt 定时复活并广播 respawn。
function beginDeath(victim, info) {
  if (!victim || !victim.alive || !victim.room) return false;
  info = info || {};
  const room = victim.room;
  const now = simNowMs();
  const killer = info.killer || null;
  const def = info.def || null;
  victim.alive = false;
  victim.hp = 0;
  victim.respawnAt = now + RESPAWN_MS;
  victim.submergedSince = 0;
  const live = room.state === 'live';
  if (live) {
    victim.deaths++;
    if (!victim.isBot && victim.profileToken) awardProfileXp(victim.profileToken, 0, { death: true });
  }
  if (killer && live) {
    killer.kills++;
    room.teamKills[killer.team] = (room.teamKills[killer.team] || 0) + 1;
    if (!killer.isBot && killer.profileToken) {
      const profile = awardProfileXp(killer.profileToken, info.hs ? 30 : 20, { kill: true });
      if (!killer.profile && profile) killer.profile = profile;
    }
  }
  room.broadcast({
    t: 'kill',
    by: killer ? killer.id : null,
    victim: victim.id,
    hs: !!info.hs,
    wpn: def ? def.id : null,
    byName: killer ? killer.name : (info.byName || null),
    victimName: victim.name,
    team: killer ? killer.team : null,
    dist: round2(info.dist || 0),
    lagcomp: info.rewind || 0,
    bot: !!(killer && killer.isBot),
    victimBot: !!victim.isBot,
    warmup: room.state === 'warmup',
    reason: info.reason || 'shot',
  });
  if (killer && live) {
    const scores = room.matchScore();
    if (scores[killer.team] >= room.scoreLimit) {
      endRound(room, killer.team, 'score', {
        winner: { id: killer.id, name: killer.name, kills: killer.kills, bot: !!killer.isBot },
      });
    }
  }
  return true;
}

function killPlayer(shooter, victim, hs, def, dist, rewindMs) {
  return beginDeath(victim, {
    killer: shooter, hs: hs, def: def, dist: dist, rewind: rewindMs, reason: 'shot',
  });
}

// 掉海/出界：不直接回满，走正常死亡流程（计死亡、等 RESPAWN_MS、广播 kill + respawn）。
function killByEnvironment(p, reason, byName) {
  return beginDeath(p, { killer: null, reason: reason || 'environment', byName: byName || '坠海' });
}

function attemptFire(p, opts) {
  opts = opts || {};
  const now = simNowMs();
  const room = p.room;
  const shotSeq = Number.isFinite(opts.shotSeq) ? Math.floor(opts.shotSeq) : null;
  if (!room) return { ok: false, reason: 'no_room' };
  if (!p.alive) return opts.explicit ? rejectShot(p, 'dead', p.currentWeapon(), shotSeq) : { ok: false, reason: 'dead' };
  if (room.state === 'roundEnd' || room.roundOver) {
    return opts.explicit ? rejectShot(p, 'round_end', p.currentWeapon(), shotSeq) : { ok: false, reason: 'round_end' };
  }
  const w = p.currentWeaponState();
  const def = w.def;
  if (w.reloadEnd) {
    if (now >= w.reloadEnd) finishReload(p, now);
    else return opts.explicit ? rejectShot(p, 'reloading', def, shotSeq) : { ok: false, reason: 'reloading' };
  }
  if (w.mag <= 0) {
    if (w.reserve > 0) startReload(p, true);
    return opts.explicit ? rejectShot(p, 'empty', def, shotSeq) : { ok: false, reason: 'empty' };
  }
  const minInterval = 60000 / def.rpm - 2;
  if (now - w.lastShotAt < minInterval) {
    return opts.explicit ? rejectShot(p, 'rate', def, shotSeq) : { ok: false, reason: 'rate' };
  }
  let dir = normalizeDir(opts.dir);
  if (!dir) dir = dirFromAngles(p.yaw, p.pitch);
  const view = dirFromAngles(p.yaw, p.pitch);
  if (dot3(dir, view) < Math.cos(0.06)) {
    return opts.explicit ? rejectShot(p, 'aim_mismatch', def, shotSeq) : { ok: false, reason: 'aim_mismatch' };
  }
  w.mag--;
  w.lastShotAt = now;
  w.shotIndex++;
  p.lastFire = now;
  const origin = eyePos(p);
  // V37：只用服务端 ws ping/pong 实测 RTT；加 100ms 基线并夹在 0–250ms。
  const rewindMs = clamp(p.rtt / 2 + REWIND_BASE_MS, 0, REWIND_MAX_MS);
  const pellets = Math.max(1, def.pellets | 0);
  const seed = (crypto.randomBytes(4).readUInt32LE(0) ^ (w.shotIndex * 2654435761)) >>> 0;
  let hitCount = 0;
  let totalRaw = 0;
  const hitsByVictim = new Map();
  if (rewindMs > 0) metrics.lagcompShots++;
  for (let i = 0; i < pellets; i++) {
    const pd = pellets > 1 ? pelletDirection(dir, i, def, seed) : dir;
    const result = traceBullet(room, p, origin, pd, def, now, rewindMs);
    if (!result.hit) continue;
    hitCount++;
    totalRaw += damageForHit(result.part, def, result.dist, result.mult);
    const prev = hitsByVictim.get(result.target.id) || { target: result.target, parts: [], dist: result.dist };
    prev.parts.push(result.part);
    hitsByVictim.set(result.target.id, prev);
    applyDamageHit(p, result.target, result, def);
  }
  room.broadcast({
    t: 'fire',
    by: p.id,
    name: p.name,
    wpn: def.id,
    slot: p.slot,
    origin: [round3(origin.x), round3(origin.y), round3(origin.z)],
    dir: [round3(dir.x), round3(dir.y), round3(dir.z)],
    ammo: w.mag,
    reserve: w.reserve,
    pellets: pellets,
    hits: hitCount,
    raw: round2(totalRaw),
    lagcomp: Math.round(rewindMs),
    bot: !!p.isBot,
  });
  if (w.mag <= 0 && w.reserve > 0) startReload(p, true);
  return { ok: true, hits: hitCount, raw: totalRaw };
}

// ---------------------------------------------------------------------------
// 机器人
// ---------------------------------------------------------------------------
const BOT_NAMES = ['灰鳍', '铁锚', '盐雾', '旧港', '浮标', '潮线', '北堤', '锈钉', '夜航', '窄湾'];
let botSerial = 0;

function botName() {
  const base = BOT_NAMES[botSerial % BOT_NAMES.length];
  botSerial++;
  return 'BOT-' + base + '-' + (botSerial % 97);
}

function createBot(room, team) {
  const spawn = spawnForRoom(room, team);
  const bot = new Player(null, room, botName(), team, spawn, {
    isBot: true,
    botSkill: BOT_SKILL,
    loadout: { primary: team === 1 ? 'smg' : 'pac9', secondary: 'sidearm' },
  });
  bot.rtt = 0;
  room.players.set(bot.id, bot);
  room.broadcast({ t: 'join', player: bot.spawnSnapshot(), bot: true });
  return bot;
}

function removeBot(room, bot) {
  if (!bot || !room.players.delete(bot.id)) return;
  room.broadcast({ t: 'leave', id: bot.id, bot: true });
}

function syncBots(room) {
  if (!BOTS_TARGET || room.humanCount() === 0) {
    for (const p of Array.from(room.players.values())) if (p.isBot) removeBot(room, p);
    return;
  }
  // BOTS=0 关闭；任何正数都先把每队补到 4 人（任务要求 4v4），再受模式/MAX_PLAYERS 限制。
  const targetTotal = Math.max(8, BOTS_TARGET);
  const perTeam = Math.max(1, Math.min(4, Math.floor(Math.min(targetTotal, room.maxPlayers) / 2)));
  const humans = humanTeamCounts(room);
  const want = [Math.max(0, perTeam - humans[0]), Math.max(0, perTeam - humans[1])];
  const have = [0, 0];
  for (const p of room.players.values()) if (p.isBot) have[p.team === 1 ? 1 : 0]++;
  // 先删多余机器人（优先删最近加入的）
  for (let team = 0; team < 2; team++) {
    while (have[team] > want[team]) {
      let pick = null;
      for (const p of room.players.values()) {
        if (!p.isBot || p.team !== team) continue;
        if (!pick || p.joinedAt >= pick.joinedAt) pick = p;
      }
      if (!pick) break;
      removeBot(room, pick);
      have[team]--;
    }
  }
  // 再补
  for (let team = 0; team < 2; team++) {
    let guard = 0;
    while (have[team] < want[team] && room.size < room.maxPlayers && guard++ < 16) {
      createBot(room, team);
      have[team]++;
    }
  }
}

function nearestEnemy(room, p) {
  let best = null;
  let bestD = Infinity;
  for (const q of room.players.values()) {
    if (q.id === p.id || !q.alive || q.team === p.team) continue;
    const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
    if (d < bestD) { bestD = d; best = q; }
  }
  return best ? { target: best, dist: bestD } : null;
}

function hasLineOfSight(room, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0.2)) return true;
  const hit = room.world.raycast(from, { x: dx / len, y: dy / len, z: dz / len }, len - 0.15);
  return !hit.hit;
}

function botThink(bot, room, now, dt) {
  if (!bot.alive) return;
  const found = nearestEnemy(room, bot);
  const def = bot.currentWeapon();
  let mx = 0;
  let my = 0;
  let buttons = 0;
  let yaw = bot.yaw;
  let pitch = bot.pitch;
  if (found) {
    const target = found.target;
    const aimY = target.pos.y + (target.input && target.input.crouch ? 0.75 : 1.05);
    const eye = eyePos(bot);
    const dx = target.pos.x - eye.x;
    const dz = target.pos.z - eye.z;
    const dy = aimY - eye.y;
    const horiz = Math.hypot(dx, dz) || 1;
    yaw = Math.atan2(-dx, -dz);
    pitch = Math.atan2(dy, horiz);
    const skillErr = bot.botSkill >= 2 ? 0.006 : bot.botSkill === 0 ? 0.045 : 0.02;
    yaw += (Math.random() - 0.5) * skillErr;
    pitch += (Math.random() - 0.5) * skillErr * 0.6;
    const los = hasLineOfSight(room, eye, { x: target.pos.x, y: aimY, z: target.pos.z });
    const desired = def.class === 'shotgun' ? 4.5 : def.class === 'smg' ? 9 : 14;
    const fx = dx / horiz;
    const fz = dz / horiz;
    let wx = 0;
    let wz = 0;
    if (!los || found.dist > desired) {
      // 简单寻路：优先朝目标；被挡时在 ±30/60/90/120 度里挑一条 2.6m 内无碰撞、
      // 且方向最接近目标的射线，绕开集装箱/墙。
      const probeOrigin = { x: bot.pos.x, y: bot.pos.y + 0.9, z: bot.pos.z };
      function clearDist(ang) {
        const d = { x: fx * Math.cos(ang) - fz * Math.sin(ang), z: fx * Math.sin(ang) + fz * Math.cos(ang) };
        const hit = room.world.raycast(probeOrigin, { x: d.x, y: 0, z: d.z }, 3.0);
        return hit.hit ? hit.t : 3.0;
      }
      let bestAng = 0;
      let bestScore = -Infinity;
      const options = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.85, -1.85, 2.4, -2.4];
      for (const ang of options) {
        const cd = clearDist(ang);
        if (cd < 0.9) continue;
        const score = cd - Math.abs(ang) * 0.8;
        if (score > bestScore) { bestScore = score; bestAng = ang; }
      }
      wx = fx * Math.cos(bestAng) - fz * Math.sin(bestAng);
      wz = fx * Math.sin(bestAng) + fz * Math.cos(bestAng);
      if (bot.onGround && bestScore < 1.2 && Math.random() < 0.05) buttons |= BTN.JUMP;
      if (bestScore < 0.4) {
        wx = 0;
        wz = 0;
        mx = bot.botState.strafe * 0.7;
        if (Math.random() < 0.02) bot.botState.strafe *= -1;
      }
    } else {
      // 保持距离并横向拉扯
      wx = -fz * bot.botState.strafe * 0.75;
      wz = fx * bot.botState.strafe * 0.75;
      if (Math.random() < 0.01) bot.botState.strafe *= -1;
      if (found.dist < 2.5) {
        wx -= fx * 0.6;
        wz -= fz * 0.6;
      }
    }
    // 世界方向 -> 相对当前瞄准 yaw 的 mx/my（desired = mx*right + my*forward）
    if (wx || wz) {
      const len = Math.hypot(wx, wz) || 1;
      wx /= len;
      wz /= len;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      mx = wx * cy - wz * sy;
      my = -wx * sy - wz * cy;
      if (Math.hypot(mx, my) < 0.15) { mx = 0; my = 0; }
    }
    const reaction = bot.botSkill >= 2 ? 90 : bot.botSkill === 0 ? 380 : 200;
    if (bot.botState.targetId !== target.id) {
      bot.botState.targetId = target.id;
      bot.botState.senseAt = now + reaction;
    }
    if (los && found.dist <= def.range * 0.95 && now >= bot.botState.senseAt) {
      buttons |= BTN.FIRE;
    }
    if (bot.currentWeaponState().mag <= 0 && bot.currentWeaponState().reserve > 0) buttons |= BTN.RELOAD;
  } else {
    // 没有敌人：原地小幅巡逻
    if (now >= bot.botState.decideAt) {
      bot.botState.decideAt = now + 1800 + Math.random() * 1200;
      bot.botState.patrolYaw = Math.random() * Math.PI * 2;
      bot.botState.patrolUntil = now + 1200 + Math.random() * 1000;
    }
    if (now < (bot.botState.patrolUntil || 0)) {
      yaw = bot.botState.patrolYaw || bot.yaw;
      my = 0.45;
    }
  }
  enqueueCommand(bot, {
    seq: bot.lastQueuedSeq + 1,
    tick: tick,
    mx: mx,
    my: my,
    yaw: yaw,
    pitch: pitch,
    buttons: buttons,
    slot: bot.slot,
    slotExplicit: false,
  });
}

// ---------------------------------------------------------------------------
// 据点争夺
// ---------------------------------------------------------------------------
function updateDomination(room, dt, now) {
  if (!room.mode.domination || room.state !== 'live') return;
  const scores = room.pointScore;
  const dtSec = dt;
  for (const pt of room.points) {
    let countA = 0;
    let countB = 0;
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.pos.x - pt.x, p.pos.z - pt.z);
      if (d > pt.radius) continue;
      if (Math.abs(p.pos.y - pt.y) > 3.5) continue;
      if (p.team === 1) countB++;
      else countA++;
    }
    const a = countA > 0;
    const b = countB > 0;
    pt.contested = a && b;
    if (pt.contested || (!a && !b)) continue;
    const team = a ? 0 : 1;
    const count = a ? countA : countB;
    const rate = (1 + 0.5 * Math.min(3, count - 1)) / DOM_CAPTURE_SECONDS;
    if (pt.owner === team) {
      pt.progress = 1;
    } else if (pt.owner === -1) {
      pt.progress = Math.min(1, pt.progress + rate * dtSec);
      if (pt.progress >= 1) {
        pt.owner = team;
        pt.progress = 1;
        room.broadcast({ t: 'pointCaptured', id: pt.id, owner: team, teams: scores.slice() });
      }
    } else {
      // 敌方据点：先中立化，再占领
      pt.progress = Math.max(0, pt.progress - rate * dtSec);
      if (pt.progress <= 0) {
        pt.owner = -1;
        pt.progress = 0;
        room.broadcast({ t: 'pointNeutralized', id: pt.id, owner: -1 });
      }
    }
  }
  room.domAccum += dt * 1000;
  while (room.domAccum >= DOM_SCORE_INTERVAL_MS) {
    room.domAccum -= DOM_SCORE_INTERVAL_MS;
    let changed = false;
    for (const pt of room.points) {
      if (pt.owner === 0 || pt.owner === 1) {
        scores[pt.owner] = (scores[pt.owner] || 0) + 1;
        changed = true;
      }
    }
    if (changed) {
      room.broadcast({
        t: 'domination',
        points: room.points.map(function (pt) { return { id: pt.id, owner: pt.owner, progress: round2(pt.progress), contested: !!pt.contested }; }),
        teams: scores.slice(),
        timeLeft: roundTimeLeft(room, now),
      });
      if (scores[0] >= room.scoreLimit || scores[1] >= room.scoreLimit) {
        endRound(room, scores[0] >= scores[1] ? 0 : 1, 'score');
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 模拟主循环
// ---------------------------------------------------------------------------
function broadcastScore(room, now) {
  room.broadcast({
    t: 'score',
    timeLeft: roundTimeLeft(room, now),
    overtime: !!room.overtime,
    mapId: room.mapId,
    mode: room.modeId,
    state: room.state,
    teams: room.matchScore(),
    kills: room.teamKills.slice(),
    cmdDropped: metrics.cmdDropped,
    points: (room.points || []).map(function (p) {
      return { id: p.id, owner: p.owner, progress: round2(p.progress), contested: !!p.contested };
    }),
    players: Array.from(room.players.values()).map(function (q) {
      return {
        id: q.id,
        name: q.name,
        team: q.team,
        kills: q.kills,
        deaths: q.deaths,
        ping: Math.round(q.rtt),
        bot: !!q.isBot,
        alive: !!q.alive,
        hp: Math.round(q.hp),
      };
    }),
  });
}

// V53 SRV-7：每个房间单独模拟。一个房间抛错只影响本房间，后续房间继续推进；
// 连续失败达到 ROOM_FAIL_LIMIT 次后关闭该房间并广播，避免“毒房间”每 tick 反复抛错。
function simulateRoom(room, dt, now) {
  for (const p of room.players.values()) {
    // 换弹完成（每个模拟步检查，权威于客户端表现）
    const wsReload = p.currentWeaponState();
    if (wsReload.reloadEnd && now >= wsReload.reloadEnd) finishReload(p, now);
    if (!p.alive && p.respawnAt && now >= p.respawnAt) {
      respawn(p);
      room.broadcast(respawnEvent(p));
    }
    // V53 SRV-4 防卡死兜底：若出生点异常等原因让玩家在水下仍存活超过 3 秒，
    // 直接回出生点并广播 respawn，避免反复死亡/卡死。
    if (p.alive && p.pos.y < room.world.seaY - 2.2) {
      if (!p.submergedSince) p.submergedSince = now;
      else if (now - p.submergedSince > 3000) {
        respawn(p);
        room.broadcast(respawnEvent(p));
      }
    } else if (p.alive) {
      p.submergedSince = 0;
    }
    if (p.isBot && p.alive) botThink(p, room, now, dt);
  }
  for (const p of room.players.values()) consumeCommands(p, dt, now);
  updateDomination(room, dt, now);

  if (room.state === 'warmup' && now >= room.warmupEndsAt) {
    startLive(room, now, true);
  } else if (room.state === 'live') {
    if (room.roundOver) {
      // 比分已结算，等 state 切换
    } else {
      const left = roundTimeLeft(room, now);
      if (left <= 0) {
        const scores = room.matchScore();
        if (scores[0] === scores[1]) {
          if (!room.overtime) {
            room.overtime = true;
            room.roundStart = now;
            room.domAccum = 0;
            room.broadcast({
              t: 'overtime',
              seconds: room.overtimeSeconds,
              teams: scores,
              mapId: room.mapId,
              mode: room.modeId,
              state: room.state,
            });
            broadcastMatchState(room);
          } else {
            endRound(room, leaderTeam(room), 'time');
          }
        } else {
          endRound(room, leaderTeam(room), 'time');
        }
      }
    }
  } else if (room.state === 'roundEnd' && room.roundOverAt && now >= room.roundOverAt) {
    resetRoom(room);
  }

  if (tick % Math.max(1, Math.round(TICK_HZ / 2)) === 0) broadcastScore(room, now);
}

function closeRoomAfterFailures(room, err) {
  metrics.roomsClosed++;
  const reason = err && err.message ? err.message : String(err);
  log('error', 'room closed after repeated simulate failures (V53 SRV-7)', {
    room: room.id,
    fails: room.failCount,
    players: room.size,
    error: reason,
  });
  audit('room_closed', null, { room: room.id, fails: room.failCount, error: reason });
  try {
    room.broadcast({ t: 'error', code: 'room_closed', message: '房间因连续模拟异常已关闭，请重新加入' });
  } catch (e) {}
  for (const p of Array.from(room.players.values())) {
    if (p.isBot) continue;
    try { p.ws.close(1011, 'room_error'); } catch (e) {}
  }
  room.players.clear();
  rooms.delete(room.id);
}

function simulate(dt) {
  // SRV-8：每推进一个模拟步，tick 与模拟时钟一起前进；主循环追帧多步时
  // 每次 simulate() 的时间都不同，射速/换弹/复活/回合计时不会挤在同一毫秒。
  const now = advanceSimClock();
  dt = STEP;
  metrics.cmdQueueLen = 0;
  for (const room of Array.from(rooms.values())) {
    try {
      simulateRoom(room, dt, now);
      if (room.failCount) room.failCount = 0;
    } catch (e) {
      room.failCount = (room.failCount || 0) + 1;
      metrics.roomErrors++;
      log('error', 'room simulate failed (isolated)', {
        room: room.id,
        fails: room.failCount,
        limit: ROOM_FAIL_LIMIT,
        error: e && e.stack ? e.stack : String(e),
      });
      if (room.failCount >= ROOM_FAIL_LIMIT) closeRoomAfterFailures(room, e);
    }
  }
  // V53 SRV-9：队列长度指标（当前最大值 + 历史峰值），用于回归“持续负载下不无界增长”。
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      const len = p.cmdQueue.length;
      if (len > metrics.cmdQueueLen) metrics.cmdQueueLen = len;
      if (len > metrics.cmdQueuePeak) metrics.cmdQueuePeak = len;
    }
  }
}

// ---------------------------------------------------------------------------
// 快照
// ---------------------------------------------------------------------------
function binPlayerList(room) {
  const out = [];
  for (const p of room.players.values()) {
    const w = p.currentWeaponState();
    let state = 0;
    if (p.slot === 1) state |= 1;
    if (w.reloadEnd > simNowMs()) state |= 2;
    if (!p.alive) state |= 4;
    if (p.isBot) state |= 8;
    out.push({
      id: p.netId,
      x: p.pos.x,
      y: p.pos.y,
      z: p.pos.z,
      yaw: p.yaw,
      hp: Math.round(p.hp),
      armor: Math.round(p.armor),
      team: p.team,
      alive: !!p.alive,
      crouch: !!p.crouching,
      spawnProtect: p.spawnProtectUntil > simNowMs(),
      seq: p.lastSimSeq & 255,
      state: state,
    });
  }
  return out;
}

function previousMapFromList(list) {
  const map = {};
  for (const p of list) map[p.id] = p;
  return map;
}

// V53 NET-3：与 packages/net/protocol.js 的 sameSnapshot 保持完全一致的量化阈值。
// 该函数没有导出（不在本任务可改文件内），这里复制一份仅用于判定“这一帧会不会被增量跳过”。
function binSameSnapshot(a, b) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.005 && Math.abs(a.z - b.z) < 0.01 &&
    Math.abs(a.yaw - b.yaw) < 0.002 && a.hp === b.hp && a.armor === b.armor && a.team === b.team &&
    (a.alive !== false) === (b.alive !== false) && !!a.crouch === !!b.crouch &&
    !!a.spawnProtect === !!b.spawnProtect && (a.state | 0) === (b.state | 0);
}
function snapshotIncludedIds(players, prev) {
  const ids = [];
  for (const q of players) {
    const old = prev && prev[q.id];
    if (!old || !binSameSnapshot(q, old)) ids.push(q.id);
  }
  return ids;
}

function sendBinarySnapshot(p, now, binList, shared) {
  if (!p.ws || p.ws.readyState !== WebSocket.OPEN) return;
  const full = !p.snapPrev || (tick - p.snapFullTick >= SNAP_FULL_EVERY);
  let data;
  let included;
  try {
    if (full) {
      if (!shared.fullBuf) shared.fullBuf = Buffer.from(SALT_NET.encodeSnapshot(tick, 0, binList, null));
      data = shared.fullBuf;
      included = binList.map(function (q) { return q.id; });
    } else {
      const sharedBaseline = p.snapPrev === shared.prev && p.snapBaseTick === shared.baseTick;
      const prev = sharedBaseline ? shared.prev : p.snapPrev;
      // V53 NET-3：对“上次真正发给该接收者”的位姿做慢漂移判定。
      // 协议增量按上一 tick 比较，慢速移动每帧都小于 0.01m/0.002rad 会被永久跳过；
      // 这里超过 0.03m/0.02rad 或 0.5 秒未发送就强制包含该玩家。
      const forced = [];
      for (const q of binList) {
        const last = p.snapSent.get(q.id);
        if (!last) continue;
        if (!snapshotForceDue(last, q, tick - last.tick)) continue;
        const old = prev && prev[q.id];
        if (old && binSameSnapshot(q, old)) forced.push(q.id);
      }
      let useShared = sharedBaseline && forced.length === 0;
      let encodePrev = prev;
      if (forced.length) {
        encodePrev = Object.assign(Object.create(null), prev || {});
        for (const id of forced) delete encodePrev[id];
        metrics.snapForced += forced.length;
      }
      if (useShared) {
        if (!shared.deltaBuf) shared.deltaBuf = Buffer.from(SALT_NET.encodeSnapshot(tick, shared.baseTick, binList, shared.prev));
        data = shared.deltaBuf;
      } else {
        // 该客户端因背压漏过帧/刚从全量恢复/慢漂移强制包含：单独编码，基线仍是它最后收到的 tick。
        data = Buffer.from(SALT_NET.encodeSnapshot(tick, p.snapBaseTick, binList, encodePrev));
      }
      included = snapshotIncludedIds(binList, encodePrev);
    }
  } catch (e) {
    metrics.ioErrors++;
    audit('snapshot_encode', p, { error: e.message });
    return;
  }
  if (p.sendRaw(data)) {
    metrics.snapBytesTotal += data.byteLength;
    metrics.snapFrames++;
    metrics.snapWindow.push({ t: now, bytes: data.byteLength });
    if (!shared.nextPrev) shared.nextPrev = previousMapFromList(binList);
    // 任何成功帧发送后，客户端状态都等于本 tick 的 binList，可重新对齐到房间共享基线。
    p.snapPrev = shared.nextPrev;
    p.snapBaseTick = tick;
    if (full) p.snapFullTick = tick;
    // V53 NET-3：只为真正出现在本帧里的玩家记录“上次发送位姿”。
    if (full) p.snapSent.clear();
    for (const id of included) {
      for (const q of binList) {
        if (q.id !== id) continue;
        p.snapSent.set(id, { x: q.x, y: q.y, z: q.z, yaw: q.yaw, tick: tick });
        break;
      }
    }
    shared.sent = true;
  }
}

// 每个 30Hz 快照 tick 单独发 ACK 小帧：不参与增量判定，站定玩家也能持续收到 ack。
function sendBinaryAck(p) {
  if (!p.bin || !p.ws || p.ws.readyState !== WebSocket.OPEN) return;
  try {
    if (p.sendRaw(Buffer.from(SALT_NET.encodeAck(tick, p.lastSimSeq >>> 0)))) metrics.acksSent++;
  } catch (e) {
    metrics.ioErrors++;
  }
}

function broadcastSnapshots(now) {
  pruneSnapWindow(now, 2000);
  for (const room of rooms.values()) {
    if (!room.size) continue;
    // V37：先探测接收者类型；全 bin 房间不构建/序列化完整 JSON snap。
    let hasJson = false;
    let hasBin = false;
    for (const p of room.players.values()) {
      if (p.isBot || !p.ws || p.ws.readyState !== WebSocket.OPEN) continue;
      if (p.bin) hasBin = true;
      else hasJson = true;
    }
    if (!hasJson && !hasBin) continue;
    let jsonText = null;
    if (hasJson) {
      metrics.jsonSnapEncodes++;
      jsonText = JSON.stringify(room.snapshot());
    }
    const binList = hasBin ? binPlayerList(room) : null;
    const shared = hasBin ? {
      prev: room.binPrev || null,
      baseTick: room.binBaseTick || 0,
      nextPrev: null,
      fullBuf: null,
      deltaBuf: null,
      sent: false,
    } : null;
    for (const p of room.players.values()) {
      if (p.isBot || !p.ws || p.ws.readyState !== WebSocket.OPEN) continue;
      if (p.ws.bufferedAmount > 64 * 1024) {
        if (!p.stuckSince) p.stuckSince = now;
        if (now - p.stuckSince > 3000) {
          audit('backpressure_close', p, { buffered: p.ws.bufferedAmount });
          try { p.ws.terminate(); } catch (e) {}
        }
        if (p.bin) sendBinaryAck(p);
        continue;
      }
      p.stuckSince = 0;
      if (p.bin) {
        sendBinarySnapshot(p, now, binList, shared);
        sendBinaryAck(p);
      } else if (jsonText) {
        try {
          p.ws.send(jsonText);
          p.bytesOut += Buffer.byteLength(jsonText);
          metrics.msgsOut++;
          metrics.snapBytesTotal += Buffer.byteLength(jsonText);
          metrics.snapFrames++;
          metrics.snapWindow.push({ t: now, bytes: Buffer.byteLength(jsonText) });
        } catch (e) {
          metrics.ioErrors++;
        }
      }
    }
    if (shared && shared.sent) {
      room.binPrev = shared.nextPrev;
      room.binBaseTick = tick;
    }
  }
}

// ---------------------------------------------------------------------------
// 消息处理
// ---------------------------------------------------------------------------
function sendError(ws, code, message) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'error', code: code, message: message }));
    }
  } catch (e) {}
}

// V53 SRV-3：cost 让 JSON input 按“命令条数”计入窗口，而不是一条消息只算一次。
function rateLimited(p, cost) {
  const now = Date.now();
  if (now - p._msgWindow.start > 1000) {
    p._msgWindow.start = now;
    p._msgWindow.count = 0;
    p._violations = Math.max(0, p._violations - 1);
  }
  const add = Math.max(1, Math.min(Number(cost) || 1, readRateLimit()));
  p._msgWindow.count += add;
  if (p._msgWindow.count > readRateLimit()) {
    metrics.rateLimited++;
    p._violations++;
    audit('msg_rate', p, { count: p._msgWindow.count });
    if (p._violations > 200) p.close(4008, 'rate_limit');
    return true;
  }
  return false;
}

function handleBinaryInput(p, msg) {
  if (!p) return;
  p.bytesIn += 18;
  if (rateLimited(p)) return;
  enqueueCommand(p, {
    seq: msg.seq,
    tick: msg.tick,
    mx: msg.mx,
    my: msg.my,
    // 二进制协议 yaw 编码到 [0,2pi)，解回有符号角
    yaw: wrapYaw(msg.yaw),
    pitch: msg.pitch,
    buttons: msg.buttons,
    slot: msg.slot,
    slotExplicit: true,
  });
}

function handleJsonInput(p, msg) {
  const rawList = Array.isArray(msg.cmds) ? msg.cmds : [msg];
  let list = rawList;
  // V53 SRV-3：单条消息最多处理 8 条命令；多余命令丢弃并审计（日志本身再按 reason 限频）。
  if (rawList.length > MAX_CMDS_PER_INPUT) {
    const dropped = rawList.length - MAX_CMDS_PER_INPUT;
    list = rawList.slice(0, MAX_CMDS_PER_INPUT);
    metrics.cmdsTruncated += dropped;
    metrics.cmdDropped += dropped;
    audit('cmd_batch_truncated', p, {
      count: rawList.length,
      accepted: list.length,
      dropped: dropped,
      cap: MAX_CMDS_PER_INPUT,
    });
  }
  if (rateLimited(p, list.length)) return;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    let buttons = 0;
    if (typeof raw.buttons === 'number' && Number.isFinite(raw.buttons)) {
      buttons = raw.buttons | 0;
    } else {
      if (raw.jump) buttons |= BTN.JUMP;
      if (raw.sprint) buttons |= BTN.SPRINT;
      if (raw.crouch) buttons |= BTN.CROUCH;
      if (raw.ads) buttons |= BTN.ADS;
      if (raw.fire) buttons |= BTN.FIRE;
      if (raw.reload) buttons |= BTN.RELOAD;
    }
    let mx = 0;
    let my = 0;
    if (raw.move && typeof raw.move === 'object') {
      mx = numOr(raw.move.x, 0);
      my = numOr(raw.move.y, 0);
    } else {
      mx = numOr(raw.mx, 0);
      my = numOr(raw.my, 0);
    }
    enqueueCommand(p, {
      seq: numOr(raw.seq, 0),
      tick: numOr(raw.tick, 0),
      mx: mx,
      my: my,
      yaw: numOr(raw.yaw, p.yaw),
      pitch: numOr(raw.pitch, p.pitch),
      buttons: buttons,
      slot: raw.slot === 1 ? 1 : 0,
      slotExplicit: raw.slot === 0 || raw.slot === 1,
    });
  }
}

function handleFireMessage(p, msg) {
  if (!p || !p.room) return;
  if (rateLimited(p)) return;
  // V53 NET-1：显式开火消息携带客户端 shotSeq；拒绝时原样回带，客户端按 seq 回滚。
  const shotSeq = Number.isFinite(msg.shotSeq) ? Math.floor(msg.shotSeq) : null;
  const alias = { rifle: 'pac9', shotgun: 'breaker12', pistol: 'sidearm', sniper: 'dmr' };
  let wpn = typeof msg.wpn === 'string' ? (alias[msg.wpn] || msg.wpn) : null;
  if (wpn) {
    let slot = -1;
    for (let i = 0; i < p.slots.length; i++) if (p.slots[i].def.id === wpn) slot = i;
    if (slot < 0) {
      rejectShot(p, 'bad_weapon', p.currentWeapon(), shotSeq);
      return;
    }
    if (slot !== p.slot) switchSlot(p, slot, true);
  }
  const dir = normalizeDir(msg.dir);
  if (!dir) {
    rejectShot(p, 'bad_dir', p.currentWeapon(), shotSeq);
    return;
  }
  attemptFire(p, { explicit: true, dir: dir, shotSeq: shotSeq });
}

function handleJoin(ws, msg, ctx) {
  if (ctx.player) return;
  if (PROFILE_TOKEN && !isProfileTokenAuthorized(msg)) {
    sendError(ws, 'unauthorized', '需要有效的访问 token');
    ws.close(4003, 'unauthorized');
    return;
  }
  const roomId = sanitizeRoom(msg.room);
  // V53 SRV-5：map/mode 必须是字符串且是自有属性，__proto__/constructor 只按未知值处理。
  const requestedMap = typeof msg.map === 'string' &&
    Object.prototype.hasOwnProperty.call(MAPS, msg.map) ? msg.map : 'harbor';
  // V37：显式传入未知模式必须明确报错，不回退 tdm；未传 mode 才使用默认 tdm。
  if (msg.mode != null && msg.mode !== '' &&
      (typeof msg.mode !== 'string' || !Object.prototype.hasOwnProperty.call(MODES, msg.mode))) {
    sendError(ws, 'mode_unsupported', '不支持的模式：' + String(msg.mode).slice(0, 32) + '（可用：' + MODE_IDS.join('/') + '）');
    ws.close(4004, 'mode_unsupported');
    return;
  }
  const modeId = msg.mode == null || msg.mode === '' ? 'tdm' : msg.mode;
  const roomKey = roomId + '@' + modeId;
  let room = rooms.get(roomKey);
  if (!room) {
    if (rooms.size >= MAX_ROOMS) {
      sendError(ws, 'server_full', '房间数已达上限');
      ws.close(4002, 'server_full');
      return;
    }
    room = new Room(roomKey, requestedMap, modeId);
    rooms.set(roomKey, room);
  }
  if (room.size >= room.maxPlayers) {
    // 有人加入时优先顶掉一个机器人
    const bot = Array.from(room.players.values()).find(function (q) { return q.isBot; });
    if (bot) removeBot(room, bot);
  }
  if (room.size >= room.maxPlayers) {
    sendError(ws, 'room_full', '房间已满（最多 ' + room.maxPlayers + ' 人）');
    ws.close(4001, 'room_full');
    return;
  }
  const devAuthed = isDevAuthorized(msg);
  const requestedTeam = devAuthed && (msg.team === 0 || msg.team === 1) ? msg.team : null;
  const baseName = sanitizeName(msg.name, '几猫');
  const name = uniqueName(room, baseName);
  let team = assignTeam(room, requestedTeam);
  const spawn = spawnForRoom(room, team);
  let profileToken = typeof msg.profileToken === 'string' ? msg.profileToken : null;
  // 兼容：客户端把账号 token 放在 join.token 里（未配置 PROFILE_TOKEN 时）
  if (!profileToken && typeof msg.token === 'string' && profiles.has(msg.token)) profileToken = msg.token;
  const joinProfile = profileToken && profiles.has(profileToken) ? profiles.get(profileToken) : null;
  // dev token 是服务器运维通道；机器人由服务器内部生成，二者不受玩家解锁等级限制。
  const loadoutLevel = devAuthed ? 99 : (joinProfile ? levelForXp(joinProfile.xp) : 1);
  const p = new Player(ws, room, name, team, spawn, {
    bin: Array.isArray(msg.caps) && msg.caps.indexOf('bin') >= 0,
    loadout: msg.loadout,
    loadoutLevel: loadoutLevel,
    profileToken: profileToken,
  });
  if (joinProfile) p.profile = joinProfile;
  if (p.loadoutAdjusted.length) {
    audit('loadout_adjusted', p, { level: loadoutLevel, adjusted: p.loadoutAdjusted });
  }
  room.players.set(p.id, p);
  if (!devAuthed) balanceTeams(room);
  if (p.team !== team) {
    team = p.team;
    respawn(p);
  }
  syncBots(room);
  ctx.player = p;
  ctx.room = room;
  ctx.bin = p.bin;
  clearTimeout(ctx.joinTimer);

  p.send({
    t: 'welcome',
    id: p.id,
    nid: p.netId,
    name: name,
    room: roomId,
    roomKey: room.id,
    mapId: room.mapId,
    mode: room.modeId,
    state: room.state,
    protocol: 2,
    caps: ['bin', 'json'],
    binary: !!p.bin,
    bin: !!p.bin,
    tick: tick,
    tickRate: TICK_HZ,
    snapRate: SNAP_HZ,
    team: p.team,
    serverTime: Date.now(),
    warmupSeconds: WARMUP_SECONDS,
    weapons: WEAPON_IDS.slice(),
    loadout: { primary: p.loadout.primary, secondary: p.loadout.secondary, attachments: p.loadout.attachments },
    loadoutLevel: loadoutLevel,
    loadoutAdjusted: p.loadoutAdjusted.length ? p.loadoutAdjusted : undefined,
    map: {
      boxes: room.world.boxes.count,
      bounds: room.world.bounds,
      spawn: p.spawn,
      seaY: room.world.seaY,
      domination: (room.points || []).map(function (pt) { return { id: pt.id, x: pt.x, y: pt.y, z: pt.z, radius: pt.radius }; }),
    },
    players: Array.from(room.players.values()).map(function (q) { return q.spawnSnapshot(); }),
  });
  room.broadcast({ t: 'join', player: p.spawnSnapshot() }, p.id);
  if (room.state === 'warmup') broadcastMatchState(room);
  log('info', 'join', {
    name: p.name, id: p.id, room: room.id, map: room.mapId, players: room.size,
    humans: room.humanCount(), bots: room.botCount(), bin: p.bin, ip: ctx.ip,
  });
}

function handleDev(p, msg) {
  if (!isDevAuthorized(msg)) {
    if (!DEV_TOKEN) sendError(p.ws, 'dev_disabled', 'dev 指令未启用：服务端未配置 MP_DEV_TOKEN');
    else sendError(p.ws, 'dev_denied', 'dev token 无效');
    return;
  }
  const room = p.room;
  if (msg.cmd === 'round') {
    endRound(room, 0, 'dev', { delayMs: 1500, winner: { id: p.id, name: p.name, kills: p.kills } });
  } else if (msg.cmd === 'live') {
    startLive(room, simNowMs(), true);
  } else if (msg.cmd === 'tp' && typeof msg.x === 'number' && typeof msg.z === 'number') {
    const w = room.world;
    p.pos.x = clamp(msg.x, w.bounds.min.x + 0.5, w.bounds.max.x - 0.5);
    p.pos.z = clamp(msg.z, w.bounds.min.z + 0.5, w.bounds.max.z - 0.5);
    p.pos.y = (typeof msg.y === 'number' ? msg.y : w.groundHeight(p.pos.x, p.pos.z, 50)) + 0.02;
    p.vel.x = p.vel.y = p.vel.z = 0;
    p.alive = true;
    p.hp = 100;
    p.armor = 50;
    p.spawnProtectUntil = 0;
    p.history = [];
    recordHistory(p, simNowMs());
    p.send(respawnEvent(p, { dev: true }));
  } else if (msg.cmd === 'team' && (msg.team === 0 || msg.team === 1)) {
    p.team = msg.team;
    p.room.broadcast({ t: 'teamChange', id: p.id, team: p.team });
    respawn(p);
    syncBots(room);
  } else {
    sendError(p.ws, 'dev_unknown', '未知 dev 指令');
  }
}

function handleMessage(ws, raw, ctx) {
  metrics.msgsIn++;
  if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) {
    audit('message_too_large', ctx.player, { bytes: Buffer.byteLength(raw) });
    try { ws.close(4009, 'message_too_large'); } catch (e) {}
    return;
  }
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (e) {
    sendError(ws, 'bad_json', '消息不是合法 JSON');
    return;
  }
  if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') {
    sendError(ws, 'bad_message', '缺少 t 字段');
    return;
  }
  if (msg.t === 'join') {
    handleJoin(ws, msg, ctx);
    return;
  }
  const p = ctx.player;
  if (!p) {
    sendError(ws, 'not_joined', '请先发送 join');
    return;
  }
  if (msg.t === 'input') {
    handleJsonInput(p, msg);
    return;
  }
  if (msg.t === 'fire') {
    handleFireMessage(p, msg);
    return;
  }
  if (rateLimited(p)) return;
  switch (msg.t) {
    case 'ping': {
      const now = Date.now();
      const ts = numOr(msg.ts, now);
      // 客户端 ping.ts 仅用于显示/兼容；回滚只看 ws ping/pong 的服务端测量值。
      p.clientRtt = clamp(now - ts, 0, 8000);
      p.lastPingAt = now;
      p.send({
        t: 'pong', ts: msg.ts, serverTime: now, tick: tick,
        rtt: Math.round(p.rtt), clientRtt: Math.round(p.clientRtt),
      });
      break;
    }
    case 'reload':
      startReload(p, false);
      break;
    case 'switch':
      switchSlot(p, msg.slot === 1 ? 1 : 0, false);
      break;
    case 'vote':
      if (typeof msg.map === 'string' && Object.prototype.hasOwnProperty.call(MAPS, msg.map)) {
        p.room.votes[p.id] = msg.map;
      }
      break;
    case 'dev':
      handleDev(p, msg);
      break;
    case 'leave':
      ws.close(1000, 'client_leave');
      break;
    default:
      sendError(ws, 'unknown_type', '未知消息类型: ' + msg.t.slice(0, 32));
  }
}

function cleanup(ctx) {
  const room = ctx.room;
  const p = ctx.player;
  if (!p || !room) return;
  if (room.players.delete(p.id)) {
    room.broadcast({ t: 'leave', id: p.id, bot: !!p.isBot });
    if (room.size > 0) balanceTeams(room);
    // 最后一名真人离开后不再保留机器人空转，立即释放房间
    if (room.humanCount() === 0) {
      for (const q of Array.from(room.players.values())) if (q.isBot) removeBot(room, q);
    } else {
      syncBots(room);
    }
    log('info', 'leave', { name: p.name, id: p.id, room: room.id, players: room.size });
  }
  if (room.size === 0) {
    rooms.delete(room.id);
    log('info', 'room closed', { room: room.id, rooms: rooms.size });
  }
  ctx.player = null;
  ctx.room = null;
}

// ---------------------------------------------------------------------------
// HTTP / 静态托管 / Profile API
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
};

function isLoopbackIp(ip) {
  const s = String(ip || '');
  return s === '127.0.0.1' || s === '::1' || s === 'localhost' ||
    s.indexOf('127.') === 0 || s.indexOf('::ffff:127.') === 0;
}

// “内网”用于 healthz 明细：回环 + RFC1918 / IPv6 ULA / link-local。
function isInternalIp(ip) {
  const s = String(ip || '');
  if (isLoopbackIp(s)) return true;
  if (s.indexOf('10.') === 0) return true;
  if (s.indexOf('192.168.') === 0) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(s)) return true;
  if (/^(fc|fd|fe80:)/i.test(s)) return true;
  return false;
}

function corsOrigin(req) {
  const origin = req && req.headers ? req.headers.origin : null;
  if (!origin) return null;
  if (ORIGIN_WHITELIST.length) {
    if (ORIGIN_WHITELIST.indexOf(origin) >= 0) return origin;
    try {
      const u = new URL(origin);
      if (ORIGIN_WHITELIST.indexOf(u.host) >= 0 || ORIGIN_WHITELIST.indexOf(u.hostname) >= 0) return origin;
    } catch (e) {}
    return null;
  }
  try {
    const u = new URL(origin);
    const host = String((req.headers && req.headers.host) || '');
    if (u.host === host) return origin;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1') return origin;
  } catch (e) {}
  return null;
}

function sendJson(req, res, status, obj) {
  const body = JSON.stringify(obj);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  };
  // V37：默认不再回显 *；只按 ORIGIN_WHITELIST（或同源/回环）回显具体 Origin。
  const allow = corsOrigin(req);
  if (allow) {
    headers['Access-Control-Allow-Origin'] = allow;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(body);
}

function metricsAllowed(req, query) {
  if (METRICS_TOKEN) {
    let token = query && query.get ? query.get('token') : '';
    if (!token) {
      const auth = String((req.headers && req.headers.authorization) || '');
      if (auth.indexOf('Bearer ') === 0) token = auth.slice(7).trim();
    }
    if (!token) token = String((req.headers && req.headers['x-metrics-token']) || '');
    return safeEqual(String(token || ''), METRICS_TOKEN);
  }
  return isLoopbackIp(requestIp(req));
}

// V53 SRV-10：?detail=1 的房间明细比基础计数敏感。
// 配置 METRICS_TOKEN 时必须带有效 token；否则要求“真实回环连接”——直接 socket 地址
// 与解析后的客户端地址都必须是回环，XFF 无法把远端连接伪装成 127.0.0.1。
function metricsDetailAllowed(req, query) {
  if (!query || !query.get || query.get('detail') !== '1') return true;
  if (METRICS_TOKEN) return metricsAllowed(req, query);
  return isLoopbackIp(socketIp(req)) && isLoopbackIp(requestIp(req));
}

function sendText(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  if (!STATIC_DIR) {
    sendJson(req, res, 404, { ok: false, error: 'not_found', hint: '设置 STATIC_DIR 可启用静态托管' });
    return;
  }
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    sendJson(req, res, 400, { ok: false, error: 'bad_path' });
    return;
  }
  if (rel === '/' || rel === '') rel = '/index.html';
  const abs = path.resolve(STATIC_DIR, '.' + rel);
  let stat = null;
  try {
    if (!abs.startsWith(STATIC_DIR + path.sep)) {
      sendJson(req, res, 404, { ok: false, error: 'not_found' });
      return;
    }
    stat = fs.statSync(abs);
  } catch (e) {
    sendJson(req, res, 404, { ok: false, error: 'not_found' });
    return;
  }
  if (!stat.isFile()) {
    sendJson(req, res, 404, { ok: false, error: 'not_found' });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  // V53 SRV-13：读流必须挂 error 处理。文件在 stat 之后被删除/权限变化时，
  // 未处理的 'error' 会冒泡成 uncaughtException；这里保证只记录指标并结束响应。
  let stream;
  try {
    stream = fs.createReadStream(abs);
  } catch (e) {
    metrics.ioErrors++;
    sendJson(req, res, 500, { ok: false, error: 'read_error' });
    return;
  }
  stream.on('error', function (err) {
    metrics.ioErrors++;
    audit('static_read_error', null, { file: rel, error: err && err.message });
    if (!res.headersSent) {
      sendJson(req, res, 500, { ok: false, error: 'read_error' });
    } else {
      try { res.destroy(); } catch (e) {}
    }
  });
  res.on('close', function () {
    if (!stream.destroyed) {
      try { stream.destroy(); } catch (e) {}
    }
  });
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60',
  });
  stream.pipe(res);
}

function readJsonBody(req, limit) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (d) {
      size += d.length;
      if (size > limit) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(d);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

const profileRate = new Map();
function profileRateLimited(ip) {
  const now = Date.now();
  if (profileRate.size > 4096) {
    for (const key of profileRate.keys()) {
      const val = profileRate.get(key);
      if (!val || now - val.start > 60000) profileRate.delete(key);
    }
  }
  let e = profileRate.get(ip);
  if (!e || now - e.start > 60000) {
    e = { start: now, count: 0 };
    profileRate.set(ip, e);
  }
  e.count++;
  return e.count > 30;
}

function promEscape(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
function metricsText(includeDetail) {
  const now = Date.now();
  const lines = [];
  function g(name, value, help) {
    if (help) lines.push('# HELP ' + name + ' ' + help);
    lines.push(name + ' ' + value);
  }
  const simMs = metrics.tickLast.toFixed(3);
  const simP99 = tickP99().toFixed(3);
  const callbackMs = metrics.callbackLast.toFixed(3);
  const callbackP99Val = callbackP99().toFixed(3);
  const snapKbpsNow = snapKbps(now).toFixed(3);
  const playersNow = totalPlayers();
  const roomsNow = rooms.size;
  // V53 SRV-13：模拟步耗时与定时器回调总耗时是两种量，分开暴露。
  g('saltline_sim_step_ms', simMs, 'last single simulation step duration in milliseconds');
  g('saltline_sim_step_ms_p99', simP99, 'p99 single simulation step duration');
  g('saltline_tick_callback_ms', callbackMs, 'last tick timer callback duration (all steps + snapshots) in milliseconds');
  g('saltline_tick_callback_ms_p99', callbackP99Val, 'p99 tick timer callback duration');
  // 兼容旧看板：tick_ms 仍表示模拟步耗时（不再混入回调总耗时）。
  g('saltline_tick_ms', simMs, 'alias: last simulation step duration in milliseconds');
  g('saltline_tick_ms_p99', simP99, 'alias: p99 simulation step duration');
  g('saltline_snap_kbps', snapKbpsNow, 'snapshot downstream kbit/s (last 1s)');
  g('saltline_players', playersNow, 'players including bots');
  g('saltline_humans', totalHumans(), 'human players');
  g('saltline_bots', totalBots(), 'bot players');
  g('saltline_rooms', roomsNow, 'rooms');
  g('saltline_lagcomp_hits', metrics.lagcompHits, 'hits resolved against rewound history');
  g('tick_ms', simMs, 'alias: last simulation step duration in milliseconds');
  g('tick_ms_p99', simP99, 'alias: p99 simulation step duration');
  g('snap_kbps', snapKbpsNow, 'alias: snapshot downstream kbit/s (last 1s)');
  g('players', playersNow, 'alias: players including bots');
  g('rooms', roomsNow, 'alias: rooms');
  g('lagcomp_hits', metrics.lagcompHits, 'alias: hits resolved against rewound history');
  g('saltline_lagcomp_shots', metrics.lagcompShots, 'shots fired with rewind > 0');
  g('saltline_shots_rejected', metrics.shotsRejected, 'server-rejected shots');
  g('saltline_commands_dropped', metrics.cmdDropped, 'commands dropped (queue/out-of-order/rate)');
  g('saltline_commands_truncated', metrics.cmdsTruncated, 'commands discarded from oversized JSON input batches (V53 SRV-3)');
  g('saltline_command_queue_full', metrics.cmdQueueFull, 'commands rejected because the per-player queue was full');
  g('saltline_command_queue_len', metrics.cmdQueueLen, 'current max per-player input queue length (V53 SRV-9)');
  g('saltline_command_queue_peak', metrics.cmdQueuePeak, 'peak per-player input queue length since start (V53 SRV-9)');
  g('saltline_command_catchup', metrics.cmdCatchup, 'extra commands consumed by bounded queue catch-up (V53 SRV-9)');
  g('saltline_room_sim_errors', metrics.roomErrors, 'isolated room simulation errors (V53 SRV-7)');
  g('saltline_rooms_closed', metrics.roomsClosed, 'rooms closed after repeated simulation failures (V53 SRV-7)');
  g('saltline_acks_sent', metrics.acksSent, 'binary ACK frames sent');
  g('saltline_json_snap_encodes', metrics.jsonSnapEncodes, 'full JSON snapshots serialized (all-bin rooms skip this)');
  g('saltline_snap_forced_players', metrics.snapForced, 'slow-drift players force-included in binary deltas (V53 NET-3)');
  g('saltline_audit_events', metrics.audit, 'audit events');
  g('saltline_audit_suppressed', metrics.auditSuppressed, 'audit log lines suppressed by player+reason rate limit (V53 SRV-3)');
  g('saltline_rate_limited', metrics.rateLimited, 'rate limited messages');
  g('saltline_messages_in', metrics.msgsIn, 'inbound messages');
  g('saltline_messages_out', metrics.msgsOut, 'outbound messages');
  g('saltline_snap_frames', metrics.snapFrames, 'snapshot frames sent');
  g('saltline_snap_bytes_total', metrics.snapBytesTotal, 'snapshot bytes sent');
  g('saltline_profiles', profiles.size, 'profiles');
  g('saltline_profiles_max', PROFILE_MAX, 'profile count cap (0 = unlimited)');
  g('saltline_profiles_pruned_total', metrics.profilesPruned, 'profiles removed by TTL');
  g('saltline_profiles_evicted_total', metrics.profilesEvicted, 'profiles evicted by count cap');
  g('saltline_sim_time_ms', simNowMs(), 'simulation clock in milliseconds (tick * 1000/tickRate)');
  g('saltline_uptime_seconds', Math.round((now - STARTED_AT) / 1000), 'uptime');
  lines.push('# HELP saltline_shot_reject_reason server rejected shot reasons');
  lines.push('# TYPE saltline_shot_reject_reason counter');
  for (const reason of Object.keys(metrics.rejectReasons)) {
    lines.push('saltline_shot_reject_reason{reason="' + reason + '"} ' + metrics.rejectReasons[reason]);
  }
  lines.push('# HELP saltline_audit_reason audit reasons');
  lines.push('# TYPE saltline_audit_reason counter');
  for (const reason of Object.keys(metrics.auditReasons)) {
    lines.push('saltline_audit_reason{reason="' + reason + '"} ' + metrics.auditReasons[reason]);
  }
  // ?detail=1（仅 METRICS_TOKEN 或真实回环地址可达）追加逐房间明细。
  if (includeDetail) {
    lines.push('# HELP saltline_room_players players per room');
    lines.push('# TYPE saltline_room_players gauge');
    for (const r of rooms.values()) {
      lines.push('saltline_room_players{room="' + promEscape(r.id) + '",map="' + promEscape(r.mapId) +
        '",mode="' + promEscape(r.modeId) + '",state="' + promEscape(r.state) + '"} ' + r.size);
    }
  }
  return lines.join('\n') + '\n';
}

function healthPayload(includeDetail) {
  const payload = {
    ok: true,
    service: 'saltline-mp',
    version: 'V53',
    protocol: 2,
    tick: tick,
    tickRate: TICK_HZ,
    snapRate: SNAP_HZ,
    simTimeMs: simNowMs(),
    realTimeMs: Date.now(),
    rooms: rooms.size,
    players: totalPlayers(),
    humans: totalHumans(),
    bots: totalBots(),
    maxPlayers: MAX_PLAYERS,
    boxes: world ? world.boxes.count : 0,
    maps: mapIds().map(function (id) {
      const spec = MAPS[id];
      return {
        id: id,
        boxes: spec.world.boxes.count,
        domination: spec.modePoints ? spec.modePoints.domination.length : 0,
      };
    }),
    uptime: Math.round((Date.now() - STARTED_AT) / 1000),
    now: Date.now(),
    profiles: profiles.size,
    profilesMax: PROFILE_MAX,
    profileTtlDays: PROFILE_TTL_DAYS,
    profilesPruned: metrics.profilesPruned,
    profilesEvicted: metrics.profilesEvicted,
    warmupSeconds: WARMUP_SECONDS,
    botsTarget: BOTS_TARGET,
    weapons: WEAPON_IDS.slice(),
    metrics: {
      tickMs: round3(metrics.tickLast),
      tickP99Ms: round3(tickP99()),
      simStepMs: round3(metrics.tickLast),
      simStepP99Ms: round3(tickP99()),
      tickCallbackMs: round3(metrics.callbackLast),
      tickCallbackP99Ms: round3(callbackP99()),
      snapKbps: round3(snapKbps(Date.now())),
      lagcompHits: metrics.lagcompHits,
      shotsRejected: metrics.shotsRejected,
      audit: metrics.audit,
      cmdCatchup: metrics.cmdCatchup,
      cmdQueueLen: metrics.cmdQueueLen,
      cmdQueuePeak: metrics.cmdQueuePeak,
      snapForced: metrics.snapForced,
    },
  };
  // V37：房间明细可能包含玩家/房间 id，仅内网或 ?detail=1 返回。
  if (includeDetail) {
    payload.roomsDetail = Array.from(rooms.values()).map(function (r) {
      return {
        id: r.id, map: r.mapId, mode: r.modeId, state: r.state,
        humans: r.humanCount(), bots: r.botCount(), score: r.matchScore(),
      };
    });
  }
  return payload;
}

const server = http.createServer(function (req, res) {
  let pathname = '/';
  let query = null;
  try {
    const u = new URL(req.url, 'http://localhost');
    pathname = u.pathname;
    query = u.searchParams;
  } catch (e) {
    pathname = '/';
  }
  if (req.method === 'OPTIONS') {
    const allow = corsOrigin(req);
    const headers = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    };
    if (allow) {
      headers['Access-Control-Allow-Origin'] = allow;
      headers['Vary'] = 'Origin';
    }
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (req.method === 'GET' && (pathname === '/healthz' || pathname === '/health')) {
    const detail = (query && query.get('detail') === '1') || isInternalIp(requestIp(req));
    sendJson(req, res, 200, healthPayload(detail));
    return;
  }
  if (req.method === 'GET' && pathname === '/metrics') {
    if (!metricsAllowed(req, query) || !metricsDetailAllowed(req, query)) {
      sendText(res, 401, 'unauthorized\n');
      return;
    }
    const detail = !!(query && query.get && query.get('detail') === '1');
    sendText(res, 200, metricsText(detail), 'text/plain; version=0.0.4; charset=utf-8');
    return;
  }
  if (pathname === '/api/profile') {
    metrics.profileRequests++;
    const ip = ((req.socket.remoteAddress || '').replace(/^::ffff:/, '')) || 'unknown';
    if (profileRateLimited(ip)) {
      sendJson(req, res, 429, { ok: false, error: 'rate_limited' });
      return;
    }
    if (req.method === 'GET') {
      const token = query ? query.get('token') : null;
      if (!token) {
        sendJson(req, res, 400, { ok: false, error: 'missing_token' });
        return;
      }
      const profile = profiles.get(token);
      if (!profile) {
        sendJson(req, res, 404, { ok: false, error: 'invalid_token' });
        return;
      }
      sendJson(req, res, 200, { ok: true, profile: profileView(profile, false) });
      return;
    }
    if (req.method === 'POST') {
      readJsonBody(req, 4096).then(function (body) {
        const profile = createProfile(body && body.name);
        if (!profile) {
          sendJson(req, res, 507, { ok: false, error: 'profile_limit', max: PROFILE_MAX });
          return;
        }
        sendJson(req, res, 201, { ok: true, token: profile.token, profile: profileView(profile, false) });
        log('info', 'profile created', { uid: profile.uid, name: profile.name });
      }).catch(function (e) {
        sendJson(req, res, e && e.message === 'body_too_large' ? 413 : 400, { ok: false, error: e.message });
      });
      return;
    }
    sendJson(req, res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }
  if (req.method === 'GET' && pathname === '/') {
    sendJson(req, res, 200, {
      ok: true,
      service: 'saltline-mp',
      version: 'V53',
      protocol: 2,
      endpoints: ['/healthz', '/metrics', '/api/profile', 'ws://' + (req.headers.host || HOST + ':' + PORT)],
      tick: tick,
      rooms: rooms.size,
      players: totalPlayers(),
      boxes: world ? world.boxes.count : 0,
    });
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res, pathname);
    return;
  }
  sendJson(req, res, 405, { ok: false, error: 'method_not_allowed' });
});

// ---------------------------------------------------------------------------
// Origin / IP / WebSocket
// ---------------------------------------------------------------------------
// V53 SRV-10：socket 直连地址（不经代理）与解析后的客户端地址分开。
// 只有 TRUST_PROXY 才看 X-Forwarded-For，且取最右合法项；远端连接声称 127.0.0.1 视为伪造。
function socketIp(req) {
  const raw = req && req.socket ? req.socket.remoteAddress : '';
  return normalizeIp(raw) || 'unknown';
}
function requestIp(req) {
  const direct = socketIp(req);
  const xff = req && req.headers ? req.headers['x-forwarded-for'] : '';
  return forwardedClientIp(xff, direct, TRUST_PROXY);
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // 非浏览器客户端 / 同进程测试
  if (!ORIGIN_WHITELIST.length) {
    try {
      const u = new URL(origin);
      const host = String(req.headers.host || '');
      if (u.host === host) return true;
      // 单文件 file:// 客户端只允许连本机回环服务，避免把本地文件当成远程白名单。
      if (u.protocol === 'file:') {
        const hostName = (host.match(/^\[([^\]]+)\]/) || [])[1] || host.split(':')[0];
        return hostName === 'localhost' || hostName === '127.0.0.1' || hostName === '::1';
      }
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
    } catch (e) {
      return false;
    }
  }
  if (ORIGIN_WHITELIST.indexOf(origin) >= 0) return true;
  try {
    const u = new URL(origin);
    return ORIGIN_WHITELIST.indexOf(u.host) >= 0 || ORIGIN_WHITELIST.indexOf(u.hostname) >= 0;
  } catch (e) {
    return false;
  }
}

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_MESSAGE_BYTES,
  perMessageDeflate: false,
});
const connCounts = new Map();

server.on('upgrade', function (req, socket, head) {
  if (!originAllowed(req)) {
    metrics.originRejected++;
    audit('origin_rejected', null, { origin: req.headers.origin || null, ip: requestIp(req) });
    try {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
    } catch (e) {}
    return;
  }
  const ip = requestIp(req);
  const n = connCounts.get(ip) || 0;
  if (n >= MAX_CONNS_PER_IP) {
    audit('ip_conn_limit', null, { ip: ip, count: n });
    try {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
    } catch (e) {}
    return;
  }
  wss.handleUpgrade(req, socket, head, function (ws) {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', function (ws, req) {
  ws.isAlive = true;
  const ip = requestIp(req);
  connCounts.set(ip, (connCounts.get(ip) || 0) + 1);
  const ctx = { player: null, room: null, ip: ip, bin: false };
  ctx.joinTimer = setTimeout(function () {
    if (!ctx.player) {
      sendError(ws, 'join_timeout', '5 秒内未 join');
      ws.close(4000, 'join_timeout');
    }
  }, JOIN_TIMEOUT_MS);
  ctx.joinTimer.unref();

  ws.on('pong', function (data) {
    ws.isAlive = true;
    const p = ctx.player;
    if (!p) return;
    const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data || '');
    const sent = Number(raw);
    if (!Number.isFinite(sent) || sent <= 0) return;
    const now = Date.now();
    // EWMA 0.7/0.3：老样本权重高，避免单次抖动直接改变回滚量。
    const sample = clamp(now - sent, 0, 4000);
    p.rtt = p.rtt ? p.rtt * 0.7 + sample * 0.3 : sample;
    p.lastPongAt = now;
  });
  ws.on('message', function (data, isBinary) {
    if (isBinary || (Buffer.isBuffer(data) && data.length && data[0] === SALT_NET.OP.INPUT)) {
      if (!Buffer.isBuffer(data)) data = Buffer.from(data);
      if (data.length > MAX_MESSAGE_BYTES) {
        audit('message_too_large', ctx.player, { bytes: data.length });
        try { ws.close(4009, 'message_too_large'); } catch (e) {}
        return;
      }
      if (!ctx.player) {
        sendError(ws, 'not_joined', '二进制输入前需要先 join');
        return;
      }
      if (data.length < 2 || data[0] !== SALT_NET.OP.INPUT) {
        audit('bad_binary', ctx.player, { bytes: data.length, op: data[0] });
        return;
      }
      const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const decoded = SALT_NET.decodeInput(ab);
      if (!decoded) {
        audit('bad_binary_input', ctx.player, { bytes: data.length });
        return;
      }
      handleBinaryInput(ctx.player, decoded);
      return;
    }
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    handleMessage(ws, text, ctx);
  });
  ws.on('close', function () {
    clearTimeout(ctx.joinTimer);
    const n = Math.max(0, (connCounts.get(ip) || 1) - 1);
    if (n) connCounts.set(ip, n);
    else connCounts.delete(ip);
    cleanup(ctx);
  });
  ws.on('error', function (err) {
    metrics.ioErrors++;
    log('warn', 'ws error', { ip: ip, error: err.message });
  });
});

// ---------------------------------------------------------------------------
// 主循环
// ---------------------------------------------------------------------------
let last = process.hrtime.bigint();
let accMs = 0;
const tickTimer = setInterval(function () {
  const t0 = process.hrtime.bigint();
  const now = process.hrtime.bigint();
  accMs += Number(now - last) / 1e6;
  last = now;
  if (accMs > 200) accMs = 200;
  let steps = 0;
  while (accMs >= STEP_MS && steps < 8) {
    const s0 = process.hrtime.bigint();
    try {
      simulate(STEP);
    } catch (e) {
      log('error', 'simulate failed (unexpected outer failure)', { error: e && e.stack ? e.stack : String(e) });
    }
    recordTick(Number(process.hrtime.bigint() - s0) / 1e6);
    accMs -= STEP_MS;
    steps++;
  }
  if (steps > 0 && totalPlayers() > 0 && snapshotDue(tick, lastSnapTick, SNAP_EVERY)) {
    lastSnapTick = tick;
    broadcastSnapshots(Date.now());
  }
  // V53 SRV-13：回调总耗时单独记录，不污染“模拟步”指标。
  recordCallback(Number(process.hrtime.bigint() - t0) / 1e6);
}, Math.max(2, Math.floor(STEP_MS / 4)));

// V37：真实 RTT。每 2 秒发一次带时间戳的 ping，客户端 pong 原样回传，服务端算 EWMA。
const rttTimer = setInterval(function () {
  const now = Date.now();
  for (const room of Array.from(rooms.values())) {
    for (const p of Array.from(room.players.values())) {
      if (p.isBot || !p.ws || p.ws.readyState !== WebSocket.OPEN) continue;
      p.lastPingSentAt = now;
      try { p.ws.ping(Buffer.from(String(now))); } catch (e) {}
    }
  }
}, RTT_PING_MS);

// 仅做 liveness 判定：2 秒 RTT ping 的 pong 会把 isAlive 置 true；持续 30 秒无 pong 才断开。
const heartbeatTimer = setInterval(function () {
  for (const room of Array.from(rooms.values())) {
    for (const p of Array.from(room.players.values())) {
      if (p.isBot) continue;
      if (p.ws.isAlive === false) {
        p.ws.terminate();
        continue;
      }
      p.ws.isAlive = false;
    }
  }
}, 30000);

const botMaintainTimer = setInterval(function () {
  for (const room of rooms.values()) syncBots(room);
}, 3000);

// V53 SRV-11：长时间运行时也定期清理过期档案；有删除才落盘。unref 不阻止进程退出。
const profilePruneTimer = setInterval(function () {
  if (!profilesLoaded) return;
  const removed = pruneProfiles(Date.now());
  if (removed) scheduleProfileSave();
}, 6 * 3600 * 1000);
profilePruneTimer.unref();

// ---------------------------------------------------------------------------
// 启动 / 关闭
// ---------------------------------------------------------------------------
server.on('error', function (err) {
  log('error', 'http server error', { error: err.message });
  process.exit(1);
});

function shutdown(sig) {
  log('info', 'shutdown', { sig: sig });
  clearInterval(tickTimer);
  clearInterval(heartbeatTimer);
  clearInterval(rttTimer);
  clearInterval(botMaintainTimer);
  clearInterval(profilePruneTimer);
  if (profileSaveTimer) clearTimeout(profileSaveTimer);
  // 退出前强制落盘一次（异步队列，不阻塞 tick；最多等 1.2 秒）。
  // 只有成功加载过 profile 才允许置脏；坏档启动会在 listen 前退出，不会走到这里。
  if (profilesLoaded) profileDirty = true;
  const saving = flushProfileWrites().catch(function () {});
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      if (p.isBot) continue;
      try { p.ws.close(1001, 'server_shutdown'); } catch (e) {}
    }
  }
  wss.close();
  const finish = function () {
    releaseProfileLock();
    server.close(function () { process.exit(0); });
    setTimeout(function () { process.exit(0); }, 1500).unref();
  };
  Promise.race([saving, new Promise(function (resolve) { setTimeout(resolve, 1200).unref(); })]).then(finish);
}

process.on('SIGTERM', function () { shutdown('SIGTERM'); });
process.on('SIGINT', function () { shutdown('SIGINT'); });
process.on('exit', function () { releaseProfileLock(); });
process.on('uncaughtException', function (err) {
  log('error', 'uncaughtException', { error: err && err.stack ? err.stack : String(err) });
  // 单房间 tick 已隔离；进程继续服务，避免一个坏房间拖垮所有房间。
});
process.on('unhandledRejection', function (err) {
  log('error', 'unhandledRejection', { error: String(err && err.stack ? err.stack : err) });
});

// V39：先抢 PROFILES_FILE 单进程锁，再加载/写入 Profile。抢不到直接拒绝启动。
const profileLock = acquireProfileLock();
if (!profileLock.ok) {
  const held = profileLock.lock || {};
  const pidText = held.pid != null ? 'pid=' + held.pid : 'pid=未知';
  const atText = held.at != null ? '，创建于 ' + new Date(held.at).toISOString() : '';
  console.error('[fatal] PROFILES_FILE 已被另一个实例占用，拒绝启动（单进程保护）');
  console.error('[fatal] 数据文件：' + PROFILES_FILE);
  console.error('[fatal] 锁文件：' + PROFILE_LOCK_FILE + '（' + pidText + atText + '）');
  if (profileLock.ownerAlive) {
    console.error('[fatal] 锁心跳已过期，但持有进程仍存活；V53 SRV-2 不会回收存活进程的锁。');
  } else {
    console.error('[fatal] 若确认旧进程已退出，删除锁文件或等待心跳超时（' + PROFILE_LOCK_STALE_MS + ' ms）后重试。');
  }
  if (profileLock.reason === 'io' && profileLock.error) console.error('[fatal] IO 错误：' + profileLock.error.message);
  process.exit(1);
}

loadWeapons();
if (!loadProfiles()) {
  // 坏档已改名保留；绝不以空 profiles 覆盖原文件。
  process.exit(1);
}
loadWorldSafe();

server.listen(PORT, HOST, function () {
  log('info', 'fps-mp ready', {
    url: 'http://' + HOST + ':' + PORT,
    tickHz: TICK_HZ,
    snapHz: SNAP_HZ,
    maxPlayers: MAX_PLAYERS,
    bots: BOTS_TARGET,
    warmup: WARMUP_SECONDS,
    realtime: TICK_HZ === 60 ? '60/30' : TICK_HZ + '/' + SNAP_HZ,
  });
  log('info', 'endpoints', { healthz: '/healthz', metrics: '/metrics', profile: '/api/profile' });
  if (!STATIC_DIR) log('info', 'static hosting disabled (set STATIC_DIR to enable)');
  if (!DEV_TOKEN) log('info', 'dev commands disabled (MP_DEV_TOKEN not set)');
  if (PROFILE_TOKEN) log('info', 'join token required (PROFILE_TOKEN set)');
});
