import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { existsSync } from 'node:fs';

const FILE = 'file:///Users/zhouyou/codex_workspace/fps/game_v33.html?q=low&noaudio=1&autostart=1&dt=0.1';
const CHROME = process.env.CHROME_EXE || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
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

await page.goto(FILE, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true && !!window.__SX_FEEDBACK, null, { timeout: 420000 });
await page.waitForTimeout(300);

const clearFx = () => page.evaluate(() => {
  document.querySelectorAll('.xf-layer .xf-hit, .xf-layer .xf-dmg, .xf-layer .xf-kill, .xf-layer .xf-streak, .xf-layer .xf-armor-flash').forEach(e => e.remove());
});

/* 1 · 普通命中：白色小十字 + 数字 */
await clearFx();
const body = await page.evaluate(() => {
  const r = window.__SX_FEEDBACK.hit('body');
  const el = document.querySelector('.xf-hit--body');
  const dmg = document.querySelector('.xf-dmg--body');
  return {
    marker: !!el,
    kind: el && el.dataset.kind,
    color: el ? getComputedStyle(el.querySelector('i')).backgroundColor : null,
    size: el ? el.getBoundingClientRect().width : 0,
    number: !!dmg,
    text: dmg && dmg.textContent,
    ret: !!r && r.kind
  };
});
ok('普通命中生成白色 .xf-hit--body', body.marker && body.kind === 'body' && body.color === 'rgb(255, 255, 255)' && body.number, body);
ok('普通命中数字默认白色 28', body.number && body.text === '28', body.text);

/* 2 · 爆头：金色更大 + 菱形 + 金色数字 */
await clearFx();
const head = await page.evaluate(() => {
  window.__SX_FEEDBACK.hit('head');
  const el = document.querySelector('.xf-hit--head');
  const dmg = document.querySelector('.xf-dmg--head');
  return {
    marker: !!el,
    kind: el && el.dataset.kind,
    color: el ? getComputedStyle(el.querySelector('i')).backgroundColor : null,
    dia: !!(el && el.querySelector('.xf-dia')),
    size: el ? +el.getBoundingClientRect().width.toFixed(1) : 0,
    number: !!dmg,
    numColor: dmg ? getComputedStyle(dmg).color : null
  };
});
ok('爆头金色标记 + 中心菱形', head.marker && head.kind === 'head' && head.color === 'rgb(255, 209, 102)' && head.dia && head.number, head);
ok('爆头标记比普通更大', head.size > body.size, { body: body.size, head: head.size });

/* 3 · 击杀：红色扩散 + 武器/距离/爆头播报 */
await clearFx();
const kill = await page.evaluate(() => {
  window.__SX_FEEDBACK.hit('kill', { headshot: true, distance: 21, weapon: '测试步枪' });
  const el = document.querySelector('.xf-hit--kill');
  const banner = document.querySelector('.xf-kill');
  const dmg = document.querySelector('.xf-dmg--kill');
  return {
    marker: !!el,
    color: el ? getComputedStyle(el.querySelector('i')).backgroundColor : null,
    ring: !!(el && el.querySelector('.xf-ring')),
    banner: !!banner,
    bannerText: banner ? banner.textContent : null,
    number: !!dmg
  };
});
ok('击杀红色标记 + 扩散环', kill.marker && kill.color === 'rgb(255, 74, 61)' && kill.ring, kill);
ok('击杀播报含武器/距离/爆头', kill.banner && /测试步枪/.test(kill.bannerText) && /21m/.test(kill.bannerText) && /爆头/.test(kill.bannerText) && kill.number, kill.bannerText);

/* 4 · 连杀 2/3 复用/自计数 */
await clearFx();
const streak = await page.evaluate(() => {
  const before = window.__SX_FEEDBACK.state().kills;
  for (let i = 0; i < 2; i++) window.__SX_FEEDBACK.hit('kill');
  const all = [...document.querySelectorAll('.xf-streak')];
  return { before, after: window.__SX_FEEDBACK.state().kills, texts: all.map(e => e.textContent) };
});
ok('连杀 2/3 自行计数并播报', streak.after >= streak.before + 2 && streak.texts.some(t => /三杀/.test(t)), streak);

/* 5 · 伤害数字 0.7s 上浮后消失 */
await clearFx();
await page.evaluate(() => { window.__SX_FEEDBACK.hit('body', { damage: 33, target: 'ttl' }); });
const numAlive = await page.evaluate(() => document.querySelectorAll('.xf-dmg').length);
await page.waitForTimeout(900);
const numGone = await page.evaluate(() => document.querySelectorAll('.xf-dmg').length);
ok('伤害数字出现并在 0.8s 内消失', numAlive === 1 && numGone === 0, { numAlive, numGone });

/* 6 · 同目标 80ms 合并 */
await clearFx();
const merge = await page.evaluate(() => {
  window.__SX_FEEDBACK.hit('body', { damage: 10, target: 'merge' });
  window.__SX_FEEDBACK.hit('body', { damage: 12, target: 'merge' });
  const list = [...document.querySelectorAll('.xf-dmg')];
  return { count: list.length, text: list[0] && list[0].textContent };
});
ok('同一目标 80ms 内伤害合并', merge.count === 1 && merge.text === '22', merge);

