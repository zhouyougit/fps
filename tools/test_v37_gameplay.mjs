#!/usr/bin/env node
/* =====================================================================
   V37 玩法质量回归（只跑本文件，不跑 85 项全量）
   覆盖：池复用击杀计钱 / BOSS 召唤物回收 / 攻城蛛齐射 / m7 坚守区域 /
        检查点按 relay id 恢复 / MP 不注入中继 / 未解锁配件不生效
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tools/.v37_gameplay.html');
execFileSync(process.execPath, ['tools/build.cjs', out, 'v36'], { cwd: root, stdio: 'inherit' });

const url = 'file://' + out + '?q=low&noaudio=1';
function chromeExe() {
  const cands = [
    process.env.CHROME_EXE,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const p of cands) if (p && fs.existsSync(p)) return p;
  // 本地 Playwright 缓存版本与 package 不一致时，退而使用已安装的 Chromium
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
// 首次导航清一次本地存档；reload 时保留（loadArmory 校验需要）
await context.addInitScript(() => {
  try {
    if (!localStorage.getItem('__v37_init')) {
      localStorage.clear();
      localStorage.setItem('__v37_init', '1');
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
      () => !!(window.__G && window.__SX && window.__SX2 && window.__SX_PROGRESS && window.__SX_ARMORY && window.__SX_E2 && window.__SX_BOSS && window.__SX_CAMP),
      null,
      { timeout: 60000 }
    );
  } catch (e) {
    const diag = await page.evaluate(() => ({
      G: !!window.__G, SX: !!window.__SX, SX2: !!window.__SX2,
      PROGRESS: !!window.__SX_PROGRESS, ARMORY: !!window.__SX_ARMORY,
      E2: !!window.__SX_E2, BOSS: !!window.__SX_BOSS, CAMP: !!window.__SX_CAMP,
      errors: (window.__errors || []).slice(-10)
    })).catch(() => null);
    console.log('BOOT DIAG', JSON.stringify(diag), 'pageerrors', JSON.stringify(errs.slice(-5)));
    throw e;
  }
  await page.waitForTimeout(500);
}
// 无头环境 rAF 会停；用固定步 + 表现系统 update 显式推进模拟
async function stepFrames(n) {
  await page.evaluate((count) => {
    for (let i = 0; i < count; i++) {
      if (window.__SX_LOOP) window.__SX_LOOP.step(1);
      if (window.SX_SYSTEMS) window.SX_SYSTEMS.update(1 / 60, 0);
    }
  }, n);
}
async function launch(idx) {
  await page.evaluate((i) => window.__SX.launchFast(i), idx);
  await page.waitForFunction(() => window.__G && window.__G.game && window.__G.game.state === 'playing', null, { timeout: 60000 });
  await stepFrames(6);
}
async function T(name, fn) {
  try {
    const detail = await fn();
    if (detail === false) throw new Error('assertion failed');
    ok(name, true, detail);
    return detail;
  } catch (e) {
    ok(name, false, String((e && e.stack) || e));
    return null;
  }
}

await page.goto(url, { waitUntil: 'load', timeout: 240000 });
await bootWait();
ok('启动无 fatal', await page.evaluate(() => !window.__fatal && !!window.__G), await page.evaluate(() => window.__fatal || null));

/* 1. 挑战上限 24 + 成就 tier2 24 + 动态总数 */
await T('挑战档位/徽章上限 24（campaign 动态总数）', async () => {
  await page.waitForFunction(() => !!document.querySelector('.x-prog-badge'), null, { timeout: 5000 });
  const d = await page.evaluate(() => {
    const defs = window.__SX_PROGRESS.definitions();
    const ch = defs.find((x) => x.id === 'challenger');
    return {
      total: window.__SX_CAMP.challengeTotal(),
      missions: window.__SX_CAMP.missions.length,
      need: ch && ch.need,
      tier2: ch && ch.tier2,
      badge: (document.querySelector('.x-prog-badge') || {}).textContent || ''
    };
  });
  if (!(d.total === 24 && d.missions === 8 && d.tier2 === 24 && /\/24/.test(d.badge))) throw new Error(JSON.stringify(d));
  return d;
});

