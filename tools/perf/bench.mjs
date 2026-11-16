#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/perf/bench.mjs — V41 性能测量（四图 / 三档）
   ---------------------------------------------------------------------
   用法：
     node tools/perf/bench.mjs [--quality medium] [--maps harbor,depot,ship,core]
                               [--frames 120] [--file game.html] [--tag medium]
                               [--out bench/perf_medium.json]
   口径：
     · 1600x900 / DPR 2 / Metal（可用 SX_GPU=sw 回退）
     · 每图先切图并等 90 帧稳定，再同步渲染 N 帧（每帧转 2°），
       每帧 gl.finish + readPixels 把 GPU 时间算进去。
     · 同时记录 draw calls / triangles / 分辨率 / 可见点光源 / pageerror。
   本脚本只读测量，不改游戏状态（god + 清敌人，避免 AI 干扰）。
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS, GPU_MODE } from '../pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const QUALITY = arg('quality', 'medium');
const MAPS = arg('maps', 'harbor,depot,ship,core').split(',').filter(Boolean);
const FRAMES = Math.max(24, parseInt(arg('frames', '120'), 10) || 120);
const FILE = path.resolve(ROOT, arg('file', 'game.html'));
const TAG = arg('tag', QUALITY);
const OUT = path.resolve(ROOT, arg('out', 'bench/perf_' + TAG + '.json'));
const DYN = arg('dynres', '0');
const W = parseInt(arg('w', '1600'), 10), H = parseInt(arg('h', '900'), 10), DPR = parseFloat(arg('dpr', '2'));

const url = 'file://' + FILE + '?q=' + QUALITY + '&noaudio=1&autostart=1&dynres=' + DYN;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: PW_ARGS
});
const out = { tag: TAG, quality: QUALITY, url, viewport: [W, H, DPR], gpu: GPU_MODE, maps: {}, errors: [] };
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
page.on('pageerror', (e) => out.errors.push(String((e && e.message) || e).slice(0, 300)));

const stat = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  const avg = s.reduce((x, y) => x + y, 0) / Math.max(1, s.length);
  return {
    avg: +avg.toFixed(2),
    p50: +s[s.length >> 1].toFixed(2),
    p95: +s[Math.floor(s.length * 0.95)].toFixed(2),
    max: +s[s.length - 1].toFixed(2),
    min: +s[0].toFixed(2)
  };
};

try {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => (window.__ready === true && !!window.__SX) || window.__fatal, null, { timeout: 300000 });
  out.readyMs = Date.now() - t0;
  out.env = await page.evaluate(() => {
    const G = window.__G, gl = G.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    try { if (G.game.state !== 'playing') G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
    return {
      label: window.__VERSION_LABEL,
      build: window.__BUILD__,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?',
      quality: G.quality && G.quality.name,
      lights: window.__SX_LIGHTS ? window.__SX_LIGHTS.stats() : null
    };
  });
  console.log('[ready] ' + out.readyMs + 'ms ' + JSON.stringify(out.env.quality) + ' ' + out.env.gpu);

  for (const id of MAPS) {
    const tSwitch = Date.now();
    await page.evaluate(async (id) => {
      if (window.__SX.mapId() !== id) await window.__SX.switchMap(id);
      window.__f0 = window.__frames;
    }, id);
    await page.waitForFunction(() => window.__frames - window.__f0 > 90, null, { timeout: 180000 });
    const switchMs = Date.now() - tSwitch;

    const res = await page.evaluate(({ id, N }) => {
      const G = window.__G, gl = G.renderer.getContext(), R = G.render;
      try { G.enemies.clear(); } catch (e) {}
      const gm = window.__SX_MAPS_DATA.maps[id];
      const p = gm.spawns.player.pos;
      const px = new Uint8Array(4);
      const cam = G.camera;
      cam.rotation.order = 'YXZ';
      const cpu = [], total = [], calls = [], tris = [], lights = [];
      const run = (i, rec) => {
        cam.position.set(p[0], p[1] + 1.6, p[2]);
        cam.rotation.set(0, (i / N) * Math.PI * 2, 0);
        const t0 = performance.now();
        R.frame(1 / 60);
        const t1 = performance.now();
        gl.finish();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const t2 = performance.now();
        if (rec) {
          cpu.push(t1 - t0); total.push(t2 - t0);
          const s = R.stats(); calls.push(s.calls); tris.push(s.tris);
          if (window.__SX_LIGHTS) { const l = window.__SX_LIGHTS.stats(); lights.push(l.visible); }
        }
      };
      for (let i = 0; i < 60; i++) run(i * 2, false);
      for (let i = 0; i < N; i++) run(i, true);
      const lightStats = window.__SX_LIGHTS ? window.__SX_LIGHTS.stats() : null;
      return {
        cpu: (function (a) { const s = a.slice().sort((x, y) => x - y), n = s.length; return { avg: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2), p50: +s[n >> 1].toFixed(2), p95: +s[Math.floor(n * 0.95)].toFixed(2), max: +s[n - 1].toFixed(2) }; })(cpu),
        total: (function (a) { const s = a.slice().sort((x, y) => x - y), n = s.length; return { avg: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2), p50: +s[n >> 1].toFixed(2), p95: +s[Math.floor(n * 0.95)].toFixed(2), max: +s[n - 1].toFixed(2) }; })(total),
        calls: (function (a) { const s = a.slice().sort((x, y) => x - y); return { p50: s[s.length >> 1], max: s[s.length - 1] }; })(calls),
        tris: (function (a) { const s = a.slice().sort((x, y) => x - y); return { p50: s[s.length >> 1], max: s[s.length - 1] }; })(tris),
        res: R.stats().res,
        lights: lightStats,
        lightCurve: { min: Math.min.apply(null, lights), max: Math.max.apply(null, lights) },
        mem: { geos: G.renderer.info.memory.geometries, tex: G.renderer.info.memory.textures, programs: G.renderer.info.programs ? G.renderer.info.programs.length : 0 }
      };
    }, { id, N: FRAMES });
    out.maps[id] = { switchMs, ...res };
    console.log('[' + TAG + '] ' + id.padEnd(6) + ' sync avg ' + String(res.total.avg).padStart(6) + ' ms  p95 ' + String(res.total.p95).padStart(6) + '  cpu ' + String(res.cpu.avg).padStart(5) + '  calls ' + res.calls.p50 + '  tris ' + res.tris.p50 + '  res ' + res.res.join('x') + '  lights ' + (res.lights ? res.lights.visible : '?') + '  switch ' + switchMs + 'ms');
  }
} catch (e) {
  out.fatal = String((e && e.stack) || e);
  console.log('FATAL ' + out.fatal);
}
out.errors = out.errors.concat((await page.evaluate(() => (window.__errors || []).slice(0, 20)).catch(() => [])));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('[json] ' + OUT);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(out.fatal ? 1 : 0);
