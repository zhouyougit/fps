#!/usr/bin/env node
/* =====================================================================
   V34 · WP34-8 成长系统测试
   - 经济：击杀 / 爆头 / 配件购买 / 余额不足 / 训练场折算
   - 评级：难度系数与用时变化
   - 成就：12 个定义、事件驱动解锁、刷新后持久化
   - 挑战：3/6 档奖励只发一次
   - 无 pageerror
   构建：node tools/build.cjs game_v34.html v34
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import fs from 'node:fs';

const CHROME = process.env.CHROME_EXE ||
  (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);

const URL = process.env.SX_URL ||
  'file:///Users/zhouyou/codex_workspace/fps/game_v34.html?q=low&noaudio=1&autostart=1&dt=0.1';

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

let fails = 0, passes = 0;
const ok = (name, cond, data) => {
  if (cond) passes++; else fails++;
  console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (data !== undefined ? ' — ' + JSON.stringify(data) : ''));
};

async function waitReady() {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });
  await page.waitForFunction(() => !!window.__SX_PROGRESS && !!window.__SX, null, { timeout: 60000 });
  await page.waitForTimeout(500);
}

await page.goto(URL, { waitUntil: 'load', timeout: 240000 });
await waitReady();
// 干净存档（首屏建立 file:// origin 之后再清）
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load', timeout: 240000 });
await waitReady();

/* ---------------------------------------------------------- 1. 接口 */
const api = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  const need = ['credits', 'add', 'unlock', 'achievements', 'evaluate'];
  return {
    have: need.filter((k) => typeof P[k] === 'function'),
    defs: P.definitions().length,
    credits: P.credits(),
    badge: (document.querySelector('.x-prog-badge') || {}).textContent || '',
    catalog: (window.__SX_ARMORY && window.__SX_ARMORY.catalog || []).length,
    priced: (window.__SX_ARMORY && window.__SX_ARMORY.catalog || []).filter((c) => c.price > 0).length
  };
});
ok('暴露 __SX_PROGRESS 五个必需接口', api.have.length === 5, api.have);
ok('标题页显示信用点与成就数', /信用点/.test(api.badge) && /成就/.test(api.badge), api.badge);
ok('配件目录 22 项 / 13 个付费档（0/120/260/400）', api.catalog === 22 && api.priced === 13, { catalog: api.catalog, priced: api.priced });

/* ------------------------------------------------- 2. 击杀 / 爆头收益 */
const kill = await page.evaluate(() => {
  const G = window.__G, P = window.__SX_PROGRESS;
  window.__SX.applyMission(0);
  G.game.start({ skipIntro: true });
  try { window.__SX.killAll(); } catch (e) {}
  P.add(-P.credits());
  const start = G.player.pos.clone();
  let e = null, pos = null;
  for (let i = 0; i < 6 && !e; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const p = start.clone();
    p.x += Math.cos(ang) * 6;
    p.z += Math.sin(ang) * 6;
    p.y = G.physics.groundHeight(p.x, p.z, 3);
    if (!isFinite(p.y) || Math.abs(p.y - start.y) > 3) continue;
    try {
      const cand = G.enemies.spawn('hound', p, { passive: true });
      if (cand) { e = cand; pos = p; }
    } catch (err) {}
  }
  if (!e) return { error: 'spawn failed' };
  e.hp = 9999;
  const before = P.credits();
  e.damage(9999, e.pos, new G.THREE.Vector3(0, 0, 1), 'body');
  return { before, after: P.credits(), delta: P.credits() - before, alive: e.alive };
});
ok('击杀 +8 信用点', kill.delta === 8 && kill.alive === false, kill);

