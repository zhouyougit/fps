#!/usr/bin/env node
/**
 * tests/bench/physics_bench.mjs — packages/sim 物理基准
 * 港区 566 盒：raycast / groundHeight / moveCapsule
 * 结果写入 bench/baseline.json（目标：raycast 平均 < 2µs）。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SIM = require(path.join(ROOT, 'packages/sim/index.js'));
const MAPS = require(path.join(ROOT, 'server/maps.json')).maps;

const RAY_ITERS = Number(process.env.SIM_BENCH_RAYS || 200000);
const GH_ITERS = Number(process.env.SIM_BENCH_GH || 100000);
const MOVE_ITERS = Number(process.env.SIM_BENCH_MOVE || 20000);
const WARMUP = 20000;

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function buildRays(count, seed) {
  const rng = SIM.rng.createRng(seed);
  const origins = new Float64Array(count * 3);
  const dirs = new Float64Array(count * 3);
  const dists = new Float64Array(count);
  const tmp = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    origins[i * 3] = -40 + rng() * 80;
    origins[i * 3 + 1] = 0.4 + rng() * 9;
    origins[i * 3 + 2] = -30 + rng() * 60;
    SIM.math.normalize3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, tmp);
    dirs[i * 3] = tmp.x;
    dirs[i * 3 + 1] = tmp.y;
    dirs[i * 3 + 2] = tmp.z;
    dists[i] = 5 + rng() * 120;
  }
  return { origins, dirs, dists, count };
}

function benchRaycast(world, rays) {
  const out = { t: 0, hit: false, point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 }, surface: -1, boxIndex: -1 };
  const o = { x: 0, y: 0, z: 0 };
  const d = { x: 0, y: 0, z: 0 };
  let hits = 0;
  const n = rays.count;
  // warmup
  for (let i = 0; i < WARMUP; i++) {
    const k = i % n;
    o.x = rays.origins[k * 3]; o.y = rays.origins[k * 3 + 1]; o.z = rays.origins[k * 3 + 2];
    d.x = rays.dirs[k * 3]; d.y = rays.dirs[k * 3 + 1]; d.z = rays.dirs[k * 3 + 2];
    world.raycast(o, d, rays.dists[k], SIM.world.MASK.BULLET, out);
  }
  const t0 = nowMs();
  for (let i = 0; i < RAY_ITERS; i++) {
    const k = i % n;
    o.x = rays.origins[k * 3]; o.y = rays.origins[k * 3 + 1]; o.z = rays.origins[k * 3 + 2];
    d.x = rays.dirs[k * 3]; d.y = rays.dirs[k * 3 + 1]; d.z = rays.dirs[k * 3 + 2];
    world.raycast(o, d, rays.dists[k], SIM.world.MASK.BULLET, out);
    if (out.hit) hits++;
  }
  const ms = nowMs() - t0;
  return { iters: RAY_ITERS, ms, avgUs: (ms * 1000) / RAY_ITERS, qps: RAY_ITERS / (ms / 1000), hits };
}

function benchGroundHeight(world, seed) {
  const rng = SIM.rng.createRng(seed);
  const xs = new Float64Array(4096);
  const zs = new Float64Array(4096);
  const ys = new Float64Array(4096);
  for (let i = 0; i < 4096; i++) {
    xs[i] = -40 + rng() * 80;
    zs[i] = -30 + rng() * 60;
    ys[i] = 0.5 + rng() * 10;
  }
  let acc = 0;
  for (let i = 0; i < WARMUP; i++) acc += world.groundHeight(xs[i & 4095], zs[i & 4095], ys[i & 4095]);
  const t0 = nowMs();
  for (let i = 0; i < GH_ITERS; i++) acc += world.groundHeight(xs[i & 4095], zs[i & 4095], ys[i & 4095]);
  const ms = nowMs() - t0;
  return { iters: GH_ITERS, ms, avgUs: (ms * 1000) / GH_ITERS, qps: GH_ITERS / (ms / 1000), checksum: acc };
}

function benchMoveCapsule(world, seed) {
  const rng = SIM.rng.createRng(seed);
  const starts = [];
  for (let i = 0; i < 256; i++) {
    let x = 0;
    let z = 0;
    let tries = 0;
    do {
      x = -30 + rng() * 60;
      z = -20 + rng() * 40;
      tries++;
    } while (tries < 20 && world.overlapsCylinder({ x, y: 0, z }, 0.32, 1.8));
    starts.push({ x, z, y: world.groundHeight(x, z, 50) + 0.02 });
  }
  const pos = { x: 0, y: 0, z: 0 };
  const vel = { x: 0, y: 0, z: 0 };
  let moved = 0;
  function step(i) {
    const s = starts[i & 255];
    pos.x = s.x; pos.y = s.y; pos.z = s.z;
    vel.x = (rng() * 2 - 1) * 6;
    vel.y = 0;
    vel.z = (rng() * 2 - 1) * 6;
    const r = world.moveCapsule(pos, vel, 1 / 60, 0.32, 1.8, true);
    if (r.onGround) moved++;
  }
  for (let i = 0; i < 2000; i++) step(i);
  const t0 = nowMs();
  for (let i = 0; i < MOVE_ITERS; i++) step(i);
  const ms = nowMs() - t0;
  return { iters: MOVE_ITERS, ms, avgUs: (ms * 1000) / MOVE_ITERS, qps: MOVE_ITERS / (ms / 1000), onGround: moved };
}

const harbor = SIM.world.createWorld(MAPS.harbor);
const rays = buildRays(4096, 0xbe4c4);
const ray = benchRaycast(harbor, rays);
const gh = benchGroundHeight(harbor, 0x1234);
const mv = benchMoveCapsule(harbor, 0x5678);

const baseline = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform + ' ' + process.arch,
  map: 'harbor',
  boxes: harbor.boxes.count,
  cell: SIM.world.CELL,
  grid: { w: harbor.grid.w, h: harbor.grid.h },
  target: { raycastAvgUs: 2 },
  raycast: ray,
  groundHeight: gh,
  moveCapsule: mv,
  pass: ray.avgUs < 2,
  note: '旧实现估计 15-25µs；grid CSR + DDA 目标 <2µs。计时含调用开销与 out 复用。',
};

const outDir = path.join(ROOT, 'bench');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'baseline.json');
fs.writeFileSync(outFile, JSON.stringify(baseline, null, 2) + '\n');

console.log('SALT_SIM physics bench — harbor (' + harbor.boxes.count + ' boxes, ' + harbor.grid.w + 'x' + harbor.grid.h + ' grid)');
console.log('  raycast      ' + ray.iters + ' iters  avg ' + ray.avgUs.toFixed(3) + ' µs  ' + Math.round(ray.qps).toLocaleString() + ' q/s  hits ' + ray.hits);
console.log('  groundHeight ' + gh.iters + ' iters  avg ' + gh.avgUs.toFixed(3) + ' µs  ' + Math.round(gh.qps).toLocaleString() + ' q/s');
console.log('  moveCapsule  ' + mv.iters + ' iters  avg ' + mv.avgUs.toFixed(3) + ' µs  ' + Math.round(mv.qps).toLocaleString() + ' q/s');
console.log('  budget       raycast < 2 µs  →  ' + (baseline.pass ? 'PASS' : 'FAIL') + ' (' + ray.avgUs.toFixed(3) + ' µs)');
console.log('  baseline     ' + path.relative(ROOT, outFile));
if (!baseline.pass) process.exitCode = 1;
