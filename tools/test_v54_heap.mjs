#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v54_heap.mjs — V54 · PERF-6 堆增长门禁
   ---------------------------------------------------------------------
   做什么：
     1. 启动 medium 画质、四图可切换的页面，先跑 1 圈暖机（可用
        SX_HEAP_WARMUP=0 关闭），再强制 GC（CDP
        HeapProfiler.collectGarbage）后记录基线；
     2. 按 depot → ship → core → harbor 跑 3 圈四图（每图旋转相机
        SX_HEAP_FRAMES 帧，让逐帧分配也进入样本）；
     3. 每圈结束再次强制 GC，记录 JS heap / programs / geometries /
        textures，并按图记录一次未 GC 的读数；
     4. 断言：3 圈后 JS heap 增长 < 60MiB、programs 增长 ≤ 20。
        阈值可用 SX_HEAP_GROWTH_MB / SX_HEAP_PROGRAM_GROWTH 覆盖；
     5. 输出 JSON 报告（默认 bench/v54_heap.json）。

   怎么读：
     - jsHeap.usedSize 来自 CDP Runtime.getHeapUsage（V8 used heap）；
       perfMemory.usedJSHeapSize 是页面 performance.memory 的同口径参考；
     - programs 是 renderer.info.programs.length，切图重建共用材质时
       应保持稳定；持续增长通常意味着材质/着色器变体泄漏；
     - geometries / textures 是 renderer.info.memory，反映 GPU 侧对象；
     - monotonic=true 只做提示，不是失败项；若每圈都明显上涨，需结合
       perMap 读数定位是哪张图/哪次重建。

   用法：
     node tools/test_v54_heap.mjs
     SX_HEAP_FRAMES=45 SX_HEAP_ROUNDS=3 node tools/test_v54_heap.mjs
     SX_HEAP_WARMUP=0 node tools/test_v54_heap.mjs   # 不暖机，直接从启动后的 harbor 基线算增长
     SX_HEAP_GROWTH_MB=40 SX_HEAP_PROGRAM_GROWTH=10 node tools/test_v54_heap.mjs
     SX_TARGET=versions/几猫_V54.html node tools/test_v54_heap.mjs
   注意：本脚本只写门禁，不在本机启动；浏览器验收由 lead 统一跑。
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser, waitReady, gameUrl, VIEWPORT } from './testkit.mjs';
import { GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.resolve(ROOT, process.env.SX_HEAP_REPORT || 'bench/v54_heap.json');
const TARGET = process.env.SX_TARGET || 'game.html';
const ROUNDS = Math.max(1, +(process.env.SX_HEAP_ROUNDS || 3));
// 默认先跑 1 圈暖机：把四图首次 build 的 programs/纹理计入基线，
// 再去测 3 圈的“重建/泄漏”增长；严格从启动基线算时设 SX_HEAP_WARMUP=0。
const WARMUP = Math.max(0, +(process.env.SX_HEAP_WARMUP == null ? 1 : process.env.SX_HEAP_WARMUP));
const FRAMES = Math.max(1, +(process.env.SX_HEAP_FRAMES || 30));
const GROWTH_MB = +(process.env.SX_HEAP_GROWTH_MB || 60);
const PROGRAM_GROWTH = +(process.env.SX_HEAP_PROGRAM_GROWTH || 20);
const QUALITY = process.env.SX_QUALITY || 'medium';
const MAP_SEQ = ['depot', 'ship', 'core', 'harbor'];
const MB = 1024 * 1024;

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const report = {
  tool: 'test_v54_heap', version: 'V54', generatedAt: new Date().toISOString(),
  target: TARGET, gpu: GPU_MODE, quality: QUALITY,
  thresholds: { heapGrowthMB: GROWTH_MB, programGrowth: PROGRAM_GROWTH },
  roundsRequested: ROUNDS, warmupCycles: WARMUP, framesPerMap: FRAMES, mapSequence: MAP_SEQ,
  baseline: null, rounds: [], growth: null, pass: 0, fail: 0, errors: null
};

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
let cdp = null;
try { cdp = await ctx.newCDPSession(page); await cdp.send('HeapProfiler.enable'); } catch (e) { cdp = null; }

async function forceGC() {
  await cdp.send('HeapProfiler.collectGarbage');
}

async function snapshot(tag) {
  await forceGC();
  const usage = await cdp.send('Runtime.getHeapUsage');
  const info = await page.evaluate(() => {
    const G = window.__G;
    const info = G.renderer.info;
    const R = G.render;
    let cache = null, cacheStats = null;
    try { if (window.MapKit) { cache = window.MapKit.cache(); cacheStats = window.MapKit.cacheStats(); } } catch (e) {}
    return {
      label: window.__VERSION_LABEL,
      map: window.__SX.mapId(),
      quality: window.__G.quality && window.__G.quality.name,
      programs: info.programs ? info.programs.length : 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      calls: R.stats().calls,
      tris: R.stats().tris,
      perfMemory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : null,
      cache, cacheStats,
      errors: (window.__errors || []).length
    };
  });
  return Object.assign({ tag, at: Date.now(), jsHeap: usage, jsHeapMB: +(usage.usedSize / MB).toFixed(2) }, info);
}

async function runMap(id) {
  return page.evaluate(({ id, frames }) => {
    const G = window.__G, R = G.render;
    if (window.__SX.mapId() !== id) window.__SX.switchMap(id);
    try { G.enemies.clear(); } catch (e) {}
    const p = window.__SX_MAPS_DATA.maps[id].spawns.player.pos;
    const cam = G.camera;
    cam.rotation.order = 'YXZ';
    for (let i = 0; i < frames; i++) {
      cam.position.set(p[0], p[1] + 1.6, p[2]);
      cam.rotation.set(0, (i / frames) * Math.PI * 2, 0);
      R.frame(1 / 60);
    }
    const info = G.renderer.info;
    let cache = null;
    try { if (window.MapKit) cache = window.MapKit.cache(); } catch (e) {}
    return {
      map: id,
      programs: info.programs ? info.programs.length : 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      calls: R.stats().calls,
      tris: R.stats().tris,
      cache
    };
  }, { id, frames: FRAMES });
}

try {
  if (!cdp) throw new Error('CDP session unavailable：PERF-6 需要 HeapProfiler.collectGarbage');
  await page.goto(gameUrl(TARGET, { q: QUALITY, noaudio: '1', autostart: '1', dynres: '0' }), { waitUntil: 'load', timeout: 240000 });
  await waitReady(page);
  await page.evaluate(() => {
    try { if (window.__G.game.state !== 'playing') window.__G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
  });
  report.label = await page.evaluate(() => window.__VERSION_LABEL);
  console.log('[v54-heap] target=' + TARGET + ' label=' + report.label + ' gpu=' + GPU_MODE + ' quality=' + QUALITY + ' rounds=' + ROUNDS + ' frames/map=' + FRAMES);
  console.log('[v54-heap] thresholds: heap growth <' + GROWTH_MB + 'MiB, programs growth <=' + PROGRAM_GROWTH);

  for (let w = 1; w <= WARMUP; w++) {
    for (const id of MAP_SEQ) await runMap(id);
    console.log('[warmup ' + w + '/' + WARMUP + '] map=' + (await page.evaluate(() => window.__SX.mapId())));
  }
  report.baseline = await snapshot('baseline');
  console.log('[baseline] map=' + report.baseline.map + ' heap=' + report.baseline.jsHeapMB + 'MiB programs=' + report.baseline.programs + ' geos=' + report.baseline.geometries + ' tex=' + report.baseline.textures);

  for (let r = 1; r <= ROUNDS; r++) {
    const maps = [];
    for (const id of MAP_SEQ) maps.push(await runMap(id));
    const snap = await snapshot('round-' + r);
    const row = {
      round: r, maps, snap,
      heapGrowthMBFromBaseline: +((snap.jsHeap.usedSize - report.baseline.jsHeap.usedSize) / MB).toFixed(2),
      programsDeltaFromBaseline: snap.programs - report.baseline.programs
    };
    report.rounds.push(row);
    console.log('[round ' + r + '] map=' + snap.map + ' heap=' + snap.jsHeapMB + 'MiB programs=' + snap.programs + ' geos=' + snap.geometries + ' tex=' + snap.textures + ' cache=' + JSON.stringify(snap.cache));
  }

  const first = report.baseline;
  const last = report.rounds[report.rounds.length - 1].snap;
  const heapGrowthBytes = last.jsHeap.usedSize - first.jsHeap.usedSize;
  const heapGrowthMB = +(heapGrowthBytes / MB).toFixed(2);
  const programGrowth = last.programs - first.programs;
  const geometryGrowth = last.geometries - first.geometries;
  const textureGrowth = last.textures - first.textures;
  const heaps = [first].concat(report.rounds.map((r) => r.snap)).map((s) => s.jsHeap.usedSize);
  let monotonic = true;
  for (let i = 1; i < heaps.length; i++) if (heaps[i] <= heaps[i - 1]) monotonic = false;
  report.growth = {
    heapGrowthBytes, heapGrowthMB, programGrowth, geometryGrowth, textureGrowth,
    baselineHeapMB: first.jsHeapMB, finalHeapMB: last.jsHeapMB,
    monotonic
  };
  console.log('\n=== 结果 ===');
  console.log('  heap  ' + first.jsHeapMB + ' → ' + last.jsHeapMB + ' MiB  (Δ ' + heapGrowthMB + ' MiB, monotonic=' + monotonic + ')');
  console.log('  programs ' + first.programs + ' → ' + last.programs + ' (Δ ' + programGrowth + ')');
  console.log('  geometries ' + first.geometries + ' → ' + last.geometries + ' (Δ ' + geometryGrowth + ')');
  console.log('  textures ' + first.textures + ' → ' + last.textures + ' (Δ ' + textureGrowth + ')');

  ok(ROUNDS + ' 圈后 JS heap 增长 < ' + GROWTH_MB + 'MiB', heapGrowthMB < GROWTH_MB, { growthMB: heapGrowthMB, limitMB: GROWTH_MB });
  ok(ROUNDS + ' 圈后 programs 增长 ≤ ' + PROGRAM_GROWTH, programGrowth <= PROGRAM_GROWTH, { growth: programGrowth, limit: PROGRAM_GROWTH });
  if (monotonic) console.log('WARN · heap 每圈都上涨（monotonic=true），请结合 perMap 定位；该项不单独判失败。');
  ok('无 pageerror', errors.length === 0, errors.slice(0, 3));
  const pageErrs = await page.evaluate(() => (window.__errors || []).slice(0, 10));
  ok('window.__errors 为空', pageErrs.length === 0, pageErrs);
  report.errors = errors.slice();
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
    console.log('[v54-heap] 报告：' + REPORT);
  } catch (e) { console.log('[v54-heap] 报告写入失败：' + e); }
  await closeBrowser(browser);
}
console.log('\n----------------------------------------');
console.log('PASS ' + pass + ' · FAIL ' + fail);
console.log(fail ? '结果：失败' : '结果：全部通过');
process.exit(fail ? 1 : 0);