/* 7 · F9 开关（API 同路径）+ localStorage 持久化 */
await clearFx();
const toggle = await page.evaluate(() => {
  const off = window.__SX_FEEDBACK.toggleNumbers();
  window.__SX_FEEDBACK.hit('body');
  const offCount = document.querySelectorAll('.xf-dmg').length;
  const on = window.__SX_FEEDBACK.toggleNumbers();
  window.__SX_FEEDBACK.hit('body');
  const onCount = document.querySelectorAll('.xf-dmg').length;
  return { off, on, offCount, onCount, stored: localStorage.getItem('saltline.feedback.v1') };
});
ok('关闭伤害数字后不再出现，重开恢复', toggle.off === false && toggle.offCount === 0 && toggle.on === true && toggle.onCount === 1 && /"numbers":true/.test(toggle.stored || ''), toggle);

/* 7b · F9 实际按键切换 */
await page.evaluate(() => { if (!window.__SX_FEEDBACK.state().numbers) window.__SX_FEEDBACK.toggleNumbers(); });
await page.keyboard.press('F9');
await page.waitForTimeout(60);
const f9off = await page.evaluate(() => window.__SX_FEEDBACK.state().numbers);
await page.keyboard.press('F9');
await page.waitForTimeout(60);
const f9on = await page.evaluate(() => window.__SX_FEEDBACK.state().numbers);
ok('F9 切换伤害数字开关', f9off === false && f9on === true, { f9off, f9on });

/* 8 · 护甲吸收：蓝色标记 + 蓝白屏缘闪 */
await clearFx();
const armor = await page.evaluate(() => {
  window.__G.events.emit('sx:armor-absorb', { amount: 14, armor: 36 });
  const el = document.querySelector('.xf-hit--armor');
  return {
    marker: !!el,
    color: el ? getComputedStyle(el.querySelector('i')).backgroundColor : null,
    flash: !!document.querySelector('.xf-armor-flash')
  };
});
ok('护甲吸收蓝色层不覆盖命中层', armor.marker && armor.color === 'rgb(143, 216, 255)' && armor.flash, armor);

/* 9 · 受击方向弧，联机时禁用自绘 */
const arc = await page.evaluate(async () => {
  const G = window.__G;
  document.querySelectorAll('.xf-arc.on').forEach(e => e.classList.remove('on'));
  const src = G.player.pos.clone();
  src.z -= 6;
  G.events.emit('player:hit', { amount: 9, fromPos: src });
  await new Promise(r => setTimeout(r, 60));
  const solo = document.querySelectorAll('.xf-arc.on').length;
  const realMP = window.__MP;
  window.__MP = { state: () => ({ active: true }) };
  const src2 = G.player.pos.clone();
  src2.x += 6;
  G.events.emit('player:hit', { amount: 9, fromPos: src2 });
  await new Promise(r => setTimeout(r, 80));
  const mpCount = document.querySelectorAll('.xf-arc.on').length;
  window.__MP = realMP;
  return { solo, mpCount, mp: window.__SX_FEEDBACK.state().mp };
});
ok('受击方向弧显示，联机时不自绘', arc.solo >= 1 && arc.mpCount === arc.solo, arc);

/* 10 · 低血量脉冲，reduce-motion 关闭 */
const low = await page.evaluate(async () => {
  const G = window.__G;
  G.player.invulnerable = true;
  const lock = setInterval(() => { G.player.health = 20; }, 8);
  await new Promise(r => setTimeout(r, 260));
  const on = document.querySelector('.xf-lowhp').classList.contains('on');
  document.body.classList.add('reduce-motion');
  await new Promise(r => setTimeout(r, 260));
  const off = document.querySelector('.xf-lowhp').classList.contains('on');
  document.body.classList.remove('reduce-motion');
  clearInterval(lock);
  G.player.health = 100;
  await new Promise(r => setTimeout(r, 120));
  return { on, off, health: G.player.health };
});
ok('低血量 <35 脉冲，reduce-motion 关闭', low.on === true && low.off === false && low.health === 100, low);

/* 11 · DOM 层级低于菜单 */
const layer = await page.evaluate(() => {
  const l = document.querySelector('.xf-layer');
  const menu = document.querySelector('.menu');
  return {
    z: l ? getComputedStyle(l).zIndex : null,
    insideHud: !!(l && l.closest('.hud')),
    menuZ: menu ? getComputedStyle(menu).zIndex : null,
    pointer: l ? getComputedStyle(l).pointerEvents : null
  };
});
ok('反馈层挂在 .hud 内且 z-index 低于菜单', layer.insideHud && layer.z === '0' && layer.pointer === 'none', layer);

/* 12 · 无 pageerror */
await page.waitForTimeout(400);
ok('无 pageerror', errs.length === 0, errs.slice(0, 3));

await browser.close();
console.log(fails ? fails + ' 项失败' : '全部通过');
process.exit(fails ? 1 : 0);
