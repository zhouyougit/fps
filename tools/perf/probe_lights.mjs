#!/usr/bin/env node
/* 灯光预算探针：逐图打印 __SX_LIGHTS 统计、真实 PointLight 数、程序数。
   用法：node tools/perf/probe_lights.mjs [--file game.html] */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from '../pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const file = path.resolve(ROOT, arg('file', 'game.html'));
const quality = arg('quality', 'medium');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
await page.goto('file://' + file + '?q=' + quality + '&noaudio=1&autostart=1&dynres=0', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__SX) || window.__fatal, null, { timeout: 300000 });
await page.evaluate(() => { try { window.__G.game.start({ skipIntro: true }); } catch (e) {} try { window.__SX.god(true); } catch (e) {} });
console.log('env', await page.evaluate(() => ({ label: window.__VERSION_LABEL, lights: !!window.__SX_LIGHTS, stats: window.__SX_LIGHTS && window.__SX_LIGHTS.stats() })));
for (const id of ['harbor', 'depot', 'ship', 'core']) {
  await page.evaluate(async (id) => { if (window.__SX.mapId() !== id) await window.__SX.switchMap(id); window.__f0 = window.__frames; }, id);
  await page.waitForFunction(() => window.__frames - window.__f0 > 30, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const G = window.__G, R = G.render;
    const frameTimes = [];
    for (let i = 0; i < 20; i++) { const t = performance.now(); R.frame(1 / 60); frameTimes.push(performance.now() - t); }
    const s = window.__SX_LIGHTS.stats();
    const scene = [];
    R.scene.traverse((o) => { if (o.isPointLight) { const vis = (function (x) { for (; x; x = x.parent) if (!x.visible) return false; return true; })(o); scene.push({ name: o.name, i: +o.intensity.toFixed(2), vis, parent: (o.parent && (o.parent.name || o.parent.type)) || '' }); } });
    return { map: window.__SX.mapId(), stats: s, programs: G.renderer.info.programs.length, pointLights: scene, frameMs: +(frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length).toFixed(2), res: R.stats().res };
  });
  console.log('== ' + id + ' ' + JSON.stringify(r.stats) + ' programs ' + r.programs + ' frame ' + r.frameMs + 'ms res ' + r.res.join('x'));
  console.log('   points ' + JSON.stringify(r.pointLights));
  for (const m of ['harbor', 'depot', 'ship', 'core']) {
    if (m === id) continue;
    const n = await page.evaluate((m) => (window.__SX_LIGHTS.records ? window.__SX_LIGHTS.records().length : 0), m);
    void n;
  }
}
console.log('errors', errors.slice(0, 5), await page.evaluate(() => (window.__errors || []).slice(0, 5)));
await browser.close();
