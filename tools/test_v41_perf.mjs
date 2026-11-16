#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v41_perf.mjs — V41–V54 性能回归
   ---------------------------------------------------------------------
   验收项（medium，原有断言保持不变）：
     1. 四图 medium 同步帧时间 ≤ 16.7ms（1600x900@2x / Metal，可用
        SX_PERF_LIMIT 覆盖；CI 软件渲染请显式放宽）。
     2. 任何时刻参与着色的点光源 ≤ 12，且四图恒定（固定灯池）。
     3. 相对 V40 基线：depot/core 至少快 50%，harbor ≥ 10%，ship ≥ 30%。
     4. 连续 60 帧后着色器程序数不因灯数变化而增长（≤ +2）。
     5. 动态分辨率 scale 0.6 时，渲染分辨率确实变小（P2-1 修复）。
     6. 无 pageerror / window.__errors。

   V54 · PERF-5 新增 high 档（默认开启，SX_PERF_HIGH=0 可跳过）：
     7. 四图 high 平均帧时间 ≤ 16.7ms（SX_PERF_LIMIT）。
     8. 四图 high p95 ≤ 18.5ms（SX_PERF_P95_HIGH）。
     9. 记录 high 每图 allocKBps，并断言 ≤ 81900KB/s
        （V53 实测 63MB/s × 1.3 = 81.9MB/s，十进制 MB；
        SX_ALLOC_LIMIT_KBPS 可按 lead 的复测值收紧）。
        分配量优先读页面暴露值（__SX_PERF / __G.render.stats().allocKBps /
        __SX_PERF_STATS），页面未暴露时用 CDP HeapProfiler 采样兜底；
        采样不可用时打印 SKIP，不伪造成通过。
    10. 结果写 bench/v54_perf_high.json（SX_PERF_REPORT 覆盖）。

   用法：
     node tools/test_v41_perf.mjs
     SX_PERF_LIMIT=16.7 SX_PERF_P95_HIGH=18.5 node tools/test_v41_perf.mjs
     SX_PERF_HIGH=0 node tools/test_v41_perf.mjs          # 只跑原有 medium
     SX_ALLOC_LIMIT_KBPS=70000 node tools/test_v41_perf.mjs
     SX_ALLOC_SAMPLE_FRAMES=180 node tools/test_v41_perf.mjs
     SX_TARGET=versions/几猫_V54.html node tools/test_v41_perf.mjs
   页面：SX_TARGET（默认 game.html）
   基线：bench/v40_baseline.json（SX_BASELINE 可覆盖）
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser } from './testkit.mjs';
import { GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.env.SX_TARGET || 'game.html';
const TARGET_URL = /^(file|https?):\/\//i.test(TARGET) ? TARGET : 'file://' + path.resolve(ROOT, TARGET);
const BASE = path.resolve(ROOT, process.env.SX_BASELINE || 'bench/v40_baseline.json');
const REPORT = path.resolve(ROOT, process.env.SX_PERF_REPORT || 'bench/v54_perf_high.json');
const LIMIT = +(process.env.SX_PERF_LIMIT || 16.7);
const P95_HIGH = +(process.env.SX_PERF_P95_HIGH || 18.5);
const ALLOC_LIMIT = +(process.env.SX_ALLOC_LIMIT_KBPS || 81900);
const ALLOC_INTERVAL = +(process.env.SX_ALLOC_INTERVAL || 32768);
const ALLOC_FRAMES = +(process.env.SX_ALLOC_SAMPLE_FRAMES || 120);
const RUN_HIGH = process.env.SX_PERF_HIGH !== '0';
const MAPS = ['harbor', 'depot', 'ship', 'core'];
const FRAMES = +(process.env.SX_PERF_FRAMES || 60);

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const report = {
  tool: 'test_v41_perf', version: 'V54', generatedAt: new Date().toISOString(),
  target: TARGET, gpu: GPU_MODE, quality: { medium: 'medium', high: RUN_HIGH ? 'high' : 'skipped' },
  thresholds: { avgMs: LIMIT, highP95Ms: P95_HIGH, allocKBps: ALLOC_LIMIT, allocBaseline: 'V53 63MB/s × 1.3' },
  frames: FRAMES, medium: null, high: null, alloc: null, pass: 0, fail: 0, errors: null
};

const browser = await launchBrowser({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
const url = TARGET_URL + '?q=medium&noaudio=1&autostart=1&dynres=0';
console.log('[v41-perf] target=' + TARGET + ' gpu=' + GPU_MODE + ' limit=' + LIMIT + 'ms highP95=' + P95_HIGH + 'ms allocLimit=' + ALLOC_LIMIT + 'KB/s');
let cdp = null;
try { cdp = await ctx.newCDPSession(page); await cdp.send('HeapProfiler.enable'); } catch (e) { cdp = null; }

/* 采样 profile 按 self bytes 聚合；node.selfSize 是兜底，samples 更精确。 */
function aggregateSampling(profile) {
  const nodes = new Map();
  const walk = (n) => { if (!n) return; nodes.set(n.id, n); const kids = n.children || []; for (let i = 0; i < kids.length; i++) walk(kids[i]); };
  walk(profile && profile.head);
  const byNode = new Map();
  let total = 0, sampleCount = 0;
  if (profile && Array.isArray(profile.samples) && profile.samples.length) {
    for (const s of profile.samples) {
      total += s.size || 0;
      byNode.set(s.nodeId, (byNode.get(s.nodeId) || 0) + (s.size || 0));
      sampleCount++;
    }
  } else {
    for (const n of nodes.values()) {
      const sz = n.selfSize || 0;
      total += sz;
      byNode.set(n.id, sz);
    }
  }
  // 同一 callFrame（函数 + url + 行列）可能对应多个采样节点：
  // 按 callFrame 合并 self bytes，避免 top 列表里同一函数重复出现。
  const byCallFrame = new Map();
  for (const [id, size] of byNode) {
    if (!size) continue;
    const n = nodes.get(id) || {};
    const cf = n.callFrame || {};
    const functionName = cf.functionName || '(anonymous)';
    const url = cf.url || '(native)';
    const line = (cf.lineNumber == null ? -1 : cf.lineNumber + 1);
    const column = (cf.columnNumber == null ? -1 : cf.columnNumber + 1);
    const key = functionName + '\u0000' + url + '\u0000' + line + '\u0000' + column;
    const r = byCallFrame.get(key);
    if (r) r.selfBytes += size;
    else byCallFrame.set(key, { functionName, url, line, column, selfBytes: size });
  }
  const rows = [...byCallFrame.values()];
  rows.sort((a, b) => b.selfBytes - a.selfBytes);
  return { totalBytes: total, sampleCount, rows };
}

function summarizeRows(rows, total, limit) {
  const top = rows.slice(0, limit).map((r) => Object.assign({}, r, {
    selfKB: +(r.selfBytes / 1024).toFixed(1),
    pct: total ? +((r.selfBytes / total) * 100).toFixed(2) : 0
  }));
  const byUrl = new Map();
  for (const r of rows) byUrl.set(r.url, (byUrl.get(r.url) || 0) + r.selfBytes);
  const urls = [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([u, b]) => ({
    url: u, selfBytes: b, selfKB: +(b / 1024).toFixed(1), pct: total ? +((b / total) * 100).toFixed(2) : 0
  }));
  return { top, urls };
}

async function measurePass(id, N) {
  await page.evaluate(async (id) => {
    if (window.__SX.mapId() !== id) await window.__SX.switchMap(id);
    window.__f0 = window.__frames;
  }, id);
  await page.waitForFunction(() => window.__frames - window.__f0 > 60, null, { timeout: 180000 });
  return page.evaluate(({ id, N }) => {
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
  }, { id, N });
}

/* 页面若暴露 allocKBps 直接使用；否则 CDP 采样（这是 V53 63MB/s 同口径兜底）。 */
async function exposedAllocKBps() {
  return page.evaluate(() => {
    const pick = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
    try {
      if (window.__SX_PERF && typeof window.__SX_PERF.allocKBps === 'number') return { source: '__SX_PERF.allocKBps', value: pick(window.__SX_PERF.allocKBps) };
      if (window.__SX_PERF_STATS && typeof window.__SX_PERF_STATS.allocKBps === 'number') return { source: '__SX_PERF_STATS.allocKBps', value: pick(window.__SX_PERF_STATS.allocKBps) };
      if (window.__G && window.__G.render && typeof window.__G.render.stats === 'function') {
        const s = window.__G.render.stats();
        if (s && typeof s.allocKBps === 'number') return { source: '__G.render.stats().allocKBps', value: pick(s.allocKBps) };
      }
    } catch (e) {}
    return { source: null, value: null };
  });
}

async function sampleAlloc(id, frames) {
  if (!cdp) throw new Error('CDP session unavailable');
  await page.evaluate(({ id, N }) => {
    const G = window.__G, gl = G.renderer.getContext(), R = G.render;
    if (window.__SX.mapId() !== id) window.__SX.switchMap(id);
    try { G.enemies.clear(); } catch (e) {}
    const p = window.__SX_MAPS_DATA.maps[id].spawns.player.pos;
    const cam = G.camera, px = new Uint8Array(4);
    cam.rotation.order = 'YXZ';
    for (let i = 0; i < 10; i++) {
      cam.position.set(p[0], p[1] + 1.6, p[2]);
      cam.rotation.set(0, (i / 10) * Math.PI * 2, 0);
      R.frame(1 / 60);
    }
  }, { id, N: frames });
  let profile = null, ms = 0, wall0 = Date.now();
  try {
    await cdp.send('HeapProfiler.startSampling', {
      samplingInterval: ALLOC_INTERVAL,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true
    });
  } catch (e) {
    // 旧版 Chrome 不认识 includeObjects* 参数：退回最小参数。
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: ALLOC_INTERVAL });
  }
  try {
    const m = await page.evaluate(({ id, N }) => {
      const G = window.__G, gl = G.renderer.getContext(), R = G.render;
      const p = window.__SX_MAPS_DATA.maps[id].spawns.player.pos;
      const cam = G.camera, px = new Uint8Array(4);
      cam.rotation.order = 'YXZ';
      const frame = (i) => {
        cam.position.set(p[0], p[1] + 1.6, p[2]);
        cam.rotation.set(0, (i / N) * Math.PI * 2, 0);
        R.frame(1 / 60);
        gl.finish();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      };
      const t0 = performance.now();
      for (let i = 0; i < N; i++) frame(i);
      return { ms: +(performance.now() - t0).toFixed(2), frames: N };
    }, { id, N: frames });
    ms = m.ms;
    const stopped = await cdp.send('HeapProfiler.stopSampling');
    profile = stopped.profile;
  } finally {
    if (!profile) { try { await cdp.send('HeapProfiler.stopSampling'); } catch (e) {} }
  }
  const wallMs = Date.now() - wall0;
  const agg = aggregateSampling(profile);
  const durationMs = ms > 0 ? ms : wallMs;
  const allocKBps = durationMs > 0 ? +(agg.totalBytes / 1024 / (durationMs / 1000)).toFixed(1) : null;
  return {
    id, frames, renderMs: ms, wallMs,
    totalBytes: agg.totalBytes, totalMB: +(agg.totalBytes / 1048576).toFixed(2),
    sampleCount: agg.sampleCount, samplingInterval: ALLOC_INTERVAL,
    allocKBps, allocMBps: allocKBps == null ? null : +(allocKBps / 1024).toFixed(2),
    top: summarizeRows(agg.rows, agg.totalBytes, 10)
  };
}

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
  report.label = env.label;
  report.buildProfile = env.build;
  ok('构建为 V41+ 且暴露 __SX_LIGHTS', /V(4[1-9]|5\d)/.test(env.label) && env.lightsApi, env);
  ok('?q=medium 不被自动画质改写（autoQuality=false）', env.autoQuality === false, { autoQuality: env.autoQuality });

  console.log('\n=== 1 · medium 同步帧时间 ===');
  const results = {};
  for (const id of MAPS) {
    results[id] = await measurePass(id, FRAMES);
    const r = results[id];
    console.log('[' + id.padEnd(6) + '] ' + r.total.avg.toFixed(2) + ' ms  p95 ' + r.total.p95 + '  calls ' + r.calls + '  res ' + r.res.join('x') + '  lights ' + (r.lights ? r.lights.sceneLights : '?') + '  records ' + (r.lights ? r.lights.records : '?') + '  programs ' + r.programs.join('→'));
  }
  report.medium = results;

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

  if (RUN_HIGH) {
    console.log('\n=== 6 · high 档（PERF-5） ===');
    const highEnv = await page.evaluate(() => {
      const before = window.__G.quality && window.__G.quality.name;
      const r = window.__SX_VISUAL ? window.__SX_VISUAL.setQuality('high') : { ok: false, reason: 'no __SX_VISUAL' };
      return { before, result: r, quality: window.__G.quality && window.__G.quality.name, visualQuality: window.__SX_VISUAL && window.__SX_VISUAL.quality };
    });
    ok('high 档切换成功（__SX_VISUAL.quality=high）', !!highEnv.result && highEnv.result.ok === true && highEnv.visualQuality === 'high', highEnv);
    await page.evaluate(() => {
      const R = window.__G.render;
      for (let i = 0; i < 24; i++) R.frame(1 / 60);
    });
    const highResults = {};
    for (const id of MAPS) {
      highResults[id] = await measurePass(id, FRAMES);
      const r = highResults[id];
      console.log('[' + id.padEnd(6) + '] high ' + r.total.avg.toFixed(2) + ' ms  p95 ' + r.total.p95 + '  max ' + r.total.max + '  calls ' + r.calls + '  res ' + r.res.join('x') + '  programs ' + r.programs.join('→'));
    }
    report.high = highResults;
    for (const id of MAPS) {
      const r = highResults[id];
      ok(id + ' · high 平均帧时间 ≤ ' + LIMIT + 'ms', r.total.avg <= LIMIT, { avg: r.total.avg, p95: r.total.p95, limit: LIMIT });
      ok(id + ' · high p95 ≤ ' + P95_HIGH + 'ms', r.total.p95 <= P95_HIGH, { p95: r.total.p95, limit: P95_HIGH });
    }

    console.log('\n=== 7 · high 分配量（PERF-5） ===');
    const exposed = await exposedAllocKBps();
    report.alloc = { source: exposed.source || 'cdp-sampling', limitKBps: ALLOC_LIMIT, maps: {}, exposed: exposed.value };
    for (const id of MAPS) {
      let a = null;
      if (exposed.value != null) {
        a = { id, source: exposed.source, allocKBps: exposed.value, allocMBps: +(exposed.value / 1024).toFixed(2), renderMs: null, totalBytes: null, sampleCount: null, top: null };
      } else {
        try { a = await sampleAlloc(id, ALLOC_FRAMES); a.source = 'cdp-sampling'; }
        catch (e) { a = { id, source: 'cdp-sampling', error: String((e && e.stack) || e) }; }
      }
      report.alloc.maps[id] = a;
      if (a && a.allocKBps != null) {
        console.log('[' + id.padEnd(6) + '] alloc ' + a.allocKBps + ' KB/s (' + a.allocMBps + ' MB/s)  samples ' + a.sampleCount + '  ' + a.source);
        ok(id + ' · high allocKBps ≤ ' + ALLOC_LIMIT + 'KB/s', a.allocKBps <= ALLOC_LIMIT, { allocKBps: a.allocKBps, limit: ALLOC_LIMIT, source: a.source });
      } else {
        console.log('SKIP · ' + id + ' · allocKBps 未取得（页面未暴露且 CDP 采样失败）' + (a && a.error ? ' — ' + a.error : ''));
      }
    }
    const highErrs = await page.evaluate(() => (window.__errors || []).slice(0, 10));
    ok('high 档无 pageerror', errors.length === 0, errors.slice(0, 3));
    ok('high 档 window.__errors 为空', highErrs.length === 0, highErrs);
  } else {
    console.log('\n=== 6 · high 档 === SKIP（SX_PERF_HIGH=0）');
  }
} catch (e) {
  fail++;
  console.log('FAIL · 测试异常 — ' + ((e && e.stack) || e));
  report.errors = String((e && e.stack) || e);
} finally {
  report.pass = pass;
  report.fail = fail;
  try {
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log('[v41-perf] 报告：' + REPORT);
  } catch (e) { console.log('[v41-perf] 报告写入失败：' + e); }
  await closeBrowser(browser);
}
console.log('\n----------------------------------------');
console.log('PASS ' + pass + ' · FAIL ' + fail);
console.log(fail ? '结果：失败' : '结果：全部通过');
process.exit(fail ? 1 : 0);
