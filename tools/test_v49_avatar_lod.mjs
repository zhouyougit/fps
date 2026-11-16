#!/usr/bin/env node
/* V49 · 联机远端距离 LOD：8 人近/远两组 draw calls 对比 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS, findChrome, ROOT } from './pwargs.mjs';

const GAME = pathToFileURL(path.join(ROOT, 'game.html')).href;
const browser = await chromium.launch({ headless: true, executablePath: findChrome(), args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message || e)));
await page.goto(GAME + '?q=medium&noaudio=1&autostart=1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__SX && !!window.__MP) || window.__fatal, null, { timeout: 300000 });
await page.evaluate(() => {
  const G = window.__G;
  if (G.game.state !== 'playing') G.game.start({ skipIntro: true });
  const ui = document.getElementById('ui'); if (ui) ui.style.display = 'none';
  G.player.pos.set(-30, 0, 24); G.player.yaw = -0.888; G.player.pitch = 0;
  window.__SX_LOOP.step(4);
});
async function measure(far) {
  await page.evaluate((far) => {
    const list = [];
    for (let i = 0; i < 8; i++) list.push({ id: 'v49' + (far ? 'f' : 'n') + i, name: 'T' + i, x: -31 + i * 0.3, y: 0, z: far ? -40 : 20, yaw: Math.PI, pitch: 0, team: i % 2, hp: 100, armor: 0, alive: true, crouch: false });
    window.__MP.net2.testClear(); window.__MP.net2.testUpsert(list);
    for (let i = 0; i < 4; i++) window.__MP.net2.testFrame(1 / 30);
  }, far);
  await page.waitForTimeout(400);
  await page.evaluate(() => { for (let i = 0; i < 8; i++) window.__MP.net2.testFrame(1 / 30); });
  const r = await page.evaluate(() => {
    const G = window.__G;
    const groups = [];
    G.scene.traverse((o) => { if (o.name === 'mp-player') groups.push(o); });
    let farVisible = 0, hipsHidden = 0, farMeshes = 0;
    groups.forEach((g) => { g.traverse((o) => { if (o.name === 'mp-far' && o.visible) farVisible++; }); farMeshes += 0; if (g.children[0] && !g.children[0].visible) hipsHidden++; });
    const calls = [];
    for (let i = 0; i < 24; i++) { G.render.frame(1 / 60); calls.push(G.render.stats().calls); }
    calls.sort((a, b) => a - b);
    return { groups: groups.length, farVisible, hipsHidden, calls: calls[calls.length >> 1], res: G.render.stats().res, geos: G.renderer.info.memory.geometries };
  });
  return r;
}
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } };
try {
  const near = await measure(false);
  const far = await measure(true);
  console.log('[near] ' + JSON.stringify(near));
  console.log('[far ] ' + JSON.stringify(far));
  ok('8 人近距没有进入远距 LOD', near.groups === 8 && near.farVisible === 0 && near.hipsHidden === 0, near);
  ok('8 人远距全部切到低模替身', far.groups === 8 && far.farVisible === 8 && far.hipsHidden === 8, far);
  ok('远距 draw calls 明显低于近距', far.calls < near.calls - 100, { near: near.calls, far: far.calls, saved: near.calls - far.calls });
  ok('无 pageerror', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL · 异常 — ' + ((e && e.stack) || e)); }
console.log(pass + ' PASS / ' + fail + ' FAIL');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(fail ? 1 : 0);
