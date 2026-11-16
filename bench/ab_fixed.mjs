/* A/B 交替 60s 固定步长基准：before vs after，抵消机器负载漂移
   用法：node bench/ab_fixed.mjs bench/v34_before.html bench/v34_after.html */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [aPath, bPath] = process.argv.slice(2);
const EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const q = '?q=low&noaudio=1&autostart=1&dt=0.1&seed=4207';
const browser = await chromium.launch({
  headless: true, executablePath: EXE,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']
});
const errs = [];

async function open(p) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => errs.push(p + ':' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(p + ':' + m.text()); });
  await page.goto(pathToFileURL(path.resolve(p)).href + q, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForFunction(() => !!(window.__SX_AI && window.__G && window.__G.player), null, { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
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
    const up = G.enemies.update;
    window.__runFixed = function (n) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) up.call(G.enemies, 1 / 60);
      return { ms: performance.now() - t0 };
    };
    window.__st = function () {
      const s = window.__SX_AI.state();
      return { enemies: s.enemies.length, covers: s.covers, hot: s.hotCovers, valid: s.validCovers };
    };
  });
  return page;
}

const A = await open(aPath);
const B = await open(bPath);
const rounds = 7, N = 3600;
const ra = [], rb = [];
for (let r = 0; r < rounds; r++) {
  ra.push((await A.evaluate((n) => window.__runFixed(n), N)).ms);
  rb.push((await B.evaluate((n) => window.__runFixed(n), N)).ms);
}
const med = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const out = {
  before: { path: aPath, roundsMs: ra.map((x) => +x.toFixed(1)), medianTotalMs: +med(ra).toFixed(1), meanTotalMs: +mean(ra).toFixed(1), avgPerUpdateMs: +(med(ra) / N).toFixed(4), state: await A.evaluate(() => window.__st()) },
  after: { path: bPath, roundsMs: rb.map((x) => +x.toFixed(1)), medianTotalMs: +med(rb).toFixed(1), meanTotalMs: +mean(rb).toFixed(1), avgPerUpdateMs: +(med(rb) / N).toFixed(4), state: await B.evaluate(() => window.__st()) },
  rounds, updatesPerRound: N, errs: errs.slice(0, 5)
};
out.deltaPct = +(((med(rb) - med(ra)) / med(ra)) * 100).toFixed(2);
console.log(JSON.stringify(out, null, 2));
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
process.exit(0);
