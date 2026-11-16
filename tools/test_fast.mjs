#!/usr/bin/env node
/* 快速套件：Metal/GPU + novisual，状态驱动、固定步、不裸 sleep；目标 < 40s */
import { launchBrowser, openGame, waitState, step, closeBrowser, logicParams, GPU_MODE } from './testkit.mjs';

const browser = await launchBrowser();
const page = await openGame(browser, { params: logicParams({ autostart: '1' }) });
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('PASS · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } else { fail++; console.log('FAIL · ' + n + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const t0 = Date.now();

try {
  await waitState(page, 'playing', 30000);
  ok('启动进入 playing（GPU=' + GPU_MODE + '）', true);

  const base = await page.evaluate(() => ({
    profile: window.__BUILD__ && window.__BUILD__.profile,
    weapons: window.__G.weapon.list.map(w => w.id),
    slots: document.querySelectorAll('.x-loadout .x-slot').length,
    missions: window.__SX2 ? window.__SX2.missions().map(m => m.id) : [],
    missing: window.__SX_LANG ? window.__SX_LANG.missing() : null,
    loops: !!window.__SX_LOOP,
    tick: window.__SX_LOOP ? window.__SX_LOOP.tick() : 0
  }));
  ok('构建/profile 与核心 API', !!base.profile && base.loops, { profile: base.profile, tick: base.tick });
  ok('六把武器与 HUD 六格', base.weapons.join(',') === 'pac9,breaker12,dmr,smg,lmg,sidearm' && base.slots === 6, base);
  ok('八关与零缺失词典', base.missions.length === 8 && base.missing && base.missing.length === 0, { missions: base.missions, missing: base.missing });

  const steps = await page.evaluate(() => {
    const t = window.__SX_LOOP.tick();
    window.__SX_LOOP.step(300);
    return window.__SX_LOOP.tick() - t;
  });
  ok('固定步 step(300) 精确推进', steps === 300, { steps });

  const hashes = await page.evaluate(() => {
    const G = window.__G;
    const run = () => {
      window.__SX.applyMission(0); G.game.start({ skipIntro: true });
      G.enemies.clear();
      G.player.pos.set(-19, 0, 9); G.player.vel.set(0, 0, 0); G.player.yaw = 0; G.player.pitch = 0;
      window.__SX_LOOP.step(30);
      return window.__SX_LOOP.hash();
    };
    const a = run();
    window.__SX_LOOP.step(600);
    const b = window.__SX_LOOP.hash();
    const c = run();
    window.__SX_LOOP.step(600);
    const d = window.__SX_LOOP.hash();
    return { a, b, c, d };
  });
  ok('同状态两次 600 步哈希一致', hashes.b === hashes.d, hashes);

  const switchRes = await page.evaluate(() => {
    const G = window.__G;
    G.weapon.select(3); const a = G.weapon.activeIndex;
    G.weapon.select(4); const b = G.weapon.activeIndex;
    G.weapon.select(5); const c = G.weapon.activeIndex;
    G.weapon.select(0);
    return [a, b, c];
  });
  ok('4/5/6 槽位切换', switchRes.join(',') === '3,4,5', switchRes);

  const variants = await page.evaluate(() => {
    const G = window.__G, T = G.THREE;
    window.__SX.applyMission(6); G.game.start({ skipIntro: true }); G.enemies.clear();
    const out = {};
    for (const t of ['scout', 'siege', 'emp', 'warden']) {
      const e = G.enemies.spawn(t, new T.Vector3(0, 0, 8), { state: 'alert' });
      out[t] = e ? { hp: e.hp, variant: e.variant, base: e.type } : null;
    }
    return out;
  });
  ok('四类新机体可生成', !!(variants.scout && variants.siege && variants.emp && variants.warden), variants);

  const mission = await page.evaluate(() => {
    const g = window.__SX2.graph();
    return { id: g && g.missionId, phases: g && g.phases.map(p => p.type + ':' + p.state) };
  });
  ok('m7 目标图四阶段', mission.id === 'm7' && mission.phases && mission.phases[0].indexOf('cut:active') === 0, mission);

  const slide = await page.evaluate(() => {
    const G = window.__G;
    window.__SX.applyMission(0); G.game.start({ skipIntro: true });
    G.player.pos.set(-19, 0, 9); G.player.vel.set(0, 0, 0); G.input.move.y = 1; G.input.sprint = true; G.input.update(0.016);
    window.__SX_LOOP.step(90);
    const started = window.__SX_MOVE ? window.__SX_MOVE.slide() : false;
    window.__SX_LOOP.step(2);
    const st = window.__SX_MOVE ? window.__SX_MOVE.state() : null;
    return { started, sliding: st && st.sliding, speed: st && +st.speed.toFixed(2) };
  });
  ok('滑铲进入且速度 > 5', slide.started !== false && slide.sliding && slide.speed > 5, slide);

  const lang = await page.evaluate(async () => {
    const L = window.__SX_LANG;
    L.set('en');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const en = document.querySelector('.m-word') ? document.querySelector('.m-word').textContent : '';
    const missing = L.missing();
    L.set('zh-CN');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { en, missing, back: document.querySelector('.m-word') ? document.querySelector('.m-word').textContent : '' };
  });
  ok('中英切换 + 零缺失', lang.en.indexOf('SALTLINE') === 0 && lang.missing.length === 0 && lang.back.indexOf('几猫') >= 0, lang);

  ok('无 pageerror', page.__testErrors.length === 0, page.__testErrors.slice(0, 3));
} catch (e) {
  fail++;
  console.log('FAIL · 快速套件异常 — ' + (e && e.message));
  try { console.log('state', await page.evaluate(() => ({ state: window.__G && window.__G.game.state, err: (window.__errors || []).slice(0, 3) }))); } catch (_) {}
} finally {
  await closeBrowser(browser);
}
console.log(pass + ' PASS / ' + fail + ' FAIL · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's（不含加载）');
process.exit(fail ? 1 : 0);
