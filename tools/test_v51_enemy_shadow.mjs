#!/usr/bin/env node
/* V51 · 敌人接地阴影：hound/siege/emp 有、gull 没有 */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message || e)));
await page.goto('file://' + process.cwd() + '/game.html?q=low&novisual=1&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__SX && !!window.__G) || window.__fatal, null, { timeout: 300000 });
const out = await page.evaluate(() => {
  const G = window.__G, T = G.THREE;
  if (G.game.state !== 'playing') G.game.start({ skipIntro: true });
  G.enemies.clear();
  const p = G.player.pos;
  const at = (x) => new T.Vector3(p.x + x, p.y, p.z - 3);
  const hound = G.enemies.spawn('hound', at(-2), { state: 'alert' });
  const gull = G.enemies.spawn('gull', at(0), { state: 'alert' });
  const siege = G.enemies.spawn('siege', at(2), { state: 'alert' });
  const emp = G.enemies.spawn('emp', at(4), { state: 'alert' });
  const has = (e) => !!(e && e.rig && e.rig.group && e.rig.group.getObjectByName('sx-ground-blob'));
  return {
    hound: has(hound), gull: has(gull), siege: has(siege), emp: has(emp),
    count: G.enemies.list.length
  };
});
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } };
ok('hound 有接地阴影', out.hound === true, out);
ok('gull 不添加接地阴影', out.gull === false, out);
ok('siege/emp 有接地阴影', out.siege === true && out.emp === true, out);
ok('字段无副作用/敌人数量正常', out.count >= 4, out);
ok('无 pageerror', errs.length === 0, errs.slice(0, 3));
console.log(pass + ' PASS / ' + fail + ' FAIL');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(fail ? 1 : 0);
