#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/prof_v54_alloc.mjs — V54 · PERF-1 渲染分配采样
   ---------------------------------------------------------------------
   做什么：
     1. 以 medium 画质打开页面（默认 harbor），固定相机位置并绕 Y 轴
        旋转，跑 600 帧；
     2. 用 CDP HeapProfiler.startSampling 采样这段时间的 JS 分配，
        stop 后按 callFrame（函数 + url + 行号）聚合 **self bytes**；
     3. 输出 top 30 callFrame、top 20 url、总分配量与 allocKBps；
     4. 只产出报告，不设通过/失败。

   怎么读：
     - allocKBps = 采样到的总字节 / 实际渲染时长；这是“总分配速率”，
       不是堆净增长。V53 用同一口径记录约 63MB/s，作为 V54 基线；
     - top callFrame 的 selfBytes 是直接由该函数分配的字节；往 children
       看能追到调用链，但本报告只列 self，避免把父函数算重；
     - url 聚合用来判断热点在引擎（00_engine/10_render）还是扩展层；
     - 采样间隔默认 16384B；调大（32768）开销更低但噪声更大，调小更精确；
     - 同一 commit 下多跑几次取中位数再看趋势，单次 ±10% 属正常。

   用法：
     node tools/prof_v54_alloc.mjs
     SX_ALLOC_MAP=ship SX_ALLOC_FRAMES=300 node tools/prof_v54_alloc.mjs
     SX_ALLOC_INTERVAL=32768 node tools/prof_v54_alloc.mjs
     SX_TARGET=versions/几猫_V54.html node tools/prof_v54_alloc.mjs
   注意：
     - 只测渲染分配，不改生产源码；脚本只写，不在本机启动浏览器。
     - 600 帧在 SwiftShader 上会很慢；CI 软件渲染请显式减小
       SX_ALLOC_FRAMES。
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser, waitReady, gameUrl } from './testkit.mjs';
import { GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.env.SX_TARGET || 'game.html';
const MAP = process.env.SX_ALLOC_MAP || 'harbor';
const FRAMES = Math.max(1, +(process.env.SX_ALLOC_FRAMES || 600));
const INTERVAL = Math.max(1024, +(process.env.SX_ALLOC_INTERVAL || 16384));
const QUALITY = process.env.SX_QUALITY || 'medium';
const REPORT = path.resolve(ROOT, process.env.SX_ALLOC_REPORT || 'bench/v54_alloc.json');

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
  const byUrl = new Map();
  for (const r of rows) byUrl.set(r.url, (byUrl.get(r.url) || 0) + r.selfBytes);
  const urls = [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([url, bytes]) => ({
    url, selfBytes: bytes, selfKB: +(bytes / 1024).toFixed(1), pct: total ? +((bytes / total) * 100).toFixed(2) : 0
  }));
  return { totalBytes: total, sampleCount, rows, urls };
}

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(600000);
const errors = [];
page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
let cdp = null;
try { cdp = await ctx.newCDPSession(page); await cdp.send('HeapProfiler.enable'); } catch (e) { cdp = null; }

const report = {
  tool: 'prof_v54_alloc', version: 'V54', generatedAt: new Date().toISOString(),
  target: TARGET, gpu: GPU_MODE, quality: QUALITY, map: MAP,
  frames: FRAMES, samplingInterval: INTERVAL,
  viewport: { width: 1600, height: 900, deviceScaleFactor: 2 },
  durationMs: null, renderMs: null, totalBytes: null, allocKBps: null, allocMBps: null,
  sampleCount: null, topCallFrames: [], topUrls: [], profileTimes: null, errors: null
};

