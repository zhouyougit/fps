#!/usr/bin/env node
/* 产物校验：versions/几猫_V32..V44.html
   - __BUILD__.profile / window.__SX_PROFILE 与文件名一致
   - __VERSION_LABEL 与 profile 匹配
   - 体积 <= 3.5MB
   - 无头运行时：V32 = 3 把武器，V33 = 6 关（--all 时 V34+ = 6 把 / 8 关）
   用法：node tools/check_versions.mjs [--no-browser] [--all]
   V37/V38 产物尚未生成时跳过（其余版本缺失视为失败）。 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PW_ARGS, findChrome } from './pwargs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const BUDGET = 3.5 * 1024 * 1024;
const args = process.argv.slice(2);
const NO_BROWSER = args.includes('--no-browser');
const ALL = args.includes('--all');
const ONLY = (args.find(a => a.indexOf('--only=') === 0) || '').slice(7) || null;

const EXPECT = [
  { profile: 'v32', file: '几猫_V32.html', label: 'V32 · 地基', weapons: ['pac9', 'breaker12', 'dmr'], missions: 6 },
  { profile: 'v33', file: '几猫_V33.html', label: 'V33 · 手感', weapons: ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'], missions: 6 },
  { profile: 'v34', file: '几猫_V34.html', label: 'V34 · 对手', weapons: 6, missions: 8 },
  { profile: 'v35', file: '几猫_V35.html', label: 'V35 · 世界', weapons: 6, missions: 8 },
  { profile: 'v36', file: '几猫_V36.html', label: 'V36 · 联机', weapons: 6, missions: 8 },
  { profile: 'v37', file: '几猫_V37.html', label: 'V37 · 质量', weapons: 6, missions: 8, optional: true },
  { profile: 'v38', file: '几猫_V38.html', label: 'V38 · 性能', weapons: 6, missions: 8, optional: true, target: 'game_v38.html' },
  { profile: 'v39', file: '几猫_V39.html', label: 'V39 · 收尾', weapons: 6, missions: 8, optional: true, target: 'game_v39.html' },
  { profile: 'v40', file: '几猫_V40.html', label: 'V40 · 地图深化', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v41', file: '几猫_V41.html', label: 'V41 · 性能', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v42', file: '几猫_V42.html', label: 'V42 · 架构', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v43', file: '几猫_V43.html', label: 'V43 · 角色', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v44', file: '几猫_V44.html', label: 'V44 · 平衡', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v45', file: '几猫_V45.html', label: 'V45 · 精简', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v46', file: '几猫_V46.html', label: 'V46 · 内存', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v47', file: '几猫_V47.html', label: 'V47 · 打磨', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v48', file: '几猫_V48.html', label: 'V48 · 稳定', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v49', file: '几猫_V49.html', label: 'V49 · 视距', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v50', file: '几猫_V50.html', label: 'V50 · 设置', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v51', file: '几猫_V51.html', label: 'V51 · 可读', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v52', file: '几猫_V52.html', label: 'V52 · 收口', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v53', file: '几猫_V53.html', label: 'V53 · 改进', weapons: 6, missions: 8, budget: 6 * 1024 * 1024 },
  { profile: 'v54', file: '几猫_V54.html', label: 'V54 · 收敛', weapons: 6, missions: 8, budget: 3.5 * 1024 * 1024 }
];
const WEAPON_IDS = ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'];

let failures = 0;
const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  if (!cond) failures++;
  console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function skip(name, detail) {
  console.log('SKIP · ' + name + (detail !== undefined ? ' — ' + detail : ''));
}

/* ---------------- 静态解析 ---------------- */
function parseBuild(text) {
  const m = text.match(/window\.__BUILD__\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}
function parseString(text, name) {
  const m = text.match(new RegExp('window\\.' + name + '\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s*;'));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}
function sorted(a) { return a.slice().sort().join(','); }

const parsed = [];
for (const e of EXPECT) {
  const abs = path.join(root, 'versions', e.file);
  if (!existsSync(abs)) {
    if (e.optional) { skip(e.profile + ' 产物', '未生成（' + e.file + '）'); continue; }
    ok(e.profile + ' 产物存在', false, e.file);
    continue;
  }
  const text = readFileSync(abs, 'utf8');
  const size = statSync(abs).size;
  const build = parseBuild(text);
  const label = parseString(text, '__VERSION_LABEL');
  const profile = parseString(text, '__SX_PROFILE');

  ok(e.profile + ' __BUILD__.profile', !!build && build.profile === e.profile, build);
  ok(e.profile + ' __SX_PROFILE', profile === e.profile, profile);
  ok(e.profile + ' __VERSION_LABEL', label === e.label && String(label || '').indexOf(e.label.split(' ')[0]) === 0, label);
  const budget = e.budget || BUDGET;
  ok(e.profile + ' 体积预算', size <= budget, (size / 1048576).toFixed(2) + ' MB / ' + (budget / 1048576).toFixed(2) + ' MB');
  ok(e.profile + ' 目标文件', !!build && build.target === (e.target || e.file), build && build.target);
  parsed.push({ expect: e, abs, text, size, build, label, profile });
}

/* ---------------- 运行时断言 ---------------- */
const PAGE_TIMEOUT = Number(process.env.SX_PAGE_TIMEOUT || 240000);
async function inspect(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: PAGE_TIMEOUT });
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: PAGE_TIMEOUT });
  await page.waitForTimeout(300);
  return await page.evaluate(() => ({
    fatal: window.__fatal || null,
    profile: window.__BUILD__ && window.__BUILD__.profile,
    weapons: window.__G && window.__G.weapon && window.__G.weapon.list ? window.__G.weapon.list.map(w => w.id) : [],
    missions: window.__SX_CAMP && window.__SX_CAMP.missions ? window.__SX_CAMP.missions.length : -1
  }));
}

