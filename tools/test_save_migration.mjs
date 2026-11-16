#!/usr/bin/env node
/* V32 存档迁移验收：旧六键 → 统一档、损坏回退、导出导入、旧模块写回 */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
const CHROME = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&dt=0.1';
const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: PW_ARGS });
let fails = 0;
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); };

async function openWith(seedScript, arg) {
  const page = await browser.newPage({ viewport: { width: 800, height: 480 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(seedScript, arg);
  await page.goto(URL, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true && window.SXSave && window.__SX, null, { timeout: 420000 });
  await page.waitForTimeout(600);
  return { page, errs };
}

const LEGACY = {
  'saltline.campaign.v1': JSON.stringify({ unlocked: 4, best: { m1: { time: 210, kills: 9, rating: 'A' } }, current: 2, challenges: { m1: { time: true, head: false, clean: true } }, ending: 'silent' }),
  'saltline.armory.v1': JSON.stringify({ pac9: { muzzle: 'supp', mag: 'ext', optic: 'red' }, breaker12: {}, dmr: {} }),
  'saltline.access.v1': JSON.stringify({ difficulty: 'veteran', cross: 'amber', shake: 'low', reduceMotion: true, hudScale: '115', subSize: 'L', contrast: true }),
  'saltline.settings.v1': JSON.stringify({ quality: 'high', sens: 1.4, invertY: true, volume: 0.6, fov: 82 }),
  'saltline.guide.v1': '1',
  'saltline.mp.name': '老猫',
  'saltline.mp.url': 'ws://127.0.0.1:9100',
  'saltline.mp.map': 'depot',
  'saltline.mp.mode': 'chaos'
};

// 1) 全新安装只有 V31 旧键：加载时必须迁移，且不能先被运行时写档污染
const A = await openWith((seed) => {
  localStorage.clear();
  Object.keys(seed).forEach(k => localStorage.setItem(k, seed[k]));
}, LEGACY);
const mig = await A.page.evaluate(() => {
  // 启动阶段已经完成迁移/修复并回写主档；先取来源，再 load，否则第二次 load 会报告 main。
  const source = window.SXSave.bootSource ? window.SXSave.bootSource() : window.SXSave.loadSource();
  const s = window.SXSave.load();
  return {
    source: source,
    unlocked: s.campaign.unlocked, current: s.campaign.current,
    best: s.campaign.best.m1, challenges: s.campaign.challenges.m1, ending: s.campaign.ending,
    muzzle: s.armory.pac9.muzzle, mag: s.armory.pac9.mag,
    difficulty: s.access.difficulty, cross: s.access.cross, shake: s.access.shake,
    hudScale: s.access.hudScale, subSize: s.access.subSize, contrast: s.access.contrast,
    quality: s.settings.quality, sens: s.settings.sens, invertY: s.settings.invertY, fov: s.settings.fov,
    volume: s.settings.volume, guide: s.guide.dismissed,
    mpName: s.mp.name, mpUrl: s.mp.url, mpMap: s.mp.map, mpMode: s.mp.mode,
    oldKeysKept: !!localStorage.getItem('saltline.campaign.v1'),
    unified: !!localStorage.getItem('saltline.save')
  };
});
ok('旧档迁移来源 legacy', mig.source === 'legacy', mig.source);
ok('战役进度迁移', mig.unlocked === 4 && mig.current === 'm3' && mig.best.time === 210 && mig.challenges.clean === true && mig.ending === 'silent', mig);
ok('军械库迁移', mig.muzzle === 'supp' && mig.mag === 'ext', { muzzle: mig.muzzle, mag: mig.mag });
ok('可访问性迁移', mig.difficulty === 'veteran' && mig.cross === 'amber' && mig.shake === 0.45 && mig.hudScale === 1.15 && mig.subSize === 'l' && mig.contrast === true, mig);
ok('设置迁移', mig.quality === 'high' && mig.sens === 1.4 && mig.invertY === true && mig.fov === 82 && Math.abs(mig.volume.master - 0.6) < 1e-9, mig);
ok('引导与联机键迁移', mig.guide === true && mig.mpName === '老猫' && mig.mpMap === 'depot' && mig.mpMode === 'chaos', mig);
ok('旧键保留、统一档写入', mig.oldKeysKept && mig.unified, { old: mig.oldKeysKept, unified: mig.unified });

// 2) 主档损坏 → 读备份
const B = await openWith(() => {
  localStorage.clear();
  const s = { v: 2, profile: { name: '备份猫' }, campaign: { unlocked: 5, current: 'm2', best: {}, challenges: {}, ending: null, checkpoint: null }, settings: {}, access: {}, armory: {}, economy: { credits: 0, unlocked: [] }, stats: {}, achievements: {}, guide: {}, mp: {} };
  localStorage.setItem('saltline.save', '{broken json');
  localStorage.setItem('saltline.save.bak', JSON.stringify(s));
});
const bak = await B.page.evaluate(() => {
  const source = window.SXSave.bootSource ? window.SXSave.bootSource() : window.SXSave.loadSource();
  const s = window.SXSave.load();
  return { source: source, unlocked: s.campaign.unlocked, name: s.profile.name };
});
ok('主档损坏读备份', bak.source === 'backup' && bak.unlocked === 5 && bak.name === '备份猫', bak);

// 3) 导出/导入 roundtrip
const io = await A.page.evaluate(() => {
  const text = window.__SX.saveExport();
  const parsed = JSON.parse(text);
  parsed.campaign.unlocked = 6;
  parsed.profile.name = '导入猫';
  const r = window.__SX.saveImport(JSON.stringify(parsed));
  const s = window.SXSave.load();
  return { ok: r.ok, unlocked: s.campaign.unlocked, name: s.profile.name, bytes: text.length };
});
ok('导出/导入存档', io.ok && io.unlocked === 6 && io.name === '导入猫' && io.bytes > 100, io);

// 4) 旧模块保存 → 统一档同步（战役/装备）
const sync = await A.page.evaluate(() => {
  const G = window.__G, SX = window.__SX;
  SX.applyMission(0); G.game.start({ skipIntro: true });
  SX.challengeGrant('m1', { time: true });
  SX.armorySet('pac9', 'muzzle', 'comp');
  const s = window.SXSave.load();
  return { challenge: !!(s.campaign.challenges.m1 && s.campaign.challenges.m1.time), muzzle: s.armory.pac9.muzzle };
});
ok('旧模块保存同步到统一档', sync.challenge && sync.muzzle === 'comp', sync);
ok('迁移无页面错误', A.errs.length === 0 && B.errs.length === 0, { a: A.errs.slice(0, 2), b: B.errs.slice(0, 2) });

console.log(fails ? fails + ' 项失败' : '全部通过');
try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
process.exit(fails ? 1 : 0);
