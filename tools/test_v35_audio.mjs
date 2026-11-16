/* =====================================================================
   V35 · WP35-8 音乐与声音设计测试（noaudio 模式，不产生真实声音）
   ---------------------------------------------------------------------
   覆盖：
     1  模块 API / 初始 BPM
     2  按需创建 + synthMs（不一次合成全部 stem）
     3  beat 推进与 4 拍小节网格
     4  状态切换在下一小节线（ambient → combat，96 BPM，0.6–1.2s 淡化）
     5  intensity 由伤害驱动上升、脱战 8s 回 ambient 后回落到低位
     6  BOSS 112 BPM、抢下一拍、三阶段脉冲
     7  结局低频 drone（60 BPM，perc 静音，不做 VO）
     8  每图三层环境声（冷库/核心舱的底噪 + 事件 + 混响尾）
     9  电台质感：不同说话人音高 + 侧链压低
    10  联机 100 BPM
    11  saltline.audio.v1 读取 / 分轨持久化
    12  无 pageerror（且无 [music] 运行时错误）
   运行：node tools/test_v35_audio.mjs
   构建：node tools/build.cjs game_v35.html v35
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { existsSync } from 'node:fs';

const ROOT = '/Users/zhouyou/codex_workspace/fps';
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
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + safe(d) : '')); };
const safe = (v) => { try { return JSON.stringify(v); } catch (e) { return '[unserializable]'; } };
const step = (n) => page.evaluate((k) => { try { window.__SX_STEP(k); return true; } catch (e) { return String(e); } }, n);
const snap = () => page.evaluate(() => {
  const M = window.__SX_MUSIC;
  const d = M.debug();
  return {
    state: M.state, bpm: M.bpm, beat: M.beat, intensity: M.intensity,
    beatFloat: d.beatFloat, bar: d.bar, log: d.log, pending: d.pending,
    created: d.created, stems: d.stems, synthMs: d.synthMs,
    ambience: d.ambience, radio: d.radio, ending: d.ending, boss: d.boss,
    pulses: d.pulses, lastPulse: d.lastPulse, settings: d.settings,
    lowpass: d.lowpass, health: d.health, nearest: d.nearest, combatT: d.combatT, t: d.t
  };
});
const until = async (fn, maxSteps, chunk) => {
  maxSteps = maxSteps || 600; chunk = chunk || 20;
  for (let i = 0; i <= maxSteps; i += chunk) {
    if (await page.evaluate(fn)) return true;
    await step(chunk);
    await page.waitForTimeout(8);
  }
  return !!(await page.evaluate(fn));
};
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);
const onGrid = (beat, grid) => Math.abs(beat - Math.round(beat / grid) * grid) < 1e-6;

/* ------------------------------------------------------------ 打开构建 */
const url = 'file://' + ROOT + '/game_v35.html?q=low&noaudio=1&autostart=1&dt=0.1';
await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
const booted = await page.waitForFunction(() => !!window.__SX_MUSIC, null, { timeout: 60000 }).then(() => true).catch(() => false);

/* ------------------------------------------------------------ 1. API */
const api = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  if (!M) return { has: false };
  const d = M.debug();
  return {
    has: true,
    getters: { state: typeof M.state, bpm: typeof M.bpm, beat: typeof M.beat, intensity: typeof M.intensity },
    fns: ['setIntensity', 'request', 'debug', 'snapshot', 'tick', 'begin'].filter((k) => typeof M[k] === 'function'),
    state: M.state, bpm: M.bpm, beat: M.beat, intensity: M.intensity,
    debugOk: !!(d && d.stems && d.created && d.ambience && d.synthMs),
    engine: (function () { try { var a = window.__G.audio; return { state: a.debug ? a.debug().state : 'none', ctx: !!a.ctx }; } catch (e) { return null; } })(),
    audio2: !!window.__SX_AUDIO2
  };
});
ok('window.__SX_MUSIC 暴露 state/bpm/beat/intensity/setIntensity',
  api.has && booted && api.getters.state === 'string' && api.getters.bpm === 'number' &&
  api.getters.beat === 'number' && api.getters.intensity === 'number' &&
  api.fns.length >= 5 && api.debugOk,
  api);