/* 2. 未解锁配件不生效；购买后生效 */
await T('价格>0 且未解锁的配件不生效', async () => {
  const d = await page.evaluate(() => {
    const G = window.__G, P = window.__SX_PROGRESS;
    const list = (G.weapon && G.weapon.list) || [];
    const wid = (list.find((w) => w.id === 'pac9') || list[0] || {}).id;
    const cat = (window.__SX_ARMORY.catalog || []).filter((c) => c.wid === wid && c.price > 0);
    const pick = cat.find((c) => !P.isUnlocked(c.id));
    if (!pick) return { skip: true, wid: wid };
    const defaults = window.__SX_ARMORY.defaults();
    const defOpt = defaults[wid][pick.slot];
    window.__SX.armorySelect(wid, pick.slot, defOpt);
    const s0 = window.__SX.armoryStats(wid);
    window.__SX.armorySelect(wid, pick.slot, pick.opt);
    const s1 = window.__SX.armoryStats(wid);
    const lockedApplied = JSON.stringify(s0) !== JSON.stringify(s1);
    P.add(3000);
    const buy = P.purchase(pick.id, pick.price, pick.name);
    window.__SX.armorySelect(wid, pick.slot, pick.opt);
    const s2 = window.__SX.armoryStats(wid);
    return {
      wid: wid, pick: pick.id, price: pick.price,
      lockedApplied: lockedApplied, purchased: !!(buy && buy.ok),
      ownedApplied: JSON.stringify(s1) !== JSON.stringify(s2),
      s0: s0, s1: s1, s2: s2
    };
  });
  if (d.skip) throw new Error('no locked priced attachment: ' + JSON.stringify(d));
  if (d.lockedApplied || !d.purchased || !d.ownedApplied) throw new Error(JSON.stringify(d));
  return { pick: d.pick, lockedApplied: d.lockedApplied, purchased: d.purchased, ownedApplied: d.ownedApplied };
});

/* 3. m1：对象池复用同对象换 id 必须继续计钱 */
await launch(0);
await T('池复用击杀计钱（同对象新 id 不再被吞）', async () => {
  const d = await page.evaluate(() => {
    const before = window.__SX_PROGRESS.credits();
    const e = { id: 91001, variant: '', type: 'gull' };
    window.__G.events.emit('enemy:killed', { enemy: e, type: 'gull' });
    e.id = 91002;            // 模拟对象池复用：同一个 JS 对象，新 id
    window.__G.events.emit('enemy:killed', { enemy: e, type: 'gull' });
    return { before: before, after: window.__SX_PROGRESS.credits(), key: e.__sxProgId };
  });
  if (d.after - d.before !== 16) throw new Error(JSON.stringify(d));
  if (String(d.key).indexOf('91002') < 0) throw new Error('dedup key missing id: ' + d.key);
  return d;
});

/* 4. 普通六关不被 m7/m8 替换逻辑污染 */
await T('普通六关 gull/hound 不被替换', async () => {
  const out = await page.evaluate(() => {
    const G = window.__G, arr = [];
    for (let i = 0; i < 9; i++) {
      const e = window.__SX_E2.spawn('gull', 0, 8, 0, {});
      arr.push(e ? e.variant : null);
      if (e) G.enemies.debug.ctx.retire(e);
    }
    return arr;
  });
  if (out.some((v) => v !== '')) throw new Error(JSON.stringify(out));
  return out;
});

/* 5. 池复用普通机体清理 sx2 / _sx2Wrapped / wardenMesh */
await T('对象池复用清除 WARDEN 残留（sx2 / 包装 / 网格）', async () => {
  const d = await page.evaluate(() => {
    const G = window.__G;
    const w = window.__SX_E2.spawn('warden', 0, 9, 0, {});
    if (!w) return { error: 'no warden' };
    const before = { sx2: !!w.sx2, mesh: !!w.wardenMesh, wrapped: !!w._sx2Wrapped };
    G.enemies.debug.ctx.retire(w);
    let same = null;
    for (let i = 0; i < 16; i++) {
      const g = window.__SX_E2.spawn('gull', 0, 8, 0, {});
      if (!g) break;
      if (g === w) {
        same = { variant: g.variant, sx2: !!g.sx2, mesh: !!g.wardenMesh, wrapped: !!g._sx2Wrapped };
        break;
      }
      G.enemies.debug.ctx.retire(g);
    }
    return { before: before, same: same };
  });
  if (!d.same) throw new Error('pool object not reused: ' + JSON.stringify(d));
  if (!(d.before.sx2 && d.before.mesh && d.before.wrapped)) throw new Error(JSON.stringify(d));
  if (d.same.variant !== '' || d.same.sx2 || d.same.mesh || d.same.wrapped) throw new Error(JSON.stringify(d));
  return d;
});

