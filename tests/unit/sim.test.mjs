import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const SIM = require('../../packages/sim/index.js');
const MAPS = require('../../server/maps.json').maps;

// core_save 在 Node 下没有 localStorage 时退回模块内存；这里显式提供 shim，
// 让“旧六键迁移 / 镜像”路径可以被直接断言。
const LS = new Map();
const localStorageShim = {
  get length() { return LS.size; },
  key: (i) => Array.from(LS.keys())[i] ?? null,
  getItem: (k) => (LS.has(String(k)) ? LS.get(String(k)) : null),
  setItem: (k, v) => { LS.set(String(k), String(v)); },
  removeItem: (k) => { LS.delete(String(k)); },
  clear: () => { LS.clear(); },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageShim,
  configurable: true,
  writable: true,
});
const SXSave = require('../../src/core_save.js');

const FIXTURE = {
  bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
  groundY: 0,
  seaY: -1.6,
  quayX: 30,
  boxes: [
    { min: [-2, 0, -5], max: [2, 2, -3], surface: 'metal' },
    { min: [4, 0, 0], max: [6, 3, 2], surface: 'wood', playerOnly: true },
    { min: [-6, 0, 2], max: [-4, 2, 4], surface: 'glass', bulletOnly: true },
    { min: [2, 0, 4], max: [3, 2, 5], surface: 'metal', thin: true },
    { min: [-8, 0, -8], max: [-7, 2, -7], surface: 'concrete', flags: ['noNav'] },
  ],
};

function makeFixtureWorld() {
  return SIM.world.createWorld(FIXTURE);
}

/** server/sim.js raycast 的逐行参考实现（用于网格一致性测试）。 */
function bruteRay(w, o, d, maxDist, mask) {
  const { min, max, flags, surf, count } = w.boxes;
  mask = mask === undefined ? SIM.world.MASK.BULLET : mask;
  let best = maxDist;
  let hitBox = -1;
  let axis = -1;
  let sign = 0;
  let plane = 0;
  if (d.y < -1e-6) {
    const tGround = (w.groundY - o.y) / d.y;
    if (tGround > 0 && tGround < best) {
      if (o.x + d.x * tGround <= w.quayX) {
        best = tGround;
        plane = 1;
      } else {
        const tSea = (w.seaY - o.y) / d.y;
        if (tSea > 0 && tSea < best) {
          best = tSea;
          plane = 2;
        }
      }
    }
  }
  const invX = d.x === 0 ? Infinity : 1 / d.x;
  const invY = d.y === 0 ? Infinity : 1 / d.y;
  const invZ = d.z === 0 ? Infinity : 1 / d.z;
  for (let i = 0; i < count; i++) {
    if (flags[i] & mask) continue;
    let tNear = 0;
    let tFar = best;
    let hitAxis = -1;
    let hitSign = 0;
    const b3 = i * 3;
    let t1, t2, s;
    if (d.x !== 0) {
      t1 = (min[b3] - o.x) * invX;
      t2 = (max[b3] - o.x) * invX;
      s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tNear) {
        tNear = t1;
        hitAxis = 0;
        hitSign = s;
      }
      if (t2 < tFar) tFar = t2;
      if (tNear > tFar) continue;
    } else if (o.x < min[b3] || o.x > max[b3]) continue;
    if (d.y !== 0) {
      t1 = (min[b3 + 1] - o.y) * invY;
      t2 = (max[b3 + 1] - o.y) * invY;
      s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tNear) {
        tNear = t1;
        hitAxis = 1;
        hitSign = s;
      }
      if (t2 < tFar) tFar = t2;
      if (tNear > tFar) continue;
    } else if (o.y < min[b3 + 1] || o.y > max[b3 + 1]) continue;
    if (d.z !== 0) {
      t1 = (min[b3 + 2] - o.z) * invZ;
      t2 = (max[b3 + 2] - o.z) * invZ;
      s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tNear) {
        tNear = t1;
        hitAxis = 2;
        hitSign = s;
      }
      if (t2 < tFar) tFar = t2;
      if (tNear > tFar) continue;
    } else if (o.z < min[b3 + 2] || o.z > max[b3 + 2]) continue;
    if (hitAxis < 0) continue;
    best = tNear;
    hitBox = i;
    axis = hitAxis;
    sign = hitSign;
    plane = 0;
  }
  return { t: best, hit: hitBox >= 0 || plane !== 0, boxIndex: hitBox, plane, axis, sign, surface: plane ? -1 : surf[hitBox] };
}

function bruteGroundHeight(w, x, z, maxY) {
  const { min, max, flags, count } = w.boxes;
  let h = x <= w.quayX ? w.groundY : w.seaY;
  for (let i = 0; i < count; i++) {
    if (flags[i] & SIM.world.FLAGS.BULLET_ONLY) continue;
    const b3 = i * 3;
    if (x >= min[b3] && x <= max[b3] && z >= min[b3 + 2] && z <= max[b3 + 2] && max[b3 + 1] <= maxY && max[b3 + 1] > h) {
      h = max[b3 + 1];
    }
  }
  return h;
}

