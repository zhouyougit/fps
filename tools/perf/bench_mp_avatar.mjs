#!/usr/bin/env node
/* V43 联机角色模型 A/B 渲染成本：新程序化士兵 vs V36 方盒模型（8 人同屏）
   用法：node tools/perf/bench_mp_avatar.mjs [--file game.html] */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from '../pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const file = path.resolve(ROOT, (argv[argv.indexOf('--file') + 1] || 'game.html'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file://' + file + '?q=medium&noaudio=1&autostart=1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__SX && !!window.__MP) || window.__fatal, null, { timeout: 420000 });
const out = await page.evaluate(() => {
  const G = window.__G, MP = window.__MP, gl = G.renderer.getContext();
  try { G.game.start({ skipIntro: true }); } catch (e) {}
  window.__SX.god(true);
  window.__SX.switchMap('ship');
  const p = window.__SX_MAPS_DATA.maps.ship.spawns.player.pos;
  G.player.pos.set(p[0], p[1], p[2]); G.player.yaw = 0; G.player.pitch = 0;
  window.__SX_LOOP.step(4);
  const list = [];
  for (let i = 0; i < 8; i++) list.push({ id: 'a' + i, name: 'A' + i, x: -3.5 + i * 1.0, y: 0.35, z: -1.5, yaw: Math.PI, pitch: 0, team: i % 2, hp: 100, armor: 50, alive: true, crouch: false });
  function measure(label) {
    MP.net2.testClear();
    MP.net2.testUpsert(list);
    MP.net2.testFrame(1 / 60);
    const px = new Uint8Array(4), times = [], calls = [], tris = [];
    const frame = () => {
      const t0 = performance.now();
      G.render.frame(1 / 60);
      gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - t0);
      const s = G.render.stats(); calls.push(s.calls); tris.push(s.tris);
    };
    for (let i = 0; i < 30; i++) frame();
    times.length = 0; calls.length = 0; tris.length = 0;
    for (let i = 0; i < 90; i++) frame();
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    return { label: label, avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2), calls: med(calls), tris: med(tris), meshes: (G.scene.children.filter((o) => o.name === 'mp-player').length) };
  }
  const next = measure('v43-detailed');
  const save = window.SX_MP_AVATAR;
  window.SX_MP_AVATAR = null;
  const legacy = measure('v36-box');
  window.SX_MP_AVATAR = save;
  MP.net2.testClear();
  return { next: next, legacy: legacy };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
