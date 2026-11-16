#!/usr/bin/env node
/* =====================================================================
   V38 军械库 / 存档 / 模拟层浏览器回归
   覆盖：
   - core_save: armory 六把枪、volume 四轨 import/export/镜像、旧六键迁移
   - core_bridge: 启动时 saltline.audio.v1 分轨合并
   - 军械库 UI: 6 个 tab，六把枪都能购买/改装并生效
   只跑本文件：node tools/test_v38_armory_sim.mjs
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tools/.v38_armory_sim.html');
execFileSync(process.execPath, ['tools/build.cjs', out, 'v38'], { cwd: root, stdio: 'inherit' });

const url = 'file://' + out + '?q=low&noaudio=1';
function chromeExe() {
  const cands = [
    process.env.CHROME_EXE,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const p of cands) if (p && fs.existsSync(p)) return p;
  try {
    const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
    if (fs.existsSync(cache)) {
      for (const d of fs.readdirSync(cache)) {
        if (!/^chromium-\d+$/.test(d)) continue;
        for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
                           'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          const p = path.join(cache, d, sub);
          if (fs.existsSync(p)) return p;
        }
      }
    }
  } catch (e) {}
  for (const p of ['/Applications/Chromium.app/Contents/MacOS/Chromium',
                   '/usr/bin/google-chrome', '/usr/bin/chromium']) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromeExe(),
  args: PW_ARGS
});
const context = await browser.newContext({ viewport: { width: 1100, height: 640 } });
// 首次导航清一次本地存档；reload 时保留（迁移/音频用例依赖）
await context.addInitScript(() => {
  try {
    if (!localStorage.getItem('__v38_init')) {
      localStorage.clear();
      localStorage.setItem('__v38_init', '1');
    }
  } catch (e) {}
});
const page = await context.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
};

async function bootWait() {
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 420000 });
  try {
    await page.waitForFunction(
      () => !!(window.__G && window.__G.weapon && window.__G.weapon.list && window.__G.weapon.list.length === 6 &&
               window.SXSave && window.__SX_ARMORY && window.__SX && window.__SX_PROGRESS),
      null,
      { timeout: 60000 }
    );
  } catch (e) {
    const diag = await page.evaluate(() => ({
      G: !!window.__G,
      weapons: window.__G && window.__G.weapon && window.__G.weapon.list ? window.__G.weapon.list.map((w) => w.id) : null,
      SXSave: !!window.SXSave, ARMORY: !!window.__SX_ARMORY,
      SX: !!window.__SX, PROGRESS: !!window.__SX_PROGRESS,
      fatal: window.__fatal, errors: (window.__errors || []).slice(-8)
    })).catch(() => null);
    console.log('BOOT DIAG', JSON.stringify(diag), 'pageerrors', JSON.stringify(errs.slice(-5)));
    throw e;
  }
  await page.waitForTimeout(400);
}

const SIX = ['breaker12', 'dmr', 'lmg', 'pac9', 'sidearm', 'smg'];
const SIX_TABS = ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'];
const near = (a, b) => Math.abs(a - b) < 1e-9;

await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await bootWait();

/* 1. 构建产物 + 启动 */
const boot = await page.evaluate(() => ({
  ready: window.__ready,
  fatal: window.__fatal,
  profile: window.__BUILD__ && window.__BUILD__.profile,
}));
ok('V38 产物启动（profile/ready）', boot.ready && !boot.fatal && boot.profile === 'v38', boot);

/* 2. core_save 默认结构：六把枪 + 四路音量 */
const defs = await page.evaluate(() => {
  const s = window.SXSave.DEFAULTS();
  return { armory: Object.keys(s.armory).sort(), volume: s.settings.volume };
});
ok('core_save 默认 armory 接受 6 个 id', JSON.stringify(defs.armory) === JSON.stringify(SIX), defs.armory);
ok('settings.volume 四轨默认值齐全',
  near(defs.volume.master, 0.9) && near(defs.volume.music, 0.8) &&
  near(defs.volume.sfx, 1) && near(defs.volume.voice, 1), defs.volume);

/* 3. 配件目录：六把枪 + 价格档位 */
const cat = await page.evaluate(() => {
  const c = window.__SX_ARMORY.catalog || [];
  return {
    wids: [...new Set(c.map((x) => x.wid))].sort(),
    prices: [...new Set(c.map((x) => x.price))].sort((a, b) => a - b),
    counts: c.reduce((m, x) => { m[x.wid] = (m[x.wid] || 0) + 1; return m; }, {}),
  };
});
ok('配件目录覆盖 6 把枪', JSON.stringify(cat.wids) === JSON.stringify(SIX), cat.wids);
ok('配件价格只有 0/120/260/400 四档', JSON.stringify(cat.prices) === JSON.stringify([0, 120, 260, 400]), cat.prices);

