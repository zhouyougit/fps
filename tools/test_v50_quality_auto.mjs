#!/usr/bin/env node
/* V50 · 设置里“自动画质”选项回归 */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message || e)));
await page.goto('file://' + process.cwd() + '/game.html?noaudio=1&autostart=1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__G) || window.__fatal, null, { timeout: 300000 });
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } };
const read = () => page.evaluate(() => {
  const btn = document.querySelector('[data-q="auto"]');
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('saltline.settings.v1') || 'null'); } catch (e) {}
  return { hasAuto: !!btn, text: btn && btn.textContent, quality: window.__G.quality && window.__G.quality.name, autoQuality: !!window.__G.autoQuality, saved: saved && saved.quality };
});
const before = await read();
ok('设置里存在“自动”画质按钮', before.hasAuto && before.text === '自动', before);
await page.evaluate(() => document.querySelector('[data-q="auto"]').click());
await page.waitForTimeout(80);
const auto = await read();
ok('点击自动后持久化为 auto、autoQuality=true', auto.saved === 'auto' && auto.autoQuality === true && /low|medium|high|ultra/.test(auto.quality), auto);
await page.evaluate(() => document.querySelector('[data-q="high"]').click());
await page.waitForTimeout(80);
const high = await read();
ok('点击高画质后为 high、autoQuality=false', high.saved === 'high' && high.quality === 'high' && high.autoQuality === false, high);
await page.evaluate(() => document.querySelector('[data-q="auto"]').click());
await page.waitForTimeout(80);
const back = await read();
ok('可以从手动档切回自动', back.saved === 'auto' && back.autoQuality === true, back);
ok('无 pageerror', errs.length === 0, errs.slice(0, 3));
console.log(pass + ' PASS / ' + fail + ' FAIL');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(fail ? 1 : 0);
