import { chromium } from 'playwright';
import { PW_ARGS, legacyGame } from './pwargs.mjs';
import { pathToFileURL } from 'node:url';
import fs from 'fs';

const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SX_URL || pathToFileURL(legacyGame('v35')).href + '?q=low&noaudio=1&autostart=1&dt=0.1';
const browser = await chromium.launch({ headless: true, executablePath: exe,
  args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
const cErrs = []; page.on('console', m => { if (m.type() === 'error') cErrs.push(m.text()); });
let fails = 0;
const safe = (v) => { try { return JSON.stringify(v); } catch (e) { return '[unserializable]'; } };
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + safe(d) : '')); };
const step = async (n) => page.evaluate((n) => { try { window.__SX_STEP(n); } catch (e) {} }, n || 5);
const until = async (fn, maxSteps, chunk) => {
  maxSteps = maxSteps || 240; chunk = chunk || 10;
  for (let i = 0; i <= maxSteps; i += chunk) {
    if (await page.evaluate(fn)) return true;
    await step(chunk);
    await page.waitForTimeout(16);
  }
  return !!(await page.evaluate(fn));
};

fs.mkdirSync('versions/screens', { recursive: true });
await page.goto(URL, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });

/* 1. API */
const api = await page.evaluate(() => ({
  has: !!window.__SX_VISUAL,
  keys: window.__SX_VISUAL ? ['quality','stats','setQuality','probes'].filter(k => typeof window.__SX_VISUAL[k] !== 'undefined') : [],
  q: window.__SX_VISUAL && window.__SX_VISUAL.quality,
  aa: window.__SX_VISUAL && window.__SX_VISUAL.stats.aa,
  shadow: window.__SX_VISUAL && window.__SX_VISUAL.stats.shadow
}));
ok('window.__SX_VISUAL 暴露 quality/stats/setQuality/probes', api.has && api.keys.length === 4, api.keys);
ok('低画质默认关闭 TAA，走 FXAA 增强', api.q === 'low' && api.aa === 'fxaa', { q: api.q, aa: api.aa });
ok('两级阴影 22m / 55m，低画质 1024/512', api.shadow && api.shadow.cascades === 2 && api.shadow.near === 22 && api.shadow.far === 55 && api.shadow.nearSize === 1024 && api.shadow.farSize === 512, api.shadow);

/* 2. 质量切换 */
const qh = await page.evaluate(() => window.__SX_VISUAL.setQuality('high'));
await page.waitForTimeout(300);
const qState = await page.evaluate(() => ({
  api: window.__SX_VISUAL.quality,
  engine: window.__G.quality.name,
  shadow: window.__SX_VISUAL.stats.shadow,
  aa: window.__SX_VISUAL.stats.aa,
  aaDebug: { ok: window.__SX_VISUAL.debug.aa.ok, patched: window.__SX_VISUAL.debug.aa.patched, enabled: window.__SX_VISUAL.debug.aa.enabled, hasDepth: !!window.__G.render.depthTexture }
}));
ok('setQuality(high) 同步引擎画质 + 2048/1024 级联', qh.ok && qState.api === 'high' && qState.engine === 'high' && qState.shadow.nearSize === 2048 && qState.shadow.farSize === 1024, qState);
await step(2);
const qHigh = await page.evaluate(() => ({ aa: window.__SX_VISUAL.stats.aa, depth: window.__G.render.depthTexture ? window.__G.render.depthTexture.image : null, adv: window.__G.render.advanced }));
console.log('INFO · high aa=' + qHigh.aa + ' advanced=' + qHigh.adv + ' depth=' + (qHigh.depth ? qHigh.depth.width + 'x' + qHigh.depth.height : 'null'));
await page.evaluate(() => window.__SX_VISUAL.setQuality('low'));
await step(2);

/* 3. 三张图环境探针 */
async function switchAndProbe(id, start) {
  await page.evaluate((s) => {
    window.__SX.switchMap(s.id);
    try { window.__SX.tp(s.x, s.y, s.z); } catch (e) {}
    const G = window.__G;
    if (G.player) { G.player.yaw = 0; G.player.pitch = 0; }
  }, { id, x: start[0], y: start[1], z: start[2] });
  const got = await until(() => {
    const p = window.__SX_VISUAL.probes();
    return p.map === (window.__SX.mapId ? window.__SX.mapId() : p.map) && p.ready >= 1 && p.pending === 0;
  }, 480, 10);
  const info = await page.evaluate(() => window.__SX_VISUAL.probes());
  return { got, info };
}
const depot = await switchAndProbe('depot', [0, 0.03, 13.6]);
ok('冷库环境探针 PMREM 就绪', depot.info.map === 'depot' && depot.info.ready >= 1 && depot.info.count >= 1, depot.info);
await page.waitForTimeout(600);
await page.screenshot({ timeout: 120000, path: 'versions/screens/v35_depot.png' });

