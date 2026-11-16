/* V37 AI 层性能采样：同一套 harbor 战斗，对比 ext_ai 修改前后
   用法：node bench/perf_ai.mjs <file-url-or-path> <tag>
   输出：JSON（real 60s 帧采样 + 固定 3600 步 CPU 采样） */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = process.argv[2];
const tag = process.argv[3] || 'run';
const EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = arg.startsWith('file:') ? arg : pathToFileURL(path.resolve(arg)).href + '?q=low&noaudio=1&autostart=1&dt=0.1&seed=4207';

const browser = await chromium.launch({
  headless: true, executablePath: EXE,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });

const out = { tag, url, errs };
try {
  await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForFunction(() => !!(window.__SX_AI && window.__G && window.__G.player), null, { timeout: 120000 });
  await page.waitForTimeout(500);

  out.boot = await page.evaluate(() => {
    const G = window.__G;
    return { mapId: window.__SX_AI.state().mapId, quality: G.quality && G.quality.name, aiVersion: window.__SX_AI_VERSION };
  });

  // 固定阵容：10 个敌人环形围住玩家，玩家高血保证 60s 战斗持续（两次采样完全一致）
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
    const G0 = window.__G;
    window.__perf = { n: 0, total: 0, max: 0, samples: 0, start: performance.now(), frame0: G0.time.frame };
    const up = G0.enemies.update;
    G0.enemies.update = function (dt) {
      const t0 = performance.now();
      const r = up.call(this, dt);
      const d = performance.now() - t0;
      const P = window.__perf;
      P.n++; P.total += d; if (d > P.max) P.max = d;
      if (!P.buckets) P.buckets = [];
      if (P.buckets.length < 40000) P.buckets.push(d);
      return r;
    };
    window.__perfRead = function (label) {
      const P = window.__perf, G1 = window.__G;
      const list = (G1.enemies.list || []).filter((e) => e && e.alive !== false && e.active !== false);
      const b = (P.buckets || []).slice().sort((x, y) => x - y);
      const r = {
        label, updates: P.n, totalMs: +P.total.toFixed(1),
        avgMs: +(P.total / Math.max(1, P.n)).toFixed(3),
        p95Ms: +(b[Math.floor(b.length * 0.95)] || 0).toFixed(3),
        maxMs: +P.max.toFixed(3),
        frames: G1.time.frame - P.frame0,
        wallMs: +(performance.now() - P.start).toFixed(0),
        enemiesAlive: list.length,
        ai: window.__SX_AI.state()
      };
      return r;
    };
    window.__perfReset = function () {
      const G1 = window.__G;
      window.__perf = { n: 0, total: 0, max: 0, samples: 0, start: performance.now(), frame0: G1.time.frame };
    };
  });

  // 真实 60s 帧采样
  await page.waitForTimeout(60500);
  out.realtime = await page.evaluate(() => window.__perfRead('realtime60s'));

  // 固定步长：每轮 3600 步 = 60 模拟秒，跑 3 轮取中位数（纯 CPU，不受渲染帧率干扰）
  async function fixedRounds(label) {
    return await page.evaluate((lb) => {
      const G = window.__G;
      G.player.health = 1e9; G.player.alive = true;
      const up = G.enemies.update;
      const rounds = [];
      let enemiesSum = 0, samples = 0;
      const snap = [];
      for (let round = 0; round < 3; round++) {
        window.__perfReset();
        for (let i = 0; i < 3600; i++) {
          up.call(G.enemies, 1 / 60);
          if (round === 0 && i % 600 === 0) {
            const st = window.__SX_AI.state();
            enemiesSum += st.enemies.length; samples++;
            snap.push({ step: i, enemies: st.enemies.length, covers: st.covers, hot: st.hotCovers, valid: st.validCovers });
          }
        }
        rounds.push(window.__perfRead(lb + '#' + round));
      }
      const avg = (k) => +(rounds.map((r) => r[k]).sort((a, b) => a - b)[1]).toFixed(3);
      return {
        label: lb, rounds,
        median: { avgMs: avg('avgMs'), p95Ms: avg('p95Ms'), maxMs: avg('maxMs'), totalMs: avg('totalMs') },
        enemiesAvg: +(enemiesSum / Math.max(1, samples)).toFixed(1),
        snap
      };
    }, label);
  }

  out.fixed = await fixedRounds('fixed3600');

  // after 构建：同一页面关闭 AI 层再跑 3×3600 步，验证开关与叠加成本
  out.aiSwitch = await page.evaluate(() => {
    if (!('enabled' in window.__SX_AI)) return { supported: false };
    const before = window.__SX_AI.state().enabled;
    window.__SX_AI.enabled = false;
    const off = window.__SX_AI.state().enabled;
    return { supported: true, before, off, back: null };
  });
  if (out.aiSwitch.supported) {
    out.aiSwitch.offRun = await fixedRounds('fixed3600-aiOff');
    out.aiSwitch.back = await page.evaluate(() => { window.__SX_AI.enabled = true; return window.__SX_AI.state().enabled; });
  }
} catch (e) {
  out.error = String(e && e.message || e);
} finally {
  out.errs = errs.slice(0, 5);
  console.log(JSON.stringify(out, null, 2));
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(0);
}
