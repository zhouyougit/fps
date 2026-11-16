import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SIM = require('../../packages/sim/index.js');

// SALT_UNIT_EXPORT=1 让 server.cjs 只导出纯函数/移动入口，不启动 HTTP/WS/定时器。
process.env.SALT_UNIT_EXPORT = '1';
const SERVER = require('../../server/server.cjs');
const BTN = SIM.movement.BTN;
const DEFAULT = SIM.movement.DEFAULT_TUNING;
const STEP = 1 / 60;

const FLAT = {
  bounds: { min: [-50, 0, -50], max: [50, 20, 50] },
  groundY: 0,
  seaY: -9999,
  quayX: 9999,
  boxes: [],
};
const VAULT_MAP = {
  ...FLAT,
  boxes: [{ min: [-2, 0, -3], max: [2, 0.9, -2.2], surface: 'metal' }],
};

function world(spec) {
  return SIM.world.createWorld(spec);
}

function serverState(w, spawn) {
  const p = { room: { world: w }, alive: true };
  SERVER.initPlayerMovement(p, spawn);
  return p;
}

function err(a, b) {
  return Math.max(
    Math.abs(a.pos.x - b.pos.x),
    Math.abs(a.pos.y - b.pos.y),
    Math.abs(a.pos.z - b.pos.z),
    Math.abs(a.vel.x - b.vel.x),
    Math.abs(a.vel.y - b.vel.y),
    Math.abs(a.vel.z - b.vel.z),
    Math.abs(a.height - b.height),
    a.onGround === b.onGround ? 0 : 1,
    !!a.crouching === !!b.crouching ? 0 : 1
  );
}

function runParity(spec, spawn, cmds) {
  const w = world(spec);
  const srv = serverState(w, spawn);
  const cli = SIM.movement.createPlayerState(w, spawn, DEFAULT);
  let maxErr = 0;
  let firstMismatch = -1;
  const flags = { jump: false, crouch: false, slide: false, vault: false };
  for (let i = 0; i < cmds.length; i++) {
    SERVER.stepPlayer(srv, cmds[i], STEP);
    SIM.movement.stepPlayer(cli, cmds[i], w, STEP, DEFAULT);
    const e = err(srv, cli);
    if (e > maxErr) maxErr = e;
    if (firstMismatch < 0 && e > 1e-12) firstMismatch = i;
    if (srv.jumped) flags.jump = true;
    if (srv.crouching) flags.crouch = true;
    if (srv.slideT > 0) flags.slide = true;
    if (srv.vaultT > 0) flags.vault = true;
  }
  return { srv, cli, maxErr, firstMismatch, flags };
}

function cmd(i, over) {
  return Object.assign({ tick: i, mx: 0, my: 0, yaw: 0, pitch: 0, buttons: 0 }, over || {});
}