describe('math', () => {
  test('clamp / lerp / invLerp / smoothstep', () => {
    assert.equal(SIM.math.clamp(5, 0, 3), 3);
    assert.equal(SIM.math.clamp(-5, 0, 3), 0);
    assert.equal(SIM.math.lerp(0, 10, 0.25), 2.5);
    assert.equal(SIM.math.invLerp(10, 20, 15), 0.5);
    assert.equal(SIM.math.invLerp(10, 10, 15), 0);
    assert.equal(SIM.math.smoothstep(0, 1, 0), 0);
    assert.equal(SIM.math.smoothstep(0, 1, 0.5), 0.5);
    assert.equal(SIM.math.smoothstep(0, 1, 1), 1);
  });

  test('damp 是无 Math.exp 之外的单步指数趋近', () => {
    const a = SIM.math.damp(0, 1, 10, 1 / 60);
    assert.ok(a > 0 && a < 1);
    assert.ok(a < 1 / 6);
  });

  test('二维/三维距离与归一化', () => {
    assert.equal(SIM.math.dist2(0, 0, 3, 4), 5);
    assert.equal(SIM.math.dist3(0, 0, 0, 1, 2, 2), 3);
    assert.equal(SIM.math.distSq2(0, 0, 3, 4), 25);
    const n2 = SIM.math.normalize2(3, 4);
    assert.ok(Math.abs(n2.x - 0.6) < 1e-12 && Math.abs(n2.z - 0.8) < 1e-12);
    const n3 = SIM.math.normalize3(0, 3, 4);
    assert.ok(Math.abs(n3.y - 0.6) < 1e-12 && Math.abs(n3.z - 0.8) < 1e-12);
    const zero = SIM.math.normalize3(0, 0, 0);
    assert.deepEqual(zero, { x: 0, y: 0, z: 0 });
    assert.ok(SIM.math.nearlyEqual(1, 1 + 1e-9));
    assert.ok(!SIM.math.nearlyEqual(1, 1.1));
  });
});

describe('world / AABB slab', () => {
  test('命中盒返回 t / point / normal / surface / boxIndex', () => {
    const w = makeFixtureWorld();
    const hit = w.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 50);
    assert.equal(hit.hit, true);
    assert.ok(Math.abs(hit.t - 3) < 1e-6);
    assert.ok(Math.abs(hit.point.z + 3) < 1e-6);
    assert.equal(hit.normal.z, 1);
    assert.equal(hit.boxIndex, 0);
    assert.equal(w.surfaceName(hit.surface), 'metal');
  });

  test('玩家盒对子弹透明，对 mask=0 可见', () => {
    const w = makeFixtureWorld();
    const o = { x: 5, y: 1, z: -1 };
    const d = { x: 0, y: 0, z: 1 };
    const skipped = w.raycast(o, d, 50);
    assert.equal(skipped.boxIndex, -1);
    const seen = w.raycast(o, d, 50, 0);
    assert.equal(seen.boxIndex, 1);
    assert.ok(Math.abs(seen.t - 1) < 1e-6);
  });

  test('bulletOnly 盒挡子弹但不挡玩家移动查询', () => {
    const w = makeFixtureWorld();
    const o = { x: -5, y: 1, z: 0 };
    const d = { x: 0, y: 0, z: 1 };
    const bullet = w.raycast(o, d, 50);
    assert.equal(bullet.boxIndex, 2);
    assert.ok(Math.abs(bullet.t - 2) < 1e-6);
    const player = w.raycast(o, d, 50, SIM.world.MASK.PLAYER);
    assert.equal(player.boxIndex, -1);
  });

  test('thin 盒对子弹透明', () => {
    const w = makeFixtureWorld();
    const o = { x: 2.5, y: 1, z: 3 };
    const d = { x: 0, y: 0, z: 1 };
    assert.equal(w.raycast(o, d, 50).boxIndex, -1);
    assert.equal(w.raycast(o, d, 50, 0).boxIndex, 3);
  });

  test('地面 / 海面平面与 quayX 分支', () => {
    const w = makeFixtureWorld();
    const ground = w.raycast({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 500);
    assert.equal(ground.hit, true);
    assert.ok(Math.abs(ground.t - 5) < 1e-6);
    assert.equal(w.surfaceName(ground.surface), 'concrete');
    assert.equal(ground.normal.y, 1);
    assert.equal(ground.boxIndex, -1);

    const water = w.raycast({ x: 35, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 500);
    assert.equal(water.hit, true);
    assert.ok(Math.abs(water.t - 6.6) < 1e-6);
    assert.equal(w.surfaceName(water.surface), 'water');

    const edge = w.raycast({ x: 30, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 500);
    assert.equal(w.surfaceName(edge.surface), 'concrete');

    const miss = w.raycast({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 2);
    assert.equal(miss.hit, false);
    assert.ok(Math.abs(miss.t - 2) < 1e-6);
  });

  test('零方向 / 从盒内部出发与 server/sim.js 一致（不命中自身）', () => {
    const w = makeFixtureWorld();
    const zero = w.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, 50);
    assert.equal(zero.hit, false);
    const inside = w.raycast({ x: 0, y: 1, z: -4 }, { x: 0, y: 0, z: -1 }, 50);
    assert.equal(inside.hit, false);
  });

  test('2m 网格 CSR vs 暴力枚举：1000 条随机射线', () => {
    const mapIds = ['harbor', 'depot', 'ship', 'core'];
    const rng = SIM.rng.createRng(0x517a11);
    let checked = 0;
    let maxErr = 0;
    for (const id of mapIds) {
      const spec = MAPS[id];
      const w = SIM.world.createWorld(spec);
      for (let n = 0; n < 250; n++, checked++) {
        const o = { x: -40 + rng() * 80, y: 0.4 + rng() * 9, z: -30 + rng() * 60 };
        const d = SIM.math.normalize3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, {});
        const maxDist = 5 + rng() * 120;
        const got = w.raycast(o, d, maxDist);
        const ref = bruteRay(w, o, d, maxDist);
        const err = Math.abs(got.t - ref.t);
        if (err > maxErr) maxErr = err;
        assert.ok(err < 1e-6, id + ' ray ' + n + ' t err ' + err);
        assert.equal(got.hit, ref.hit, id + ' ray ' + n + ' hit');
        assert.equal(got.boxIndex, ref.boxIndex, id + ' ray ' + n + ' box');
      }
    }
    assert.equal(checked, 1000);
    assert.ok(maxErr < 1e-6, 'max t error ' + maxErr);
  });

  test('groundHeight vs 暴力枚举（四图各 200 次）', () => {
    const rng = SIM.rng.createRng(0x9e37);
    for (const id of Object.keys(MAPS)) {
      const w = SIM.world.createWorld(MAPS[id]);
      for (let n = 0; n < 200; n++) {
        const x = -40 + rng() * 80;
        const z = -30 + rng() * 60;
        const maxY = 0.5 + rng() * 10;
        assert.ok(Math.abs(w.groundHeight(x, z, maxY) - bruteGroundHeight(w, x, z, maxY)) < 1e-6, id + ' gh ' + n);
      }
    }
  });

  test('多个 world 并存时互不污染（服务器多房间）', () => {
    const a = SIM.world.createWorld({
      boxes: [{ min: [-1, 0, -6], max: [1, 2, -4], surface: 'metal' }],
    });
    const b = SIM.world.createWorld({
      boxes: [{ min: [-1, 0, 4], max: [1, 2, 6], surface: 'wood' }],
    });
    const hitA = a.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 50);
    const hitB = b.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 50);
    const hitA2 = a.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 50);
    assert.equal(hitB.boxIndex, 0);
    assert.equal(b.surfaceName(hitB.surface), 'wood');
    assert.equal(hitA.boxIndex, 0);
    assert.equal(hitA2.boxIndex, 0);
    assert.equal(a.surfaceName(hitA.surface), 'metal');
    assert.ok(Math.abs(hitA.t - 4) < 1e-6);
  });

  test('queryCylinder 去重且按索引升序', () => {
    const w = makeFixtureWorld();
    const list = [];
    w.queryCylinder(0, 0, 9, (i) => list.push(i));
    assert.ok(list.length >= 3);
    for (let i = 1; i < list.length; i++) assert.ok(list[i] > list[i - 1]);
  });

  test('overlapsCylinder', () => {
    const w = makeFixtureWorld();
    assert.equal(w.overlapsCylinder({ x: 0, y: 0, z: -4 }, 0.32, 1.8), true);
    assert.equal(w.overlapsCylinder({ x: 0, y: 0, z: 0 }, 0.32, 1.8), false);
  });

  test('lineOfSight', () => {
    const w = makeFixtureWorld();
    assert.equal(w.lineOfSight({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -10 }), false);
    assert.equal(w.lineOfSight({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 10 }), true);
    assert.equal(w.lineOfSight({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }), true);
  });
});

