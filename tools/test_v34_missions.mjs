/* =====================================================================
   tools/test_v34_missions.mjs — V34 · WP34-6 / WP34-7 验收（10 项）
   ---------------------------------------------------------------------
   覆盖：
     T1  MISSIONS.length === 8 且 m1..m8 齐全
     T2  m7「深水区」数据：harbor / 4 中继 / objectivesGraph = cut4→kill18→hold60→evac
     T3  m8「归零」数据：core / 3 中继 / BOSS 蜃·残响 hp2200 / bossEvac 30
     T4  m7 可启动（skipIntro）：state=playing、4 处中继、目标图 cut 阶段
     T5  阶段未完成时撤离被锁（run.allCut 但 evacT>0，走进撤离点不会通关）
     T6  __SX 击杀 18 → 目标图按 cut→kill→hold 推进
     T7  hold 计时可由 __SX2.advance 加速，完成 → evac 阶段开放（evacT=0）
     T8  传送到撤离点 → state=complete
     T9  检查点写入 saltline.save 的 campaign.checkpoint（missionId/cut/relays/玩家状态）
     T10 刷新页面后检查点仍在，行动档案出现「继续行动」
     T11 m8 进入 core 地图且 3 处中继可达（validateObjectives 全部 ok）
     T12 无 pageerror
   运行：CHROME_EXE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         node tools/test_v34_missions.mjs
   （默认打开 game_v34.html — 与全量回归的 game.html 隔离）
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS, legacyGame } from './pwargs.mjs';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const URL = pathToFileURL(legacyGame('v34')).href + '?q=low&noaudio=1&autostart=1&dt=0.1';
const EXE = process.env.CHROME_EXE ||
  (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined);

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS  ' + name + (detail ? '  · ' + detail : '')); }
  else { fail++; failures.push(name + (detail ? '  · ' + detail : '')); console.log('FAIL  ' + name + (detail ? '  · ' + detail : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true, executablePath: EXE,
  args: PW_ARGS
});
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
page.on('crash', () => pageErrors.push('page crash'));

async function boot() {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForFunction(() => !!window.__SX2, null, { timeout: 60000 });
  await sleep(500);
}

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  await boot();

  /* T1 — 八关数据 */
  const missions = await page.evaluate(() => window.__SX2.missions());
  check('T1 MISSIONS.length === 8', missions.length === 8,
    missions.map((m) => m.id).join(','));
  check('T1b 关卡 id 依次 m1..m8', missions.every((m, i) => m.id === 'm' + (i + 1)));

  /* T2 — m7 数据 */
  const m7 = missions[6];
  const g7 = (m7 && m7.graph) || [];
  check('T2 m7「深水区」= harbor / 4 中继', m7 && m7.map === 'harbor' && m7.relays === 4,
    JSON.stringify(m7 && { map: m7.map, relays: m7.relays, name: m7.name }));
  check('T2b m7 目标图 cut4→kill18→hold60→evac',
    g7.length === 4 && g7[0].type === 'cut' && g7[0].count === 4 &&
    g7[1].type === 'kill' && g7[1].count === 18 &&
    g7[2].type === 'hold' && g7[2].seconds === 60 &&
    g7[3].type === 'evac', JSON.stringify(g7));

  /* T3 — m8 数据 */
  const m8 = missions[7];
  const g8 = (m8 && m8.graph) || [];
  check('T3 m8「归零」= core / 3 中继 / BOSS hp2200 / 30s 撤离',
    m8 && m8.map === 'core' && m8.relays === 3 && m8.boss === true &&
    m8.bossHp === 2200 && m8.bossName.indexOf('残响') >= 0 && m8.bossEvac === 30,
    JSON.stringify(m8 && { map: m8.map, relays: m8.relays, boss: m8.boss, bossHp: m8.bossHp, bossName: m8.bossName, bossEvac: m8.bossEvac }));
  check('T3b m8 目标图以 cut→boss→evac 收束',
    g8.length === 3 && g8[0].type === 'cut' && g8[1].type === 'boss' && g8[2].type === 'evac', JSON.stringify(g8));

  /* T4 — 启动 m7 */
  const r7 = await page.evaluate(() => {
    const G = window.__G;
    window.__SX.applyMission(6);
    G.game.start({ skipIntro: true });
    window.__SX.god();
    return {
      state: G.game.state, mission: G.game.currentMission && G.game.currentMission.id,
      map: window.__SX.mapId(), relays: (G.level.objectives || []).length,
      graph: window.__SX2.graph(), obj: window.__SX2.objective()
    };
  });
  await sleep(300);
  check('T4 m7 可启动（playing / 4 中继 / cut 阶段）',
    r7.state === 'playing' && r7.mission === 'm7' && r7.relays === 4 &&
    r7.graph && r7.graph.phases[0].type === 'cut' && r7.graph.phases[0].state === 'active',
    JSON.stringify({ state: r7.state, mission: r7.mission, relays: r7.relays, obj: r7.obj }));

  /* T5 — 切完中继后撤离仍被目标图锁住 */
  await page.evaluate(() => { window.__SX.cutAll(); });
  await sleep(1200);
  const locked = await page.evaluate(() => {
    const G = window.__G;
    const ex = G.level.extraction.pos;
    window.__SX.tp(ex.x, ex.y, ex.z);
    return { cut: G.game.run.cut, allCut: G.game.run.allCut, evacT: G.game.run.evacT, state: G.game.state, graph: window.__SX2.graph() };
  });
  await sleep(700);
  // 离开撤离点，避免 T7 打开撤离窗口时玩家仍站在点上直接通关
  await page.evaluate(() => { window.__SX.tp(-19, 0, 9); });
  const stillPlaying = await page.evaluate(() => window.__G.game.state);
  check('T5 目标图未完成时撤离被锁（allCut 但不通关）',
    locked.allCut === true && stillPlaying === 'playing',
    JSON.stringify({ cut: locked.cut, evacT: locked.evacT, stateAfterEnter: stillPlaying }));

  /* T6 — 击杀配额 18 → kill 完成，hold 激活 */
  await page.evaluate(() => { window.__SX2.kill(18); });
  await sleep(900);
  const afterKill = await page.evaluate(() => window.__SX2.graph());
  check('T6 击杀 18 后目标图推进到 hold（kill→hold）',
    afterKill && afterKill.phases[1].state === 'done' &&
    afterKill.phases[2].type === 'hold' && afterKill.phases[2].state === 'active',
    JSON.stringify(afterKill && afterKill.phases.map((p) => p.type + ':' + p.state + ':' + p.progress)));

  /* T7 — hold 倒计时加速 → evac 开放 */
  const before = await page.evaluate(() => {
    window.__SX2.advance(20);
    return window.__SX2.graph().phases[2].progress;
  });
  await page.evaluate(() => { window.__SX2.advance(60); });
  await sleep(900);
  const afterHold = await page.evaluate(() => ({
    graph: window.__SX2.graph(), evacT: window.__G.game.run.evacT, obj: window.__SX2.objective()
  }));
  check('T7 hold 倒计时推进 → evac 阶段开放（evacT=0）',
    before >= 19.5 && afterHold.graph.phases[2].state === 'done' &&
    afterHold.graph.phases[3].type === 'evac' && afterHold.graph.evacOpen === true &&
    afterHold.evacT === 0,
    JSON.stringify({ holdProgressAt20s: before, evacT: afterHold.evacT, obj: afterHold.obj }));

  /* T8 前先抓一次检查点：通关时引擎会清理检查点，属于设计行为 */
  const cpBefore = await page.evaluate(() => ({
    cp: window.__SX2.saveCheckpoint(),
    stored: window.__SX2.storageCheckpoint(),
    raw: (() => { try { return !!JSON.parse(localStorage.getItem('saltline.save') || 'null'); } catch (e) { return false; } })()
  }));

  /* T8 — 传送到撤离点 → 通关 */
  await page.evaluate(() => {
    const G = window.__G, ex = G.level.extraction.pos;
    window.__SX.tp(ex.x, ex.y, ex.z);
  });
  await page.waitForFunction(() => window.__G.game.state === 'complete', null, { timeout: 15000 }).catch(() => {});
  const done = await page.evaluate(() => window.__G.game.state);
  check('T8 传送到撤离点 → state=complete', done === 'complete', 'state=' + done);

  /* T9 — 检查点写入统一存档 */
  const cpState = { memory: cpBefore.cp, stored: cpBefore.stored, raw: cpBefore.raw };
  const stored = cpState.stored || {};
  check('T9 检查点写入 saltline.save · campaign.checkpoint',
    !!stored.missionId && stored.v === 2 && stored.cut === 4 &&
    Array.isArray(stored.relays) && stored.relays.length === 4 &&
    Array.isArray(stored.player && stored.player.pos) && typeof stored.grenades === 'number' &&
    Array.isArray(stored.objectives),
    JSON.stringify({ missionId: stored.missionId, cut: stored.cut, relays: stored.relays, pos: stored.player && stored.player.pos, saveLoaded: cpState.raw }));

  /* T10 — 刷新后检查点仍在 + 档案「继续行动」 */
  await page.reload({ waitUntil: 'load', timeout: 180000 });
  await boot();
  await page.evaluate(() => window.__SX.openMissions());
  await sleep(800);
  const afterReload = await page.evaluate(() => {
    return {
      cp: window.__SX2.loadCheckpoint(),
      stored: window.__SX2.storageCheckpoint(),
      legacy: (() => { try { return JSON.parse(localStorage.getItem('saltline.campaign.v1') || 'null'); } catch (e) { return null; } })(),
      continueBtn: !!document.querySelector('.x-continue')
    };
  });
  check('T10 刷新后检查点恢复（saltline.save + 内存）',
    !!afterReload.cp && afterReload.cp.missionId === 'm7' &&
    !!afterReload.stored && afterReload.stored.missionId === 'm7' &&
    !!afterReload.legacy && !!afterReload.legacy.checkpoint,
    JSON.stringify({ memory: !!afterReload.cp, stored: !!afterReload.stored, legacy: !!afterReload.legacy }));
  check('T10b 行动档案出现「继续行动」入口', afterReload.continueBtn === true);

  /* T11 — m8 核心舱：3 处中继可达 */
  const core = await page.evaluate(() => {
    const G = window.__G;
    window.__SX.applyMission(7);
    G.game.start({ skipIntro: true });
    window.__SX.god();
    const v = window.__SX2.validate() || [];
    return {
      map: window.__SX.mapId(), mission: G.game.currentMission && G.game.currentMission.id,
      relays: window.__SX2.coreRelays(),
      validate: v.map((x) => ({ id: x.id, ok: x.ok, path: x.path, nearDist: x.nearDist })),
      graph: window.__SX2.graph()
    };
  });
  const relayChecks = (core.validate || []).filter((x) => x.id.indexOf('relay_') === 0);
  check('T11 m8 进入 core 地图且 3 处中继可达',
    core.map === 'core' && core.mission === 'm8' && core.relays.length === 3 &&
    relayChecks.length === 3 && relayChecks.every((x) => x.ok === true),
    JSON.stringify({ map: core.map, relays: core.relays.map((r) => r.id), validate: relayChecks }));

  /* T12 — 无 pageerror */
  check('T12 无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 4).join(' | '));
} catch (e) {
  check('T0 测试脚本执行完成', false, String((e && e.message) || e));
} finally {
  await browser.close().catch(() => {});
}

console.log('\n' + pass + ' PASS · ' + fail + ' FAIL');
if (fail) { console.log('失败项：'); failures.forEach((f) => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
