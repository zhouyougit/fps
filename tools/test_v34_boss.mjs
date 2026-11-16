
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';

const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file:///Users/zhouyou/codex_workspace/fps/game_v34.html?q=low&noaudio=1&autostart=1&dt=0.1';
const browser = await chromium.launch({ headless: true, executablePath: exe,
  args: PW_ARGS });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
const cErrs = []; page.on('console', m => { if (m.type() === 'error') cErrs.push(m.text()); });
let fails = 0;
const safe = (v) => { try { return JSON.stringify(v); } catch (e) { return '[unserializable]'; } };
const ok = (n, c, d) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + ' · ' + n + (d !== undefined ? ' — ' + safe(d) : '')); };
const waitFor = async (fn, ms) => { try { await page.waitForFunction(fn, null, { timeout: ms }); return true; } catch (e) { return false; } };
// 无头渲染很慢：用固定步进器推进模拟时间，断言全部基于模拟时钟
const step = async (n) => page.evaluate((n) => { try { window.__SX_STEP(n); } catch (e) {} }, n || 5);
const until = async (fn, maxSteps, chunk) => {
  maxSteps = maxSteps || 600; chunk = chunk || 10;
  for (let i = 0; i <= maxSteps; i += chunk) {
    if (await page.evaluate(fn)) return true;
    await step(chunk);
    await page.waitForTimeout(20);
  }
  return !!(await page.evaluate(fn));
};

await page.goto(URL, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 420000 });

/* ---- 0. 系统注册 + API ---- */
const regOk = await waitFor(() => !!(window.SX_SYSTEMS && window.SX_SYSTEMS.get && window.SX_SYSTEMS.get('boss2')), 20000);
const api = await page.evaluate(() => ({
  has: !!window.__SX_BOSS,
  fns: window.__SX_BOSS ? ['state','attacks','forcePhase','spawnFinal'].filter(k => typeof window.__SX_BOSS[k] === 'function') : [],
  version: window.__SX_BOSS && window.__SX_BOSS.version
}));
ok('window.__SX_BOSS 暴露 4 个入口', api.has && api.fns.length === 4, api);
ok('SX_SYSTEMS 注册 boss2 系统', regOk, { registered: regOk });

/* ---- 1. 进入 m3，切断中继，等 BOSS ---- */
await page.evaluate(() => {
  const G = window.__G;
  window.__SX.applyMission(2);
  G.game.start({ skipIntro: true });
  window.__SX.god();
  window.__sxT = { telegraph: [], exec: [], hit: [], emp: [], phase: [], announce: [], summon: [], echo: [] };
  const map = { 'sx:boss-telegraph':'telegraph', 'sx:boss-exec':'exec', 'sx:boss-attack-hit':'hit',
    'sx:emp':'emp', 'sx:boss2-phase':'phase', 'sx:boss2-announce':'announce',
    'sx:boss2-summon':'summon', 'sx:boss2-echo':'echo' };
  Object.keys(map).forEach(n => G.events.on(n, e => { window.__sxT[map[n]].push(e); }));
});
await step(10);
await page.evaluate(() => window.__SX.cutAll());

const found = await until(() => window.__SX_BOSS.state().active, 400, 10);
const s1 = await page.evaluate(() => {
  const st = window.__SX_BOSS.state();
  const boss = window.__G.enemies.list.find(e => e.boss && e.alive);
  return { active: st.active, phase: st.phase, hp: st.hp, maxHp: st.maxHp,
    bossInList: !!boss, bars: document.querySelectorAll('.x-boss').length,
    barVisible: st.bar && st.bar.visible };
});
ok('cutAll 后从 G.enemies.list 找到 BOSS', found && s1.bossInList && s1.active, s1);
ok('复用 boss.js 血条（未重复创建）', s1.bars === 1 && s1.barVisible, { bars: s1.bars, visible: s1.barVisible });

/* ---- 2. 阶段 1 攻击表 ---- */
const atk1 = await page.evaluate(() => window.__SX_BOSS.attacks());
ok('阶段 1 攻击列表非空（导弹 + 震地）', atk1.length >= 2 && atk1.includes('volley') && atk1.includes('stomp'), atk1);