const head = await page.evaluate(() => {
  const G = window.__G, P = window.__SX_PROGRESS;
  const start = G.player.pos.clone();
  let out = { error: 'no hit' };
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const p = start.clone();
    p.x += Math.cos(ang) * 5;
    p.z += Math.sin(ang) * 5;
    p.y = G.physics.groundHeight(p.x, p.z, 3);
    if (!isFinite(p.y) || Math.abs(p.y - start.y) > 3) continue;
    let e = null;
    try { e = G.enemies.spawn('hound', p, { passive: true }); } catch (err) { continue; }
    if (!e) continue;
    e.hp = 9999;
    if (e.headPos) e.headPos.set(p.x, p.y + 0.55, p.z);
    const eye = G.player.eye.clone();
    const aim = new G.THREE.Vector3(p.x, p.y + 0.55, p.z).sub(eye).normalize();
    const before = P.credits();
    const hit = G.combat.playerShot(eye, aim, { damage: 9999, range: 60 });
    const delta = P.credits() - before;
    if (hit && hit.surface === 'enemy' && hit.enemy === e) {
      out = { delta, part: hit.part, killed: e.alive === false, before, after: P.credits() };
      break;
    }
    // 没打中：把这发子弹的副作用抹平，继续换方向
    P.add(before - P.credits());
  }
  return out;
});
ok('爆头击杀 +20（8 + 12）', head.delta === 20 && head.part === 'weak' && head.killed === true, head);

/* ------------------------------------------------------ 3. 配件购买 */
const buy = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  P.add(1000 - P.credits());
  window.__SX.armoryOpen();
  const btn = document.querySelector('.x-ar-opt[data-slot="muzzle"][data-opt="supp"]');
  const before = {
    credits: P.credits(),
    locked: !!(btn && btn.classList.contains('locked')),
    text: btn ? btn.textContent : '',
    balance: (document.querySelector('[data-x-balance]') || {}).textContent || ''
  };
  if (btn) btn.click();
  const w = window.__G.weapon.list.find((x) => x.id === 'pac9');
  const saved = window.SXSave.get('economy');
  return {
    before,
    after: P.credits(),
    sel: window.__SX.armory().pac9.muzzle,
    alert: w && w.mods ? w.mods.alert : null,
    unlocked: saved.unlocked,
    balance: (document.querySelector('[data-x-balance]') || {}).textContent || '',
    lockedAfter: !!(document.querySelector('.x-ar-opt[data-slot="muzzle"][data-opt="supp"]') || {}).classList &&
      !!(document.querySelector('.x-ar-opt[data-slot="muzzle"][data-opt="supp"]') || {}).classList.contains('locked')
  };
});
ok('未解锁配件显示价格与锁定样式', buy.before.locked && /260/.test(buy.before.text), buy.before);
ok('购买扣款 260 并自动装备生效', buy.after === 740 && buy.sel === 'supp' && buy.alert === 14 &&
  buy.unlocked.indexOf('pac9:muzzle:supp') >= 0, buy);

const poor = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  P.add(50 - P.credits());
  const tab = document.querySelector('.x-ar-tab[data-wid="dmr"]');
  if (tab) tab.click();
  const btn = document.querySelector('.x-ar-opt[data-slot="optic"][data-opt="x45"]');
  const locked = !!(btn && btn.classList.contains('locked'));
  const priceText = btn ? btn.textContent : '';
  if (btn) btn.click();
  return {
    locked, priceText,
    credits: P.credits(),
    sel: window.__SX.armory().dmr.optic,
    toast: (document.querySelector('.x-pt') || {}).textContent || '',
    stillLocked: !!(document.querySelector('.x-ar-opt[data-slot="optic"][data-opt="x45"]') || {}).classList &&
      !!(document.querySelector('.x-ar-opt[data-slot="optic"][data-opt="x45"]') || {}).classList.contains('locked')
  };
});
ok('余额不足被拒绝（不扣款、不装备）', poor.locked && poor.credits === 50 && poor.sel === 'x3' && /信用点不足/.test(poor.toast), poor);

/* --------------------------------------------------------- 4. 评级 */
const rating = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  const base = { time: 330, kills: 14, damageTaken: 50, retries: 0, relays: 3, relaysTotal: 3 };
  const normal = P.rate(base, 'm1', 'normal');
  const nightmare = P.rate(base, 'm1', 'nightmare');
  const fast = P.rate(Object.assign({}, base, { time: 150 }), 'm1', 'normal');
  const slow = P.rate(Object.assign({}, base, { time: 620 }), 'm1', 'normal');
  return { normal, nightmare, fast, slow };
});
ok('评级随难度变化（噩梦 > 标准）', rating.nightmare.total > rating.normal.total &&
  rating.nightmare.grade !== undefined, { normal: rating.normal.total, nightmare: rating.nightmare.total });
