#!/usr/bin/env node
'use strict';
/**
 * server/test_net2.cjs — V37 联机协议 2.0 与服务端质量修复验收
 *
 * 本地随机端口启动子进程，使用 JSON 与二进制两组 ws 客户端覆盖：
 *   协议 2.0 / caps:['bin'] / 二进制快照 / 增量 / seq-ack / 输入回放
 *   权威射速、弹药、换弹、逐武器伤害、霰弹、衰减、护甲、爆头
 *   延迟补偿、warmup 不计分、domination 据点得分、bot 补位/开火
 *   V37：逐客户端 ACK、蹲下/换枪增量、真实 RTT 回滚、respawn/roundStart 武器字段、
 *   roundEnd 据点分、未知模式报错、命令队列溢出、500ms 无输入停走、全 bin 不序列化 JSON、
 *   METRICS_TOKEN/healthz 明细/CORS、Profile 异步串行写
 *   Origin/名字/房间/模式白名单、PROFILE_TOKEN、消息大小与速率
 *   /healthz、/metrics、/api/profile + profiles.json 原子写 + 击杀 XP
 *
 * 用法：node server/test_net2.cjs
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
const SALT_NET = require('../packages/net/protocol.js');

const SERVER = path.join(__dirname, 'server.cjs');
const DEV = 'net2-dev-token';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clients = new Set();
let pass = 0;
let fail = 0;
let seqCounter = 1;

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
            resolve({ status: res.statusCode, json: JSON.parse(body), text: body, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, json: null, text: body, headers: res.headers });
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

function httpText(port, pathname, opts) {
  return new Promise((resolve) => {
    const req = http.get(Object.assign({ host: '127.0.0.1', port, path: pathname, timeout: 1500 }, opts || {}), (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, text: body, headers: res.headers }));
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
  const profileFile = path.join(os.tmpdir(), 'saltline-profiles-' + process.pid + '-' + port + '.json');
  const env = Object.assign(
    {
      PORT: String(port),
      HOST: '127.0.0.1',
      MP_DEV_TOKEN: DEV,
      WARMUP_SECONDS: '0',
      ROUND_SECONDS: '300',
      SCORE_LIMIT: '50',
      RESPAWN_MS: '300',
      BOTS: '0',
      DOM_CAPTURE_SECONDS: '1',
      DOM_SCORE_INTERVAL_MS: '250',
      DOM_SCORE_LIMIT: '20',
      PROFILES_FILE: profileFile,
      LOG_JSON: '1',
    },
    extraEnv || {}
  );
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
      return { port, child, log: () => log, profileFile, env };
    }
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
    await Promise.race([once(child, 'exit'), sleep(2500)]);
  }
  if (child.exitCode === null) child.kill('SIGKILL');
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function metricValue(port, name, pathname) {
  const res = await httpText(port, pathname || '/metrics');
  if (!res || res.status !== 200) return NaN;
  const line = res.text.split('\n').find((l) => l.startsWith(name + ' '));
  return line ? Number(line.slice(name.length + 1)) : NaN;
}

class Client {
  constructor(ws, tag) {
    this.ws = ws;
    this.tag = tag || 'c';
    this.msgs = [];
    this.snaps = [];
    this.frames = [];
    this.acks = [];
    this.pongDelay = 0;
    this.binState = new Map();
    this.nidMap = new Map();
    this.welcome = null;
    this.seq = 0;
    this.closed = null;
    this.waiters = new Set();
    clients.add(this);
    ws.on('ping', (data) => {
      // 仅当 autoPong:false 时手动延迟回 pong，用于模拟真实网络 RTT。
      if (this.pongDelay > 0) {
        setTimeout(() => {
          try { ws.pong(data); } catch { /* noop */ }
        }, this.pongDelay);
      }
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary || (Buffer.isBuffer(data) && data.length && (data[0] === SALT_NET.OP.SNAP || data[0] === SALT_NET.OP.ACK))) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length && buf[0] === SALT_NET.OP.ACK) {
          const ack = SALT_NET.decodeAck(toArrayBuffer(buf));
          if (ack) {
            ack.at = Date.now();
            ack.bytes = buf.byteLength;
            this.acks.push(ack);
          }
          return;
        }
        const dec = SALT_NET.decodeSnapshot(toArrayBuffer(buf));
        if (!dec) return;
        if (dec.baseline === 0) this.binState = new Map();
        for (const q of dec.players) {
          const sid = this.nidMap.get(q.id) || String(q.id);
          this.binState.set(sid, q);
        }
        dec.at = Date.now();
        dec.bytes = buf.byteLength;
        this.frames.push(dec);
        return;
      }
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      this.msgs.push(msg);
      if (msg.t === 'snap') this.snaps.push(msg);
      if (msg.t === 'welcome') {
        this.welcome = msg;
        for (const p of msg.players || []) if (p.nid != null) this.nidMap.set(p.nid, p.id);
      }
      for (const w of Array.from(this.waiters)) {
        if (w.pred(msg)) {
          this.waiters.delete(w);
          clearTimeout(w.timer);
          w.resolve(msg);
        }
      }
    });
    ws.on('error', () => {});
    ws.on('close', (code, reason) => {
      this.closed = { code, reason: String(reason || '') };
    });
  }

  static connect(port, opts) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://127.0.0.1:' + port, opts || {});
      const c = new Client(ws, (opts && opts.tag) || 'c');
      c.pongDelay = (opts && opts.pongDelay) || 0;
      let settled = false;
      ws.once('open', () => {
        settled = true;
        resolve(c);
      });
      ws.once('error', (e) => {
        if (!settled) reject(e);
      });
      ws.once('unexpected-response', (req, res) => {
        if (!settled) {
          settled = true;
          resolve({ rejected: true, status: res.statusCode, close() {} });
        }
      });
    });
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  sendBinary(buf) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(Buffer.from(buf), { binary: true });
    return true;
  }

  async join(payload, timeout) {
    this.send(Object.assign({ t: 'join' }, payload || {}));
    this.welcome = await this.waitType('welcome', { timeout: timeout || 5000 });
    return this.welcome;
  }

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
        const tail = this.msgs.slice(-6).map((m) => m.t);
        reject(new Error('等待消息超时；最近 ' + JSON.stringify(tail)));
      }, timeout);
      this.waiters.add(w);
    });
  }

  waitType(type, opts) {
    return this.waitFor((m) => m.t === type, opts);
  }

  lastSnapPlayer(id) {
    for (let i = this.snaps.length - 1; i >= 0; i--) {
      const p = this.snaps[i].players.find((q) => q.id === id);
      if (p) return p;
    }
    return this.binState.get(id) || null;
  }

  latestFrames(n) {
    return this.frames.slice(-(n || 1));
  }

  clear() {
    this.msgs.length = 0;
    this.snaps.length = 0;
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

function aimFrom(eye, target) {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return {
    yaw,
    pitch,
    dir: {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch),
    },
  };
}

function eyeAt(pos) {
  return { x: pos.x, y: pos.y + (pos.crouch ? 1.05 : 1.68), z: pos.z };
}

async function setAimAndFire(c, me, target, loadoutWeapon, opts) {
  opts = opts || {};
  const aim = aimFrom(eyeAt(me), target);
  c.send({
    t: 'input',
    seq: ++c.seq,
    move: { x: 0, y: 0 },
    yaw: aim.yaw,
    pitch: aim.pitch,
    buttons: opts.fireButton ? 1 : 0,
  });
  await sleep(opts.aimWait == null ? 70 : opts.aimWait);
  const from = c.msgs.length;
  c.send({ t: 'fire', wpn: loadoutWeapon, dir: aim.dir });
  return { aim, from };
}

async function combatPair(server, labels, opts) {
  opts = opts || {};
  const room = 'r' + Math.random().toString(36).slice(2, 10);
  const A = await Client.connect(server.port, {
    tag: 'A',
    autoPong: opts.aPongDelay == null,
    pongDelay: opts.aPongDelay || 0,
  });
  const B = await Client.connect(server.port, { tag: 'B' });
  const wa = await A.join({
    name: '射手',
    room,
    team: 0,
    token: DEV,
    loadout: { primary: opts.aWeapon || 'pac9' },
    profileToken: opts.profileToken,
  });
  const wb = await B.join({
    name: '靶子',
    room,
    team: 1,
    token: DEV,
    loadout: { primary: opts.bWeapon || 'pac9' },
  });
  const ax = opts.ax == null ? -10 : opts.ax;
  const az = opts.az == null ? -9 : opts.az;
  const bx = opts.bx == null ? 0 : opts.bx;
  const bz = opts.bz == null ? -9 : opts.bz;
  A.send({ t: 'dev', cmd: 'tp', token: DEV, x: ax, z: az });
  B.send({ t: 'dev', cmd: 'tp', token: DEV, x: bx, z: bz });
  await sleep(opts.settle == null ? 220 : opts.settle);
  return { A, B, wa, wb, room, ax, az, bx, bz };
}

function closePair(pair) {
  if (!pair) return;
  pair.A.close();
  pair.B.close();
}