try {
  if (!cdp) throw new Error('CDP session unavailable：PERF-1 需要 HeapProfiler.startSampling');
  await page.goto(gameUrl(TARGET, { q: QUALITY, noaudio: '1', autostart: '1', dynres: '0' }), { waitUntil: 'load', timeout: 240000 });
  await waitReady(page);
  await page.evaluate(() => {
    try { if (window.__G.game.state !== 'playing') window.__G.game.start({ skipIntro: true }); } catch (e) {}
    try { window.__SX.god(true); } catch (e) {}
  });
  report.label = await page.evaluate(() => window.__VERSION_LABEL);
  console.log('[v54-alloc] target=' + TARGET + ' label=' + report.label + ' gpu=' + GPU_MODE + ' quality=' + QUALITY + ' map=' + MAP + ' frames=' + FRAMES + ' interval=' + INTERVAL);

  // 预热：切图 + 40 帧，确保采样窗口内没有切图/编译尖峰。
  await page.evaluate(({ map, frames }) => {
    const G = window.__G, R = G.render;
    if (window.__SX.mapId() !== map) window.__SX.switchMap(map);
    try { G.enemies.clear(); } catch (e) {}
    const p = window.__SX_MAPS_DATA.maps[map].spawns.player.pos;
    const cam = G.camera;
    cam.rotation.order = 'YXZ';
    for (let i = 0; i < frames; i++) {
      cam.position.set(p[0], p[1] + 1.6, p[2]);
      cam.rotation.set(0, (i / frames) * Math.PI * 2, 0);
      R.frame(1 / 60);
    }
  }, { map: MAP, frames: 40 });

  try {
    await cdp.send('HeapProfiler.startSampling', {
      samplingInterval: INTERVAL,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true
    });
  } catch (e) {
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: INTERVAL });
  }
  const wall0 = Date.now();
  let profile = null;
  try {
    const m = await page.evaluate(({ map, N }) => {
      const G = window.__G, gl = G.renderer.getContext(), R = G.render;
      const p = window.__SX_MAPS_DATA.maps[map].spawns.player.pos;
      const cam = G.camera;
      cam.rotation.order = 'YXZ';
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        cam.position.set(p[0], p[1] + 1.6, p[2]);
        cam.rotation.set(0, (i / N) * Math.PI * 2, 0);
        R.frame(1 / 60);
        gl.finish();
      }
      const ms = performance.now() - t0;
      return { renderMs: +ms.toFixed(2), frames: N, label: window.__VERSION_LABEL, quality: window.__G.quality && window.__G.quality.name, map: window.__SX.mapId() };
    }, { map: MAP, N: FRAMES });
    report.renderMs = m.renderMs;
    report.frames = m.frames;
    report.map = m.map;
    report.quality = m.quality;
    report.label = m.label;
    const stopped = await cdp.send('HeapProfiler.stopSampling');
    profile = stopped.profile;
  } finally {
    if (!profile) { try { await cdp.send('HeapProfiler.stopSampling'); } catch (e) {} }
  }
  report.durationMs = Date.now() - wall0;
  const agg = aggregateSampling(profile);
  const durationSec = Math.max(report.durationMs, 1) / 1000;
  report.totalBytes = agg.totalBytes;
  report.totalMB = +(agg.totalBytes / 1048576).toFixed(2);
  report.sampleCount = agg.sampleCount;
  report.allocKBps = agg.totalBytes > 0 ? +(agg.totalBytes / 1024 / durationSec).toFixed(1) : null;
  report.allocMBps = report.allocKBps == null ? null : +(report.allocKBps / 1024).toFixed(2);
  report.topCallFrames = agg.rows.slice(0, 30).map((r) => Object.assign({}, r, {
    selfKB: +(r.selfBytes / 1024).toFixed(1),
    pct: agg.totalBytes ? +((r.selfBytes / agg.totalBytes) * 100).toFixed(2) : 0
  }));
  report.topUrls = agg.urls;
  report.profileTimes = profile ? { startTime: profile.startTime, endTime: profile.endTime, unit: 'CDP profile 原始单位，仅参考' } : null;
  report.errors = errors.slice();

  console.log('\n=== 总览 ===');
  console.log('  duration ' + report.durationMs + 'ms（页面渲染 ' + report.renderMs + 'ms）  samples ' + report.sampleCount);
  console.log('  total ' + report.totalMB + 'MiB  alloc ' + report.allocKBps + 'KB/s (' + report.allocMBps + ' MiB/s)');
  console.log('\n=== TOP 30 callFrame (self bytes) ===');
  console.log('  #   selfKB    self%   function @ url:line');
  report.topCallFrames.forEach((r, i) => {
    const fn = (r.functionName || '(anonymous)').slice(0, 38);
    const u = (r.url || '(native)').replace(/^file:\/\//, '').slice(-70);
    console.log('  ' + String(i + 1).padStart(2) + '  ' + String(r.selfKB).padStart(9) + '  ' + String(r.pct).padStart(6) + '%  ' + fn + ' @ ' + u + ':' + r.line);
  });
  console.log('\n=== TOP 20 URL (self bytes) ===');
  report.topUrls.forEach((r, i) => {
    console.log('  ' + String(i + 1).padStart(2) + '  ' + String(r.selfKB).padStart(9) + 'KB  ' + String(r.pct).padStart(6) + '%  ' + r.url);
  });
  console.log('\n结果：报告已生成（本脚本不设通过/失败）');
} catch (e) {
  report.errors = String((e && e.stack) || e);
  console.log('FAIL · 采样异常 — ' + ((e && e.stack) || e));
  process.exitCode = 1;
} finally {
  try {
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log('[v54-alloc] 报告：' + REPORT);
  } catch (e) { console.log('[v54-alloc] 报告写入失败：' + e); }
  await closeBrowser(browser);
}
process.exit(process.exitCode || 0);
