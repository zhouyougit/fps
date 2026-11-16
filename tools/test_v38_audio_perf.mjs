#!/usr/bin/env node
/* =====================================================================
   V38 · 性能与地基 — 音频性能/回收测试（noaudio 模式，不产生真实声音）
   ---------------------------------------------------------------------
   覆盖：
     1  V38 产物 + __SX_MUSIC / __SX_AUDIO2 加载（noaudio 无 AudioContext）
     2  step 节流 20Hz：60 次 60Hz tick 只推进 20 次逻辑（50ms 阈值）
     3  pulseSpec 复用同一对象（不再每步 new）
     4  暂停冻结 beatPos / 脉冲 / 逻辑步，恢复不补拍
     5  切图 LRU：第 4 张图后旧图 bed 在 1.2s 被 stop 并从 amb.layers 删除
     6  分轨音量写入统一存档 settings.volume（SXSave.set），legacy 同步
     7  无 pageerror / 无 [music]/[audio2] 运行时错误
   运行：node tools/test_v38_audio_perf.mjs
   构建：node tools/build.cjs game_v38.html v38
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CANDIDATES = [
  process.env.CHROME_EXE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  process.env.HOME + '/Library/Caches/ms-playwright/chromium-1124/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const browser = await chromium.launch({
  headless: true,
  executablePath: exe,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const cErrs = [];
page.on('console', (m) => { if (m.type() === 'error') cErrs.push(m.text()); });

let fails = 0;
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + line(d) : '')); };
const line = (v) => { try { const s = JSON.stringify(v); return s.length > 620 ? s.slice(0, 620) + '…' : s; } catch (e) { return '[unserializable]'; } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);

/* ------------------------------------------------------------ 打开构建 */
const HTML = [process.env.V38_HTML, ROOT + '/game_v38.html', ROOT + '/versions/几猫_V38.html']
  .filter(Boolean).find((p) => existsSync(p));
if (!HTML) { console.error('[test] 缺少 V38 产物：先运行 node tools/build.cjs game_v38.html v38'); process.exit(1); }
const url = 'file://' + encodeURI(HTML) + '?q=low&noaudio=1&autostart=1&seed=4207';
await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 420000 });
const booted = await page.waitForFunction(
  () => !!(window.__SX_MUSIC && window.__SX_AUDIO2 && window.__SX_STEP && window.SXSave),
  null, { timeout: 90000 }
).then(() => true).catch(() => false);
await page.waitForTimeout(400);

/* ------------------------------------------------------------ 1. 产物 / 模块 */
const boot = await page.evaluate(() => {
  const G = window.__G, M = window.__SX_MUSIC, A = window.__SX_AUDIO2;
  let eng = null;
  try { eng = { stub: !!(G.audio && G.audio.stub), ctx: !!(G.audio && G.audio.ctx) }; } catch (e) {}
  return {
    ready: window.__ready, fatal: window.__fatal,
    profile: window.__BUILD__ && window.__BUILD__.profile,
    music: !!M, audio2: !!A,
    musicVersion: M && M.version, audioVersion: A && A.version,
    state: M && M.state, bpm: M && M.bpm,
    perf: M && M.debug().perf,
    engine: eng,
    loopStats: A && A.loopStats(),
    pannerStats: A && A.pannerStats()
  };
});
ok('V38 产物加载 __SX_MUSIC / __SX_AUDIO2（noaudio）',
  booted && boot.ready && !boot.fatal && boot.profile === 'v38' && boot.music && boot.audio2 &&
  boot.engine && boot.engine.stub === true && boot.engine.ctx === false &&
  boot.perf && boot.perf.hz === 20 && boot.perf.logicSteps > 0,
  boot);

/* ------------------------------------------------------------ 2. step 20Hz */
const perf = await page.evaluate(() => {
  const G = window.__G, M = window.__SX_MUSIC;
  try { window.__SX.god(); window.__SX.killAll(); } catch (e) {}
  G.game.state = 'playing';
  M.request('ambient', { immediate: true, hold: 600 });
  const d0 = M.debug();
  window.__SX_STEP(60);                    /* 60 × 1/60s = 1s 的 60Hz 固定步 */
  const d1 = M.debug();
  return {
    stepCalls: d1.perf.stepCalls - d0.perf.stepCalls,
    logicSteps: d1.perf.logicSteps - d0.perf.logicSteps,
    skipped: d1.perf.skipped - d0.perf.skipped,
    beat: +(d1.beatFloat - d0.beatFloat).toFixed(4),
    bpm: d1.bpm, state: d1.state,
    hz: d1.perf.hz, lastLogicDt: d1.perf.lastLogicDt
  };
});
ok('step 节流 20Hz：60 次 tick 只推进 20 次逻辑（50ms 阈值）',
  perf.stepCalls === 60 && perf.logicSteps === 20 && perf.skipped === 40 &&
  perf.hz === 20 && perf.lastLogicDt === 0.05 && perf.bpm === 72 &&
  near(perf.beat, 1.2, 0.03),
  perf);

/* ------------------------------------------------------------ 3. pulseSpec 复用 */
const pulse = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  M.setBoss(true);
  for (let i = 0; i < 16; i++) window.__SX_STEP(10);   /* 等到下一拍并产生脉冲 */
  const a = M.debug().boss.pulse;
  const b = M.debug().boss.pulse;
  const d = M.debug();
  return { same: a === b, pulse: a, state: d.state, pulses: d.pulses, phase: d.boss.phase };
});
ok('pulseSpec 返回复用对象（每步不再 new）',
  pulse.same === true && pulse.state === 'boss' && pulse.pulse && pulse.pulse.on === true &&
  pulse.pulses > 0,
  pulse);