// ---------------------------------------------------------------------------
// 协议 / 输入回放
// ---------------------------------------------------------------------------
async function testProtocolAndInput(server) {
  const port = server.port;
  const health = await httpJson(port, '/healthz');
  ok(
    'healthz 扩展：协议 2 / 60Hz 模拟 / 30Hz 快照',
    !!health && health.json.protocol === 2 && health.json.tickRate === 60 && health.json.snapRate === 30,
    health && health.json
  );

  const metricsBefore = await httpText(port, '/metrics');
  const mtext = metricsBefore ? metricsBefore.text : '';
  const metric = (name) => {
    const line = mtext.split('\n').find((l) => l.startsWith(name + ' '));
    return line ? Number(line.slice(name.length + 1)) : NaN;
  };
  ok(
    '/metrics 文本含 tick_ms / snap_kbps / players / rooms / lagcomp_hits',
    !!metricsBefore &&
      metricsBefore.status === 200 &&
      Number.isFinite(metric('saltline_tick_ms')) &&
      Number.isFinite(metric('saltline_snap_kbps')) &&
      Number.isFinite(metric('saltline_players')) &&
      Number.isFinite(metric('saltline_rooms')) &&
      Number.isFinite(metric('saltline_lagcomp_hits')),
    mtext.slice(0, 120)
  );

  const bin = await Client.connect(port, { tag: 'bin' });
  const wb = await bin.join({ name: '二进制猫', room: 'bin-' + Date.now().toString(36), caps: ['bin'] });
  ok(
    'join caps:[\'bin\'] 返回 binary:true / caps 含 bin',
    !!wb && wb.binary === true && Array.isArray(wb.caps) && wb.caps.includes('bin') && wb.protocol === 2,
    wb && { binary: wb.binary, caps: wb.caps, protocol: wb.protocol }
  );
  ok(
    'welcome.weapons 暴露六把武器表（pac9/smg/dmr/lmg/breaker12/sidearm）',
    !!wb &&
      Array.isArray(wb.weapons) &&
      wb.weapons.length === 6 &&
      ['pac9', 'smg', 'dmr', 'lmg', 'breaker12', 'sidearm'].every((id) => wb.weapons.includes(id)),
    wb && wb.weapons
  );

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && bin.frames.length < 2) await sleep(40);
  const first = bin.frames[0];
  ok(
    '二进制快照可被 SALT_NET.decodeSnapshot 解码',
    !!first && Number.isFinite(first.tick) && Array.isArray(first.players) && first.players.length === 1,
    first && { tick: first.tick, n: first.players.length }
  );
  ok('首个二进制快照为全量 baseline=0', !!first && first.baseline === 0, first && first.baseline);

  // 静置等待增量帧
  await sleep(320);
  const delta = bin.frames.find((f) => f.baseline > 0 && f.players.length === 0);
  const anyDelta = bin.frames.find((f) => f.baseline > 0);
  ok(
    '二进制快照按玩家变更增量（静置时 delta 帧 count=0）',
    !!anyDelta && !!delta,
    { frames: bin.frames.slice(-6).map((f) => ({ t: f.tick, b: f.baseline, n: f.players.length })) }
  );

  // 二进制输入：传送到空旷带，向 +X 移动
  bin.send({ t: 'dev', cmd: 'tp', token: DEV, x: -10, z: -9 });
  await sleep(150);
  const before = bin.lastSnapPlayer(wb.id);
  let seq = 0;
  for (let i = 0; i < 48; i++) {
    bin.sendBinary(
      SALT_NET.encodeInput({
        seq: ++seq,
        tick: seq,
        mx: 0,
        my: 1,
        yaw: -Math.PI / 2 + Math.PI * 2,
        pitch: 0,
        buttons: 0,
        slot: 0,
      })
    );
    await sleep(16);
  }
  await sleep(250);
  const after = bin.lastSnapPlayer(wb.id);
  ok(
    '二进制输入被服务器消费并驱动权威移动（位移 > 0.5m）',
    !!before && !!after && Math.hypot(after.x - before.x, after.z - before.z) > 0.5,
    before && after && { before: [before.x, before.z], after: [after.x, after.z] }
  );
  const ackFrame = bin.frames[bin.frames.length - 1];
  ok(
    '二进制快照携带 ack seq（玩家 seq 字节递增）',
    !!ackFrame && ackFrame.players.length > 0 && ackFrame.players[0].seq === seq % 256,
    ackFrame && { ack: ackFrame.players[0].seq, sent: seq }
  );

  // V37：ACK 独立小帧，每个 30Hz 快照 tick 一封，seq 为已模拟到的命令。
  const ackDeadline = Date.now() + 600;
  while (Date.now() < ackDeadline && bin.acks.length < 12) await sleep(40);
  const ackList = bin.acks.slice();
  const lastAck = ackList[ackList.length - 1];
  ok(
    '二进制 ACK 小帧可解码且按 30Hz 持续发送（>=10 帧）',
    ackList.length >= 10 && ackList.every((a) => a.bytes === 10 && Number.isFinite(a.tick) && Number.isFinite(a.seq)),
    { count: ackList.length, last: lastAck }
  );
  const ackTicks = ackList.slice(-6).map((a) => a.tick);
  const tickAscending = ackTicks.every((v, i) => i === 0 || v > ackTicks[i - 1]);
  ok(
    'ACK tick 递增且 seq 追平最后已模拟输入',
    !!lastAck && tickAscending && lastAck.seq >= seq,
    { ackTicks, lastAck, sent: seq }
  );
  bin.close();

  // 旧 JSON 客户端：完整快照与输入仍兼容
  const json = await Client.connect(port, { tag: 'json' });
  const wj = await json.join({ name: 'JSON猫', room: 'json-' + Date.now().toString(36) });
  await sleep(250);
  const jsnap = json.snaps[json.snaps.length - 1];
  const self = jsnap && jsnap.players.find((p) => p.id === wj.id);
  ok(
    '旧 JSON 客户端仍收到完整 JSON snap（id 为字符串）',
    !!jsnap && !!self && typeof self.id === 'string' && Number.isFinite(self.x) && Number.isFinite(self.yaw),
    jsnap && { tick: jsnap.tick, players: jsnap.players.length }
  );
  const jbefore = { x: self.x, z: self.z };
  json.send({ t: 'input', seq: 1, move: { x: 1, y: 0 }, yaw: 0, pitch: 0 });
  await sleep(220);
  const jself = json.lastSnapPlayer(wj.id);
  ok(
    '旧 JSON 输入仍驱动移动（move.x 向右）',
    !!jself && Math.hypot(jself.x - jbefore.x, jself.z - jbefore.z) > 0.15,
    jself && { before: jbefore, after: { x: jself.x, z: jself.z } }
  );
  ok('JSON 客户端不收到二进制 ACK 帧（仍用 snap.seq/ack）', json.acks.length === 0, { acks: json.acks.length });

  // seq 去重 / 乱序
  json.clear();
  for (let i = 0; i < 8; i++) {
    json.send({ t: 'input', seq: 100 + i, move: { x: 0, y: 1 }, yaw: 0, pitch: 0 });
    await sleep(18);
  }
  await sleep(120);
  const ackSnap = json.snaps[json.snaps.length - 1];
  const ackSelf = ackSnap.players.find((p) => p.id === wj.id);
  ok('快照 ack/seq 推进到最新已模拟命令', !!ackSelf && ackSelf.ack >= 107, ackSelf && ackSelf.ack);
  const ackBefore = ackSelf.ack;
  json.send({ t: 'input', seq: 5, move: { x: 0, y: -1 }, yaw: 0, pitch: 0 });
  await sleep(180);
  const ackSnap2 = json.snaps[json.snaps.length - 1];
  const ackSelf2 = ackSnap2.players.find((p) => p.id === wj.id);
  ok(
    '乱序/重复 seq 被丢弃，ack 不倒退',
    !!ackSelf2 && ackSelf2.ack >= ackBefore,
    { before: ackBefore, after: ackSelf2 && ackSelf2.ack }
  );

  // 无命令：移动轴重复、按钮归零（不会持续开火）
  const starve = await Client.connect(port, { tag: 'starve' });
  const ws2 = await starve.join({ name: '饥饿猫', room: 'starve-' + Date.now().toString(36), loadout: { primary: 'pac9' } });
  starve.send({ t: 'dev', cmd: 'tp', token: DEV, x: 20, z: -9 });
  await sleep(150);
  starve.clear();
  starve.send({ t: 'input', seq: 1, move: { x: 0, y: 1 }, yaw: 0, pitch: 0, buttons: 1 });
  await sleep(90);
  const s1 = starve.lastSnapPlayer(ws2.id);
  const mag1 = s1 && s1.mag;
  await sleep(250);
  const s2 = starve.lastSnapPlayer(ws2.id);
  ok(
    '500ms 内无命令时重复移动轴且 buttons=0（弹药不再减少）',
    !!s1 && !!s2 && Math.hypot(s2.x - s1.x, s2.z - s1.z) > 0.12 && s2.mag === mag1,
    { s1: s1 && { x: s1.x, z: s1.z, mag: s1.mag }, s2: s2 && { x: s2.x, z: s2.z, mag: s2.mag } }
  );
  // V37：超过 500ms 无输入后移动轴清零，避免掉线滑行。
  await sleep(420);
  const s3 = starve.lastSnapPlayer(ws2.id);
  await sleep(260);
  const s4 = starve.lastSnapPlayer(ws2.id);
  const idleMove = s3 && s4 ? Math.hypot(s4.x - s3.x, s4.z - s3.z) : Infinity;
  ok(
    '500ms 无输入后移动轴清零并停走（保留视角）',
    !!s3 && !!s4 && idleMove < 0.08,
    s3 && s4 && { idleMove, s3: { x: s3.x, z: s3.z }, s4: { x: s4.x, z: s4.z } }
  );
  starve.close();
  json.close();
}

// ---------------------------------------------------------------------------
// SRV-8 模拟时钟
// ---------------------------------------------------------------------------
async function testSimClock(server) {
  const h1 = await httpJson(server.port, '/healthz');
  await sleep(260);
  const h2 = await httpJson(server.port, '/healthz');
  const tickRate = h1 && h1.json && h1.json.tickRate;
  const dTick = h2 && h1 ? h2.json.tick - h1.json.tick : -1;
  const dSim = h2 && h1 ? h2.json.simTimeMs - h1.json.simTimeMs : -1;
  ok(
    'SRV-8 模拟时钟 = tick × (1000/tickRate)，且随 tick 递进',
    !!h1 && !!h2 && tickRate === 60 && dTick > 0 &&
      Math.abs(dSim - dTick * (1000 / tickRate)) < 0.05 &&
      Math.abs(h2.json.simTimeMs - h2.json.tick * (1000 / tickRate)) < 0.05,
    h1 && h2 && { dTick, dSim, simTime: h2.json.simTimeMs, tick: h2.json.tick }
  );
  ok(
    'SRV-8 真实世界时钟保留 Date.now（simTimeMs 不是 epoch 毫秒）',
    !!h2 && h2.json.realTimeMs > 1.5e12 && h2.json.simTimeMs < h2.json.realTimeMs,
    h2 && { real: h2.json.realTimeMs, sim: h2.json.simTimeMs }
  );

  // 负载下仍能完成换弹并再次开火：模拟时钟逐步推进，射速/换弹不会挤在同一时间戳。
  const pair = await combatPair(server, 'simclock');
  try {
    const aim = aimFrom(eyeAt({ x: pair.ax, y: 0, z: pair.az }), { x: pair.bx, y: 0.85, z: pair.bz });
    pair.A.send({ t: 'input', seq: ++pair.A.seq, move: { x: 0, y: 0 }, yaw: aim.yaw, pitch: aim.pitch });
    await sleep(120);
    pair.A.send({ t: 'fire', wpn: 'pac9', dir: aim.dir });
    const first = await pair.A.waitType('fire', { from: 0, timeout: 1200 }).catch(() => null);
    // 120 条命令（15 条消息 × 8）制造有界追赶负载。
    for (let m = 0; m < 15; m++) {
      const cmds = [];
      for (let k = 0; k < 8; k++) {
        cmds.push({ seq: ++pair.A.seq, move: { x: 0, y: 0 }, yaw: aim.yaw, pitch: aim.pitch, buttons: 0 });
      }
      pair.A.send({ t: 'input', cmds });
      await sleep(2);
    }
    pair.A.send({ t: 'reload' });
    const done = await pair.A.waitType('reloadDone', { from: 0, timeout: 4500 }).catch(() => null);
    ok(
      'SRV-8 追赶负载下换弹按模拟时钟完成（不因 Date.now 混用丢失）',
      !!first && !!done && done.mag === 30 && done.wpn === 'pac9',
      { first: !!first, done: done && { mag: done.mag, wpn: done.wpn } }
    );
    pair.A.clear();
    pair.A.send({ t: 'fire', wpn: 'pac9', dir: aim.dir });
    const again = await pair.A.waitType('fire', { from: 0, timeout: 1500 }).catch(() => null);
    ok('SRV-8 负载后再次开火被放行（射速计时随模拟时钟前进）', !!again, again && { ammo: again.ammo });
  } finally {
    closePair(pair);
  }
}