/* ---- 3. 预警事件与执行时序 ---- */
const teleOk = await until(() => window.__sxT.telegraph.length > 0, 300, 5);
const tele = await page.evaluate(() => window.__sxT.telegraph.slice(0, 3));
const t0 = tele[tele.length - 1];
ok('sx:boss-telegraph 触发，预警 ≥0.6s', teleOk && !!t0 && t0.time >= 0.6 && atk1.includes(t0.move), t0);
try { await page.screenshot({ path: 'tools/evidence_v34_boss_telegraph.png' }); } catch (e) {}

const execOk = await until(() => window.__sxT.exec.length > 0, 300, 5);
const timing = await page.evaluate(() => {
  const T = window.__sxT;
  const deltas = [];
  for (const ex of T.exec) {
    let best = null;
    for (const te of T.telegraph) if (te.move === ex.move && te.at <= ex.at + 1e-6) best = te;
    if (best) deltas.push({ move: ex.move, need: best.time, delta: +(ex.at - best.at).toFixed(3) });
  }
  const hits = T.hit.map(h => {
    let best = null;
    for (const te of T.telegraph) if (te.move === h.move && te.at <= h.at + 1e-6) best = te;
    return { move: h.move, at: h.at, need: best ? best.time : null, delta: best ? +(h.at - best.at).toFixed(3) : null };
  });
  return { deltas, hits, telegraphCount: T.telegraph.length, execCount: T.exec.length };
});
const badExec = timing.deltas.filter(d => d.delta + 0.001 < d.need);
const badHits = timing.hits.filter(h => h.delta != null && h.delta + 0.001 < h.need);
ok('预警期间无伤害：exec / hit 均晚于预警结束', execOk && timing.deltas.length > 0 && badExec.length === 0 && badHits.length === 0,
  { deltas: timing.deltas.slice(-3), badExec, badHits });

/* ---- 4. forcePhase(1)：攻击集合增加 + 召唤 ---- */
const fp1 = await page.evaluate(() => window.__SX_BOSS.forcePhase(1));
ok('forcePhase(1) 后攻击集合增加（弹幕 + 召唤）', fp1.phase === 1 && fp1.attacks.length > atk1.length && fp1.attacks.includes('barrage') && fp1.attacks.includes('summon'), fp1.attacks);

const sumOk = await until(() => window.__SX_BOSS.state().summons === 2, 300, 10);
const sum = await page.evaluate(() => {
  const G = window.__G;
  const st = window.__SX_BOSS.state();
  const kinds = G.enemies.list.filter(e => e.__sxBossSummon).map(e => e.variant || e.type);
  return { summons: st.summons, kinds, ev: window.__sxT.summon.slice(-1)[0] };
});
ok('阶段 2 召唤 2 台护盾无人机', sumOk && sum.summons === 2 && sum.kinds.length === 2, sum);

const bar1 = await page.evaluate(() => { const st = window.__SX_BOSS.state(); return { bar: st.bar, phase: st.phase }; });
ok('血条标题与阶段 pips 同步', bar1.bar && bar1.bar.pipsOn === 2 && /二·吊装/.test(bar1.bar.title), bar1.bar);

await page.evaluate(() => window.__SX_BOSS.forcePhase(1));
await step(15);
const a2 = await page.evaluate(() => window.__sxT.announce.filter(x => x.phase === 1).length);
ok('阶段切换播报不重复', a2 === 1, { phase1Announces: a2 });

/* ---- 5. forcePhase(2)：冲刺 + EMP ---- */
const fp2 = await page.evaluate(() => window.__SX_BOSS.forcePhase(2));
ok('forcePhase(2) 后攻击集合增加（冲刺 + EMP）', fp2.phase === 2 && fp2.attacks.includes('dash') && fp2.attacks.includes('emp') && fp2.attacks.length > fp1.attacks.length, fp2.attacks);

