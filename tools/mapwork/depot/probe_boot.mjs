import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const target = path.resolve(ROOT, 'tools/mapwork/depot/preview.html');
const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
await page.goto(pathToFileURL(target).href + '?q=low&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
try { await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout: 300000 }); } catch (e) { errs.push('ready timeout'); }
const info = await page.evaluate(() => ({ ready: window.__ready, fatal: window.__fatal || null, sxType: typeof window.__SX, sxKeys: window.__SX ? Object.keys(window.__SX).slice(0, 40) : null, errs: (window.__errors || []).slice(0, 6), ver: window.__SX && window.__SX.mapId ? window.__SX.mapId() : null }));
console.log(JSON.stringify(info, null, 1));
console.log('pageErrors', JSON.stringify(errs.slice(0, 8)));
await browser.close();
