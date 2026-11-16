#!/usr/bin/env node
/**
 * tools/sim_parity.mjs — 引擎物理（game.html / src/game.js d3）与 packages/sim 的逐条对比
 *
 * 用法：node tools/sim_parity.mjs
 * 要求：/Applications/Google Chrome.app；通过 file:// 打开 game.html?q=low&noaudio=1&autostart=1&dt=0.1
 * 对 harbor/depot/ship/core 各采样 300 条射线、200 次 groundHeight、100 次 moveCapsule。
 * 用 server/maps.json 构建 sim 世界；误差阈值 1e-4。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM = require(path.join(ROOT, 'packages/sim/index.js'));
const MAPS = require(path.join(ROOT, 'server/maps.json')).maps;

const CHROME = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THRESHOLD = 1e-4;
const RAYS = 300;
const GH = 200;
const MOVES = 100;
const GAME_URL = 'file://' + path.join(ROOT, 'game.html') + '?q=low&noaudio=1&autostart=1&dt=0.1';

function fmt(x, digits = 8) {
  if (x === 0) return '0';
  return Number(x).toExponential(2);
}

function makeRaySamples(world, seed) {
  const rng = SIM.rng.createRng(seed);
  const samples = [];
  for (let i = 0; i < RAYS; i++) {
    const x = -38 + rng() * 76;
    const z = -28 + rng() * 56;
    const base = world.groundHeight(x, z, 12);
    const y = Math.max(0.3, base + 0.25 + rng() * 6);
    const d = SIM.math.normalize3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, {});
    samples.push([x, y, z, d.x, d.y, d.z, 3 + rng() * 90]);
  }
  return samples;
}

function makeGroundSamples(seed) {
  const rng = SIM.rng.createRng(seed);
  const out = [];
  for (let i = 0; i < GH; i++) out.push([-40 + rng() * 80, -30 + rng() * 60, 0.3 + rng() * 12]);
  return out;
}

function makeMoveSamples(world, seed) {
  const rng = SIM.rng.createRng(seed);
  const out = [];
  let tries = 0;
  while (out.length < MOVES && tries < MOVES * 40) {
    tries++;
    const x = -36 + rng() * 72;
    const z = -26 + rng() * 52;
    let y = world.groundHeight(x, z, 30);
    if (world.overlapsCylinder({ x, y, z }, 0.32, 1.8)) continue;
    // 与引擎落地面差一点点的地面上方
    y += 0.02;
    const vx = (rng() * 2 - 1) * 6;
    const vz = (rng() * 2 - 1) * 6;
    const vy = rng() < 0.25 ? 3 + rng() * 3 : 0;
    out.push([x, y, z, vx, vy, vz]);
  }
  return out;
}

function compareBoxes(world, engineBoxes) {
  const n = Math.min(world.boxes.count, engineBoxes.length);
  let minMaxErr = 0;
  const flagMismatch = [];
  const noNavMismatch = [];
  const surfaceMismatch = [];
  for (let i = 0; i < n; i++) {
    const b = engineBoxes[i];
    const b3 = i * 3;
    const d = Math.max(
      Math.abs(world.boxes.min[b3] - b[0]),
      Math.abs(world.boxes.min[b3 + 1] - b[1]),
      Math.abs(world.boxes.min[b3 + 2] - b[2]),
      Math.abs(world.boxes.max[b3] - b[3]),
      Math.abs(world.boxes.max[b3 + 1] - b[4]),
      Math.abs(world.boxes.max[b3 + 2] - b[5]),
    );
    if (d > minMaxErr) minMaxErr = d;
    const simSurf = world.surfaceName(world.boxes.surf[i]);
    if (simSurf !== b[6]) surfaceMismatch.push([i, simSurf, b[6]]);
    const expectedFlags = (b[7] ? 1 : 0) | (b[8] ? 2 : 0) | (b[9] ? 4 : 0);
    // 碰撞语义只看 bulletOnly / playerOnly；noNav 是导航标记，maps.json 目前未导出（WP32-6 N9）。
    if ((world.boxes.flags[i] & 3) !== (expectedFlags & 3)) flagMismatch.push([i, world.boxes.flags[i], expectedFlags]);
    if ((world.boxes.flags[i] & 4) !== (expectedFlags & 4)) noNavMismatch.push([i, world.boxes.flags[i] & 4, expectedFlags & 4]);
  }
  return {
    countSim: world.boxes.count,
    countEngine: engineBoxes.length,
    sameCount: world.boxes.count === engineBoxes.length,
    minMaxErr,
    surfaceMismatch: surfaceMismatch.slice(0, 5),
    surfaceMismatchCount: surfaceMismatch.length,
    flagMismatch: flagMismatch.slice(0, 5),
    flagMismatchCount: flagMismatch.length,
    noNavMismatch: noNavMismatch.slice(0, 5),
    noNavMismatchCount: noNavMismatch.length,
  };
}

const browserModule = require('playwright');
const browser = await browserModule.chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

console.log('SALT_SIM parity —', GAME_URL);
try {
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 180000 });
} catch (e) {
  console.error('启动失败：', e.message);
  console.error('页面错误：', errors.slice(-8).join('\n'));
  await browser.close();
  process.exit(1);
}
console.log('引擎已就绪，开始逐图对比…\n');

const ids = ['harbor', 'depot', 'ship', 'core'];
const results = [];
let overallPass = true;

for (let mi = 0; mi < ids.length; mi++) {
  const id = ids[mi];
  const spec = MAPS[id];
  if (!spec) {
    console.error('server/maps.json 缺少地图', id);
    process.exit(1);
  }
  const switched = await page.evaluate((mapId) => window.__SX.switchMap(mapId), id);
  const engineBoxesRaw = await page.evaluate(() =>
    window.__SX.G.physics.boxes.map((b) => [
      b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z,
      b.surface || 'concrete', !!b.bulletOnly, !!b.playerOnly, !!b.noNav,
    ]),
  );
  const world = SIM.world.createWorld(spec);
  const boxCmp = compareBoxes(world, engineBoxesRaw);

  const rays = makeRaySamples(world, 1000 + mi * 17);
  const gh = makeGroundSamples(2000 + mi * 17);
  const moves = makeMoveSamples(world, 3000 + mi * 17);

  const engine = await page.evaluate(
    (payload) => {
      const P = window.__SX.G.physics;
      const index = new Map();
      for (let i = 0; i < P.boxes.length; i++) index.set(P.boxes[i], i);
      const rayOut = [];
      for (const r of payload.rays) {
        const hit = P.raycast({ x: r[0], y: r[1], z: r[2] }, { x: r[3], y: r[4], z: r[5] }, r[6]);
        if (!hit) {
          rayOut.push([0, r[6], 0, 0, 0, 0, 0, 0, -1, '']);
        } else {
          rayOut.push([
            1,
            hit.dist,
            hit.point.x, hit.point.y, hit.point.z,
            hit.normal.x, hit.normal.y, hit.normal.z,
            hit.box ? index.get(hit.box) : -1,
            hit.surface || '',
          ]);
        }
      }
      const ghOut = payload.gh.map((g) => P.groundHeight(g[0], g[1], g[2]));
      const moveOut = [];
      for (const m of payload.moves) {
        const pos = { x: m[0], y: m[1], z: m[2] };
        const vel = { x: m[3], y: m[4], z: m[5] };
        const res = P.moveCapsule(pos, vel, 1 / 60, 0.32, 1.8, true);
        moveOut.push([pos.x, pos.y, pos.z, res && res.onGround ? 1 : 0, res && res.hitWall ? 1 : 0]);
      }
      return { rayOut, ghOut, moveOut };
    },
    { rays, gh, moves },
  );

  // ---- rays ----
  let maxT = 0, sumT = 0, nT = 0;
  let maxPoint = 0, sumPoint = 0;
  let maxNormal = 0;
  let boxMismatch = 0, surfaceMismatch = 0, hitMismatch = 0;
  const hitTmp = { t: 0, hit: false, point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 }, surface: -1, boxIndex: -1 };
  for (let i = 0; i < rays.length; i++) {
    const r = rays[i];
    const e = engine.rayOut[i];
    world.raycast({ x: r[0], y: r[1], z: r[2] }, { x: r[3], y: r[4], z: r[5] }, r[6], SIM.world.MASK.BULLET, hitTmp);
    const eHit = e[0] === 1;
    if (hitTmp.hit !== eHit) {
      hitMismatch++;
      continue;
    }
    const et = e[1];
    const dt = Math.abs(hitTmp.t - et);
    maxT = Math.max(maxT, dt);
    sumT += dt;
    nT++;
    if (eHit) {
      const pdx = hitTmp.point.x - e[2];
      const pdy = hitTmp.point.y - e[3];
      const pdz = hitTmp.point.z - e[4];
      const pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
      maxPoint = Math.max(maxPoint, pd);
      sumPoint += pd;
      const nd = Math.max(Math.abs(hitTmp.normal.x - e[5]), Math.abs(hitTmp.normal.y - e[6]), Math.abs(hitTmp.normal.z - e[7]));
      maxNormal = Math.max(maxNormal, nd);
      if (hitTmp.boxIndex !== e[8]) boxMismatch++;
      if (e[8] >= 0 && world.surfaceName(hitTmp.surface) !== e[9]) surfaceMismatch++;
    }
  }

  // ---- groundHeight ----
  let maxGh = 0, sumGh = 0;
  for (let i = 0; i < gh.length; i++) {
    const got = world.groundHeight(gh[i][0], gh[i][1], gh[i][2]);
    const d = Math.abs(got - engine.ghOut[i]);
    maxGh = Math.max(maxGh, d);
    sumGh += d;
  }

  // ---- moveCapsule ----
  let maxMove = 0, sumMove = 0, onGroundMismatch = 0, wallMismatch = 0;
  const pos = { x: 0, y: 0, z: 0 };
  const vel = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    pos.x = m[0]; pos.y = m[1]; pos.z = m[2];
    vel.x = m[3]; vel.y = m[4]; vel.z = m[5];
    const res = world.moveCapsule(pos, vel, 1 / 60, 0.32, 1.8, true);
    const e = engine.moveOut[i];
    const d = Math.sqrt((pos.x - e[0]) ** 2 + (pos.y - e[1]) ** 2 + (pos.z - e[2]) ** 2);
    maxMove = Math.max(maxMove, d);
    sumMove += d;
    if ((res.onGround ? 1 : 0) !== e[3]) onGroundMismatch++;
    if ((res.hitWall ? 1 : 0) !== e[4]) wallMismatch++;
  }

  const row = {
    id,
    switched: !!switched,
    boxes: boxCmp,
    rays: {
      samples: rays.length,
      hits: nT,
      hitMismatch,
      maxT,
      avgT: nT ? sumT / nT : 0,
      maxPoint,
      avgPoint: nT ? sumPoint / nT : 0,
      maxNormal,
      boxMismatch,
      surfaceMismatch,
    },
    groundHeight: { samples: gh.length, max: maxGh, avg: sumGh / gh.length },
    moveCapsule: { samples: moves.length, max: maxMove, avg: sumMove / moves.length, onGroundMismatch, wallMismatch },
  };
  results.push(row);

  const mapPass =
    boxCmp.countSim === boxCmp.countEngine &&
    boxCmp.minMaxErr <= THRESHOLD &&
    boxCmp.flagMismatchCount === 0 &&
    row.rays.hitMismatch === 0 &&
    row.rays.boxMismatch === 0 &&
    row.rays.maxT <= THRESHOLD &&
    row.rays.maxPoint <= THRESHOLD &&
    row.rays.maxNormal <= THRESHOLD &&
    row.groundHeight.max <= THRESHOLD &&
    row.moveCapsule.max <= THRESHOLD;
  if (!mapPass) overallPass = false;

  console.log(
    '[' + id + '] boxes sim/engine ' + boxCmp.countSim + '/' + boxCmp.countEngine +
      '  boxErr ' + fmt(boxCmp.minMaxErr) + '  switch=' + !!switched,
  );
  console.log(
    '  ray  n=' + rays.length + ' hits=' + nT +
      '  maxT ' + fmt(maxT) + '  avgT ' + fmt(nT ? sumT / nT : 0) +
      '  maxPoint ' + fmt(maxPoint) + '  avgPoint ' + fmt(nT ? sumPoint / nT : 0) +
      '  maxNormal ' + fmt(maxNormal),
  );
  console.log(
    '       hitMismatch=' + hitMismatch + ' boxMismatch=' + boxMismatch +
      ' surfaceMismatch=' + surfaceMismatch + '  → ' + (mapPass ? 'PASS' : 'FAIL'),
  );
  console.log(
    '  groundHeight n=' + gh.length + ' max ' + fmt(maxGh) + ' avg ' + fmt(sumGh / gh.length) +
      ' | moveCapsule n=' + moves.length + ' max ' + fmt(maxMove) + ' avg ' + fmt(sumMove / moves.length) +
      ' onGroundMismatch=' + onGroundMismatch + ' wallMismatch=' + wallMismatch,
  );
  if (boxCmp.surfaceMismatchCount) console.log('  surfaceMismatch 示例:', JSON.stringify(boxCmp.surfaceMismatch));
  if (boxCmp.flagMismatchCount) console.log('  flagMismatch 示例:', JSON.stringify(boxCmp.flagMismatch));
  if (boxCmp.noNavMismatchCount) {
    console.log('  noNav 差异 ' + boxCmp.noNavMismatchCount + ' 个（maps.json 未导出 noNav，不影响射线/移动；WP32-6 N9）');
  }
  console.log('');
}

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  gameUrl: GAME_URL,
  threshold: THRESHOLD,
  pass: overallPass,
  results,
};
const outFile = path.join(ROOT, 'tests/golden/sim_parity.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2) + '\n');
console.log('摘要写入', path.relative(ROOT, outFile));
console.log('总体：' + (overallPass ? 'PASS' : 'FAIL') + '（阈值 ' + THRESHOLD + '）');
if (errors.length) console.log('页面日志中的错误条目：' + errors.length);
if (!overallPass) process.exitCode = 1;