/* 6. 攻城蛛：burstCount=2、shotDamage≈0、一次齐射恰好 2 发 */
await T('攻城蛛齐射恰好 2 发（单一路径）', async () => {
  const base = await page.evaluate(() => {
    const G = window.__G, p = G.player.pos;
    const e = window.__SX_E2.spawn('siege', p.x + 15, p.y, p.z, {});
    if (!e) return { error: 'no siege' };
    e.passive = true;                 // 冻结引擎 AI，只观察产弹路径
    if (e.sx2) { e.sx2.fireCd = 0; e.sx2.seenT = 0; }
    return { burst: e.burstCount, shotDamage: e.shotDamage, shells: window.__SX_E2.state().shells, id: e.id };
  });
  if (base.error) throw new Error(JSON.stringify(base));
  await stepFrames(30);
  const idle = await page.evaluate(() => window.__SX_E2.state().shells);
  const fired = await page.evaluate(() => {
    const e = window.__G.enemies.list.find((x) => x.variant === 'siege' && x.alive);
    if (!e) return null;
    const s0 = window.__SX_E2.state().shells;
    window.__G.events.emit('enemy:fire', { enemy: e, pos: e.pos, type: 'hound' });
    window.__G.events.emit('enemy:fire', { enemy: e, pos: e.pos, type: 'hound' });
    return { s0: s0, s1: window.__SX_E2.state().shells };
  });
  await stepFrames(24);
  const after = await page.evaluate(() => window.__SX_E2.state().shells);
  if (!(base.burst === 2 && base.shotDamage > 0 && base.shotDamage < 0.01)) throw new Error(JSON.stringify(base));
  if (idle !== base.shells) throw new Error('post spawned shells without enemy:fire: ' + idle + '/' + base.shells);
  if (!fired || fired.s1 - fired.s0 !== 2) throw new Error('shells not exactly 2: ' + JSON.stringify(fired));
  if (after !== fired.s1) throw new Error('extra shells after salvo: ' + after + '/' + fired.s1);
  return { burst: base.burst, shotDamage: base.shotDamage, shells: fired.s1 };
});

/* 7. m7：检查点按 relay id 恢复 + run.time */
await launch(6);
await page.waitForFunction(() => {
  const g = window.__SX2.graph();
  return g && g.missionId === 'm7';
}, null, { timeout: 20000 });
await T('检查点按 relay id 恢复（非索引前缀）并还原计时', async () => {
  const cp = await page.evaluate(() => {
    const G = window.__G, r = G.game.run;
    r.relays.forEach((x) => { x.cut = false; x.cutting = false; x.t = 0; });
    const target = r.relays[Math.min(2, r.relays.length - 1)];
    target.cut = true;
    r.cut = 1;
    r.allCut = false;
    r.time = 42.5;
    const c = window.__SX2.saveCheckpoint();
    r.relays.forEach((x) => { x.cut = false; x.cutting = false; x.t = 0; });
    r.cut = 0;
    r.allCut = false;
    r.time = 0;
    return { targetId: target.id, relays: c && c.relays, cut: c && c.cut, tick: c && c.tick };
  });
  const restored = await page.evaluate(() => {
    const ok = window.__SX2.restore();
    const r = window.__G.game.run;
    return { ok: ok, cut: r.cut, time: r.time, ids: r.relays.filter((x) => x.cut).map((x) => x.id) };
  });
  if (!cp.relays || cp.relays.indexOf(cp.targetId) < 0) throw new Error('checkpoint missing relay id: ' + JSON.stringify(cp));
  if (!(restored.ok && restored.cut === 1 && restored.ids.length === 1 && restored.ids[0] === cp.targetId)) throw new Error(JSON.stringify(restored));
  if (Math.abs(restored.time - 42.5) > 0.001) throw new Error('run.time not restored: ' + restored.time);
  return { targetId: cp.targetId, cut: restored.cut, time: restored.time };
});

