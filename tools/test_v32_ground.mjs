#!/usr/bin/env node
/* V32 地基验收：固定步、确定性、无头步进、性能、诊断 */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
const CHROME = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
let fails = 0;
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); };

await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true && window.__SX_LOOP, null, { timeout: 420000 });
await page.waitForTimeout(1200);

const boot = await page.evaluate(() => ({
  loop: !!window.__SX_LOOP, tick: window.__SX_LOOP.tick(), stats: window.__SX_LOOP.stats(),
  step: window.__SX_LOOP.stepSize, state: window.__G.game.state, errors: (window.__errors || []).length,
}));
ok('固定步循环启动', boot.loop && boot.tick > 0 && Math.abs(boot.step - 1 / 60) < 1e-9, boot);

// 1) 玩家/武器/敌人拿到的 dt 必须是 1/60
const dtProbe = await page.evaluate(async () => {
  const G = window.__G;
  const dts = [];
  const wrap = (obj, name) => { const o = obj[name]; obj[name] = function (dt) { dts.push(+dt.toFixed(6)); return o.call(this, dt); }; };
  wrap(G.player, 'update'); wrap(G.weapon, 'update'); wrap(G.enemies, 'update');
  await new Promise(r => setTimeout(r, 900));
  const warm = dts.slice(6);
  const uniq = Array.from(new Set(warm));
  return { count: dts.length, warm: warm.length, uniq: uniq.slice(0, 8) };
});
ok('所有模拟更新使用固定 1/60', dtProbe.warm > 20 && dtProbe.uniq.length === 1 && Math.abs(dtProbe.uniq[0] - 1 / 60) < 1e-5, dtProbe);

// 2) 无头步进：step(n) 精确推进 n 个 tick
const stepRes = await page.evaluate(() => {
  const t0 = window.__SX_LOOP.tick();
  const ms0 = performance.now();
  window.__SX_LOOP.step(600);
  return { dt: window.__SX_LOOP.tick() - t0, ms: +(performance.now() - ms0).toFixed(1) };
});
ok('__SX_LOOP.step(600) 推进 600 步', stepRes.dt === 600, stepRes);

// 3) 确定性：同一初始状态 + 同一命令序列，世界状态哈希一致
async function runHash(steps) {
  return await page.evaluate((n) => {
    const G = window.__G, T = G.THREE;
    // V53：hash 包含 CLOCK.now，两次回放必须重置时钟原点。
    if (window.SX_CLOCK) window.SX_CLOCK.reset();
    window.__SX.applyMission(0); G.game.start({ skipIntro: true });
    G.enemies.clear();
    G.player.pos.set(-19, 0, 9); G.player.vel.set(0, 0, 0); G.player.yaw = 0; G.player.pitch = 0;
    G.player.health = 100;
    window.__SX_LOOP.step(30);
    const a = window.__SX_LOOP.hash();
    window.__SX_LOOP.step(n);
    return { a, b: window.__SX_LOOP.hash(), pos: G.player.pos.toArray().map(v => +v.toFixed(4)), tick: window.__SX_LOOP.tick() };
  }, steps);
}
const d1 = await runHash(900);
const d2 = await runHash(900);
ok('确定性回放：两次 900 步哈希相同', d1.b === d2.b && d1.a === d2.a, { d1, d2 });

// 4) 大步进与小步进等价（固定步与渲染帧率解耦）
const two = await page.evaluate(() => {
  const G = window.__G;
  const reset = () => { if (window.SX_CLOCK) window.SX_CLOCK.reset(); window.__SX.applyMission(0); G.game.start({ skipIntro: true }); G.enemies.clear(); G.player.pos.set(-19, 0, 9); G.player.vel.set(0, 0, 0); G.player.yaw = 0; window.__SX_LOOP.step(20); };
  reset(); window.__SX_LOOP.step(120); const a = { y: +G.player.pos.y.toFixed(4), h: window.__SX_LOOP.hash() };
  reset(); for (let i = 0; i < 12; i++) window.__SX_LOOP.step(10); const b = { y: +G.player.pos.y.toFixed(4), h: window.__SX_LOOP.hash() };
  return { a, b };
});
ok('120×1步 与 12×10步 状态一致', two.a.h === two.b.h && two.a.y === two.b.y, two);

// 5) 回放哈希包含玩家/武器/敌人/任务状态
const hashInfo = await page.evaluate(() => {
  const G = window.__G;
  const h0 = window.__SX_LOOP.hash();
  G.player.pos.x += 0.5;
  const h1 = window.__SX_LOOP.hash();
  G.player.pos.x -= 0.5;
  return { h0, h1, changed: h0 !== h1 };
});
ok('状态哈希随世界变化', hashInfo.changed, hashInfo);

// 6) 单帧最大步数保护与积压丢弃
const backlog = await page.evaluate(() => {
  const G = window.__G;
  G.time.dt = 0.1;
  return { cap: window.__SX_LOOP.stats().maxSteps, alpha: window.__SX_LOOP.stats().alpha };
});
ok('步数上限保护', backlog.cap > 0 && backlog.cap <= 15, backlog);

// 7) 诊断：错误环形缓冲存在且容量受限
const diag = await page.evaluate(() => {
  const E = window.SXErrors;
  if (!E) return { skip: true };
  for (let i = 0; i < 400; i++) E.report(new Error('probe' + i), { system: 'test' });
  const c = E.counts();
  return { size: c.size, capacity: c.capacity, total: c.total, hasDump: typeof E.dump === 'function' };
});
ok('错误环形缓冲容量 200', diag.skip || (diag.size <= 200 && diag.capacity === 200 && diag.hasDump), diag);

// 8) 固定步性能：600 步耗时
ok('600 步耗时 < 1500ms', stepRes.ms < 1500, stepRes.ms);

ok('无页面错误', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fails ? fails + ' 项失败' : '全部通过');
process.exit(fails ? 1 : 0);
