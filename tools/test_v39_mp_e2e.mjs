#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v39_mp_e2e.mjs — V39 浏览器双客户端联机 e2e
   ---------------------------------------------------------------------
   1) 本地随机端口启动 server/server.cjs 子进程（BOTS=0 / MP_DEV_TOKEN，
      STATIC_DIR=仓库根，页面用 http://127.0.0.1:<port>/game.html 加载，
      避免 file:// 的 Origin 被服务端安全策略拒绝）。
   2) 两个 Playwright 页面串行加载：先等 A 的 window.__ready=true，再加载 B，
      避免并发 SwiftShader 把加载拖到超时。
   3) 两个客户端连接同一 room，覆盖：双方可见 / 自己不被当远端 /
      二进制快照解码 / dev 传送同步 / 开火命中 / 离开删除 / 房间释放 /
      无 pageerror；并验证 PROFILES_FILE 单进程锁（第二实例拒绝启动、
      主实例不受影响、stale 锁回收、优雅退出释放锁）。
   4) 任一步超时都会先输出页面状态（__ready/__fatal/__errors/__MP.state/debug/
      remotes）与服务端日志，再以 FAIL 结束；不会抛出未捕获异常。

   运行：node tools/test_v39_mp_e2e.mjs
   依赖：playwright（仓库根已安装）、服务端 node_modules/ws
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SERVER = path.join(ROOT, 'server', 'server.cjs');
const GAME = path.join(ROOT, 'game.html');
const CHROME_CANDIDATES = [
  process.env.CHROME_EXE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => {
  try { return fs.existsSync(p); } catch (e) { return false; }
});
const DEV_TOKEN = 'v39-e2e-dev-token';
const ROOM = 'v39-e2e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
const MAIN_PROFILE = path.join(os.tmpdir(), 'v39-e2e-' + process.pid + '-' + ROOM + '.json');
const STALE_PROFILE = path.join(os.tmpdir(), 'v39-e2e-stale-' + process.pid + '-' + ROOM + '.json');
const TMP_DIR = path.dirname(MAIN_PROFILE);
const BOOT_TIMEOUT_MS = 240000;
const READY_TIMEOUT_MS = 300000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;

function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS · ' + name + (detail === undefined ? '' : ' — ' + JSON.stringify(detail)));
  } else {
    fail++;
    console.log('FAIL · ' + name + (detail === undefined ? '' : ' — ' + JSON.stringify(detail)));
  }
}

function tail(text, lines) {
  return String(text || '').split('\n').slice(-(lines || 20)).join('\n');
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function httpJson(port, pathname, opts) {
  return new Promise((resolve) => {
    const req = http.request(
      Object.assign({ host: '127.0.0.1', port, path: pathname, timeout: 2000 }, opts || {}),
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(body), text: body }); }
          catch (e) { resolve({ status: res.statusCode, json: null, text: body }); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (opts && opts.body) req.write(opts.body);
    req.end();
  });
}

async function waitHealth(port, pred, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 10000);
  let last = null;
  while (Date.now() < deadline) {
    last = await httpJson(port, '/healthz');
    if (last && last.json && last.json.ok && (!pred || pred(last.json))) return last.json;
    await sleep(100);
  }
  return last && last.json ? last.json : null;
}

function serverEnv(port, profileFile) {
  return Object.assign({}, process.env, {
    PORT: String(port),
    HOST: '127.0.0.1',
    BOTS: '0',
    MP_DEV_TOKEN: DEV_TOKEN,
    WARMUP_SECONDS: '0',
    ROUND_SECONDS: '300',
    SCORE_LIMIT: '50',
    PROFILES_FILE: profileFile,
    STATIC_DIR: ROOT,
    LOG_JSON: '1',
  });
}

async function startServer(profileFile, extraEnv) {
  const port = await freePort();
  const env = Object.assign(serverEnv(port, profileFile), extraEnv || {});
  const child = spawn(process.execPath, [SERVER], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('server 提前退出（exit=' + child.exitCode + '）：\n' + tail(output, 40));
    const health = await httpJson(port, '/healthz');
    if (health && health.json && health.json.ok) {
      return { child, port, profileFile, log: () => output };
    }
    await sleep(100);
  }
  try { child.kill('SIGKILL'); } catch (e) {}
  throw new Error('server 启动超时：\n' + tail(output, 40));
}