// ---------------------------------------------------------------------------
// 权威战斗
// ---------------------------------------------------------------------------
async function testCombat(server, profileToken) {
  // 射速 + 弹药 + 换弹
  let pair = await combatPair(server, 'rate');
  let { A, B, wa, wb } = pair;
  let aim = aimFrom(eyeAt({ x: pair.ax, y: 0, z: pair.az }), { x: pair.bx, y: 0.85, z: pair.bz });
  A.send({ t: 'input', seq: ++A.seq, move: { x: 0, y: 0 }, yaw: aim.yaw, pitch: aim.pitch });
  await sleep(90);
  A.clear();
  for (let i = 0; i < 15; i++) {
    A.send({ t: 'fire', wpn: 'pac9', dir: aim.dir });
    await sleep(4);
  }
  await sleep(250);
  let accepted = A.msgs.filter((m) => m.t === 'fire' && m.by === wa.id).length;
  let rateRej = A.msgs.filter((m) => m.t === 'shotRejected' && m.reason === 'rate').length;
  ok(
    '权威射速：720rpm 步枪短时间连发只放行 <=2 发，其余 rate 拒绝',
    accepted <= 2 && rateRej >= 5,
    { accepted, rateRej }
  );
  closePair(pair);
  pair = await combatPair(server, 'ammo');
  ({ A, B, wa, wb } = pair);
  aim = aimFrom(eyeAt({ x: pair.ax, y: 0, z: pair.az }), { x: pair.bx, y: 0.85, z: pair.bz });
  await sleep(120);
  A.clear();
  await setAimAndFire(A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 0.85, z: pair.bz }, 'pac9');
  await sleep(120);
  const fire1 = A.msgs.find((m) => m.t === 'fire' && m.by === wa.id);
  ok('开火扣减弹匣（30 -> 29）', !!fire1 && fire1.ammo === 29, fire1 && fire1.ammo);
  A.clear();
  A.send({ t: 'reload' });
  await sleep(120);
  A.send({ t: 'fire', wpn: 'pac9', dir: aim.dir });
  const rejReload = await A.waitFor((m) => m.t === 'shotRejected' && m.reason === 'reloading', { from: 0, timeout: 1200 }).catch(() => null);
  ok('换弹期间开火被拒绝（reloading）', !!rejReload, rejReload);
  const done = await A.waitType('reloadDone', { from: 0, timeout: 4000 }).catch(() => null);
  ok(
    '换弹按武器表时长完成（mag 回满 30）',
    !!done && done.mag === 30 && done.wpn === 'pac9',
    done
  );

  // 武器 id / 方向校验
  A.clear();
  A.send({ t: 'fire', wpn: 'hacker', dir: aim.dir });
  const badW = await A.waitFor((m) => m.t === 'shotRejected' && m.reason === 'bad_weapon', { timeout: 1500 }).catch(() => null);
  ok('非法武器 id 被拒绝（bad_weapon）', !!badW, badW);
  A.clear();
  A.send({ t: 'fire', wpn: 'pac9', dir: { x: -aim.dir.x, y: -aim.dir.y, z: -aim.dir.z } });
  const badD = await A.waitFor((m) => m.t === 'shotRejected' && m.reason === 'aim_mismatch', { timeout: 1500 }).catch(() => null);
  ok('开火方向与命令视角不符被拒绝（aim_mismatch）', !!badD, badD);

  // 逐武器伤害：pac9 身体 / 头部
  pair.A.clear();
  const hitBody = await (async () => {
    const r = await setAimAndFire(pair.A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 0.85, z: pair.bz }, 'pac9');
    return pair.A.waitFor((m) => m.t === 'hit' && m.by === wa.id, { from: r.from, timeout: 2000 }).catch(() => null);
  })();
  ok(
    'pac9 身体伤害 26（10m 内未衰减）+ 护甲吸收 65%',
    !!hitBody && Math.abs(hitBody.raw - 26) < 0.6 && hitBody.absorbed > 0 && hitBody.armor < 50,
    hitBody && { raw: hitBody.raw, absorbed: hitBody.absorbed, armor: hitBody.armor }
  );
  const hitHead = await (async () => {
    await sleep(120);
    const r = await setAimAndFire(pair.A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 1.68, z: pair.bz }, 'pac9', { aimWait: 100 });
    return pair.A.waitFor((m) => m.t === 'hit' && m.by === wa.id, { from: r.from, timeout: 2000 }).catch(() => null);
  })();
  ok(
    '爆头倍率生效（pac9 headMul=2，raw≈52）',
    !!hitHead && hitHead.hs === true && hitHead.raw > 50 && hitHead.raw < 54,
    hitHead && { hs: hitHead.hs, raw: hitHead.raw, part: hitHead.part }
  );
  closePair(pair);

  // dmr 单发伤害
  pair = await combatPair(server, 'dmr', { aWeapon: 'dmr' });
  const dmrHit = await (async () => {
    const r = await setAimAndFire(pair.A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 0.85, z: pair.bz }, 'dmr');
    return pair.A.waitFor((m) => m.t === 'hit' && m.by === pair.wa.id, { from: r.from, timeout: 2000 }).catch(() => null);
  })();
  ok(
    '逐武器表：dmr 单发 62（10m 内）',
    !!dmrHit && dmrHit.wpn === 'dmr' && Math.abs(dmrHit.raw - 62) < 1,
    dmrHit && { wpn: dmrHit.wpn, raw: dmrHit.raw }
  );
  closePair(pair);

  // 霰弹多弹丸
  pair = await combatPair(server, 'sg', { aWeapon: 'breaker12' });
  pair.A.clear();
  const sgAim = aimFrom(eyeAt({ x: pair.ax, y: 0, z: pair.az }), { x: pair.bx, y: 0.9, z: pair.bz });
  pair.A.send({ t: 'input', seq: ++pair.A.seq, move: { x: 0, y: 0 }, yaw: sgAim.yaw, pitch: sgAim.pitch });
  await sleep(80);
  pair.A.send({ t: 'fire', wpn: 'breaker12', dir: sgAim.dir });
  await sleep(250);
  const sgFire = pair.A.msgs.find((m) => m.t === 'fire' && m.by === pair.wa.id);
  const sgHits = pair.A.msgs.filter((m) => m.t === 'hit' && m.by === pair.wa.id);
  ok(
    '霰弹枪一次 9 弹丸，多弹丸命中并结算（hits>=1）',
    !!sgFire && sgFire.pellets === 9 && sgFire.hits >= 1 && sgHits.length >= 1,
    sgFire && { pellets: sgFire.pellets, hits: sgFire.hits, hitEvents: sgHits.length }
  );
  closePair(pair);

  // 距离衰减：smg 近距离 vs 35m
  pair = await combatPair(server, 'falloff-close', { aWeapon: 'smg', bx: 0, bz: -9 });
  let closeHit = await (async () => {
    const r = await setAimAndFire(pair.A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 0.85, z: pair.bz }, 'smg');
    return pair.A.waitFor((m) => m.t === 'hit' && m.by === pair.wa.id, { from: r.from, timeout: 2000 }).catch(() => null);
  })();
  closePair(pair);
  pair = await combatPair(server, 'falloff-far', { aWeapon: 'smg', ax: -30, az: -9, bx: 5, bz: -9, settle: 260 });
  let farHit = await (async () => {
    const r = await setAimAndFire(pair.A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 0.85, z: pair.bz }, 'smg');
    return pair.A.waitFor((m) => m.t === 'hit' && m.by === pair.wa.id, { from: r.from, timeout: 2500 }).catch(() => null);
  })();
  ok(
    '距离衰减生效：smg 35m 伤害低于近距离',
    !!closeHit && !!farHit && farHit.raw < closeHit.raw * 0.85,
    { close: closeHit && closeHit.raw, far: farHit && farHit.raw }
  );
  closePair(pair);

  // 友军免伤
  {
    const room = 'ff-' + Date.now().toString(36);
    const A = await Client.connect(server.port, { tag: 'FF-A' });
    const C = await Client.connect(server.port, { tag: 'FF-C' });
    const wa2 = await A.join({ name: '友军甲', room, team: 0, token: DEV, loadout: { primary: 'pac9' } });
    await C.join({ name: '友军乙', room, team: 0, token: DEV, loadout: { primary: 'pac9' } });
    A.send({ t: 'dev', cmd: 'tp', token: DEV, x: -10, z: -9 });
    C.send({ t: 'dev', cmd: 'tp', token: DEV, x: 0, z: -9 });
    await sleep(200);
    A.clear();
    const r = await setAimAndFire(A, { x: -10, y: 0, z: -9 }, { x: 0, y: 0.85, z: -9 }, 'pac9');
    await sleep(200);
    const f = A.msgs.find((m) => m.t === 'fire' && m.by === wa2.id);
    const friendlyHit = A.msgs.find((m) => m.t === 'hit' && m.by === wa2.id);
    ok('友军免伤：同队射线不产生 hit', !!f && f.hits === 0 && !friendlyHit, f && { hits: f.hits, friendlyHit: !!friendlyHit });
    A.close();
    C.close();
  }

  // 击杀 -> 队分 + Profile XP
  pair = await combatPair(server, 'kill', { aWeapon: 'dmr', profileToken });
  pair.A.clear();
  let killed = null;
  for (let i = 0; i < 5 && !killed; i++) {
    await setAimAndFire(pair.A, { x: pair.ax, y: 0, z: pair.az }, { x: pair.bx, y: 0.85, z: pair.bz }, 'dmr', { aimWait: 70 });
    killed = await pair.A.waitFor((m) => m.t === 'kill' && m.by === pair.wa.id, { timeout: 900 }).catch(() => null);
    if (!killed) await sleep(180);
  }
  ok(
    '击杀广播带武器/距离/爆头标记，且计入队分',
    !!killed && killed.wpn === 'dmr' && Number.isFinite(killed.dist),
    killed
  );
  const scoreMsg = await pair.A.waitFor((m) => m.t === 'score' && (m.teams || [])[pair.wa.team] >= 1, { timeout: 2500 }).catch(() => null);
  ok(
    'live 状态击杀使队伍比分 +1',
    !!scoreMsg && scoreMsg.teams[pair.wa.team] >= 1,
    scoreMsg && scoreMsg.teams
  );
  const profAfter = await httpJson(server.port, '/api/profile?token=' + profileToken);
  ok(
    '联机击杀给 Profile 增加 XP',
    !!profAfter && profAfter.json && profAfter.json.ok && profAfter.json.profile.xp >= 20,
    profAfter && profAfter.json && profAfter.json.profile
  );
  closePair(pair);

  // 延迟补偿
  pair = await combatPair(server, 'lag', { aWeapon: 'dmr', ax: -24, az: -12, bx: -24, bz: -2, settle: 260 });
  pair.A.send({ t: 'ping', ts: Date.now() - 250 });
  await pair.A.waitType('pong', { timeout: 1500 }).catch(() => null);
  let mvSeq = 0;
  const mover = setInterval(() => {
    pair.B.send({ t: 'input', seq: ++mvSeq, move: { x: 0, y: 1 }, yaw: -Math.PI / 2, pitch: 0, sprint: true });
  }, 16);
  await sleep(820);
  clearInterval(mover);
  const hist = [];
  for (const s of pair.A.snaps) {
    const q = s.players.find((p) => p.id === pair.wb.id);
    if (q) hist.push({ t: s.ts, x: q.x, z: q.z });
  }
  function sampleAt(list, at) {
    if (!list.length) return null;
    if (at <= list[0].t) return list[0];
    if (at >= list[list.length - 1].t) return list[list.length - 1];
    let a = list[0];
    let b = list[list.length - 1];
    for (let i = 1; i < list.length; i++) {
      if (list[i].t >= at) {
        a = list[i - 1];
        b = list[i];
        break;
      }
    }
    const f = (at - a.t) / (b.t - a.t || 1);
    return { t: at, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
  }
  const oldPos = sampleAt(hist, Date.now() - 110);
  const curPos = hist[hist.length - 1];
  const moved = oldPos && curPos ? Math.hypot(oldPos.x - curPos.x, oldPos.z - curPos.z) : 0;
  let lagHit = null;
  if (oldPos) {
    const aim = aimFrom(eyeAt({ x: pair.ax, y: 0, z: pair.az }), { x: oldPos.x, y: 0.9, z: oldPos.z });
    pair.A.clear();
    // V53 NET-1：人控命令里的 FIRE 位不再开火；先让视角命令被消费，再走显式 t:'fire'。
    pair.A.send({ t: 'input', seq: ++pair.A.seq, move: { x: 0, y: 0 }, yaw: aim.yaw, pitch: aim.pitch, buttons: 0 });
    await sleep(30);
    pair.A.send({ t: 'fire', wpn: 'dmr', dir: aim.dir, shotSeq: 1 });
    lagHit = await pair.A.waitFor((m) => m.t === 'hit' && m.by === pair.wa.id, { timeout: 1500 }).catch(() => null);
  }
  ok(
    '延迟补偿：瞄准 125ms 前位置命中（lagcomp>0，历史位移 >0.3m）',
    moved > 0.3 && !!lagHit && lagHit.lagcomp >= 80,
    { moved, lagHit: lagHit && { dmg: lagHit.dmg, raw: lagHit.raw, lagcomp: lagHit.lagcomp, part: lagHit.part } }
  );
  const healthLag = await httpJson(server.port, '/healthz');
  ok(
    '/healthz metrics.lagcompHits >= 1',
    !!healthLag && healthLag.json.metrics.lagcompHits >= 1,
    healthLag && healthLag.json.metrics
  );
  closePair(pair);
}