describe('world / moveCapsule', () => {
  function wallWorld() {
    return SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
      boxes: [{ min: [5, 0, -5], max: [6, 3, 5], surface: 'metal' }],
    });
  }

  test('高速移动不穿墙', () => {
    const w = wallWorld();
    const pos = { x: 0, y: 0.2, z: 0 };
    const vel = { x: 30, y: 0, z: 0 };
    let onGround = true;
    for (let i = 0; i < 300; i++) {
      const res = w.moveCapsule(pos, vel, 1 / 60, 0.32, 1.8, onGround);
      onGround = res.onGround;
      assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z));
      assert.ok(Number.isFinite(vel.x) && Number.isFinite(vel.y) && Number.isFinite(vel.z));
    }
    assert.ok(pos.x <= 5 - 0.32 + 1e-3, 'x=' + pos.x);
    assert.ok(pos.x > 4.0, 'x=' + pos.x);
    assert.ok(Math.abs(vel.x) < 1e-9);
  });

  test('台阶（<=0.42）可上，高墙不可上', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
      boxes: [
        { min: [2, 0, -3], max: [8, 0.3, 3], surface: 'concrete' },
        { min: [8, 0, -3], max: [9, 3, 3], surface: 'metal' },
      ],
    });
    const pos = { x: 0, y: 0, z: 0 };
    const vel = { x: 4, y: 0, z: 0 };
    let onGround = true;
    for (let i = 0; i < 120; i++) {
      const r = w.moveCapsule(pos, vel, 1 / 60, 0.32, 1.8, onGround);
      onGround = r.onGround;
    }
    assert.ok(pos.x > 7.0 && pos.x < 8, 'x=' + pos.x);
    assert.ok(Math.abs(pos.y - 0.3) < 1e-4, 'y=' + pos.y);
  });

  test('天花板阻挡', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
      boxes: [{ min: [-5, 2.2, -5], max: [5, 3, 5], surface: 'metal' }],
    });
    const pos = { x: 0, y: 0, z: 0 };
    const vel = { x: 0, y: 8, z: 0 };
    const res = w.moveCapsule(pos, vel, 0.2, 0.32, 1.8, true);
    assert.equal(res.hitCeil, true);
    assert.ok(pos.y + 1.8 <= 2.2 + 1e-6);
    assert.ok(Math.abs(pos.y - 0.4) < 1e-6);
  });

  test('海面以下的地板是 -50（与 server 一致）', () => {
    const w = SIM.world.createWorld({ boxes: [] });
    const pos = { x: 50, y: 0, z: 0 };
    const vel = { x: 0, y: -5, z: 0 };
    const res = w.moveCapsule(pos, vel, 1 / 60, 0.32, 1.8, true);
    assert.equal(res.onGround, false);
    assert.ok(pos.y < 0);
  });
});

describe('rng', () => {
  test('同种子同序列，异种子不同', () => {
    const a = SIM.rng.createRng(123);
    const b = SIM.rng.createRng(123);
    const c = SIM.rng.createRng(124);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    assert.deepEqual(seqA, seqB);
    assert.notDeepEqual(seqA, [c(), c(), c()]);
    for (const v of seqA) assert.ok(v >= 0 && v < 1);
  });

  test('命名流互不干扰、可复现', () => {
    const s1 = SIM.rng.createStreams(7);
    const s2 = SIM.rng.createStreams(7);
    const spreadA = s1.stream('spread');
    const spreadB = s2.stream('spread');
    const aiA = s1.stream('ai');
    const expected = [spreadA(), spreadA(), spreadA()];
    s1.stream('ai')();
    const got = [spreadB(), spreadB(), spreadB()];
    assert.deepEqual(got, expected);
    assert.ok(aiA() >= 0);
    // 重新取同名流返回同一个函数（继续序列）
    assert.equal(s1.stream('spread'), s1.stream('spread'));
  });

  test('fork 确定性且与父流独立', () => {
    const s = SIM.rng.createStreams(99);
    const f1 = s.fork('ai');
    const f2 = s.fork('ai');
    assert.deepEqual([f1.stream('x')(), f1.stream('x')()], [f2.stream('x')(), f2.stream('x')()]);
    assert.notEqual(f1.seed, s.seed);
  });
});

