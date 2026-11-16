/* V34 AI / 新机体 / 真掩体 关键断言（串行，单页）
   运行：node tools/test_v34_ai.mjs
   打开独立构建 game_v34.html（不碰主构建 game.html） */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const URL = 'file:///Users/zhouyou/codex_workspace/fps/game_v34.html?q=low&noaudio=1&autostart=1&dt=0.1';
const EXE = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true, executablePath: EXE,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });

let fails = 0, pass = 0;
const ok = (name, cond, data) => {
  if (cond) pass++; else fails++;
  console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (data !== undefined ? ' — ' + JSON.stringify(data) : ''));
};

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForFunction(() => !!(window.__SX_AI && window.__SX_ENEMIES2), null, { timeout: 120000 });
  await page.waitForTimeout(1000);

  /* 1. 四类新机体生成 / hp / 底盘映射 */
  const spawn = await page.evaluate(() => {
    const G = window.__G, p = G.player.pos, T = G.THREE;
    const mk = (t, dx, dy, dz) => {
      const e = G.enemies.spawn(t, new T.Vector3(p.x + dx, p.y + dy, p.z + dz), { state: 'alert' });
      return e ? { variant: e.variant, baseType: e.type, hp: e.hp, maxHp: e.maxHp, credits: e.credits, pos: e.pos.toArray() } : null;
    };
    return { scout: mk('scout', 3, 3, 0), siege: mk('siege', 5, 0, 2), emp: mk('emp', 4, 0, 1), warden: mk('warden', 6, 3, 3) };
  });
  const want = { scout: [40, 'gull'], siege: [360, 'hound'], emp: [140, 'hound'], warden: [220, 'gull'] };
  const spawnOk = ['scout', 'siege', 'emp', 'warden'].every(k =>
    spawn[k] && spawn[k].variant === k && spawn[k].baseType === want[k][1] && Math.abs(spawn[k].hp - want[k][0]) < 0.01);
  ok('四类新机体生成 · variant/底盘/HP', spawnOk, spawn);

  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__G.enemies.update(0.016); });

  /* 2. 真掩体筛选 >5 且玩家到掩体眼位视线被挡 */
  const cov = await page.evaluate(() => {
    const A = window.__SX_AI, G = window.__G, T = G.THREE;
    A.refresh();
    const cs = A.covers();
    const p = G.player;
    const eye = p.eye ? p.eye.clone() : new T.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    const bad = [];
    const seen = [];
    for (const c of cs.slice(0, 12)) {
      const st = c.stand || c.pos;
      const ce = new T.Vector3(st[0], G.physics.groundHeight(st[0], st[2], st[1] + 2) + c.eyeY, st[2]);
      const vis = G.physics.lineOfSight(eye, ce);
      seen.push({ id: c.id, blocked: !vis, height: c.height, protectedNow: c.protectedNow, blockedByCover: c.blockedByCover });
      if (vis) bad.push(c.id);
    }
    return { n: cs.length, valid: cs.filter(c => c.protectedNow).length, bad, seen, map: A.state().mapId, stateCovers: A.state().validCovers };
  });
  ok('真掩体筛选 >5 且实测视线被挡', cov.n > 5 && cov.bad.length === 0 && cov.valid > 5, { n: cov.n, valid: cov.valid, bad: cov.bad, sample: cov.seen.slice(0, 4) });

  /* 3. 小队角色完整 */
  const sq = await page.evaluate(() => {
    window.__SX_AI.refresh();
    const ss = window.__SX_AI.squads();
    const roles = [];
    for (const s of ss) for (const m of s.members) if (m.role) roles.push(m.role);
    return { squads: ss.length, roles, detail: ss };
  });
  const roleSet = Array.from(new Set(sq.roles));
  const squadOk = sq.squads >= 1 && sq.roles.length > 0 &&
    roleSet.indexOf('assault') >= 0 && roleSet.indexOf('support') >= 0 && roleSet.indexOf('flanker') >= 0;
  ok('小队分配角色完整（assault/support/flanker）', squadOk, { squads: sq.squads, roles: roleSet });

  /* 4. AI 状态字段完整 */
  const schema = await page.evaluate(() => {
    const st = window.__SX_AI.state();
    const rows = st.enemies.map(e => ({ id: e.id, type: e.type, variant: e.variant, role: e.role, intent: e.intent, hasUtility: !!(e.utility && typeof e.utility.engage === 'number'), hasSquad: !!e.squad, suppressT: typeof e.suppressT, retreatT: typeof e.retreatT }));
    return { rows, ok: rows.every(r => !!r.role && !!r.intent && r.hasUtility && r.hasSquad && r.suppressT === 'number' && r.retreatT === 'number') };
  });
  ok('每个敌人 ai={role,utility,cover,squad,suppressT,retreatT}', schema.ok, schema.rows.slice(0, 3));

  /* 5. 玩家低血 → flank 权重上升 */
  const flank = await page.evaluate(() => {
    const p = window.__G.player;
    const before = window.__SX_AI.weights();
    const hp0 = p.health;
    p.health = 20;
    const after = window.__SX_AI.weights();
    p.health = hp0;
    return { before: before.flank, after: after.flank, beforeAll: before, afterAll: after };
  });
  ok('玩家低血时 flank 权重上升', flank.after > flank.before * 1.3, flank);

  /* 6. 盾墙：光环事件 + 附近敌人减伤 + 护盾可击破 */
  const ward = await page.evaluate(() => {
    const G = window.__G, T = G.THREE, A = window.__SX_AI, E2 = window.__SX_ENEMIES2;
    const p = G.player.pos;
    const w = G.enemies.spawn('warden', new T.Vector3(p.x + 4, p.y + 3, p.z - 2), {});
    const h = G.enemies.spawn('hound', new T.Vector3(p.x + 4, p.y, p.z - 2), {});
    for (const o of G.enemies.list.slice()) if (o !== w && o !== h && o.alive && o.damage) o.damage(9999, o.pos, new T.Vector3(0, 0, 1), 'body');
    const s0 = E2.stats();
    for (let i = 0; i < 40; i++) G.enemies.update(0.016);
    const hp0 = h.hp;
    h.damage(100, h.pos, new T.Vector3(0, 0, 1), 'body');
    const reduced = hp0 - h.hp;
    const shield0 = w.wardenShield;
    w.damage(400, w.pos, new T.Vector3(0, 0, 1), 'body');
    const s1 = E2.stats();
    return {
      auraTicks: s1.wardenTicks - s0.wardenTicks, reduced: +reduced.toFixed(1),
      shield0, shield1: w.wardenShield, breaks: s1.shieldBreaks - s0.shieldBreaks,
      shieldUp: !!(w.sx2 && w.sx2.shieldUp), wardenAlive: w.alive
    };
  });
  ok('盾墙光环减伤且护盾可被击破',
    ward.auraTicks > 0 && ward.reduced < 80 && ward.reduced > 40 && ward.breaks >= 1 && ward.shield1 === 0,
    ward);

  /* 7. 电磁犬近身自爆 EMP · 事件触发且不致命 */
  const emp = await page.evaluate(() => {
    const G = window.__G, T = G.THREE, E2 = window.__SX_ENEMIES2;
    G.player.health = 100;
    const p = G.player.pos;
    const e = G.enemies.spawn('emp', new T.Vector3(p.x + 1.6, p.y, p.z + 1.6), { state: 'alert' });
    const s0 = E2.stats().empBursts;
    for (let i = 0; i < 90; i++) G.enemies.update(0.016);
    const s1 = E2.stats();
    const veil = document.getElementById('sx-emp-veil');
    return { bursts: s1.empBursts - s0, health: G.player.health, alive: G.player.alive !== false, empShots: s1.emp, veil: !!veil, eAlive: e.alive };
  });
  ok('电磁犬自爆 EMP 非致命且触发 sx:emp', emp.bursts >= 1 && emp.health > 0 && emp.alive && emp.veil, emp);

  /* 8. 侦察蜂标记（rally） */
  const scout = await page.evaluate(() => {
    const G = window.__G, T = G.THREE, E2 = window.__SX_ENEMIES2, A = window.__SX_AI;
    const p = G.player.pos;
    const s0 = E2.stats().scoutMarks;
    const sc = G.enemies.spawn('scout', new T.Vector3(p.x + 8, p.y + 4, p.z), {});
    for (let i = 0; i < 80; i++) G.enemies.update(0.016);
    const s1 = E2.stats();
    return { marks: s1.scoutMarks - s0, scoutAlive: sc.alive, aiSquads: A.squads().length, scoutHasSquad: !!(sc.ai && sc.ai.squad) };
  });
  ok('侦察蜂发现玩家并标记小队', scout.marks > 0 && scout.scoutHasSquad, scout);

  /* 9. 攻城蛛曲射 2 发 + 溅射 */
  const siege = await page.evaluate(() => {
    const G = window.__G, T = G.THREE, E2 = window.__SX_ENEMIES2;
    const p = G.player.pos;
    const s0 = E2.stats().shells;
    const e = G.enemies.spawn('siege', new T.Vector3(p.x - 16, p.y, p.z - 4), { state: 'alert' });
    for (const o of G.enemies.list.slice()) if (o !== e && o.alive && o.damage) o.damage(9999, o.pos, new T.Vector3(0, 0, 1), 'body');
    e.mode = 'engage'; e.lastKnown.copy(G.player.pos); e.los = true; e.senseT = 0; e.cool = 0; e.es = 'aim';
    for (let i = 0; i < 260; i++) { e.los = true; e.lastKnown.copy(G.player.pos); if (e.es === 'aim') e.cool = 0; G.enemies.update(0.016); }
    const s1 = E2.stats();
    return { shells: s1.shells - s0, hp: e.hp, alive: e.alive, mode: e.mode, es: e.es };
  });
  ok('攻城蛛远程曲射生成溅射弹', siege.shells >= 2, siege);

  /* 10. 600 步无 NaN */
  const nan = await page.evaluate(() => {
    const G = window.__G;
    for (let i = 0; i < 600; i++) G.enemies.update(0.016);
    const bad = [];
    for (const e of G.enemies.list) {
      if (!e || !e.pos) continue;
      if (![e.pos.x, e.pos.y, e.pos.z, e.hp].every(Number.isFinite)) bad.push({ id: e.id, type: e.type, variant: e.variant, pos: [e.pos.x, e.pos.y, e.pos.z], hp: e.hp });
    }
    const p = G.player;
    const pbad = ![p.pos.x, p.pos.y, p.pos.z, p.health].every(Number.isFinite);
    return { bad, pbad, alive: G.enemies.aliveCount() };
  });
  ok('敌人 600 步内无 NaN', nan.bad.length === 0 && !nan.pbad, nan);

  /* 11. 无 pageerror */
  ok('无 pageerror', errs.length === 0, errs.slice(0, 3));

  /* 12. 版本标记 */
  const ver = await page.evaluate(() => ({ ai: window.__SX_AI_VERSION, build: window.__BUILD__ && window.__BUILD__.profile }));
  ok('V34 AI 模块已加载', ver.ai === 'V34.1' && ver.build === 'v34', ver);

} catch (e) {
  fails++;
  console.log('FAIL · 测试执行异常 — ' + (e && e.message || e));
} finally {
  console.log('---------------- ' + pass + ' PASS / ' + fails + ' FAIL ----------------');
  await browser.close();
  process.exit(fails ? 1 : 0);
}