/* 3b. 构建产物内的 sim 伤害管线：minDamage / applied */
const sim = await page.evaluate(() => {
  const dmg = window.SALT_SIM.damage.createDamagePipeline({ difficulty: 1, minDamage: 8 });
  const res = dmg.run({ amount: 3, health: 100 });
  return { final: res.final, applied: res.applied, health: res.ev.health, trace: res.trace };
});
ok('构建内 sim：minDamage 生效且 final=实际扣血',
  sim.final === 8 && sim.applied === 8 && sim.health === 92 &&
  JSON.stringify(sim.trace) === JSON.stringify(['pre', 'armor', 'difficulty', 'apply', 'post']), sim);

/* 4. 军械库 UI：6 个 tab，逐页可渲染槽位；六把枪都能购买并改装生效 */
const armory = await page.evaluate(() => {
  window.__SX.armoryOpen();
  const tabs = [...document.querySelectorAll('.x-ar-tabs .x-ar-tab')].map((b) => b.dataset.wid);
  const slotsPerTab = {};
  for (const id of tabs) {
    const btn = document.querySelector('.x-ar-tabs .x-ar-tab[data-wid="' + id + '"]');
    if (btn) btn.click();
    slotsPerTab[id] = document.querySelectorAll('.x-ar-slots .x-ar-row').length;
  }
  const P = window.__SX_PROGRESS;
  P.add(20000);
  const catalog = window.__SX_ARMORY.catalog || [];
  const results = {};
  for (const wid of tabs) {
    const before = window.__SX.armoryStats(wid);
    const entry = catalog.find((c) => c.wid === wid && c.slot === 'mag' && c.opt === 'ext');
    if (!entry) { results[wid] = { error: 'no ext mag' }; continue; }
    const buy = P.purchase(entry.id, entry.price, entry.name);
    window.__SX.armorySet(wid, 'mag', 'ext');
    const after = window.__SX.armoryStats(wid);
    results[wid] = {
      bought: !!(buy && buy.ok), before: before && before.mag, after: after && after.mag,
      selected: window.__SX.armory()[wid] && window.__SX.armory()[wid].mag,
    };
  }
  return {
    tabs, slotsPerTab, results,
    stored: JSON.parse(localStorage.getItem('saltline.armory.v1') || 'null'),
    saveArmory: Object.keys(window.SXSave.get('armory')).sort(),
  };
});
ok('军械库 6 个 tab', JSON.stringify(armory.tabs) === JSON.stringify(SIX_TABS), armory.tabs);
ok('每个 tab 至少 3 个配件槽',
  armory.tabs.length === 6 && Object.values(armory.slotsPerTab).every((n) => n >= 3), armory.slotsPerTab);
ok('六把枪都能购买并改装（弹匣容量提升）',
  SIX_TABS.every((id) => {
    const r = armory.results[id] || {};
    return r.bought && r.selected === 'ext' && r.after > r.before;
  }), armory.results);
ok('改装写入旧键与统一存档时保留 6 个 id',
  JSON.stringify(Object.keys(armory.stored || {}).sort()) === JSON.stringify(SIX) &&
  JSON.stringify(armory.saveArmory) === JSON.stringify(SIX), { stored: armory.stored && Object.keys(armory.stored), save: armory.saveArmory });

/* 5. 统一存档 import / export / mirror：六把枪和四轨音量都不丢 */
const io = await page.evaluate(() => {
  const SX = window.SXSave;
  SX.setDebounce(0);
  const payload = {
    v: 2,
    armory: {
      pac9: { muzzle: 'supp' }, breaker12: { mag: 'ext' }, dmr: { optic: 'x45' },
      smg: { mag: 'fast' }, lmg: { optic: 'x2' }, sidearm: { muzzle: 'supp' },
      bogus: { mag: 'ext' },
    },
    settings: { volume: { master: 0.4, music: 0.3, sfx: 0.2, voice: 0.1 } },
  };
  const imported = SX.importJSON(JSON.stringify(payload));
  const st = SX.state();
  const exported = JSON.parse(SX.exportJSON());
  const mir = SX.mirrorLegacy({ sections: ['settings', 'armory'] });
  return {
    ok: imported.ok,
    armory: Object.keys(st.armory).sort(),
    smg: st.armory.smg,
    bogus: st.armory.bogus,
    volume: st.settings.volume,
    exportedArmory: Object.keys(exported.armory).sort(),
    exportedVolume: exported.settings.volume,
    mirrorVolume: JSON.parse(mir[SX.LEGACY.settings]).volume,
    mirrorTracks: JSON.parse(mir[SX.LEGACY.settings]).volumeTracks,
    mirrorArmory: Object.keys(JSON.parse(mir[SX.LEGACY.armory])).sort(),
  };
});
ok('import 接受六把枪并丢弃未知 id',
  io.ok && JSON.stringify(io.armory) === JSON.stringify(SIX) && io.bogus === undefined && io.smg.mag === 'fast', io);
