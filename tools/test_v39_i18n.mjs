#!/usr/bin/env node
/* =====================================================================
   V39 · 本地化收尾回归（军械库 / 联机播报 / 远端换弹动作）
   覆盖：
     1) i18n 词典完整：zh 全键有 en，missing=0
     2) 军械库 6 把枪：页签名 / 槽位名 / 全部配件名+描述中英双向；
        切英文后界面无中文（renderArmory 走 t(key)）
     3) 联机 12 个动态字符串：击杀 / 被击杀 / 据点占领 / 中立 / 争夺 /
        分队 / 换队 / 热身 / 加时 / 平局 / BOT 标识 / 比分板模式名
        + 大厅与连接错误码
     4) 远端角色 reloadStart：枪口下压 + 弹匣脱离（复用现有 rig 关节）
     5) 无 pageerror
   用法：node tools/test_v39_i18n.mjs [--no-build]
   环境变量：SX_HTML（指定产物）、SX_PROFILE（默认 v39）、
            SX_PAGE_TIMEOUT（加载超时 ms，默认 240000）
   ===================================================================== */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const NO_BUILD = args.includes('--no-build');
const TIMEOUT = Number(process.env.SX_PAGE_TIMEOUT || 240000);
const PROFILE = process.env.SX_PROFILE || 'v39';
const cacheDir = path.join(root, 'tools', '.cache');
// 默认构建到 cache，绝不覆盖 versions/ 里的历史快照；需要测历史产物时用 SX_HTML 指定。
const htmlPath = process.env.SX_HTML
  ? path.resolve(process.env.SX_HTML)
  : path.join(cacheDir, 'v39_i18n_build.html');
const fallbackPath = path.join(cacheDir, 'v39_i18n_v38.html');

function newestSource() {
  let newest = 0;
  for (const f of readdirSync(path.join(root, 'src'))) {
    if (!/\.(js|html)$/.test(f)) continue;
    newest = Math.max(newest, statSync(path.join(root, 'src', f)).mtimeMs);
  }
  return newest;
}
function build(target, profile) {
  const rel = path.relative(root, target);
  execFileSync(process.execPath, [path.join('tools', 'build.cjs'), rel, profile], { cwd: root, stdio: 'inherit' });
}
/** 优先用 v39 profile；ext_lod.js 尚未落地时退回 v38（模块集合同样包含本次改动） */
function ensureBuild() {
  if (process.env.SX_HTML || NO_BUILD) return { built: false, stale: false, target: htmlPath, profile: PROFILE };
  const stale = !existsSync(htmlPath) || statSync(htmlPath).mtimeMs < newestSource();
  if (!stale) return { built: false, stale, target: htmlPath, profile: PROFILE };
  mkdirSync(cacheDir, { recursive: true });
  try {
    build(htmlPath, PROFILE);
    return { built: true, stale, target: htmlPath, profile: PROFILE };
  } catch (e) {
    if (!existsSync(path.join(root, 'src', 'ext_lod.js')) && PROFILE === 'v39') {
      console.log('[test] src/ext_lod.js 未落地，v39 profile 无法构建 —— 临时用 v38 profile 校验本地化模块');
      build(fallbackPath, 'v38');
      return { built: true, stale, target: fallbackPath, profile: 'v38' };
    }
    throw e;
  }
}

let fails = 0;
const results = [];
function ok(name, cond, detail) {
  const pass = !!cond;
  if (!pass) fails++;
  results.push({ name, pass });
  console.log((pass ? 'PASS' : 'FAIL') + ' · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
}

const buildInfo = ensureBuild();
console.log('[test] 产物 ' + path.relative(root, buildInfo.target) + ' · profile ' + buildInfo.profile +
  (buildInfo.built ? '（已重新构建）' : '（直接使用）'));

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String((e && e.message) || e)));

const URL = pathToFileURL(buildInfo.target).href + '?q=low&noaudio=1';
const CJK = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/;