const ship = await switchAndProbe('ship', [0, 0.32, 5.2]);
ok('货轮甲板环境探针 PMREM 就绪', ship.info.map === 'ship' && ship.info.ready >= 1 && ship.info.count >= 1, ship.info);
await page.waitForTimeout(600);
await page.screenshot({ timeout: 120000, path: 'versions/screens/v35_ship.png' });

const core = await switchAndProbe('core', [0, 0.42, 9.6]);
ok('核心舱环境探针 PMREM 就绪', core.info.map === 'core' && core.info.ready >= 1 && core.info.count >= 1, core.info);
await page.waitForTimeout(600);
await page.screenshot({ timeout: 120000, path: 'versions/screens/v35_core.png' });

/* 4. 受击闪白 / 死亡碎块 / 护盾破碎 */
const hit = await page.evaluate(() => {
  const G = window.__G;
  try { G.enemies.clear(); } catch (err) {}
  const e = G.enemies.spawn('hound', new G.THREE.Vector3(G.player.pos.x + 4, 0, G.player.pos.z - 3), {});
  if (!e) return { err: 'no enemy', have: G.enemies.list.length };
  e.damage(12, e.pos.clone().add(new G.THREE.Vector3(0, 0.6, 0)), new G.THREE.Vector3(0, 0, -1), 'body');
  return { hp: e.hp, flash: e.__sxFlashT, mats: e.__sxFlashMats ? e.__sxFlashMats.length : 0, id: e.id };
});
const hitFx = await page.evaluate(() => ({ hit: window.__SX_VISUAL.stats.effects.hitFlash, fill: window.__SX_VISUAL.stats.fill.intensity }));
ok('敌人受击闪白 + 材质克隆 + 跟随补光生效', !hit.err && hit.mats > 0 && (hit.flash > 0 || hitFx.hit > 0) && hitFx.fill > 0, { hit, hitFx });
const shards = await page.evaluate(() => {
  const G = window.__G;
  const e = G.enemies.list.find(x => x.alive);
  if (e) G.events.emit('sx:shield-break', { enemy: e, pos: e.pos });
  return { alive: !!e };
});
// V53：冲击环寿命 0.55s，旧断言等 1.5s 后必然为 0（测试时序错误）；事件后立刻推进一帧再读。
const breakFx = await page.evaluate(() => {
  window.__G.render.frame(0.016);
  return { debris: window.__SX_VISUAL.stats.effects.debris, rings: window.__SX_VISUAL.stats.effects.rings };
});
ok('护盾破碎生成碎片 + 冲击环', shards.alive && breakFx.debris >= 8 && breakFx.rings >= 1, breakFx);

/* 5. 300 帧无 pageerror + 帧时间（无头渲染直接同步渲染 300 帧，避免 rAF 节流） */
await page.setViewportSize({ width: 640, height: 360 });
await page.waitForTimeout(200);
const bench = await page.evaluate(() => {
  const G = window.__G;
  const times = [];
  let calls = 0, tris = 0;
  for (let i = 0; i < 300; i++) {
    const t0 = performance.now();
    G.render.frame(0.1);
    times.push(performance.now() - t0);
    calls = G.renderer.info.render.calls;
    tris = G.renderer.info.render.triangles;
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { avg: +avg.toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), calls, tris, n: times.length };
});
ok('300 帧运行无 pageerror', bench.n === 300 && errs.length === 0, { rendered: bench.n, pageerrors: errs.slice(0, 3), avgMs: bench.avg, p95Ms: bench.p95 });

/* 6. F3 */
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true })));
await page.waitForTimeout(120);
const f3 = await page.evaluate(() => {
  const d = document.getElementById('sx-visual-f3');
  return d ? { shown: getComputedStyle(d).display !== 'none', text: d.textContent } : null;
});
ok('F3 可见 draw call / 级联 / 探针', !!f3 && f3.shown && /DC\s+\d+/.test(f3.text) && /SHADOW/.test(f3.text) && /PROBE/.test(f3.text), f3 && f3.text.slice(0, 160));
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true })));

const runtime = await page.evaluate(() => ({ vErrors: window.__SX_VISUAL.errors, calls: window.__SX_VISUAL.stats.calls }));
ok('画面层自身无运行时异常', runtime.vErrors.length === 0, runtime.vErrors);

console.log('---');
console.log(fails ? fails + ' 项失败' : '全部通过');
await browser.close();
process.exit(fails ? 1 : 0);