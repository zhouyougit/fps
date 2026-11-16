/* 验证 ?ai2=0 与运行时 __SX_AI.enabled 开关 */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const src = process.argv[2] || 'bench/v34_after.html';
const url = pathToFileURL(path.resolve(src)).href + '?ai2=0&q=low&noaudio=1&autostart=1&dt=0.1&seed=4207';
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
  await page.waitForFunction(() => !!(window.__SX_AI && window.__G), null, { timeout: 120000 });
  await page.waitForTimeout(400);
  out.steps = await page.evaluate(() => {
    const G = window.__G;
    const snap = () => {
      const s = window.__SX_AI.state();
      return { enabled: s.enabled, t: s.t, covers: s.covers, valid: s.validCovers, hot: s.hotCovers, squads: s.squads, enemies: s.enemies.length };
    };
    const step = (n) => { for (let i = 0; i < n; i++) G.enemies.update(1 / 60); };
    const s0 = snap();
    step(180);
    const s1 = snap();
    window.__SX_AI.enabled = true;
    const s2 = snap();
    step(180);
    const s3 = snap();
    window.__SX_AI.enabled = false;
    const s4 = snap();
    step(60);
    const s5 = snap();
    window.__SX_AI.enabled = true;
    return { s0, s1, s2, s3, s4, s5, finalOn: window.__SX_AI.state().enabled };
  });
} catch (e) {
  out.error = String(e && e.message || e);
} finally {
  console.log(JSON.stringify(out, null, 2));
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  process.exit(0);
}
