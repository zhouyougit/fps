#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v39_perf.mjs — V39 静态几何性能回归
   ---------------------------------------------------------------------
   对低画质（?q=low）下 depot / ship / core 三张室内图各采样 120 帧，
   对比"改造前基线页"与"V39 新构建页"的 draw calls / triangles：
     · 断言 new.calls <= old.calls * 0.8（每图，取 120 帧中位数）
     · 断言两页均无 pageerror
     · 断言碰撞盒数量 / 出生点 / 敌人点位 / 中继位置 / 撤离点与大盒
       在改造前后完全一致（只做静态装饰批处理，不动玩法）
     · 新构建必须暴露 window.__SX_LOD（state/统计/开关）
   页面来源（可用环境变量覆盖）：
     SX_BASE_URL  默认 file://<repo>/bench/v39_baseline.html   （V39 改动前构建）
     SX_NEW_URL   默认 file://<repo>/versions/几猫_V39.html     （V39 新构建）
   运行：node tools/test_v39_perf.mjs
   附加：--shots 输出三图前后截图到 versions/screens/v39_perf_*.png
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.SX_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAPS = ['depot', 'ship', 'core'];
const FRAMES = 120;
const SHOTS = process.argv.indexOf('--shots') >= 0;

const Q = '?q=low&noaudio=1';
const baseUrl = (process.env.SX_BASE_URL || pathToFileURL(path.join(ROOT, 'bench/v39_baseline.html')).href) + Q;
const newUrl = (process.env.SX_NEW_URL || pathToFileURL(path.join(ROOT, 'versions/几猫_V39.html')).href) + Q;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('FAIL · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
}
function section(s) { console.log('\n=== ' + s + ' ==='); }

/* 每个页面独立浏览器实例，逐图同步渲染 120 帧（不依赖 rAF 节奏），前后口径一致。 */
async function measure(url, tag) {
  const browser = await chromium.launch({
    headless: true, executablePath: CHROME,
    args: PW_ARGS
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
  await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true && window.__SX && window.__SX_VISUAL, null, { timeout: 420000 });
  await page.evaluate(() => { try { window.__G.game.start({ skipIntro: true }); } catch (e) {} });
  await page.waitForTimeout(600);

  const out = { maps: {}, errors, lod: null };
  for (const id of MAPS) {
    out.maps[id] = await page.evaluate((id) => {
      const G = window.__G;
      window.__SX.switchMap(id);
      try { G.enemies.clear(); } catch (e) {}
      const gm = window.__SX_MAPS_DATA.maps[id];
      G.player.pos.set(gm.spawns.player.pos[0], gm.spawns.player.pos[1] + 0.1, gm.spawns.player.pos[2]);
      G.player.yaw = gm.spawns.player.yaw; G.player.pitch = 0;
      const samples = [];
      for (let i = 0; i < 120; i++) {
        try { G.render.frame(1 / 60); } catch (e) {}
        samples.push([G.renderer.info.render.calls, G.renderer.info.render.triangles]);
      }
      const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
      const calls = samples.map((s) => s[0]), tris = samples.map((s) => s[1]);
      const fp = {
        boxes: (G.physics.boxes || []).length,
        start: [G.level.playerStart.pos.x, G.level.playerStart.pos.y, G.level.playerStart.pos.z].map((v) => +v.toFixed(3)),
        extraction: [G.level.extraction.pos.x, G.level.extraction.pos.y, G.level.extraction.pos.z, G.level.extraction.radius].map((v) => +v.toFixed(3)),
        spawns: (G.level.enemySpawns || []).map((s) => [s.pos.x, s.pos.y, s.pos.z].map((v) => +v.toFixed(2))),
        cover: (G.level.coverPoints || []).length,
        interior: (G.level.interiorBoxes || []).map((b) => [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(2)))
      };
      return { callsMed: med(calls), callsMax: Math.max.apply(null, calls), trisMed: med(tris), fp, lod: window.__SX_LOD ? window.__SX_LOD.state() : null };
    }, id);
    if (SHOTS) {
      fs.mkdirSync(path.join(ROOT, 'versions/screens'), { recursive: true });
      await page.screenshot({ path: path.join(ROOT, 'versions/screens/v39_perf_' + tag + '_' + id + '.png'), timeout: 60000 });
    }
  }
  out.lod = out.maps.core.lod;
  await page.close();
  await browser.close();
  return out;
}

section('0 · 环境');
console.log('baseline = ' + baseUrl);
console.log('new      = ' + newUrl);
const fileOf = (u) => { try { return fileURLToPath(new URL(u)); } catch (e) { return u; } };
ok('基线页与新构建页均存在', fs.existsSync(fileOf(baseUrl)) && fs.existsSync(fileOf(newUrl)), { base: fileOf(baseUrl), next: fileOf(newUrl) });

section('1 · 采样 120 帧（低画质）');
const before = await measure(baseUrl, 'before');
const after = await measure(newUrl, 'after');

for (const id of MAPS) {
  const b = before.maps[id], a = after.maps[id];
  const drop = b.callsMed > 0 ? (1 - a.callsMed / b.callsMed) * 100 : 0;
  console.log('[draw] ' + id.padEnd(6) + ' calls ' + String(b.callsMed).padStart(4) + ' -> ' + String(a.callsMed).padStart(4) +
    '  (' + drop.toFixed(1) + '% ↓, target ≥20%)   tris ' + b.trisMed + ' -> ' + a.trisMed);
  ok(id + ' · draw calls 新值 ≤ 旧值 × 0.8', b.callsMed > 0 && a.callsMed <= b.callsMed * 0.8,
    { old: b.callsMed, new: a.callsMed, ratio: +(a.callsMed / b.callsMed).toFixed(3), dropPct: +drop.toFixed(1) });
}

section('2 · 无 pageerror');
ok('基线页无 pageerror', before.errors.length === 0, before.errors.slice(0, 3));
ok('新构建页无 pageerror', after.errors.length === 0, after.errors.slice(0, 3));

section('3 · 碰撞 / 出生点 / 可达性指纹不变');
for (const id of MAPS) {
  const b = before.maps[id].fp, a = after.maps[id].fp;
  const same = JSON.stringify(b) === JSON.stringify(a);
  ok(id + ' · 碰撞盒/出生点/敌人点位/掩体/室内盒完全一致', same,
    same ? { boxes: a.boxes, spawns: a.spawns.length, cover: a.cover } : { before: b, after: a });
}

section('4 · LOD API');
const lodAll = MAPS.map((id) => after.maps[id].lod).filter(Boolean);
const lod = after.lod || before.lod;
ok('新构建暴露 window.__SX_LOD = { state, setEnabled, stats }',
  !!lod && typeof lod === 'object' && lod.enabled === true && lod.far === 60,
  lod || 'missing');
const lodGroups = lodAll.reduce((n, s) => n + (s.groups || 0), 0);
ok('map:loaded 后收集到装饰组（三图合计 > 0）', lodGroups > 0, { perMap: MAPS.map((id) => ({ id, groups: (after.maps[id].lod || {}).groups || 0 })), total: lodGroups });

console.log('\n----------------------------------------');
console.log('PASS ' + pass + ' · FAIL ' + fail);
console.log(fail ? '结果：失败' : '结果：全部通过');
process.exit(fail ? 1 : 0);