ok('noaudio 下初始为 72 BPM 的探索/标题状态', [ 'title', 'ambient' ].includes(api.state) && api.bpm === 72 &&
  api.engine && api.engine.ctx === false, { state: api.state, bpm: api.bpm, engine: api.engine });

/* ------------------------------------------------------------ 2. 懒创建 + synthMs */
const lazy0 = await snap();
const created0 = lazy0.created.slice();
ok('按需创建：启动只建 drone/ost，不一次合成全部 stem',
  created0.length > 0 && created0.length <= 2 &&
  created0.indexOf('perc') < 0 && created0.indexOf('brass') < 0 &&
  lazy0.synthMs && typeof lazy0.synthMs.total === 'number' && lazy0.synthMs.calls >= created0.length,
  { created: created0, synthMs: lazy0.synthMs });

/* ------------------------------------------------------------ 3. 节拍推进 */
const b0 = await snap();
await step(120);                       /* 2s */
const b1 = await snap();
const dBeat = b1.beat - b0.beat;
const expect = Math.floor((2 * b0.bpm) / 60);
ok('beat 随音乐时钟推进且 bar = floor(beat/4)+1',
  dBeat >= expect - 1 && dBeat <= expect + 1 && b1.beatFloat > b0.beatFloat &&
  b1.bar === Math.floor(b1.beatFloat / 4) + 1,
  { before: b0.beatFloat, after: b1.beatFloat, dBeat, expect, bar: b1.bar });

/* ------------------------------------------------------------ 稳定战场：清场 + 无敌，避免随机交火干扰断言 */
await page.evaluate(() => { try { window.__SX.god(); window.__SX.killAll(); } catch (e) {} });
await step(30);

/* ------------------------------------------------------------ 4. 小节线切换 + 96 BPM */
await page.evaluate(() => {
  const G = window.__G;
  for (let i = 0; i < 3; i++) {
    G.events.emit('player:hit', { amount: 12 });
    G.events.emit('weapon:fire', { weapon: 'pac9' });
  }
});
const toCombat = await until(() => window.__SX_MUSIC.state === 'combat', 700, 10);
const combat = await snap();
const cLog = combat.log.filter((l) => l.to === 'combat').slice(-1)[0] || null;
ok('交火切换到下一小节线（96 BPM / 0.9s 淡化）',
  toCombat && combat.state === 'combat' && combat.bpm === 96 && !!cLog &&
  onGrid(cLog.atBeat, 4) && cLog.fade >= 0.6 && cLog.fade <= 1.2 &&
  cLog.waitBeats <= 4.0001 && Math.abs(cLog.lag) < 0.1,
  cLog && { state: combat.state, bpm: combat.bpm, atBeat: cLog.atBeat, grid: cLog.grid, fade: cLog.fade, waitBeats: cLog.waitBeats, lag: cLog.lag });

/* ------------------------------------------------------------ 5. intensity 上升 / 回落 */
const lpLow = combat.lowpass.perc;
await page.evaluate(() => {
  const G = window.__G;
  for (let i = 0; i < 4; i++) G.events.emit('player:hit', { amount: 15 });
});
await step(90);                         /* 1.5s */
const rise = await page.evaluate(() => { const M = window.__SX_MUSIC; return { I: M.intensity, d: M.debug() }; });
const manual = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  M.setIntensity(0.95, 4);
  return M.intensity;
});
await step(90);
const forced = await page.evaluate(() => { const M = window.__SX_MUSIC; return { I: M.intensity, d: M.debug() }; });
ok('intensity 随最近 6s 伤害上升，并抬高 perc 增益 / 低通',
  rise.I > 0.4 && rise.d.stems && rise.d.stems.perc && rise.d.stems.perc.target > 0.02 &&
  rise.d.lowpass.perc > lpLow,
  { rise: rise.I, target: rise.d.targetIntensity, percGain: rise.d.stems.perc && rise.d.stems.perc.target, lowpass: rise.d.lowpass.perc, soft: lpLow });
ok('setIntensity 可把强度推到 0.9 以上（导演接口）',
  manual >= 0 && forced.I > 0.85, { manual, forced: forced.I });