ok('export 不丢六把枪与四轨音量',
  JSON.stringify(io.exportedArmory) === JSON.stringify(SIX) &&
  near(io.exportedVolume.master, 0.4) && near(io.exportedVolume.music, 0.3) &&
  near(io.exportedVolume.sfx, 0.2) && near(io.exportedVolume.voice, 0.1), io.exportedVolume);
ok('mirrorLegacy 保留分轨与六把枪',
  near(io.mirrorVolume, 0.4) &&
  near(io.mirrorTracks.music, 0.3) && near(io.mirrorTracks.sfx, 0.2) && near(io.mirrorTracks.voice, 0.1) &&
  JSON.stringify(io.mirrorArmory) === JSON.stringify(SIX), { volume: io.mirrorVolume, tracks: io.mirrorTracks, armory: io.mirrorArmory });

/* 6. 旧六键迁移：六把枪 id 与 volumeTracks 经镜像保留 */
await page.evaluate(() => {
  for (const k of ['saltline.save', 'saltline.save.bak', 'saltline.audio.v1']) localStorage.removeItem(k);
  localStorage.setItem('saltline.armory.v1', JSON.stringify({
    pac9: { muzzle: 'supp' }, breaker12: { mag: 'ext' }, dmr: {},
    smg: { mag: 'fast' }, lmg: { optic: 'x2' }, sidearm: { mag: 'ext' },
  }));
  localStorage.setItem('saltline.settings.v1', JSON.stringify({
    quality: 'high', volume: 0.35, volumeTracks: { music: 0.4, sfx: 0.5, voice: 0.6 },
  }));
});
await page.reload({ waitUntil: 'load', timeout: 240000 });
await bootWait();
const legacy = await page.evaluate(() => {
  const SX = window.SXSave;
  const mirSet = JSON.parse(localStorage.getItem('saltline.settings.v1') || 'null');
  return {
    source: SX.loadSource(),
    armory: Object.keys(SX.get('armory')).sort(),
    smg: SX.get('armory').smg,
    lmg: SX.get('armory').lmg,
    master: SX.get('settings').volume.master,
    unifiedVolume: SX.get('settings').volume,
    mirrorTracks: mirSet && mirSet.volumeTracks,
  };
});
ok('旧六键迁移保留六把枪 id',
  JSON.stringify(legacy.armory) === JSON.stringify(SIX) &&
  legacy.smg.mag === 'fast' && legacy.lmg.optic === 'x2', legacy);
ok('旧 settings.volumeTracks 迁移并镜像保留',
  near(legacy.master, 0.35) && near(legacy.mirrorTracks.music, 0.4) &&
  near(legacy.mirrorTracks.sfx, 0.5) && near(legacy.mirrorTracks.voice, 0.6), legacy);

/* 7. 启动时 audio 分轨合并（core_bridge） */
await page.evaluate(() => {
  localStorage.removeItem('saltline.settings.v1');
  localStorage.setItem('saltline.audio.v1', JSON.stringify({ master: 0.9, music: 0.21, sfx: 0.32, voice: 0.43 }));
  const SX = window.SXSave;
  const st = SX.state();
  st.settings.volume = { master: 0.9, music: 1, sfx: 1, voice: 1 };
  SX.commit(st);
});
await page.reload({ waitUntil: 'load', timeout: 240000 });
await bootWait();
const audio = await page.evaluate(() => ({
  volume: window.SXSave.get('settings').volume,
  source: window.SXSave.loadSource(),
}));
ok('启动时 saltline.audio.v1 的 music/sfx/voice 合并进 settings.volume',
  near(audio.volume.master, 0.9) && near(audio.volume.music, 0.21) &&
  near(audio.volume.sfx, 0.32) && near(audio.volume.voice, 0.43), audio);

/* 8. 无 pageerror */
ok('无 pageerror', errs.length === 0, errs.slice(0, 5));

console.log(fails ? fails + ' 项失败' : '全部通过');
try { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); } catch (e) {}
try { fs.rmSync(out, { force: true }); } catch (e) {}
process.exit(fails ? 1 : 0);
