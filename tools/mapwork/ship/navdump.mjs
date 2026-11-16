#!/usr/bin/env node
/* Map review validation harness (mirrors tools/export_maps_data.mjs checks).
 * Usage: node tools/mapwork/verify.mjs --map ship [--target game.html] [--json]
 * Reads packages/data/maps/<id>.authored.json and validates it against the live
 * collision boxes produced by the built map. Does NOT write any data files.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sim = require(path.resolve(process.cwd(), 'server/sim.js'));

const A = process.argv.slice(2);
const arg = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const ROOT = process.cwd();
const mapId = arg('map', 'harbor');
const target = path.resolve(ROOT, arg('target', 'game.html'));
const jsonOut = A.includes('--json');
const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MISSION = { harbor: 0, depot: 3, ship: 4, core: null };

const AGENT_RADIUS = 0.32, AGENT_HEIGHT = 1.8, STEP_HEIGHT = 0.42, GROUND_TOL = 0.6;
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function overlapsCylinder(world, x, z, y, radius = AGENT_RADIUS, height = AGENT_HEIGHT, tol = 0.06) {
  for (const b of world.boxes) {
    if (b.bulletOnly) continue;
    if (b.max.y <= y + tol || b.min.y >= y + height) continue;
    const cx = Math.max(b.min.x, Math.min(b.max.x, x));
    const cz = Math.max(b.min.z, Math.min(b.max.z, z));
    const dx = x - cx, dz = z - cz;
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
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return b;
  }
  return null;
}
function inBounds(bounds, p) {
  return p[0] >= bounds.min[0] - 1e-6 && p[0] <= bounds.max[0] + 1e-6 &&
    p[1] >= bounds.min[1] - 1e-6 && p[1] <= bounds.max[1] + 1e-6 &&
    p[2] >= bounds.min[2] - 1e-6 && p[2] <= bounds.max[2] + 1e-6;
}
function makeNav(map, world) {
  const cell = map.nav.cell, min = map.bounds.min, max = map.bounds.max, floor = map.ground.y;
  const nx = Math.floor((max[0] - min[0]) / cell) + 1;
  const nz = Math.floor((max[2] - min[2]) / cell) + 1;
  const heights = new Float32Array(nx * nz), walkable = new Uint8Array(nx * nz), reach = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = min[0] + i * cell, z = min[2] + j * cell;
    const y = world.groundHeight(x, z, floor + 0.45);
    heights[i * nz + j] = y;
    walkable[i * nz + j] = (Math.abs(y - floor) <= 0.65 && !overlapsCylinder(world, x, z, y, 0.34, AGENT_HEIGHT)) ? 1 : 0;
  }
  const start = map.spawns.player.pos;
  const si = Math.round((start[0] - min[0]) / cell), sj = Math.round((start[2] - min[2]) / cell);
  const queue = [];
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    const i = si + di, j = sj + dj;
    if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
    const k = i * nz + j;
    if (!walkable[k] || reach[k]) continue;
    reach[k] = 1; queue.push(k);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi], i = Math.floor(k / nz), j = k % nz;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = ii * nz + jj;
      if (reach[kk] || !walkable[kk]) continue;
      if (Math.abs(heights[kk] - heights[k]) > STEP_HEIGHT + 1e-6) continue;
      reach[kk] = 1; queue.push(kk);
    }
  }
  function reachable(x, z, y) {
    const ci = Math.round((x - min[0]) / cell), cj = Math.round((z - min[2]) / cell);
    for (let r = 0; r <= 2; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const k = i * nz + j;
      if (!reach[k]) continue;
      if (Math.abs(heights[k] - y) > 0.45) continue;
      return true;
    }
    return false;
  }
  return { cell, min, max, nx, nz, heights, walkable, reach, reachable };
}
function zoneAt(map, x, z) {
  for (const zn of map.zones) if (x >= zn.min[0] && x <= zn.max[0] && z >= zn.min[2] && z <= zn.max[2]) return zn.id;
  return null;
}
function buildCover(map, world, nav) {
  const floor = map.ground.y, byZone = new Map();
  for (const zn of map.zones) byZone.set(zn.id, []);
  for (const b of world.boxes) {
    if (b.bulletOnly) continue;
    if (b.min.y > floor + 0.35 || b.max.y <= floor + 0.35) continue;
    const h = b.max.y - floor;
    const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
    if (h < 0.5 || h > 2.1 || sx < 0.5 || sz < 0.5 || (sx > 8 && sz > 8)) continue;
    const faces = [
      { n: [0, 0, 1], coord: b.max.z, axis: 'z', sign: 1 }, { n: [0, 0, -1], coord: b.min.z, axis: 'z', sign: -1 },
      { n: [1, 0, 0], coord: b.max.x, axis: 'x', sign: 1 }, { n: [-1, 0, 0], coord: b.min.x, axis: 'x', sign: -1 }
    ];
    for (const f of faces) for (const t of [0.25, 0.5, 0.75]) {
      const off = 0.75; let x, z;
      if (f.axis === 'z') { x = b.min.x + sx * t; z = f.coord + f.sign * off; }
      else { z = b.min.z + sz * t; x = f.coord + f.sign * off; }
      const y = world.groundHeight(x, z, floor + 0.45);
      if (Math.abs(y - floor) > 0.35) continue;
      if (overlapsCylinder(world, x, z, y, 0.38, AGENT_HEIGHT)) continue;
      if (!nav.reachable(x, z, y)) continue;
      const zone = zoneAt(map, x, z);
      if (!zone) continue;
      byZone.get(zone).push({ pos: [round(x), round(y), round(z)], normal: f.n.slice(), height: h >= 1.2 ? 'high' : 'low', zone });
    }
  }
  const out = [];
  for (const zn of map.zones) {
    const list = byZone.get(zn.id).sort((a, b) => a.pos[0] - b.pos[0] || a.pos[2] - b.pos[2]);
    let taken = 0;
    for (const c of list) {
      if (taken >= 8) break;
      if (out.some((o) => Math.hypot(o.pos[0] - c.pos[0], o.pos[2] - c.pos[2]) < 1.2)) continue;
      out.push(c); taken++;
    }
  }
  return out;
}

const authoredPath = path.resolve(ROOT, 'packages/data/maps/' + mapId + '.authored.json');
if (!fs.existsSync(authoredPath)) { console.error('missing ' + authoredPath); process.exit(2); }
const authored = JSON.parse(fs.readFileSync(authoredPath, 'utf8'));

const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 240)); });
await page.goto(pathToFileURL(target).href + '?q=low&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout: 300000 });
const fatal = await page.evaluate(() => window.__fatal || null);
if (fatal) { console.error('fatal: ' + fatal); process.exit(2); }
await page.waitForTimeout(400);
const live = await page.evaluate(({ mapId, mission }) => {
  const G = window.__G;
  if (mission == null) { window.__SX.switchMap(mapId); G.game.start({ skipIntro: true }); }
  else { window.__SX.applyMission(mission); G.game.start({ skipIntro: true }); }
  const P = G.physics;
  const def = window.__SX.mapInfo();
  const relays = [];
  try { const rr = window.__SX.mapRelays(mapId) || {}; for (const k of Object.keys(rr)) relays.push({ id: k, pos: rr[k].pos.toArray() }); } catch (e) {}
  const cover = [];
  try { const d = window.__SX.G && null; } catch (e) {}
  return {
    mapId: window.__SX.mapId(), def,
    boxes: P.boxes.map((b) => ({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], surface: b.surface, tag: b.tag || '', opts: { noNav: !!b.noNav, bulletOnly: !!b.bulletOnly, playerOnly: !!b.playerOnly } })),
    bounds: { min: P.bounds.min.toArray(), max: P.bounds.max.toArray() },
    playerStart: G.level.playerStart.pos.toArray(),
    relays
  };
}, { mapId, mission: MISSION[mapId] ?? null });
await browser.close();

const map = {
  id: mapId, bounds: authored.bounds, ground: authored.ground, boxes: live.boxes,
  spawns: authored.spawns, pickups: authored.pickups, relays: authored.relays,
  zones: authored.zones, nav: authored.nav || { cell: 0.5, agentRadius: 0.5 }
};
const world = sim.createWorld(live.boxes, {
  bounds: authored.bounds, groundY: authored.ground.y,
  seaY: authored.ground.seaY == null ? -1e9 : authored.ground.seaY,
  quayX: authored.ground.quayX == null ? 1e9 : authored.ground.quayX
});
const nav = makeNav(map, world);
const cover = buildCover(map, world, nav);


// ---- ASCII nav dump (2m cells) ----
{
  const step = 2; // 1m
  let out = '';
  for (let j = nav.nz - 1; j >= 0; j -= step) {
    let line = '';
    for (let i = 0; i < nav.nx; i += step) {
      const k = i * nav.nz + j;
      line += nav.reach[k] ? '#' : (nav.walkable[k] ? '.' : ' ');
    }
    out += (nav.min[2] + j * nav.cell).toFixed(0).padStart(4) + ' ' + line + '\n';
  }
  console.log(out);
  const blocks = new Map();
  for (let i = 0; i < nav.nx; i++) for (let j = 0; j < nav.nz; j++) {
    const k = i * nav.nz + j;
    if (!nav.walkable[k] || nav.reach[k]) continue;
    const bx = Math.floor((nav.min[0] + i * nav.cell) / 4) * 4, bz = Math.floor((nav.min[2] + j * nav.cell) / 4) * 4;
    const key = bx + ',' + bz;
    blocks.set(key, (blocks.get(key) || 0) + 1);
  }
  const top = [...blocks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log('UNREACHABLE BLOCKS (4x4m): ' + top.map(([k, v]) => k + ':' + v).join(' '));
}
const errors = [], warnings = [];
const floor = map.ground.y;
// Authored bounds are the source of truth; check the built geometry stays inside them.
for (const b of live.boxes) {
  if (b.min[1] < -50) continue; // water/void marker boxes
  if (b.tag === 'backdrop') continue; // scenery outside playable bounds
  if (b.min[0] < authored.bounds.min[0] - 2.0 || b.max[0] > authored.bounds.max[0] + 2.0 ||
      b.min[2] < authored.bounds.min[2] - 2.0 || b.max[2] > authored.bounds.max[2] + 2.0) {
    errors.push('几何超出 authored bounds: [' + [b.min[0], b.min[1], b.min[2]].map((n) => n.toFixed(1)) + ']~[' + [b.max[0], b.max[1], b.max[2]].map((n) => n.toFixed(1)) + ']');
    break;
  }
}
if (live.mapId !== mapId) errors.push('切图失败: ' + live.mapId);
for (const [kind, list] of [['player', [map.spawns.player]], ['enemy', map.spawns.enemy], ['air', map.spawns.air], ['team', map.spawns.team], ['boss', map.spawns.boss], ['pickup', map.pickups], ['relay', map.relays], ['cover', cover]]) {
  for (const p of list) {
    const pos = p.pos, tag = kind + ' ' + JSON.stringify(pos);
    if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isFinite)) { errors.push(tag + ' 坐标非法'); continue; }
    if (!inBounds(map.bounds, pos)) errors.push(tag + ' 越界');
    if (kind === 'air') { if (blockedAtPoint(world, pos[0], pos[1], pos[2])) errors.push(tag + ' 卡在碰撞里'); continue; }
    const maxY = kind === 'relay' ? pos[1] + 0.45 : pos[1] + 2.5;
    const gy = world.groundHeight(pos[0], pos[2], maxY);
    if (Math.abs(gy - pos[1]) > GROUND_TOL) errors.push(tag + ' 悬空或埋地 (groundHeight=' + round(gy) + ')');
    if (kind !== 'relay' && kind !== 'player') {
      const hit = overlapsCylinder(world, pos[0], pos[2], pos[1]);
      if (hit) errors.push(tag + ' 卡在碰撞里 [' + [hit.min.x, hit.min.y, hit.min.z].map((v) => v.toFixed(1)) + ']~[' + [hit.max.x, hit.max.y, hit.max.z].map((v) => v.toFixed(1)) + ']');
    }
    const y = kind === 'relay' ? pos[1] : gy;
    if (!nav.reachable(pos[0], pos[2], Math.abs(y - floor) <= 0.65 ? y : floor)) errors.push(tag + ' 从出生点不可达');
  }
}
const navOut = [];
for (const [kind, list] of [['player', [map.spawns.player]], ['enemy', map.spawns.enemy], ['team', map.spawns.team], ['boss', map.spawns.boss], ['pickup', map.pickups], ['relay', map.relays]]) {
  for (const p of list) {
    const q = p.pos;
    if (!q) continue;
    if (q[0] > 29 || q[0] < -39.5 || q[2] > 29 || q[2] < -31.5) navOut.push(kind + ' ' + JSON.stringify(q));
  }
}
if (navOut.length) warnings.push('引擎 nav 网格只覆盖 x -39.5..29.5 / z -31.5..29.5，以下点位 AI 不可达：' + navOut.slice(0, 6).join(', ') + (navOut.length > 6 ? ' 等 ' + navOut.length + ' 个' : ''));
if (map.spawns.team.length !== 2) errors.push('spawns.team 需要恰好两个队伍基地');
if (map.spawns.boss.length < 1) errors.push('spawns.boss 至少需要一个');
if (map.pickups.length < 8) errors.push('pickups 至少需要 8 个');
const enemyTotal = map.spawns.enemy.length + map.spawns.air.length;
if (enemyTotal < 12 || enemyTotal > 20) errors.push('敌人出生点需要 12..20 个，当前 ' + enemyTotal);
if (!map.pickups.some((p) => p.kind === 'medkit')) warnings.push('没有医疗包');
if (!map.pickups.some((p) => p.kind === 'ammo')) warnings.push('没有弹药');
if (cover.length < 6) errors.push('cover 生成过少（' + cover.length + '）');
const relayIds = new Set();
for (const r of map.relays) { if (relayIds.has(r.id)) errors.push('relay id 重复：' + r.id); relayIds.add(r.id); }
for (const r of live.relays) if (!relayIds.has(r.id)) errors.push('地图内中继未写入 authored: ' + r.id);
// walkable ratio + stats
let walk = 0; for (let i = 0; i < nav.walkable.length; i++) walk += nav.walkable[i];
const reachable = (() => { let n = 0; for (let i = 0; i < nav.reach.length; i++) n += nav.reach[i]; return n; })();
const result = {
  map: mapId, target: path.relative(ROOT, target), ok: errors.length === 0,
  counts: { boxes: live.boxes.length, authoredBoxes: undefined, enemy: map.spawns.enemy.length, air: map.spawns.air.length, pickups: map.pickups.length, relays: map.relays.length, zones: map.zones.length, cover: cover.length, walkable: walk, reachable },
  bounds: authored.bounds, errors, warnings, pageErrors: pageErrors.slice(0, 8)
};
if (jsonOut) console.log(JSON.stringify(result, null, 1));
else {
  console.log('[verify] ' + mapId + ' ok=' + result.ok + ' boxes=' + result.counts.boxes + ' cover=' + cover.length + ' walkable=' + walk + ' reachable=' + reachable);
  for (const e of errors) console.log('  FAIL ' + e);
  for (const w of warnings) console.log('  WARN ' + w);
  for (const e of result.pageErrors) console.log('  PAGE ' + e);
}
process.exit(errors.length ? 1 : 0);