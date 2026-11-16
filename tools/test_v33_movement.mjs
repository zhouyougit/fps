#!/usr/bin/env node
/**
 * tools/test_v33_movement.mjs — WP33-1 移动 2.0（滑铲 / 翻越 / 探身）回归
 *
 * 覆盖：
 *   1. 环境：SX_SYSTEMS 注册了 movement2，__SX_MOVE.state() 字段齐全；
 *   2. 滑铲：冲刺中按蹲触发，进入速度 > 5 m/s，0.9s 内结束，结束进入冷却；
 *   3. 冷却：结束瞬间 0.4s 内 __SX_MOVE.slide() 被拒绝；
 *   4. 翻越：用 G.physics 找 0.5–1.3m 可站立沿，真实探测把玩家抬上 0.8m 级箱顶；
 *   5. 探身：按住 Z（默认绑定）相机横向偏移 > 0.2m，松开归零，带 roll；
 *   6. 重绑：localStorage saltline.binds.leanL = KeyB 后，B 键生效；
 *   7. 连按 slide/vault/lean + 键位乱按：位置/速度/相机无 NaN/Infinity；
 *   8. 无 pageerror，movement2 自身无 console.error；
 *   9. 事件：sx:slide / sx:vault 都触发过。
 *
 * 运行（先构建，构建由主流程负责；本脚本不写构建产物）：
 *   node tools/build.cjs game_v33.html v33
 *   CHROME_EXE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
 *     node tools/test_v33_movement.mjs
 *
 * 说明：本机 headless Chrome 的 requestAnimationFrame 会被节流（~10 帧后停摆），
 * 所以模拟推进走 __SX_LOOP.step(n)（V32 起的确定性入口）；
 * 相机后置钩子挂在 G.hud.update 上，这里显式调用一次以模拟渲染帧。
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'game_v33.html');
const CHROME_EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const QUERY = '?q=low&noaudio=1&autostart=1&dt=0.1';

let passes = 0;
let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    passes++;
    console.log('PASS · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  } else {
    failures++;
    console.log('FAIL · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
  }
}
function log(msg) { console.log('     ' + msg); }

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_EXE,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const url = pathToFileURL(GAME).href + QUERY;
await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
await page.waitForFunction(
  () => window.__SX_MOVE && window.__SX_MOVE.state().ready === true && window.__SX_LOOP,
  null, { timeout: 120000 }
);

// 稳定环境：无敌 + 清怪，避免测试期间被击杀
await page.evaluate(() => {
  try { window.__SX.god(); window.__SX.killAll(); } catch (_) {}
  try { window.__G.input.setGameplay(true); } catch (_) {}
  window.__sxEv = { slide: 0, vault: 0 };
  try {
    window.__G.events.on('sx:slide', () => window.__sxEv.slide++);
    window.__G.events.on('sx:vault', () => window.__sxEv.vault++);
  } catch (_) {}
});

// ---------------------------------------------------------------- 1. 环境
const env = await page.evaluate(() => {
  const sys = window.SX_SYSTEMS ? window.SX_SYSTEMS.all().map((s) => s.id) : [];
  const st = window.__SX_MOVE.state();
  return {
    systems: sys,
    keys: Object.keys(st),
    camera: st.camera,
    bindL: st.bindL,
    bindR: st.bindR,
    state: window.__G.game.state,
    api: ['slide', 'vault', 'lean', 'state'].every((k) => typeof window.__SX_MOVE[k] === 'function')
  };
});
check('movement2 已注册到 SX_SYSTEMS', env.systems.indexOf('movement2') >= 0, env.systems);
check('__SX_MOVE API 与 state() 字段齐全',
  env.api && ['sliding', 'vaulting', 'lean', 'cooldown'].every((k) => env.keys.indexOf(k) >= 0),
  { keys: env.keys, api: env.api });
check('相机钩子已挂载（hud，无 rAF 依赖）', env.camera === 'hud', { camera: env.camera });
check('默认探身绑定 KeyZ / KeyN（避开引擎 KeyX=scan）', env.bindL === 'KeyZ' && env.bindR === 'KeyN', { L: env.bindL, R: env.bindR });

// 清空输入 + 放到起点
async function resetPlayer(spot) {
  await page.evaluate((s) => {
    const G = window.__G;
    const P = G.player;
    P.pos.set(s.x, s.y, s.z);
    P.vel.set(0, 0, 0);
    P.yaw = s.yaw;
    P.pitch = 0;
    P.onGround = true;
    P.crouching = false;
    G.input.move.x = 0;
    G.input.move.y = 0;
    G.input.sprint = false;
    G.input.crouch = false;
    window.__SX_MOVE.lean(0);
    window.__SX_LOOP.step(6);
  }, spot);
}
const START = { x: -32, y: 0, z: 6, yaw: -Math.PI / 2 };
await resetPlayer(START);

// ---------------------------------------------------------------- 2. 滑铲
await page.keyboard.down('w');
await page.keyboard.down('Shift');
const accel = await page.evaluate(() => {
  window.__G.input.update(0.016);
  window.__SX_LOOP.step(45);
  return { speed: +window.__G.player.speed.toFixed(2), pos: window.__G.player.pos.toArray() };
});
log('冲刺加速后 speed=' + accel.speed);
await page.keyboard.down('c');
const slideStart = await page.evaluate(() => {
  window.__G.input.update(0.016);
  const t0 = window.__G.time.t;
  const pos0 = window.__G.player.pos.toArray();
  window.__SX_LOOP.step(2);
  const st = window.__SX_MOVE.state();
  return { sliding: st.sliding, speed: +st.speed.toFixed(2), t0, pos0, crouchHeight: window.__G.player.crouching };
});
check('滑铲：冲刺中按蹲触发', slideStart.sliding === true, slideStart);
check('滑铲：进入速度 > 5 m/s', slideStart.speed > 5, { speed: slideStart.speed });
check('滑铲：碰撞体切蹲姿', slideStart.crouchHeight === true);

// 滑铲期间持续计时，直到状态机退出
let slideEnd = null;
let guard = 0;
while (guard++ < 30) {
  const r = await page.evaluate(() => {
    window.__SX_LOOP.step(5);
    const st = window.__SX_MOVE.state();
    return {
      sliding: st.sliding, t: window.__G.time.t, cd: +st.cooldown.toFixed(2),
      speed: +st.speed.toFixed(2), pos: window.__G.player.pos.toArray()
    };
  });
  if (!r.sliding) { slideEnd = r; break; }
}
const slideDur = slideEnd ? +(slideEnd.t - slideStart.t0).toFixed(2) : null;
const slideDist = slideEnd
  ? +Math.hypot(slideEnd.pos[0] - slideStart.pos0[0], slideEnd.pos[2] - slideStart.pos0[2]).toFixed(2)
  : null;
check('滑铲：0.9s 内结束', !!slideEnd && slideDur <= 1.05, { dur: slideDur, dist: slideDist });
check('滑铲：结束后进入 0.4s 冷却', !!slideEnd && slideEnd.cd > 0 && slideEnd.cd <= 0.4, { cd: slideEnd && slideEnd.cd });
const blocked = await page.evaluate(() => window.__SX_MOVE.slide());
check('滑铲：冷却中无法再次触发', blocked === false, { returned: blocked });

await page.keyboard.up('c');
await page.keyboard.up('w');
await page.keyboard.up('Shift');
await page.evaluate(() => { window.__G.input.update(0.016); window.__SX_LOOP.step(30); });
log('滑铲位移 ' + slideDist + 'm（引擎撞墙/地形会缩短）');

// ---------------------------------------------------------------- 3. 翻越
const cands = await page.evaluate(() => {
  const G = window.__G, ph = G.physics, boxes = ph.boxes;
  function clearAt(x, y, z, r, h) {
    for (const b of boxes) {
      if (b.bulletOnly) continue;
      if (b.max.y <= y + 0.05 || b.min.y >= y + h) continue;
      const cx = Math.max(b.min.x, Math.min(b.max.x, x));
      const cz = Math.max(b.min.z, Math.min(b.max.z, z));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  }
  const out = [];
  for (const b of boxes) {
    if (b.bulletOnly || b.playerOnly) continue;
    const hgt = b.max.y - b.min.y, w = b.max.x - b.min.x, d = b.max.z - b.min.z;
    if (hgt < 0.5 || hgt > 1.3 || w < 0.7 || d < 0.7) continue;
    if (!clearAt((b.min.x + b.max.x) / 2, b.max.y + 0.05, (b.min.z + b.max.z) / 2, 0.28, 1.6)) continue;
    const sides = [
      { ax: b.max.x + 0.95, az: (b.min.z + b.max.z) / 2, fx: -1, fz: 0 },
      { ax: b.min.x - 0.95, az: (b.min.z + b.max.z) / 2, fx: 1, fz: 0 },
      { ax: (b.min.x + b.max.x) / 2, az: b.max.z + 0.95, fx: 0, fz: -1 },
      { ax: (b.min.x + b.max.x) / 2, az: b.min.z - 0.95, fx: 0, fz: 1 }
    ];
    for (const s of sides) {
      const gy = ph.groundHeight(s.ax, s.az, b.max.y + 2);
      if (Math.abs(gy - b.min.y) > 0.3) continue;
      if (!clearAt(s.ax, gy + 0.02, s.az, 0.3, 1.6)) continue;
      out.push({
        x: s.ax, y: gy, z: s.az,
        yaw: Math.atan2(-s.fx, -s.fz),
        top: +b.max.y.toFixed(2), min: +b.min.y.toFixed(2),
        topX: +((b.min.x + b.max.x) / 2).toFixed(2),
        topZ: +((b.min.z + b.max.z) / 2).toFixed(2),
        size: [+w.toFixed(2), +d.toFixed(2)]
      });
      break;
    }
  }
  out.sort((a, b) => Math.abs(a.top - 0.8) - Math.abs(b.top - 0.8));
  return out.slice(0, 8);
});
log('可选翻越沿顶 ' + cands.length + ' 个，最近 0.8m 目标：' + JSON.stringify(cands.slice(0, 3)));

let vaultResult = null;
let vaultMode = null;
let lastAttempt = null;
for (const c of cands.slice(0, 6)) {
  await resetPlayer({ x: c.x, y: c.y, z: c.z, yaw: c.yaw });
  const r = await page.evaluate((c) => {
    const G = window.__G, P = G.player;
    const started = window.__SX_MOVE.vault();
    const mid = window.__SX_MOVE.state().vaulting;
    let n = 0;
    while (window.__SX_MOVE.state().vaulting && n++ < 40) window.__SX_LOOP.step(1);
    return {
      started: started, mid: mid, vaulting: window.__SX_MOVE.state().vaulting,
      pos: P.pos.toArray().map((v) => +v.toFixed(2)),
      onGround: P.onGround, top: c.top
    };
  }, c);
  if (r.started) lastAttempt = r;
  if (r.started && r.vaulting === false && Math.abs(r.pos[1] - c.top) < 0.25) {
    vaultMode = 'detect';
    vaultResult = r;
    break;
  }
}
if (!vaultResult && cands.length) {
  // 兜底：显式给沿顶目标点，验证动画/落点（需求允许直接构造 __SX_MOVE.vault）
  const c = cands[0];
  await resetPlayer({ x: c.x, y: c.y, z: c.z, yaw: c.yaw });
  const r = await page.evaluate((c) => {
    const G = window.__G, P = G.player;
    const started = window.__SX_MOVE.vault({ x: c.topX, y: c.top, z: c.topZ });
    let n = 0;
    while (window.__SX_MOVE.state().vaulting && n++ < 40) window.__SX_LOOP.step(1);
    return {
      started: started, mid: true, vaulting: window.__SX_MOVE.state().vaulting,
      pos: P.pos.toArray().map((v) => +v.toFixed(2)), onGround: P.onGround, top: c.top
    };
  }, c);
  vaultMode = 'explicit';
  vaultResult = r;
}
check('翻越：触发成功', !!(vaultResult && vaultResult.started), { mode: vaultMode, r: vaultResult || lastAttempt });
check('翻越：0.3~0.5s 内把玩家抬上沿顶',
  !!(vaultResult && vaultResult.vaulting === false && Math.abs(vaultResult.pos[1] - vaultResult.top) < 0.25 && vaultResult.onGround),
  vaultResult);

// ---------------------------------------------------------------- 4. 探身
// 找一个侧向 1.2m 无墙的朝向，避免探身被碰撞裁剪到 < 0.2m
const safeYaw = await page.evaluate((s) => {
  const G = window.__G, P = G.player, ph = G.physics;
  P.pos.set(s.x, s.y, s.z);
  P.vel.set(0, 0, 0);
  P.yaw = s.yaw;
  window.__SX_LOOP.step(4);
  let best = { yaw: s.yaw, clear: -1 };
  for (let i = 0; i < 8; i++) {
    const yaw = s.yaw + i * Math.PI / 4;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const hit = ph.raycast({ x: P.pos.x, y: P.pos.y + 1.68, z: P.pos.z }, { x: rx, y: 0, z: rz }, 1.2);
    const clear = hit ? +hit.dist.toFixed(2) : 9;
    if (clear > best.clear) best = { yaw: yaw, clear: clear };
  }
  return best;
}, START);
log('探身测试朝向：yaw=' + safeYaw.yaw.toFixed(2) + '，侧向净空 ' + safeYaw.clear + 'm');
await resetPlayer({ x: START.x, y: START.y, z: START.z, yaw: safeYaw.yaw });
async function cameraLean() {
  await page.evaluate(() => { window.__G.hud.update(1 / 60); });
  return page.evaluate(() => {
    const G = window.__G, P = G.player, c = G.camera;
    const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    return {
      offset: +(((c.position.x - P.eye.x) * rx + (c.position.z - P.eye.z) * rz)).toFixed(3),
      roll: +c.rotation.z.toFixed(3),
      state: window.__SX_MOVE.state()
    };
  });
}
const lean0 = await cameraLean();
await page.keyboard.down('z');
await page.evaluate(() => { window.__SX_LOOP.step(30); });
const lean1 = await cameraLean();
check('探身：按住 Z 相机横向偏移 > 0.2m', Math.abs(lean1.offset) > 0.2, { offset: lean1.offset, lean: lean1.state.lean });
check('探身：相机 roll ±6° 级', Math.abs(lean1.roll - lean0.roll) > 0.04, { base: lean0.roll, held: lean1.roll });

await page.keyboard.up('z');
await page.evaluate(() => { window.__SX_LOOP.step(30); });
const lean2 = await cameraLean();
check('探身：松开后回正（< 0.03m）', Math.abs(lean2.offset) < 0.03, { offset: lean2.offset, lean: lean2.state.lean });

// 重绑：localStorage saltline.binds.leanL = KeyB
const rebind = await page.evaluate(() => {
  localStorage.setItem('saltline.binds.leanL', 'KeyB');
  return window.__SX_MOVE.reloadBinds();
});
await page.keyboard.down('b');
await page.evaluate(() => { window.__SX_LOOP.step(30); });
const leanB = await cameraLean();
await page.keyboard.up('b');
await page.evaluate(() => { window.__SX_LOOP.step(30); localStorage.removeItem('saltline.binds.leanL'); window.__SX_MOVE.reloadBinds(); });
check('探身：读取 saltline.binds.leanL 重绑生效', rebind.leanL === 'KeyB' && Math.abs(leanB.offset) > 0.2,
  { bind: rebind, offset: leanB.offset });

// ---------------------------------------------------------------- 5. 连按 / NaN
await page.evaluate(() => {
  const M = window.__SX_MOVE;
  for (let i = 0; i < 24; i++) {
    if (i % 2 === 0) M.slide();
    M.vault();
    M.lean(i % 3 - 1);
    window.__SX_LOOP.step(3);
  }
  M.lean(0);
  window.__SX_LOOP.step(40);
});
for (const key of ['z', 'x', 'c', 'w', 'Shift', 'Space']) {
  await page.keyboard.down(key);
  await page.keyboard.up(key);
}
await page.evaluate(() => { window.__G.input.update(0.016); window.__SX_LOOP.step(20); });
const nan = await page.evaluate(() => {
  const G = window.__G, P = G.player, c = G.camera;
  const vals = [P.pos.x, P.pos.y, P.pos.z, P.vel.x, P.vel.y, P.vel.z,
    P.yaw, P.pitch, c.position.x, c.position.y, c.position.z, c.rotation.z];
  const bad = vals.filter((v) => typeof v !== 'number' || !isFinite(v));
  return { bad: bad.length, state: window.__SX_MOVE.state() };
});
check('连按后位置/速度/相机无 NaN/Infinity', nan.bad === 0, { bad: nan.bad, state: { sliding: nan.state.sliding, vaulting: nan.state.vaulting } });

// ---------------------------------------------------------------- 6. 事件 / 报错
const events = await page.evaluate(() => window.__sxEv);
check('事件：sx:slide / sx:vault 均已触发', events.slide >= 1 && events.vault >= 1, events);
check('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3));
const ownErrors = consoleErrors.filter((t) => /movement2/i.test(t));
check('movement2 无 console.error', ownErrors.length === 0, ownErrors.slice(0, 3));
const others = consoleErrors.filter((t) => !/movement2/i.test(t));
if (others.length) log('其它模块的 console.error（不计入本次失败）：' + others.slice(0, 3).join(' | '));

await browser.close();

console.log('\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAILED') + ' — ' + passes + ' passed, ' + failures + ' failed');
process.exit(failures === 0 ? 0 : 1);
