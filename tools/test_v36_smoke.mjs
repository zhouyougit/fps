#!/usr/bin/env node
/* V36 冒烟：产物级检查（profile / 8 张行动卡 / 6 格武器栏 / 词典 / 联机 API / pageerror） */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { existsSync } from 'node:fs';

const url = new URL('../versions/几猫_V36.html?q=low&noaudio=1', import.meta.url).href;
const CHROME = [process.env.CHROME_EXE, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && existsSync(p));
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
let fails = 0;
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); };

await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 420000 });
try {
  await page.waitForFunction(() => !!(window.__SX_LANG && window.__SX2 && window.__SX_NET), null, { timeout: 30000 });
} catch (e) {}
await page.waitForTimeout(800);

const boot = await page.evaluate(() => ({
  ready: window.__ready,
  fatal: window.__fatal,
  profile: window.__BUILD__ && window.__BUILD__.profile,
  label: window.__VERSION_LABEL
}));
ok('V36 产物 profile', boot.ready && !boot.fatal && boot.profile === 'v36', boot);

const cards = await page.evaluate(() => {
  if (window.__SX && window.__SX.openMissions) window.__SX.openMissions();
  return {
    missions: window.__SX_CAMP && window.__SX_CAMP.missions ? window.__SX_CAMP.missions.length : 0,
    cards: document.querySelectorAll('.x-mcard[data-idx]').length,
    allCards: document.querySelectorAll('.x-mcard').length
  };
});
ok('8 张行动卡', cards.missions === 8 && cards.cards === 8 && cards.allCards === cards.cards + 1, cards);

await page.evaluate(() => { if (window.__SX && window.__SX.launchFast) window.__SX.launchFast(0); });
try {
  await page.waitForFunction(() => document.querySelectorAll('.x-loadout .x-slot').length === 6, null, { timeout: 20000 });
} catch (e) {}
const loadout = await page.evaluate(() => ({
  slots: document.querySelectorAll('.x-loadout .x-slot').length,
  weapons: window.__G && window.__G.weapon && window.__G.weapon.list ? window.__G.weapon.list.length : 0
}));
ok('.x-loadout 6 格', loadout.slots === 6 && loadout.weapons === 6, loadout);

const lang = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  missing: window.__SX_LANG ? window.__SX_LANG.missing() : null
}));
ok('__SX_LANG 词典无缺失', Array.isArray(lang.missing) && lang.missing.length === 0, lang);

const globals = await page.evaluate(() => ({
  sx2: !!window.__SX2,
  net: !!window.__SX_NET,
  netVersion: window.__SX_NET && window.__SX_NET.version
}));
ok('__SX2 / __SX_NET 存在', globals.sx2 && globals.net, globals);

ok('无 pageerror', errs.length === 0, errs.slice(0, 3));

console.log(fails ? fails + ' 项失败' : '全部通过');
try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
process.exit(fails ? 1 : 0);
