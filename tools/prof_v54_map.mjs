#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/prof_v54_map.mjs — V54 · PERF-2 切图长任务/阶段剖析
   ---------------------------------------------------------------------
   做什么：
     1. medium 画质打开页面，先装 PerformanceObserver('longtask')；
     2. 四图往返 2 圈：harbor → depot → ship → core → harbor，重复 2 次
        （共 8 次切图）；
     3. 每次切图拆成 5 个阶段并落 performance.mark/measure：
          build    MapKit.build(id)（先预构建，内部 load 命中 built=true）
          load     MapKit.load(id)（可见性/物理/事件/灯光切换）
          compile  renderer.compile(scene, camera) + gl.finish()
          first    load 后第一帧 R.frame + gl.finish + readPixels
          probe    轮询 __SX_VISUAL.probes() 直到 pending=0 的后续帧
        build/load/compile 都会写 performance mark，可在 Chrome trace 里
        直接按 v54:* 过滤；
     4. 输出 >100ms 长任务（SX_LONG_TASK_MS 可调）和每个阶段耗时；
     5. 只产出报告，不设通过/失败。

   怎么读：
     - buildMs：几何 merge / 材质分桶 / labels 构建，冷缓存时最高；
     - loadMs：build 已完成后的同步切换成本，含物理 boxes rebuild；
     - compileMs：renderer.compile + gl.finish，shader program 编译的主信号；
     - firstFrameMs：新图第一帧（阴影/后处理/上传纹理）的尖峰；
     - probeMs / probeFrames：medium 档 PMREM 探针按 2 面/帧分帧，
       pending 归零所需的总时长与帧数；分辨率/画质改变会显著影响它；
     - longTasks：duration ≥ 100ms 的主线程任务，附带所在 transition。
       V53 ship 单次切图最大长任务约 283ms，是 V54 的目标对照。

   用法：
     node tools/prof_v54_map.mjs
     SX_LONG_TASK_MS=150 node tools/prof_v54_map.mjs
     SX_MAP_ROUNDS=1 SX_MAP_MAX_PROBE_FRAMES=120 node tools/prof_v54_map.mjs
     SX_TARGET=versions/几猫_V54.html node tools/prof_v54_map.mjs
   注意：脚本只写，不在本机启动；浏览器验收由 lead 统一跑。
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser, waitReady, gameUrl } from './testkit.mjs';
import { GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.env.SX_TARGET || 'game.html';
const QUALITY = process.env.SX_QUALITY || 'medium';
const ROUNDS = Math.max(1, +(process.env.SX_MAP_ROUNDS || 2));
const MAX_PROBE_FRAMES = Math.max(1, +(process.env.SX_MAP_MAX_PROBE_FRAMES || 240));
const LT_MS = +(process.env.SX_LONG_TASK_MS || 100);
const REPORT = path.resolve(ROOT, process.env.SX_MAP_REPORT || 'bench/v54_map_profile.json');
const CYCLE = ['depot', 'ship', 'core', 'harbor'];

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));

const report = {
  tool: 'prof_v54_map', version: 'V54', generatedAt: new Date().toISOString(),
  target: TARGET, gpu: GPU_MODE, quality: QUALITY,
  rounds: ROUNDS, cycle: CYCLE, longTaskThresholdMs: LT_MS,
  transitions: [], longTasks: [], longTasksOverThreshold: [], summary: null,
  observerError: null, errors: null
};

function stats(values) {
  if (!values.length) return { avg: null, min: null, max: null, n: 0 };
  const s = values.slice().sort((a, b) => a - b);
  return {
    avg: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
    min: +s[0].toFixed(2), max: +s[s.length - 1].toFixed(2), n: s.length
  };
}

