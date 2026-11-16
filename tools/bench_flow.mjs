
import { chromium } from 'playwright';
const URL = 'file:///Users/zhouyou/codex_workspace/fps/game.html';
const configs = [
  { name: 'swiftshader low', q: 'low', extra: '', args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] },
  { name: 'swiftshader test+novisual', q: 'test', extra: '&novisual=1', args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] },
  { name: 'metal headless low', q: 'low', extra: '', args: ['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist','--allow-file-access-from-files'] }
];
for (const c of configs) {
  let b;
  try {
    b = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: c.args });
    const p = await b.newPage({ viewport: { width: 1000, height: 560 } });
    const t0 = Date.now();
    await p.goto(URL + '?q=' + c.q + '&noaudio=1&autostart=1' + c.extra, { waitUntil: 'load', timeout: 240000 });
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
    const ready = Date.now() - t0;
    const frames = await p.evaluate(async () => {
      const f0 = window.__frames; const t = performance.now();
      await new Promise(r => setTimeout(r, 4000));
      return { frames: window.__frames - f0, ms: performance.now() - t, calls: window.__G.renderer.info.render.calls, tris: window.__G.renderer.info.render.triangles, quality: window.__G.quality.name };
    });
    console.log(JSON.stringify({ name: c.name, readyMs: ready, fps: +(frames.frames / (frames.ms / 1000)).toFixed(1), calls: frames.calls, tris: frames.tris, quality: frames.quality }));
  } catch (e) {
    console.log(JSON.stringify({ name: c.name, error: String(e.message).slice(0, 200) }));
  } finally {
    try { await Promise.race([b.close(), new Promise(r => setTimeout(r, 2000))]); } catch (e) {}
  }
}
process.exit(0);
