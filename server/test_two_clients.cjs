#!/usr/bin/env node
'use strict';
/**
 * test_two_clients.cjs — 双客户端联网移动同步验收
 *
 * 默认连 ws://172.16.17.189:9100，可用环境变量覆盖：
 *   TEST_URL=ws://127.0.0.1:9100 TEST_SECONDS=5 node server/test_two_clients.cjs
 *
 * 断言:
 *   1) 两端都收到 welcome，id 不同、同房间
 *   2) 两端都收到对方的 snap 快照
 *   3) 5 秒输入后，双方服务器权威位置均发生 > 0.5m 位移
 *   4) 对方快照位置也发生变化
 *   5) 快照频率 >= 20Hz，且快照字段完整、无 NaN
 *   6) 无 error 消息 / WebSocket 异常
 */

const WebSocket = require('ws');

const URL_WS = process.env.TEST_URL || 'ws://172.16.17.189:9100';
const SECONDS = Number(process.env.TEST_SECONDS || 5);
const INPUT_HZ = 30;
const ROOM = 'test-' + Date.now().toString(36);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Client {
  constructor(tag) {
    this.tag = tag;
    this.ws = null;
    this.welcome = null;
    this.snaps = [];
    this.errors = [];
    this.joins = [];
    this.leaves = [];
    this.pongs = [];
    this.closed = null;
    this.wsError = null;
    this.firstSeenOtherAt = null;
    this.start = Date.now();
  }

  get id() {
    return this.welcome && this.welcome.id;
  }

  async connect(name) {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(URL_WS, { handshakeTimeout: 8000 });
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error(this.tag + ' connect timeout')), 9000);
      ws.on('open', () => {
        clearTimeout(timer);
        ws.send(JSON.stringify({ t: 'join', name, room: ROOM }));
        resolve();
      });
      ws.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          this.errors.push({ code: 'bad_json', raw: String(data).slice(0, 120) });
          return;
        }
        this.onMessage(msg);
      });
      ws.on('error', (e) => {
        clearTimeout(timer);
        this.wsError = String(e && e.message ? e.message : e);
        reject(e);
      });
      ws.on('close', (code, reason) => {
        this.closed = { code, reason: String(reason || '') };
      });
    });
  }

  onMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        this.welcome = msg;
        break;
      case 'snap':
        this.snaps.push({ at: Date.now(), tick: msg.tick, players: msg.players });
        if (!this.firstSeenOtherAt) {
          const other = msg.players.find((p) => p.id !== this.id);
          if (other) this.firstSeenOtherAt = Date.now();
        }
        break;
      case 'join':
        this.joins.push(msg.player);
        break;
      case 'leave':
        this.leaves.push(msg.id);
        break;
      case 'pong':
        this.pongs.push({ rtt: Date.now() - msg.ts, at: Date.now() });
        break;
      case 'error':
        this.errors.push({ code: msg.code, message: msg.message });
        break;
      default:
        break;
    }
  }

  sendInput(seq, move, extra = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(
      JSON.stringify({
        t: 'input',
        seq,
        move,
        yaw: 0,
        pitch: 0,
        sprint: false,
        crouch: false,
        ...extra,
      })
    );
    return true;
  }

  ping() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ t: 'ping', ts: Date.now() }));
    }
  }

  close() {
    try {
      this.ws.close(1000, 'test_done');
    } catch {
      /* noop */
    }
  }

  rangeOf(id) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
    let samples = 0;
    for (const s of this.snaps) {
      const p = s.players.find((q) => q.id === id);
      if (!p) continue;
      samples++;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return {
      samples,
      dx: samples ? maxX - minX : 0,
      dz: samples ? maxZ - minZ : 0,
      distXZ: samples ? Math.hypot(maxX - minX, maxZ - minZ) : 0,
      y: samples ? [minY, maxY] : null,
    };
  }

  lastOf(id) {
    for (let i = this.snaps.length - 1; i >= 0; i--) {
      const p = this.snaps[i].players.find((q) => q.id === id);
      if (p) return p;
    }
    return null;
  }

  firstOf(id) {
    for (const s of this.snaps) {
      const p = s.players.find((q) => q.id === id);
      if (p) return p;
    }
    return null;
  }
}

function checkSnapshotShape(c, failures) {
  const bad = [];
  for (const s of c.snaps) {
    if (!Number.isFinite(s.tick)) bad.push('tick');
    for (const p of s.players) {
      for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'hp']) {
        if (!Number.isFinite(p[k])) bad.push(p.id + '.' + k);
      }
      if (typeof p.id !== 'string' || !p.id) bad.push('id');
    }
  }
  if (bad.length) failures.push(c.tag + ': 快照字段非法 ' + [...new Set(bad)].slice(0, 6).join(','));
}

