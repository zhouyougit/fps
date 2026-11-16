#!/usr/bin/env node
/* =====================================================================
   V38 · 界面 / 本地化回归（WP38-UI）
   覆盖：字幕说话人、简报/档案/过场/军械库切英文、结局打字机 refresh 节流、
        标题 .m-word 拼接、缺失键、pageerror。
   用法：node tools/test_v38_ui_polish.mjs [--no-build]
   环境变量：SX_HTML（指定产物）、SX_PAGE_TIMEOUT（加载超时 ms，默认 240000）
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
const cacheDir = path.join(root, 'tools', '.cache');
// 默认构建到 cache，绝不覆盖 versions/ 里的历史快照；需要测历史产物时用 SX_HTML 指定。
const htmlPath = process.env.SX_HTML
  ? path.resolve(process.env.SX_HTML)
  : path.join(cacheDir, 'v38_ui_polish_build.html');

function newestSource() {
  let newest = 0;
  for (const f of readdirSync(path.join(root, 'src'))) {
    if (!/\.(js|html)$/.test(f)) continue;
    newest = Math.max(newest, statSync(path.join(root, 'src', f)).mtimeMs);
  }
  return newest;
}
function ensureBuild() {
  const stale = !existsSync(htmlPath) || statSync(htmlPath).mtimeMs < newestSource();
  if (NO_BUILD || !stale) return { built: false, stale };
  mkdirSync(cacheDir, { recursive: true });
  const rel = path.relative(root, htmlPath);
  execFileSync(process.execPath, [path.join('tools', 'build.cjs'), rel, 'v38'], { cwd: root, stdio: 'inherit' });
  return { built: true, stale };
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
console.log('[test] 产物 ' + path.relative(root, htmlPath) + (buildInfo.built ? '（已重新构建）' : '（直接使用）'));

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String((e && e.message) || e)));

const URL = pathToFileURL(htmlPath).href + '?q=low&noaudio=1';
const CJK = '[\\u3400-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]';

try {
  await page.goto(URL, { waitUntil: 'load', timeout: TIMEOUT });
  await page.waitForFunction(() => window.__ready === true && window.__SX_LANG && window.__SX_UI2, null, { timeout: TIMEOUT });
  await page.waitForTimeout(1200);

  /* 1) 启动 / 词典完整性 */
  const boot = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    missing: (window.__SX_LANG.missing() || []),
    keys: Object.keys(window.SXI18n.dict['zh-CN']).length,
    refresh: window.__SX_UI2.stats().refresh,
    sxText: getComputedStyle(document.documentElement).getPropertyValue('--sx-text'),
    subScale: getComputedStyle(document.documentElement).getPropertyValue('--sub-scale'),
    hudScale: getComputedStyle(document.documentElement).getPropertyValue('--hud-scale')
  }));
  ok('启动 + 缺失键 missing=0', boot.lang.indexOf('zh') === 0 && boot.missing.length === 0, { lang: boot.lang, keys: boot.keys, missing: boot.missing.slice(0, 6) });
  ok('死变量 --sx-text 已删除，字幕/HUD 缩放仍由 --sub-scale/--hud-scale 驱动',
    (boot.sxText || '').trim() === '' && (boot.subScale || '').trim() !== '' && (boot.hudScale || '').trim() !== '',
    { sxText: boot.sxText, subScale: boot.subScale, hudScale: boot.hudScale });

  /* 2) 标题 .m-word 中英切换 */
  const titleZh = await page.evaluate(() => {
    const w = document.querySelector('.m-word');
    return { text: w.textContent, main: (w.querySelector('.m-main') || {}).textContent, hasSep: !!w.querySelector('.m-main') && w.querySelector('.m-main').nextSibling && w.querySelector('.m-main').nextSibling.nodeType === 3 };
  });
  const titleEn = await page.evaluate(() => {
    window.__SX_LANG.set('en');
    const w = document.querySelector('.m-word');
    const main = w.querySelector('.m-main');
    return { text: w.textContent, main: main ? main.textContent : null, html: w.innerHTML, lang: document.documentElement.lang, stored: localStorage.getItem('saltline.lang') };
  });
  ok('标题切英文：主词独立、无 CJK、无 SALTLINEJI-MAO 拼接',
    titleEn.lang === 'en' && titleEn.stored === 'en' &&
    titleEn.main === 'SALTLINE' && /^SALTLINE(\s|$)/.test(titleEn.text) &&
    !new RegExp(CJK).test(titleEn.text) && !/SALTLINEJI/.test(titleEn.text),
    { zh: titleZh.text, main: titleEn.main, en: titleEn.text });
  const titleToggle = await page.evaluate(() => {
    const w = document.querySelector('.m-word');
    window.__SX_LANG.set('zh-CN');
    const back = w.textContent;
    window.__SX_LANG.set('en');
    const again = w.textContent;
    return { back, again };
  });
  ok('标题中英来回切换稳定',
    titleToggle.back === titleZh.text && titleToggle.again === titleEn.text && new RegExp(CJK).test(titleToggle.back),
    { back: titleToggle.back, again: titleToggle.again });

  /* 3) 简报 / 档案 / 过场：切英文后打开即为英文（不手动 refresh） */
  const brief = await page.evaluate(async () => {
    const go = document.querySelector('.x-camp [data-x="go"]');
    if (go) go.click();
    await new Promise(r => setTimeout(r, 700));
    const pick = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    return {
      on: !!document.querySelector('.x-brief.on'),
      k: pick('.x-br-k'), h: pick('.x-br-h'), sub: pick('.x-br-sub'),
      list: pick('.x-br-list'), btn: pick('.x-br-actions .btn'),
      threats: pick('.x-br-threats'),
      labels: Array.from(document.querySelectorAll('.x-br-meta > div > span')).map(e => e.textContent.trim()).join('|'),
      go: pick('.x-brief [data-x="brief-go"]')
    };
  });
  const briefText = [brief.k, brief.h, brief.sub, brief.list, brief.btn, brief.threats, brief.labels, brief.go].join(' ');
  ok('切英文后打开简报为英文',
    brief.on && !new RegExp(CJK).test(briefText) && /Berth Four/.test(brief.h || '') && /Threats/i.test(brief.labels || '') && /Deploy/i.test(brief.go || ''),
    { on: brief.on, k: brief.k, h: brief.h, labels: brief.labels, go: brief.go });

  const archive = await page.evaluate(async () => {
    document.querySelector('.x-brief').classList.remove('on');
    if (window.__SX && typeof window.__SX.archive === 'function') window.__SX.archive();
    await new Promise(r => setTimeout(r, 700));
    const pick = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    return { on: !!document.querySelector('.x-archive.on'), sub: pick('.x-arc-sub'), row: pick('.x-arc-row'), back: pick('[data-ar-back]') };
  });
  ok('切英文后打开档案为英文',
    archive.on && !new RegExp(CJK).test([archive.sub, archive.row, archive.back].join(' ')) && /Op 1/.test(archive.row || ''),
    { sub: archive.sub, row: archive.row, back: archive.back });

  const interlude = await page.evaluate(async () => {
    document.querySelector('.x-archive').classList.remove('on');
    if (window.__SX && typeof window.__SX.interlude === 'function') window.__SX.interlude(0, 1);
    await new Promise(r => setTimeout(r, 700));
    const pick = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    return { on: !!document.querySelector('.x-interlude.on'), k: pick('[data-int-k]'), h: pick('[data-int-h]'), line: pick('[data-int-lines] p'), go: pick('[data-int-go]') };
  });
  ok('切英文后打开过场为英文',
    interlude.on && !new RegExp(CJK).test([interlude.k, interlude.h, interlude.line, interlude.go].join(' ')) && /Warehouse/.test(interlude.h || ''),
    { k: interlude.k, h: interlude.h, line: (interlude.line || '').slice(0, 60) });

  /* 4) 字幕说话人：新文本优先 + 映射正确 + 切回中文正确 */
  const speakers = await page.evaluate(async () => {
    document.querySelector('.x-interlude').classList.remove('on');
    const out = [];
    const names = ['舵手', '蜃', '小队频道', '指挥中心'];
    for (const n of names) {
      window.__SX.speaker(n);
      await new Promise(r => setTimeout(r, 320));
      const who = document.querySelector('.comms-who');
      out.push({
        set: n,
        text: who.textContent,
        attr: who.getAttribute('data-sx-src'),
        cls: document.querySelector('.comms').getAttribute('data-speaker')
      });
    }
    window.__SX_LANG.set('zh-CN');
    await new Promise(r => setTimeout(r, 320));
    const who2 = document.querySelector('.comms-who');
    out.push({ set: 'back-zh', text: who2.textContent, attr: who2.getAttribute('data-sx-src'), cls: document.querySelector('.comms').getAttribute('data-speaker') });
    return out;
  });
  const spkOk = speakers[0].text === 'Pilot' && speakers[0].cls === 'pilot' && speakers[0].attr === '舵手' &&
    speakers[1].text === 'Shen' && speakers[1].cls === 'shen' && speakers[1].attr === '蜃' &&
    speakers[2].text === 'Squad Channel' && speakers[2].cls === 'squad' &&
    speakers[3].text === 'Command' && speakers[3].cls === 'command' &&
    speakers[4].text === '指挥中心';
  ok('字幕说话人：新文本优先、英文映射正确、切回中文正常', spkOk, speakers);

  /* 5) 军械库切英文 */
  await page.evaluate(() => window.__SX_LANG.set('en'));
  const armory = await page.evaluate(async () => {
    window.__SX.armoryOpen();
    await new Promise(r => setTimeout(r, 700));
    const pick = s => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    return {
      on: !!document.querySelector('.x-armory.on'),
      k: pick('.x-armory .m-k'), h: pick('.x-armory h2'),
      stat: pick('.x-ar-stat span'), back: pick('.x-ar-actions .btn'),
      owned: Array.from(document.querySelectorAll('.x-ar-opt em.x-ar-price')).slice(0, 2).map(e => e.textContent)
    };
  });
  ok('切英文后军械库界面骨架为英文',
    armory.on && !new RegExp(CJK).test([armory.k, armory.h, armory.stat, armory.back].join(' ')) && /Armory/i.test(armory.h || ''),
    { k: armory.k, h: armory.h, stat: armory.stat, back: armory.back });

  /* 6) 结局打字机：1s 内 refresh 次数 < 10，且确实在逐字输出 */
  const typing = await page.evaluate(async () => {
    document.querySelector('.x-armory').classList.remove('on');
    const el = document.createElement('p');
    el.className = 'x-final x-ending';
    el.setAttribute('data-sx-kind', 'silent');
    el.textContent = 'seed';
    document.querySelector('.menu').appendChild(el);
    await new Promise(r => setTimeout(r, 600)); // 等首次 refresh 启动打字机
    const s0 = window.__SX_UI2.stats();
    const t0 = el.textContent.length;
    await new Promise(r => setTimeout(r, 1000));
    const s1 = window.__SX_UI2.stats();
    const t1 = el.textContent.length;
    return { dRefresh: s1.refresh - s0.refresh, typing: s1.typing, observing: s1.observing, t0, t1 };
  });
  ok('结局打字期间 1s 内 refresh < 10 次', typing.dRefresh < 10 && typing.typing === true && typing.t1 > typing.t0,
    typing);

  const typingDone = await page.evaluate(async () => {
    const el = document.querySelector('.x-final.x-ending');
    for (let i = 0; i < 40 && window.__SX_UI2.stats().typing; i++) await new Promise(r => setTimeout(r, 200));
    await new Promise(r => setTimeout(r, 300));
    const st = window.__SX_UI2.stats();
    return { text: el.textContent, caret: !!el.querySelector('.x-ending-caret'), observing: st.observing, typing: st.typing };
  });
  ok('打字结束后重连观察器且不再重打', typingDone.observing === true && typingDone.typing === false && !typingDone.caret && /boat/i.test(typingDone.text),
    { caret: typingDone.caret, observing: typingDone.observing, head: (typingDone.text || '').slice(0, 40) });

  /* 7) 设置页英文残留（语言按钮的“中文”属于原生标签，允许保留 1 条） */
  const settings = await page.evaluate(async () => {
    const btn = document.querySelector('[data-act="settings"]');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 900));
    const pane = document.querySelector('.panel-b[data-pane="settings"]');
    const out = [];
    if (pane) {
      const w = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = w.nextNode())) {
        const s = (n.nodeValue || '').trim();
        if (s && new RegExp('[\\u4e00-\\u9fff]').test(s)) out.push(s.slice(0, 40));
      }
    }
    return { count: out.length, sample: out.slice(0, 8) };
  });
  ok('设置页切英文后仅剩原生语言标签的中文', settings.count <= 2, settings);

  /* 8) 缺失键 / 页面异常 */
  const final = await page.evaluate(() => ({
    missing: (window.__SX_LANG.missing() || []),
    stats: window.__SX_UI2.stats()
  }));
  ok('全流程缺失键仍为 0', final.missing.length === 0, final.missing.slice(0, 8));
  ok('无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 4));
} catch (e) {
  ok('测试执行', false, String((e && e.stack) || e).split('\n').slice(0, 4).join(' | '));
} finally {
  try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
}

console.log('\n' + results.filter(r => r.pass).length + '/' + results.length + ' PASS' + (fails ? '（' + fails + ' 项失败）' : ''));
process.exit(fails ? 1 : 0);