describe('movement', () => {
  function harborSetup() {
    const w = SIM.world.createWorld(MAPS.harbor);
    return { w, spawn: MAPS.harbor.playerStart };
  }

  test('600 步随机命令无 NaN，且同种子两次完全一致', () => {
    const { w, spawn } = harborSetup();
    function run() {
      const st = SIM.movement.createPlayerState(w, spawn);
      const rng = SIM.rng.createRng(2024);
      const trace = [];
      for (let i = 0; i < 600; i++) {
        const cmd = {
          tick: i,
          mx: Math.sin(i * 0.031) + (rng() - 0.5) * 0.2,
          my: Math.cos(i * 0.017),
          yaw: i * 0.004,
          pitch: Math.sin(i * 0.01) * 0.3,
          buttons: (i % 97 < 3 ? SIM.command.BTN.JUMP : 0) | (i % 131 < 25 ? SIM.command.BTN.SPRINT : 0) | (i % 197 > 170 ? SIM.command.BTN.CROUCH : 0) | (i % 89 < 20 ? SIM.command.BTN.ADS : 0),
          weaponSlot: 0,
        };
        SIM.movement.stepPlayer(st, cmd, w, 1 / 60);
        assert.ok(Number.isFinite(st.pos.x) && Number.isFinite(st.pos.y) && Number.isFinite(st.pos.z), 'pos NaN at ' + i);
        assert.ok(Number.isFinite(st.vel.x) && Number.isFinite(st.vel.y) && Number.isFinite(st.vel.z), 'vel NaN at ' + i);
        assert.ok(Number.isFinite(st.health));
        if (i % 7 === 0) trace.push([st.pos.x, st.pos.y, st.pos.z, st.vel.x, st.vel.y, st.vel.z, st.onGround, st.crouching, st.slideT, st.health]);
      }
      return { st, trace };
    }
    const a = run();
    const b = run();
    assert.deepEqual(a.trace, b.trace);
    assert.equal(a.st.health, b.st.health);
  });

  test('不同种子/命令产生不同轨迹', () => {
    const { w, spawn } = harborSetup();
    const st1 = SIM.movement.createPlayerState(w, spawn);
    const st2 = SIM.movement.createPlayerState(w, spawn);
    for (let i = 0; i < 120; i++) {
      SIM.movement.stepPlayer(st1, { tick: i, mx: 1, my: 1, yaw: 0, buttons: SIM.command.BTN.SPRINT }, w, 1 / 60);
      SIM.movement.stepPlayer(st2, { tick: i, mx: -1, my: 1, yaw: 1, buttons: SIM.command.BTN.SPRINT }, w, 1 / 60);
    }
    assert.notDeepEqual([st1.pos.x, st1.pos.z], [st2.pos.x, st2.pos.z]);
  });

  test('跳跃顶点约 1m，落地回到地面', () => {
    const w = SIM.world.createWorld({ boxes: [], bounds: { min: [-20, 0, -20], max: [20, 10, 20] } });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    let maxY = 0;
    for (let i = 0; i < 120; i++) {
      SIM.movement.stepPlayer(st, { tick: i, mx: 0, my: 0, yaw: 0, buttons: i === 0 ? SIM.command.BTN.JUMP : 0 }, w, 1 / 60);
      maxY = Math.max(maxY, st.pos.y);
    }
    assert.ok(Math.abs(maxY - 1) < 0.02, 'apex=' + maxY);
    assert.equal(st.onGround, true);
    assert.ok(Math.abs(st.pos.y) < 1e-6);
  });

  test('土狼时间：离开地面后仍可跳', () => {
    const w = SIM.world.createWorld({ boxes: [], bounds: { min: [-20, 0, -20], max: [20, 10, 20] } });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 3, z: 0 });
    st.onGround = true;
    SIM.movement.stepPlayer(st, { tick: 0, mx: 0, my: 0 }, w, 1 / 60);
    assert.equal(st.onGround, false);
    assert.ok(st.coyote > 0.1);
    SIM.movement.stepPlayer(st, { tick: 1, mx: 0, my: 0, buttons: SIM.command.BTN.JUMP }, w, 1 / 60);
    assert.equal(st.jumped, true);
    assert.ok(st.vel.y > 5);
  });

  test('滑铲：冲刺中按下蹲开始，速度不低于走路', () => {
    const w = SIM.world.createWorld({ boxes: [], bounds: { min: [-30, 0, -30], max: [30, 10, 30] } });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    for (let i = 0; i < 60; i++) {
      SIM.movement.stepPlayer(st, { tick: i, mx: 0, my: 1, yaw: 0, buttons: SIM.command.BTN.SPRINT }, w, 1 / 60);
    }
    assert.ok(st.speed > 6, 'speed=' + st.speed);
    const before = st.speed;
    SIM.movement.stepPlayer(st, { tick: 60, mx: 0, my: 1, yaw: 0, buttons: SIM.command.BTN.SPRINT | SIM.command.BTN.CROUCH }, w, 1 / 60);
    assert.ok(st.slideT > 0, 'slideT=' + st.slideT);
    assert.equal(st.crouching, true);
    assert.ok(st.speed >= before - 1e-9);
    const midSlide = st.slideT;
    // 松开蹲立即结束滑铲
    SIM.movement.stepPlayer(st, { tick: 61, mx: 0, my: 1, yaw: 0, buttons: SIM.command.BTN.SPRINT }, w, 1 / 60);
    assert.equal(st.slideT, 0);
    assert.ok(midSlide > 0.5);
  });

  test('蹲下高度 1.15，站起受头顶空间限制', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 4, 10] },
      boxes: [{ min: [-3, 1.5, -3], max: [3, 2, 3], surface: 'metal' }],
    });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    for (let i = 0; i < 10; i++) SIM.movement.stepPlayer(st, { tick: i, mx: 0, my: 0, buttons: SIM.command.BTN.CROUCH }, w, 1 / 60);
    assert.equal(st.crouching, true);
    assert.ok(Math.abs(st.height - 1.15) < 1e-9);
    assert.equal(SIM.movement.canStand(w, st.pos, 0.32, 1.8, 1.15), false);
    for (let i = 0; i < 10; i++) SIM.movement.stepPlayer(st, { tick: 20 + i, mx: 0, my: 0 }, w, 1 / 60);
    assert.equal(st.crouching, true, '头顶有盒时不能站起');
  });

  test('翻越：跳跃键 + 0.8m 箱子触发 vault', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
      boxes: [{ min: [-2, 0, 2], max: [2, 0.8, 4], surface: 'wood' }],
    });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    // 先按住前进撞到箱子
    for (let i = 0; i < 30; i++) SIM.movement.stepPlayer(st, { tick: i, mx: 0, my: -1, yaw: 0, buttons: SIM.command.BTN.SPRINT }, w, 1 / 60);
    // 前进方向 -Z，箱子在 +Z，转身向后走
    const st2 = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    st2.yaw = Math.PI;
    for (let i = 0; i < 90; i++) {
      SIM.movement.stepPlayer(st2, { tick: i, mx: 0, my: 1, yaw: Math.PI, buttons: SIM.command.BTN.SPRINT | (i === 60 ? SIM.command.BTN.JUMP : 0) }, w, 1 / 60);
      if (st2.vaulted) break;
    }
    assert.equal(st2.vaulted, true, 'vaulted=' + st2.vaulted + ' pos=' + JSON.stringify(st2.pos));
  });
});

