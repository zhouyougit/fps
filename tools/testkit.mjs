/* 共享测试工具：GPU 参数、快速 URL、状态等待、固定步进、可靠关闭 */
import { chromium } from 'playwright';
import { PW_ARGS, GPU_MODE, HEADLESS, VIEWPORT, gameUrl } from './pwargs.mjs';

export { PW_ARGS, GPU_MODE, HEADLESS, VIEWPORT, gameUrl };

export async function launchBrowser(overrides) {
  return chromium.launch(Object.assign({
    headless: HEADLESS,
    executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: PW_ARGS
  }, overrides || {}));
}

export async function waitReady(page, timeout = 300000) {
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout });
  const fatal = await page.evaluate(() => window.__fatal);
  if (fatal) throw new Error('game fatal: ' + fatal);
  await page.waitForFunction(() => !!window.__SX, null, { timeout: 30000 });
}

export async function openGame(browser, opts) {
  const o = opts || {};
  const page = await browser.newPage({ viewport: o.viewport || VIEWPORT });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  await page.goto(gameUrl(o.file, o.params), { waitUntil: 'load', timeout: o.timeout || 240000 });
  await waitReady(page, o.readyTimeout || 300000);
  page.__testErrors = errors;
  return page;
}

export async function waitState(page, state, timeout = 30000) {
  await page.waitForFunction((s) => window.__G && window.__G.game.state === s, state, { timeout });
}

export async function step(page, n) {
  return page.evaluate((k) => { if (!window.__SX_LOOP) throw new Error('no __SX_LOOP'); window.__SX_LOOP.step(k); return window.__SX_LOOP.tick(); }, n);
}

export async function closeBrowser(browser) {
  if (!browser) return;
  try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
}

export function logicParams(extra) {
  return Object.assign({ q: 'low', novisual: '1', noaudio: '1', autostart: '1', dt: '0.1' }, extra || {});
}