await page.evaluate(() => { try { window.__SX.killAll(); } catch (e) {} });
const backAmbient = await until(() => window.__SX_MUSIC.state === 'ambient', 1400, 20);
await step(300);                       /* 让 intensity 以 1.6s 时间常数回落 */
const fall = await snap();
const aLog = fall.log.filter((l) => l.to === 'ambient').slice(-1)[0] || null;
ok('脱战 8s 回 ambient：BPM 回落 72、intensity 回落',
  backAmbient && fall.state === 'ambient' && fall.bpm === 72 && fall.intensity < 0.3 &&
  fall.combatT === 0 && !!aLog && onGrid(aLog.atBeat, 4) && aLog.from === 'combat',
  { state: fall.state, bpm: fall.bpm, I: fall.intensity, combatT: fall.combatT, log: aLog && { from: aLog.from, atBeat: aLog.atBeat, fade: aLog.fade } });

/* ------------------------------------------------------------ 6. BOSS：112 BPM / 抢下一拍 / 三阶段 */
const boss0 = await snap();
await page.evaluate(() => { window.__G.events.emit('sx:boss-start', { enemy: {} }); });
const toBoss = await until(() => window.__SX_MUSIC.state === 'boss', 400, 5);
const boss1 = await snap();
const bLog = boss1.log.filter((l) => l.to === 'boss').slice(-1)[0] || null;
const spec0 = boss1.boss.pulse;
ok('进 BOSS 抢下一拍：112 BPM，网格 1 拍、0.7s 淡化',
  toBoss && boss1.state === 'boss' && boss1.bpm === 112 && !!bLog &&
  bLog.grid === 1 && Math.abs(bLog.atBeat - Math.round(bLog.atBeat)) < 1e-6 &&
  bLog.waitBeats <= 1.0001 && bLog.fade >= 0.6 && bLog.fade <= 1.2,
  bLog && { bpm: boss1.bpm, atBeat: bLog.atBeat, grid: bLog.grid, waitBeats: bLog.waitBeats, fade: bLog.fade, reqBeat: bLog.reqBeat });

await page.evaluate(() => { window.__G.events.emit('sx:boss-phase', { phase: 1 }); });
await step(40);
const boss2 = await snap();
await page.evaluate(() => { window.__G.events.emit('sx:boss-phase', { phase: 2 }); });
await step(80);
const boss3 = await snap();
const p1 = boss2.boss.pulse, p2 = boss3.boss.pulse;
ok('BOSS 三阶段脉冲递进（1 拍 → 反拍八分、重音增强）',
  boss2.boss.phase === 1 && boss3.boss.phase === 2 &&
  spec0 && p1 && p2 && p1.every === 1 && p2.every === 0.5 && p2.offbeat === true &&
  spec0.every === 1 && p2.accent > spec0.accent &&
  boss3.pulses > boss1.pulses,
  { phase0: spec0, phase1: p1, phase2: p2, pulses: boss3.pulses, lastPulse: boss3.lastPulse });

await page.evaluate(() => { window.__G.events.emit('sx:boss-dead', {}); });
await step(40);

/* ------------------------------------------------------------ 7. 结局低频 drone */
const ending = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  M.request('ending', { immediate: true, hold: 8 });
  const d = M.debug();
  return { state: M.state, bpm: M.bpm, ending: d.ending, perc: d.stems.perc ? d.stems.perc.target : 0, radioLines: d.radio.lines, drone: d.stems.drone && d.stems.drone.target };
});
ok('结局切 60 BPM 低频 drone、perc/brass 静音、不产生 VO',
  ending.state === 'ending' && ending.bpm === 60 && ending.ending.active &&
  ending.ending.dronePitch === 0.62 && ending.drone > 0.09 && ending.perc === 0 && ending.radioLines === 0,
  ending);

