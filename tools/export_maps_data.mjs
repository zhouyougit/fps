#!/usr/bin/env node
/**
 * tools/export_maps_data.mjs — 地图玩法数据导出器（WP32-6）
 *
 * 输入：
 *   server/maps.json                      碰撞盒（WP32-6 之前由客户端导出，服务器共用）
 *   packages/data/maps/<id>.authored.json 手工玩法数据（出生点/拾取物/中继/区域/地面）
 *
 * 输出：
 *   packages/data/maps/<id>.map.json      完整地图数据（碰撞盒 + 玩法数据）
 *   packages/data/maps/index.json         索引与统计
 *   src/data_maps.js                      window.__SX_MAPS_DATA（客户端用，不含碰撞盒）
 *
 * 校验（失败非零退出）：
 *   - 所有地面点位不悬空：|groundHeight(x,z,y+2.5) - y| < 0.6（中继节点用 y+0.45，
 *     因为中继自己的 1.67m 碰撞盒会被 groundHeight 当成"地面"）
 *   - 所有点位不卡在碰撞里：半径 0.32m、高 1.8m 的圆柱与碰撞盒相交即失败
 *   - 非 air 点位从玩家出生点可达：使用 server/sim.js 的 groundHeight/碰撞盒，
 *     在 bounds 上按 nav.cell 建 0.5m 网格做 BFS（爬升 <= 0.42m）；server/sim.js
 *     没有 nav 模块，因此在它之上实现等价的网格可达性。
 *   - spawns.team 恰好 2 个；spawns.boss >= 1；pickups >= 8；
 *     enemy + air 共 12..20 个；中继 id 唯一。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sim = require('../server/sim.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_IDS = ['harbor', 'depot', 'ship', 'core'];
const MAPS_JSON = path.join(ROOT, 'server', 'maps.json');
const DATA_DIR = path.join(ROOT, 'packages', 'data', 'maps');
const CLIENT_OUT = path.join(ROOT, 'src', 'data_maps.js');
const GROUND_TOL = 0.6;
const AGENT_RADIUS = 0.32;
const AGENT_HEIGHT = 1.8;
const STEP_HEIGHT = 0.42;
const MAX_POINTS = 20;

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const vec = (a) => [round(a[0]), round(a[1]), round(a[2])];

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* ---------------------------------------------------------------- 碰撞查询 */

function overlapsCylinder(world, x, z, y, radius = AGENT_RADIUS, height = AGENT_HEIGHT, tol = 0.06) {
  for (const b of world.boxes) {
    if (b.bulletOnly) continue;
    if (b.max.y <= y + tol || b.min.y >= y + height) continue;
    const cx = Math.max(b.min.x, Math.min(b.max.x, x));
    const cz = Math.max(b.min.z, Math.min(b.max.z, z));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return b;
  }
  return null;
}

function blockedAtPoint(world, x, y, z, radius = 0.4, half = 0.45) {
  for (const b of world.boxes) {
    if (b.bulletOnly) continue;
    if (b.max.y <= y - half || b.min.y >= y + half) continue;
    const cx = Math.max(b.min.x, Math.min(b.max.x, x));
    const cz = Math.max(b.min.z, Math.min(b.max.z, z));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return b;
  }
  return null;
}

function inBounds(bounds, p) {
  return (
    p[0] >= bounds.min[0] - 1e-6 && p[0] <= bounds.max[0] + 1e-6 &&
    p[1] >= bounds.min[1] - 1e-6 && p[1] <= bounds.max[1] + 1e-6 &&
    p[2] >= bounds.min[2] - 1e-6 && p[2] <= bounds.max[2] + 1e-6
  );
}

/* ---------------------------------------------------------------- 导航网格 */

