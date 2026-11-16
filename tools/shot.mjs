
import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3] || 'tools/shot.png';
const waitMs = +(process.argv[4] || 25000);
const exe = process.env.CHROME_EXE;

const browser = await chromium.launch({
  headless: true, executablePath: exe,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage', '--hide-scrollbars']
});
const page = await browser.newPage({ viewport: { width: +(process.env.W||1280), height: +(process.env.H||720) }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
await page.goto(url, { waitUntil: 'load', timeout: 180000 });
let state = 'timeout';
try {
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: waitMs });
  state = await page.evaluate(() => ({ ready: window.__ready, fatal: window.__fatal, errors: (window.__errors||[]).slice(0,5), gameState: window.__G && window.__G.game && window.__G.game.state }));
} catch (e) { state = 'wait failed: ' + e.message; }
console.log(JSON.stringify({ state, logs: logs.slice(0, 40) }, null, 1));
const stats = await page.evaluate(() => { try { return window.__stats && window.__stats(); } catch(e) { return String(e); } });
console.log('stats', JSON.stringify(stats));
try { await page.screenshot({ path: out, timeout: 120000, animations: 'disabled' }); console.log('shot ok'); } catch (e) { console.log('shot failed', e.message); }
await browser.close();
