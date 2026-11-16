import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const target = path.resolve(process.cwd(), 'tools/mapwork/harbor/preview.html');
const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const views = [
  { n: 'yard', p: [-30, 6, 24], l: [2, 1, -2] },
  { n: 'quay', p: [34, 5, 22], l: [8, 1, -6] },
  { n: 'crane', p: [16, 3, 18], l: [34, 8, -6] },
  { n: 'gate', p: [-34, 2.4, 4], l: [10, 1.6, 12] },
  { n: 'shed', p: [-8, 2.2, -14], l: [8, 1.2, -24] }
];
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(pathToFileURL(target).href + '?q=medium&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout: 300000 });
await page.evaluate(() => { window.__SX.applyMission(0); window.__G.game.start({ skipIntro: true }); });
await page.waitForTimeout(1500);
const out = await page.evaluate((views) => {
  const G = window.__G, T = G.THREE;
  G.game.pause();
  let ex = G.level.root.getObjectByName('sx_harbor_extras');
  const res = [];
  for (const v of views) {
    G.camera.position.set(v.p[0], v.p[1], v.p[2]);
    G.camera.lookAt(v.l[0], v.l[1], v.l[2]);
    G.camera.updateMatrixWorld(true);
    G.render.frame(0.016);
    const on = { calls: G.render.renderer.info.render.calls, tris: G.render.renderer.info.render.triangles };
    if (ex) ex.visible = false;
    G.render.frame(0.016);
    const off = { calls: G.render.renderer.info.render.calls, tris: G.render.renderer.info.render.triangles };
    if (ex) ex.visible = true;
    G.render.frame(0.016);
    const on2 = { calls: G.render.renderer.info.render.calls, tris: G.render.renderer.info.render.triangles };
    res.push({ name: v.n, on, off, on2 });
  }
  return res;
}, views);
for (const r of out) console.log(r.name.padEnd(6), 'on', r.on.calls, '/', r.on.tris, ' off', r.off.calls, '/', r.off.tris, ' on2', r.on2.calls, '/', r.on2.tris);
await browser.close();