function p50(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

(async () => {
  const failures = [];
  const A = new Client('A');
  const B = new Client('B');
  const started = Date.now();

  await A.connect('Alpha');
  await sleep(150);
  await B.connect('Bravo');

  // 等 welcome
  for (let i = 0; i < 100 && (!A.welcome || !B.welcome); i++) await sleep(50);
  if (!A.welcome) failures.push('A 未收到 welcome');
  if (!B.welcome) failures.push('B 未收到 welcome');
  if (A.welcome && B.welcome) {
    if (A.id === B.id) failures.push('两个客户端 id 相同');
    if (A.welcome.room !== B.welcome.room) failures.push('房间不一致');
    if (A.welcome.room !== ROOM) failures.push('room 回显不一致: ' + A.welcome.room);
  }

  // 5 秒移动：0.75s 一个方向（前/右/后/左），让位移明显
  const totalMs = SECONDS * 1000;
  const interval = 1000 / INPUT_HZ;
  let seq = 0;
  let pingTick = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < totalMs) {
    const elapsed = Date.now() - t0;
    const phase = Math.floor(elapsed / 750) % 4;
    const move =
      phase === 0 ? { x: 0, y: 1 } : phase === 1 ? { x: 1, y: 0 } : phase === 2 ? { x: 0, y: -1 } : { x: -1, y: 0 };
    const jump = elapsed > 1500 && elapsed < 1560;
    seq++;
    A.sendInput(seq, move, { jump });
    B.sendInput(seq, { x: move.x, y: move.y }, { jump, yaw: Math.PI });
    if (++pingTick % 15 === 0) {
      A.ping();
      B.ping();
    }
    await sleep(interval);
  }

  // 多等 0.5s 收尾快照
  await sleep(500);

  const duration = (Date.now() - started) / 1000;

  // 断言
  if (failures.length === 0) {
    const aSeesB = A.rangeOf(B.id);
    const bSeesA = B.rangeOf(A.id);
    const aSelf = A.rangeOf(A.id);
    const bSelf = B.rangeOf(B.id);

    if (!A.snaps.length) failures.push('A 未收到任何 snap');
    if (!B.snaps.length) failures.push('B 未收到任何 snap');
    if (!aSeesB.samples) failures.push('A 未在快照中看到 B');
    if (!bSeesA.samples) failures.push('B 未在快照中看到 A');
    if (aSeesB.samples && aSeesB.distXZ < 0.5) failures.push('A 看到 B 的位移不足 0.5m: ' + aSeesB.distXZ.toFixed(3));
    if (bSeesA.samples && bSeesA.distXZ < 0.5) failures.push('B 看到 A 的位移不足 0.5m: ' + bSeesA.distXZ.toFixed(3));
    if (aSelf.samples && aSelf.distXZ < 0.5) failures.push('A 自身权威位移不足 0.5m: ' + aSelf.distXZ.toFixed(3));
    if (bSelf.samples && bSelf.distXZ < 0.5) failures.push('B 自身权威位移不足 0.5m: ' + bSelf.distXZ.toFixed(3));
    if (B.snaps.length / Math.max(0.001, duration - 0.3) < 20) {
      failures.push('快照频率过低: ' + (B.snaps.length / duration).toFixed(1) + 'Hz');
    }

    // 对方快照首末位置
    const aFirstB = A.firstOf(B.id);
    const aLastB = A.lastOf(B.id);
    const bFirstA = B.firstOf(A.id);
    const bLastA = B.lastOf(A.id);
    if (!aFirstB || !aLastB || Math.hypot(aLastB.x - aFirstB.x, aLastB.z - aFirstB.z) < 0.5) {
      failures.push('A 收到的 B 首末位置无明显变化');
    }
    if (!bFirstA || !bLastA || Math.hypot(bLastA.x - bFirstA.x, bLastA.z - bFirstA.z) < 0.5) {
      failures.push('B 收到的 A 首末位置无明显变化');
    }

    checkSnapshotShape(A, failures);
    checkSnapshotShape(B, failures);

    if (A.errors.length) failures.push('A 收到 error: ' + JSON.stringify(A.errors.slice(0, 3)));
    if (B.errors.length) failures.push('B 收到 error: ' + JSON.stringify(B.errors.slice(0, 3)));
    if (A.wsError) failures.push('A WebSocket 异常: ' + A.wsError);
    if (B.wsError) failures.push('B WebSocket 异常: ' + B.wsError);
    if (A.closed && ![1000, 1005, 1006].includes(A.closed.code)) failures.push('A 异常关闭: ' + JSON.stringify(A.closed));
    if (B.closed && ![1000, 1005, 1006].includes(B.closed.code)) failures.push('B 异常关闭: ' + JSON.stringify(B.closed));

    const report = {
      ok: failures.length === 0,
      target: URL_WS,
      room: ROOM,
      durationSec: +duration.toFixed(2),
      clients: {
        A: { id: A.id, name: 'Alpha', snaps: A.snaps.length, snapHz: +(A.snaps.length / duration).toFixed(1), sawOtherMs: A.firstSeenOtherAt ? A.firstSeenOtherAt - started : null },
        B: { id: B.id, name: 'Bravo', snaps: B.snaps.length, snapHz: +(B.snaps.length / duration).toFixed(1), sawOtherMs: B.firstSeenOtherAt ? B.firstSeenOtherAt - started : null },
      },
      movement: {
        A_self: aSelf,
        A_sees_B: aSeesB,
        B_self: bSelf,
        B_sees_A: bSeesA,
        A_first_last_B: { first: aFirstB, last: aLastB },
        B_first_last_A: { first: bFirstA, last: bLastA },
      },
      pingRttMs: {
        A_p50: p50(A.pongs.map((p) => p.rtt)),
        B_p50: p50(B.pongs.map((p) => p.rtt)),
        A_samples: A.pongs.length,
        B_samples: B.pongs.length,
      },
      errors: { A: A.errors, B: B.errors, ws: [A.wsError, B.wsError].filter(Boolean) },
      failures,
    };
    console.log(JSON.stringify(report, null, 1));
  } else {
    console.log(JSON.stringify({ ok: false, target: URL_WS, failures }, null, 1));
  }

  A.close();
  B.close();
  await sleep(250);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error('[test] failed: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