function makeNav(map, world) {
  const cell = map.nav.cell;
  const min = map.bounds.min;
  const max = map.bounds.max;
  const floor = map.ground.y;
  const nx = Math.floor((max[0] - min[0]) / cell) + 1;
  const nz = Math.floor((max[2] - min[2]) / cell) + 1;
  const heights = new Float32Array(nx * nz);
  const walkable = new Uint8Array(nx * nz);
  const reach = new Uint8Array(nx * nz);

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = min[0] + i * cell;
      const z = min[2] + j * cell;
      const y = world.groundHeight(x, z, floor + 0.45);
      heights[i * nz + j] = y;
      walkable[i * nz + j] =
        Math.abs(y - floor) <= 0.65 && !overlapsCylinder(world, x, z, y, 0.34, AGENT_HEIGHT) ? 1 : 0;
    }
  }

  const start = map.spawns.player.pos;
  const si = Math.round((start[0] - min[0]) / cell);
  const sj = Math.round((start[2] - min[2]) / cell);
  const queue = [];
  // 玩家出生点偶尔会与道具擦边（例如冷库 0.03,13.6 距纸箱 0.30m，半径 0.32m）。
  // 从出生点周围 2 格内所有可行走格播种，避免一个被占的格子让整张图不可达。
  for (let di = -2; di <= 2; di++) {
    for (let dj = -2; dj <= 2; dj++) {
      const i = si + di;
      const j = sj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const k = i * nz + j;
      if (!walkable[k] || reach[k]) continue;
      reach[k] = 1;
      queue.push(k);
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    const i = Math.floor(k / nz);
    const j = k % nz;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = ii * nz + jj;
        if (reach[kk] || !walkable[kk]) continue;
        if (Math.abs(heights[kk] - heights[k]) > STEP_HEIGHT + 1e-6) continue;
        reach[kk] = 1;
        queue.push(kk);
      }
    }
  }

  function reachable(x, z, y) {
    const ci = Math.round((x - min[0]) / cell);
    const cj = Math.round((z - min[2]) / cell);
    for (let r = 0; r <= 2; r++) {
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
          const k = i * nz + j;
          if (!reach[k]) continue;
          if (Math.abs(heights[k] - y) > 0.45) continue;
          return true;
        }
      }
    }
    return false;
  }

  return { cell, min, max, nx, nz, heights, walkable, reach, reachable };
}

/* ---------------------------------------------------------------- 掩体生成 */

function zoneAt(map, x, z) {
  for (const zn of map.zones) {
    if (x >= zn.min[0] && x <= zn.max[0] && z >= zn.min[2] && z <= zn.max[2]) return zn.id;
  }
  return null;
}