ok('评级随用时变化（快速 > 慢速）', rating.fast.total > rating.slow.total &&
  rating.fast.parts.time === 100 && rating.slow.parts.time < 30,
  { fast: [rating.fast.total, rating.fast.parts.time], slow: [rating.slow.total, rating.slow.parts.time] });

/* --------------------------------------------------------- 5. 成就 */
const ach = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  const defs = P.definitions();
  return {
    count: defs.length,
    complete: defs.every((d) => d.id && d.name && d.desc && d.metric && d.need > 0),
    ids: defs.map((d) => d.id),
    list: P.achievements().map((a) => [a.id, a.unlocked, a.need])
  };
});
ok('12 个成就定义完整', ach.count === 12 && ach.complete, { count: ach.count, ids: ach.ids });

const train = await page.evaluate(() => {
  const G = window.__G, P = window.__SX_PROGRESS;
  const before = P.credits();
  G.events.emit('sx:training-start', {});
  window.__SX.S.training = { active: true, score: 8000, kills: 80, head: 10, t: 0 };
  G.events.emit('sx:training-end', {});
  window.__SX.S.training = null;
  const panel = document.querySelector('.x-tr-panel');
  return {
    delta: P.credits() - before,
    trainBest: P.stats().trainBest,
    unlocked: P.achievements().find((a) => a.id === 'train8000').unlocked,
    creditBox: panel && panel.querySelector('.x-credit') ? panel.querySelector('.x-credit').textContent : ''
  };
});
ok('训练场按分数折算（8000 分 → 400）并解锁成就', train.delta === 400 && train.trainBest === 8000 && train.unlocked === true, train);
ok('训练结算页显示本局收益与总余额', /\+400/.test(train.creditBox) && /总余额/.test(train.creditBox), train.creditBox);

/* ----------------------------------------------------- 6. 挑战奖励 */
const chal = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  const before = P.credits();
  window.__SX.challengeGrant('m1', { time: true, head: true, clean: true });
  window.__SX.challengeGrant('m2', { time: true, head: true, clean: true });
  P.sync();
  const first = P.credits();
  P.sync();
  const second = P.credits();
  return {
    before, first, second,
    delta1: first - before,
    delta2: second - first,
    rewards: P.stats().challengeRewards,
    count: P.stats().challenges,
    ui: window.__SX.challenges().count
  };
});
ok('挑战 3/6 档奖励 500 且只发一次', chal.delta1 === 500 && chal.delta2 === 0 &&
  chal.rewards['3'] === true && chal.rewards['6'] === true && chal.count === 6, chal);

/* ------------------------------------------------- 7. 持久化 + 刷新 */
await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  P.add(777 - P.credits());
  window.SXSave.flush();
});
await page.reload({ waitUntil: 'load', timeout: 240000 });
await waitReady();

const persisted = await page.evaluate(() => {
  const P = window.__SX_PROGRESS;
  const w = window.__G.weapon.list.find((x) => x.id === 'pac9');
  const before = P.credits();
  P.sync();
  return {
    credits: P.credits(),
    kept: before === P.credits(),
    unlocked: P.isUnlocked('pac9:muzzle:supp'),
    ach: P.achievements().find((a) => a.id === 'train8000').unlocked,
    alert: w && w.mods ? w.mods.alert : null,
    sel: window.__SX.armory().pac9.muzzle,
    rewards: P.stats().challengeRewards,
    badge: (document.querySelector('.x-prog-badge') || {}).textContent || ''
  };
});
ok('刷新后信用点/解锁/成就持久化', persisted.credits === 777 && persisted.kept && persisted.unlocked &&
  persisted.ach === true, persisted);
ok('刷新后配件装配与挑战奖励状态保留', persisted.sel === 'supp' && persisted.alert === 14 &&
  persisted.rewards['3'] === true && persisted.rewards['6'] === true, persisted);
ok('刷新后标题页成就数更新', /成就/.test(persisted.badge), persisted.badge);

ok('全程无 pageerror', errs.length === 0, errs.slice(0, 3));

await browser.close();
console.log('\n' + passes + ' PASS / ' + fails + ' FAIL');
process.exit(fails ? 1 : 0);
