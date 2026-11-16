#!/usr/bin/env node
/* V44 · 自杀无人机（drone）自爆伤害回归
   验证：config 的 enemies.suicideDrone.explodeDamage = 44；
   实际近身自爆对满血玩家的伤害显著低于旧值 62（旧≈20，新≈14–16）。 */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.goto('file://' + process.cwd() + '/game.html?q=low&novisual=1&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && window.__SX) || window.__fatal, null, { timeout: 300000 });
const out = await page.evaluate(async () => {
  const G = window.__G, T = G.THREE;
  try { if (G.game.state !== 'playing') G.game.start({ skipIntro: true }); } catch (e) {}
  G.enemies.clear();
  G.player.health = G.player.maxHealth = 100;
  G.player.armor = 0;
  const before = G.player.health;
  const e = G.enemies.spawn('drone', new T.Vector3(G.player.pos.x, G.player.pos.y + 2.2, G.player.pos.z - 5), { state: 'alert' });
  let steps = 0;
  for (let i = 0; i < 220; i++) { e._update(0.05); steps++; if (!e.alive || !e.active) break; }
  const cfg = window.SX_BALANCE && window.SX_BALANCE.enemies && window.SX_BALANCE.enemies.suicideDrone;
  return {
    cfg: cfg || null,
    before, after: G.player.health,
    loss: +(before - G.player.health).toFixed(2),
    steps, alive: !!e.alive, active: !!e.active,
    pos: e.pos.toArray().map(v => +v.toFixed(2)),
    player: G.player.pos.toArray().map(v => +v.toFixed(2))
  };
});
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } };
ok('config suicideDrone.explodeDamage = 44', out.cfg && out.cfg.explodeDamage === 44, out.cfg);
ok('config suicideDrone.explodeRadius = 4.4', out.cfg && out.cfg.explodeRadius === 4.4, out.cfg);
ok('无人机近身自爆（已退役/死亡）', out.alive === false || out.active === false, out);
ok('满血玩家近身自爆伤害 < 18（旧 62 时约 20+）', out.loss > 6 && out.loss < 18, { loss: out.loss, before: out.before, after: out.after });
ok('无 pageerror', errs.length === 0, errs.slice(0, 3));
console.log(pass + ' PASS / ' + fail + ' FAIL');
await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]);
process.exit(fail ? 1 : 0);
