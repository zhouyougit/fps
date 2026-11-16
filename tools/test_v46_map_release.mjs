#!/usr/bin/env node
/* V46 · 切图 LRU 资源释放回归
   断言：
     · 非 harbor 已构建地图 ≤2（MAP_CACHE_LIMIT）
     · 四图走一圈后再回 depot，能在预算内重建并保持 727 碰撞盒
     · 几何体/场景子节点在多次切图后不无限增长
     · 无 pageerror
   用法：node tools/test_v46_map_release.mjs */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e && e.message || e)));
await page.goto('file://' + process.cwd() + '/game.html?q=low&novisual=1&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (window.__ready === true && !!window.__SX && !!window.MapKit) || window.__fatal, null, { timeout: 300000 });
await page.evaluate(() => { try { window.__G.game.start({ skipIntro: true }); } catch (e) {} });

const rows = [];
for (const id of ['depot', 'ship', 'core', 'harbor', 'depot', 'ship', 'core', 'depot']) {
  const t0 = Date.now();
  await page.evaluate(async (id) => { if (window.__SX.mapId() !== id) await window.__SX.switchMap(id); window.__f0 = window.__frames; }, id);
  await page.waitForFunction(() => window.__frames - window.__f0 > 20, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const G = window.__G;
    const cache = window.MapKit.cache();
    let groups = 0, mapGroups = 0;
    const liveGeos = new Set();
    G.scene.traverse((o) => { if (o.name === 'mp-player') groups++; if (o.userData && o.userData.sxMapOwned) mapGroups++; if (o.isMesh && o.geometry) liveGeos.add(o.geometry); });
    return {
      map: window.__SX.mapId(), cache: cache, cacheLimit: window.MapKit.cacheLimit(),
      geos: G.renderer.info.memory.geometries, tex: G.renderer.info.memory.textures,
      programs: G.renderer.info.programs ? G.renderer.info.programs.length : 0,
      sceneChildren: G.scene.children.length, boxes: (G.physics.boxes || []).length,
      liveGeos: liveGeos.size, mpPlayers: groups, cacheStats: window.MapKit.cacheStats()
    };
  });
  r.switchMs = Date.now() - t0;
  rows.push(r);
  console.log('[map] ' + id.padEnd(6) + ' cache=' + JSON.stringify(r.cache.map((c) => c.id)) + ' geos=' + r.geos + ' live=' + r.liveGeos + ' tex=' + r.tex + ' programs=' + r.programs + ' scene=' + r.sceneChildren + ' boxes=' + r.boxes + ' releases=' + JSON.stringify(r.cacheStats) + ' ' + r.switchMs + 'ms');
}

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d ? ' — ' + JSON.stringify(d) : '')); } };
const nonHarbor = (r) => r.cache.filter((c) => c.id !== 'harbor').length;
ok('非 harbor 已构建地图 ≤ 2', rows.every((r) => nonHarbor(r) <= 2 && r.cacheLimit === 2), rows.map((r) => ({ map: r.map, cache: r.cache.map((c) => c.id) })));
ok('四图切一圈 + 返回 depot 后地图缓存仍 ≤2', nonHarbor(rows[rows.length - 1]) <= 2 && rows[rows.length - 1].map === 'depot', rows[rows.length - 1]);
ok('返回 depot 后碰撞盒 727 且模型正常', rows[rows.length - 1].boxes === 727, { boxes: rows[rows.length - 1].boxes });
const first = rows[0], last = rows[rows.length - 1];
ok('多次切图后场景存活几何体不无限增长（末次 ≤ 第 4 次 + 200）', last.liveGeos <= rows[3].liveGeos + 200, { first: first.liveGeos, mid: rows[3].liveGeos, last: last.liveGeos, all: rows.map((r) => r.liveGeos) });
ok('多次切图后场景子节点不无限增长（末次 ≤ 首次 + 30）', last.sceneChildren <= first.sceneChildren + 30, { first: first.sceneChildren, last: last.sceneChildren });
ok('四图全部能加载（无 fatal）', rows.every((r) => r.boxes > 0), rows.map((r) => ({ map: r.map, boxes: r.boxes })));
ok('无 pageerror', errs.length === 0, errs.slice(0, 3));
console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(fail ? 1 : 0);
