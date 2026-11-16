#!/usr/bin/env node
'use strict';
/**
 * server/test_round.cjs — WP32-0 服务器止血修复回归
 *
 * 覆盖：
 *   N1  无 MP_DEV_TOKEN 时 dev 消息必须报错，且玩家位置不变
 *   N2  ROUND_SECONDS=3 到点进入加时，OVERTIME_SECONDS=2 后按平局结束并 roundStart
 *   N8  名字白名单、长度 1-16、重名 #2
 *   N10 房间键 room@mode；投票换图后原房间不分裂，晚到玩家仍进同房
 *   N11 忽略客户端 team；加入/离开后两队人数差 <= 1
 *
 * 用法：node server/test_round.cjs   （或 npm test --prefix server）
 * 依赖：仅 Node 内置模块 + server/node_modules/ws
 */

const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const WebSocket = require('ws');

const SERVER = path.join(__dirname, 'server.cjs');
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

function countTeams(players) {
  const counts = [0, 0];
  for (const p of players || []) counts[p.team === 1 ? 1 : 0]++;
  return counts;
}

function nameIsClean(name) {
  return typeof name === 'string' && /^[\p{Script=Han}A-Za-z0-9_#\- ]{1,16}$/u.test(name);
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

function httpJson(port, pathname) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, timeout: 800 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function startServer(extraEnv) {
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    MP_DEV_TOKEN: '',
    ROUND_SECONDS: '3',
    OVERTIME_SECONDS: '2',
    ROUND_END_MS: '500',
    SCORE_LIMIT: '50',
    MAPS_FILE: path.join(__dirname, 'maps.json'),
    MAP_FILE: path.join(__dirname, 'map_boxes.json'),
    // 每个测试实例独立 profiles，避免 V39 单进程锁把并行测试服务器拒之门外
    PROFILES_FILE: path.join(os.tmpdir(), 'saltline-test-profiles-' + port + '.json'),
    ...(extraEnv || {}),
  };
  delete env.MP_DEV;
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

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('服务器提前退出：\n' + log);
    const health = await httpJson(port, '/healthz');
    if (health && health.ok) return { port, child, log: () => log };
    await sleep(100);
  }
  throw new Error('服务器启动超时：\n' + log);
}

async function stopServer(server) {
  if (!server) return;
  for (const c of Array.from(clients)) c.close();
  clients.clear();
  const child = server.child;
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), sleep(2000)]);
  }
  if (child.exitCode === null) child.kill('SIGKILL');
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.msgs = [];
    this.waiters = new Set();
    clients.add(this);
    ws.on('message', (data) => {
      let m;
      try {
        m = JSON.parse(String(data));
      } catch {
        return;
      }
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

  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }

  join(payload) {
    this.send(Object.assign({ t: 'join' }, payload));
  }

  // from：从第几条已收消息开始找，避免重复命中上一轮事件
  waitFor(pred, opts) {
    const from = (opts && opts.from) || 0;
    const timeout = (opts && opts.timeout) || 5000;
    for (let i = from; i < this.msgs.length; i++) {
      if (pred(this.msgs[i])) return Promise.resolve(this.msgs[i]);
    }
    return new Promise((resolve, reject) => {
      const w = { pred, resolve, timer: null };
      w.timer = setTimeout(() => {
        this.waiters.delete(w);
        const tail = this.msgs.slice(-4).map((m) => m.t);
        reject(new Error('等待消息超时；最近 ' + JSON.stringify(tail)));
      }, timeout);
      this.waiters.add(w);
    });
  }

  waitType(type, opts) {
    return this.waitFor((m) => m.t === type, opts);
  }

  close() {
    clients.delete(this);
    try {
      this.ws.close();
    } catch {
      /* noop */
    }
  }
}

