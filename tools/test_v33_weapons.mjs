#!/usr/bin/env node
/* =====================================================================
   V33 · 武器测试（WP33-2/3/4）
   - 打开 game_v33.html（独立构建，避免覆盖主构建）
   - 覆盖：6 把武器接入 / 三把新枪 cfg / 数据表同源 / 4-5-6 切枪 /
     SMG 连射 10 发 / 距离衰减单调 / 穿透单测 / 后坐模式可复现 /
     HUD 6 格 / 滚轮 / F8 调参 HUD / 无 pageerror
   运行：node tools/test_v33_weapons.mjs
   前置：node tools/build.cjs game_v33.html v33
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SX_V33_URL || 'http://127.0.0.1:3311/game_v33.html?q=low&noaudio=1&autostart=1&dt=0.1';

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log('PASS  ' + name + (detail ? '  ' + detail : ''));
  } else {
    fail++;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('FAIL  ' + name + (detail ? '  ' + detail : ''));
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: PW_ARGS,
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 180000 });
  await page.waitForTimeout(2200);

  /* ---------------------------------------------------- 1. 六把武器 */
  const boot = await page.evaluate(() => ({
    ready: window.__ready,
    fatal: window.__fatal,
    state: window.__G && window.__G.game && window.__G.game.state,
    ids: (window.__G.weapon.list || []).map((w) => w.id),
    shorts: (window.__G.weapon.list || []).map((w) => w.short),
    tunes: !!window.__SX_TUNE,
    dataKeys: Object.keys(window.__SX_WEAPON_DATA || {}),
    extDefs: ((window.__SX_WEAPON_EXT || {}).defs || []).length,
  }));
  check('启动无致命错误且进入 playing', boot.ready === true && !boot.fatal && boot.state === 'playing',
    JSON.stringify({ ready: boot.ready, fatal: boot.fatal, state: boot.state }));
  check('G.weapon.list 至少 6 把且包含 smg/lmg/sidearm', boot.ids.length >= 6 &&
    ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'].every((id) => boot.ids.includes(id)),
    boot.ids.join(','));

  /* ------------------------------------------- 2. 三把新枪 cfg 字段齐全 */
  const REQUIRED = ['muzzle', 'eject', 'sightY', 'lensF', 'window', 'magPos', 'boltTravel', 'grip',
    'handguard', 'handguardR', 'handlePos', 'squeeze', 'magSize', 'reserve', 'rpm', 'damage', 'range',
    'reloadT', 'reloadEmptyT', 'recoil', 'scale', 'hipPos', 'hipRot'];
  const cfgs = await page.evaluate((ids) => {
    const out = {};
    for (const id of ids) out[id] = window.__SX_WEAPON_DATA[id].cfg;
    return out;
  }, ['smg', 'lmg', 'sidearm']);
  const missing = {};
  for (const id of Object.keys(cfgs)) {
    const miss = REQUIRED.filter((k) => cfgs[id][k] === undefined || cfgs[id][k] === null);
    if (id === 'smg' && cfgs[id].suppressor !== true) miss.push('suppressor');
    if (id === 'lmg' && cfgs[id].moveMul !== 0.85) miss.push('moveMul=0.85');
    if (id === 'sidearm' && (cfgs[id].semi !== true || !(cfgs[id].swapT > 0))) miss.push('semi/swapT');
    if (miss.length) missing[id] = miss;
  }
  check('三把新枪 cfg 字段齐全（含 moveMul/suppressor/semi/swapT）', Object.keys(missing).length === 0,
    Object.keys(missing).length ? JSON.stringify(missing) : Object.keys(cfgs).join(','));

  /* --------------------------------------------- 3. JSON 数据表与运行时同源 */
  const WDIR = path.join(ROOT, 'packages', 'data', 'weapons');
  const JSON_IDS = ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'];
  const fileProblems = [];
  const runtimeData = await page.evaluate(() => window.__SX_WEAPON_DATA);
  for (const id of JSON_IDS) {
    const fp = path.join(WDIR, id + '.json');
    if (!fs.existsSync(fp)) { fileProblems.push(id + ':missing'); continue; }
    let j;
    try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { fileProblems.push(id + ':badjson'); continue; }
    const r = runtimeData[id];
    if (!r) { fileProblems.push(id + ':runtime-missing'); continue; }
    const pairs = [
      ['damage', j.damage, r.damage],
      ['rpm', j.fire && j.fire.rpm, r.fire.rpm],
      ['mag', j.mag, r.mag],
      ['reserve', j.reserve, r.reserve],
      ['penetration', j.penetration, r.penetration],
      ['falloff.start', j.falloff.start, r.falloff.start],
      ['falloff.end', j.falloff.end, r.falloff.end],
      ['falloff.minMul', j.falloff.minMul, r.falloff.minMul],
      ['recoilPattern.n', j.recoilPattern.pattern.length, r.recoilPattern.pattern.length],
      ['cfg.damage', j.cfg.damage, r.cfg.damage],
      ['cfg.magSize', j.cfg.magSize, r.cfg.magSize],
    ];
    const bad = pairs.filter(([, a, b]) => !near(+a, +b)).map(([k, a, b]) => k + ':' + a + '!=' + b);
    if (bad.length) fileProblems.push(id + ':' + bad.join('|'));
  }
  check('packages/data/weapons 六份 JSON 存在且与运行时同源', fileProblems.length === 0,
    fileProblems.length ? fileProblems.join(' ; ') : 'pac9/breaker12/dmr/smg/lmg/sidearm');

  /* ------------------------------------------------ 4. Digit4/5/6 切枪 */
  const switches = [];
  for (const [key, idx, id] of [['Digit4', 3, 'smg'], ['Digit5', 4, 'lmg'], ['Digit6', 5, 'sidearm']]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(320);
    const st = await page.evaluate(() => ({
      idx: window.__G.weapon.activeIndex,
      id: window.__G.weapon.list[window.__G.weapon.activeIndex].id,
      visible: window.__G.weapon.list[window.__G.weapon.activeIndex].root.visible,
    }));
    switches.push({ key, got: st.idx + ':' + st.id });
    check('按键 ' + key + ' 切换到 ' + id, st.idx === idx && st.id === id && st.visible === true, JSON.stringify(st));
  }

  /* -------------------------------- 5. 侧牙 / 重锚 数值与半自动/移速 */
  const stats = await page.evaluate(() => {
    const g = (id) => {
      const w = window.__G.weapon.list.find((x) => x.id === id);
      return {
        id: w.id, mag: w.magSize, reserve: w.reserve, rpm: w.rpm, damage: w.damage,
        reloadT: w.reloadT, reloadEmptyT: w.reloadEmptyT, semi: !!w.cfg.semi,
        moveMul: w.cfg.moveMul, swapT: w.cfg.swapT, range: w.cfg.range,
      };
    };
    return [g('smg'), g('lmg'), g('sidearm')];
  });
  const [S, L, P] = stats;
  check('SMG 数值 32 发 / 900rpm / 18 伤害 / 换弹 1.9s / 射程 120', S.mag === 32 && S.rpm === 900 && S.damage === 18 &&
    near(S.reloadT, 1.9) && S.range === 120 && S.reserve === 192, JSON.stringify(S));
  check('LMG 数值 80 发 / 520rpm / 34 伤害 / 换弹 4.2s / moveMul 0.85 / 射程 200', L.mag === 80 && L.rpm === 520 &&
    L.damage === 34 && near(L.reloadT, 4.2) && L.moveMul === 0.85 && L.range === 200 && L.reserve === 240, JSON.stringify(L));
  check('侧牙 12 发 / 420rpm / 38 伤害 / semi / swapT 0.18 / 备弹 60', P.mag === 12 && P.rpm === 420 &&
    P.damage === 38 && P.semi === true && near(P.swapT, 0.18) && P.reserve === 60, JSON.stringify(P));

  /* -------------------------------------------- 6. SMG 连射 10 发 */
  const fire = await page.evaluate(() => {
    const G = window.__G;
    G.player.invulnerable = true;
    G.weapon.select(3);
    const w = G.weapon.list[3];
    w.reset && w.reset();
    const start = w.ammo, shots0 = G.combat.stats.shots;
    G.input.fire = true;
    let steps = 0;
    while (start - w.ammo < 10 && steps < 240) { w.update(0.02); steps++; }
    G.input.fire = false;
    return {
      start, ammo: w.ammo, consumed: start - w.ammo, steps,
      shotDelta: G.combat.stats.shots - shots0,
      spread: w.spread, last10: window.__SX_TUNE.last10().length,
      lastWeapon: window.__SX_TUNE.last10().slice(-1)[0] && window.__SX_TUNE.last10().slice(-1)[0].weapon,
    };
  });
  check('SMG 连射 10 发后弹匣恰好 -10', fire.consumed === 10 && fire.ammo === 22 && fire.shotDelta >= 10,
    JSON.stringify(fire));

  /* --------------------------------------- 7. 距离衰减：单调 + 端点 */
  const falloff = await page.evaluate(() => {
    const ids = ['pac9', 'breaker12', 'dmr', 'smg', 'lmg', 'sidearm'];
    const out = {};
    for (const id of ids) {
      const d = window.__SX_WEAPON_DATA[id];
      let prev = 1, mono = true, steps = 0;
      for (let x = 0; x <= d.range + 10; x += 1) {
        const v = window.__SX_TUNE.falloff(id, x);
        if (v > prev + 1e-9) mono = false;
        prev = v; steps++;
      }
      out[id] = {
        mono,
        at0: window.__SX_TUNE.falloff(id, 0),
        atStart: window.__SX_TUNE.falloff(id, d.falloff.start),
        atEnd: window.__SX_TUNE.falloff(id, d.falloff.end),
        minMul: d.falloff.minMul, steps,
        midBelowStart: window.__SX_TUNE.falloff(id, (d.falloff.start + d.falloff.end) / 2) < 1,
      };
    }
    return out;
  });
  const badFall = Object.keys(falloff).filter((id) => !falloff[id].mono || falloff[id].at0 !== 1 ||
    falloff[id].atStart !== 1 || Math.abs(falloff[id].atEnd - falloff[id].minMul) > 1e-9);
  check('六把枪距离衰减单调递减且起止点正确', badFall.length === 0,
    badFall.length ? JSON.stringify(badFall) : JSON.stringify(falloff.smg));

  /* ------------------------------------------------ 8. 穿透单测 */
  const pen = await page.evaluate(() => {
    const makeApi = (surface, thick) => {
      const damaged = [];
      return {
        damaged,
        raycast(o, d, r) {
          if (o.x >= 1.0) return null;
          return {
            dist: 2, point: { x: 2, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 },
            surface, box: { min: { x: 1.95, y: -1, z: -1 }, max: { x: 2.05, y: 1, z: 1 } },
          };
        },
        enemyRaycast(o, d, r) {
          if (o.x < 2.06) return null;
          return { dist: 3, point: { x: o.x + 3, y: 0, z: 0 }, normal: { x: -1, y: 0, z: 0 }, enemy: { id: 'mock' }, part: 'body' };
        },
        thickness() { return thick; },
        damage(rec) { damaged.push(rec); return false; },
      };
    };
    const spec = { damage: 30, range: 60, falloff: { start: 20, end: 50, minMul: 0.6 }, penetration: 0.5, penetrationMul: 0.7, headMul: 2, maxPen: 1 };
    const o = { x: 0, y: 0, z: 0 }, d = { x: 1, y: 0, z: 0 };
    const woodApi = makeApi('wood', 0.1);
    const wood = window.__SX_TUNE.traceCore(woodApi, o, d, spec);
    const concreteApi = makeApi('concrete', 0.3);
    const concrete = window.__SX_TUNE.traceCore(concreteApi, o, d, spec);
    return {
      wood: wood.map((h) => h.kind),
      woodDamaged: woodApi.damaged.length,
      woodDmg: woodApi.damaged[0] && woodApi.damaged[0].damage,
      woodMul: woodApi.damaged[0] && woodApi.damaged[0].dmgMul,
      concrete: concrete.map((h) => h.kind),
      concreteDamaged: concreteApi.damaged.length,
    };
  });
  check('薄木墙穿透：world→exit→entity，穿透后伤害 >0 且衰减', pen.wood.length === 3 &&
    pen.wood[0] === 'world' && pen.wood[1] === 'exit' && pen.wood[2] === 'entity' &&
    pen.woodDamaged === 1 && pen.woodDmg > 0 && near(pen.woodDmg, 21, 0.6) && near(pen.woodMul, 0.7),
    JSON.stringify(pen));
  check('0.3m 混凝土不可穿透（无 entity 伤害）', pen.concrete.length === 1 && pen.concrete[0] === 'world' &&
    pen.concreteDamaged === 0, JSON.stringify(pen.concrete));

  /* --------------------------------------- 9. 后坐模式：确定性 + S 曲线 */
  const recoil = await page.evaluate(() => {
    const p1 = window.__SX_TUNE.pattern('smg', 10, 4207);
    const p2 = window.__SX_TUNE.pattern('smg', 10, 4207);
    const p3 = window.__SX_TUNE.pattern('smg', 10, 99);
    const lmg = window.__SX_TUNE.pattern('lmg', 10, 4207);
    const same = JSON.stringify(p1) === JSON.stringify(p2);
    const differsSeed = JSON.stringify(p1) !== JSON.stringify(p3);
    const differsWeapon = JSON.stringify(p1) !== JSON.stringify(lmg);
    const yawSignChanges = p1.slice(0, 8).some((k, i, a) => i > 0 && Math.sign(k.yaw) !== Math.sign(a[i - 1].yaw));
    const lmgPitchGrows = lmg[5].pitch > lmg[0].pitch;
    return { p1, same, differsSeed, differsWeapon, yawSignChanges, lmgPitchGrows };
  });
  check('后坐模式：同种子前 10 发完全可复现，不同种子/武器不同', recoil.same && recoil.differsSeed && recoil.differsWeapon,
    JSON.stringify(recoil.p1.slice(0, 3)));
  check('后坐模式：横向 S 曲线（左右交替）且重锚纵向递增', recoil.yawSignChanges && recoil.lmgPitchGrows,
    'yawSignChanges=' + recoil.yawSignChanges + ' lmgPitchGrows=' + recoil.lmgPitchGrows);

  /* ---------------------------------------- 10. HUD 6 格 / 滚轮 / F8 */
  const hud6 = await page.evaluate(() => document.querySelectorAll('.x-loadout .x-slot').length);
  check('HUD .x-loadout 渲染 6 格且允许换行', hud6 >= 6, 'slots=' + hud6);
  const wheel = await page.evaluate(() => {
    const G = window.__G;
    G.input.locked = true;
    const before = G.weapon.activeIndex;
    window.__SX_TUNE.select(5);
    const mid = G.weapon.activeIndex;
    window.__SX_TUNE.wheel(-1);
    return { before, mid, after: G.weapon.activeIndex, wheelFn: typeof window.__SX_TUNE.wheel };
  });
  check('滚轮切枪（__SX_TUNE.wheel 与 wheel 监听同源）', wheel.mid === 5 && wheel.after === 4 && wheel.wheelFn === 'function',
    JSON.stringify(wheel));
  await page.keyboard.press('F8');
  await page.waitForTimeout(200);
  const tuneHud = await page.evaluate(() => {
    const el = document.querySelector('.x-tune');
    return { present: !!el, on: el && el.className.indexOf('on') >= 0, text: el ? el.textContent.slice(0, 120) : '' };
  });
  check('F8 弹着 HUD 可显示最近 10 发 JSON', tuneHud.present && tuneHud.on && tuneHud.text.indexOf('TUNE') >= 0,
    JSON.stringify(tuneHud));
  await page.keyboard.press('F8');

  /* --------------------------------------------- 11. 运行时弹道返回兼容 */
  const runtimeShot = await page.evaluate(() => {
    const G = window.__G;
    G.weapon.select(3);
    const eye = G.player.eye.clone();
    const dir = G.player.forward.clone();
    const r = G.combat.playerShot(eye, dir, { damage: 18, range: 120 });
    if (!r) return { nil: true };
    return {
      keys: ['point', 'dist', 'surface', 'dir', 'from', 'falloff', 'dmgMul', 'penetrations'].filter((k) => r[k] !== undefined),
      surface: r.surface, dist: +r.dist.toFixed(2), falloff: r.falloff, dmgMul: r.dmgMul,
    };
  });
  check('包装后的 playerShot 保持 point/dist/surface/dir/from 兼容', runtimeShot.nil ||
    (runtimeShot.keys.includes('point') && runtimeShot.keys.includes('dist') && runtimeShot.keys.includes('surface') &&
      runtimeShot.keys.includes('dir') && runtimeShot.keys.includes('from')), JSON.stringify(runtimeShot));

  /* ------------------------------------------------- 12. 无 pageerror */
  const errs = await page.evaluate(() => (window.__errors || []).slice(0, 8));
  check('无 pageerror / 无 window.__errors', pageErrors.length === 0 && errs.length === 0,
    JSON.stringify({ pageErrors: pageErrors.slice(0, 3), engine: errs }));

  console.log('\n切换轨迹：' + switches.map((s) => s.key + '→' + s.got).join('  '));
} catch (e) {
  fail++;
  failures.push('测试脚本异常: ' + (e && e.stack || e));
  console.log('FAIL  测试脚本异常: ' + (e && e.message || e));
} finally {
  await browser.close();
}

console.log('\n========== V33 WP33-2/3/4 结果：' + pass + ' PASS / ' + fail + ' FAIL ==========');
if (fail) {
  console.log('失败项：\n - ' + failures.join('\n - '));
  process.exit(1);
}