async function stopServer(server) {
  if (!server || !server.child) return;
  const child = server.child;
  if (child.exitCode === null) {
    try { child.kill('SIGTERM'); } catch (e) {}
    await Promise.race([once(child, 'exit'), sleep(4000)]);
  }
  if (child.exitCode === null) {
    try { child.kill('SIGKILL'); } catch (e) {}
    await Promise.race([once(child, 'exit'), sleep(2000)]);
  }
}

/** 启动一个应立即退出的实例，用于验证锁冲突。 */
async function runServerExpectExit(profileFile, waitMs) {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: serverEnv(port, profileFile),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const timer = sleep(waitMs || 8000).then(() => 'timeout');
  const result = await Promise.race([once(child, 'exit').then(([code, signal]) => ({ code, signal })), timer]);
  if (result === 'timeout') {
    try { child.kill('SIGKILL'); } catch (e) {}
    await Promise.race([once(child, 'exit'), sleep(1500)]);
    return { code: null, signal: null, timeout: true, output };
  }
  return { code: result.code, signal: result.signal, timeout: false, output, pid: child.pid };
}

async function safePageState(page, label) {
  if (!page || page.isClosed()) return { label, closed: true };
  try {
    return await page.evaluate(() => {
      const g = window.__MP && window.__MP.state ? window.__MP.state() : null;
      let debug = null;
      try { debug = window.__MP && window.__MP.debug ? window.__MP.debug() : null; } catch (e) { debug = { error: String(e && e.message ? e.message : e) }; }
      return {
        ready: window.__ready === true,
        fatal: window.__fatal || null,
        errors: (window.__errors || []).slice(0, 5),
        state: g,
        remotes: window.__MP && window.__MP.remotes ? window.__MP.remotes() : null,
        debug: debug && {
          selfId: debug.selfId,
          selfNid: debug.selfNid,
          parts: (debug.parts || []).slice(0, 4),
          hist: (debug.hist || []).slice(0, 4),
          net: debug.net,
        },
      };
    });
  } catch (e) {
    return { label, error: String(e && e.message ? e.message : e) };
  }
}

async function dumpDiagnostics(ctx) {
  console.error('--- e2e 超时/失败诊断 ---');
  if (ctx) {
    if (ctx.health) console.error('healthz: ' + JSON.stringify(ctx.health));
    if (ctx.lock) console.error('lock: ' + JSON.stringify(ctx.lock));
  }
  for (const item of (ctx && ctx.pages) || []) {
    console.error('page ' + item.label + ': ' + JSON.stringify(await safePageState(item.page, item.label)));
  }
  for (const item of (ctx && ctx.servers) || []) {
    if (!item || !item.server) continue;
    console.error('server[' + item.label + '] log tail:\n' + tail(item.server.log(), 40));
  }
}

async function waitFor(page, fn, arg, timeout, label) {
  try {
    await page.waitForFunction(fn, arg, { timeout: timeout || 30000, polling: 100 });
  } catch (e) {
    console.error('FAIL · 等待超时：' + label + (e && e.message ? '（' + e.message + '）' : ''));
    console.error('page 状态: ' + JSON.stringify(await safePageState(page, label)));
    throw e;
  }
}

function near(a, b, eps) {
  return !!a && !!b && Math.abs(a - b) <= (eps || 1.2);
}

async function remoteSample(page, id) {
  return page.evaluate((targetId) => {
    const d = window.__MP.debug();
    const row = (d.hist || []).find((x) => String(x.id) === String(targetId));
    const h = row && row.h && row.h[row.h.length - 1];
    return h ? { x: h.x, y: h.y, z: h.z } : null;
  }, id);
}