/* ------------------------------------------------------------ 4. 暂停冻结 / 恢复不补拍 */
const pause = await page.evaluate(() => {
  const G = window.__G, M = window.__SX_MUSIC;
  const d0 = M.debug();
  G.game.state = 'paused';
  window.__SX_STEP(120);                   /* 暂停 2s */
  const d1 = M.debug();
  G.game.state = 'playing';
  window.__SX_STEP(60);                    /* 恢复 1s */
  const d2 = M.debug();
  const bpm = d2.bpm;
  return {
    pausedBeat: +(d1.beatFloat - d0.beatFloat).toFixed(4),
    pausedPulses: d1.pulses - d0.pulses,
    pausedLogic: d1.perf.logicSteps - d0.perf.logicSteps,
    pausedFlag: d1.perf.paused,
    tAdvance: +(d1.t - d0.t).toFixed(2),
    resumeBeat: +(d2.beatFloat - d1.beatFloat).toFixed(4),
    resumeLogic: d2.perf.logicSteps - d1.perf.logicSteps,
    resumePaused: d2.perf.paused,
    bpm, state: d2.state,
    expectResume: +(20 * 0.05 * bpm / 60).toFixed(4)
  };
});
ok('暂停冻结 beatPos/脉冲（恢复不补拍）',
  pause.pausedBeat === 0 && pause.pausedPulses === 0 && pause.pausedLogic === 0 &&
  pause.pausedFlag === true && pause.tAdvance >= 1.9 &&
  pause.resumeLogic === 20 && pause.resumePaused === false &&
  near(pause.resumeBeat, pause.expectResume, 0.03) && pause.resumeBeat < pause.expectResume * 1.25,
  pause);

/* ------------------------------------------------------------ 5. 切图 LRU 回收 */
const lru = await page.evaluate(() => {
  const G = window.__G, M = window.__SX_MUSIC, A = window.__SX_AUDIO2;
  G.game.state = 'playing';
  const before = M.debug();
  const beforeStops = A.loopStats().stops;
  const switched = [];
  ['depot', 'ship', 'core'].forEach(function (id) {
    try { window.__SX.switchMap(id); switched.push(id); window.__SX_STEP(30); }
    catch (e) { switched.push(String(e)); }
  });
  /* 第 4 张图后最旧的 harbor 被调度回收；再推 1.5s 越过 1.2s 延迟 */
  window.__SX_STEP(90);
  const d = M.debug();
  const loops = A.loopStats();
  const ev = d.ambience.evicted || [];
  const hEv = ev.filter(function (e) { return e.map === 'harbor'; }).pop() || null;
  return {
    switched: switched,
    map: d.ambience.map,
    lru: d.ambience.lru || [],
    layerCount: d.ambience.layerCount,
    maps: (d.ambience.layers || []).map(function (l) { return l.map; }),
    harborLayers: (d.ambience.layers || []).filter(function (l) { return l.map === 'harbor'; }).length,
    evicted: ev,
    harborEvicted: hEv,
    pending: d.ambience.pendingEvictions,
    stopsDelta: loops.stops - beforeStops,
    loops: loops,
    beforeLayerCount: before.ambience.layerCount
  };
});
ok('切图 LRU：旧图 bed 1.2s 后被 stop 并从 amb.layers 删除（最多 3 图）',
  lru.map === 'core' && lru.harborLayers === 0 &&
  lru.layerCount <= 6 && lru.lru.length <= 3 && lru.lru.indexOf('core') >= 0 &&
  lru.harborEvicted && lru.harborEvicted.stopped >= 2 &&
  lru.harborEvicted.keys.every(function (k) { return k.indexOf('harbor|') === 0; }) &&
  lru.stopsDelta >= 2 && lru.beforeLayerCount >= 2 && lru.layerCount === 6,
  lru);

/* ------------------------------------------------------------ 6. 分轨写统一存档 */
const save = await page.evaluate(() => {
  const A = window.__SX_AUDIO2;
  A.setBus('music', 0.31);
  A.setBus('sfx', 0.62);
  A.setBus('voice', 0.71);
  A.setBus('master', 0.55);
  const settings = window.SXSave.get('settings') || {};
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem('saltline.audio.v1') || 'null'); } catch (e) {}
  return { volume: settings.volume, buses: A.buses(), legacy: legacy, hasSave: !!window.SXSave };
});
ok('分轨音量写入统一存档 settings.volume（SXSave.set）',
  save.hasSave && save.volume &&
  near(save.volume.music, 0.31, 1e-9) && near(save.volume.sfx, 0.62, 1e-9) &&
  near(save.volume.voice, 0.71, 1e-9) && near(save.volume.master, 0.55, 1e-9) &&
  save.legacy && near(save.legacy.music, 0.31, 1e-9),
  save);

/* ------------------------------------------------------------ 7. 无错误 */
await page.waitForTimeout(400);
const audioErrs = cErrs.filter((t) => /\[(music|audio2|loop)\]/.test(t));
ok('无 pageerror，且无 [music]/[audio2]/[loop] 运行时错误',
  errs.length === 0 && audioErrs.length === 0,
  { pageerrors: errs.slice(0, 3), consoleErrors: audioErrs.slice(0, 3) });

console.log(fails ? fails + ' 项失败' : '全部通过');
try { await browser.close(); } catch (e) {}
process.exit(fails ? 1 : 0);