describe('damage pipeline', () => {
  test('阶段顺序 pre→armor→difficulty→apply→post 与结算', () => {
    const p = SIM.damage.createDamagePipeline({ difficulty: 1.5 });
    const order = [];
    for (const stage of ['pre', 'armor', 'difficulty', 'apply', 'post']) {
      p.use(stage, () => order.push(stage));
    }
    const ev = { amount: 50, armor: 20, health: 100 };
    const res = p.run(ev);
    assert.deepEqual(order, ['pre', 'armor', 'difficulty', 'apply', 'post']);
    assert.deepEqual(res.trace, SIM.damage.ORDER);
    assert.equal(res.absorbed, 20);
    assert.ok(Math.abs(res.amount - 45) < 1e-9);
    assert.ok(Math.abs(ev.health - 55) < 1e-9);
    assert.equal(res.killed, false);
    assert.ok(Math.abs(res.final - 45) < 1e-9);
  });

  test('pre 取消后不再结算', () => {
    const p = SIM.damage.createDamagePipeline();
    const ev = { amount: 10, health: 100, cancelled: true };
    const res = p.run(ev);
    assert.equal(res.stopped, true);
    assert.equal(ev.health, 100);
    assert.equal(res.final, 0);
  });

  test('击杀与 ignoreArmor', () => {
    const p = SIM.damage.createDamagePipeline({ difficulty: 1 });
    const ev = { amount: 30, armor: 100, health: 30, ignoreArmor: true };
    const res = p.run(ev);
    assert.equal(ev.health, 0);
    assert.equal(res.killed, true);
  });

  test('set/clear 可替换默认阶段', () => {
    const p = SIM.damage.createDamagePipeline();
    p.clear('armor');
    p.set('difficulty', (ev, res) => (res.amount *= 2));
    const res = p.run({ amount: 10, health: 100 });
    assert.ok(Math.abs(res.amount - 20) < 1e-9);
    assert.ok(Math.abs(res.final - 20) < 1e-9);
  });
});

describe('weapons', () => {
  test('修复后的散布公式数值', () => {
    const s = SIM.weapons.spreadFor;
    assert.ok(Math.abs(s({ ads: 0 }) - 0.0125) < 1e-12);
    assert.ok(Math.abs(s({ ads: 1 }) - 0.0012) < 1e-12);
    assert.ok(Math.abs(s({ ads: 0.5 }) - 0.00685) < 1e-12);
    assert.ok(Math.abs(s({ ads: 0, speed01: 1 }) - 0.0255) < 1e-12);
    assert.ok(Math.abs(s({ ads: 0, crouching: true }) - 0.0105) < 1e-12);
    assert.ok(Math.abs(s({ ads: 0, onGround: false }) - 0.0345) < 1e-12);
    // 括号回归：缩放因子乘整个和式，而不是只乘 crouch 项
    assert.ok(Math.abs(s({ ads: 0, speed01: 1, spreadScale: 2 }) - 0.051) < 1e-12);
    assert.ok(Math.abs(s({ ads: 0, speed01: 1, mods: { spread: 0.5 } }) - 0.01275) < 1e-12);
    // 下限
    assert.ok(Math.abs(s({ ads: 0, spreadScale: 0 }) - 0.0004) < 1e-12);
    // 输入越界会被 clamp：ads=1、speed01=1 → 0.0012 + 0.004
    assert.ok(Math.abs(s({ ads: 2, speed01: 2 }) - 0.0052) < 1e-12);
    assert.ok(Math.abs(s({ ads: 2, speed01: 0 }) - 0.0012) < 1e-12);
  });

  test('recoilPattern 确定性、前 9 发更强', () => {
    const a = SIM.weapons.recoilPattern(0, 42);
    const b = SIM.weapons.recoilPattern(0, 42);
    assert.deepEqual(a, b);
    assert.equal(a.burst, 1);
    const late = SIM.weapons.recoilPattern(20, 42);
    assert.equal(late.burst, 21);
    assert.ok(a.pitch > late.pitch * 2);
    for (let i = 0; i < 40; i++) {
      const r = SIM.weapons.recoilPattern(i, 7);
      assert.ok(Number.isFinite(r.pitch) && Number.isFinite(r.yaw));
      assert.ok(Math.abs(r.yaw) < 0.01);
    }
  });

  test('damageAtRange', () => {
    const f = SIM.weapons.damageAtRange;
    assert.equal(f(40, 0, null), 40);
    assert.equal(f(40, 10, { start: 10, end: 20, min: 0.5 }), 40);
    assert.ok(Math.abs(f(40, 15, { start: 10, end: 20, min: 0.5 }) - 30) < 1e-9);
    assert.ok(Math.abs(f(40, 25, { start: 10, end: 20, min: 0.5 }) - 20) < 1e-9);
    assert.ok(Math.abs(f(40, 50, 0.01) - 20) < 1e-9);
  });

  test('pelletDirections 长度/单位向量/可复现', () => {
    const rngA = SIM.rng.createRng(11);
    const rngB = SIM.rng.createRng(11);
    const a = SIM.weapons.pelletDirections(9, 0.05, rngA);
    const b = SIM.weapons.pelletDirections(9, 0.05, rngB);
    assert.equal(a.length, 27);
    assert.deepEqual(Array.from(a), Array.from(b));
    for (let i = 0; i < 9; i++) {
      const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
      assert.ok(Math.abs(Math.sqrt(x * x + y * y + z * z) - 1) < 1e-6);
      assert.ok(z < 0);
    }
    assert.throws(() => SIM.weapons.pelletDirections(1, 0.1, null), TypeError);
  });
});

