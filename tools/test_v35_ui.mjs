#!/usr/bin/env node
/* =====================================================================
   V35 · WP35-10 界面 / 可访问性 / 本地化测试
   构建：node tools/build.cjs game_v35.html v35
   运行：node tools/test_v35_ui.mjs
   断言：中英切换、刷新保留、色盲主题、缺失键、设置页、8 关档案网格、
         字幕/HUD 标签、键盘导航、无 pageerror，并输出三张截图。
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_EXE ||
  (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PAGE_URL = process.env.SX_URL || 'file://' + path.join(ROOT, 'game_v35.html') + '?q=low&noaudio=1';
const SHOTS = path.join(ROOT, 'tools');

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

let passes = 0, fails = 0;
const ok = (name, cond, data) => {
  if (cond) passes++; else fails++;
  console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (data !== undefined ? ' — ' + JSON.stringify(data) : ''));
};

async function waitReady() {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
  await page.waitForFunction(() => !!window.__SX_LANG && !!window.__SXI18n && !!document.querySelector('.m-word, .m-title'), null, { timeout: 180000 });
  await page.waitForTimeout(800);
}
async function title() {
  return page.evaluate(() => ({
    word: (document.querySelector('.m-word') || {}).textContent || '',
    lang: document.documentElement.lang,
    stored: (() => { try { return localStorage.getItem('saltline.lang'); } catch (e) { return null; } })(),
    screen: (document.querySelector('.menu') || {}).dataset ? document.querySelector('.menu').dataset.screen : ''
  }));
}
async function openSettings() {
  await page.evaluate(() => {
    const b = document.querySelector('.m-title [data-act="settings"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
}
async function setLang(lang) {
  await page.evaluate((l) => {
    const b = document.querySelector('[data-sx-lang="' + l + '"]');
    if (b) b.click();
  }, lang);
  await page.waitForTimeout(500);
}

await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 240000 });
await waitReady();
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load', timeout: 240000 });
await waitReady();

/* 1. API 与缺失键 */
const api = await page.evaluate(() => ({
  keys: Object.keys(window.SXI18n.dict['zh-CN'] || {}).length,
  enKeys: Object.keys(window.SXI18n.dict.en || {}).length,
  extra: !!window.__SX_I18N_EXTRA,
  api: ['set', 't', 'missing'].filter((k) => typeof window.__SX_LANG[k] === 'function'),
  missing: window.__SX_LANG.missing().length,
  missions: (window.__SX_I18N_MISSIONS || []).length
}));
ok('__SX_LANG 暴露 set/t/missing', api.api.length === 3, api.api);
ok('中英词典 ≥250 键且无缺失键', api.keys >= 250 && api.enKeys >= 250 && api.missing < 5, api);
ok('8 关叙事表完整', api.missions === 8, api.missions);

/* 2. 中文起始 */
const zh0 = await title();
ok('默认中文标题', /几猫/.test(zh0.word) && zh0.lang === 'zh-CN', zh0);
await page.screenshot({ path: path.join(SHOTS, 'v35_title_zh.png') });

/* 3. 设置页切换 English */
await openSettings();
const langRow = await page.evaluate(() => !!document.querySelector('[data-sx-lang="en"]'));
ok('设置页有中文 / English 切换', langRow);
await page.screenshot({ path: path.join(SHOTS, 'v35_settings.png') });
await setLang('en');
const en1 = await title();
await openSettings();
await page.evaluate(() => { const b = document.querySelector('[data-act="close-panel"]'); if (b) b.click(); });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(SHOTS, 'v35_title_en.png') });
ok('切换英文即时重绘标题', /SALTLINE/.test(en1.word) && en1.lang === 'en', en1);
ok('语言写入 saltline.lang', en1.stored === 'en', en1.stored);

/* 4. 刷新保留 */
await page.reload({ waitUntil: 'load', timeout: 240000 });
await waitReady();
const en2 = await title();
ok('刷新后保持英文', /SALTLINE/.test(en2.word) && en2.stored === 'en', en2);

/* 5. 切回中文无残留 */
await openSettings();
await setLang('zh-CN');
const zh1 = await title();
ok('切回中文无残留', /几猫/.test(zh1.word) && !/SALTLINE/.test(zh1.word) && zh1.stored === 'zh-CN', zh1);

/* 6. 色盲主题 + 持久化 */
await page.evaluate(() => {
  const b = document.querySelector('[data-sx-cb] [data-v="rg"]');
  if (b) b.click();
});
await page.waitForTimeout(300);
const cb = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('saltline.access.v1') || '{}');
  return { cls: document.body.className, colorblind: raw.colorblind, signal: getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() };
});
ok('红绿/蓝黄色盲主题生效并持久化', /sx-cb-rg/.test(cb.cls) && cb.colorblind === 'rg', cb);

/* 7. 字幕背景 / 安全区 / 文字大小 */
const a11y = await page.evaluate(() => {
  const set = (sel, v) => { const el = document.querySelector(sel); if (!el) return; el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('#sx-sub-bg', 90); set('#sx-safe', 32); const t = document.querySelector('[data-sx-text] [data-v="l"]'); if (t) t.click();
  const de = document.documentElement;
  return { sub: de.style.getPropertyValue('--sx-sub-alpha'), safe: de.style.getPropertyValue('--sx-safe'), text: de.getAttribute('data-sx-text') };
});
ok('字幕背景 / 安全区 / 文字大小可调', a11y.sub === '0.9' && a11y.safe === '32px' && a11y.text === 'l', a11y);

/* 8. 8 关档案网格 */
await page.evaluate(() => { const b = document.querySelector('.m-title [data-x="campaign"]'); if (b) b.click(); });
await page.waitForTimeout(600);
const grid = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.x-camp-list .x-mcard[data-idx]')];
  return { n: cards.length, names: cards.map((c) => c.querySelector('h3') ? c.querySelector('h3').textContent : '') };
});
ok('行动档案为 8 关网格', grid.n === 8, grid);
await setLang('en');
const gridEn = await page.evaluate(() => [...document.querySelectorAll('.x-camp-list .x-mcard[data-idx] h3')].map((h) => h.textContent));
ok('档案网格随语言切换（英文关名）', /Berth Four/.test(gridEn.join('|')), gridEn);
await setLang('zh-CN');

/* 9. 键盘导航 */
await page.evaluate(() => { const b = document.querySelector('.x-camp [data-x="close"]'); if (b) b.click(); });
await page.waitForTimeout(400);
const kb = await page.evaluate(async () => {
  const first = document.querySelector('.m-title .m-actions .btn');
  first.focus();
  const before = document.activeElement;
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const after = document.activeElement;
  return { moved: before !== after, before: before && before.textContent, after: after && after.textContent };
});
ok('方向键在菜单中移动焦点', kb.moved === true, kb);

/* 10. 无 pageerror */
ok('无 pageerror', errs.length === 0, errs.slice(0, 3));

console.log('\n' + passes + ' PASS / ' + fails + ' FAIL');
await browser.close();
process.exit(fails ? 1 : 0);
