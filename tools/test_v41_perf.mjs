#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v41_perf.mjs — V41 性能回归
   ---------------------------------------------------------------------
   验收项：
     1. 四图 medium 同步帧时间 ≤ 16.7ms（1600x900@2x / Metal，可用
        SX_PERF_LIMIT 覆盖；CI 软件渲染请显式放宽）。
     2. 任何时刻参与着色的点光源 ≤ 12，且四图恒定（固定灯池）。
     3. 相对 V40 基线：depot/core 至少快 50%，harbor ≥ 10%，ship ≥ 30%。
     4. 连续 60 帧后着色器程序数不因灯数变化而增长（≤ +2）。
     5. 动态分辨率 scale 0.6 时，渲染分辨率确实变小（P2-1 修复）。
     6. 无 pageerror / window.__errors。
   页面：SX_TARGET（默认 game.html）
   基线：bench/v40_baseline.json（SX_BASELINE 可覆盖）
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS, GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET = path.resolve(ROOT, process.env.SX_TARGET || 'game.html');
const BASE = path.resolve(ROOT, process.env.SX_BASELINE || 'bench/v40_baseline.json');
const LIMIT = +(process.env.SX_PERF_LIMIT || 16.7);
const MAPS = ['harbor', 'depot', 'ship', 'core'];
const FRAMES = 60;

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: PW_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
const url = 'file://' + TARGET + '?q=medium&noaudio=1&autostart=1&dynres=0';
console.log('[v41-perf] target=' + TARGET + ' gpu=' + GPU_MODE + ' limit=' + LIMIT + 'ms');