describe('command', () => {
  test('BTN 位掩码', () => {
    assert.equal(SIM.command.BTN.FIRE, 1);
    assert.equal(SIM.command.BTN.LEAN_R, 2048);
    assert.equal(SIM.command.ALL_BUTTONS, 4095);
  });

  test('轴归一化 / 按钮裁剪 / pitch 限制', () => {
    const c = SIM.command.makeCommand({ mx: 3, my: 4, buttons: 0xffff, pitch: 10, yaw: -3.2, tick: 9, weaponSlot: 2 });
    assert.ok(Math.abs(Math.hypot(c.mx, c.my) - 1) < 1e-12);
    assert.ok(Math.abs(c.mx - 0.6) < 1e-12 && Math.abs(c.my - 0.8) < 1e-12);
    assert.equal(c.buttons, 4095);
    assert.equal(c.pitch, 1.55);
    assert.equal(c.yaw, -3.2);
    assert.equal(c.tick, 9);
    assert.equal(c.weaponSlot, 2);
  });

  test('非法输入被清洗，validateCommand 报告错误', () => {
    const c = SIM.command.makeCommand({ mx: NaN, my: Infinity, buttons: NaN, pitch: -Infinity });
    assert.equal(c.mx, 0);
    assert.equal(c.my, 0);
    assert.equal(c.buttons, 0);
    assert.equal(c.pitch, 0);
    const bad = SIM.command.validateCommand({ mx: NaN, my: 1, buttons: 1 });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.length >= 1);
    const good = SIM.command.validateCommand({ mx: 0.6, my: 0.8, buttons: 1 });
    assert.equal(good.ok, true);
    assert.equal(SIM.command.has(good.command, SIM.command.BTN.FIRE), true);
    assert.equal(SIM.command.pressed(0, good.command, SIM.command.BTN.FIRE), true);
    assert.equal(SIM.command.pressed(1, good.command, SIM.command.BTN.FIRE), false);
  });
});

