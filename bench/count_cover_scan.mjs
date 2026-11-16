/* 统计 60 sim 秒内掩体遍历次数：bench/v34_before_cnt.html vs v34_after_cnt.html */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = process.argv[2];
const url = pathToFileURL(path.resolve(arg)).href + '?q=low&noaudio=1&autostart=1&dt=0.1&seed=4207';
const EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true, executablePath: EXE,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
const out = { url, errs };
try {
  await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForFunction(() => !!(window.__SX_AI && window.__G && window.__G.player), null, { timeout: 120000 });
  await page.waitForTimeout(500);
  out.result = await page.evaluate(() => {
    const G = window.__G, T = G.THREE, p = G.player;
    p.health = 1e9; p.alive = true;
    const roster = ['hound', 'gull', 'hound', 'gull', 'hound', 'gull', 'hound', 'gull', 'hound', 'gull'];
    for (let i = 0; i < roster.length; i++) {
      const a = (i / roster.length) * Math.PI * 2;
      const r = 9 + (i % 4) * 3;
      const type = roster[i];
      const pos = new T.Vector3(p.pos.x + Math.cos(a) * r, p.pos.y + (type === 'gull' ? 3.5 : 0), p.pos.z + Math.sin(a) * r);
      try { G.enemies.spawn(type, pos, { state: 'alert' }); } catch (e) {}
    }
    window.__CNT = { coverScan: 0, hasCoverCalls: 0, hotBuild: 0 };
    const up = G.enemies.update;
    for (let i = 0; i < 3600; i++) up.call(G.enemies, 1 / 60);
    const st = window.__SX_AI.state();
    return {
      cnt: window.__CNT, enemies: st.enemies.length, covers: st.covers,
      hot: st.hotCovers, valid: st.validCovers, aiVersion: window.__SX_AI_VERSION
    };
  });
} catch (e) {
  out.error = String(e && e.message || e);
} finally {
  console.log(JSON.stringify(out));
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  process.exit(0);
}