/* ------------------------------------------------------------ 8. 每图三层环境声 */
const maps = await page.evaluate(() => {
  const out = {};
  try { window.__SX.switchMap('depot'); } catch (e) { out.err = String(e); }
  return out;
});
await step(40);
const depot = await snap();
const depotRoles = depot.ambience.roles;
const depotActive = depot.ambience.layers.filter((l) => l.active);
await page.evaluate(() => { try { window.__SX.switchMap('core'); } catch (e) {} });
await step(40);
const core = await snap();
const coreRoles = core.ambience.roles;
const coreActive = core.ambience.layers.filter((l) => l.active);
ok('每图三层环境声：冷库/核心舱（底噪 + 事件 + 混响尾）',
  depot.ambience.map === 'depot' && depotRoles.bed === 2 && depotRoles.events >= 3 && depotRoles.tail === true &&
  depotActive.length === 2 && !!(depot.ambience.tail || depot.ambience.layers.some((l) => l.tail)) &&
  depotRoles.bedSpec.some((b) => b.s === 'relay_hum' && near(b.p, 0.55, 1e-6)) &&
  core.ambience.map === 'core' && coreRoles.bed === 2 && coreRoles.tail === true && coreActive.length === 2 &&
  coreRoles.bedSpec.some((b) => b.s === 'relay_hum' && near(b.p, 0.38, 1e-6)),
  { depot: { map: depot.ambience.map, roles: depotRoles, active: depotActive.length },
    core: { map: core.ambience.map, roles: coreRoles, active: coreActive.length } });

/* ------------------------------------------------------------ 9. 电台质感 */
const radio1 = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  window.__SX.speaker('舵手');
  window.__G.hud.radio('舵手，货轮右舷有人。', 4);
  return M.debug().radio;
});
await step(30);
const radioDuck = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  const d = M.debug();
  return { radio: d.radio, drone: d.stems.drone ? d.stems.drone.target : 0 };
});
const radio2 = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  window.__SX.speaker('蜃');
  window.__G.hud.radio('蜃：你们不该来这里。', 4);
  return M.debug().radio;
});
ok('电台质感：不同说话人音高不同，播放时音乐侧链压低',
  radio1.speaker === '舵手' && near(radio1.pitch, 1.1, 1e-6) && radio1.lines === 1 &&
  radio2.speaker === '蜃' && near(radio2.pitch, 0.72, 1e-6) && radio2.lines === 2 &&
  radio2.pitch !== radio1.pitch &&
  radioDuck.radio.speaking === true && near(radioDuck.radio.duck, 0.5, 1e-6) && radioDuck.drone > 0,
  { a: radio1, b: radio2, duck: radioDuck });

/* ------------------------------------------------------------ 10. 联机 100 BPM */
await page.evaluate(() => { window.__SX_MUSIC.request('mp', { hold: 10 }); });
const toMp = await until(() => window.__SX_MUSIC.state === 'mp', 600, 10);
const mp = await snap();
const mLog = mp.log.filter((l) => l.to === 'mp').slice(-1)[0] || null;
ok('联机状态 100 BPM，切换仍落在 4 拍小节线',
  toMp && mp.state === 'mp' && mp.bpm === 100 && !!mLog && mLog.grid === 4 &&
  onGrid(mLog.atBeat, 4) && mLog.fade >= 0.6 && mLog.fade <= 1.2,
  mLog && { state: mp.state, bpm: mp.bpm, atBeat: mLog.atBeat, fade: mLog.fade });

/* ------------------------------------------------------------ 11. saltline.audio.v1 */
const persist = await page.evaluate(() => {
  const M = window.__SX_MUSIC;
  const KEY = 'saltline.audio.v1';
  const old = localStorage.getItem(KEY);
  localStorage.setItem(KEY, JSON.stringify({ master: 0.7, music: 0.42, sfx: 0.55, voice: 0.6 }));
  const read = M.reloadSettings();
  const d = M.debug();
  if (old == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, old);
  M.reloadSettings();
  return { read, debugSettings: d.settings };
});
ok('读取 saltline.audio.v1 的四路音量（分轨持久化）',
  near(persist.read.music, 0.42, 1e-9) && near(persist.read.sfx, 0.55, 1e-9) &&
  near(persist.read.voice, 0.6, 1e-9) && near(persist.read.master, 0.7, 1e-9) &&
  near(persist.debugSettings.music, 0.42, 1e-9),
  persist);

/* ------------------------------------------------------------ 12. 无错误 */
await step(30);
const musicErrs = cErrs.filter((t) => /\[music\]/.test(t));
ok('无 pageerror，且无 [music] 运行时错误',
  errs.length === 0 && musicErrs.length === 0,
  { pageerrors: errs.slice(0, 3), consoleErrors: cErrs.slice(0, 3) });

await browser.close();
console.log(fails ? fails + ' 项失败' : '全部通过');
process.exit(fails ? 1 : 0);