describe('NET-2 服务器 / 客户端共享 stepPlayer', () => {
  test('服务器移动 tuning 来自 packages/sim（仅覆盖服务器语义字段）', () => {
    const overridden = new Set(['rescueDepth', 'maxHealth', 'regenRate']);
    for (const key of Object.keys(DEFAULT)) {
      if (overridden.has(key)) continue;
      assert.equal(SERVER.SERVER_TUNING[key], DEFAULT[key], 'tuning.' + key);
    }
    assert.ok(SERVER.SERVER_TUNING.rescueDepth > 1e6, '服务器关闭共享掉海自救，保留 SRV-4 死亡流程');
    assert.equal(SERVER.SERVER_TUNING.regenRate, 0);
  });

  test('initPlayerMovement 补齐 sim 需要的滑铲/翻越/土狼/跳跃缓冲字段', () => {
    const p = serverState(world(FLAT), { x: 0, y: 0, z: 0, yaw: 0 });
    for (const key of ['pos', 'vel', 'crouching', 'sprinting', 'crouch01', 'ads', 'adsLin',
      'coyote', 'jumpBuf', 'slideT', 'slideDirX', 'slideDirZ', 'vaultT', 'airTime',
      'peakFallSpeed', 'prevButtons', 'lastSafe', 'speed', 'height', 'radius']) {
      assert.ok(Object.prototype.hasOwnProperty.call(p, key), '缺少字段 ' + key);
    }
    assert.deepEqual(p.pos, { x: 0, y: 0, z: 0 });
    assert.equal(p.height, DEFAULT.standHeight);
    assert.equal(p.tuning || SERVER.SERVER_TUNING, SERVER.SERVER_TUNING);
  });

  test('走/转向：每一步位置、速度、高度与客户端 sim.stepPlayer 完全一致', () => {
    const cmds = [];
    for (let i = 0; i < 90; i++) cmds.push(cmd(i, { my: 1, buttons: BTN.SPRINT }));
    for (let i = 0; i < 30; i++) cmds.push(cmd(90 + i, { mx: 0.4, my: 1, yaw: Math.PI / 3 }));
    const r = runParity(FLAT, { x: 0, y: 0, z: 0, yaw: 0 }, cmds);
    assert.equal(r.firstMismatch, -1);
    assert.equal(r.maxErr, 0);
    assert.ok(Math.hypot(r.srv.pos.x, r.srv.pos.z) > 1);
  });

  test('蹲：按住蹲下、松开站起，姿态高度逐步一致', () => {
    const cmds = [];
    for (let i = 0; i < 60; i++) cmds.push(cmd(i, { my: 1, buttons: BTN.CROUCH }));
    for (let i = 0; i < 30; i++) cmds.push(cmd(60 + i, { mx: 0.5, my: 0.5, yaw: 0.5, buttons: BTN.CROUCH }));
    for (let i = 0; i < 30; i++) cmds.push(cmd(90 + i, { my: 1 }));
    const r = runParity(FLAT, { x: 0, y: 0, z: 0, yaw: 0 }, cmds);
    assert.equal(r.firstMismatch, -1);
    assert.equal(r.maxErr, 0);
    assert.equal(r.flags.crouch, true);
    assert.equal(r.srv.crouching, false);
    assert.equal(r.srv.height, DEFAULT.standHeight);
  });

  test('跳：跳跃边沿、滞空/落地高度与客户端逐步一致', () => {
    const cmds = [];
    for (let i = 0; i < 20; i++) cmds.push(cmd(i, { my: 1 }));
    cmds.push(cmd(20, { my: 1, buttons: BTN.JUMP }));
    for (let i = 0; i < 70; i++) cmds.push(cmd(21 + i, { my: 1 }));
    const r = runParity(FLAT, { x: 0, y: 0, z: 0, yaw: 0 }, cmds);
    assert.equal(r.firstMismatch, -1);
    assert.equal(r.maxErr, 0);
    assert.equal(r.flags.jump, true);
    assert.ok(r.srv.pos.y >= -1e-9);
  });

  test('滑铲：冲刺中按下蹲触发滑铲，slideT/高度/位置逐步一致', () => {
    const cmds = [];
    for (let i = 0; i < 120; i++) cmds.push(cmd(i, { my: 1, buttons: BTN.SPRINT }));
    cmds.push(cmd(120, { my: 1, buttons: BTN.SPRINT | BTN.CROUCH }));
    for (let i = 0; i < 45; i++) cmds.push(cmd(121 + i, { my: 1, buttons: BTN.SPRINT | BTN.CROUCH }));
    for (let i = 0; i < 20; i++) cmds.push(cmd(166 + i, { my: 1 }));
    const r = runParity(FLAT, { x: 0, y: 0, z: 0, yaw: 0 }, cmds);
    assert.equal(r.firstMismatch, -1);
    assert.equal(r.maxErr, 0);
    assert.equal(r.flags.slide, true);
  });

  test('翻越：朝向低掩体跳跃时触发 vault，逐步状态一致', () => {
    const cmds = [];
    for (let i = 0; i < 80; i++) cmds.push(cmd(i, { my: 1, buttons: i === 28 ? BTN.JUMP : 0 }));
    const r = runParity(VAULT_MAP, { x: 0, y: 0, z: 0, yaw: 0 }, cmds);
    assert.equal(r.firstMismatch, -1);
    assert.equal(r.maxErr, 0);
    assert.equal(r.flags.vault, true);
    assert.ok(r.srv.pos.z < -3, '翻越后应越过 z=-3 的掩体');
  });

  test('模拟时钟按 tick 递进（追帧多步逐次 +STEP_MS，不冻结）', () => {
    const stepMs = 1000 / 60;
    assert.equal(SERVER.simTimeForTick(0), 0);
    assert.ok(Math.abs(SERVER.simTimeForTick(1) - stepMs) < 1e-9);
    assert.ok(Math.abs(SERVER.simTimeForTick(5) - stepMs * 5) < 1e-9);
    const a = SERVER.advanceSimClock();
    const b = SERVER.advanceSimClock();
    const c = SERVER.advanceSimClock();
    assert.ok(b > a && c > b);
    assert.ok(Math.abs(b - a - stepMs) < 1e-9);
    assert.ok(Math.abs(c - b - stepMs) < 1e-9);
  });
});