if (!NO_BROWSER) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch (e) {
    ok('Playwright 可用', false, String(e && e.message || e));
  }
  if (chromium) {
    let chrome = null;
    try { chrome = findChrome(); } catch (e) { ok('Chrome 可执行文件可用', false, String(e && e.message || e).split('\n')[0]); }
    let browser = null;
    if (chrome) {
      try {
        browser = await chromium.launch({
          headless: true,
          executablePath: chrome,
          args: PW_ARGS
        });
      } catch (e) {
        ok('Playwright 启动', false, String(e && e.message || e).split('\n')[0]);
      }
    }
    const targets = ONLY
      ? parsed.filter(p => p.expect.profile === ONLY)
      : (ALL ? parsed : parsed.filter(p => p.expect.profile === 'v32' || p.expect.profile === 'v33'));
    for (const p of (browser ? targets : [])) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      try {
        const info = await inspect(page, pathToFileURL(p.abs).href + '?q=low&noaudio=1');
        const wantWeapons = Array.isArray(p.expect.weapons) ? p.expect.weapons : WEAPON_IDS.slice(0, p.expect.weapons);
        const weaponsOk = sorted(info.weapons) === sorted(wantWeapons);
        ok(p.expect.profile + ' 武器数量/ID', weaponsOk && !info.fatal && errors.length === 0,
          { want: wantWeapons, got: info.weapons, fatal: info.fatal, pageerrors: errors.slice(0, 2) });
        ok(p.expect.profile + ' 关卡数量', info.missions === p.expect.missions,
          { want: p.expect.missions, got: info.missions });
      } catch (e) {
        ok(p.expect.profile + ' 运行时加载', false, String(e && e.message || e));
      } finally {
        await page.close();
      }
    }
    if (browser) await browser.close();
  }
} else {
  console.log('SKIP · 运行时断言（--no-browser）');
}

console.log('\n' + (failures ? failures + ' 项失败' : '全部通过') + '（共 ' + results.length + ' 项）');
process.exit(failures ? 1 : 0);