/* 9. m7 hold 必须有区域：数据 at + 行为（区域外不涨，区域内涨） */
await T('m7 hold 必须进入撤离区域', async () => {
  const data = await page.evaluate(() => {
    const m = window.__SX_CAMP.missions.find((x) => x.id === 'm7');
    const h = m && m.objectivesGraph && m.objectivesGraph.find((o) => o.type === 'hold');
    return h && h.at;
  });
  if (!data || data.x !== -32 || data.z !== 6 || data.r !== 6) throw new Error('m7 hold.at missing: ' + JSON.stringify(data));
  await page.evaluate(() => window.__SX.cutAll());
  await stepFrames(4);
  await page.waitForFunction(() => {
    const g = window.__SX2.graph();
    return g && g.phases[g.active] && g.phases[g.active].type === 'kill';
  }, null, { timeout: 15000 });
  await page.evaluate(() => window.__SX2.kill(18));
  await stepFrames(4);
  await page.waitForFunction(() => {
    const g = window.__SX2.graph();
    return g && g.phases[g.active] && g.phases[g.active].type === 'hold' && g.phases[g.active].state === 'active';
  }, null, { timeout: 15000 });
  // 区域外
  await page.evaluate(() => {
    const G = window.__G, P = G.player;
    P.pos.set(0, P.pos.y, 0);
    if (P.vel) P.vel.set(0, 0, 0);
  });
  await stepFrames(40);
  const outside = await page.evaluate(() => {
    const g = window.__SX2.graph(), p = g.phases[g.active];
    return { type: p.type, progress: p.progress, text: window.__SX2.objective() };
  });
  // 区域内
  await page.evaluate(() => {
    const G = window.__G, P = G.player;
    const y = G.physics.groundHeight(-32, 6, 4);
    P.reset({ pos: new G.THREE.Vector3(-32, y, 6), yaw: 0 });
  });
  await stepFrames(60);
  const inside = await page.evaluate(() => {
    const g = window.__SX2.graph(), p = g.phases[g.active];
    const P = window.__G.player;
    return { type: p.type, progress: p.progress, text: window.__SX2.objective(), at: p.at, pos: P.pos.toArray(), state: window.__G.game.state, health: P.health, alive: P.alive };
  });
  if (outside.progress > 0.001) throw new Error('hold advanced outside zone: ' + JSON.stringify(outside));
  if (!(inside.progress > 0.2)) throw new Error('hold did not advance inside zone: ' + JSON.stringify(inside));
  if (inside.text.indexOf('坚守撤离区') < 0) throw new Error('hold objective text: ' + inside.text);
  return { at: data, outside: outside.progress, inside: inside.progress };
});

/* 10. m7 固定轮换替换新机体（9 次请求恰好 3 次替换） */
await T('m7 新机体按固定轮换替换（确定性计数）', async () => {
  const d = await page.evaluate(() => {
    const G = window.__G, out = { gull: [], hound: [] };
    for (const t of ['gull', 'hound']) {
      for (let i = 0; i < 9; i++) {
        const e = window.__SX_E2.spawn(t, 0, 8, 0, {});
        out[t].push(e ? e.variant : null);
        if (e) G.enemies.debug.ctx.retire(e);
      }
    }
    return { out: out, replace: window.__SX_E2.replace() };
  });
  const gulls = d.out.gull.filter((v) => v);
  const hounds = d.out.hound.filter((v) => v);
  if (gulls.length !== 3 || hounds.length !== 3) throw new Error(JSON.stringify(d));
  if (gulls.some((v) => v !== 'scout' && v !== 'warden')) throw new Error('bad gull variant: ' + JSON.stringify(gulls));
  if (hounds.some((v) => v !== 'siege' && v !== 'emp')) throw new Error('bad hound variant: ' + JSON.stringify(hounds));
  return { gulls: gulls, hounds: hounds, replace: d.replace };
});

/* 11. BOSS 死亡：召唤物收回对象池、sx2.dead、血条 on 移除 */
await T('BOSS 死后召唤物清空（retire + sx2.dead + 血条隐藏）', async () => {
  await page.evaluate(() => {
    // 释放对象池（m7 波次可能占满 hound/gull 池），保证 BOSS 与召唤物能生成
    const G = window.__G;
    G.enemies.list.filter((e) => !e.boss && !e.__sxBossSummon).slice(0, 8)
      .forEach((e) => { try { G.enemies.debug.ctx.retire(e); } catch (err) {} });
    let bar = document.querySelector('.x-boss');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'x-boss';
      bar.innerHTML = '<div class="x-boss-k">测试</div><div class="x-boss-pips"><em></em><em></em><em></em></div>';
      document.body.appendChild(bar);
    }
    bar.classList.add('on');
    window.__SX_BOSS.spawnFinal();
    window.__SX_BOSS.forcePhase(1);
  });
  await stepFrames(150);
  const summoned = await page.evaluate(() => {
    window.__v37bossDbg = { boss: !!window.__G.enemies.list.find((e) => e.boss), st: window.__SX_BOSS.state() };
    const list = window.__G.enemies.list.filter((e) => e.__sxBossSummon);
    window.__v37summons = list;
    return { count: list.length, state: window.__SX_BOSS.state().summons, variants: list.map((e) => e.variant), dbg: window.__v37bossDbg };
  });
  if (summoned.count < 1) throw new Error('no summons: ' + JSON.stringify(summoned));
  const killed = await page.evaluate(() => {
    const G = window.__G;
    const boss = G.enemies.list.find((e) => e.boss && e.alive);
    if (!boss) return { hadBoss: false };
    boss.alive = false;
    G.events.emit('enemy:killed', { enemy: boss, type: 'boss' });
    const bar = document.querySelector('.x-boss');
    return { hadBoss: true, barOn: !!(bar && bar.classList.contains('on')) };
  });
  await stepFrames(15);
  const after = await page.evaluate(() => {
    const st = window.__SX_BOSS.state();
    const bar = document.querySelector('.x-boss');
    return {
      active: st.active, summons: st.summons, barOn: !!(bar && bar.classList.contains('on')),
      list: (window.__v37summons || []).map((e) => ({ id: e.id, active: e.active, alive: e.alive, dead: !!(e.sx2 && e.sx2.dead) }))
    };
  });
  if (!killed.hadBoss) throw new Error('no boss to kill');
  if (after.active || after.summons !== 0 || after.barOn) throw new Error(JSON.stringify(after));
  if (after.list.some((e) => e.active || e.alive || !e.dead)) throw new Error('summon not retired: ' + JSON.stringify(after.list));
  return { summoned: summoned.count, variants: summoned.variants, after: after.list.length };
});