try {
  await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => (window.__ready === true && !!window.__SX) || window.__fatal, null, { timeout: 420000 });
  await page.evaluate(() => {
    try { if (window.__G.game.state !== 'playing') window.__G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
  });

  const env = await page.evaluate(() => ({
    label: window.__VERSION_LABEL,
    build: window.__BUILD__ && window.__BUILD__.profile,
    quality: window.__G.quality && window.__G.quality.name,
    autoQuality: window.__G.autoQuality,
    lightsApi: !!window.__SX_LIGHTS,
    pool: window.__SX_LIGHTS ? window.__SX_LIGHTS.stats().pool : null
  }));
  ok('构建为 V41+ 且暴露 __SX_LIGHTS', /V4[1-9]/.test(env.label) && env.lightsApi, env);
  ok('?q=medium 不被自动画质改写（autoQuality=false）', env.autoQuality === false, { autoQuality: env.autoQuality });

  const results = {};
  for (const id of MAPS) {
    await page.evaluate(async (id) => {
      if (window.__SX.mapId() !== id) await window.__SX.switchMap(id);
      window.__f0 = window.__frames;
    }, id);
    await page.waitForFunction(() => window.__frames - window.__f0 > 60, null, { timeout: 180000 });
    results[id] = await page.evaluate(({ id, N }) => {
      const G = window.__G, gl = G.renderer.getContext(), R = G.render;
      try { G.enemies.clear(); } catch (e) {}
      const p = window.__SX_MAPS_DATA.maps[id].spawns.player.pos;
      const cam = G.camera, px = new Uint8Array(4);
      cam.rotation.order = 'YXZ';
      const total = [], calls = [], tris = [], lightCounts = [];
      const frame = (i, rec) => {
        cam.position.set(p[0], p[1] + 1.6, p[2]);
        cam.rotation.set(0, (i / N) * Math.PI * 2, 0);
        const t0 = performance.now();
        R.frame(1 / 60);
        gl.finish();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const t1 = performance.now();
        if (rec) {
          total.push(t1 - t0);
          const s = R.stats(); calls.push(s.calls); tris.push(s.tris);
          if (window.__SX_LIGHTS) lightCounts.push(window.__SX_LIGHTS.stats().sceneLights);
        }
      };
      for (let i = 0; i < 40; i++) frame(i * 3, false);
      const programs0 = G.renderer.info.programs.length;
      for (let i = 0; i < N; i++) frame(i, true);
      const programs1 = G.renderer.info.programs.length;
      const st = (a) => { const s = a.slice().sort((x, y) => x - y); return { avg: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
      const lights = window.__SX_LIGHTS ? window.__SX_LIGHTS.stats() : null;
      return { total: st(total), calls: calls[calls.length >> 1], tris: tris[tris.length >> 1], res: R.stats().res, lights, lightCounts, programs: [programs0, programs1], scale: R.adaptive ? R.adaptive.scale : null };
    }, { id, N: FRAMES });
    const r = results[id];
    console.log('[' + id.padEnd(6) + '] ' + r.total.avg.toFixed(2) + ' ms  p95 ' + r.total.p95 + '  calls ' + r.calls + '  res ' + r.res.join('x') + '  lights ' + (r.lights ? r.lights.sceneLights : '?') + '  records ' + (r.lights ? r.lights.records : '?') + '  programs ' + r.programs.join('→'));
  }

  console.log('\n=== 1 · 同步帧时间 ===');
  for (const id of MAPS) {
    const r = results[id];
    const b = base.four_maps_ms[id];
    const gain = b ? (1 - r.total.avg / b) * 100 : 0;
    console.log('  ' + id.padEnd(6) + ' ' + String(b).padStart(7) + ' → ' + String(r.total.avg).padStart(6) + ' ms  (' + gain.toFixed(1) + '% ↓)');
    ok(id + ' · 同步帧时间 ≤ ' + LIMIT + 'ms', r.total.avg <= LIMIT, { avg: r.total.avg, p95: r.total.p95, limit: LIMIT });
  }
  ok('depot 至少快 50%', results.depot.total.avg <= base.four_maps_ms.depot * 0.5, { before: base.four_maps_ms.depot, after: results.depot.total.avg });
  ok('core 至少快 50%', results.core.total.avg <= base.four_maps_ms.core * 0.5, { before: base.four_maps_ms.core, after: results.core.total.avg });
  ok('ship 至少快 30%', results.ship.total.avg <= base.four_maps_ms.ship * 0.7, { before: base.four_maps_ms.ship, after: results.ship.total.avg });
  ok('harbor 至少快 10%', results.harbor.total.avg <= base.four_maps_ms.harbor * 0.9, { before: base.four_maps_ms.harbor, after: results.harbor.total.avg });

  console.log('\n=== 2 · 点光源预算 ===');
  for (const id of MAPS) {
    const l = results[id].lights;
    const counts = results[id].lightCounts;
    const constant = counts.every((n) => n === counts[0]);
    ok(id + ' · 点光源 ≤ 12 且恒定', !!l && l.pool === 8 && l.sceneLights <= 12 && constant, { pool: l && l.pool, sceneLights: l && l.sceneLights, counts: Array.from(new Set(counts)) });
  }

  console.log('\n=== 3 · 着色器程序稳定 ===');
  for (const id of MAPS) {
    const d = results[id].programs[1] - results[id].programs[0];
    ok(id + ' · 连续 60 帧程序数不增长（≤ +2）', d <= 2, { programs: results[id].programs, delta: d });
  }

  console.log('\n=== 4 · 动态分辨率（P2-1） ===');
  const dyn = await page.evaluate(() => {
    const R = window.__G.render;
    R.adaptive.scale = 1; R.resize();
    const full = R.stats().res.slice();
    R.adaptive.scale = 0.6; R.resize();
    const low = R.stats().res.slice();
    R.adaptive.scale = 1; R.resize();
    return { full, low, enabled: R.adaptive.enabled };
  });
  ok('scale 0.6 时渲染分辨率小于满分辨率（每级真正生效）', dyn.low[0] < dyn.full[0] * 0.8, dyn);

  console.log('\n=== 5 · 无错误 ===');
  const pageErrs = await page.evaluate(() => (window.__errors || []).slice(0, 10));
  ok('无 pageerror', errors.length === 0, errors.slice(0, 3));
  ok('window.__errors 为空', pageErrs.length === 0, pageErrs);
} catch (e) {
  fail++;
  console.log('FAIL · 测试异常 — ' + ((e && e.stack) || e));
} finally {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
}
console.log('\n----------------------------------------');
console.log('PASS ' + pass + ' · FAIL ' + fail);
console.log(fail ? '结果：失败' : '结果：全部通过');
process.exit(fail ? 1 : 0);