async function testDevBackdoor(port) {
  const room = 'dev-' + Date.now().toString(36);
  const a = await Client.connect(port);
  a.join({ name: '甲猫', room });
  const welcome = await a.waitType('welcome');
  ok(
    'welcome 正常且房间键为 room@mode',
    !!welcome && welcome.mapId === 'harbor' && welcome.roomKey === room + '@tdm',
    welcome && { mapId: welcome.mapId, roomKey: welcome.roomKey }
  );
  const spawn = welcome.map.spawn;

  let from = a.msgs.length;
  a.send({ t: 'dev', cmd: 'tp', x: 20, z: -10 });
  const err1 = await a.waitType('error', { from, timeout: 3000 });
  ok('无 token 的 dev 消息被拒绝并返回 error', !!err1 && err1.code === 'dev_disabled', err1);

  from = a.msgs.length;
  a.send({ t: 'dev', cmd: 'tp', token: 'wrong-token', x: 20, z: -10 });
  const err2 = await a.waitType('error', { from, timeout: 3000 });
  ok('错误 token 的 dev 消息被拒绝', !!err2 && err2.code === 'dev_disabled', err2);

  await sleep(350);
  const snap = [...a.msgs].reverse().find((m) => m.t === 'snap');
  const self = snap && snap.players.find((q) => q.id === welcome.id);
  ok(
    'dev 被拒后玩家位置不变',
    !!self && Math.abs(self.x - spawn.x) < 0.6 && Math.abs(self.z - spawn.z) < 0.6,
    self && { x: self.x, z: self.z, spawn }
  );
  a.close();
}

async function testNames(port) {
  const room = 'nm-' + Date.now().toString(36);
  const n1 = await Client.connect(port);
  n1.join({ name: 'Bad<>"\'&\u0000Name😀', room });
  const w1 = await n1.waitType('welcome');
  ok('非法名字被清洗为白名单字符', w1.name === 'BadName' && nameIsClean(w1.name), w1.name);

  const n2 = await Client.connect(port);
  n2.join({ name: 'BadName', room });
  const w2 = await n2.waitType('welcome');
  ok('重名追加 #2', w2.name === 'BadName#2' && nameIsClean(w2.name), w2.name);

  const n3 = await Client.connect(port);
  n3.join({ name: '<>"\'&\u0001', room });
  const w3 = await n3.waitType('welcome');
  ok('全非法名字回退到中文默认名', /^几猫/.test(w3.name) && nameIsClean(w3.name), w3.name);

  const n4 = await Client.connect(port);
  n4.join({ name: 'X'.repeat(40), room });
  const w4 = await n4.waitType('welcome');
  ok('名字长度截断到 16', w4.name === 'X'.repeat(16) && nameIsClean(w4.name), w4.name);

  const n5 = await Client.connect(port);
  n5.join({ name: '  Li  Si  ', room });
  const w5 = await n5.waitType('welcome');
  ok('空格折叠并去除首尾空白', w5.name === 'Li Si' && nameIsClean(w5.name), w5.name);

  for (const c of [n1, n2, n3, n4, n5]) c.close();
}

