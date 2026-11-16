
/* =====================================================================
   V33 · WP33-6 / WP33-7 测试：音频 2.0（API/持久化/遮挡/分层）+
   输入 2.0（按键重绑/辅助瞄准数学/手柄曲线/菜单导航）
   运行：node tools/test_v33_input_audio.mjs
   使用 game_v33.html（不覆盖主构建）
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
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
let fails = 0;
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); };

const url = 'file://' + ROOT + '/game_v33.html?q=low&noaudio=1&autostart=1&dt=0.1';
await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
await page.waitForFunction(() => !!(window.__SX_INPUT2 && window.__SX_AUDIO2), null, { timeout: 60000 });
await page.waitForTimeout(500);

/* ---------------- 1. 模块与默认键位 ---------------- */
const base = await page.evaluate(() => ({
  input: !!window.__SX_INPUT2,
  audio: !!window.__SX_AUDIO2,
  binds: window.__SX_INPUT2.binds(),
  state: window.__SX_INPUT2.state(),
  audioAvail: window.__SX_AUDIO2.audio(),
  initMs: window.__SX_AUDIO2.initMs
}));
ok('V33 输入/音频扩展均已加载', base.input && base.audio, { input: base.input, audio: base.audio });
ok('默认键位与引擎一致', base.binds.forward === 'KeyW' && base.binds.back === 'KeyS' &&
  base.binds.left === 'KeyA' && base.binds.right === 'KeyD' && base.binds.reload === 'KeyR' &&
  base.binds.melee === 'KeyV' && base.binds.scan === 'KeyQ' && base.binds.grenade === 'KeyG' &&
  base.binds.slide === 'KeyC' && base.binds.fire === 'Mouse0' && base.binds.ads === 'Mouse2',
  base.binds);
ok('noaudio=1 时音频被禁用（无 AudioContext）', base.audioAvail.available === false && !base.audioAvail.ctx, base.audioAvail);
ok('启动阻塞计时字段存在（空音频时为 null）', base.initMs === null || typeof base.initMs === 'number', base.initMs);

/* ---------------- 2. 分轨增益 / 类别 / 持久化 ---------------- */
const audio = await page.evaluate(() => {
  const A = window.__SX_AUDIO2;
  A.resetBuses();
  const cat = {
    music_ost: A.category('music_ost'), brass: A.category('music_brass'),
    ui: A.category('ui_click'), impact: A.category('impact_metal'),
    weapon: A.category('weapon:fire'), radio: A.category('radio_call'), voice: A.category('voice_line')
  };
  const before = A.gainFor('music_ost', 1);
  A.setBus('music', 0.5); A.setBus('sfx', 0.8); A.setBus('voice', 0.6); A.setBus('master', 0.7);
  const stored = JSON.parse(localStorage.getItem('saltline.audio.v1') || 'null');
  return { cat, before, after: A.gainFor('music_ost', 1), buses: A.buses(), stored, gainUi: A.gainFor('ui_click', 2) };
});
ok('音频类别归类（music/sfx/voice）',
  audio.cat.music_ost === 'music' && audio.cat.brass === 'music' && audio.cat.ui === 'sfx' &&
  audio.cat.impact === 'sfx' && audio.cat.weapon === 'sfx' && audio.cat.radio === 'voice' && audio.cat.voice === 'voice',
  audio.cat);
ok('分轨增益乘在 play 增益上', Math.abs(audio.before - 1) < 1e-6 && Math.abs(audio.after - 0.5) < 1e-6 && Math.abs(audio.gainUi - 1.6) < 1e-6,
  { before: audio.before, after: audio.after, gainUi: audio.gainUi });
ok('saltline.audio.v1 持久化四路音量',
  audio.stored && audio.stored.music === 0.5 && audio.stored.sfx === 0.8 && audio.stored.voice === 0.6 && audio.stored.master === 0.7,
  audio.stored);