try {
  await page.goto(gameUrl(TARGET, { q: QUALITY, noaudio: '1', autostart: '1', dynres: '0' }), { waitUntil: 'load', timeout: 240000 });
  await waitReady(page);
  await page.evaluate(() => {
    try { if (window.__G.game.state !== 'playing') window.__G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
  });
  report.label = await page.evaluate(() => window.__VERSION_LABEL);
  console.log('[v54-map] target=' + TARGET + ' label=' + report.label + ' gpu=' + GPU_MODE + ' quality=' + QUALITY + ' rounds=' + ROUNDS);

  report.observerError = await page.evaluate(() => {
    window.__V54_MAP = { longTasks: [] };
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const attribution = (e.attribution || []).map((a) => ({ name: a.name || '', containerType: a.containerType || '', containerName: a.containerName || '' }));
          window.__V54_MAP.longTasks.push({
            name: e.name, startTime: +e.startTime.toFixed(2), duration: +e.duration.toFixed(2), attribution
          });
        }
      });
      try { obs.observe({ type: 'longtask', buffered: true }); }
      catch (e) { obs.observe({ entryTypes: ['longtask'] }); }
      window.__V54_MAP.observer = obs;
      return null;
    } catch (e) {
      return String((e && e.stack) || e);
    }
  });
  if (report.observerError) console.log('WARN · longtask observer 不可用：' + report.observerError);

  // 让页面稳定到 harbor（若 SX 当前不是 harbor）
  await page.evaluate(() => {
    const G = window.__G, R = G.render;
    if (window.__SX.mapId() !== 'harbor') window.__SX.switchMap('harbor');
    try { G.enemies.clear(); } catch (e) {}
    for (let i = 0; i < 30; i++) R.frame(1 / 60);
  });

  let n = 0;
  for (let r = 1; r <= ROUNDS; r++) {
    for (const id of CYCLE) {
      const rec = await page.evaluate(({ id, maxProbeFrames }) => {
        const G = window.__G, R = G.render, M = window.MapKit, V = window.__SX_VISUAL;
        const gl = G.renderer.getContext(), px = new Uint8Array(4);
        const from = M.current();
        if (from === id) return { skipped: true, from, to: id };
        const out = { from, to: id, wallStart: performance.now(), errors: {} };
        let cacheBefore = [];
        try { cacheBefore = M.cache(); } catch (e) {}
        out.wasCached = cacheBefore.some((c) => c.id === id);

        const mark = (phase, at, id2) => { try { performance.mark('v54:' + phase + ':' + at + ':' + id2); } catch (e) {} };
        const measure = (phase, id2) => { try { performance.measure('v54:' + phase + ':' + id2, 'v54:' + phase + ':start:' + id2, 'v54:' + phase + ':end:' + id2); } catch (e) {} };

        // 1) build（预构建；load 内部命中 def.built）
        let b0 = performance.now();
        mark('build', 'start', id);
        try { M.build(id); } catch (e) { out.errors.build = String((e && e.stack) || e); }
        mark('build', 'end', id); measure('build', id);
        out.buildMs = +(performance.now() - b0).toFixed(2);

        // 2) load（可见性/物理/事件）
        const l0 = performance.now();
        mark('load', 'start', id);
        try { M.load(id); } catch (e) { out.errors.load = String((e && e.stack) || e); }
        mark('load', 'end', id); measure('load', id);
        out.loadMs = +(performance.now() - l0).toFixed(2);
        out.current = M.current();

        // 相机放到该图出生点
        try {
          const p = window.__SX_MAPS_DATA.maps[id].spawns.player.pos;
          G.camera.position.set(p[0], p[1] + 1.6, p[2]);
          G.camera.rotation.order = 'YXZ';
          G.camera.rotation.set(0, 0, 0);
        } catch (e) { out.errors.spawn = String((e && e.stack) || e); }

        // 3) shader compile
        const c0 = performance.now();
        mark('compile', 'start', id);
        try { G.renderer.compile(G.scene, G.camera); gl.finish(); }
        catch (e) { out.errors.compile = String((e && e.stack) || e); }
        mark('compile', 'end', id); measure('compile', id);
        out.compileMs = +(performance.now() - c0).toFixed(2);

        // 4) 第一帧（阴影/后处理/纹理上传）
        const f0 = performance.now();
        mark('first', 'start', id);
        try {
          R.frame(1 / 60);
          gl.finish();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        } catch (e) { out.errors.firstFrame = String((e && e.stack) || e); }
        mark('first', 'end', id); measure('first', id);
        out.firstFrameMs = +(performance.now() - f0).toFixed(2);

        // 5) 探针分帧收尾（medium：2 cube 面/帧）
        let before = null, after = null;
        try { before = V ? V.probes() : null; } catch (e) {}
        const p0 = performance.now();
        mark('probe', 'start', id);
        let probeFrames = 0;
        try {
          for (let i = 0; i < maxProbeFrames; i++) {
            const pr = V ? V.probes() : null;
            // count 在首个探针就绪前是 0，但 pending>0 仍要继续跑帧；
            // 只有 pending 归零（全部捕获/失败）才结束。
            if (!pr || pr.pending === 0) break;
            R.frame(1 / 60);
            probeFrames++;
          }
          after = V ? V.probes() : null;
        } catch (e) { out.errors.probe = String((e && e.stack) || e); }
        mark('probe', 'end', id); measure('probe', id);
        out.probeMs = +(performance.now() - p0).toFixed(2);
        out.probeFrames = probeFrames;
        out.probes = { before, after };
        out.wallEnd = performance.now();
        out.totalMs = +(out.wallEnd - out.wallStart).toFixed(2);
        out.programs = G.renderer.info.programs ? G.renderer.info.programs.length : 0;
        out.geometries = G.renderer.info.memory.geometries;
        out.textures = G.renderer.info.memory.textures;
        return out;
      }, { id, maxProbeFrames: MAX_PROBE_FRAMES });
      if (rec && rec.skipped) continue;
      n++;
      rec.index = n;
      rec.round = r;
      report.transitions.push(rec);
      console.log('[' + String(n).padStart(2) + '] r' + r + ' ' + rec.from + '→' + rec.to +
        '  build ' + rec.buildMs + 'ms  load ' + rec.loadMs + 'ms  compile ' + rec.compileMs + 'ms' +
        '  first ' + rec.firstFrameMs + 'ms  probe ' + rec.probeMs + 'ms/' + rec.probeFrames + 'f' +
        '  total ' + rec.totalMs + 'ms' + (rec.wasCached ? '  [cached]' : ''));
    }
  }

  // 等 observer 回调排空（一次 rAF + 短 task，不做“睡 2 秒再断言”）
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80))));
  const lt = await page.evaluate(() => (window.__V54_MAP && window.__V54_MAP.longTasks ? window.__V54_MAP.longTasks.slice() : []));
  report.longTasks = lt;
  report.longTasksOverThreshold = lt.filter((x) => x.duration >= LT_MS);

  for (const rec of report.transitions) {
    rec.longTasks = lt.filter((x) => x.startTime < rec.wallEnd && x.startTime + x.duration > rec.wallStart);
  }

  report.summary = {
    transitions: report.transitions.length,
    build: stats(report.transitions.map((x) => x.buildMs)),
    load: stats(report.transitions.map((x) => x.loadMs)),
    compile: stats(report.transitions.map((x) => x.compileMs)),
    firstFrame: stats(report.transitions.map((x) => x.firstFrameMs)),
    probe: stats(report.transitions.map((x) => x.probeMs)),
    probeFrames: stats(report.transitions.map((x) => x.probeFrames)),
    total: stats(report.transitions.map((x) => x.totalMs)),
    longTasks: {
      count: lt.length,
      overThreshold: report.longTasksOverThreshold.length,
      maxMs: lt.length ? +Math.max(...lt.map((x) => x.duration)).toFixed(2) : null,
      totalMs: +lt.reduce((a, x) => a + x.duration, 0).toFixed(2)
    }
  };
  report.errors = errors.slice();

  console.log('\n=== 阶段汇总 ===');
  for (const k of ['build', 'load', 'compile', 'firstFrame', 'probe', 'total']) {
    const s = report.summary[k];
    console.log('  ' + k.padEnd(10) + ' avg ' + String(s.avg).padStart(7) + 'ms  max ' + String(s.max).padStart(7) + 'ms  n=' + s.n);
  }
  console.log('  probeFrames avg ' + report.summary.probeFrames.avg + '  max ' + report.summary.probeFrames.max);
  console.log('\n=== 长任务 >=' + LT_MS + 'ms（' + report.longTasksOverThreshold.length + '/' + lt.length + '） ===');
  if (!report.longTasksOverThreshold.length) console.log('  无');
  for (const x of report.longTasksOverThreshold) {
    const owner = report.transitions.find((t) => x.startTime < t.wallEnd && x.startTime + x.duration > t.wallStart);
    console.log('  ' + String(x.duration).padStart(7) + 'ms  @' + String(x.startTime).padStart(9) + '  ' + (owner ? owner.from + '→' + owner.to : 'outside-transition'));
  }
  console.log('\n结果：报告已生成（本脚本不设通过/失败）');
} catch (e) {
  report.errors = String((e && e.stack) || e);
  console.log('FAIL · 剖析异常 — ' + ((e && e.stack) || e));
  process.exitCode = 1;
} finally {
  try {
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log('[v54-map] 报告：' + REPORT);
  } catch (e) { console.log('[v54-map] 报告写入失败：' + e); }
  await closeBrowser(browser);
}
process.exit(process.exitCode || 0);