async function testRoundAndRoomKey(port) {
  const room = 'rd-' + Date.now().toString(36);
  const a = await Client.connect(port);
  a.join({ name: '回合甲', room, map: 'harbor', mode: 'tdm' });
  const wa = await a.waitType('welcome');

  const b = await Client.connect(port);
  b.join({ name: '回合乙', room, map: 'harbor', mode: 'tdm' });
  const wb = await b.waitType('welcome');
  ok('两人自动分到不同队', wa.team === 0 && wb.team === 1, [wa.team, wb.team]);

  const fromA = a.msgs.length;
  const fromB = b.msgs.length;
  a.send({ t: 'vote', map: 'depot' });
  b.send({ t: 'vote', map: 'depot' });

  const t0 = Date.now();
  const overtime = await a.waitType('overtime', { from: fromA, timeout: 6000 });
  const overtimeAt = Date.now() - t0;
  ok(
    'ROUND_SECONDS=3 到点平分进入加时',
    !!overtime && overtimeAt >= 2600 && overtimeAt <= 5200 && overtime.seconds === 2,
    { overtimeAt, overtime }
  );

  const end = await a.waitType('roundEnd', { from: fromA, timeout: 6000 });
  const endAt = Date.now() - t0;
  ok(
    '加时 2 秒后按平局结束',
    !!end && end.draw === true && end.winnerTeam === -1 && end.reason === 'time',
    end
  );
  ok('回合计时（3+2 秒）到点自动结束', endAt >= 4500 && endAt <= 8000, { endAt });
  // 两个 WebSocket 的投递顺序不保证，等 B 收到同一个事件再断言
  const endB = await b.waitType('roundEnd', { from: fromB, timeout: 3000 });
  ok('同房双方都收到 roundEnd', !!endB && endB.teams[0] === end.teams[0] && endB.teams[1] === end.teams[1], endB);

  const start = await a.waitFor((m) => m.t === 'roundStart' && m.mapId === 'depot', {
    from: fromA,
    timeout: 5000,
  });
  ok('投票换图后 roundStart 携带新地图', !!start, start);
  const startB = await b.waitFor((m) => m.t === 'roundStart' && m.mapId === 'depot', {
    from: fromB,
    timeout: 5000,
  });
  ok('同房双方都收到同一次 roundStart', !!startB);

  const leaveIds = a.msgs.filter((m) => m.t === 'leave').map((m) => m.id);
  ok('换图过程中无人被踢出房间', !leaveIds.includes(wa.id) && !leaveIds.includes(wb.id), leaveIds);

  const fromB2 = b.msgs.length;
  const c = await Client.connect(port);
  // 故意上报旧地图 harbor：房间已有状态是 depot，地图不应进入房间键
  c.join({ name: '晚到丙', room, map: 'harbor', mode: 'tdm' });
  const wc = await c.waitType('welcome');
  ok(
    '同 room@mode 换图后新玩家仍进同一房间',
    wc.roomKey === room + '@tdm' && wc.mapId === 'depot' && wc.players.length === 3,
    { roomKey: wc.roomKey, mapId: wc.mapId, players: wc.players.length }
  );
  const joinMsg = await b.waitType('join', { from: fromB2, timeout: 3000 });
  ok('原玩家收到新玩家 join 广播', joinMsg.player.id === wc.id);
  ok(
    '晚到玩家看到原房间两人',
    wc.players.some((p) => p.id === wa.id) && wc.players.some((p) => p.id === wb.id)
  );

  // 同一 roomId 不同 mode 应是不同房间，新房间按 join.map 选初始地图
  const d = await Client.connect(port);
  d.join({ name: '乱斗丁', room, map: 'harbor', mode: 'chaos' });
  const wd = await d.waitType('welcome');
  ok(
    'mode 参与房间键：同名 chaos 为独立房间并按 map 选初始图',
    wd.roomKey === room + '@chaos' && wd.mode === 'chaos' && wd.mapId === 'harbor' && wd.players.length === 1,
    { roomKey: wd.roomKey, mode: wd.mode, mapId: wd.mapId, players: wd.players.length }
  );

  for (const cl of [a, b, c, d]) cl.close();
}

async function testTeamBalance(port) {
  const room = 'tm-' + Date.now().toString(36);
  const formed = [];
  for (let i = 0; i < 4; i++) {
    const c = await Client.connect(port);
    c.join({ name: '队' + i, room });
    const w = await c.waitType('welcome');
    formed.push({ c, w });
  }
  const teams = formed.map((x) => x.w.team);
  ok(
    '4 人自动分成 2v2',
    teams.filter((t) => t === 0).length === 2 && teams.filter((t) => t === 1).length === 2,
    teams
  );

  const evil = await Client.connect(port);
  evil.join({ name: '恶意', room, team: 1 });
  const we = await evil.waitType('welcome');
  ok('普通玩家上报的 team 被忽略（分到人少/均衡的一队）', we.team === 0, we.team);

  let from = evil.msgs.length;
  await sleep(250);
  const snap = await evil.waitType('snap', { from, timeout: 3000 });
  const counts = countTeams(snap.players);
  ok('加入后两队人数差 <= 1', Math.abs(counts[0] - counts[1]) <= 1, counts);

  // 从 2v2 + 新加入者(team0) = 3v2 中，关掉一个 team1 -> 3v1，服务器应把最新加入者移到 team1
  const team1 = formed.find((x) => x.w.team === 1);
  from = evil.msgs.length;
  team1.c.close();
  const leaveMsg = await evil.waitType('leave', { from, timeout: 3000 });
  ok('离开广播正常', leaveMsg.id === team1.w.id, leaveMsg);
  const change = await evil.waitType('teamChange', { from, timeout: 3000 });
  ok('离开后立即重平衡（teamChange）', !!change && change.id === we.id && change.team === 1, change);

  from = evil.msgs.length;
  await sleep(200);
  const snap2 = await evil.waitType('snap', { from, timeout: 3000 });
  const counts2 = countTeams(snap2.players);
  ok('重平衡后两队人数差 <= 1', Math.abs(counts2[0] - counts2[1]) <= 1, counts2);

  for (const x of formed) x.c.close();
  evil.close();
}