describe('movement V38 修复', () => {
  const BTN = SIM.command.BTN;

  test('滑铲结束：低顶棚下保持蹲姿，不强制站起', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 30] },
      boxes: [{ min: [-3, 1.5, 5], max: [3, 3, 20], surface: 'metal' }],
    });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    // 先冲刺到滑铲门槛（低顶棚从 z=5 开始，冲刺阶段不撞头）
    for (let i = 0; i < 40; i++) {
      SIM.movement.stepPlayer(st, { tick: i, mx: 0, my: 1, yaw: Math.PI, buttons: BTN.SPRINT }, w, 1 / 60);
    }
    assert.ok(st.speed > 6, 'speed=' + st.speed);
    assert.ok(st.pos.z < 5, 'approach z=' + st.pos.z);
    // 起滑，随后滑入 1.5m 高的低顶棚区域
    SIM.movement.stepPlayer(st, { tick: 40, mx: 0, my: 1, yaw: Math.PI, buttons: BTN.SPRINT | BTN.CROUCH }, w, 1 / 60);
    assert.ok(st.slideT > 0, 'slideT=' + st.slideT);
    assert.equal(st.crouching, true);
    let guard = 0;
    while (st.slideT > 0 && guard++ < 120) {
      SIM.movement.stepPlayer(st, { tick: 100 + guard, mx: 0, my: 1, yaw: Math.PI, buttons: BTN.CROUCH }, w, 1 / 60);
    }
    assert.equal(st.slideT, 0);
    assert.ok(st.pos.z > 5, 'slide end z=' + st.pos.z);
    assert.equal(SIM.movement.canStand(w, st.pos, 0.32, 1.8, 1.15), false);
    assert.equal(st.crouching, true, '低顶棚下不得强制站起');
    assert.ok(Math.abs(st.height - 1.15) < 1e-9, 'height=' + st.height);
    // 松开蹲键也不能站起，直到离开低顶棚
    SIM.movement.stepPlayer(st, { tick: 400, mx: 0, my: 1, yaw: Math.PI, buttons: 0 }, w, 1 / 60);
    assert.equal(st.crouching, true, '低顶棚下松开蹲仍保持蹲姿');
    assert.ok(st.height <= 1.15 + 1e-9);
  });

  test('翻越期间仍走公共 finishStep（回血 / eye / lean / speed 更新）', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
      boxes: [{ min: [-2, 0, 2], max: [2, 0.8, 4], surface: 'wood' }],
    });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    st.yaw = Math.PI;
    let vaulted = false;
    for (let i = 0; i < 120 && !vaulted; i++) {
      const jump = i >= 20;
      SIM.movement.stepPlayer(st, {
        tick: i, mx: 0, my: 1, yaw: Math.PI,
        buttons: BTN.SPRINT | (jump ? BTN.JUMP : 0) | BTN.LEAN_L,
      }, w, 1 / 60);
      if (st.vaulted) vaulted = true;
    }
    assert.equal(vaulted, true, 'vault did not start, z=' + st.pos.z);
    st.health = 40;
    st.sinceDamage = SIM.movement.DEFAULT_TUNING.regenDelay + 5;
    const hp0 = st.health;
    const lean0 = st.lean;
    const speed0 = st.speed;
    let steps = 0;
    while (st.vaultT > 0 && steps < 12) {
      SIM.movement.stepPlayer(st, { tick: 300 + steps, mx: 0, my: 0, yaw: Math.PI, buttons: BTN.LEAN_L }, w, 1 / 60);
      steps++;
      assert.ok(Math.abs(st.speed) < 1e-9, '翻越中 speed 应为 0，实际 ' + st.speed);
    }
    assert.ok(steps >= 3, 'vault steps=' + steps);
    assert.ok(st.health > hp0, '翻越中应回血 ' + hp0 + '→' + st.health);
    assert.ok(st.lean > lean0, 'lean 应在翻越中更新');
    assert.ok(st.crouch01 >= 0 && st.crouch01 <= 1);
    assert.ok(Math.abs(speed0) >= 0);
  });

  test('翻越路径 3 点胶囊采样：不穿过低掩体后的 0.2m 厚墙', () => {
    const w = SIM.world.createWorld({
      bounds: { min: [-10, 0, -10], max: [10, 10, 10] },
      boxes: [
        // 0.2m 厚、从 1.2m 开始的高墙：0.42m 高度的翻越射线会从墙下穿过
        { min: [-3, 1.2, 0.9], max: [3, 2.0, 1.1], surface: 'metal' },
        // 墙后刚好可翻越的 0.8m 箱子，落点高度合法
        { min: [-3, 0, 1.2], max: [3, 0.8, 2.0], surface: 'wood' },
      ],
    });
    const st = SIM.movement.createPlayerState(w, { x: 0, y: 0, z: 0 });
    st.yaw = Math.PI;
    for (let i = 0; i < 90; i++) {
      SIM.movement.stepPlayer(st, { tick: i, mx: 0, my: 1, yaw: Math.PI, buttons: BTN.SPRINT }, w, 1 / 60);
    }
    assert.ok(st.pos.z < 0.9, 'should be blocked by thin wall, z=' + st.pos.z);
    assert.ok(st.pos.z > 0.4, 'should stand right before thin wall, z=' + st.pos.z);
    let vaulted = false;
    for (let i = 0; i < 10; i++) {
      SIM.movement.stepPlayer(st, { tick: 200 + i, mx: 0, my: 1, yaw: Math.PI, buttons: BTN.JUMP }, w, 1 / 60);
      if (st.vaulted) vaulted = true;
    }
    assert.equal(vaulted, false, '不允许穿过 0.2m 厚墙');
    assert.ok(st.pos.z < 0.9, 'position crossed the wall, z=' + st.pos.z);
  });
});

describe('damage V38 minDamage / applied', () => {
  test('apply 至少扣 minDamage，final 记录实际扣血', () => {
    const p = SIM.damage.createDamagePipeline({ difficulty: 1, minDamage: 8 });
    const ev = { amount: 3, health: 100 };
    const res = p.run(ev);
    assert.equal(ev.health, 92);
    assert.equal(res.applied, 8);
    assert.equal(res.final, 8);
  });

  test('过量伤害：final = 实际扣掉的血量，而不是原始 amount', () => {
    const p = SIM.damage.createDamagePipeline({ difficulty: 1, minDamage: 5 });
    const ev = { amount: 30, health: 12 };
    const res = p.run(ev);
    assert.equal(ev.health, 0);
    assert.equal(res.applied, 12);
    assert.equal(res.final, 12);
    assert.equal(res.killed, true);
  });
});

describe('armory 六把枪（V38）', () => {
  const SRC = readFileSync(new URL('../../src/armory.js', import.meta.url), 'utf8');

  function loadArmory() {
    const store = new Map();
    const sandbox = { console };
    sandbox.window = sandbox;
    sandbox.localStorage = {
      getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => { store.set(String(k), String(v)); },
    };
    sandbox.G = { weapon: { list: [] } };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox);
    return sandbox;
  }

  test('6 把枪都有改装定义，smg/lmg/sidearm 与数据 JSON 槽位一致', () => {
    const arm = loadArmory();
    const defaults = arm.__SX_ARMORY.defaults();
    const ids = Object.keys(defaults).sort();
    assert.deepEqual(ids, ['breaker12', 'dmr', 'lmg', 'pac9', 'sidearm', 'smg']);
    for (const id of ids) assert.ok(Object.keys(defaults[id]).length >= 3, id + ' slots');

    const byWid = new Map();
    for (const c of arm.__SX_ARMORY.catalog) {
      if (!byWid.has(c.wid)) byWid.set(c.wid, []);
      byWid.get(c.wid).push(c.slot + ':' + c.opt);
    }
    for (const id of ['smg', 'lmg', 'sidearm']) {
      const json = JSON.parse(readFileSync(new URL('../../packages/data/weapons/' + id + '.json', import.meta.url), 'utf8'));
      const want = [];
      for (const slot of Object.keys(json.attachments)) {
        for (const opt of json.attachments[slot]) want.push(slot + ':' + opt);
      }
      assert.deepEqual(byWid.get(id).sort(), want.sort(), id + ' 槽位/选项应与 JSON 同源');
    }
    const prices = [...new Set(arm.__SX_ARMORY.catalog.map((c) => c.price))].sort((a, b) => a - b);
    assert.deepEqual(prices, [0, 120, 260, 400]);
  });
});