/* 12. m8 core 中继正常注入；MP active 时绝不注入 */
await launch(7);
await T('MP active 时不注入 core 中继', async () => {
  await stepFrames(5);
  const before = await page.evaluate(() => window.__SX2.coreRelays().map((o) => o.id));
  const d = await page.evaluate(() => {
    const orig = window.__MP;
    window.__MP = { state: () => ({ active: true }) };
    let res = null, err = null;
    try { res = window.__SX2.injectCoreRelays(); } catch (e) { err = String(e && e.message || e); }
    window.__MP = orig;
    return { res: res, err: err, after: window.__SX2.coreRelays().length };
  });
  if (before.length !== 3) throw new Error('core relays not injected: ' + JSON.stringify(before));
  if (d.err || d.res !== null || d.after !== 3) throw new Error(JSON.stringify(d));
  return { relays: before, mpResult: d.res };
});

/* 13. 曲射弹在 game:state title/intro/dead 清空并移除网格
      （放在最后：伪造 state 事件会停掉后续 update 调度，不应影响玩法断言） */
await T('切状态清空曲射弹与网格', async () => {
  const d = await page.evaluate(() => {
    const G = window.__G, p = G.player.pos;
    G.enemies.list.filter((e) => !e.boss && !e.__sxBossSummon).slice(0, 3)
      .forEach((e) => { try { G.enemies.debug.ctx.retire(e); } catch (err) {} });
    const e = window.__SX_E2.spawn('siege', p.x + 10, p.y, p.z, {});
    if (!e) return { error: 'no siege' };
    e.passive = true;
    window.__G.events.emit('enemy:fire', { enemy: e, pos: e.pos, type: 'hound' });
    window.__G.events.emit('enemy:fire', { enemy: e, pos: e.pos, type: 'hound' });
    const before = window.__SX_E2.state().shells;
    window.__G.events.emit('game:state', { state: 'title' });
    return { before: before, after: window.__SX_E2.state().shells };
  });
  if (d.error) throw new Error(JSON.stringify(d));
  if (!(d.before >= 2 && d.after === 0)) throw new Error(JSON.stringify(d));
  return d;
});

/* 14. loadArmory 校验 catalog：坏配件回退默认，合法配件保留 */
await T('loadArmory 校验 catalog（坏 id 回退默认）', async () => {
  await page.evaluate(() => {
    localStorage.setItem('saltline.armory.v1', JSON.stringify({ pac9: { muzzle: 'bogus_opt', mag: 'ext' } }));
  });
  await page.reload({ waitUntil: 'load', timeout: 240000 });
  await bootWait();
  const sel = await page.evaluate(() => window.__SX.armory());
  if (!sel || !sel.pac9) throw new Error('no armory: ' + JSON.stringify(sel));
  if (sel.pac9.muzzle !== 'std' || sel.pac9.mag !== 'ext') throw new Error(JSON.stringify(sel.pac9));
  return sel.pac9;
});

ok('无 pageerror', errs.length === 0, errs.slice(0, 5));

console.log(fails ? fails + ' 项失败' : '全部通过');
try { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); } catch (e) {}
try { fs.rmSync(out, { force: true }); } catch (e) {}
process.exit(fails ? 1 : 0);