async function main() {
  const ctx = { pages: [], servers: [] };
  let browser = null;
  let mainServer = null;
  let staleServer = null;
  let a = null;
  let b = null;

  try {
    // ------------------------------------------------------------------
    // 0. 服务端启动 + 单进程锁
    // ------------------------------------------------------------------
    mainServer = await startServer(MAIN_PROFILE);
    ctx.servers.push({ label: 'main', server: mainServer });
    const health0 = await waitHealth(mainServer.port, (h) => h.players === 0, 5000);
    ctx.health = health0;
    ok(
      'server 随机端口启动 /healthz ok（BOTS=0）',
      !!health0 && health0.ok === true && health0.bots === 0 && health0.humans === 0,
      health0 && { port: mainServer.port, players: health0.players, humans: health0.humans, bots: health0.bots }
    );
    const lock0 = readJson(MAIN_PROFILE + '.lock');
    ctx.lock = lock0;
    ok(
      'LOCK · 启动即创建 PROFILES_FILE.lock（pid/时间/token）',
      !!lock0 && lock0.pid === mainServer.child.pid && Number.isFinite(lock0.at) && typeof lock0.token === 'string' && lock0.at > 0,
      lock0 && { pid: lock0.pid, at: lock0.at, token: !!lock0.token }
    );

    // ------------------------------------------------------------------
    // 1. 浏览器：串行加载 A / B
    // ------------------------------------------------------------------
    const launchOpts = {
      headless: true,
      args: PW_ARGS,
    };
    if (CHROME) launchOpts.executablePath = CHROME;
    browser = await chromium.launch(launchOpts);
    const GAME_URL = 'http://127.0.0.1:' + mainServer.port + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1';

    async function openPage(label) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
      // 新标签页在无头 Chrome 里默认可能是后台页，rAF 会被暂停导致 __ready 永远不置位。
      // 每个页面加载前显式置前，配合“串行 wait __ready”避免 SwiftShader 并发超时。
      await page.bringToFront();
      page.setDefaultTimeout(60000);
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
      page.addInitScript((token) => { window.__MP_DEV_TOKEN = token; }, DEV_TOKEN);
      await page.goto(GAME_URL, { waitUntil: 'load', timeout: BOOT_TIMEOUT_MS });
      await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout: READY_TIMEOUT_MS, polling: 250 });
      await page.waitForTimeout(500);
      const item = { label, page, pageErrors, consoleErrors, readyAt: Date.now() };
      ctx.pages.push(item);
      return item;
    }

    const pageA = await openPage('A');
    a = pageA.page;
    const bootA = await a.evaluate(() => ({
      ready: window.__ready === true,
      fatal: window.__fatal || null,
      mp: !!window.__MP,
      net: !!window.__SX_NET,
      errors: (window.__errors || []).slice(0, 3),
    }));
    ok(
      '页面 A 加载完成（__ready=true，__MP/__SX_NET 就绪，无 fatal）',
      bootA.ready && !bootA.fatal && bootA.mp && bootA.net,
      bootA
    );

    const pageB = await openPage('B');
    b = pageB.page;
    const bootB = await b.evaluate(() => ({
      ready: window.__ready === true,
      fatal: window.__fatal || null,
      mp: !!window.__MP,
      net: !!window.__SX_NET,
      errors: (window.__errors || []).slice(0, 3),
    }));
    ok(
      '页面 B 在 A 完成后串行加载（避免并发 SwiftShader 超时）',
      bootB.ready && !bootB.fatal && bootB.mp && bootB.net && pageB.readyAt >= pageA.readyAt,
      { aReadyAt: pageA.readyAt, bReadyAt: pageB.readyAt, deltaMs: pageB.readyAt - pageA.readyAt }
    );

    // ------------------------------------------------------------------
    // 2. 同一 room 加入 + 协议/可见性
    // ------------------------------------------------------------------
    const wsUrl = 'ws://127.0.0.1:' + mainServer.port;
    await a.bringToFront();
    await a.evaluate(([url, name, room]) => window.__MP.join(url, name, room, 'harbor', 'tdm'), [wsUrl, 'E2E-A', ROOM]);
    await waitFor(a, () => {
      const s = window.__MP.state();
      return s.active && s.joined && s.players >= 1;
    }, null, 30000, 'A join 超时/被拒');
    const stateA0 = await a.evaluate(() => window.__MP.state());
    ok(
      'A 加入目标 room：active/joined、协议 2、bin=true',
      stateA0.active && stateA0.joined && stateA0.room === ROOM && stateA0.protocol === 2 && stateA0.bin === true,
      { room: stateA0.room, mode: stateA0.mode, protocol: stateA0.protocol, bin: stateA0.bin }
    );

    await b.bringToFront();
    await b.evaluate(([url, name, room]) => window.__MP.join(url, name, room, 'harbor', 'tdm'), [wsUrl, 'E2E-B', ROOM]);
    await waitFor(b, () => {
      const s = window.__MP.state();
      return s.active && s.joined && s.players >= 2;
    }, null, 30000, 'B join 超时/被拒');
    const stateB0 = await b.evaluate(() => window.__MP.state());
    ok(
      'B 加入同一 room，双方各看到 2 名玩家',
      stateB0.active && stateB0.joined && stateB0.room === ROOM && stateA0.room === stateB0.room,
      { a: { room: stateA0.room, players: stateA0.players }, b: { room: stateB0.room, players: stateB0.players } }
    );

    const aId = stateA0.selfId;
    const bId = stateB0.selfId;
    ok(
      '客户端 id/nid 映射：selfId/selfNid 非空且互相不同',
      !!aId && !!bId && aId !== bId && stateA0.selfNid != null && stateB0.selfNid != null,
      { a: { id: aId, nid: stateA0.selfNid }, b: { id: bId, nid: stateB0.selfNid } }
    );

    await waitFor(a, (targetId) => {
      const s = window.__MP.state();
      return s.players === 2 && window.__MP.remotes().indexOf(String(targetId)) >= 0;
    }, bId, 15000, 'A 未看到 B 远端');
    await waitFor(b, (targetId) => {
      const s = window.__MP.state();
      return s.players === 2 && window.__MP.remotes().indexOf(String(targetId)) >= 0;
    }, aId, 15000, 'B 未看到 A 远端');
    const remotesA = await a.evaluate(() => window.__MP.remotes());
    const remotesB = await b.evaluate(() => window.__MP.remotes());
    ok(
      '双方可见：A.remotes 含 B、B.remotes 含 A',
      remotesA.map(String).indexOf(String(bId)) >= 0 && remotesB.map(String).indexOf(String(aId)) >= 0,
      { aRemotes: remotesA, bRemotes: remotesB }
    );

    const selfViewA = await a.evaluate(() => ({
      selfId: window.__MP.state().selfId,
      remotes: window.__MP.remotes(),
      players: window.__MP.state().players,
      hist: (window.__MP.debug().hist || []).map((x) => x.id),
    }));
    ok(
      '自己不被当远端：remotes 不含 selfId，players = remotes + 1',
      selfViewA.remotes.map(String).indexOf(String(selfViewA.selfId)) < 0 &&
        selfViewA.hist.map(String).indexOf(String(selfViewA.selfId)) < 0 &&
        selfViewA.players === selfViewA.remotes.length + 1,
      selfViewA
    );

    // ------------------------------------------------------------------
    // 3. 二进制快照解码
    // ------------------------------------------------------------------
    await a.bringToFront();
    await waitFor(a, () => {
      const s = window.__MP.state();
      return s.snapStats.binary >= 5 && s.snapStats.decodeErrors === 0 && s.snapStats.lastBinaryAt > 0;
    }, null, 15000, 'A 二进制快照未到达/解码失败');
    await waitFor(b, () => {
      const s = window.__MP.state();
      return s.snapStats.binary >= 5 && s.snapStats.decodeErrors === 0 && s.snapStats.lastBinaryAt > 0;
    }, null, 15000, 'B 二进制快照未到达/解码失败');
    const snapsA = await a.evaluate(() => window.__MP.state());
    const snapsB = await b.evaluate(() => window.__MP.state());
    ok(
      '二进制快照解码：双方 binary>=5、decodeErrors=0、lastBinaryAt>0',
      snapsA.snapStats.binary >= 5 && snapsB.snapStats.binary >= 5 &&
        snapsA.snapStats.decodeErrors === 0 && snapsB.snapStats.decodeErrors === 0 &&
        snapsA.snapStats.lastBinaryAt > 0 && snapsB.snapStats.lastBinaryAt > 0,
      { a: snapsA.snapStats, b: snapsB.snapStats }
    );

    // ------------------------------------------------------------------
    // 4. dev 传送 -> 位置同步 -> 瞄准 -> 开火命中
    // ------------------------------------------------------------------
    await a.bringToFront();
    await a.evaluate(() => window.__MP.testTeleport(-2, 12));
    await b.evaluate(() => window.__MP.testTeleport(2, 12));
    await sleep(1500);
    const sampleB = await remoteSample(a, bId);
    const sampleA = await remoteSample(b, aId);
    ok(
      'dev 传送后位置经二进制快照同步（A 见 B≈(2,12)，B 见 A≈(-2,12)）',
      near(sampleB && sampleB.x, 2) && near(sampleB && sampleB.z, 12) &&
        near(sampleA && sampleA.x, -2) && near(sampleA && sampleA.z, 12),
      { aSeesB: sampleB, bSeesA: sampleA }
    );

    const teams = await Promise.all([
      a.evaluate(() => window.__MP.state().team),
      b.evaluate(() => window.__MP.state().team),
    ]);
    ok('两名客户端自动分到不同队伍（避免友军免伤）', teams[0] !== teams[1], { aTeam: teams[0], bTeam: teams[1] });

    const aim = await a.evaluate((targetId) => {
      const d = window.__MP.debug();
      const row = (d.hist || []).find((x) => String(x.id) === String(targetId));
      const h = row && row.h && row.h[row.h.length - 1];
      if (!h) return null;
      const me = window.__G.player.pos;
      const ox = me.x, oy = me.y + 1.68, oz = me.z;
      const dx = h.x - ox, dy = (h.y + 1.0) - oy, dz = h.z - oz;
      const len = Math.hypot(dx, dy, dz) || 1;
      return { dir: { x: dx / len, y: dy / len, z: dz / len }, dist: +len.toFixed(2) };
    }, bId);
    ok('对端在射程内，可构造射击方向', !!aim && aim.dist < 8, aim);

    // 把本地视角转向目标，确保服务端 aim_mismatch 校验通过。
    await a.evaluate((dir) => {
      window.__G.player.yaw = Math.atan2(-dir.x, -dir.z);
      window.__G.player.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    }, aim.dir);
    await sleep(250);

    for (let i = 0; i < 12; i++) {
      await a.evaluate((dir) => window.__MP.testFire(dir), aim.dir);
      await sleep(180);
    }
    await sleep(1200);
    const fireA = await a.evaluate(() => ({
      hitEvents: window.__MP.state().netStats.hitEvents,
      rejected: window.__MP.state().netStats.rejectedShots,
      localShots: window.__MP.state().netStats.localShots,
      kills: window.__MP.state().kills,
    }));
    const fireB = await b.evaluate(() => ({
      hp: window.__G.player.health,
      armor: window.__G.player.armor,
      dead: !!(document.querySelector('.x-mp-dead') && document.querySelector('.x-mp-dead').classList.contains('on')),
    }));
    ok(
      '开火命中：A 收到服务器 hit 事件，B 掉血/阵亡（服务端权威判定）',
      fireA.hitEvents >= 1 && (fireB.hp < 100 || fireB.dead),
      { a: fireA, b: fireB }
    );

    // ------------------------------------------------------------------
    // 5. 离开 -> 远端删除 -> 房间释放
    // ------------------------------------------------------------------
    await b.evaluate(() => window.__MP.leave());
    await waitFor(a, (targetId) => {
      const s = window.__MP.state();
      return s.players === 1 && window.__MP.remotes().indexOf(String(targetId)) < 0;
    }, bId, 10000, 'A 未在 B 离开后删除远端');
    const afterLeaveA = await a.evaluate(() => ({
      players: window.__MP.state().players,
      remotes: window.__MP.remotes(),
      hist: (window.__MP.debug().hist || []).map((x) => x.id),
      active: window.__MP.state().active,
    }));
    ok(
      '离开删除：B leave 后 A.remotes/debug 均无 B，players=1',
      afterLeaveA.remotes.map(String).indexOf(String(bId)) < 0 &&
        afterLeaveA.hist.map(String).indexOf(String(bId)) < 0 &&
        afterLeaveA.players === 1 && afterLeaveA.active === true,
      afterLeaveA
    );

    await a.evaluate(() => window.__MP.leave());
    const hAfter = await waitHealth(mainServer.port, (h) => h.players === 0, 6000);
    ctx.health = hAfter;
    ok(
      '最后一名玩家离开后房间释放（healthz players=0）',
      !!hAfter && hAfter.players === 0,
      hAfter && { players: hAfter.players, humans: hAfter.humans, rooms: hAfter.rooms }
    );

    // ------------------------------------------------------------------
    // 6. pageerror / 未捕获异常
    // ------------------------------------------------------------------
    const bootFinalA = await a.evaluate(() => ({ fatal: window.__fatal || null, errors: (window.__errors || []).slice(0, 5) }));
    const bootFinalB = await b.evaluate(() => ({ fatal: window.__fatal || null, errors: (window.__errors || []).slice(0, 5) }));
    ok(
      '无 pageerror / 未捕获异常（A/B 页面事件与 window.__errors 均为空）',
      pageA.pageErrors.length === 0 && pageB.pageErrors.length === 0 &&
        !bootFinalA.fatal && !bootFinalB.fatal &&
        bootFinalA.errors.length === 0 && bootFinalB.errors.length === 0,
      {
        a: { pageErrors: pageA.pageErrors.slice(0, 3), errors: bootFinalA.errors, fatal: bootFinalA.fatal },
        b: { pageErrors: pageB.pageErrors.slice(0, 3), errors: bootFinalB.errors, fatal: bootFinalB.fatal },
      }
    );

    // ------------------------------------------------------------------
    // 7. PROFILES_FILE 单进程锁：第二实例 / stale 回收 / 优雅释放
    // ------------------------------------------------------------------
    const clash = await runServerExpectExit(MAIN_PROFILE, 8000);
    ok(
      'LOCK · 第二个实例拒绝启动（exit=1，错误含单进程保护/占用）',
      clash.code === 1 && /单进程保护|已被另一个实例占用|PROFILES_FILE/.test(clash.output),
      { code: clash.code, timeout: clash.timeout, logTail: tail(clash.output, 6) }
    );
    const healthAfterClash = await waitHealth(mainServer.port, (h) => h.ok, 3000);
    const lockAfterClash = readJson(MAIN_PROFILE + '.lock');
    ok(
      'LOCK · 冲突实例退出后主实例仍健康，锁仍属于主进程',
      !!healthAfterClash && healthAfterClash.ok && !!lockAfterClash && lockAfterClash.pid === mainServer.child.pid,
      { health: healthAfterClash && healthAfterClash.ok, lockPid: lockAfterClash && lockAfterClash.pid, mainPid: mainServer.child.pid }
    );

    // stale：伪造 60 秒前的锁，新实例应回收并替换 token。
    try { fs.unlinkSync(STALE_PROFILE + '.lock'); } catch (e) {}
    const staleToken = 'stale-' + Date.now();
    const staleAt = Date.now() - 60000;
    fs.writeFileSync(STALE_PROFILE + '.lock', JSON.stringify({ pid: 999999, at: staleAt, time: staleAt, token: staleToken, file: STALE_PROFILE }));
    staleServer = await startServer(STALE_PROFILE);
    ctx.servers.push({ label: 'stale', server: staleServer });
    const staleHealth = await waitHealth(staleServer.port, (h) => h.ok, 5000);
    const staleLock = readJson(STALE_PROFILE + '.lock');
    ok(
      'LOCK · stale>30s 的旧锁被回收，新实例正常启动并接管锁',
      !!staleHealth && staleHealth.ok && !!staleLock && staleLock.pid === staleServer.child.pid && staleLock.token !== staleToken,
      { pid: staleLock && staleLock.pid, tokenReplaced: !!staleLock && staleLock.token !== staleToken }
    );
    await stopServer(staleServer);
    staleServer = null;
    ok('LOCK · stale 实例 SIGTERM 退出后删除自己的锁', !fs.existsSync(STALE_PROFILE + '.lock'), { lockExists: fs.existsSync(STALE_PROFILE + '.lock') });

    // 收尾：关闭页面与浏览器，再停主服务并验证锁释放。
    for (const item of ctx.pages) {
      try { await Promise.race([item.page.close(), sleep(3000)]); } catch (e) {}
    }
    ctx.pages = [];
    if (browser) {
      try { await Promise.race([browser.close(), sleep(8000)]); } catch (e) {}
      browser = null;
    }
    await stopServer(mainServer);
    mainServer = null;
    ok('LOCK · 主实例 SIGTERM 优雅退出后删除 PROFILES_FILE.lock', !fs.existsSync(MAIN_PROFILE + '.lock'), { lockExists: fs.existsSync(MAIN_PROFILE + '.lock') });
  } catch (e) {
    fail++;
    console.error('FAIL · e2e 异常：' + (e && e.stack ? e.stack : String(e)));
    ctx.health = mainServer ? await httpJson(mainServer.port, '/healthz') : null;
    ctx.lock = readJson(MAIN_PROFILE + '.lock');
    await dumpDiagnostics(ctx);
  } finally {
    for (const item of ctx.pages) {
      try { await Promise.race([item.page.close(), sleep(2000)]); } catch (e) {}
    }
    if (browser) {
      try { await Promise.race([browser.close(), sleep(5000)]); } catch (e) {}
    }
    if (staleServer) await stopServer(staleServer);
    if (mainServer) await stopServer(mainServer);
    for (const file of [MAIN_PROFILE, MAIN_PROFILE + '.lock', STALE_PROFILE, STALE_PROFILE + '.lock', MAIN_PROFILE + '.tmp']) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }

  console.log('\n----------------------------------------');
  console.log((fail ? 'FAIL ' + fail : 'PASS ' + pass) + ' · 共 ' + (pass + fail) + ' 项');
  console.log(fail ? 'V39 浏览器联机 e2e 失败' : 'V39 浏览器联机 e2e 全部通过');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  // main() 内部已兜底；这里只防最后一道未捕获异常，仍以 FAIL 结束。
  console.error('FAIL · 未捕获异常：' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