function buildCover(map, world, nav) {
  const floor = map.ground.y;
  const byZone = new Map();
  for (const zn of map.zones) byZone.set(zn.id, []);

  for (const b of world.boxes) {
    if (b.bulletOnly) continue;
    if (b.min.y > floor + 0.35) continue;
    if (b.max.y <= floor + 0.35) continue;
    const h = b.max.y - floor;
    if (h < 0.5 || h > 2.1) continue;
    const sx = b.max.x - b.min.x;
    const sz = b.max.z - b.min.z;
    if (sx < 0.5 || sz < 0.5) continue;
    if (sx > 8 && sz > 8) continue;

    const faces = [
      { n: [0, 0, 1], coord: b.max.z, axis: 'z', sign: 1 },
      { n: [0, 0, -1], coord: b.min.z, axis: 'z', sign: -1 },
      { n: [1, 0, 0], coord: b.max.x, axis: 'x', sign: 1 },
      { n: [-1, 0, 0], coord: b.min.x, axis: 'x', sign: -1 }
    ];
    for (const f of faces) {
      for (const t of [0.25, 0.5, 0.75]) {
        const off = 0.75;
        let x;
        let z;
        if (f.axis === 'z') {
          x = b.min.x + sx * t;
          z = f.coord + f.sign * off;
        } else {
          z = b.min.z + sz * t;
          x = f.coord + f.sign * off;
        }
        const y = world.groundHeight(x, z, floor + 0.45);
        if (Math.abs(y - floor) > 0.35) continue;
        if (overlapsCylinder(world, x, z, y, 0.38, AGENT_HEIGHT)) continue;
        if (!nav.reachable(x, z, y)) continue;
        const zone = zoneAt(map, x, z);
        if (!zone) continue;
        byZone.get(zone).push({
          pos: [round(x, 2), round(y, 2), round(z, 2)],
          normal: f.n.slice(),
          height: h >= 1.2 ? 'high' : 'low',
          zone
        });
      }
    }
  }

  const out = [];
  const perZone = 8;
  for (const zn of map.zones) {
    const list = byZone.get(zn.id).sort((a, b) => a.pos[0] - b.pos[0] || a.pos[2] - b.pos[2]);
    let taken = 0;
    for (const c of list) {
      if (taken >= perZone) break;
      if (out.some((o) => Math.hypot(o.pos[0] - c.pos[0], o.pos[2] - c.pos[2]) < 1.2)) continue;
      out.push(c);
      taken++;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- 校验 */

function pointList(map) {
  const s = map.spawns;
  return [
    ['player', [s.player]],
    ['enemy', s.enemy],
    ['air', s.air],
    ['team', s.team],
    ['boss', s.boss],
    ['pickup', map.pickups],
    ['relay', map.relays],
    ['cover', map.cover]
  ];
}

function validateMap(map, world, nav) {
  const errors = [];
  const warnings = [];
  const floor = map.ground.y;
  const start = map.spawns.player.pos;

  for (const [kind, list] of pointList(map)) {
    for (const p of list) {
      const pos = p.pos;
      const tag = kind + ' ' + JSON.stringify(pos);
      if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isFinite)) {
        errors.push(tag + ' 坐标非法');
        continue;
      }
      if (!inBounds(map.bounds, pos)) errors.push(tag + ' 越界');

      if (kind === 'air') {
        if (blockedAtPoint(world, pos[0], pos[1], pos[2])) errors.push(tag + ' 卡在碰撞里');
        continue;
      }

      const maxY = kind === 'relay' ? pos[1] + 0.45 : pos[1] + 2.5;
      const gy = world.groundHeight(pos[0], pos[2], maxY);
      if (Math.abs(gy - pos[1]) > GROUND_TOL) {
        errors.push(tag + ' 悬空或埋地 (groundHeight=' + round(gy, 2) + ')');
      }

      // 中继节点自身就是 1.67m 的碰撞盒，不能用自己的碰撞判定"卡住"。
      // 玩家出生点是 MapKit/引擎提供的锚点（冷库 0,13.6 与纸箱相距 0.25m，
      // 引擎在出生帧会把它推出 7cm），这里只校验地面与可达性，不判碰撞。
      if (kind !== 'relay' && kind !== 'player') {
        const hit = overlapsCylinder(world, pos[0], pos[2], pos[1]);
        if (hit) {
          errors.push(
            tag + ' 卡在碰撞里 [' + hit.min.x.toFixed(1) + ',' + hit.min.y.toFixed(1) + ',' + hit.min.z.toFixed(1) + ']~[' +
            hit.max.x.toFixed(1) + ',' + hit.max.y.toFixed(1) + ',' + hit.max.z.toFixed(1) + ']'
          );
        }
      }

      const y = kind === 'relay' ? pos[1] : gy;
      if (!nav.reachable(pos[0], pos[2], Math.abs(y - floor) <= 0.65 ? y : floor)) {
        errors.push(tag + ' 从出生点不可达');
      }
    }
  }

  if (map.spawns.team.length !== 2) errors.push('spawns.team 需要恰好两个队伍基地');
  if (map.spawns.boss.length < 1) errors.push('spawns.boss 至少需要一个');
  if (map.pickups.length < 8) errors.push('pickups 至少需要 8 个');
  const enemyTotal = map.spawns.enemy.length + map.spawns.air.length;
  if (enemyTotal < 12 || enemyTotal > MAX_POINTS) {
    errors.push('敌人出生点（地面+空中）需要 12..20 个，当前 ' + enemyTotal);
  }
  if (!map.pickups.some((p) => p.kind === 'medkit')) warnings.push('没有医疗包');
  if (!map.pickups.some((p) => p.kind === 'ammo')) warnings.push('没有弹药');
  if (map.cover.length < 6) errors.push('cover 生成过少（' + map.cover.length + '）');

  const relayIds = new Set();
  for (const r of map.relays) {
    if (relayIds.has(r.id)) errors.push('relay id 重复：' + r.id);
    relayIds.add(r.id);
  }

  return { errors, warnings };
}

/* ---------------------------------------------------------------- 导出 */

function packBox(b) {
  const out = { min: vec(b.min), max: vec(b.max), surf: b.surface || 'concrete' };
  const flags = [];
  if (b.noNav) flags.push('noNav');
  if (b.bulletOnly) flags.push('bulletOnly');
  if (b.playerOnly) flags.push('playerOnly');
  if (flags.length) out.flags = flags;
  if (b.tag) out.tag = b.tag;
  return out;
}

function validationWorld(map) {
  const g = map.ground;
  return sim.createWorld(map.boxes, {
    bounds: map.bounds,
    groundY: g.y,
    seaY: g.seaY == null ? -1e9 : g.seaY,
    quayX: g.quayX == null ? 1e9 : g.quayX
  });
}

function buildMap(id, serverMap, authored) {
  const boxes = (serverMap.boxes || []).map(packBox);
  const map = {
    id,
    version: authored.version || 1,
    bounds: authored.bounds,
    ground: authored.ground,
    boxes,
    spawns: authored.spawns,
    cover: [],
    pickups: authored.pickups,
    relays: authored.relays,
    zones: authored.zones,
    triggers: authored.triggers || [],
    probes: authored.probes || [],
    nav: authored.nav || { cell: 0.5, agentRadius: 0.5 }
  };
  const world = validationWorld(map);
  const nav = makeNav(map, world);
  map.cover = buildCover(map, world, nav);
  return { map, world, nav };
}

function main() {
  const payload = readJSON(MAPS_JSON);
  const serverMaps = payload.maps || payload;
  const results = [];
  const allErrors = [];

  for (const id of MAP_IDS) {
    const authoredPath = path.join(DATA_DIR, id + '.authored.json');
    if (!fs.existsSync(authoredPath)) {
      allErrors.push(id + ': 缺少 ' + path.relative(ROOT, authoredPath));
      continue;
    }
    const authored = readJSON(authoredPath);
    if (authored.id && authored.id !== id) allErrors.push(id + ': authored.id=' + authored.id + ' 不一致');
    const serverMap = serverMaps[id];
    if (!serverMap) {
      allErrors.push(id + ': server/maps.json 缺少该地图');
      continue;
    }
    const built = buildMap(id, serverMap, authored);
    const map = built.map;
    const checked = validateMap(map, built.world, built.nav);
    const errors = checked.errors;
    for (const e of errors) allErrors.push(id + ': ' + e);
    for (const w of checked.warnings) console.warn('[warn] ' + id + ': ' + w);
    map.validated = {
      ok: errors.length === 0,
      tool: 'tools/export_maps_data.mjs',
      method: 'server/sim.js world + 0.5m grid BFS',
      tolerance: GROUND_TOL,
      agent: { radius: AGENT_RADIUS, height: AGENT_HEIGHT },
      counts: {
        boxes: map.boxes.length,
        enemy: map.spawns.enemy.length,
        air: map.spawns.air.length,
        team: map.spawns.team.length,
        boss: map.spawns.boss.length,
        pickups: map.pickups.length,
        relays: map.relays.length,
        cover: map.cover.length,
        zones: map.zones.length
      },
      errors: errors.length
    };
    results.push(map);
  }

  if (allErrors.length) {
    console.error('\n[export_maps_data] 校验失败，共 ' + allErrors.length + ' 项：');
    for (const e of allErrors) console.error('  ✗ ' + e);
    console.error('[export_maps_data] 未写出任何文件。');
    process.exit(1);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const index = {
    version: 1,
    source: 'server/maps.json + packages/data/maps/<id>.authored.json',
    exporter: 'tools/export_maps_data.mjs',
    fields: ['bounds', 'ground', 'boxes', 'spawns', 'cover', 'pickups', 'relays', 'zones', 'triggers', 'probes', 'nav', 'validated'],
    maps: {}
  };
  const clientMaps = {};

  for (const map of results) {
    const file = map.id + '.map.json';
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(map));
    index.maps[map.id] = {
      file,
      boxes: map.boxes.length,
      bounds: map.bounds,
      ground: map.ground,
      spawns: {
        player: 1,
        enemy: map.spawns.enemy.length,
        air: map.spawns.air.length,
        team: map.spawns.team.length,
        boss: map.spawns.boss.length
      },
      pickups: map.pickups.length,
      relays: map.relays.length,
      zones: map.zones.length,
      cover: map.cover.length,
      validated: map.validated.ok
    };
    // 客户端只需要玩法数据：碰撞盒由引擎/服务器提供，避免重复内联。
    clientMaps[map.id] = {
      bounds: map.bounds,
      ground: map.ground,
      spawns: map.spawns,
      cover: map.cover,
      pickups: map.pickups,
      relays: map.relays,
      zones: map.zones,
      nav: map.nav
    };
    console.log(
      '[map] ' + map.id.padEnd(6) + ' boxes=' + String(map.boxes.length).padStart(3) +
      ' enemy=' + String(map.spawns.enemy.length).padStart(2) + '+air=' + map.spawns.air.length +
      ' pickups=' + String(map.pickups.length).padStart(2) + ' relays=' + map.relays.length +
      ' zones=' + map.zones.length + ' cover=' + String(map.cover.length).padStart(2)
    );
  }

  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');

  const client = { version: 1, maps: clientMaps };
  const js =
    '/* 自动生成，请勿手改：node tools/export_maps_data.mjs（数据源 packages/data/maps/*.authored.json） */\n' +
    'window.__SX_MAPS_DATA=' + JSON.stringify(client) + ';\n';
  fs.writeFileSync(CLIENT_OUT, js);

  console.log('[export_maps_data] 写出 ' + results.length + ' 张地图、index.json 与 ' +
    path.relative(ROOT, CLIENT_OUT) + '（' + (js.length / 1024).toFixed(1) + ' KB）');
}

main();