describe('save 六把枪和 audio 分轨（V38）', () => {
  const SIX = ['breaker12', 'dmr', 'lmg', 'pac9', 'sidearm', 'smg'];

  test('armory schema 接受 6 个 id；volume 四轨 import/export/镜像都不丢', () => {
    LS.clear();
    SXSave.reset();
    SXSave.setDebounce(0);
    const imported = {
      v: 2,
      armory: {
        pac9: { muzzle: 'supp' }, breaker12: { mag: 'ext' }, dmr: { optic: 'x45' },
        smg: { mag: 'ext' }, lmg: { optic: 'x2' }, sidearm: { muzzle: 'supp' },
        hax: { muzzle: 'supp' },
      },
      settings: { quality: 'high', volume: { master: 0.4, music: 0.3, sfx: 0.2, voice: 0.1 } },
    };
    const res = SXSave.importJSON(JSON.stringify(imported));
    assert.equal(res.ok, true);
    const st = SXSave.state();
    assert.deepEqual(Object.keys(st.armory).sort(), SIX);
    assert.deepEqual(st.armory.smg, { mag: 'ext' });
    assert.equal(st.armory.hax, undefined, '未知武器 id 必须被 schema 丢弃');
    assert.deepEqual(st.settings.volume, { master: 0.4, music: 0.3, sfx: 0.2, voice: 0.1 });

    const exp = JSON.parse(SXSave.exportJSON());
    assert.deepEqual(Object.keys(exp.armory).sort(), SIX);
    assert.deepEqual(exp.settings.volume, { master: 0.4, music: 0.3, sfx: 0.2, voice: 0.1 });

    const mir = SXSave.mirrorLegacy({ sections: ['settings', 'armory'] });
    const mirSet = JSON.parse(mir[SXSave.LEGACY.settings]);
    assert.equal(mirSet.volume, 0.4, '旧引擎仍读 number 主音量');
    assert.deepEqual(mirSet.volumeTracks, { music: 0.3, sfx: 0.2, voice: 0.1 });
    const mirArm = JSON.parse(mir[SXSave.LEGACY.armory]);
    assert.deepEqual(Object.keys(mirArm).sort(), SIX);
  });

  test('旧六键迁移：6 把枪 id 与 volumeTracks 都保留', () => {
    LS.clear();
    LS.set(SXSave.LEGACY.armory, JSON.stringify({
      pac9: { muzzle: 'supp' }, breaker12: { mag: 'ext' }, dmr: {},
      smg: { mag: 'fast' }, lmg: { optic: 'x2' }, sidearm: { mag: 'ext' },
    }));
    LS.set(SXSave.LEGACY.settings, JSON.stringify({
      quality: 'high', volume: 0.35, volumeTracks: { music: 0.4, sfx: 0.5, voice: 0.6 },
    }));
    const st = SXSave.load();
    assert.equal(SXSave.loadSource(), 'legacy');
    assert.deepEqual(Object.keys(st.armory).sort(), SIX);
    assert.deepEqual(st.armory.smg, { mag: 'fast' });
    assert.deepEqual(st.armory.lmg, { optic: 'x2' });
    assert.deepEqual(st.settings.volume, { master: 0.35, music: 0.4, sfx: 0.5, voice: 0.6 });
  });

  test('启动时把 saltline.audio.v1 的 music/sfx/voice 合并进 settings.volume', () => {
    LS.clear();
    const save = SXSave.DEFAULTS();
    save.settings.volume = { master: 0.9, music: 0.8, sfx: 1, voice: 1 };
    LS.set(SXSave.KEY, JSON.stringify(save));
    LS.set('saltline.audio.v1', JSON.stringify({ master: 0.9, music: 0.21, sfx: 0.32, voice: 0.43 }));
    globalThis.SXSave = SXSave;
    const Bridge = require('../../src/core_bridge.js');
    Bridge.init();
    const vol = SXSave.state().settings.volume;
    assert.deepEqual(vol, { master: 0.9, music: 0.21, sfx: 0.32, voice: 0.43 });
    // 旧引擎只回传 number 主音量时，不能把已合并的分轨冲回默认值。
    Bridge.settings({ volume: 0.5 });
    assert.deepEqual(SXSave.state().settings.volume, { master: 0.5, music: 0.21, sfx: 0.32, voice: 0.43 });
  });

  test('旧 settings 镜像的 volumeTracks 经 core_bridge 合并保留', () => {
    LS.clear();
    const save = SXSave.DEFAULTS();
    save.settings.volume = { master: 0.9, music: 0.8, sfx: 1, voice: 1 };
    LS.set(SXSave.KEY, JSON.stringify(save));
    LS.set(SXSave.LEGACY.settings, JSON.stringify({
      quality: 'high', volume: 0.35, volumeTracks: { music: 0.4, sfx: 0.5, voice: 0.6 },
    }));
    globalThis.SXSave = SXSave;
    delete require.cache[require.resolve('../../src/core_bridge.js')];
    const Bridge = require('../../src/core_bridge.js');
    Bridge.init();
    assert.deepEqual(SXSave.state().settings.volume, { master: 0.35, music: 0.4, sfx: 0.5, voice: 0.6 });
  });
});

describe('index', () => {
  test('create 接受地图 id 与单图 spec，step 可推进', () => {
    const sim = SIM.create({ map: 'harbor', maps: MAPS, seed: 3 });
    assert.equal(sim.version, SIM.version);
    assert.equal(sim.world.boxes.count, MAPS.harbor.boxes.length);
    assert.ok(sim.player);
    for (let i = 0; i < 30; i++) {
      sim.step({ tick: i, mx: 0, my: 1, yaw: 0, buttons: SIM.command.BTN.SPRINT }, 1 / 60);
    }
    assert.ok(Number.isFinite(sim.player.pos.x));
    assert.ok(sim.player.speed > 0);
    const sim2 = SIM.create({ map: MAPS.depot });
    assert.equal(sim2.world.boxes.count, MAPS.depot.boxes.length);
    assert.throws(() => SIM.create({ map: 'nope' }), /未知地图/);
  });
});