const dashOk = await until(() => window.__sxT.exec.some(x => x.move === 'dash'), 300, 5);
ok('阶段 3 过载冲刺执行', dashOk, await page.evaluate(() => window.__sxT.exec.filter(x => x.move === 'dash').slice(-1)[0] || null));

const empOk = await until(() => window.__sxT.emp.length > 0, 300, 3);
const emp = await page.evaluate(() => {
  const e = window.__sxT.emp.slice(-1)[0];
  const st = window.__SX_BOSS.state();
  return { duration: e && e.duration, at: e && e.at, glitch: st.glitch,
    body: document.body.classList.contains('sx-emp'), active: st.move, stage: st.stage };
});
ok('EMP 脉冲触发 sx:emp 且 HUD 故障 1.5s', empOk && emp.duration === 1.5 && (emp.glitch > 0 || emp.body), emp);
try { await page.screenshot({ path: 'tools/evidence_v34_boss_emp.png' }); } catch (e) {}

/* ---- 6. F6 调试面板 ---- */
await page.keyboard.press('F6');
await step(3);
const dbg = await page.evaluate(() => {
  const d = document.querySelector('#sx-boss-debug');
  if (!d) return null;
  return { shown: getComputedStyle(d).display !== 'none', text: d.textContent };
});
ok('F6 显示 BOSS 攻击冷却', !!dbg && dbg.shown && /冷却/.test(dbg.text) && /READY|s/.test(dbg.text), dbg && { shown: dbg.shown, text: (dbg.text || '').slice(0, 100) });
await page.keyboard.press('F6');
await step(2);

/* ---- 7. spawnFinal：终形残响 + 频率 ---- */
const fin = await page.evaluate(() => window.__SX_BOSS.spawnFinal());
const fin2 = await page.evaluate(() => { const s = window.__SX_BOSS.state(); return { final: s.final, maxHp: s.maxHp, echoes: s.echoes, phase: s.phase }; });
const finRate = await page.evaluate(() => { const s = window.__SX_BOSS.forcePhase(2); return { rateMul: s.rateMul, phase: s.phase, final: s.final, echoes: s.echoes, attacks: s.attacks }; });
ok('终形残响分身 ×2（elite 变体）', fin2.final === true && fin2.maxHp === 2600 && fin2.echoes === 2, fin2);
ok('终形阶段 3 攻击频率 ×1.35', finRate.rateMul === 1.35 && finRate.phase === 2 && finRate.final === true, finRate);

/* ---- 8. BOSS 死亡清理 ---- */
const killOk = await page.evaluate(() => {
  const G = window.__G;
  const e = G.enemies.list.find(x => x.boss && x.alive);
  if (!e) return false;
  e.damage(1e6, e.pos, new G.THREE.Vector3(0, 0, 1), 'body');
  return true;
});
const deadOk = await until(() => !window.__SX_BOSS.state().active, 200, 5);
await step(3);
const cl = await page.evaluate(() => {
  const st = window.__SX_BOSS.state();
  return { active: st.active, timers: st.timers, telegraphs: st.telegraphs, summons: st.summons, echoes: st.echoes,
    cleanup: st.lastCleanup, glitch: st.glitch, body: document.body.classList.contains('sx-emp') };
});
ok('BOSS 死亡后无残留定时器 / 召唤物 / 预警', killOk && deadOk && cl.timers === 0 && cl.telegraphs === 0 && cl.summons === 0 && cl.echoes === 0 && cl.cleanup && cl.cleanup.timers === 0, cl);
ok('死亡后 EMP 故障态复位', cl.glitch === 0 && cl.body === false, { glitch: cl.glitch, body: cl.body });

/* ---- 9. pageerror ---- */
const bossErrs = cErrs.filter(t => /boss2|\[system\]/.test(t));
ok('无 pageerror / BOSS 系统错误', errs.length === 0 && bossErrs.length === 0, { errs: errs.slice(0, 3), bossErrs: bossErrs.slice(0, 3) });

console.log('---');
console.log(fails ? fails + ' 项失败' : '全部通过');
await browser.close();
process.exit(fails ? 1 : 0);
