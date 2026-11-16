#!/usr/bin/env node
'use strict';
/**
 * server/test_profiles.cjs — V53 服务器数据安全 / 房间健壮性回归
 *
 * 覆盖 TECH_TASKS_V53.md：
 *   SRV-1  坏档不覆盖：坏 profiles.json 启动非 0 退出、原字节改名保留；有效 .bak 恢复主档；
 *          保存流程不残留 .tmp，并维护上一份有效主档为 .bak。
 *   SRV-2  锁心跳：持有者存活且心跳刷新时，第二实例在 stale 超时后仍被拒绝；
 *          持有者退出后新实例可启动；死 pid + 过期心跳的锁可回收。
 *   SRV-3  单条 input 的 cmds 上限 8、多余丢弃计入指标；audit 日志按 player+reason 限频。
 *   SRV-5  join 的 map/mode 走自有属性校验：__proto__/constructor 不抛异常，连接不悬挂。
 *   SRV-6  快照节拍按 tick - lastSnapTick >= SNAP_EVERY（纯函数单测）。
 *   SRV-12 maps.json 存在但损坏时 fatal，不静默回退 map_boxes.json；没有 maps.json 时仍可回退。
 *
 * 用法：node server/test_profiles.cjs
 * 依赖：仅 Node 内置模块 + server/node_modules/ws
 */

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const WebSocket = require('ws');

const SERVER = path.join(__dirname, 'server.cjs');
const MAPS_FILE = path.join(__dirname, 'maps.json');
const MAP_FILE = path.join(__dirname, 'map_boxes.json');
const clients = new Set();
let pass = 0;
let fail = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS · ' + name);
  } else {
    fail++;
    console.log('FAIL · ' + name + (detail === undefined ? '' : ' — ' + JSON.stringify(detail)));
  }
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
      Object.assign({ host: '127.0.0.1', port, path: pathname, timeout: 1500 }, opts || {}),
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body), text: body });
          } catch {
            resolve({ status: res.statusCode, json: null, text: body });
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    if (opts && opts.body) req.write(opts.body);
    req.end();
  });
}

function metricValue(port, name) {
  return httpJson(port, '/metrics').then((res) => {
    if (!res || res.status !== 200) return NaN;
    const line = res.text.split('\n').find((l) => l.startsWith(name + ' '));
    return line ? Number(line.slice(name.length + 1)) : NaN;
  });
}

function httpText(port, pathname, opts) {
  return new Promise((resolve) => {
    const req = http.request(
      Object.assign({ host: '127.0.0.1', port, path: pathname, timeout: 2000 }, opts || {}),
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, text: body, headers: res.headers }));
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

function baseEnv(extra) {
  return Object.assign(
    {
      HOST: '127.0.0.1',
      MP_DEV_TOKEN: '',
      WARMUP_SECONDS: '0',
      ROUND_SECONDS: '300',
      BOTS: '0',
      LOG_JSON: '1',
      MAPS_FILE,
      MAP_FILE,
    },
    extra || {}
  );
}

async function startServer(extraEnv) {
  const port = await freePort();
  const env = baseEnv(Object.assign({ PORT: String(port) }, extraEnv || {}));
  const child = spawn(process.execPath, [SERVER], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('服务器提前退出：\n' + log);
    const health = await httpJson(port, '/healthz');
    if (health && health.json && health.json.ok) {
      return { port, child, log: () => log, env };
    }
    await sleep(80);
  }
  try { child.kill('SIGKILL'); } catch {}
  throw new Error('服务器启动超时：\n' + log);
}

async function stopServer(server) {
  if (!server) return;
  for (const c of Array.from(clients)) c.close();
  clients.clear();
  const child = server.child;
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), sleep(2500)]);
  }
  if (child.exitCode === null) child.kill('SIGKILL');
}

