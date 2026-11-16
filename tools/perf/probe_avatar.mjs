#!/usr/bin/env node
/* V43 持枪姿势标定：在真实 THREE 场景里网格搜索肩/肘旋转，让双手靠近步枪握把/护木。
   用法：node tools/perf/probe_avatar.mjs [--file game.html] */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from '../pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const file = path.resolve(ROOT, (argv[argv.indexOf('--file') + 1] || 'game.html'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
await page.goto('file://' + file + '?q=low&novisual=1&noaudio=1&autostart=1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__SX) || window.__fatal, null, { timeout: 300000 });
const out = await page.evaluate(() => {
  const G = window.__G, T = G.THREE, A = window.SX_MP_AVATAR;
  const rig = A.build(T, 0, {});
  G.scene.add(rig.grp);
  rig.grp.position.set(0, 0, 0);
  const targetR = new T.Vector3(0.06, 1.085, -0.22);
  const targetL = new T.Vector3(0.06, 1.185, -0.595);
  const p = new T.Vector3();
  function measure(arm, elbow, hand) {
    rig.grp.updateMatrixWorld(true);
    hand.getWorldPosition(p);
    return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) };
  }
  function search(side) {
    const arm = side === 'R' ? rig.armR : rig.armL;
    const elbow = side === 'R' ? rig.elbowR : rig.elbowL;
    const hand = side === 'R' ? rig.handR : rig.handL;
    const target = side === 'R' ? targetR : targetL;
    let best = null;
    for (let x = 0.2; x <= 1.5; x += 0.1) {
      for (let z = side === 'R' ? -0.9 : 0.0; z <= (side === 'R' ? 0.2 : 1.0); z += 0.1) {
        for (let e = -1.9; e <= 1.9; e += 0.1) {
          arm.rotation.set(x, 0, z);
          elbow.rotation.set(e, 0, 0);
          rig.grp.updateMatrixWorld(true);
          hand.getWorldPosition(p);
          const d = p.distanceTo(target);
          if (!best || d < best.d) best = { d: +d.toFixed(3), x: +x.toFixed(2), z: +z.toFixed(2), e: +e.toFixed(2), hand: { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) } };
        }
      }
    }
    arm.rotation.set(best.x, 0, best.z);
    elbow.rotation.set(best.e, 0, 0);
    rig.grp.updateMatrixWorld(true);
    return best;
  }
  const r = search('R');
  const l = search('L');
  rig.grp.updateMatrixWorld(true);
  const rifle = rig.weapon.getWorldPosition(new T.Vector3());
  return { right: r, left: l, rifle: { x: +rifle.x.toFixed(3), y: +rifle.y.toFixed(3), z: +rifle.z.toFixed(3) } };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();