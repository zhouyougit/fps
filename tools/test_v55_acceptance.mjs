#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v55_acceptance.mjs
   V55 功能验收（浏览器）：
     1. 产物标签/版本/three 版本/commit/minified 元数据
     2. 最终产物按项目要求不压缩（minified=false）
     3. SXErrors.soft、暂停时钟、四图海面、LOD 恢复、存档镜像（V53 回归）
     4. 通关 complete 后解锁下一关/最佳成绩（V52 老 bug）
     5. V55 第三关无人机减量 1/1/2 + 自爆伤害 36（V44 为 44）
     6. 无 pageerror / window.__errors
   用法：node tools/test_v55_acceptance.mjs [--file game.html]
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, openGame, closeBrowser, waitState, logicParams, ROOT } from './testkit.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS · ' + name + (detail === undefined ? '' : ' — ' + JSON.stringify(detail))); }
  else { fail++; console.log('FAIL · ' + name + (detail === undefined ? '' : ' — ' + JSON.stringify(detail))); }
};

const argFile = process.argv.indexOf('--file');
const file = argFile > 0 ? process.argv[argFile + 1] : 'game.html';
const browser = await launchBrowser();
let page = null;
try {
  page = await openGame(browser, { file, params: logicParams({ novisual: '1' }) });
  await waitState(page, 'playing', 60000);

  const env = await page.evaluate(() => ({
    label: window.__VERSION_LABEL,
    build: window.__BUILD__,
    soft: !!(window.SXErrors && typeof window.SXErrors.soft === 'function')
  }));
  const artifact = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const bytes = (() => { try { return fs.statSync(artifact).size; } catch (e) { return 0; } })();
  ok('产物为 V55 且版本 0.55.0', /^V55\b/.test(env.label || '') && env.build && env.build.version === '0.55.0', env);
  ok('构建元数据含 three r180 / 非 local commit', env.build && env.build.three === 'r180' && env.build.commit && env.build.commit !== 'local', env.build);
  ok('V55 最终产物未压缩（无尺寸限制）', env.build && env.build.minified === false && bytes > 0, { bytes, minified: env.build && env.build.minified });
  ok('SXErrors.soft 存在', env.soft);

  // CLI-2：暂停后 CLOCK 不应被 ext.update 推进
  const pause = await page.evaluate(() => {
    const G = window.__G;
    G.game.state = 'paused';
    const before = window.SX_CLOCK ? window.SX_CLOCK.now : null;
    for (let i = 0; i < 30; i++) G.game.update(1 / 60);
    const after = window.SX_CLOCK ? window.SX_CLOCK.now : null;
    G.game.state = 'playing';
    return { before, after, delta: before == null ? null : after - before };
  });
  ok('暂停时模拟时钟不推进', pause.before != null && Math.abs(pause.delta) < 0.001, pause);

  // CLI-3：四图切换后的地面/天空/太阳
  const sea = await page.evaluate(async () => {
    const G = window.__G;
    const snap = (id) => ({ id, map: window.__SX.mapId(), ground: G.ground.root.visible, sky: G.render.sky.visible, sun: +G.render.sun.intensity.toFixed(3) });
    const out = {};
    for (const id of ['depot', 'ship', 'core', 'harbor']) {
      window.__SX.switchMap(id);
      out[id] = snap(id);
    }
    return out;
  });
  ok('depot 非海面：地面/天空隐藏、太阳 0.25', sea.depot.map === 'depot' && !sea.depot.ground && !sea.depot.sky && Math.abs(sea.depot.sun - 0.25) < 1e-6, sea.depot);
  ok('ship 海面：地面/天空可见、太阳 1.2', sea.ship.map === 'ship' && sea.ship.ground && sea.ship.sky && Math.abs(sea.ship.sun - 1.2) < 1e-6, sea.ship);
  ok('core 非海面：地面/天空隐藏、太阳 0.25', sea.core.map === 'core' && !sea.core.ground && !sea.core.sky && Math.abs(sea.core.sun - 0.25) < 1e-6, sea.core);
  ok('harbor 恢复：地面/天空可见', sea.harbor.map === 'harbor' && sea.harbor.ground && sea.harbor.sky, sea.harbor);

  // CLI-4：depot 强制隐藏后再切 ship，不能残留隐藏组
  await page.waitForFunction(() => window.__SX_LOD && window.__SX_LOD.ready === true, null, { timeout: 30000 }).catch(() => {});
  const lod = await page.evaluate(async () => {
    const G = window.__G;
    window.__SX.switchMap('depot');
    const lodApi = window.__SX_LOD;
    // 等 map:loaded 的 rebuild 完成，再把玩家放到 1000m 外强制隐藏 depot 装饰组。
    await new Promise((r) => setTimeout(r, 150));
    G.player.pos.set(1000, 0, 1000);
    if (lodApi && lodApi.rebuild) lodApi.rebuild();
    if (lodApi && lodApi.setDistance) lodApi.setDistance(30);
    // stats() 返回内部对象引用，切图会原地更新，必须先拷贝快照。
    const before = lodApi && lodApi.stats ? Object.assign({}, lodApi.stats()) : null;
    window.__SX.switchMap('ship');
    const after = lodApi && lodApi.stats ? Object.assign({}, lodApi.stats()) : null;
    G.player.pos.set(-32, 0, 6);
    let tagged = 0;
    try { G.scene.traverse((o) => { if (o.userData && o.userData.sxLod) tagged++; }); } catch (e) {}
    return { before: before && before.hidden, after: after && after.hidden, groups: after && after.groups, beforeGroups: before && before.groups, ready: !!(lodApi && lodApi.ready), depotMap: window.__SX.mapId(), tagged };
  });
  ok('LOD 切图后不再残留隐藏组', lod.beforeGroups === 0 || (lod.before > 0 && lod.after === 0), lod);

  // V53 回归：complete 后模拟时钟冻结，但下一关解锁/最佳成绩必须靠 UI 实时钟完成。
  const campaign = await page.evaluate(async () => {
    window.__SX.launchFast(0);
    await new Promise((r) => setTimeout(r, 200));
    const st = window.__SX_CAMP.state();
    // 固定到第一关未解锁状态，直接验证 complete 回调是否真的执行（旧 bug 会被 CLOCK.cancelGroup('mission') 清掉）。
    st.current = 0;
    st.unlocked = 1;
    const beforeUnlocked = st.unlocked;
    window.__G.game.state = 'complete';
    window.__G.events.emit('game:state', { state: 'complete', prev: 'playing' });
    await new Promise((r) => setTimeout(r, 1200));
    const after = window.__SX_CAMP.state();
    return { beforeUnlocked, afterUnlocked: after.unlocked, best: after.best && after.best.m1, current: after.current };
  });
  ok('通关 complete 后解锁下一关/记录最佳成绩', campaign.afterUnlocked > campaign.beforeUnlocked && !!campaign.best, campaign);

  // V55：第三关（m3）BOSS 战无人机数量 1/1/2，自爆伤害 36 / 半径 4.0。
  const drone = await page.evaluate(() => {
    const m3 = window.__SX_CAMP && window.__SX_CAMP.missions[2];
    const cfg = window.SX_BALANCE && window.SX_BALANCE.enemies && window.SX_BALANCE.enemies.suicideDrone;
    return { waves: m3 && m3.waves.map((w) => w.drone || 0), cfg };
  });
  ok('第三关无人机减量为 1/1/2', !!drone.waves && drone.waves.join(',') === '1,1,2', drone.waves);
  ok('无人机自爆伤害/半径下调为 36 / 4.0', !!drone.cfg && drone.cfg.explodeDamage === 36 && drone.cfg.explodeRadius === 4.0, drone.cfg);

  // SAVE-1：导入后旧键镜像存在且与统一档一致
  const save = await page.evaluate(() => {
    try { localStorage.removeItem('saltline.campaign.v1'); } catch (e) {}
    const state = JSON.parse(window.__SX.saveExport());
    const r = window.__SX.saveImport(JSON.stringify(state));
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem('saltline.campaign.v1') || 'null'); } catch (e) {}
    return { ok: !!(r && r.ok), legacy: !!legacy, unlocked: legacy && legacy.unlocked };
  });
  ok('存档导入后旧键镜像同步', save.ok && save.legacy, save);

  const errors = await page.evaluate(() => (window.__errors || []).slice(0, 10));
  ok('无 pageerror', page.__testErrors.length === 0, page.__testErrors.slice(0, 3));
  ok('window.__errors 为空', errors.length === 0, errors);
} catch (e) {
  fail++;
  console.log('FAIL · 验收异常 — ' + ((e && e.stack) || e));
} finally {
  await closeBrowser(browser);
}
console.log('\n----------------------------------------');
console.log('PASS ' + pass + ' · FAIL ' + fail);
console.log(fail ? '结果：失败' : '结果：全部通过');
process.exit(fail ? 1 : 0);