// 预期启动失败的实例：等它自己退出；若错误地启动成功则 kill 并标记。
async function runServerExpectExit(extraEnv, timeoutMs) {
  const port = await freePort();
  const env = baseEnv(Object.assign({ PORT: String(port) }, extraEnv || {}));
  const child = spawn(process.execPath, [SERVER], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const result = await Promise.race([
    once(child, 'exit').then(([code, signal]) => ({ exited: true, code, signal })),
    sleep(timeoutMs || 5000).then(() => ({ exited: false, code: null, signal: null })),
  ]);
  if (!result.exited && child.exitCode === null) {
    try { child.kill('SIGKILL'); } catch {}
    await Promise.race([once(child, 'exit'), sleep(1000)]);
  }
  return { code: result.code, signal: result.signal, out, port };
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.msgs = [];
    this.waiters = new Set();
    clients.add(this);
    ws.on('message', (data) => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      this.msgs.push(m);
      for (const w of Array.from(this.waiters)) {
        if (w.pred(m)) {
          this.waiters.delete(w);
          clearTimeout(w.timer);
          w.resolve(m);
        }
      }
    });
    ws.on('error', () => {});
  }
  static connect(port) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://127.0.0.1:' + port);
      ws.once('open', () => resolve(new Client(ws)));
      ws.once('error', reject);
    });
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  join(payload) { this.send(Object.assign({ t: 'join' }, payload)); }
  waitFor(pred, opts) {
    const from = (opts && opts.from) || 0;
    const timeout = (opts && opts.timeout) || 4000;
    for (let i = from; i < this.msgs.length; i++) if (pred(this.msgs[i])) return Promise.resolve(this.msgs[i]);
    return new Promise((resolve, reject) => {
      const w = { pred, resolve, timer: null };
      w.timer = setTimeout(() => {
        this.waiters.delete(w);
        const tail = this.msgs.slice(-5).map((m) => m.t);
        reject(new Error('等待消息超时；最近 ' + JSON.stringify(tail)));
      }, timeout);
      this.waiters.add(w);
    });
  }
  waitType(type, opts) { return this.waitFor((m) => m.t === type, opts); }
  close() {
    clients.delete(this);
    try { this.ws.close(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// SRV-6 / SRV-2 纯函数单测（子进程里 require，避免 SALT_UNIT_EXPORT 影响本进程）
// ---------------------------------------------------------------------------
async function testUnitHelpers(tmpdir) {
  const script =
    "process.env.SALT_UNIT_EXPORT='1';" +
    "const m=require('./server.cjs');" +
    "m.recordTick(1.5);m.recordCallback(9.5);" +
    "let pose={x:0,y:0,z:0,yaw:0},last={x:0,y:0,z:0,yaw:0},driftAt=-1;" +
    "for(let i=1;i<=60;i++){pose.x+=0.009;pose.yaw+=0.0019;" +
    "if(m.snapshotForceDue(last,pose,0)){driftAt=i;break;}}" +
    "console.log('UNIT '+JSON.stringify({" +
    "snap:typeof m.snapshotDue,lock:typeof m.lockReclaimable,cap:m.MAX_CMDS_PER_INPUT," +
    "stale:m.PROFILE_LOCK_STALE_MS,hb:m.PROFILE_LOCK_HEARTBEAT_MS," +
    "due:[m.snapshotDue(3,0,2),m.snapshotDue(5,3,2),m.snapshotDue(4,3,2),m.snapshotDue(7,5,2)]," +
    "reclaim:[m.lockReclaimable(60000,30000,true),m.lockReclaimable(1000,30000,false)," +
    "m.lockReclaimable(60000,30000,false),m.lockReclaimable(30000,30000,false)]," +
    "rings:{sim:m.metrics.tickRing.slice(),cb:m.metrics.callbackRing.slice(),simP99:m.tickP99?m.tickP99():null}," +
    "ff:[m.parseForwardedFor('127.0.0.1, 203.0.113.9','10.0.0.5')," +
    "m.parseForwardedFor('not-an-ip','10.0.0.5')," +
    "m.parseForwardedFor('127.0.0.1','10.0.0.5')]," +
    "fc:[m.forwardedClientIp('127.0.0.1, 203.0.113.9','10.0.0.5',true)," +
    "m.forwardedClientIp('127.0.0.1','203.0.113.5',true)," +
    "m.forwardedClientIp('127.0.0.1','203.0.113.5',false)," +
    "m.forwardedClientIp('garbage','10.0.0.5',true)]," +
    "driftAt:driftAt,age:[m.snapshotForceDue(last,last,m.SNAP_FORCE_AGE_TICKS)," +
    "m.snapshotForceDue(last,last,m.SNAP_FORCE_AGE_TICKS-1)]," +
    "force:{pos:m.SNAP_FORCE_POS,yaw:m.SNAP_FORCE_YAW,age:m.SNAP_FORCE_AGE_TICKS}," +
    "simClock:{t1:m.simTimeForTick(1),t2:m.simTimeForTick(2),tPad:m.simTimeForTick(0)," +
    "a1:m.advanceSimClock(),a2:m.advanceSimClock(),a3:m.advanceSimClock()}," +
    "tuning:{walk:m.SERVER_TUNING.walk,sprint:m.SERVER_TUNING.sprint,crouch:m.SERVER_TUNING.crouch," +
    "gravity:m.SERVER_TUNING.gravity,slideTime:m.SERVER_TUNING.slideTime," +
    "rescueDepth:m.SERVER_TUNING.rescueDepth,regenRate:m.SERVER_TUNING.regenRate}," +
    "profile:{max:m.PROFILE_MAX,ttlDays:m.PROFILE_TTL_DAYS,ttlMs:m.PROFILE_TTL_MS}}));";
  const child = spawn(process.execPath, ['-e', script], {
    cwd: __dirname,
    env: baseEnv({
      PORT: '0',
      PROFILES_FILE: path.join(tmpdir, 'unit-probe-profiles.json'),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  let got = null;
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && !got) {
    const line = out.split('\n').find((l) => l.startsWith('UNIT '));
    if (line) {
      try { got = JSON.parse(line.slice(5)); } catch {}
    }
    if (!got) await sleep(50);
  }
  if (child.exitCode === null) {
    try { child.kill('SIGKILL'); } catch {}
    await Promise.race([once(child, 'exit'), sleep(1000)]);
  }
  ok(
    'SRV-6 快照节拍按 tick 差触发（追帧后不再依赖奇偶）',
    !!got && got.snap === 'function' && got.due[0] === true && got.due[1] === true && got.due[2] === false && got.due[3] === true,
    got
  );
  ok(
    'SRV-2 锁回收同时要求心跳过期 + 持有进程已退出',
    !!got && got.lock === 'function' && got.reclaim[0] === false && got.reclaim[1] === false &&
      got.reclaim[2] === true && got.reclaim[3] === false,
    got && got.reclaim
  );
  ok('SRV-3 cmds 上限默认 8', !!got && got.cap === 8, got && got.cap);
  ok(
    'SRV-2 锁默认 stale=30s、心跳=5s（测试可用环境变量缩短）',
    !!got && got.stale === 30000 && got.hb === 5000,
    got && { stale: got.stale, hb: got.hb }
  );
  console.log(
    '[UNIT] rings=' + JSON.stringify(got && got.rings) + ' driftAt=' + (got && got.driftAt) +
    ' force=' + JSON.stringify(got && got.force) + ' ff=' + JSON.stringify(got && got.ff) +
    ' fc=' + JSON.stringify(got && got.fc)
  );
  ok(
    'SRV-13 模拟步与回调总耗时写入两个独立 ring',
    !!got && got.rings && got.rings.sim.length === 1 && got.rings.sim[0] === 1.5 &&
      got.rings.cb.length === 1 && got.rings.cb[0] === 9.5 && got.rings.simP99 === 1.5,
    got && got.rings
  );
  ok(
    'SRV-10 X-Forwarded-For 取最右合法项、非法项回退、单值保留',
    !!got && got.ff && got.ff[0] === '203.0.113.9' && got.ff[1] === '10.0.0.5' && got.ff[2] === '127.0.0.1',
    got && got.ff
  );
  ok(
    'SRV-10 远端连接伪造 127.0.0.1 被忽略；TRUST_PROXY=0 时完全忽略 XFF',
    !!got && got.fc && got.fc[0] === '203.0.113.9' && got.fc[1] === '203.0.113.5' &&
      got.fc[2] === '203.0.113.5' && got.fc[3] === '10.0.0.5',
    got && got.fc
  );
  ok(
    'NET-3 慢速漂移 (0.009m/0.0019rad per frame) 在 <=10 帧内触发强制发送，而不是 60 帧全部跳过',
    !!got && got.driftAt > 0 && got.driftAt <= 10 &&
      got.force.pos === 0.03 && got.force.yaw === 0.02 && got.force.age === 30,
    got && { driftAt: got.driftAt, force: got.force }
  );
  ok(
    'NET-3 0.5 秒未发送的兜底阈值生效（第 30 tick 强制、第 29 tick 不强制）',
    !!got && got.age[0] === true && got.age[1] === false,
    got && got.age
  );
  const clk = got && got.simClock;
  const stepMs = 1000 / 60;
  ok(
    'SRV-8 模拟时钟按 tick 递进：追帧多步逐次 +16.67ms（不是同一步内冻结）',
    !!clk && Math.abs(clk.t1 - stepMs) < 1e-9 && Math.abs(clk.t2 - stepMs * 2) < 1e-9 &&
      clk.tPad === 0 && Math.abs(clk.a2 - clk.a1 - stepMs) < 1e-9 &&
      Math.abs(clk.a3 - clk.a2 - stepMs) < 1e-9 && clk.a3 > clk.a2 && clk.a2 > clk.a1,
    clk
  );
  const tune = got && got.tuning;
  ok(
    'NET-2 服务器移动数值直接来自 packages/sim DEFAULT_TUNING（无重复常量）',
    !!tune && tune.walk === 3.8 && tune.sprint === 6.4 && tune.crouch === 1.9 &&
      tune.gravity === 21 && tune.slideTime === 0.65 && tune.rescueDepth > 1e6 && tune.regenRate === 0,
    tune
  );
  const prof = got && got.profile;
  ok(
    'SRV-11 档案上限/过期默认值可配置（5000 / 180 天）',
    !!prof && prof.max === 5000 && prof.ttlDays === 180 && prof.ttlMs === 180 * 86400000,
    prof
  );
  return got;
}

// ---------------------------------------------------------------------------
// SRV-1 坏档保护
// ---------------------------------------------------------------------------
async function testCorruptProfilesNoBackup(tmpdir) {
  const dir = path.join(tmpdir, 'corrupt-no-bak');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'profiles.json');
  const bad = '{"version":1,"profiles":{"tokA":{"name":"甲猫","xp":42';
  fs.writeFileSync(file, bad);
  const run = await runServerExpectExit({ PROFILES_FILE: file, MAP_DATA_DIR: path.join(dir, 'no-maps') });
  const corrupt = fs.readdirSync(dir).filter((n) => n.startsWith('profiles.json.corrupt-'));
  const corruptBytes = corrupt.length ? fs.readFileSync(path.join(dir, corrupt[0]), 'utf8') : null;
  ok('SRV-1 坏 profiles.json 启动非 0 退出（不继续用空档案）', run.code !== 0 && run.code !== null, { code: run.code, signal: run.signal });
  ok(
    'SRV-1 坏档改名为 .corrupt-<ISO> 且原字节完整保留',
    corrupt.length === 1 && corruptBytes === bad,
    { corrupt, sameBytes: corruptBytes === bad }
  );
  ok('SRV-1 坏档启动日志明确（拒绝启动/损坏）', /profiles\.json|损坏|拒绝启动/.test(run.out), run.out.slice(-500));
  ok('SRV-1 无有效备份时不创建 .bak、不残留 .tmp', !fs.existsSync(file + '.bak') && !fs.existsSync(file + '.tmp'), {
    bak: fs.existsSync(file + '.bak'),
    tmp: fs.existsSync(file + '.tmp'),
  });
}

async function testCorruptProfilesBackupRecovery(tmpdir) {
  const dir = path.join(tmpdir, 'corrupt-with-bak');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'profiles.json');
  const bad = '{"version":1,"profiles":{ broken';
  const good = JSON.stringify({
    version: 1,
    savedAt: '2026-11-16T00:00:00.000Z',
    profiles: {
      tokB: {
        uid: 'uB', token: 'tokB', name: '备份猫', xp: 123, kills: 2, deaths: 1,
        matches: 1, wins: 1, createdAt: 1, updatedAt: 2,
      },
    },
  });
  fs.writeFileSync(file, bad);
  fs.writeFileSync(file + '.bak', good);
  let server = null;
  try {
    server = await startServer({ PROFILES_FILE: file, MAP_DATA_DIR: path.join(dir, 'no-maps') });
    const got = await httpJson(server.port, '/api/profile?token=tokB');
    ok(
      'SRV-1 主档损坏但 .bak 有效：恢复主档并继续服务（token/XP 可读）',
      !!got && got.status === 200 && got.json.profile.xp === 123,
      got && got.json
    );
    let main = null;
    try { main = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    const corrupt = fs.readdirSync(dir).filter((n) => n.startsWith('profiles.json.corrupt-'));
    ok(
      'SRV-1 备份恢复后主档是合法 JSON，坏档仍以 .corrupt 保留原字节',
      !!main && !!main.profiles && !!main.profiles.tokB &&
        corrupt.length === 1 && fs.readFileSync(path.join(dir, corrupt[0]), 'utf8') === bad,
      { hasTok: !!(main && main.profiles && main.profiles.tokB), corrupt }
    );

    // 触发一次保存：应写 tmp -> fsync -> rename，并把上一份有效主档维护为 .bak。
    const created = await httpJson(server.port, '/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '新猫' }),
    });
    await sleep(900);
    let main2 = null;
    let bak2 = null;
    try { main2 = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    try { bak2 = JSON.parse(fs.readFileSync(file + '.bak', 'utf8')); } catch {}
    ok(
      'SRV-1 保存后主档含新档案、.bak 仍是上一份有效主档、无 .tmp 残留',
      !!created && created.status === 201 && !!main2 && !!main2.profiles &&
        !!main2.profiles[created.json.token] && !!bak2 && !!bak2.profiles && !!bak2.profiles.tokB &&
        !fs.existsSync(file + '.tmp'),
      { created: created && created.status, mainTok: !!(main2 && main2.profiles && created.json && main2.profiles[created.json.token]) }
    );
  } finally {
    await stopServer(server);
  }
}

// ---------------------------------------------------------------------------
// SRV-2 锁心跳 / 存活持有者不可回收
// ---------------------------------------------------------------------------
async function testLockHeartbeat(tmpdir) {
  const dir = path.join(tmpdir, 'lock');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'profiles.json');
  const lockEnv = {
    PROFILES_FILE: file,
    MAP_DATA_DIR: path.join(dir, 'no-maps'),
    PROFILE_LOCK_STALE_MS: '1200',
    PROFILE_LOCK_HEARTBEAT_MS: '300',
  };
  let a = null;
  let c = null;
  try {
    a = await startServer(lockEnv);
    const lockFile = file + '.lock';
    const mtimeBefore = fs.statSync(lockFile).mtimeMs;
    let atBefore = 0;
    try { atBefore = Number(JSON.parse(fs.readFileSync(lockFile, 'utf8')).at) || 0; } catch {}
    await sleep(900);
    const mtimeAfter = fs.statSync(lockFile).mtimeMs;
    let atAfter = 0;
    try { atAfter = Number(JSON.parse(fs.readFileSync(lockFile, 'utf8')).at) || 0; } catch {}
    ok(
      'SRV-2 持有锁期间心跳刷新锁文件 at/mtime',
      mtimeAfter > mtimeBefore && atAfter > atBefore,
      { mtimeBefore, mtimeAfter, atBefore, atAfter }
    );
    await sleep(1900); // 总计超过 stale；心跳每 300ms 刷新，A 仍应持有
    const b = await runServerExpectExit(lockEnv, 5000);
    ok(
      'SRV-2 持有者存活 > stale（心跳刷新）时第二实例仍被拒绝',
      b.code !== 0 && b.code !== null,
      { code: b.code, signal: b.signal, tail: b.out.slice(-400) }
    );
    ok('SRV-2 拒绝日志说明单进程保护/锁被占用', /占用|单进程保护|拒绝启动/.test(b.out), b.out.slice(-400));
    const health = await httpJson(a.port, '/healthz');
    ok('SRV-2 第一实例在第二实例尝试后仍健康', !!health && !!health.json && health.json.ok === true, health && health.status);

    // 正常退出后锁释放，新实例可以启动
    await stopServer(a);
    a = null;
    c = await startServer(lockEnv);
    const healthC = await httpJson(c.port, '/healthz');
    ok('SRV-2 持有者退出后同一 PROFILES_FILE 可再次启动', !!healthC && !!healthC.json && healthC.json.ok === true, healthC && healthC.status);
  } finally {
    await stopServer(a);
    await stopServer(c);
  }

  // 死 pid + 过期心跳的锁应被回收
  const dead = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
  await once(dead, 'exit');
  fs.writeFileSync(file + '.lock', JSON.stringify({
    pid: dead.pid, at: Date.now() - 60000, time: Date.now() - 60000, token: 'dead-token',
  }));
  let d = null;
  try {
    d = await startServer(lockEnv);
    ok('SRV-2 死 pid + 心跳过期的锁可被回收', /stale lock reclaimed/.test(d.log()), d.log().slice(-400));
  } finally {
    await stopServer(d);
  }
}

// ---------------------------------------------------------------------------
// SRV-3 cmds 上限 + 审计限频
// ---------------------------------------------------------------------------
function countAuditLines(log, reason) {
  if (!reason) return (log.match(/audit /g) || []).length;
  return (log.match(new RegExp('audit ' + reason, 'g')) || []).length;
}

async function testInputAmplification(tmpdir) {
  const dir = path.join(tmpdir, 'input');
  fs.mkdirSync(dir, { recursive: true });
  let server = null;
  let c = null;
  try {
    server = await startServer({
      PROFILES_FILE: path.join(dir, 'profiles.json'),
      MAP_DATA_DIR: path.join(dir, 'no-maps'),
      MAX_MESSAGE_BYTES: '262144',
    });
    c = await Client.connect(server.port);
    c.join({ name: '放大猫', room: 'amp-' + Date.now().toString(36) });
    const welcome = await c.waitType('welcome');
    ok('SRV-3 测试客户端加入成功', !!welcome, welcome && welcome.mapId);

    const cmds = [];
    for (let i = 1; i <= 5000; i++) cmds.push({ seq: i, move: { x: 0, y: 0 }, yaw: 0, pitch: 0 });
    c.send({ t: 'input', cmds });
    await sleep(700);
    const truncated = await metricValue(server.port, 'saltline_commands_truncated');
    const auditBatch = await metricValue(server.port, 'saltline_audit_reason{reason="cmd_batch_truncated"}');
    ok(
      'SRV-3 单条 5000 命令 input 只处理 8 条，其余 4992 条计入 truncated',
      truncated === 4992 && auditBatch >= 1,
      { truncated, auditBatch }
    );
    ok(
      'SRV-3 5000 命令消息没有刷出数千行审计日志',
      countAuditLines(server.log()) <= 20 && countAuditLines(server.log(), 'cmd_batch_truncated') <= 2,
      {
        allAuditLines: countAuditLines(server.log()),
        batchAuditLines: countAuditLines(server.log(), 'cmd_batch_truncated'),
        logBytes: server.log().length,
      }
    );

    // 40 条超限消息：指标每次都记，日志仍按 player+reason 每 2 秒最多一条。
    for (let n = 0; n < 40; n++) {
      const batch = [];
      for (let i = 0; i < 9; i++) batch.push({ seq: 10000 + n * 9 + i, move: { x: 0, y: 0 }, yaw: 0, pitch: 0 });
      c.send({ t: 'input', cmds: batch });
    }
    await sleep(700);
    const auditBatch2 = await metricValue(server.port, 'saltline_audit_reason{reason="cmd_batch_truncated"}');
    const suppressed = await metricValue(server.port, 'saltline_audit_suppressed');
    ok(
      'SRV-3 审计指标逐条计数（>=41）但日志被限频（<=2 行）',
      auditBatch2 >= 41 && countAuditLines(server.log(), 'cmd_batch_truncated') <= 2 && suppressed > 0,
      { auditBatch2, suppressed, auditLines: countAuditLines(server.log(), 'cmd_batch_truncated') }
    );

    // 被截断后仍能正常 ping/pong（连接不因审计/限速悬挂）
    await sleep(1100);
    const from = c.msgs.length;
    c.send({ t: 'ping', ts: Date.now() });
    const pong = await c.waitType('pong', { from, timeout: 3000 });
    ok('SRV-3 大量命令后连接仍可 ping/pong', !!pong, pong && pong.t);
  } finally {
    if (c) c.close();
    await stopServer(server);
  }
}

// ---------------------------------------------------------------------------
// SRV-5 __proto__ / constructor 不炸、不悬挂
// ---------------------------------------------------------------------------
async function testProtoJoin(tmpdir) {
  const dir = path.join(tmpdir, 'proto');
  fs.mkdirSync(dir, { recursive: true });
  let server = null;
  const open = [];
  try {
    server = await startServer({
      PROFILES_FILE: path.join(dir, 'profiles.json'),
      MAP_DATA_DIR: path.join(dir, 'no-maps'),
    });
    const room = 'proto-' + Date.now().toString(36);

    const a = await Client.connect(server.port);
    open.push(a);
    a.join({ name: '原型甲', room, map: '__proto__', mode: 'tdm' });
    let wa = null;
    let errA = null;
    try { wa = await a.waitType('welcome', { timeout: 2500 }); } catch (e) { errA = e; }
    ok(
      'SRV-5 join map=__proto__ 不抛异常，连接收到 welcome（回退 harbor）',
      !!wa && wa.mapId === 'harbor' && !errA,
      wa && { mapId: wa.mapId, roomKey: wa.roomKey }
    );

    const b = await Client.connect(server.port);
    open.push(b);
    b.join({ name: '原型乙', room, map: 'constructor', mode: 'tdm' });
    let wb = null;
    try { wb = await b.waitType('welcome', { timeout: 2500 }); } catch {}
    ok('SRV-5 join map=constructor 同样安全回退', !!wb && wb.mapId === 'harbor', wb && wb.mapId);

    const c = await Client.connect(server.port);
    open.push(c);
    c.join({ name: '原型丙', room, map: 'harbor', mode: '__proto__' });
    let errC = null;
    try { errC = await c.waitType('error', { timeout: 2500 }); } catch {}
    ok(
      'SRV-5 join mode=__proto__ 返回 mode_unsupported 而不是悬挂',
      !!errC && errC.code === 'mode_unsupported',
      errC
    );

    // 投票 __proto__ 不应污染 votes / 抛异常；随后 ping 应正常。
    a.send({ t: 'vote', map: '__proto__' });
    const from = a.msgs.length;
    a.send({ t: 'ping', ts: Date.now() });
    let pong = null;
    try { pong = await a.waitType('pong', { from, timeout: 2500 }); } catch {}
    ok('SRV-5 vote map=__proto__ 后连接仍可 ping/pong', !!pong, pong && pong.t);
  } finally {
    for (const cl of open) cl.close();
    await stopServer(server);
  }
}

// ---------------------------------------------------------------------------
// SRV-12 maps.json 损坏 fatal；没有 maps.json 时才允许旧路径
// ---------------------------------------------------------------------------
async function testMapsFallback(tmpdir) {
  const dir = path.join(tmpdir, 'maps-bad');
  const mapDir = path.join(dir, 'no-package-maps');
  fs.mkdirSync(mapDir, { recursive: true });
  const badMaps = path.join(dir, 'maps.json');
  fs.writeFileSync(badMaps, '{"maps": { broken');
  const run = await runServerExpectExit({
    PROFILES_FILE: path.join(dir, 'profiles.json'),
    MAP_DATA_DIR: mapDir,
    MAPS_FILE: badMaps,
    MAP_FILE,
  }, 5000);
  ok(
    'SRV-12 maps.json 存在但解析失败：fatal 非 0 退出',
    run.code !== 0 && run.code !== null,
    { code: run.code, tail: run.out.slice(-400) }
  );
  ok(
    'SRV-12 不做静默回退，日志明确拒绝启动',
    /maps\.json/.test(run.out) && /拒绝启动|不回退/.test(run.out),
    run.out.slice(-500)
  );

  // 没有 maps.json 时，旧 map_boxes.json 回退仍然允许（显式/默认旧路径）。
  const dir2 = path.join(tmpdir, 'maps-missing');
  fs.mkdirSync(dir2, { recursive: true });
  let server = null;
  try {
    server = await startServer({
      PROFILES_FILE: path.join(dir2, 'profiles.json'),
      MAP_DATA_DIR: path.join(dir2, 'no-package-maps'),
      MAPS_FILE: path.join(dir2, 'maps.json'),
      MAP_FILE,
    });
    const health = await httpJson(server.port, '/healthz');
    ok(
      'SRV-12 确实没有 maps.json 时仍可使用旧 map_boxes.json 启动',
      !!health && !!health.json && health.json.ok === true && health.json.boxes > 0,
      health && health.json && { boxes: health.json.boxes }
    );
  } finally {
    await stopServer(server);
  }
}

// ---------------------------------------------------------------------------
// SRV-10 代理/IP + SRV-13 指标拆分 / 静态读流
// ---------------------------------------------------------------------------
async function testProxyMetricsStatic(tmpdir) {
  const dir = path.join(tmpdir, 'proxy-static');
  const staticDir = path.join(dir, 'static');
  fs.mkdirSync(staticDir, { recursive: true });
  fs.writeFileSync(path.join(staticDir, 'ok.txt'), 'served-ok');
  const secret = path.join(staticDir, 'secret.txt');
  fs.writeFileSync(secret, 'top-secret');
  const canDenyRead = process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() !== 0;
  if (canDenyRead) fs.chmodSync(secret, 0o000);
  const spoof = { headers: { 'x-forwarded-for': '127.0.0.1, 203.0.113.9' } };
  let server = null;
  let plain = null;
  try {
    server = await startServer({
      PROFILES_FILE: path.join(dir, 'profiles.json'),
      MAP_DATA_DIR: path.join(dir, 'no-maps'),
      STATIC_DIR: staticDir,
      TRUST_PROXY: '1',
      BOTS: '0',
    });
    const spoofHealth = await httpJson(server.port, '/healthz', spoof);
    ok(
      'SRV-10 XFF 最左项 127.0.0.1 被忽略：/healthz 不返回 roomsDetail',
      !!spoofHealth && !!spoofHealth.json && !('roomsDetail' in spoofHealth.json),
      spoofHealth && spoofHealth.json && Object.keys(spoofHealth.json)
    );
    const lanHealth = await httpJson(server.port, '/healthz', { headers: { 'x-forwarded-for': '192.168.1.5' } });
    ok(
      'SRV-10 可信链最右项 192.168.1.5 被采信：内网默认返回 roomsDetail',
      !!lanHealth && !!lanHealth.json && Array.isArray(lanHealth.json.roomsDetail),
      lanHealth && lanHealth.json && lanHealth.json.roomsDetail
    );

    const metricsDirect = await httpText(server.port, '/metrics');
    ok(
      'SRV-10 TRUST_PROXY=1 且无 XFF：真实回环仍可访问 /metrics',
      !!metricsDirect && metricsDirect.status === 200 && metricsDirect.text.includes('saltline_sim_step_ms'),
      metricsDirect && metricsDirect.status
    );
    const metricsSpoof = await httpText(server.port, '/metrics', spoof);
    ok(
      'SRV-10 伪造 XFF 链（127.0.0.1, 203.0.113.9）不能访问 /metrics（401）',
      !!metricsSpoof && metricsSpoof.status === 401,
      metricsSpoof && metricsSpoof.status
    );
    const detail = await httpText(server.port, '/metrics?detail=1');
    ok(
      'SRV-10/13 /metrics?detail=1 真实回环返回逐房间明细',
      !!detail && detail.status === 200 && detail.text.includes('saltline_room_players') &&
        detail.text.includes('saltline_tick_callback_ms'),
      detail && { status: detail.status, hasRooms: !!(detail.text && detail.text.includes('saltline_room_players')) }
    );
    const detailSpoof = await httpText(server.port, '/metrics?detail=1', spoof);
    ok(
      'SRV-10 ?detail=1 不能借伪造 XFF 取得房间明细（401）',
      !!detailSpoof && detailSpoof.status === 401,
      detailSpoof && detailSpoof.status
    );

    console.log(
      '[SRV-10] trust=1 spoofChain(127.0.0.1,203.0.113.9): healthz.detail=' +
      !!(spoofHealth && spoofHealth.json && 'roomsDetail' in spoofHealth.json) +
      ' metrics.direct=' + (metricsDirect && metricsDirect.status) +
      ' metrics.spoof=' + (metricsSpoof && metricsSpoof.status) +
      ' detail.direct=' + (detail && detail.status) +
      ' detail.spoof=' + (detailSpoof && detailSpoof.status)
    );

    const okFile = await httpText(server.port, '/ok.txt');
    ok(
      'SRV-13 静态文件正常读取（STATIC_DIR）',
      !!okFile && okFile.status === 200 && okFile.text === 'served-ok',
      okFile && { status: okFile.status, text: okFile.text }
    );
    const missing = await httpText(server.port, '/missing.txt');
    ok('SRV-13 静态文件不存在返回 404', !!missing && missing.status === 404, missing && missing.status);

    if (canDenyRead) {
      const denied = await httpText(server.port, '/secret.txt');
      await sleep(300);
      const health = await httpJson(server.port, '/healthz');
      ok(
        'SRV-13 静态读流 EACCES 不崩进程（未泄漏内容，/healthz 仍 ok）',
        (!denied || denied.text !== 'top-secret') && !!health && !!health.json && health.json.ok === true,
        { denied: denied && { status: denied.status, text: denied.text }, health: health && health.json && health.json.ok }
      );
      ok(
        'SRV-13 静态读流失败写入审计日志（static_read_error）',
        /static_read_error/.test(server.log()),
        server.log().slice(-400)
      );
    } else {
      ok('SRV-13 静态读流失败用例在 root/Windows 上跳过（无法构造 EACCES）', true);
    }

    // 对照：TRUST_PROXY=0 时 XFF 完全忽略，伪造链不影响回环访问。
    plain = await startServer({
      PROFILES_FILE: path.join(dir, 'profiles-plain.json'),
      MAP_DATA_DIR: path.join(dir, 'no-maps'),
      STATIC_DIR: staticDir,
      TRUST_PROXY: '0',
      BOTS: '0',
    });
    const plainHealth = await httpJson(plain.port, '/healthz', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    ok(
      'SRV-10 TRUST_PROXY=0：XFF 被忽略，回环请求仍返回 roomsDetail',
      !!plainHealth && !!plainHealth.json && Array.isArray(plainHealth.json.roomsDetail),
      plainHealth && plainHealth.json && Object.keys(plainHealth.json)
    );
    const plainMetrics = await httpText(plain.port, '/metrics', spoof);
    ok(
      'SRV-10 TRUST_PROXY=0：伪造 XFF 链不影响回环 /metrics（200）',
      !!plainMetrics && plainMetrics.status === 200,
      plainMetrics && plainMetrics.status
    );
  } finally {
    if (canDenyRead) {
      try { fs.chmodSync(secret, 0o600); } catch {}
    }
    await stopServer(server);
    await stopServer(plain);
  }
}

// ---------------------------------------------------------------------------
// SRV-11 档案上限 / TTL / 不落客户端 IP
// ---------------------------------------------------------------------------
async function testProfileHygiene(tmpdir) {
  const dir = path.join(tmpdir, 'profile-hygiene');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'profiles.json');
  const now = Date.now();
  const seed = {
    version: 1,
    savedAt: new Date(now).toISOString(),
    profiles: {
      tokOld: { uid: 'uOld', token: 'tokOld', name: '过期猫', xp: 10, createdAt: now - 40 * 86400000, updatedAt: now - 40 * 86400000, ip: '203.0.113.7' },
      tokB: { uid: 'uB', token: 'tokB', name: '活跃乙', xp: 20, createdAt: now - 3 * 86400000, updatedAt: now - 1 * 86400000, ip: '127.0.0.1' },
      tokC: { uid: 'uC', token: 'tokC', name: '活跃丙', xp: 30, createdAt: now - 4 * 86400000, updatedAt: now - 2 * 86400000, ip: '198.51.100.4' },
    },
  };
  fs.writeFileSync(file, JSON.stringify(seed));
  let server = null;
  try {
    server = await startServer({
      PROFILES_FILE: file,
      PROFILE_MAX: '2',
      PROFILE_TTL_DAYS: '30',
      MAP_DATA_DIR: path.join(dir, 'no-maps'),
    });
    await sleep(700);
    const expired = await httpJson(server.port, '/api/profile?token=tokOld');
    ok('SRV-11 超过 PROFILE_TTL_DAYS 的档案被清理（GET 404）', !!expired && expired.status === 404, expired && expired.status);
    const b = await httpJson(server.port, '/api/profile?token=tokB');
    const c = await httpJson(server.port, '/api/profile?token=tokC');
    ok('SRV-11 未过期档案仍可读（TTL 不误删活跃档案）', !!b && b.status === 200 && b.json.profile.xp === 20 &&
      !!c && c.status === 200, { b: b && b.status, c: c && c.status });

    let raw = fs.readFileSync(file, 'utf8');
    ok('SRV-11 加载后不再把客户端 IP 写入 profiles.json', raw.indexOf('"ip"') < 0 && raw.indexOf('203.0.113.7') < 0 &&
      raw.indexOf('127.0.0.1') < 0 && raw.indexOf('198.51.100.4') < 0, raw.slice(0, 240));
    let saved = JSON.parse(raw);
    ok('SRV-11 启动清理落盘：过期档案从文件移除', !saved.profiles.tokOld &&
      Object.keys(saved.profiles).length === 2, Object.keys(saved.profiles));
    const bakRaw = fs.existsSync(file + '.bak') ? fs.readFileSync(file + '.bak', 'utf8') : '';
    ok('SRV-11 .bak 备份同样不含客户端 IP', bakRaw.indexOf('"ip"') < 0 &&
      bakRaw.indexOf('127.0.0.1') < 0 && bakRaw.indexOf('203.0.113.7') < 0, bakRaw.slice(0, 200));

    const created = await httpJson(server.port, '/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新档案' }),
    });
    ok('SRV-11 达到上限后仍可创建（LRU 淘汰最久未活跃档案，API 不破坏）',
      !!created && created.status === 201 && !!created.json.token, created && created.status);
    await sleep(700);
    const gone = await httpJson(server.port, '/api/profile?token=tokC');
    const keep = await httpJson(server.port, '/api/profile?token=tokB');
    const fresh = await httpJson(server.port, '/api/profile?token=' + (created && created.json.token));
    ok('SRV-11 上限按最久未活跃淘汰（最老 tokC 被清，tokB/新档案仍在）',
      !!gone && gone.status === 404 && !!keep && keep.status === 200 && !!fresh && fresh.status === 200,
      { gone: gone && gone.status, keep: keep && keep.status, fresh: fresh && fresh.status });
    raw = fs.readFileSync(file, 'utf8');
    saved = JSON.parse(raw);
    ok('SRV-11 档案数量不超过 PROFILE_MAX=2', Object.keys(saved.profiles).length === 2 &&
      raw.indexOf('"ip"') < 0, Object.keys(saved.profiles));
    const health = await httpJson(server.port, '/healthz');
    ok('SRV-11 /healthz 暴露档案上限与计数', !!health && health.json.profilesMax === 2 &&
      health.json.profiles <= 2 && health.json.profileTtlDays === 30,
      health && { max: health.json.profilesMax, count: health.json.profiles, ttl: health.json.profileTtlDays });
  } finally {
    await stopServer(server);
  }
}

// ---------------------------------------------------------------------------
// SRV-11 武器/配件解锁等级校验
// ---------------------------------------------------------------------------
async function testLoadoutUnlocks(tmpdir) {
  const dir = path.join(tmpdir, 'loadout-unlocks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'profiles.json');
  const now = Date.now();
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    savedAt: new Date(now).toISOString(),
    profiles: {
      hi: { uid: 'uHi', token: 'hi', name: '高阶猫', xp: 900, createdAt: now - 86400000, updatedAt: now },
      lo: { uid: 'uLo', token: 'lo', name: '新猫', xp: 0, createdAt: now - 86400000, updatedAt: now },
    },
  }));
  let server = null;
  const room = 'loadout-' + Date.now().toString(36);
  try {
    server = await startServer({
      PROFILES_FILE: file,
      MAP_DATA_DIR: path.join(dir, 'no-maps'),
    });
    const hi = await Client.connect(server.port);
    hi.join({
      name: '高阶', room, team: 0, profileToken: 'hi',
      loadout: { primary: 'dmr', secondary: 'sidearm', attachments: { primary: { optic: 'x3', mag: 'ext' } } },
    });
    const wh = await hi.waitType('welcome');
    ok('SRV-11 等级 4 可装备已解锁 dmr（loadoutLevel=4，无 adjusted）',
      !!wh && wh.loadout.primary === 'dmr' && wh.loadoutLevel === 4 &&
      (!wh.loadoutAdjusted || wh.loadoutAdjusted.length === 0),
      wh && { primary: wh.loadout.primary, level: wh.loadoutLevel, adjusted: wh.loadoutAdjusted });
    hi.close();

    const lo = await Client.connect(server.port);
    lo.join({
      name: '新猫', room, team: 1, profileToken: 'lo',
      loadout: { primary: 'dmr', secondary: 'sidearm', attachments: { primary: { optic: 'nope' } } },
    });
    const wl = await lo.waitType('welcome');
    ok('SRV-11 等级 1 请求未解锁 dmr 被拒绝装备（回退 pac9 并记录 adjusted）',
      !!wl && wl.loadout.primary === 'pac9' && Array.isArray(wl.loadoutAdjusted) &&
      wl.loadoutAdjusted.includes('primary:dmr'), wl && { primary: wl.loadout.primary, adjusted: wl.loadoutAdjusted });
    ok('SRV-11 非法/未解锁配件被剥离（dmr optic=nope 不进入 loadout）',
      !!wl && (!wl.loadout.attachments || !wl.loadout.attachments.primary || !wl.loadout.attachments.primary.optic),
      wl && wl.loadout.attachments);
    lo.close();

    const hi2 = await Client.connect(server.port);
    hi2.join({ name: '高阶二', room, team: 0, profileToken: 'hi', loadout: { primary: 'lmg' } });
    const wh2 = await hi2.waitType('welcome');
    ok('SRV-11 等级 4 请求等级 6 的 lmg 仍被拒绝（回退 pac9）',
      !!wh2 && wh2.loadout.primary === 'pac9' && (wh2.loadoutAdjusted || []).includes('primary:lmg'),
      wh2 && { primary: wh2.loadout.primary, adjusted: wh2.loadoutAdjusted });
    hi2.close();

    const anon = await Client.connect(server.port);
    anon.join({
      name: '匿名猫', room, team: 1,
      loadout: { primary: 'smg', secondary: 'sidearm', attachments: { primary: { muzzle: 'nope' } } },
    });
    const wa = await anon.waitType('welcome');
    ok('SRV-11 无档案（等级 1）请求 smg 被拒绝，配件一并剥离',
      !!wa && wa.loadout.primary === 'pac9' && (wa.loadoutAdjusted || []).includes('primary:smg') &&
      (!wa.loadout.attachments || !wa.loadout.attachments.primary),
      wa && { primary: wa.loadout.primary, adjusted: wa.loadoutAdjusted, attachments: wa.loadout.attachments });
    anon.close();

    await sleep(400);
    const raw = fs.readFileSync(file, 'utf8');
    ok('SRV-11 装备校验过程不写回客户端 IP', raw.indexOf('"ip"') < 0 && raw.indexOf('127.0.0.1') < 0, raw.slice(0, 160));
  } finally {
    await stopServer(server);
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'saltline-v53-'));
  try {
    await testUnitHelpers(tmpdir);
    await testCorruptProfilesNoBackup(tmpdir);
    await testCorruptProfilesBackupRecovery(tmpdir);
    await testLockHeartbeat(tmpdir);
    await testInputAmplification(tmpdir);
    await testProtoJoin(tmpdir);
    await testMapsFallback(tmpdir);
    await testProxyMetricsStatic(tmpdir);
    await testProfileHygiene(tmpdir);
    await testLoadoutUnlocks(tmpdir);
  } catch (e) {
    fail++;
    console.error('FAIL · 测试异常：' + (e && e.stack ? e.stack : e));
  } finally {
    for (const c of Array.from(clients)) c.close();
    try { fs.rmSync(tmpdir, { recursive: true, force: true }); } catch {}
  }
  console.log(fail ? fail + ' 项失败 / ' + (pass + fail) + ' 项' : '全部通过（' + pass + ' 项）');
  process.exit(fail ? 1 : 0);
}

main();