/* ---------------- 3. 按键重绑 + 转译 + 冲突交换 ---------------- */
const rebind = await page.evaluate(() => {
  const I = window.__SX_INPUT2;
  I.resetBinds();
  const synth = [];
  const onKey = (e) => { if (e.__sx2synth) synth.push(e.code); };
  window.addEventListener('keydown', onKey, false);
  const r = I.setBind('melee', 'KeyB');
  const ev = new KeyboardEvent('keydown', { code: 'KeyB', bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
  const stored = JSON.parse(localStorage.getItem('saltline.binds') || 'null');
  const conflict = I.setBind('reload', 'KeyG');
  const after = I.binds();
  window.removeEventListener('keydown', onKey, false);
  I.resetBinds();
  const reset = I.binds();
  return { r, prevented: ev.defaultPrevented, synth, stored, conflict, after, reset, persisted: JSON.parse(localStorage.getItem('saltline.binds') || 'null') };
});
ok('重绑写入 localStorage saltline.binds', rebind.r.ok && rebind.stored && rebind.stored.melee === 'KeyB', rebind.stored);
ok('自定义键转译为引擎键并吞掉原事件（KeyB → KeyV）',
  rebind.prevented === true && rebind.synth.includes('KeyV'), { prevented: rebind.prevented, synth: rebind.synth });
ok('冲突时自动交换', rebind.conflict.ok && rebind.conflict.swapped === 'grenade' &&
  rebind.after.grenade === 'KeyR' && rebind.after.reload === 'KeyG', { after: rebind.after, conflict: rebind.conflict });
ok('恢复默认键位', rebind.reset.melee === 'KeyV' && rebind.reset.reload === 'KeyR' && rebind.persisted === null, rebind.reset);

/* ---------------- 4. 辅助瞄准数学 ---------------- */
const aim = await page.evaluate(() => {
  const I = window.__SX_INPUT2;
  const deg = Math.PI / 180;
  const view = { yaw: 0, pitch: 0, eye: { x: 0, y: 0, z: 0 } };
  const p2 = { x: Math.tan(2 * deg) * 10, y: 0, z: -10 };   // 准星右侧 2°
  const p10 = { x: Math.tan(10 * deg) * 10, y: 0, z: -10 }; // 10° 锥外
  const behind = { x: 0, y: 0, z: 10 };
  const near = I.aimStep(view, p2, { coneDeg: 3, maxFrac: 0.35, dt: 0.2, lookScale: 1 });
  const far = I.aimStep(view, p10, { coneDeg: 3, maxFrac: 0.35, dt: 0.2, lookScale: 1 });
  const back = I.aimStep(view, behind, { coneDeg: 3, maxFrac: 0.35, dt: 0.2, lookScale: 1 });
  // 0.2s（12 帧 1/60）累计不超过 35%
  let v = { yaw: 0, pitch: 0, eye: { x: 0, y: 0, z: 0 } };
  const e0 = near.errRad;
  for (let i = 0; i < 12; i++) {
    const s = I.aimStep(v, p2, { coneDeg: 3, maxFrac: 0.35, dt: 1 / 60, lookScale: 1 });
    v = { yaw: v.yaw - s.dx, pitch: v.pitch - s.dy, eye: v.eye };
  }
  const e1 = I.aimStep(v, p2, { coneDeg: 3, maxFrac: 0, dt: 1 / 60, lookScale: 1 }).errRad;
  // ADS 未开时不会自己动（纯函数层面：maxFrac=0 输出 0）
  const off = I.aimStep(view, p2, { coneDeg: 3, maxFrac: 0, dt: 0.2, lookScale: 1 });
  return { nearErr: near.errDeg, nearStep: near.step, nearMax: near.maxStep, farCone: far.inCone, farStep: far.step, backStep: back.step, e0, e1, ratio: (e0 - e1) / e0, offStep: off.step };
});
ok('准星 3° 内目标才吸附', aim.nearStep > 0 && aim.nearErr <= 3 && aim.farCone === false && aim.farStep === 0, aim);
ok('吸附单帧不超过 35% 上限', aim.nearStep <= aim.nearMax + 1e-9 && Math.abs(aim.nearMax - aim.nearErr * Math.PI / 180 * 0.35) < 1e-6, aim);
ok('0.2s 累计吸附不超过 35% 且确实收敛', aim.ratio > 0.05 && aim.ratio <= 0.351, { ratio: aim.ratio, e0: aim.e0, e1: aim.e1 });
ok('无目标 / 关闭辅助时不动', aim.backStep === 0 && aim.offStep === 0, { back: aim.backStep, off: aim.offStep });

/* ---------------- 5. 手柄曲线 / 状态 ---------------- */
const pad = await page.evaluate(() => {
  const I = window.__SX_INPUT2;
  const c = (v) => I.padCurve(v, 0.12, 1.8);
  const g = I.gamepad();
  return {
    zero: c(0), dead: c(0.12), low: c(0.2), mid: c(0.6), full: c(1), negFull: c(-1),
    mono: c(0.4) < c(0.8), gp: g
  };
});
ok('手柄径向死区 0.12 + |x|^1.8 响应',
  pad.zero === 0 && pad.dead === 0 && pad.low > 0 && pad.low < 0.1 && pad.full === 1 && pad.negFull === -1 && pad.mono,
  pad);
ok('gamepad() 返回可序列化状态', pad.gp && typeof pad.gp.connected === 'boolean' && typeof pad.gp.deadzone === 'number', pad.gp);

/* ---------------- 6. 遮挡探测 / 分层枪声 ---------------- */
const audioProbe = await page.evaluate(() => {
  const A = window.__SX_AUDIO2, G = window.__G;
  const cam = G.camera.position;
  const up = { x: cam.x, y: cam.y + 30, z: cam.z };
  const clear = A.probe(up, true);
  const V = G.THREE.Vector3;
  const box = G.physics.addBox(
    new V(cam.x - 1.2, cam.y + 4, cam.z - 1.2),
    new V(cam.x + 1.2, cam.y + 6.5, cam.z + 1.2),
    { surface: 'metal' }
  );
  const blocked = A.probe(up, true);
  G.physics.removeBox(box);
  const restored = A.probe(up, true);
  return { clear, blocked, restored, cam: cam.toArray().map((v) => +v.toFixed(2)) };
});
ok('遮挡射线：无遮挡→有遮挡→恢复', audioProbe.clear.blocked === false && audioProbe.blocked.blocked === true && audioProbe.restored.blocked === false,
  { clear: audioProbe.clear.blocked, blocked: audioProbe.blocked.blocked, restored: audioProbe.restored.blocked, cam: audioProbe.cam });

/* ---------------- 7. 分层枪声 ---------------- */
const shot = await page.evaluate(() => {
  const A = window.__SX_AUDIO2, G = window.__G;
  const f = new G.THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
  const cam = G.camera.position;
  const before = A.gunshot();
  G.events.emit('weapon:fire', { weapon: 'pac9', origin: cam, radius: 45 });
  const near = A.gunshot();
  const farPos = { x: cam.x + f.x * 40, y: cam.y + f.y * 40, z: cam.z + f.z * 40 };
  G.events.emit('enemy:fire', { type: 'hound', pos: farPos, radius: 45 });
  const far = A.gunshot();
  return { before, near, far };
});
ok('近距枪声叠两层（body + crack）', shot.near.shots === shot.before.shots + 1 && shot.near.layers === shot.before.layers + 2 && shot.near.last.lowOnly === false,
  shot.near.last);
ok('>30m 只保留低频层', shot.far.last.lowOnly === true && shot.far.last.layers === 1 && shot.far.lowOnly === shot.near.lowOnly + 1,
  shot.far.last);

/* ---------------- 8. 设置页 / 重绑入口 / 菜单导航 ---------------- */
const ui = await page.evaluate(() => {
  const pane = document.querySelector('.panel-b[data-pane="settings"]');
  const sliders = pane ? pane.querySelectorAll('[data-sx2-audio]') : [];
  const engVolHidden = pane && pane.querySelector('#s-vol') ? pane.querySelector('#s-vol').closest('.row').style.display === 'none' : false;
  const bindOpen = !!(pane && pane.querySelector('[data-sx2-bindopen]'));
  const pauseBtn = !!document.querySelector('.m-screen[data-s="paused"] [data-sx2-pausebind]');
  const pauseAct = !!document.querySelector('.m-screen[data-s="paused"] [data-act="settings"]');
  return { sliders: sliders.length, engVolHidden, bindOpen, pauseBtn, pauseAct, audioUI: window.__SX_AUDIO2.settingsUI() };
});
ok('设置页注入四路音量滑杆', ui.sliders === 4 && ui.audioUI === true, ui);
ok('设置页/暂停菜单有按键重绑入口', ui.bindOpen === true && ui.pauseBtn === true && ui.pauseAct === true, ui);

const nav = await page.evaluate(() => {
  const G = window.__G, I = window.__SX_INPUT2;
  if (G.game.state !== 'playing') return { error: 'not playing', state: G.game.state };
  G.game.pause();
  const list = I.nav.list();
  if (!list.length) return { error: 'no nav items' };
  list[0].focus();
  const first = document.activeElement;
  const ev = new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
  const second = document.activeElement;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true, cancelable: true }));
  const back = document.activeElement;
  // Enter/navConfirm：聚焦「继续游戏」并确认 → 回到 playing
  list[0].focus();
  I.nav.confirm();
  return {
    count: list.length,
    movedDown: second !== first && !!second,
    wrappedBack: back === first,
    state: G.game.state,
    screen: G.game.menus.screen,
    prevented: ev.defaultPrevented
  };
});
ok('暂停菜单 ↑↓ 焦点循环 + Enter 触发', nav.count > 1 && nav.movedDown && nav.wrappedBack && nav.state === 'playing' && nav.prevented === true, nav);

/* ---------------- 9. 回归：无页面错误 ---------------- */
await page.waitForTimeout(400);
ok('无页面错误', errs.length === 0, errs.slice(0, 3));

await browser.close();
console.log(fails ? fails + ' 项失败' : '全部通过');
process.exit(fails ? 1 : 0);