// ---------------------------------------------------------------------------
// V53 NET-1：按住开火不再被处理两次（命令 FIRE 只给人控当“按着”状态，权威开火走显式 fire）
// ---------------------------------------------------------------------------
async function testHoldFire(server) {
  const room = 'holdfire-' + Date.now().toString(36);
  const c = await Client.connect(server.port, { tag: 'holdfire' });
  const w = await c.join({ name: '按住猫', room, team: 0, token: DEV, loadout: { primary: 'pac9' } });
  c.send({ t: 'dev', cmd: 'tp', token: DEV, x: -10, z: -9 });
  await sleep(220);

  const yaw = -Math.PI / 2;
  const dir = { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
  let seq = 0;

  // 旧客户端行为：命令里带 FIRE 位。V53 后服务端对人控只把它当输入状态，不再开火。
  c.clear();
  for (let i = 0; i < 30; i++) {
    c.send({ t: 'input', seq: ++seq, move: { x: 0, y: 0 }, yaw, pitch: 0, buttons: 1 });
    await sleep(16);
  }
  await sleep(220);
  const cmdOnlyFires = c.msgs.filter((m) => m.t === 'fire' && m.by === w.id);
  ok(
    'NET-1 人控命令 FIRE 位不再产生开火（按住状态不再双路径结算）',
    cmdOnlyFires.length === 0,
    { fires: cmdOnlyFires.length }
  );

  // 按住开火 2 秒：60Hz 命令流（带旧 FIRE 位）+ 720rpm 显式 fire 流。
  c.clear();
  const t0 = Date.now();
  let lastShotAt = 0;
  let sentShots = 0;
  while (Date.now() - t0 < 2000) {
    c.send({ t: 'input', seq: ++seq, move: { x: 0, y: 0 }, yaw, pitch: 0, buttons: 1 });
    const now = Date.now();
    if (now - lastShotAt >= 90) {
      lastShotAt = now;
      sentShots++;
      c.send({ t: 'fire', wpn: 'pac9', dir, shotSeq: sentShots });
    }
    await sleep(16);
  }
  await sleep(350);

  const fires = c.msgs.filter((m) => m.t === 'fire' && m.by === w.id);
  const rateRej = c.msgs.filter((m) => m.t === 'shotRejected' && m.reason === 'rate');
  const otherRej = c.msgs.filter((m) => m.t === 'shotRejected' && m.reason !== 'rate');
  const accepted = fires.length;
  ok(
    'NET-1 按住 2 秒：显式 fire 基本全放行（>=20 发，rate 拒绝 <=2）',
    accepted >= 20 && accepted <= 24 && rateRej.length <= 2,
    { sentShots, accepted, rateRej: rateRej.length, otherRej: otherRej.length }
  );
  const ammoSeq = fires.map((m) => m.ammo);
  const strictlyOnce = ammoSeq.length === accepted &&
    ammoSeq.every((v, i) => v === 30 - (i + 1));
  ok(
    'NET-1 每发只扣一次弹药（fire.ammo 严格 29,28,27...）',
    strictlyOnce,
    { ammoSeq: ammoSeq.slice(0, 8), accepted }
  );
  ok(
    'NET-1 开火事件数与显式 fire 条数一致（没有命令路径的额外枪）',
    accepted + rateRej.length + otherRej.length === sentShots,
    { accepted, rateRej: rateRej.length, otherRej: otherRej.length, sentShots }
  );
  const lastSnap = c.snaps[c.snaps.length - 1];
  const selfSnap = lastSnap && lastSnap.players.find((p) => p.id === w.id);
  console.log(
    '[NET-1] hold-fire 2s: sent=' + sentShots + ' accepted=' + accepted +
    ' rateRejected=' + rateRej.length + ' otherRejected=' + otherRej.length +
    ' finalMag=' + (selfSnap && selfSnap.mag) + ' ammoSeq=' + JSON.stringify(ammoSeq.slice(0, 5))
  );
  ok(
    'NET-1 客户端权威弹匣 = 30 - 放行发数（无双重扣减）',
    !!selfSnap && selfSnap.mag === 30 - accepted,
    selfSnap && { mag: selfSnap.mag, accepted }
  );

  // 拒绝消息契约：shotSeq + 当前 mag/reserve/wpn/slot。
  c.clear();
  const burst = [1001, 1002, 1003, 1004];
  for (const s of burst) c.send({ t: 'fire', wpn: 'pac9', dir, shotSeq: s });
  await sleep(260);
  const burstRej = c.msgs.filter((m) => m.t === 'shotRejected');
  ok(
    'NET-1 shotRejected 回带 shotSeq 与权威 mag/reserve/wpn/slot',
    burstRej.length >= 2 &&
      burstRej.every((m) => Number.isFinite(m.shotSeq) && burst.includes(m.shotSeq) &&
        Number.isFinite(m.mag) && Number.isFinite(m.reserve) &&
        typeof m.wpn === 'string' && Number.isFinite(m.slot)),
    burstRej.map((m) => ({ reason: m.reason, shotSeq: m.shotSeq, mag: m.mag, reserve: m.reserve }))
  );
  c.close();
}

// ---------------------------------------------------------------------------
// V37 质量修复：ACK / 增量触发 / 真实 RTT / respawn 弹药字段
// ---------------------------------------------------------------------------
async function testRealtimeV37(server) {
  const port = server.port;

  // 蹲下 / 换枪必须触发二进制增量（sameSnapshot 已包含 crouch/state）
  const room = 'delta-' + Date.now().toString(36);
  const actor = await Client.connect(port, { tag: 'delta-actor' });
  const waActor = await actor.join({
    name: '动作猫', room, team: 0, token: DEV,
    loadout: { primary: 'pac9', secondary: 'sidearm' },
  });
  const obs = await Client.connect(port, { tag: 'delta-bin' });
  const wObs = await obs.join({ name: '观察猫', room, team: 1, token: DEV, caps: ['bin'] });
  const actorInfo = (wObs.players || []).find((p) => p.id === waActor.id);
  const actorNid = actorInfo && actorInfo.nid;
  await sleep(200);
  const crouchFrom = obs.frames.length;
  for (let i = 0; i < 10; i++) {
    actor.send({ t: 'input', seq: ++actor.seq, move: { x: 0, y: 0 }, yaw: 0, pitch: 0, buttons: 16 });
    await sleep(28);
  }
  await sleep(150);
  const crouchFrame = obs.frames.slice(crouchFrom).find((f) => f.baseline > 0 && f.players.some((q) => q.id === actorNid && q.crouch === true));
  ok(
    '蹲下触发二进制增量帧（crouch=true 出现在 delta）',
    !!actorNid && !!crouchFrame,
    { actorNid, frames: obs.frames.slice(crouchFrom).slice(-4).map((f) => ({ b: f.baseline, n: f.players.length })) }
  );

  const switchFrom = obs.frames.length;
  actor.send({ t: 'switch', slot: 1 });
  const weaponEv = await obs.waitFor((m) => m.t === 'weapon' && m.id === waActor.id, { timeout: 1500 }).catch(() => null);
  const legacyEv = await obs.waitFor((m) => m.t === 'weaponSwitch' && m.id === waActor.id, { timeout: 500 }).catch(() => null);
  await sleep(200);
  const slotFrame = obs.frames.slice(switchFrom).find((f) => f.players.some((q) => q.id === actorNid && (q.state & 1) === 1));
  ok(
    '换枪广播统一 t:weapon 且携带 slot/wpn/mag/reserve',
    !!weaponEv && weaponEv.slot === 1 && typeof weaponEv.wpn === 'string' && Number.isFinite(weaponEv.mag) && Number.isFinite(weaponEv.reserve),
    weaponEv
  );
  ok('weaponSwitch 旧事件仍保留（兼容字段一致）', !!legacyEv && legacyEv.slot === weaponEv.slot && legacyEv.wpn === weaponEv.wpn, legacyEv && { slot: legacyEv.slot, wpn: legacyEv.wpn });
  ok('换枪触发二进制增量（state slot 位=1）', !!slotFrame, slotFrame && slotFrame.players.find((q) => q.id === actorNid));

  // roundStart 携带当前玩家两把枪的 slot/wpn/mag/reserve
  actor.send({ t: 'switch', slot: 0 });
  await sleep(140);
  actor.clear();
  actor.send({ t: 'dev', cmd: 'live', token: DEV });
  const rs = await actor.waitType('roundStart', { timeout: 1500 }).catch(() => null);
  ok(
    'roundStart 携带 slot/wpn/mag/reserve 与两把枪 slots',
    !!rs && rs.slot === 0 && rs.wpn === 'pac9' && rs.mag === 30 && Number.isFinite(rs.reserve) &&
      Array.isArray(rs.slots) && rs.slots.length === 2 && rs.slots[0].wpn === 'pac9' && rs.slots[1].wpn === 'sidearm',
    rs && { slot: rs.slot, wpn: rs.wpn, mag: rs.mag, reserve: rs.reserve, slots: rs.slots }
  );
  actor.close();
  obs.close();

  // 真实 RTT：客户端延迟 60ms 回 pong；回滚必须用服务端测量值，而非 ping.ts。
  const rttPair = await combatPair(server, 'rtt', { aPongDelay: 60, ax: -10, az: -9, bx: 0, bz: -9 });
  await sleep(2600);
  const scoreTail = rttPair.A.msgs.filter((m) => m.t === 'score').pop();
  const rttSelf = scoreTail && (scoreTail.players || []).find((p) => p.id === rttPair.wa.id);
  ok(
    'ws ping/pong 每 2 秒测得真实 RTT（score.ping >= 20ms）',
    !!rttSelf && rttSelf.ping >= 20,
    rttSelf && rttSelf.ping
  );
  rttPair.A.send({ t: 'ping', ts: Date.now() - 600 });
  const pongMsg = await rttPair.A.waitType('pong', { timeout: 1200 }).catch(() => null);
  ok(
    '客户端 ping.ts 仅用于显示：pong.clientRtt 保留自报，pong.rtt 为实测',
    !!pongMsg && pongMsg.clientRtt >= 500 && pongMsg.rtt >= 20 && pongMsg.rtt < 200,
    pongMsg && { rtt: pongMsg.rtt, clientRtt: pongMsg.clientRtt }
  );
  rttPair.A.clear();
  const rttShot = await setAimAndFire(rttPair.A, { x: rttPair.ax, y: 0, z: rttPair.az }, { x: rttPair.bx, y: 0.85, z: rttPair.bz }, 'pac9');
  const rttFire = await rttPair.A.waitFor((m) => m.t === 'fire' && m.by === rttPair.wa.id, { from: rttShot.from, timeout: 1500 }).catch(() => null);
  ok(
    'lagcomp rewind = clamp(RTT/2+100,0,250)，伪造 ping.ts 不放大回滚',
    !!rttFire && rttFire.lagcomp >= 110 && rttFire.lagcomp < 200,
    rttFire && { lagcomp: rttFire.lagcomp }
  );
  closePair(rttPair);

  // respawn 携带 slot/wpn/mag/reserve（两把枪都要有）
  const killPair = await combatPair(server, 'respawn', { aWeapon: 'dmr' });
  killPair.A.clear();
  let killed = null;
  for (let i = 0; i < 6 && !killed; i++) {
    await setAimAndFire(killPair.A, { x: killPair.ax, y: 0, z: killPair.az }, { x: killPair.bx, y: 0.85, z: killPair.bz }, 'dmr', { aimWait: 70 });
    killed = await killPair.A.waitFor((m) => m.t === 'kill' && m.by === killPair.wa.id, { timeout: 900 }).catch(() => null);
    if (!killed) await sleep(160);
  }
  const respawnMsg = await killPair.A.waitFor((m) => m.t === 'respawn' && m.id === killPair.wb.id, { timeout: 3500 }).catch(() => null);
  ok(
    'respawn 携带 slot/wpn/mag/reserve（含两把枪 slots，弹药回满）',
    !!respawnMsg && respawnMsg.slot === 0 && respawnMsg.wpn === 'pac9' && respawnMsg.mag === 30 &&
      Number.isFinite(respawnMsg.reserve) && Array.isArray(respawnMsg.slots) && respawnMsg.slots.length === 2 &&
      respawnMsg.slots[0].mag === 30 && respawnMsg.slots[1].wpn === 'sidearm',
    respawnMsg && { slot: respawnMsg.slot, wpn: respawnMsg.wpn, mag: respawnMsg.mag, reserve: respawnMsg.reserve, slots: respawnMsg.slots }
  );
  closePair(killPair);
}

// ---------------------------------------------------------------------------
// V53 NET-3：慢速漂移（0.0019rad/帧）不能连续 2 秒不更新
// ---------------------------------------------------------------------------
function angleDiff(a, b) {
  let d = (Number(a) || 0) - (Number(b) || 0);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

async function testSlowDrift(server) {
  const room = 'drift-' + Date.now().toString(36);
  const actor = await Client.connect(server.port, { tag: 'drift-actor' });
  const wa = await actor.join({ name: '慢漂猫', room, team: 0, token: DEV, loadout: { primary: 'pac9' } });
  const obs = await Client.connect(server.port, { tag: 'drift-bin' });
  const wObs = await obs.join({ name: '慢看猫', room, team: 1, token: DEV, caps: ['bin'] });
  const actorInfo = (wObs.players || []).find((p) => p.id === wa.id);
  const actorNid = actorInfo && actorInfo.nid;
  actor.send({ t: 'dev', cmd: 'tp', token: DEV, x: -10, z: -9 });
  await sleep(350);

  const forcedBefore = await metricValue(server.port, 'saltline_snap_forced_players');
  const from = obs.frames.length;
  const startAt = Date.now();
  let seq = 0;
  let yaw = 0;
  for (let i = 0; i < 60; i++) {
    yaw += 0.0019; // 每快照帧 < 协议 0.002rad 阈值，旧实现会被永久跳过
    actor.send({ t: 'input', seq: ++seq, move: { x: 0, y: 0 }, yaw, pitch: 0, buttons: 0 });
    await sleep(33);
  }
  const loopEnd = Date.now();
  await sleep(250);

  // 更新间隔按“任意包含该玩家的帧”计算（全量帧也是一次有效更新），
  // 但另外要求至少 2 个增量帧，证明不是只靠 2 秒一次的全量兜底。
  const actorFrames = obs.frames.slice(from).filter(
    (f) => actorNid != null && f.at <= loopEnd && f.players.some((q) => q.id === actorNid)
  );
  const deltaFrames = actorFrames.filter((f) => f.baseline > 0);
  const times = actorFrames.map((f) => f.at);
  let maxGap = 0;
  let prev = startAt;
  for (const t of times) {
    if (Number.isFinite(t) && t - prev > maxGap) maxGap = t - prev;
    if (Number.isFinite(t)) prev = t;
  }
  if (loopEnd - prev > maxGap) maxGap = loopEnd - prev;
  const final = obs.lastSnapPlayer(wa.id);
  const forcedAfter = await metricValue(server.port, 'saltline_snap_forced_players');
  console.log(
    '[NET-3] actorFrames=' + actorFrames.length + ' deltaFrames=' + deltaFrames.length +
    ' maxGapMs=' + Math.round(maxGap) + ' timesMs=' + JSON.stringify(times.map((t) => t - startAt)) +
    ' forced=' + forcedBefore + '->' + forcedAfter
  );

  ok(
    'NET-3 慢速旋转在 2 秒窗口内至少收到 2 个增量帧（不是只等 2 秒全量帧）',
    !!actorNid && deltaFrames.length >= 2,
    {
      actorNid,
      deltaFrames: deltaFrames.length,
      frames: obs.frames.slice(from).slice(-6).map((f) => ({ b: f.baseline, hasActor: f.players.some((q) => q.id === actorNid) })),
    }
  );
  ok(
    'NET-3 运动期间相邻两次更新间隔 <= 600ms（不会 2 秒不更新）',
    deltaFrames.length >= 2 && maxGap > 0 && maxGap <= 600,
    { maxGap, times: times.map((t) => t - startAt) }
  );
  ok(
    'NET-3 慢速旋转最终被客户端看到（yaw 变化 >= 0.03rad）',
    !!final && Math.abs(angleDiff(final.yaw, 0)) >= 0.03,
    final && { yaw: final.yaw, expected: 0.114 }
  );
  ok(
    'NET-3 强制包含计数增加（每接收者上次发送位姿跟踪生效）',
    Number.isFinite(forcedBefore) && Number.isFinite(forcedAfter) && forcedAfter > forcedBefore,
    { forcedBefore, forcedAfter }
  );
  actor.close();
  obs.close();
}

// ---------------------------------------------------------------------------
// 模式 / 状态机 / 机器人
// ---------------------------------------------------------------------------
async function testDomination(server) {
  const room = 'dom-' + Date.now().toString(36);
  const A = await Client.connect(server.port, { tag: 'dom' });
  const wa = await A.join({ name: '占点猫', room, mode: 'domination', team: 0, token: DEV, loadout: { primary: 'pac9' } });
  ok(
    'domination 房间有 3 个据点数据',
    Array.isArray(wa.map.domination) && wa.map.domination.length === 3,
    wa.map.domination
  );
  const pt = wa.map.domination[0];
  A.send({ t: 'dev', cmd: 'tp', token: DEV, x: pt.x, z: pt.z });
  const cap = await A.waitType('pointCaptured', { timeout: 5000 }).catch(() => null);
  ok(
    'domination 占点 1s 后广播 pointCaptured（owner=0）',
    !!cap && cap.owner === 0 && cap.id === pt.id,
    cap
  );
  const dom = await A.waitFor((m) => m.t === 'domination' && (m.teams || [])[0] >= 1, { timeout: 3000 }).catch(() => null);
  ok(
    'domination 每秒按据点得分（teams[0]>=1）',
    !!dom && dom.teams[0] >= 1,
    dom && { teams: dom.teams, points: dom.points }
  );
  const score = await A.waitFor((m) => m.t === 'score' && m.mode === 'domination' && (m.teams || [])[0] >= 1, { timeout: 2000 }).catch(() => null);
  ok(
    'domination 的 score 消息携带 state/points/比分',
    !!score && score.state === 'live' && Array.isArray(score.points) && score.teams[0] >= 1,
    score && { teams: score.teams, state: score.state }
  );
  // V37：roundEnd.teams 必须是据点分，击杀数另放 kills（本局 0 击杀）。
  const ended = (() => {
    A.send({ t: 'dev', cmd: 'round', token: DEV });
    return A.waitType('roundEnd', { timeout: 2500 }).catch(() => null);
  })();
  const roundEnd = await ended;
  ok(
    'roundEnd.teams 使用据点分（teams[0]>=1），击杀数放在 kills 且为 0',
    !!roundEnd && Array.isArray(roundEnd.teams) && roundEnd.teams[0] >= 1 &&
      Array.isArray(roundEnd.kills) && roundEnd.kills[0] === 0,
    roundEnd && { teams: roundEnd.teams, kills: roundEnd.kills, score: roundEnd.score }
  );
  A.close();
}

async function testWarmupAndBots(server) {
  const room = 'warm-' + Date.now().toString(36);
  const A = await Client.connect(server.port, { tag: 'warm' });
  const start = Date.now();
  const wa = await A.join({ name: '热身猫', room, team: 0, token: DEV });
  ok(
    'warmup 初始状态与 8 人目标（1 真人 + 7 机器人 = 4v4）',
    wa.state === 'warmup' &&
      wa.players.length === 8 &&
      wa.players.filter((p) => p.bot).length === 7 &&
      wa.players.filter((p) => p.team === 0).length === 4 &&
      wa.players.filter((p) => p.team === 1).length === 4,
    { state: wa.state, players: wa.players.length, bots: wa.players.filter((p) => p.bot).length }
  );
  ok(
    '机器人计分板可辨识（BOT 前缀 + bot:true）',
    wa.players.filter((p) => p.bot).every((p) => p.bot === true && p.name.startsWith('BOT-')),
    wa.players.filter((p) => p.bot).map((p) => p.name)
  );
  const warmScore = await A.waitFor((m) => m.t === 'score' && m.state === 'warmup', { timeout: 2500 }).catch(() => null);
  ok(
    'warmup 期间不计分（teams 保持 [0,0]）',
    !!warmScore && warmScore.teams[0] === 0 && warmScore.teams[1] === 0,
    warmScore && { teams: warmScore.teams, state: warmScore.state }
  );
  await sleep(600);
  const warmScore2 = A.msgs.filter((m) => m.t === 'score' && m.state === 'warmup').pop();
  ok(
    'warmup 机器人交火也不改变团队比分',
    !!warmScore2 && warmScore2.teams[0] === 0 && warmScore2.teams[1] === 0,
    warmScore2 && warmScore2.teams
  );

  const live = await A.waitFor((m) => m.t === 'score' && m.state === 'live', { timeout: 6000 }).catch(() => null);
  const warmMs = Date.now() - start;
  ok(
    'warmup(3s) 结束进入 live',
    !!live && warmMs >= 2500 && warmMs <= 6000,
    { warmMs, state: live && live.state }
  );

  // 机器人移动
  const pos0 = {};
  for (const p of wa.players) if (p.bot) pos0[p.id] = { x: p.x, z: p.z };
  await sleep(2800);
  const snap = A.snaps[A.snaps.length - 1];
  let moved = 0;
  if (snap) {
    for (const p of snap.players) {
      if (!p.bot || !pos0[p.id]) continue;
      if (Math.hypot(p.x - pos0[p.id].x, p.z - pos0[p.id].z) > 0.4) moved++;
    }
  }
  ok('机器人使用 sim 移动并离开出生点（>=2 个移动 >0.4m）', moved >= 2, { moved, bots: Object.keys(pos0).length });

  // 把真人送到 team1 机器人面前，验证开火
  A.send({ t: 'dev', cmd: 'tp', token: DEV, x: 19, z: 20.56 });
  const botFire = await A.waitFor((m) => m.t === 'fire' && m.bot === true, { timeout: 6000 }).catch(() => null);
  ok(
    '机器人有视线时开火（fire.bot=true）',
    !!botFire && botFire.wpn && botFire.ammo >= 0,
    botFire && { wpn: botFire.wpn, hits: botFire.hits, ammo: botFire.ammo }
  );
  const botHit = await A.waitFor((m) => m.t === 'hit' && m.bot === true, { timeout: 3000 }).catch(() => null);
  ok('机器人射击产生权威命中', !!botHit && !!botHit.victim, botHit && { victim: botHit.victim, dmg: botHit.dmg });

  // V53 NET-1：机器人仍用命令 FIRE 开火（botFire 已断言）；人控命令 FIRE 不再产生枪。
  A.send({ t: 'dev', cmd: 'tp', token: DEV, x: 19, z: 20.56 });
  const cmdFrom = A.msgs.length;
  for (let i = 0; i < 30; i++) {
    A.send({ t: 'input', seq: ++A.seq, move: { x: 0, y: 0 }, yaw: 0, pitch: 0, buttons: 1 });
    await sleep(16);
  }
  await sleep(250);
  const humanCmdFires = A.msgs.slice(cmdFrom).filter((m) => m.t === 'fire' && m.by === wa.id);
  ok(
    'NET-1 同一房间内：人控命令 FIRE 位 0 开火，机器人命令 FIRE 仍能开火',
    humanCmdFires.length === 0 && !!botFire,
    { humanCmdFires: humanCmdFires.length, botFire: !!botFire }
  );
  A.close();
}

// ---------------------------------------------------------------------------
// 安全
// ---------------------------------------------------------------------------
async function testSecurity(server) {
  const port = server.port;
  const evil = await Client.connect(port, { origin: 'https://evil.example' }).catch(() => null);
  ok(
    'Origin 白名单：未授权 Origin 被 403 拒绝',
    !!evil && evil.rejected === true && evil.status === 403,
    evil && { rejected: evil.rejected, status: evil.status }
  );

  const allowed = await Client.connect(port, { origin: 'https://allowed.example', tag: 'allowed' });
  const noToken = allowed.send({ t: 'join', name: '无令牌' });
  const authErr = await allowed.waitFor((m) => m.t === 'error' && m.code === 'unauthorized', { timeout: 1500 }).catch(() => null);
  ok('PROFILE_TOKEN：未带 token 的 join 被拒绝（unauthorized）', !!authErr, authErr);
  allowed.close();

  // V37：未知模式必须明确报错并拒绝，不再静默回退 tdm。
  const badMode = await Client.connect(port, { origin: 'https://allowed.example', tag: 'badmode' });
  badMode.send({ t: 'join', name: '模式猫', mode: 'hacker', token: 'net2-profile-token' });
  const modeErr = await badMode.waitFor((m) => m.t === 'error' && m.code === 'mode_unsupported', { timeout: 1500 }).catch(() => null);
  await sleep(150);
  ok(
    '未知模式返回 error{mode_unsupported} 并拒绝连接（不静默 tdm）',
    !!modeErr && !!badMode.closed,
    { error: modeErr, closed: badMode.closed }
  );
  badMode.close();

  const good = await Client.connect(port, { origin: 'https://allowed.example', tag: 'good' });
  const w = await good.join({
    name: 'Bad<script>猫',
    room: 'bad room!!',
    map: 'nowhere',
    token: 'net2-profile-token',
  });
  const clean = typeof w.name === 'string' && /^[\p{Script=Han}A-Za-z0-9_#\- ]{1,16}$/u.test(w.name);
  ok(
    '名字/房间/地图白名单：非法值被清洗或回退，未传 mode 默认 tdm',
    !!w && clean && w.room === 'ffa-1' && w.roomKey === 'ffa-1@tdm' && w.mode === 'tdm' && w.mapId === 'harbor',
    w && { name: w.name, room: w.room, roomKey: w.roomKey, mode: w.mode, mapId: w.mapId }
  );

  // V37：CORS 不再默认下发 *；按 ORIGIN_WHITELIST 回显具体 Origin。
  const corsAllowed = await httpJson(port, '/healthz', { headers: { origin: 'https://allowed.example' } });
  const corsEvil = await httpJson(port, '/healthz', { headers: { origin: 'https://evil.example' } });
  const corsNone = await httpJson(port, '/healthz');
  ok(
    'CORS：白名单 Origin 回显具体 Origin（非 *）',
    !!corsAllowed && corsAllowed.headers['access-control-allow-origin'] === 'https://allowed.example',
    corsAllowed && corsAllowed.headers['access-control-allow-origin']
  );
  ok(
    'CORS：未授权 Origin / 无 Origin 不下发 ACAO',
    !!corsEvil && !corsEvil.headers['access-control-allow-origin'] &&
      !!corsNone && !corsNone.headers['access-control-allow-origin'],
    { evil: corsEvil && corsEvil.headers['access-control-allow-origin'], none: corsNone && corsNone.headers['access-control-allow-origin'] }
  );

  // 消息速率限制：按 1s 窗口小批发送并及时停手。旧写法一次灌 420 条，
  // 在 CI 慢机上会被拆进多个窗口，导致 rate_limited 偶发为 0。
  const rlBefore = await metricValue(port, 'saltline_rate_limited');
  let rlAfter = rlBefore;
  for (let burst = 0; burst < 4 && !(Number.isFinite(rlAfter) && rlAfter > rlBefore); burst++) {
    for (let i = 0; i < 260; i++) good.send({ t: 'ping', ts: Date.now() });
    await sleep(120);
    rlAfter = await metricValue(port, 'saltline_rate_limited');
  }
  ok(
    '消息速率限制触发并计数（rate_limited > 0）',
    Number.isFinite(rlBefore) && Number.isFinite(rlAfter) && rlAfter > rlBefore,
    { before: rlBefore, after: rlAfter }
  );
  await sleep(1200);
  good.clear();
  good.send({ t: 'ping', ts: Date.now() });
  const pong = await good.waitType('pong', { timeout: 1500 }).catch(() => null);
  ok('限速后连接仍可正常 ping/pong', !!pong, !!pong);
  good.close();

  // 超大消息
  const big = await Client.connect(port, { origin: 'https://allowed.example', tag: 'big' });
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(resolve, 100);
    };
    big.ws.on('close', finish);
    big.ws.send('x'.repeat(20000));
    setTimeout(finish, 1200);
  });
  ok('超大消息触发断开（ws maxPayload / 1009）', !!big.closed, big.closed);
  big.close();
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
async function testProfiles(server) {
  const created = await httpJson(server.port, '/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '档案猫' }),
  });
  const token = created && created.json && created.json.token;
  ok(
    'POST /api/profile 创建 token 与等级/解锁字段',
    !!created && created.status === 201 && typeof token === 'string' && created.json.profile.level === 1 && Array.isArray(created.json.profile.unlocks),
    created && created.status
  );
  const fetched = await httpJson(server.port, '/api/profile?token=' + encodeURIComponent(token || ''));
  ok(
    'GET /api/profile?token 返回 XP/等级/解锁',
    !!fetched && fetched.status === 200 && fetched.json.profile.xp === 0 && fetched.json.profile.level === 1,
    fetched && fetched.json
  );
  const bad = await httpJson(server.port, '/api/profile?token=nope');
  ok('无效 profile token 返回 404', !!bad && bad.status === 404, bad && bad.status);

  // V37：并发创建多个 Profile，验证异步串行写队列合并落盘。
  const extra = await Promise.all([
    httpJson(server.port, '/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '并发猫甲' }) }),
    httpJson(server.port, '/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '并发猫乙' }) }),
  ]);
  const extraTokens = extra.map((e) => e && e.json && e.json.token).filter(Boolean);

  // 击杀 XP 在 testCombat 中验证；这里验证 profiles.json 原子写
  await sleep(900);
  ok('server/profiles.json 原子写成功（无 .tmp 残留）', fs.existsSync(server.profileFile) && !fs.existsSync(server.profileFile + '.tmp'), {
    file: server.profileFile,
    exists: fs.existsSync(server.profileFile),
  });
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(server.profileFile, 'utf8'));
  } catch {
    /* noop */
  }
  ok(
    'profiles.json 内可读回 token 与 XP 字段',
    !!parsed && parsed.profiles && parsed.profiles[token] && typeof parsed.profiles[token].xp === 'number',
    parsed && parsed.profiles && parsed.profiles[token] && parsed.profiles[token].xp
  );
  ok(
    'profiles.json 异步串行写：并发创建全部落盘且无 .tmp 残留',
    extraTokens.length === 2 && !!parsed && extraTokens.every((t) => parsed.profiles && parsed.profiles[t]) &&
      !fs.existsSync(server.profileFile + '.tmp'),
    { extraTokens, has: parsed && parsed.profiles && extraTokens.map((t) => !!parsed.profiles[t]) }
  );
  return token;
}