try {
  await page.goto(URL, { waitUntil: 'load', timeout: TIMEOUT });
  await page.waitForFunction(
    () => window.__ready === true && window.__SX_LANG && window.__SX_UI2 && window.__MP && window.__SX_ARMORY,
    null, { timeout: TIMEOUT });
  await page.waitForTimeout(1200);

  /* 1) 词典完整性 */
  const boot = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    missing: (window.__SX_LANG.missing() || []),
    zhKeys: Object.keys(window.SXI18n.dict['zh-CN']).length,
    enKeys: Object.keys(window.SXI18n.dict.en).length,
    armKeys: Object.keys(window.SXI18n.dict['zh-CN']).filter(k => k.indexOf('ui2.ar.') === 0).length,
    mpKeys: Object.keys(window.SXI18n.dict['zh-CN']).filter(k => k.indexOf('ui2.mp.') === 0).length
  }));
  ok('启动：zh/en 词典同键、missing=0',
    boot.lang.indexOf('zh') === 0 && boot.missing.length === 0 && boot.zhKeys === boot.enKeys,
    { lang: boot.lang, zhKeys: boot.zhKeys, enKeys: boot.enKeys, missing: boot.missing.slice(0, 8) });
  ok('V39 词典条目已挂载（军械库 ≥114 / 联机 ≥140）',
    boot.armKeys >= 114 && boot.mpKeys >= 140, { armKeys: boot.armKeys, mpKeys: boot.mpKeys });

  /* 1b) 标题界面不能被联机 HUD / 回合横幅盖住（语言刷新只重绘文本） */
  const overlays0 = await page.evaluate(async () => {
    const read = () => ({
      match: !!document.querySelector('.x-mp-match.on'),
      round: !!document.querySelector('.x-mp-round.on'),
      hud: !!document.querySelector('.x-mp-hud.on'),
      dead: !!document.querySelector('.x-mp-dead.on'),
      score: !!document.querySelector('.x-mp-score.on'),
      caps: !!document.querySelector('.x-mp-caps.on'),
      nav: !!document.querySelector('.x-mp.on'),
      hk: (document.querySelector('.h-k') || {}).textContent || ''
    });
    const zh = read();
    window.__SX_LANG.set('en');
    await new Promise(r => setTimeout(r, 400));
    const en = read();
    window.__SX_LANG.set('zh-CN');
    await new Promise(r => setTimeout(r, 400));
    return { zh, en };
  });
  const clean = o => !o.match && !o.round && !o.hud && !o.dead && !o.score && !o.caps && !o.nav &&
    o.hk !== '联机对战' && o.hk !== 'MULTIPLAYER';
  ok('标题界面不被联机状态条/回合横幅覆盖（中英切换后仍保持）',
    clean(overlays0.zh) && clean(overlays0.en), overlays0);

  /* 2) 军械库：中文基线 */
  const armZh = await page.evaluate(async () => {
    window.__SX_LANG.set('zh-CN');
    window.__SX.armoryOpen();
    await new Promise(r => setTimeout(r, 500));
    const txt = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    return {
      on: !!document.querySelector('.x-armory.on'),
      tabs: [...document.querySelectorAll('.x-ar-tab span')].map(e => e.textContent.trim()),
      slots: [...document.querySelectorAll('.x-ar-row-h b')].map(e => e.textContent.trim()),
      opts: [...document.querySelectorAll('.x-ar-opt b')].map(e => e.textContent.trim()),
      descs: [...document.querySelectorAll('.x-ar-opt span')].map(e => e.textContent.trim()),
      kicker: txt('.x-armory .m-k'), title: txt('.x-armory h2'),
      stats: [...document.querySelectorAll('.x-ar-stat span')].map(e => e.textContent.trim())
    };
  });
  ok('军械库中文：6 把枪页签 + 配件名/描述齐全',
    armZh.on && armZh.tabs.length === 6 && armZh.opts.length >= 8 &&
    armZh.tabs.every(s => /[\u4e00-\u9fff]/.test(s)) &&
    armZh.opts.some(s => /[\u4e00-\u9fff]/.test(s)),
    { tabs: armZh.tabs, opts: armZh.opts.slice(0, 4), kicker: armZh.kicker });

  /* 3) 军械库：切英文后逐把枪检查无中文 */
  const armEn = await page.evaluate(async () => {
    window.__SX_LANG.set('en');
    await new Promise(r => setTimeout(r, 500));
    const txt = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    const tabs = [...document.querySelectorAll('.x-ar-tab')];
    const per = [];
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].click();
      await new Promise(r => setTimeout(r, 140));
      per.push({
        tab: tabs[i].querySelector('span').textContent.trim(),
        title: tabs[i].getAttribute('title'),
        slots: [...document.querySelectorAll('.x-ar-row-h b')].map(e => e.textContent.trim()),
        opts: [...document.querySelectorAll('.x-ar-opt b')].map(e => e.textContent.trim()),
        descs: [...document.querySelectorAll('.x-ar-opt span')].map(e => e.textContent.trim())
      });
    }
    const statKeys = ['damage', 'rpm', 'mag', 'reload', 'recoil', 'spread', 'fov'];
    const cat = window.__SX_ARMORY.catalog || [];
    const I = window.SXI18n;
    const bad = [];
    for (const it of cat) {
      const kn = 'ui2.ar.attach.' + it.wid + '.' + it.slot + '.' + it.opt + '.name';
      const kd = kn.replace(/\.name$/, '.desc');
      if (!I.has(kn) || !I.has(kd)) bad.push('missing:' + kn);
      if (/[\u4e00-\u9fff]/.test(I.dict.en[kn] || '')) bad.push('zh-in-en:' + kn);
      if (/[\u4e00-\u9fff]/.test(I.dict.en[kd] || '')) bad.push('zh-in-en:' + kd);
    }
    return {
      tabs: per.map(p => p.tab), titles: per.map(p => p.title), per,
      kicker: txt('.x-armory .m-k'), title: txt('.x-armory h2'),
      back: txt('.x-ar-actions .btn'), stats: [...document.querySelectorAll('.x-ar-stat span')].map(e => e.textContent.trim()),
      statsOk: statKeys.every(k => !/[\u4e00-\u9fff]/.test(I.dict.en['ui2.armory.stat.' + k] || '')),
      catTotal: cat.length, bad
    };
  });
  const armAll = [armEn.kicker, armEn.title, armEn.back].concat(armEn.tabs, armEn.stats);
  for (const p of armEn.per) armAll.push(...[p.title || '', ...p.slots, ...p.opts, ...p.descs]);
  ok('军械库切英文：骨架 / 页签 / 槽位 / 配件名 / 描述 / 统计全部无中文',
    armEn.per.length === 6 && armEn.statsOk && armEn.tabs.every(s => !CJK.test(s)) &&
    !armAll.some(s => CJK.test(s)),
    { kicker: armEn.kicker, title: armEn.title, back: armEn.back, tabs: armEn.tabs, stats: armEn.stats });
  ok('军械库 6 把枪英文短名正确',
    JSON.stringify(armEn.tabs) === JSON.stringify(['Type-9', 'Breaker', 'Long-Eye', 'Whistle', 'Anchor', 'Fang']) &&
    Array.isArray(armEn.titles) && armEn.titles.every(s => s && !CJK.test(s)),
    { tabs: armEn.tabs, titles: armEn.titles });
  ok('全部 42 条配件的中英键齐备且英文无中文',
    armEn.catTotal === 42 && armEn.bad.length === 0, { total: armEn.catTotal, bad: armEn.bad.slice(0, 6) });
  ok('每把枪至少含 3 个槽位与 6 个以上配件',
    armEn.per.every(p => p.slots.length >= 3 && p.opts.length >= 6),
    armEn.per.map(p => p.tab + ':' + p.slots.length + '/' + p.opts.length));

  /* 4) 联机大厅英文 */
  const lobby = await page.evaluate(async () => {
    window.__MP.open();
    await new Promise(r => setTimeout(r, 250));
    const mp = document.querySelector('.x-mp');
    const txt = s => { const el = mp.querySelector(s); return el ? el.textContent.trim() : null; };
    return {
      on: !!mp.classList.contains('on'),
      kicker: txt('.m-k'), title: txt('h2'), sub: txt('.x-mp-sub'),
      labels: [...mp.querySelectorAll('.x-mp-row label')].map(e => e.textContent.trim()),
      maps: [...mp.querySelectorAll('[data-mp-map] option')].map(e => e.textContent.trim()),
      modes: [...mp.querySelectorAll('[data-mp-mode] option')].map(e => e.textContent.trim()),
      join: txt('[data-mp-join]'), back: txt('[data-mp-back]'), note: txt('.x-mp-note')
    };
  });
  const lobbyAll = [lobby.kicker, lobby.title, lobby.sub, lobby.join, lobby.back, lobby.note]
    .concat(lobby.labels, lobby.maps, lobby.modes);
  ok('联机大厅切英文：标题 / 字段 / 地图 / 模式 / 按钮 / 注记无中文',
    lobby.on && !lobbyAll.some(s => CJK.test(s || '')) &&
    /Harbor/.test(lobby.maps[0] || '') && /Team Deathmatch/.test(lobby.modes[0] || ''),
    { kicker: lobby.kicker, title: lobby.title, labels: lobby.labels, maps: lobby.maps, modes: lobby.modes, join: lobby.join });

  /* 5) 联机 12 个动态字符串（英文） */
  const dynEn = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const N = window.__MP.net2;
    const q = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    const lastFeed = () => {
      const list = [...document.querySelectorAll('.h-feed .h-fl')];
      return list.length ? list[list.length - 1].textContent.trim() : null;
    };
    const out = {};
    N.testMsg({ t: 'join', player: { id: 'other-1', name: 'Charlie', team: 0, x: 0, y: 0, z: 0 } });
    /* 1 击杀播报 */
    N.testMsg({ t: 'kill', by: 'x1', victim: 'y1', byName: 'Alpha', victimName: 'Bravo', wpn: 'pac9', hs: true, warmup: true });
    await wait(40);
    out.killFeed = lastFeed();
    /* 2 被击杀 */
    N.testDie('Bravo');
    await wait(30);
    out.death = q('.x-mp-dead .s');
    N.testRevive();
    /* 3 据点占领 */
    N.testMsg({ t: 'pointCaptured', id: 'A', owner: 1, teams: [1, 0] });
    await wait(40);
    out.captureFeed = lastFeed();
    out.capOwned = q('[data-cap="A"] span');
    /* 4 据点中立 */
    N.testMsg({ t: 'pointNeutralized', id: 'B' });
    await wait(40);
    out.neutralFeed = lastFeed();
    out.capNeutral = q('[data-cap="B"] span');
    /* 5 据点争夺 */
    N.testMsg({ t: 'caps', caps: [{ id: 'C', contested: true, owner: -1, progress: 0.4 }] });
    await wait(40);
    out.contested = q('[data-cap="C"] span');
    /* 6 分队 */
    out.team = q('[data-mp-team]');
    /* 7 换队 */
    N.testMsg({ t: 'teamChange', id: 'other-1', team: 1 });
    await wait(40);
    out.teamChange = q('.x-mp-banner');
    /* 8 热身 */
    N.testMsg({ t: 'matchState', state: 'warmup' });
    await wait(40);
    out.warmup = q('[data-mp-state]');
    out.warmupSub = q('[data-mp-round-s]');
    /* 9 加时 */
    N.testMsg({ t: 'overtime', seconds: 60 });
    await wait(40);
    out.overtime = q('.x-mp-banner');
    out.overtimeState = q('[data-mp-state]');
    out.overtimeMsg = q('.h-msg');
    /* 10 平局 */
    N.testMsg({ t: 'roundEnd', draw: true, teams: [3, 3] });
    await wait(40);
    out.draw = q('[data-mp-round-t]');
    out.drawSub = q('[data-mp-round-s]');
    /* 11 BOT 标识 */
    N.testUpsert([{ id: 'bot-1', name: 'BOT-9', team: 0, x: 1, y: 0, z: 1, hp: 100 }]);
    await wait(40);
    const tags = N.testTags();
    const botTag = tags.find(t => t && t._nm && t._nm.textContent === 'BOT-9');
    out.bot = botTag ? { text: botTag._bot.textContent.trim(), shown: botTag._bot.style.display !== 'none' } : null;
    /* 12 比分板模式名 + BOT 行 */
    N.testMsg({ t: 'score', mode: 'tdm', teams: [2, 1], players: [
      { id: 'bot-1', name: 'BOT-9', team: 0, kills: 2, deaths: 1 },
      { id: 'other-1', name: 'Charlie', team: 1, kills: 1, deaths: 2 }
    ] });
    N.testScoreboard(true);
    await wait(40);
    out.scoreTitle = q('.x-mp-score h3');
    out.scoreSub = q('[data-mp-score-sub]');
    out.scoreHeads = [...document.querySelectorAll('.x-mp-score thead th')].map(e => e.textContent.trim());
    out.scoreBot = q('.x-mp-score tbody span.bot');
    /* 连接错误码 */
    N.testMsg({ t: 'error', code: 'room_full' });
    await wait(40);
    out.connError = q('.x-mp-status');
    N.testScoreboard(false);
    return out;
  });

  const dynFields = {
    '击杀播报': dynEn.killFeed,
    '被击杀': dynEn.death,
    '据点占领播报': dynEn.captureFeed,
    '据点旗帜(占领)': dynEn.capOwned,
    '据点中立播报': dynEn.neutralFeed,
    '据点旗帜(中立)': dynEn.capNeutral,
    '据点争夺': dynEn.contested,
    '分队': dynEn.team,
    '换队': dynEn.teamChange,
    '热身': dynEn.warmup,
    '热身副标': dynEn.warmupSub,
    '加时': dynEn.overtime,
    '加时状态': dynEn.overtimeState,
    '加时提示': dynEn.overtimeMsg,
    '平局': dynEn.draw,
    '平局副标': dynEn.drawSub,
    'BOT 标识': dynEn.bot && dynEn.bot.text,
    '比分板模式名': dynEn.scoreTitle,
    '比分板副标': dynEn.scoreSub,
    '计分板表头': (dynEn.scoreHeads || []).join(' / '),
    '比分板 BOT': dynEn.scoreBot,
    '连接错误码': dynEn.connError
  };
  const dynZh = Object.keys(dynFields).filter(k => CJK.test(String(dynFields[k] || '')));
  ok('联机 12 类动态播报切英文后无中文（含据点/比分板/错误码）',
    dynZh.length === 0 && dynEn.bot && dynEn.bot.text === 'BOT' && dynEn.bot.shown,
    { zhLeft: dynZh, fields: dynFields });
  ok('击杀播报含英文武器短名与爆头标记',
    /Alpha ▸ Bravo/.test(dynEn.killFeed || '') && /Headshot/.test(dynEn.killFeed || '') &&
    /Type-9/.test(dynEn.killFeed || ''),
    { killFeed: dynEn.killFeed });
  ok('比分板模式名/表头为英文',
    /Scoreboard · Team Deathmatch/.test(dynEn.scoreTitle || '') && /Callsign/.test((dynEn.scoreHeads || []).join(' ')),
    { scoreTitle: dynEn.scoreTitle, heads: dynEn.scoreHeads });
  ok('连接错误码走词典（room_full → 英文提示）',
    /Room is full/.test(dynEn.connError || ''), { connError: dynEn.connError });

  /* 6) 切回中文：同一批播报恢复中文 */
  const dynZhBack = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const N = window.__MP.net2;
    const q = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    const lastFeed = () => {
      const list = [...document.querySelectorAll('.h-feed .h-fl')];
      return list.length ? list[list.length - 1].textContent.trim() : null;
    };
    window.__SX_LANG.set('zh-CN');
    await wait(400);
    N.testMsg({ t: 'kill', by: 'x2', victim: 'y2', byName: 'Alpha', victimName: 'Bravo', wpn: 'dmr', warmup: true });
    await wait(40);
    const kill = lastFeed();
    N.testMsg({ t: 'pointCaptured', id: 'A', owner: 0, teams: [1, 0] });
    await wait(40);
    const cap = lastFeed();
    N.testMsg({ t: 'matchState', state: 'warmup' });
    await wait(40);
    const warm = q('[data-mp-state]');
    N.testMsg({ t: 'roundEnd', draw: true, teams: [0, 0] });
    await wait(40);
    const draw = q('[data-mp-round-t]');
    const scoreTitle = q('.x-mp-score h3');
    const team = q('[data-mp-team]');
    return { kill, cap, warm, draw, scoreTitle, team };
  });
  ok('切回中文后播报恢复中文（双向稳定）',
    CJK.test(dynZhBack.kill || '') && CJK.test(dynZhBack.cap || '') &&
    CJK.test(dynZhBack.warm || '') && CJK.test(dynZhBack.draw || '') &&
    CJK.test(dynZhBack.team || ''),
    dynZhBack);

  /* 7) 远端 reloadStart：枪口下压 + 弹匣动作 */
  const rig = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const N = window.__MP.net2;
    N.testUpsert([{ id: 'rig-1', name: 'Rig', team: 0, x: 2, y: 0, z: 2, hp: 100 }]);
    await wait(30);
    const base = (N.perf(), (window.__MP.debug().parts || []).find(p => p.id === 'rig-1')) || null;
    const before = base ? { riflePitch: base.riflePitch, magY: base.magY } : null;
    N.testMsg({ t: 'reloadStart', id: 'rig-1', wpn: 'pac9', ms: 1200 });
    N.testFrame(1 / 60);
    await wait(20);
    const mid = (window.__MP.debug().parts || []).find(p => p.id === 'rig-1') || null;
    for (let i = 0; i < 12; i++) N.testFrame(1 / 30);
    const deep = (window.__MP.debug().parts || []).find(p => p.id === 'rig-1') || null;
    N.testMsg({ t: 'reloadDone', id: 'rig-1', mag: 10, reserve: 20 });
    N.testFrame(1 / 30);
    await wait(20);
    const after = (window.__MP.debug().parts || []).find(p => p.id === 'rig-1') || null;
    N.testClear();
    return {
      before, mid: mid ? { riflePitch: mid.riflePitch, magY: mid.magY, armL: mid.armL, reloadT: mid.reloadT } : null,
      deep: deep ? { riflePitch: deep.riflePitch, magY: deep.magY, armL: deep.armL, reloadT: deep.reloadT } : null,
      after: after ? { riflePitch: after.riflePitch, magY: after.magY, reloadT: after.reloadT } : null
    };
  });
  ok('远端 reloadStart：枪口下压（rifle 俯仰变负）且结束后复位',
    rig.before && rig.deep && rig.after &&
    rig.deep.riflePitch < rig.before.riflePitch - 0.02 &&
    Math.abs(rig.after.riflePitch - rig.before.riflePitch) < 0.01,
    rig);
  ok('远端 reloadStart：弹匣脱离（magY 下移）且结束后复位',
    rig.before && rig.deep && rig.after &&
    rig.deep.magY < rig.before.magY - 0.01 &&
    Math.abs(rig.after.magY - rig.before.magY) < 0.01,
    { before: rig.before, deep: rig.deep, after: rig.after });

  /* 8) 收尾：missing / pageerror */
  const final = await page.evaluate(() => ({
    missing: (window.__SX_LANG.missing() || []),
    lang: document.documentElement.lang
  }));
  ok('全流程结束 missing 仍为 0', final.missing.length === 0, final.missing.slice(0, 8));
  ok('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 4));
} catch (e) {
  ok('测试执行', false, String((e && e.stack) || e).split('\n').slice(0, 5).join(' | '));
} finally {
  try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
}

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' PASS' + (fails ? '（' + fails + ' 项失败）' : ''));
process.exit(fails ? 1 : 0);