async function testDevToken(port) {
  const token = 'wp32-dev-token';
  const room = 'tk-' + Date.now().toString(36);
  const a = await Client.connect(port);
  a.join({ name: '令牌甲', room, team: 1, token });
  const welcome = await a.waitType('welcome');
  ok('配置 token 后 dev join 可指定队伍', welcome.team === 1, welcome.team);

  let from = a.msgs.length;
  a.send({ t: 'dev', cmd: 'tp', token: 'bad-token', x: 2, z: 3 });
  const bad = await a.waitType('error', { from, timeout: 3000 });
  ok('配置 token 后错误 token 仍被拒绝', !!bad && bad.code === 'dev_denied', bad);

  from = a.msgs.length;
  a.send({ t: 'dev', cmd: 'tp', token, x: 2, z: 3 });
  // dev 消息与已排队的快照可能交叉；等到“反映传送后位置”的快照，避免取到传送前的旧帧。
  let self = null;
  try {
    const snap = await a.waitFor(
      (m) => m.t === 'snap' && m.players.some(
        (q) => q.id === welcome.id && Math.abs(q.x - 2) < 0.6 && Math.abs(q.z - 3) < 0.6
      ),
      { from, timeout: 3000 }
    );
    self = snap.players.find((q) => q.id === welcome.id);
  } catch {
    const last = [...a.msgs].reverse().find((m) => m.t === 'snap');
    self = last && last.players.find((q) => q.id === welcome.id);
  }
  ok(
    '匹配 token 的 dev tp 生效（使用玩家所在房间世界）',
    !!self && Math.abs(self.x - 2) < 0.6 && Math.abs(self.z - 3) < 0.6,
    self && { x: self.x, z: self.z }
  );
  a.close();
}

async function main() {
  let server = null;
  let tokenServer = null;
  try {
    server = await startServer();
    const health = await httpJson(server.port, '/healthz');
    ok('服务器在随机端口启动且 /healthz 正常', !!health && health.ok === true, health && health.ok);

    await testDevBackdoor(server.port);
    await testNames(server.port);
    await testRoundAndRoomKey(server.port);
    await testTeamBalance(server.port);

    // 正向路径：显式配置 token 后 dev 才应生效
    tokenServer = await startServer({ MP_DEV_TOKEN: 'wp32-dev-token' });
    await testDevToken(tokenServer.port);
  } catch (e) {
    fail++;
    console.error('FAIL · 测试异常：' + (e && e.stack ? e.stack : e));
  } finally {
    for (const c of Array.from(clients)) c.close();
    if (fail && server) {
      console.error('--- server log (tail) ---');
      console.error(server.log().split('\n').slice(-60).join('\n'));
    }
    if (fail && tokenServer) {
      console.error('--- token server log (tail) ---');
      console.error(tokenServer.log().split('\n').slice(-40).join('\n'));
    }
    await stopServer(server);
    await stopServer(tokenServer);
  }
  console.log(fail ? fail + ' 项失败 / ' + (pass + fail) + ' 项' : '全部通过（' + pass + ' 项）');
  process.exit(fail ? 1 : 0);
}

main();