// ---------------------------------------------------------------------------
// V37 运维 / 性能：metrics token、healthz 明细、队列溢出、全 bin 不序列化 JSON
// ---------------------------------------------------------------------------
async function testOps() {
  const ops = await startServer({
    METRICS_TOKEN: 'ops-secret',
    TRUST_PROXY: '1',
    MAX_CMD_QUEUE: '4',
    TICK_HZ: '30',
    SNAP_HZ: '30',
    WARMUP_SECONDS: '0',
    BOTS: '0',
    RESPAWN_MS: '400',
  });
  try {
    const metricsPath = '/metrics?token=ops-secret';

    const noToken = await httpText(ops.port, '/metrics');
    const badToken = await httpText(ops.port, '/metrics?token=wrong');
    const goodToken = await httpText(ops.port, metricsPath);
    const bearer = await httpText(ops.port, '/metrics', { headers: { authorization: 'Bearer ops-secret' } });
    ok(
      'METRICS_TOKEN：未配置 token 从 127.0.0.1 也返回 401',
      !!noToken && noToken.status === 401,
      noToken && noToken.status
    );
    ok('METRICS_TOKEN：错误 token 返回 401', !!badToken && badToken.status === 401, badToken && badToken.status);
    ok(
      'METRICS_TOKEN：query token / Bearer 均可访问 /metrics',
      !!goodToken && goodToken.status === 200 && goodToken.text.includes('saltline_tick_ms') &&
        !!bearer && bearer.status === 200,
      { query: goodToken && goodToken.status, bearer: bearer && bearer.status }
    );

    const extHealth = await httpJson(ops.port, '/healthz', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    const extDetail = await httpJson(ops.port, '/healthz?detail=1', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    const lanHealth = await httpJson(ops.port, '/healthz', { headers: { 'x-forwarded-for': '192.168.1.5' } });
    ok(
      'healthz：外网默认不返回 roomsDetail',
      !!extHealth && !!extHealth.json && !('roomsDetail' in extHealth.json),
      extHealth && extHealth.json && Object.keys(extHealth.json)
    );
    ok(
      'healthz：外网 ?detail=1 才返回 roomsDetail',
      !!extDetail && !!extDetail.json && Array.isArray(extDetail.json.roomsDetail),
      extDetail && extDetail.json && extDetail.json.roomsDetail
    );
    ok(
      'healthz：内网默认返回 roomsDetail',
      !!lanHealth && !!lanHealth.json && Array.isArray(lanHealth.json.roomsDetail),
      lanHealth && lanHealth.json && lanHealth.json.roomsDetail
    );

    // 命令队列溢出：一次性塞入 12 条，队列上限 4；满后拒绝新命令且 lastQueuedSeq 不推进。
    const q = await Client.connect(ops.port, { tag: 'queue' });
    const wq = await q.join({ name: '队列猫', room: 'queue-' + Date.now().toString(36) });
    await sleep(150);
    q.clear();
    for (let i = 1; i <= 12; i++) {
      q.send({ t: 'input', seq: i, move: { x: 1, y: 0 }, yaw: 0, pitch: 0 });
    }
    await sleep(700);
    const qSnap = q.snaps[q.snaps.length - 1];
    const qSelf = qSnap && qSnap.players.find((p) => p.id === wq.id);
    const ackBefore = qSelf ? qSelf.ack : -1;
    const dropped = await metricValue(ops.port, 'saltline_commands_dropped', metricsPath);
    const queueFull = await metricValue(ops.port, 'saltline_command_queue_full', metricsPath);
    ok(
      '命令队列满：拒绝新命令并计入 cmdDropped/queue_full',
      dropped >= 4 && queueFull >= 4,
      { dropped, queueFull }
    );
    ok(
      '队列满拒绝后 lastQueuedSeq 不推进（ack 仅前 4 条左右）',
      ackBefore >= 1 && ackBefore <= 6,
      { ackBefore, dropped }
    );
    const nextSeq = ackBefore + 1;
    q.send({ t: 'input', seq: nextSeq, move: { x: 0, y: 1 }, yaw: 0, pitch: 0 });
    await sleep(300);
    const qSelf2 = q.snaps.length && q.snaps[q.snaps.length - 1].players.find((p) => p.id === wq.id);
    ok(
      '队列拒绝的新 seq 后续仍可被接受（未因 shift 丢失 lastQueuedSeq 语义）',
      !!qSelf2 && qSelf2.ack >= nextSeq,
      qSelf2 && { ack: qSelf2.ack, nextSeq }
    );
    const scoreMsg = q.msgs.filter((m) => m.t === 'score' && typeof m.cmdDropped === 'number').pop();
    ok(
      'score 回带 cmdDropped（便于客户端诊断）',
      !!scoreMsg && scoreMsg.cmdDropped >= 4,
      scoreMsg && scoreMsg.cmdDropped
    );
    q.close();
    await sleep(300);

    // 全 bin 房间不应再 JSON.stringify 全量 snap；有 JSON 客户端时才序列化。
    const jsonEncBefore = await metricValue(ops.port, 'saltline_json_snap_encodes', metricsPath);
    const bin = await Client.connect(ops.port, { tag: 'all-bin' });
    await bin.join({ name: '纯二猫', room: 'allbin-' + Date.now().toString(36), caps: ['bin'] });
    await sleep(800);
    const jsonEncAfter = await metricValue(ops.port, 'saltline_json_snap_encodes', metricsPath);
    ok(
      '全 bin 房间不再序列化 JSON 全量快照',
      Number.isFinite(jsonEncBefore) && Number.isFinite(jsonEncAfter) && jsonEncAfter === jsonEncBefore,
      { before: jsonEncBefore, after: jsonEncAfter }
    );
    bin.close();
    await sleep(300);

    const jsonEncBefore2 = await metricValue(ops.port, 'saltline_json_snap_encodes', metricsPath);
    const json = await Client.connect(ops.port, { tag: 'some-json' });
    await json.join({ name: '兼容猫', room: 'somejson-' + Date.now().toString(36) });
    await sleep(700);
    const jsonEncAfter2 = await metricValue(ops.port, 'saltline_json_snap_encodes', metricsPath);
    ok(
      '房间存在 JSON 客户端时才序列化全量快照',
      Number.isFinite(jsonEncBefore2) && jsonEncAfter2 > jsonEncBefore2,
      { before: jsonEncBefore2, after: jsonEncAfter2 }
    );
    json.close();
  } finally {
    await stopServer(ops);
  }
}

// ---------------------------------------------------------------------------
// V53 SRV-4：掉海走正常死亡流程，不再免费回满
// ---------------------------------------------------------------------------
async function testSeaDeath() {
  const seaServer = await startServer({
    RESPAWN_MS: '1500',
    WARMUP_SECONDS: '0',
    ROUND_SECONDS: '300',
    SCORE_LIMIT: '50',
    BOTS: '0',
  });
  let c = null;
  try {
    c = await Client.connect(seaServer.port);
    const w = await c.join({ name: '落水猫', room: 'sea-' + Date.now().toString(36), map: 'harbor', loadout: { primary: 'pac9' } });
    const seaY = w.map.seaY;
    const x = w.map.bounds.max.x - 2;
    c.clear();
    const from = c.msgs.length;
    c.send({ t: 'dev', cmd: 'tp', token: DEV, x, z: 0, y: seaY - 8 });
    const kill = await c.waitType('kill', { from, timeout: 3000 }).catch(() => null);
    const killAt = Date.now();
    ok(
      'SRV-4 掉到 seaY 以下广播 kill{victim=self, reason:sea}，而不是静默 respawn',
      !!kill && kill.victim === w.id && kill.by === null && kill.reason === 'sea' && kill.warmup === false,
      kill && { victim: kill.victim, by: kill.by, reason: kill.reason, warmup: kill.warmup }
    );
    await sleep(260);
    const lastSnap = c.snaps[c.snaps.length - 1];
    const deadSelf = lastSnap && lastSnap.players.find((p) => p.id === w.id);
    ok(
      'SRV-4 死亡等待期内保持死亡（alive=false / hp=0）且死亡数 +1',
      !!deadSelf && deadSelf.alive === false && deadSelf.hp === 0 && deadSelf.deaths >= 1,
      deadSelf && { alive: deadSelf.alive, hp: deadSelf.hp, deaths: deadSelf.deaths }
    );
    // 忽略 dev tp 自带的 {dev:true} respawn 回执，等真正的复活事件。
    const resp = await c.waitFor((m) => m.t === 'respawn' && m.id === w.id && !m.dev, { from, timeout: 3500 }).catch(() => null);
    const respAt = Date.now();
    console.log('[SRV-4] killReason=' + (kill && kill.reason) + ' respawnWaitedMs=' + (respAt - killAt) +
      ' respawnHp=' + (resp && resp.hp) + ' respawnMag=' + (resp && resp.mag));
    ok(
      'SRV-4 等待 RESPAWN_MS(1500) 后广播 respawn 并回满血量/弹药',
      !!resp && resp.id === w.id && resp.hp === 100 && resp.mag === 30 && respAt - killAt >= 1200,
      resp && { id: resp.id, hp: resp.hp, mag: resp.mag, waited: respAt - killAt }
    );
    await sleep(200);
    const aliveSnap = c.snaps[c.snaps.length - 1];
    const aliveSelf = aliveSnap && aliveSnap.players.find((p) => p.id === w.id);
    ok(
      'SRV-4 复活后位置回到出生点且死亡数保留（没有清零）',
      !!aliveSelf && aliveSelf.alive === true && aliveSelf.hp === 100 && aliveSelf.deaths >= 1 &&
        aliveSelf.y > seaY - 2.2,
      aliveSelf && { alive: aliveSelf.alive, hp: aliveSelf.hp, deaths: aliveSelf.deaths, y: aliveSelf.y }
    );
  } finally {
    if (c) c.close();
    await stopServer(seaServer);
  }
}

// ---------------------------------------------------------------------------
// V53 SRV-9：输入队列有界追赶，持续负载下不无界增长
// ---------------------------------------------------------------------------
async function testQueueCatchup() {
  const qServer = await startServer({
    WARMUP_SECONDS: '0',
    ROUND_SECONDS: '300',
    BOTS: '0',
    MAX_CMD_QUEUE: '120',
    MAX_CMD_RATE: '240',
  });
  let c = null;
  try {
    c = await Client.connect(qServer.port);
    const w = await c.join({ name: '加压猫', room: 'cq-' + Date.now().toString(36), loadout: { primary: 'pac9' } });
    c.send({ t: 'dev', cmd: 'tp', token: DEV, x: -10, z: -9 });
    await sleep(200);
    c.clear();
    let seq = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 1500) {
      const cmds = [];
      for (let k = 0; k < 8; k++) cmds.push({ seq: ++seq, move: { x: 0, y: 0 }, yaw: 0, pitch: 0 });
      c.send({ t: 'input', cmds });
      await sleep(66);
    }
    const sent = seq;
    await sleep(700);
    const peak = await metricValue(qServer.port, 'saltline_command_queue_peak');
    const catchup = await metricValue(qServer.port, 'saltline_command_catchup');
    const queueLen = await metricValue(qServer.port, 'saltline_command_queue_len');
    const queueFull = await metricValue(qServer.port, 'saltline_command_queue_full');
    const lastSnap = c.snaps[c.snaps.length - 1];
    const self = lastSnap && lastSnap.players.find((p) => p.id === w.id);
    console.log(
      '[SRV-9] sent=' + sent + ' peak=' + peak + ' catchup=' + catchup +
      ' queueLenAfterDrain=' + queueLen + ' queueFull=' + queueFull + ' ack=' + (self && self.ack)
    );
    ok(
      'SRV-9 持续 ~120 命令/秒 1.5 秒：队列峰值有界（<30；旧实现会积到 ~90+）',
      Number.isFinite(peak) && peak < 30,
      { peak, sent }
    );
    ok(
      'SRV-9 有界追赶发生（catchup > 0）且停止负载后队列排空',
      Number.isFinite(catchup) && catchup > 0 && queueLen === 0,
      { catchup, queueLen }
    );
    ok(
      'SRV-9 全程无 queue_full，ack 追平最后一条命令',
      Number.isFinite(queueFull) && queueFull === 0 && !!self && self.ack >= sent,
      { queueFull, ack: self && self.ack, sent }
    );
  } finally {
    if (c) c.close();
    await stopServer(qServer);
  }
}

// ---------------------------------------------------------------------------
// 旧回归（31 项）串行跑一次，确保 V36 修改没有破坏 WP32 止血用例
// ---------------------------------------------------------------------------
function runLegacyRound() {
  return new Promise((resolve) => {
    const profileFile = path.join(os.tmpdir(), 'saltline-legacy-profiles-' + process.pid + '.json');
    const child = spawn(process.execPath, [path.join(__dirname, 'test_round.cjs')], {
      cwd: __dirname,
      env: Object.assign({}, process.env, { PROFILES_FILE: profileFile }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* noop */ }
    }, 60000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
  });
}

// V53：坏档/备份恢复、锁心跳、cmds 上限与审计限频、__proto__ join、地图回退。
function runProfilesSuite() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'test_profiles.cjs')], {
      cwd: __dirname,
      env: Object.assign({}, process.env),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* noop */ }
    }, 120000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
  });
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
async function main() {
  let core = null;
  let bots = null;
  let security = null;
  let legacy = null;
  let profilesSuite = null;
  try {
    // V53 数据安全/健壮性先跑：托管多个短命服务器，避免与长连接用例互相干扰。
    profilesSuite = await runProfilesSuite();
    ok(
      'V53 test_profiles.cjs 全部通过（坏档/备份/锁心跳/cmds/__proto__/地图回退）',
      profilesSuite.code === 0 && /全部通过（\d+ 项）/.test(profilesSuite.out),
      {
        code: profilesSuite.code,
        tail: profilesSuite.out.split('\n').slice(-4).join(' | '),
        err: profilesSuite.err.slice(-400),
      }
    );

    // 旧回归先跑：避免并行子进程/客户端定时器造成 test_round 的 dev tp 与快照竞态。
    legacy = await runLegacyRound();
    core = await startServer({});
    await testProtocolAndInput(core);
    await testSimClock(core);
    const profileToken = await testProfiles(core);
    await testCombat(core, profileToken);
    await testHoldFire(core);
    await testRealtimeV37(core);
    await testSlowDrift(core);
    await testDomination(core);
    const health = await httpJson(core.port, '/healthz');
    ok(
      '/healthz 汇总 humans/bots/rooms/state/metrics',
      !!health &&
        health.json.ok &&
        Number.isFinite(health.json.players) &&
        Number.isFinite(health.json.humans) &&
        Number.isFinite(health.json.bots) &&
        Array.isArray(health.json.roomsDetail) &&
        !!health.json.metrics,
      health && health.json && { players: health.json.players, humans: health.json.humans, bots: health.json.bots }
    );
    const met = await httpText(core.port, '/metrics');
    ok(
      '/metrics 在测试结束时仍可访问且含计数器',
      !!met && met.status === 200 && met.text.includes('saltline_tick_ms') && met.text.includes('saltline_lagcomp_hits'),
      met && met.status
    );

    bots = await startServer({
      WARMUP_SECONDS: '3',
      BOTS: '8',
      DOM_CAPTURE_SECONDS: '1',
      DOM_SCORE_INTERVAL_MS: '250',
      ROUND_SECONDS: '120',
    });
    await testWarmupAndBots(bots);

    security = await startServer({
      ORIGIN_WHITELIST: 'https://allowed.example',
      PROFILE_TOKEN: 'net2-profile-token',
      WARMUP_SECONDS: '0',
      BOTS: '0',
    });
    await testSecurity(security);

    await testOps();
    await testSeaDeath();
    await testQueueCatchup();

    const legacyPass = /全部通过（31 项）/.test(legacy.out);
    ok(
      '旧回归 server/test_round.cjs 31 项仍全部通过',
      legacy.code === 0 && legacyPass,
      { code: legacy.code, tail: legacy.out.split('\n').slice(-3).join(' | '), err: legacy.err.slice(-300) }
    );
  } catch (e) {
    fail++;
    console.error('FAIL · 测试异常：' + (e && e.stack ? e.stack : e));
  } finally {
    for (const c of Array.from(clients)) c.close();
    if (fail && profilesSuite) {
      console.error('--- V53 test_profiles output ---');
      console.error(profilesSuite.out.slice(-2000));
      console.error(profilesSuite.err.slice(-1000));
    }
    if (fail && core) {
      console.error('--- core server log ---');
      console.error(core.log().split('\n').slice(-60).join('\n'));
    }
    if (fail && bots) {
      console.error('--- bots server log ---');
      console.error(bots.log().split('\n').slice(-40).join('\n'));
    }
    if (fail && security) {
      console.error('--- security server log ---');
      console.error(security.log().split('\n').slice(-40).join('\n'));
    }
    await stopServer(core);
    await stopServer(bots);
    await stopServer(security);
  }
  console.log(fail ? fail + ' 项失败 / ' + (pass + fail) + ' 项' : '全部通过（' + pass + ' 项）');
  process.exit(fail ? 1 : 0);
}

main();
