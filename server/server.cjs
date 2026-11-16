#!/usr/bin/env node
'use strict';
/**
 * server.cjs — 几猫 · SALTLINE V37 联机服务端（协议 2.0）
 *
 * 关键能力:
 *   - HTTP + WebSocket 同端口；JSON 旧协议完全兼容，caps:['bin'] 客户端走二进制快照
 *   - 模拟 60Hz（TICK_HZ）、快照 30Hz（SNAP_HZ）；二进制快照按玩家变更增量
 *   - 输入回放：每玩家 <=120 条命令，seq 去重 / 乱序丢弃 / 限速，每模拟步消费一条
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
 *
 * 只依赖 Node 内置模块 + server/node_modules/ws + packages/sim + packages/net/protocol.js。
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

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
// V39：profiles.json 单进程保护。锁文件与数据文件同目录；wx 原子创建，stale 30s 可回收。
const PROFILE_LOCK_FILE = PROFILES_FILE + '.lock';
const PROFILE_LOCK_STALE_MS = 30000;
const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;
const STARTED_AT = Date.now();

const MOVE = Object.freeze({
  walk: 3.8,
  sprint: 6.4,
  crouch: 1.9,
  accelGround: 34,
  decelGround: 26,
  accelAir: 9,
  gravity: 21,
  jumpSpeed: Math.sqrt(2 * 21 * 1),
  standHeight: 1.8,
  crouchHeight: 1.15,
  radius: 0.32,
  pitchLimit: 1.5,
});

const DEFAULT_SPAWN = { x: -32, z: 6 };
const TEAM_BASES = [{ x: -32, z: 6 }, { x: 29, z: 20 }];

const MODES = {
  tdm: { id: 'tdm', name: '团队死斗', maxPlayers: 8, scoreLimit: 50, roundSeconds: 300, domination: false },
  chaos: { id: 'chaos', name: '大乱战', maxPlayers: 12, scoreLimit: 75, roundSeconds: 360, domination: false },
  domination: { id: 'domination', name: '据点争夺', maxPlayers: 10, scoreLimit: DOM_SCORE_LIMIT, roundSeconds: 300, domination: true },
};
const MODE_IDS = Object.keys(MODES);

const BTN = (sim.command && sim.command.BTN) || {
  FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16, RELOAD: 32, MELEE: 64,
  GRENADE: 128, INTERACT: 256, SCAN: 512, LEAN_L: 1024, LEAN_R: 2048,
};
const ALL_BUTTONS = (sim.command && sim.command.ALL_BUTTONS) || 4095;
const ZERO_CMD = Object.freeze({ seq: 0, tick: 0, mx: 0, my: 0, yaw: 0, pitch: 0, buttons: 0, slot: 0, slotExplicit: false });

// ---------------------------------------------------------------------------
// 指标 / 日志
// ---------------------------------------------------------------------------
const metrics = {
  tickRing: [],
  tickLast: 0,
  snapWindow: [],
  snapBytesTotal: 0,
  snapFrames: 0,
  lagcompHits: 0,
  lagcompShots: 0,
  shotsRejected: 0,
  rejectReasons: Object.create(null),
  audit: 0,
  auditReasons: Object.create(null),
  msgsIn: 0,
  msgsOut: 0,
  rateLimited: 0,
  cmdDropped: 0,
  cmdOutOfOrder: 0,
  cmdQueueFull: 0,
  acksSent: 0,
  jsonSnapEncodes: 0,
  originRejected: 0,
  profileRequests: 0,
  ioErrors: 0,
};

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

function audit(code, player, detail) {
  metrics.audit++;
  metrics.auditReasons[code] = (metrics.auditReasons[code] || 0) + 1;
  log('warn', 'audit ' + code, Object.assign({
    id: player ? player.id : null,
    name: player ? player.name : null,
  }, detail || {}));
}

function recordTick(ms) {
  metrics.tickLast = ms;
  const ring = metrics.tickRing;
  ring.push(ms);
  if (ring.length > 600) ring.shift();
}
function tickP99() {
  const ring = metrics.tickRing;
  if (!ring.length) return 0;
  const sorted = ring.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
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
let MAPS = {};

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
  const out = {};
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

function loadWorldSafe() {
  MAPS = loadDataMaps();
  if (Object.keys(MAPS).length) {
    world = MAPS.harbor.world;
    spawnPoints = buildSpawnPoints(world, DEFAULT_SPAWN);
    return;
  }
  if (fs.existsSync(MAPS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
      const list = raw.maps || raw;
      for (const id of Object.keys(list)) {
        const spec = list[id];
        spec.id = id;
        spec.world = makeWorld(spec);
        spec.modePoints = spec.modePoints || {};
        spec.modePoints.domination = buildDominationPoints(spec, spec.world);
        MAPS[id] = spec;
        log('info', 'map ' + id, { boxes: spec.world.boxes.count });
      }
    } catch (e) {
      log('error', 'failed to load maps', { file: MAPS_FILE, error: e.message });
    }
  }
  if (!Object.keys(MAPS).length) {
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
function getMap(mapId) { return MAPS[mapId] || MAPS.harbor; }

function spawnIsFree(w, x, z) {
  const g = w.groundHeight(x, z, 3);
  if (g > 0.75) return false;
  const pos = { x: x, y: g + 0.01, z: z };
  const vel = { x: 0, y: 0, z: 0 };
  const r = w.moveCapsule(pos, vel, 1 / TICK_HZ, MOVE.radius, MOVE.standHeight, true);
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
  const now = Date.now();
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

function resolveLoadout(raw) {
  const primaryRaw = raw && (raw.primary || raw.weapon || raw.primaryId);
  const secondaryRaw = raw && (raw.secondary || raw.secondaryId);
  let primary = 'pac9';
  if (typeof primaryRaw === 'string' && WEAPONS[primaryRaw] && WEAPONS[primaryRaw].slot === 'primary') primary = primaryRaw;
  let secondary = 'sidearm';
  if (typeof secondaryRaw === 'string' && WEAPONS[secondaryRaw] && WEAPONS[secondaryRaw].slot === 'secondary') secondary = secondaryRaw;
  return { primary: primary, secondary: secondary };
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
// V39：PROFILES_FILE 单进程锁
// 同一 PROFILES_FILE 只允许一个 server.cjs 实例写入。启动时用 wx 原子创建
// <PROFILES_FILE>.lock，内容含 pid / 时间 / token；已有锁且未 stale（30s）时
// 第二个实例打印错误并以非 0 退出。旧进程被 SIGKILL 后，锁超过 30s 可被回收。
// ---------------------------------------------------------------------------
let profileLockHeld = false;
let profileLockToken = null;

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
      return { ok: true, token: token };
    } catch (e) {
      if (!e || e.code !== 'EEXIST') return { ok: false, reason: 'io', error: e };
      const held = readProfileLock();
      if (!held) continue; // 锁刚好消失，重试创建
      const at = held.at != null ? held.at : held.mtimeMs;
      const ageMs = Math.max(0, Date.now() - at);
      if (ageMs <= PROFILE_LOCK_STALE_MS) return { ok: false, reason: 'held', lock: held, ageMs: ageMs };
      // 回收前再核对 token/inode，避免把别人刚创建的新锁删掉。
      const again = readProfileLock();
      if (!again || again.token !== held.token || again.ino !== held.ino) continue;
      try {
        fs.unlinkSync(PROFILE_LOCK_FILE);
        log('warn', 'profiles stale lock reclaimed', { file: PROFILE_LOCK_FILE, pid: held.pid, ageMs: ageMs });
      } catch (e2) {
        if (!e2 || e2.code !== 'ENOENT') return { ok: false, reason: 'io', error: e2 };
      }
    }
  }
  return { ok: false, reason: 'held', lock: readProfileLock() };
}

function releaseProfileLock() {
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

function loadProfiles() {
  try {
    if (!fs.existsSync(PROFILES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    const list = raw && raw.profiles ? raw.profiles : raw;
    if (Array.isArray(list)) {
      for (const p of list) if (p && p.token) profiles.set(p.token, p);
    } else if (list && typeof list === 'object') {
      for (const token of Object.keys(list)) {
        const p = list[token];
        if (p && typeof p === 'object') {
          p.token = p.token || token;
          profiles.set(token, p);
        }
      }
    }
    log('info', 'profiles loaded', { count: profiles.size });
  } catch (e) {
    log('error', 'profiles load failed', { file: PROFILES_FILE, error: e.message });
  }
}

// V37：异步串行写队列。快照在写线程外构建，writeFile(tmp) + rename 保持原子性；
// 同一时刻只有一个写入者，后到的变更合并成下一次写，避免 tick 线程同步全量写。
let profileSaveRunning = null;
let profileSaveQueued = false;

async function writeProfilesAsync() {
  const dir = path.dirname(PROFILES_FILE);
  await fs.promises.mkdir(dir, { recursive: true });
  const out = { version: 1, savedAt: new Date().toISOString(), profiles: {} };
  for (const key of profiles.keys()) out.profiles[key] = profiles.get(key);
  const json = JSON.stringify(out);
  const tmp = PROFILES_FILE + '.tmp';
  try {
    await fs.promises.writeFile(tmp, json);
    await fs.promises.rename(tmp, PROFILES_FILE);
  } catch (e) {
    try { await fs.promises.unlink(tmp); } catch (e2) {}
    throw e;
  }
}

function flushProfileWrites() {
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
  profileDirty = true;
  if (profileSaveTimer) return;
  profileSaveTimer = setTimeout(function () {
    profileSaveTimer = null;
    flushProfileWrites();
  }, 250);
  profileSaveTimer.unref();
}

function createProfile(rawName, ip) {
  const token = crypto.randomBytes(18).toString('hex');
  const now = Date.now();
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
    ip: ip || null,
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
  return p.input && p.input.crouch ? 1.05 : 1.68;
}
function eyePos(p) {
  return { x: p.pos.x, y: p.pos.y + eyeHeight(p), z: p.pos.z };
}

// ---------------------------------------------------------------------------
// 房间 / 玩家
// ---------------------------------------------------------------------------
const rooms = new Map();
let tick = 0;

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
    this.joinedAt = Date.now();
    this.lastSeen = Date.now();
    this.input = { move: { x: 0, y: 0 }, jump: false, sprint: false, crouch: false };
    this.prevButtons = 0;
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
    this.height = MOVE.standHeight;
    this.onGround = true;
    this.surface = 'concrete';
    this.spawnProtectUntil = Date.now() + 2000;
    this.spawn = spawnIn || { x: DEFAULT_SPAWN.x, y: 0, z: DEFAULT_SPAWN.z };
    this.pos = { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = this.spawn.yaw || 0;
    this.rtt = 0;              // 服务端 ws ping/pong 实测 RTT（EWMA 0.7/0.3）
    this.clientRtt = 0;        // 客户端 ping.ts 自报，仅用于显示/兼容，不参与回滚
    this.lastPongAt = 0;
    this.lastPingSentAt = 0;
    this.history = [];
    this.profileToken = opts.profileToken || null;
    this.profile = null;
    this.loadout = resolveLoadout(opts.loadout);
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
    this.stuckSince = 0;
    this.bytesOut = 0;
    this.bytesIn = 0;
    this.lastPingAt = 0;
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
      crouch: !!(this.input && this.input.crouch),
      sprinting: !!(this.input && this.input.sprint),
      spawnProtect: this.spawnProtectUntil > Date.now(),
      seq: this.lastSimSeq,
      ack: this.lastSimSeq,
      ping: Math.round(this.rtt),
      bot: !!this.isBot,
      wpn: w.def.id,
      slot: this.slot,
      mag: w.mag,
      reserve: w.reserve,
      slots: this.slots.map(function (s, i) { return { slot: i, wpn: s.def.id, mag: s.mag | 0, reserve: s.reserve | 0 }; }),
      reloading: !!(w.reloadEnd > Date.now()),
    };
  }
}

class Room {
  constructor(id, mapId, modeId) {
    this.id = id;
    this.mapId = mapId || 'harbor';
    this.modeId = MODES[modeId] ? modeId : 'tdm';
    this.mode = MODES[this.modeId];
    this.maxPlayers = Math.min(this.mode.maxPlayers, MAX_PLAYERS);
    this.setMapState(this.mapId);
    this.players = new Map();
    this.nextNetId = 1;
    this.createdAt = Date.now();
    this.roundStart = Date.now();
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
    this.votes = {};
    this.spawnUse = {};
    this.state = WARMUP_SECONDS > 0 ? 'warmup' : 'live';
    this.stateSince = Date.now();
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
    timeLeft: roundTimeLeft(room, Date.now()),
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
  room.stateSince = Date.now();
  room.roundOverAt = Date.now() + delayMs;
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
  const counts = {};
  for (const id of Object.keys(room.votes)) counts[room.votes[id]] = (counts[room.votes[id]] || 0) + 1;
  let nextMap = room.mapId;
  let best = -1;
  for (const id of Object.keys(counts)) if (counts[id] > best) { best = counts[id]; nextMap = id; }
  room.votes = {};
  if (!MAPS[nextMap]) nextMap = room.mapId;
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
  room.roundStart = Date.now();
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
    beginWarmup(room, Date.now());
    broadcastRoundStart(room, { teams: [0, 0], state: 'warmup' });
  } else {
    startLive(room, Date.now(), true);
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
  p.spawnProtectUntil = Date.now() + 2000;
  p.prevButtons = 0;
  p.prevCmdButtons = 0;
  p.jumpQueued = false;
  p.history = [];
  for (const w of p.slots) {
    w.mag = w.def.mag;
    w.reserve = w.def.reserve;
    w.reloadEnd = 0;
    w.reloadStart = 0;
    w.lastShotAt = 0;
  }
  p.slot = 0;
  recordHistory(p, Date.now());
}

function recordHistory(p, now) {
  if (!p.alive) return;
  p.history.push({
    t: now,
    tick: tick,
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z,
    crouch: !!(p.input && p.input.crouch),
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
    crouch: !!(p.input && p.input.crouch),
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

function stepPlayer(p, dt) {
  if (!p.alive) return;
  const worldObj = p.room.world;
  const inp = p.input;
  const yaw = p.yaw;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const mx = inp.move.x;
  const my = inp.move.y;
  const moving = mx * mx + my * my > 0.01;
  const sprinting = inp.sprint && my > 0.55 && Math.abs(mx) < 0.6 && !inp.crouch;
  const speed = inp.crouch ? MOVE.crouch : sprinting ? MOVE.sprint : MOVE.walk;
  p.height = inp.crouch ? MOVE.crouchHeight : MOVE.standHeight;

  const desiredX = (mx * cosY - my * sinY) * speed;
  const desiredZ = (-mx * sinY - my * cosY) * speed;
  const accel = p.onGround
    ? (moving ? MOVE.accelGround : MOVE.decelGround)
    : (moving ? MOVE.accelAir : 0.6);

  let diffX = desiredX - p.vel.x;
  let diffZ = desiredZ - p.vel.z;
  if (!p.onGround && !moving) {
    diffX = -p.vel.x;
    diffZ = -p.vel.z;
  }
  const diffLen = Math.hypot(diffX, diffZ);
  const maxDelta = accel * dt;
  if (diffLen <= maxDelta || diffLen < 1e-6) {
    if (p.onGround || moving) {
      p.vel.x = desiredX;
      p.vel.z = desiredZ;
    }
  } else {
    p.vel.x += (diffX / diffLen) * maxDelta;
    p.vel.z += (diffZ / diffLen) * maxDelta;
  }

  if (p.jumpQueued && p.onGround && !inp.crouch) {
    p.vel.y = MOVE.jumpSpeed;
    p.onGround = false;
  }
  p.jumpQueued = false;

  p.vel.y -= MOVE.gravity * dt * 0.5;
  if (p.vel.y < -40) p.vel.y = -40;
  const res = worldObj.moveCapsule(p.pos, p.vel, dt, MOVE.radius, p.height, true) || { onGround: false, surface: 'concrete' };
  if (!res.onGround) p.vel.y -= MOVE.gravity * dt * 0.5;

  const b = worldObj.bounds;
  p.pos.x = clamp(p.pos.x, b.min.x + 0.4, b.max.x - 0.4);
  p.pos.z = clamp(p.pos.z, b.min.z + 0.4, b.max.z - 0.4);
  p.onGround = !!res.onGround;
  if (res.surface) p.surface = res.surface;

  if (p.pos.y < worldObj.seaY - 2.2) {
    respawn(p);
    p.yaw += Math.PI;
  }
}

function enqueueCommand(p, cmd) {
  if (!p || !p.alive) return false;
  const now = Date.now();
  const win = p.cmdWindow;
  if (now - win.start > 1000) {
    win.start = now;
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
  if ((cmd.buttons & BTN.JUMP) && !(p.prevCmdButtons & BTN.JUMP)) p.jumpQueued = true;
  if ((cmd.buttons & BTN.RELOAD) && !(p.prevCmdButtons & BTN.RELOAD)) startReload(p, true);
  p.prevCmdButtons = cmd.buttons;
  if (cmd.buttons & BTN.FIRE) attemptFire(p, { explicit: false, viaCommand: true });
}

function consumeCommand(p, dt, now) {
  if (!p.alive) {
    p.input.move.x = 0;
    p.input.move.y = 0;
    return;
  }
  const cmd = nextCommand(p);
  // V37：超过 500ms 没有收到新输入时停走（保留视角），避免掉线滑行/踩点。
  if (now - p.lastSeen > 500) {
    cmd.mx = 0;
    cmd.my = 0;
  }
  applyCommand(p, cmd);
  stepPlayer(p, dt);
  recordHistory(p, Date.now());
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
  w.reloadStart = Date.now();
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

function rejectShot(p, reason, def) {
  metrics.shotsRejected++;
  metrics.rejectReasons[reason] = (metrics.rejectReasons[reason] || 0) + 1;
  audit('shot_' + reason, p, { wpn: def ? def.id : null });
  if (p.ws) p.send({ t: 'shotRejected', reason: reason, wpn: def ? def.id : null, at: Date.now() });
  return { ok: false, reason: reason };
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

function killPlayer(shooter, victim, hs, def, dist, rewindMs) {
  const room = shooter.room;
  const now = Date.now();
  if (!victim.alive) return;
  victim.alive = false;
  victim.hp = 0;
  victim.respawnAt = now + RESPAWN_MS;
  const live = room.state === 'live';
  if (live) {
    victim.deaths++;
    if (!victim.isBot && victim.profileToken) awardProfileXp(victim.profileToken, 0, { death: true });
  }
  if (live) {
    shooter.kills++;
    room.teamKills[shooter.team] = (room.teamKills[shooter.team] || 0) + 1;
    if (!shooter.isBot && shooter.profileToken) {
      const profile = awardProfileXp(shooter.profileToken, hs ? 30 : 20, { kill: true });
      if (!shooter.profile && profile) shooter.profile = profile;
    }
  }
  room.broadcast({
    t: 'kill',
    by: shooter.id,
    victim: victim.id,
    hs: !!hs,
    wpn: def.id,
    byName: shooter.name,
    victimName: victim.name,
    team: shooter.team,
    dist: round2(dist),
    lagcomp: rewindMs || 0,
    bot: !!shooter.isBot,
    victimBot: !!victim.isBot,
    warmup: room.state === 'warmup',
  });
  if (live) {
    const scores = room.matchScore();
    if (scores[shooter.team] >= room.scoreLimit) {
      endRound(room, shooter.team, 'score', {
        winner: { id: shooter.id, name: shooter.name, kills: shooter.kills, bot: !!shooter.isBot },
      });
    }
  }
}

function attemptFire(p, opts) {
  opts = opts || {};
  const now = Date.now();
  const room = p.room;
  if (!room) return { ok: false, reason: 'no_room' };
  if (!p.alive) return opts.explicit ? rejectShot(p, 'dead', p.currentWeapon()) : { ok: false, reason: 'dead' };
  if (room.state === 'roundEnd' || room.roundOver) {
    return opts.explicit ? rejectShot(p, 'round_end', p.currentWeapon()) : { ok: false, reason: 'round_end' };
  }
  const w = p.currentWeaponState();
  const def = w.def;
  if (w.reloadEnd) {
    if (now >= w.reloadEnd) finishReload(p, now);
    else return opts.explicit ? rejectShot(p, 'reloading', def) : { ok: false, reason: 'reloading' };
  }
  if (w.mag <= 0) {
    if (w.reserve > 0) startReload(p, true);
    return opts.explicit ? rejectShot(p, 'empty', def) : { ok: false, reason: 'empty' };
  }
  const minInterval = 60000 / def.rpm - 2;
  if (now - w.lastShotAt < minInterval) {
    return opts.explicit ? rejectShot(p, 'rate', def) : { ok: false, reason: 'rate' };
  }
  let dir = normalizeDir(opts.dir);
  if (!dir) dir = dirFromAngles(p.yaw, p.pitch);
  const view = dirFromAngles(p.yaw, p.pitch);
  if (dot3(dir, view) < Math.cos(0.06)) {
    return opts.explicit ? rejectShot(p, 'aim_mismatch', def) : { ok: false, reason: 'aim_mismatch' };
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

function simulate(dt) {
  tick++;
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      // 换弹完成（每个模拟步检查，权威于客户端表现）
      const wsReload = p.currentWeaponState();
      if (wsReload.reloadEnd && now >= wsReload.reloadEnd) finishReload(p, now);
      if (!p.alive && p.respawnAt && now >= p.respawnAt) {
        respawn(p);
        room.broadcast(respawnEvent(p));
      }
      if (p.isBot && p.alive) botThink(p, room, now, dt);
    }
    for (const p of room.players.values()) consumeCommand(p, dt, now);
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
    if (w.reloadEnd > Date.now()) state |= 2;
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
      crouch: !!(p.input && p.input.crouch),
      spawnProtect: p.spawnProtectUntil > Date.now(),
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

function sendBinarySnapshot(p, now, binList, shared) {
  if (!p.ws || p.ws.readyState !== WebSocket.OPEN) return;
  const full = !p.snapPrev || (tick - p.snapFullTick >= SNAP_FULL_EVERY);
  let data;
  try {
    if (full) {
      if (!shared.fullBuf) shared.fullBuf = Buffer.from(SALT_NET.encodeSnapshot(tick, 0, binList, null));
      data = shared.fullBuf;
    } else if (p.snapPrev === shared.prev && p.snapBaseTick === shared.baseTick) {
      if (!shared.deltaBuf) shared.deltaBuf = Buffer.from(SALT_NET.encodeSnapshot(tick, shared.baseTick, binList, shared.prev));
      data = shared.deltaBuf;
    } else {
      // 该客户端因背压漏过帧/刚从全量恢复：单独编码，基线仍是它最后收到的 tick。
      data = Buffer.from(SALT_NET.encodeSnapshot(tick, p.snapBaseTick, binList, p.snapPrev));
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

function rateLimited(p) {
  const now = Date.now();
  if (now - p._msgWindow.start > 1000) {
    p._msgWindow.start = now;
    p._msgWindow.count = 0;
    p._violations = Math.max(0, p._violations - 1);
  }
  p._msgWindow.count++;
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
  if (rateLimited(p)) return;
  const list = Array.isArray(msg.cmds) ? msg.cmds : [msg];
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
  const alias = { rifle: 'pac9', shotgun: 'breaker12', pistol: 'sidearm', sniper: 'dmr' };
  let wpn = typeof msg.wpn === 'string' ? (alias[msg.wpn] || msg.wpn) : null;
  if (wpn) {
    let slot = -1;
    for (let i = 0; i < p.slots.length; i++) if (p.slots[i].def.id === wpn) slot = i;
    if (slot < 0) {
      rejectShot(p, 'bad_weapon', p.currentWeapon());
      return;
    }
    if (slot !== p.slot) switchSlot(p, slot, true);
  }
  const dir = normalizeDir(msg.dir);
  if (!dir) {
    rejectShot(p, 'bad_dir', p.currentWeapon());
    return;
  }
  attemptFire(p, { explicit: true, dir: dir });
}

function handleJoin(ws, msg, ctx) {
  if (ctx.player) return;
  if (PROFILE_TOKEN && !isProfileTokenAuthorized(msg)) {
    sendError(ws, 'unauthorized', '需要有效的访问 token');
    ws.close(4003, 'unauthorized');
    return;
  }
  const roomId = sanitizeRoom(msg.room);
  const requestedMap = MAPS[msg.map] ? msg.map : 'harbor';
  // V37：显式传入未知模式必须明确报错，不回退 tdm；未传 mode 才使用默认 tdm。
  if (msg.mode != null && msg.mode !== '' && !Object.prototype.hasOwnProperty.call(MODES, msg.mode)) {
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
  const p = new Player(ws, room, name, team, spawn, {
    bin: Array.isArray(msg.caps) && msg.caps.indexOf('bin') >= 0,
    loadout: msg.loadout,
    profileToken: profileToken,
  });
  if (p.profileToken && profiles.has(p.profileToken)) p.profile = profiles.get(p.profileToken);
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
    loadout: p.loadout,
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
    startLive(room, Date.now(), true);
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
    recordHistory(p, Date.now());
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
      if (typeof msg.map === 'string' && MAPS[msg.map]) p.room.votes[p.id] = msg.map;
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
  if (!abs.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    sendJson(req, res, 404, { ok: false, error: 'not_found' });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': fs.statSync(abs).size,
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60',
  });
  fs.createReadStream(abs).pipe(res);
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

function metricsText() {
  const now = Date.now();
  const lines = [];
  function g(name, value, help) {
    if (help) lines.push('# HELP ' + name + ' ' + help);
    lines.push(name + ' ' + value);
  }
  const tickMs = metrics.tickLast.toFixed(3);
  const tickP99Val = tickP99().toFixed(3);
  const snapKbpsNow = snapKbps(now).toFixed(3);
  const playersNow = totalPlayers();
  const roomsNow = rooms.size;
  // 规范前缀名（推荐）与任务/看板约定的短名同时输出
  g('saltline_tick_ms', tickMs, 'last simulation step duration in milliseconds');
  g('saltline_tick_ms_p99', tickP99Val, 'p99 simulation step duration');
  g('saltline_snap_kbps', snapKbpsNow, 'snapshot downstream kbit/s (last 1s)');
  g('saltline_players', playersNow, 'players including bots');
  g('saltline_humans', totalHumans(), 'human players');
  g('saltline_bots', totalBots(), 'bot players');
  g('saltline_rooms', roomsNow, 'rooms');
  g('saltline_lagcomp_hits', metrics.lagcompHits, 'hits resolved against rewound history');
  g('tick_ms', tickMs, 'alias: last simulation step duration in milliseconds');
  g('tick_ms_p99', tickP99Val, 'alias: p99 simulation step duration');
  g('snap_kbps', snapKbpsNow, 'alias: snapshot downstream kbit/s (last 1s)');
  g('players', playersNow, 'alias: players including bots');
  g('rooms', roomsNow, 'alias: rooms');
  g('lagcomp_hits', metrics.lagcompHits, 'alias: hits resolved against rewound history');
  g('saltline_lagcomp_shots', metrics.lagcompShots, 'shots fired with rewind > 0');
  g('saltline_shots_rejected', metrics.shotsRejected, 'server-rejected shots');
  g('saltline_commands_dropped', metrics.cmdDropped, 'commands dropped (queue/out-of-order/rate)');
  g('saltline_command_queue_full', metrics.cmdQueueFull, 'commands rejected because the per-player queue was full');
  g('saltline_acks_sent', metrics.acksSent, 'binary ACK frames sent');
  g('saltline_json_snap_encodes', metrics.jsonSnapEncodes, 'full JSON snapshots serialized (all-bin rooms skip this)');
  g('saltline_audit_events', metrics.audit, 'audit events');
  g('saltline_rate_limited', metrics.rateLimited, 'rate limited messages');
  g('saltline_messages_in', metrics.msgsIn, 'inbound messages');
  g('saltline_messages_out', metrics.msgsOut, 'outbound messages');
  g('saltline_snap_frames', metrics.snapFrames, 'snapshot frames sent');
  g('saltline_snap_bytes_total', metrics.snapBytesTotal, 'snapshot bytes sent');
  g('saltline_profiles', profiles.size, 'profiles');
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
  return lines.join('\n') + '\n';
}

function healthPayload(includeDetail) {
  const payload = {
    ok: true,
    service: 'saltline-mp',
    version: 'V37',
    protocol: 2,
    tick: tick,
    tickRate: TICK_HZ,
    snapRate: SNAP_HZ,
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
    warmupSeconds: WARMUP_SECONDS,
    botsTarget: BOTS_TARGET,
    weapons: WEAPON_IDS.slice(),
    metrics: {
      tickMs: round3(metrics.tickLast),
      tickP99Ms: round3(tickP99()),
      snapKbps: round3(snapKbps(Date.now())),
      lagcompHits: metrics.lagcompHits,
      shotsRejected: metrics.shotsRejected,
      audit: metrics.audit,
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
    if (!metricsAllowed(req, query)) {
      sendText(res, 401, 'unauthorized\n');
      return;
    }
    sendText(res, 200, metricsText(), 'text/plain; version=0.0.4; charset=utf-8');
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
        const profile = createProfile(body && body.name, ip);
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
      version: 'V37',
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
function requestIp(req) {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  }
  return ((req.socket.remoteAddress || '').replace(/^::ffff:/, '')) || 'unknown';
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // 非浏览器客户端 / 同进程测试
  if (!ORIGIN_WHITELIST.length) {
    try {
      const u = new URL(origin);
      const host = String(req.headers.host || '');
      if (u.host === host) return true;
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
      log('error', 'simulate failed (room isolated)', { error: e && e.stack ? e.stack : String(e) });
    }
    recordTick(Number(process.hrtime.bigint() - s0) / 1e6);
    accMs -= STEP_MS;
    steps++;
  }
  if (steps > 0 && totalPlayers() > 0 && tick % SNAP_EVERY === 0) {
    broadcastSnapshots(Date.now());
  }
  recordTick(Number(process.hrtime.bigint() - t0) / 1e6);
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
  if (profileSaveTimer) clearTimeout(profileSaveTimer);
  // 退出前强制落盘一次（异步队列，不阻塞 tick；最多等 1.2 秒）。
  profileDirty = true;
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
  console.error('[fatal] 若确认旧进程已退出，删除锁文件或等待 ' + Math.round(PROFILE_LOCK_STALE_MS / 1000) + ' 秒后重试。');
  if (profileLock.reason === 'io' && profileLock.error) console.error('[fatal] IO 错误：' + profileLock.error.message);
  process.exit(1);
}

loadWeapons();
loadProfiles();
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
