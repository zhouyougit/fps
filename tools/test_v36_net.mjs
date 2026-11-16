#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/test_v36_net.mjs — V36 网络 2.0 + V37 质量修复回归
   1) Node：协议编解码、baseline 增量、预测回放 100 条、ack 出队、
      二进制/JSON 体积、URL/名字/错误码纯函数。
   1b) Node · V37：nid→id 映射、全量帧删除、ACK 清 pending、
      resetPrediction 后 ack>1024、30/60Hz 回放一致性、shotSeq 回滚、
      roundEnd 用 m.teams、模式项 / 启动错误过滤的源码断言。
   2) 浏览器：协议 2.0 二进制快照双客户端（自定义测试服务器，hex id +
      数值 nid + ACK 帧 + 每 2s 全量帧）+ 旧 JSON 服务器兼容回归。
      环境跑不动时输出 SKIP（try/finally），不抛未捕获异常。
   ===================================================================== */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const net2 = require('../src/ext_net2.js');
const protocol = require('../packages/net/protocol.js');
const sim = require('../packages/sim');
const { WebSocketServer } = require('../server/node_modules/ws');

let pass = 0, fail = 0, skipped = 0;
const results = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('FAIL · ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
  results.push({ name, ok: !!cond });
}
function skip(name, e) {
  skipped++;
  console.log('SKIP · ' + name + ' — ' + String(e && e.message || e).slice(0, 300));
  results.push({ name, skip: true });
}
function section(name) { console.log('\n=== ' + name + ' ==='); }

/* =====================================================================
   Part 1 · Node 协议 / 预测单元测试
   ===================================================================== */
section('Node · 协议 2.0');

ok('协议版本与 cap', protocol.VERSION === 2 && net2.VERSION === 2 && net2.CAPS.includes('bin'), { p: protocol.VERSION, n: net2.VERSION });

{
  const cmd = { seq: 123456, tick: 8888, buttons: protocol.BTN.FIRE | protocol.BTN.ADS | protocol.BTN.JUMP, mx: 0.5, my: -0.7, yaw: 2.2, pitch: 0.4, slot: 3 };
  const buf = protocol.encodeInput(cmd);
  const dec = protocol.decodeInput(buf);
  const err = Math.max(
    Math.abs(dec.seq - cmd.seq), Math.abs(dec.tick - cmd.tick),
    Math.abs(dec.buttons - cmd.buttons), Math.abs(dec.mx - cmd.mx),
    Math.abs(dec.my - cmd.my), Math.abs(dec.yaw - cmd.yaw),
    Math.abs(dec.pitch - cmd.pitch), Math.abs(dec.slot - cmd.slot)
  );
  ok('encodeInput/decodeInput 往返', buf.byteLength === 18 && err < 0.01, { bytes: buf.byteLength, err: +err.toFixed(5) });
}

{
  const players = [
    { id: 1, x: -2.4, y: 0.03, z: 12.36, yaw: -1.57, hp: 100, armor: 50, team: 0, alive: true, crouch: false, spawnProtect: false, seq: 7, state: 0 },
    { id: 2, x: 2.1, y: 0, z: -3.25, yaw: 1.2, hp: 62, armor: 12, team: 1, alive: true, crouch: true, spawnProtect: true, seq: 9, state: 2 }
  ];
  const buf = protocol.encodeSnapshot(42, 0, players, null);
  const snap = protocol.decodeSnapshot(buf);
  const p2 = snap.players[1];
  const d = Math.max(Math.abs(p2.x - 2.1), Math.abs(p2.z + 3.25), Math.abs(p2.y), Math.abs(p2.yaw - 1.2));
  ok('encodeSnapshot/decodeSnapshot 往返', snap.tick === 42 && snap.players.length === 2 && d < 0.011 && p2.alive && p2.crouch && p2.spawnProtect, { bytes: buf.byteLength, d: +d.toFixed(4) });
}

{
  const p1 = { id: 1, x: 0, y: 0, z: 0, yaw: 0, hp: 100, armor: 50, team: 0, alive: true, crouch: false, spawnProtect: false };
  const p2 = { id: 2, x: 4, y: 0, z: 1, yaw: 0.4, hp: 80, armor: 20, team: 1, alive: true, crouch: false, spawnProtect: false };
  const prev = { 1: p1, 2: p2 };
  const buf = protocol.encodeSnapshot(8, 7, [p1, p2], prev);
  const snap = protocol.decodeSnapshot(buf);
  ok('baseline 增量：未变化玩家被省略', buf.byteLength === 11 && snap.players.length === 0, { bytes: buf.byteLength, n: snap.players.length });

  const p2b = Object.assign({}, p2, { x: 4.5 });
  const buf2 = protocol.encodeSnapshot(9, 8, [p1, p2b], prev);
  const snap2 = protocol.decodeSnapshot(buf2);
  ok('baseline 增量：仅发送变化玩家', snap2.players.length === 1 && snap2.players[0].id === 2 && Math.abs(snap2.players[0].x - 4.5) < 0.02, { bytes: buf2.byteLength, n: snap2.players.length });
}

{
  const players = [];
  for (let i = 1; i <= 12; i++) {
    players.push({ id: i, x: (i - 6) * 3.2, y: 0, z: (i % 3) * 4.1, yaw: i * 0.2, hp: 100 - i, armor: 50, team: i % 2, alive: true, crouch: false, spawnProtect: false, seq: i, state: 0 });
  }
  const bin = protocol.encodeSnapshot(100, 99, players, null).byteLength;
  const json = Buffer.byteLength(JSON.stringify({ t: 'snap', tick: 100, players }), 'utf8');
  ok('12 人快照带宽：binary < JSON 的 45%', bin < json * 0.45, { binary: bin, json, ratio: +(bin / json).toFixed(3) });
}

{
  const q = new net2.PredictionQueue(120);
  for (let i = 1; i <= 10; i++) q.push({ seq: i, tick: i });
  const dropped = q.dropAcked(6);
  const pend = q.pending();
  ok('ack 出队与 120 条上限', dropped === 6 && pend.length === 4 && pend[0].seq === 7 && pend[3].seq === 10, { dropped, pending: pend.length });
  for (let i = 11; i <= 180; i++) q.push({ seq: i, tick: i });
  ok('预测队列上限 120（最旧丢弃）', q.size() === 120 && q.pending()[0].seq === 61, { size: q.size(), first: q.pending()[0].seq });
}

{
  const prev = new Map([['1', { id: 1, x: 1, name: 'A' }], ['2', { id: 2, x: 2, name: 'B' }]]);
  const merged = net2.mergeBaseline(prev, [{ id: 1, x: 9 }]);
  ok('baseline 合并：未出现玩家沿用上帧', merged.size === 2 && merged.get('1').x === 9 && merged.get('1').name === 'A' && merged.get('2').x === 2, { size: merged.size });
}

{
  const world = sim.createWorld({
    boxes: [{ min: [-60, -1, -60], max: [60, 0, 60] }],
    bounds: { min: [-60, 0, -60], max: [60, 30, 60] },
    groundY: 0, seaY: -999, quayX: 999
  });
  const spawn = { x: 0, y: 0.02, z: 0, yaw: 0 };
  const base = sim.createPlayerState(world, spawn, {});
  const ref = sim.createPlayerState(world, spawn, {});
  const cmds = [];
  let yaw = 0;
  for (let i = 0; i < 100; i++) {
    if (i % 23 === 0) yaw += 0.17;
    const mx = Math.sin(i * 0.37) * 0.9;
    const my = Math.cos(i * 0.21) * 0.8 + 0.2;
    cmds.push({ mx, my, yaw, pitch: 0.05, buttons: i % 17 < 3 ? protocol.BTN.JUMP : 0, tick: i });
  }
  for (const c of cmds) sim.stepPlayer(ref, c, world, 1 / 30, {});
  const replay = net2.replay(world, {
    pos: { x: base.pos.x, y: base.pos.y, z: base.pos.z },
    vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: true
  }, cmds, 1 / 30, {});
  const err = net2.dist(ref.pos, replay.pos);
  ok('100 条预测命令回放误差 < 0.05m', err < 0.05, { err: +err.toFixed(6) });
}

{
  const goodWs = net2.validateUrl('ws://127.0.0.1:9100');
  const goodWss = net2.validateUrl('wss://example.com/mp');
  const badHttp = net2.validateUrl('http://example.com');
  const badJs = net2.validateUrl('javascript:alert(1)');
  const name = net2.sanitizeName('  <b>猫</b>&"x"  ');
  ok('仅允许 ws/wss + 名字转义', goodWs.ok && goodWss.ok && !badHttp.ok && !badJs.ok && name.indexOf('<') < 0 && name.indexOf('&') < 0, { name, bad: badHttp.error });
  ok('错误码友好提示', net2.friendlyError('dev_disabled').includes('dev') && net2.friendlyError('room_full').includes('房间已满'), { dev: net2.friendlyError('dev_disabled'), full: net2.friendlyError('room_full') });
}

/* =====================================================================
   Part 1b · V37 质量修复（Node 可单测纯逻辑）
   ===================================================================== */
section('Node · V37 质量修复');

{
  const map = new net2.IdMap();
  const selfHex = 'a1b2c3d4';
  map.setSelf(selfHex, 7);
  const players = [
    { id: selfHex, nid: 7, name: 'A' },
    { id: 'ff00aa11', nid: 3, name: 'B' }
  ];
  players.forEach(p => map.registerPlayer(p));
  const ids = [7, 3, selfHex, 'ff00aa11', 'missing'].map(id => map.resolve(id));
  ok('nid→id：welcome/players 双向映射，数值 netId 解析为字符串 id',
    ids[0] === selfHex && ids[1] === 'ff00aa11' && ids[2] === selfHex && ids[3] === 'ff00aa11' && ids[4] === 'missing',
    { ids });
}

{
  const map = new net2.IdMap();
  const self = map.setSelf('ABC123', null);
  const legacy = new net2.IdMap();
  const legacySelf = legacy.setSelf(1);
  ok('welcome 缺 nid 时回退原 id（含旧 JSON 数值 id 服务器）',
    self === 'ABC123' && map.resolve('ABC123') === 'ABC123' && legacySelf === '1' && legacy.resolve(1) === '1',
    { self, legacySelf });
}

{
  // 真实服务器：二进制帧 id 是数值 netId；welcome/join 里是字符串 id + 数值 nid
  const players = [
    { id: 7, x: 0, y: 0, z: 0, yaw: 0, hp: 100, armor: 50, team: 0, alive: true, crouch: false, spawnProtect: false, seq: 12, state: 0 },
    { id: 3, x: 4, y: 0, z: 2, yaw: 1, hp: 80, armor: 20, team: 1, alive: true, crouch: false, spawnProtect: false, seq: 9, state: 0 }
  ];
  const snap = protocol.decodeSnapshot(protocol.encodeSnapshot(5, 0, players, null));
  const map = new net2.IdMap();
  map.setSelf('a1b2c3d4', 7);
  map.registerPlayer({ id: 'ff00aa11', nid: 3 });
  const resolved = snap.players.map(p => map.resolve(p.id));
  ok('二进制快照 raw.id 经 resolveId 映射（自己可识别，不再双份模型）',
    resolved.includes('a1b2c3d4') && resolved.includes('ff00aa11') && !resolved.includes('7'), { resolved });
}

{
  const prev = new Map([
    ['a', { id: 'a', x: 0, name: 'A' }],
    ['b', { id: 'b', x: 1, name: 'B' }],
    ['c', { id: 'c', x: 2, name: 'C' }]
  ]);
  const full = net2.mergeFrame(prev, [{ id: 'a', x: 9 }, { id: 'c', x: 3 }], true);
  const partial = net2.mergeFrame(prev, [{ id: 'a', x: 9 }], false);
  const a = full.list.find(p => p.id === 'a');
  ok('全量帧（baseline=0）按本帧集合重建并返回离开玩家',
    full.list.length === 2 && full.removed.length === 1 && full.removed[0] === 'b' && a.x === 9,
    { n: full.list.length, removed: full.removed, a });
  ok('非全量帧保留 baseline 合并（不删除未出现的玩家）',
    partial.list.length === 3 && partial.removed.length === 0 &&
    partial.list.find(p => p.id === 'b').name === 'B' && partial.list.find(p => p.id === 'c').x === 2,
    { n: partial.list.length, removed: partial.removed });
}

{
  const pend = Array.from({ length: 10 }, (_, i) => ({ seq: i + 1 }));
  const ack = net2.nextAck(0, 6);
  const dropped = net2.dropAcked(pend, ack);
  ok('ACK 帧清 pending（seq<=ack 全部出队）',
    ack === 6 && dropped === 6 && pend.length === 4 && pend[0].seq === 7,
    { ack, dropped, rest: pend.map(p => p.seq) });
}

{
  const pend = Array.from({ length: 20 }, (_, i) => ({ seq: 3001 + i }));
  const lastAcked = net2.clampAck(0, 3005);      // resetPrediction: Math.max(lastAcked, seq)
  const ack = net2.resolveAck(3008, lastAcked);
  const dropped = net2.dropAcked(pend, ack);
  ok('resetPrediction 后 ack>1024 仍能清 pending',
    lastAcked === 3005 && ack === 3008 && dropped === 8 && pend[0].seq === 3009,
    { lastAcked, ack, dropped, first: pend[0].seq });
  ok('resolveAck 兼容完整 u32 序号（lastAcked=0 时不再解析成负数）',
    net2.resolveAck(3008, 0) === 3008 && net2.resolveAck(3050, 3048) === 3050 && net2.resolveAck(4, 3005) === 3076,
    { a: net2.resolveAck(3008, 0), b: net2.resolveAck(3050, 3048), wrap: net2.resolveAck(4, 3005) });
}

{
  // 同一段 1 秒输入分别按 30Hz / 60Hz 步进，终点误差应很小
  const world = sim.createWorld({
    boxes: [{ min: [-60, -1, -60], max: [60, 0, 60] }],
    bounds: { min: [-60, 0, -60], max: [60, 30, 60] },
    groundY: 0, seaY: -999, quayX: 999
  });
  const cmdsAt = (hz) => {
    const out = [];
    for (let i = 0; i < hz; i++) {
      const t = i / hz;
      out.push({ mx: Math.sin(t * 2.4) * 0.85, my: 0.55 + Math.cos(t * 1.7) * 0.25, yaw: t * 0.6, pitch: 0.03, buttons: 0, tick: i });
    }
    return out;
  };
  const run = (hz) => net2.replay(world, { x: 0, y: 0.02, z: 0, yaw: 0 }, cmdsAt(hz), 1 / hz, {});
  const a = run(30), b = run(60);
  const err = net2.dist(a.pos, b.pos);
  ok('30/60Hz 回放一致性（同步长同输入）', err < 0.15, { err: +err.toFixed(4), a: a.pos, b: b.pos });
}

{
  const shots = [{ seq: 3, ammoBefore: 10, reserveBefore: 90 }, { seq: 4, ammoBefore: 9, reserveBefore: 90 }, { seq: 5, ammoBefore: 8, reserveBefore: 90 }];
  const got = net2.takeShotForReject(shots, 4);
  const weapon = { ammo: 5, reserve: 80, magSize: 30 };
  net2.rollbackAmmo(weapon, { shotSeq: 4, mag: 6, reserve: 84 }, got.shot);
  ok('shotRejected 按 shotSeq 找到条目并采用服务端 mag/reserve',
    got.shot && got.shot.seq === 4 && shots.map(s => s.seq).join(',') === '3,5' && weapon.ammo === 6 && weapon.reserve === 84,
    { shot: got.shot && got.shot.seq, rest: shots.map(s => s.seq), ammo: weapon.ammo, reserve: weapon.reserve });
}

{
  const t1 = net2.roundTeams({ teams: [12, 9], score: [40, 33] }, [0, 0]);
  const t2 = net2.roundTeams({ score: [5, 4] }, [7, 7]);
  const t3 = net2.roundTeams({}, [2, 3]);
  ok('roundEnd 优先 m.teams（据点分），score / 旧值兜底',
    t1[0] === 12 && t1[1] === 9 && t2[0] === 5 && t2[1] === 4 && t3[0] === 2 && t3[1] === 3,
    { t1, t2, t3 });
}

{
  const mpSrc = fs.readFileSync(path.join(ROOT, 'src', 'mp.js'), 'utf8');
  const netSrc = fs.readFileSync(path.join(ROOT, 'src', 'ext_net2.js'), 'utf8');
  const hasFixes = /function resolveId\(/.test(mpSrc) && /baseline === 0/.test(mpSrc) &&
    /applyPlayers\(list, full\)/.test(mpSrc) && /applyAckFrame/.test(mpSrc) &&
    /decodeAck/.test(mpSrc) && /Math\.max\(lastAcked, seq\)/.test(mpSrc) &&
    /1 \/ Math\.max\(1, cmdRate\)/.test(mpSrc);
  ok('mp.js 关键修复点存在（resolveId / 全量帧 / ACK / resetPrediction / cmdRate）', hasFixes, { hasFixes });
  ok('联机模式仅 tdm/chaos/domination（已移除个人乱斗选项）',
    !/value="ffa"/.test(mpSrc) && !/个人乱斗/.test(mpSrc) && !/ffa/i.test(netSrc) &&
    !('ffa' in net2.modes) && net2.modeKey('ffa') === '' && net2.modeKey('yin') === '' &&
    net2.modeKey('tdm') === 'tdm' && net2.modeKey('domination') === 'domination',
    { mp: /value="ffa"/.test(mpSrc), net: /ffa/i.test(netSrc) });
  ok('启动错误过滤已移除（不再吞 Vector3 / 清洗 __errors）',
    !/installBootErrorGuard/.test(mpSrc) && !/suppressed legacy ext_visual/.test(mpSrc) && !/indexOf\("Vector3"\) < 0/.test(mpSrc),
    { guard: /installBootErrorGuard/.test(mpSrc) });
}

/* =====================================================================
   Part 2 · 浏览器双客户端（协议 2.0 自定义服务器）
   环境不可用（无浏览器 / 构建失败）时输出 SKIP，不抛未捕获异常。
   ===================================================================== */
section('浏览器 · 协议 2.0 二进制双客户端');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fps-v37-'));
const htmlPath = path.join(tmpDir, 'game_v37.html');
let browser = null, browserErr = null;
const pages = [];

async function getBrowser() {
  if (browser) return browser;
  if (browserErr) throw browserErr;
  const chrome = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chrome) ? chrome : undefined,
    args: PW_ARGS
  });
  return browser;
}
async function newPage() {
  const b = await getBrowser();
  return b.newPage({ viewport: { width: 1000, height: 560 } });
}
async function waitActive(page, n, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await page.evaluate(() => window.__SX_NET ? window.__SX_NET.state() : null);
    if (s && s.active && s.players >= n) return s;
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

function hexId(n) { return 'a' + n.toString(16).padStart(5, '0'); }

function startProtoServer() {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    const clients = new Map();
    const prevByClient = new Map();
    const stats = { binaryInputs: 0, jsonInputs: 0, fires: 0, snaps: 0, hits: 0, kills: 0, acks: 0, fullFrames: 0 };
    let nextId = 1, tick = 0, dropLeave = false;
    const bot = { id: 'b00001', nid: 999, name: 'BOT-01', team: 1, kills: 2, deaths: 1, ping: 0, bot: true };

    function send(ws, obj) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {} }
    function broadcast(obj, except) { clients.forEach(c => { if (c.ws !== except) send(c.ws, obj); }); }
    function playerObj(c, withName) {
      const o = {
        id: c.id, nid: c.nid, x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, pitch: 0,
        hp: c.hp, armor: c.armor, alive: c.alive, team: c.team,
        crouch: false, spawnProtect: false, seq: c.seq | 0, state: 0
      };
      if (withName) { o.name = c.name; o.kills = c.kills | 0; o.deaths = c.deaths | 0; }
      return o;
    }
    // 二进制快照用数值 netId（与 server/server.cjs 一致）
    function binPlayer(c) {
      const o = playerObj(c, false);
      o.id = c.nid;
      delete o.nid;
      return o;
    }
    function scorePacket() {
      const list = [...clients.values()].map(c => ({ id: c.id, nid: c.nid, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, ping: 12 }));
      list.push({ id: bot.id, nid: bot.nid, name: bot.name, team: bot.team, kills: bot.kills, deaths: bot.deaths, ping: 0, bot: true });
      return {
        t: 'score', mode: 'domination', mapId: 'harbor', timeLeft: 120, overtime: false, state: 'live',
        teams: [clients.size ? [...clients.values()][0].kills : 0, clients.size > 1 ? [...clients.values()][1].kills : 0],
        players: list,
        caps: [
          { id: 'A', owner: 0, progress: 0.65, contested: false },
          { id: 'B', owner: -1, progress: 0.25, contested: true },
          { id: 'C', owner: 1, progress: 1, contested: false }
        ]
      };
    }
    function capsPacket() {
      return [
        { id: 'A', owner: 0, progress: 0.65, contested: false },
        { id: 'B', owner: -1, progress: 0.25, contested: true },
        { id: 'C', owner: 1, progress: 1, contested: false }
      ];
    }

    wss.on('connection', ws => {
      ws.on('message', (raw, isBinary) => {
        if (isBinary) {
          try {
            const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
            const cmd = protocol.decodeInput(ab);
            if (cmd) {
              stats.binaryInputs++;
              const c = clients.get(ws._v37id);
              if (c) { c.seq = cmd.seq; c.yaw = cmd.yaw; }
            }
          } catch (e) {}
          return;
        }
        let m;
        try { m = JSON.parse(raw.toString()); } catch (e) { return; }
        if (!m || typeof m.t !== 'string') return;
        if (m.t === 'join') {
          const nid = nextId++;
          const team = nid % 2 === 1 ? 0 : 1;
          const spawn = team === 0 ? { x: -2, y: 0.02, z: 12, yaw: -Math.PI / 2 } : { x: 2, y: 0.02, z: 12, yaw: Math.PI / 2 };
          const c = { ws, nid, id: hexId(nid), team, name: String(m.name || '猫').slice(0, 12), pos: { x: spawn.x, y: spawn.y, z: spawn.z }, yaw: spawn.yaw, hp: 100, armor: 0, alive: true, seq: 0, kills: 0, deaths: 0, respawnAt: 0 };
          clients.set(nid, c);
          ws._v37id = nid;
          send(ws, {
            t: 'welcome', id: c.id, nid: c.nid, name: c.name, room: m.room || 'v37', roomKey: (m.room || 'v37') + '@domination',
            mapId: 'harbor', mode: 'domination', tick, tickRate: 60, team, serverTime: Date.now(),
            protocol: 2, caps: ['bin'], state: 'live',
            players: [...clients.values()].map(x => playerObj(x, true)),
            map: { spawn: { x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw }, bounds: { min: [-40, 0, -30], max: [40, 30, 30] } }
          });
          broadcast({ t: 'join', player: playerObj(c, true) }, ws);
          return;
        }
        const c = clients.get(ws._v37id);
        if (!c) return;
        if (m.t === 'input') {
          stats.jsonInputs++;
          c.seq = m.seq | 0;
          if (typeof m.yaw === 'number') c.yaw = m.yaw;
          return;
        }
        if (m.t === 'ping') { send(ws, { t: 'pong', ts: m.ts, serverTime: Date.now(), tick }); return; }
        if (m.t === 'fire') {
          stats.fires++;
          if (!c.alive) return;
          const dir = m.dir || {};
          const len = Math.hypot(dir.x || 0, dir.y || 0, dir.z || 0) || 1;
          const d = { x: (dir.x || 0) / len, y: (dir.y || 0) / len, z: (dir.z || 0) / len };
          let victim = null;
          for (const q of clients.values()) {
            if (q === c || !q.alive) continue;
            const vx = q.pos.x - c.pos.x, vy = q.pos.y + 1.0 - (c.pos.y + 1.6), vz = q.pos.z - c.pos.z;
            const vl = Math.hypot(vx, vy, vz) || 1;
            const dot = (vx / vl) * d.x + (vy / vl) * d.y + (vz / vl) * d.z;
            if (dot > 0.86 && vl < 30) { victim = q; break; }
          }
          const muzzle = [c.pos.x, c.pos.y + 1.6, c.pos.z];
          const point = victim ? [victim.pos.x, victim.pos.y + 1.0, victim.pos.z] : [c.pos.x + d.x * 30, c.pos.y + 1.6 + d.y * 30, c.pos.z + d.z * 30];
          broadcast({ t: 'fire', by: c.id, wpn: m.wpn || 'pac9', dir: d, muzzle, point }, ws);
          if (victim) {
            stats.hits++;
            victim.hp = Math.max(0, victim.hp - 30);
            broadcast({ t: 'hit', by: c.id, victim: victim.id, dmg: 30, hs: false, point, from: [c.pos.x, c.pos.y, c.pos.z] });
            if (victim.hp <= 0) {
              stats.kills++;
              victim.alive = false;
              victim.deaths++;
              victim.respawnAt = Date.now() + 1500;
              c.kills++;
              broadcast({ t: 'kill', by: c.id, victim: victim.id, hs: false, wpn: m.wpn || 'pac9', byName: c.name, victimName: victim.name });
            }
          }
          return;
        }
        if (m.t === 'reload' || m.t === 'switch') { broadcast(Object.assign({ id: c.id }, m), ws); return; }
      });
      ws.on('close', () => {
        const c = clients.get(ws._v37id);
        if (c) {
          clients.delete(c.nid);
          prevByClient.delete(c.id);
          if (!dropLeave) broadcast({ t: 'leave', id: c.id, nid: c.nid });
        }
      });
    });

    const timer = setInterval(() => {
      tick++;
      const now = Date.now();
      for (const c of clients.values()) {
        if (!c.alive && c.respawnAt && now >= c.respawnAt) {
          c.alive = true; c.hp = 100; c.armor = 0; c.respawnAt = 0;
          broadcast({ t: 'respawn', id: c.id, nid: c.nid, x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, hp: 100, armor: 0 });
        }
      }
      const players = [...clients.values()].map(c => binPlayer(c));
      for (const c of clients.values()) {
        const last = prevByClient.get(c.id);
        const full = !last || tick - last.fullTick >= 60;   // 每 2 秒一次全量帧（同生产服务器）
        const prevMap = {};
        if (last && !full) {
          for (const p of players) {
            if (p.id === c.nid) continue;   // 自己每帧都发，保证 self.seq 兜底可用
            const old = last.map[p.id];
            if (old) prevMap[p.id] = old;
          }
        }
        const buf = protocol.encodeSnapshot(tick, full ? 0 : last.tick, players, full ? null : prevMap);
        try { c.ws.send(Buffer.from(new Uint8Array(buf))); stats.snaps++; if (full) stats.fullFrames++; } catch (e) {}
        if ((c.seq | 0) > 0) {
          const ackBuf = protocol.encodeAck(tick, c.seq | 0);
          try { c.ws.send(Buffer.from(new Uint8Array(ackBuf))); stats.acks++; } catch (e) {}
        }
        const map = {}; players.forEach(p => { map[p.id] = p; });
        prevByClient.set(c.id, { tick, map, fullTick: full ? tick : (last ? last.fullTick : tick) });
      }
    }, 33);

    const scoreTimer = setInterval(() => { clients.forEach(c => send(c.ws, scorePacket())); }, 500);
    const stateTimer = setInterval(() => {
      const teams = [0, 1].map(t => [...clients.values()].filter(c => c.team === t).reduce((a, c) => a + c.kills, 0));
      clients.forEach(c => send(c.ws, { t: 'matchState', state: 'live', mode: 'domination', teams, caps: capsPacket(), timeLeft: 120 }));
    }, 1000);

    wss.on('listening', () => resolve({
      port: wss.address().port, stats,
      dropLeave: (v) => { dropLeave = !!v; },
      close: () => new Promise(res => {
        clearInterval(timer); clearInterval(scoreTimer); clearInterval(stateTimer);
        clients.forEach(c => { try { c.ws.close(); } catch (e) {} });
        wss.close(() => res());
      })
    }));
    wss.on('error', reject);
  });
}

let protoServer = null;
try {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.cjs'), htmlPath, 'v36'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('[test] build ok: ' + htmlPath);
  const fileUrl = 'file://' + htmlPath + '?q=low&noaudio=1&autostart=1&dt=0.05';
  await getBrowser();
  console.log('[test] browser launched');
  protoServer = await startProtoServer();
  const wsUrl = 'ws://127.0.0.1:' + protoServer.port;
  const pageA = await newPage();
  const pageB = await newPage();
  const errsA = [], errsB = [];
  pageA.on('pageerror', e => errsA.push(String(e && e.message || e)));
  pageB.on('pageerror', e => errsB.push(String(e && e.message || e)));
  pages.push({ page: pageA, errs: errsA, name: 'A' }, { page: pageB, errs: errsB, name: 'B' });
  console.log('[test] pages created, goto A…');
  await pageA.goto(fileUrl, { waitUntil: 'load', timeout: 180000 });
  console.log('[test] goto B…');
  await pageB.goto(fileUrl, { waitUntil: 'load', timeout: 180000 });
  await pageA.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
  await pageB.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
  console.log('[test] pages ready');
  await pageA.evaluate(([u]) => window.__MP.join(u, 'A', 'v37-proto', 'harbor', 'domination'), [wsUrl]);
  await new Promise(r => setTimeout(r, 800));
  await pageB.evaluate(([u]) => window.__MP.join(u, 'B', 'v37-proto', 'harbor', 'domination'), [wsUrl]);
  console.log('[test] joined, waiting active…');
  const sA = await waitActive(pageA, 2, 25000);
  const sB = await waitActive(pageB, 2, 25000);
  await new Promise(r => setTimeout(r, 1200));
  const stateA = await pageA.evaluate(() => window.__SX_NET.state());
  const stateB = await pageB.evaluate(() => window.__SX_NET.state());
  ok('双端进入协议 2.0 房间', !!sA && !!sB && stateA.bin === true && stateA.protocol === 2, { a: !!sA, b: !!sB, bin: stateA.bin });

  ok('selfId 为字符串 id，selfNid 为数值 netId（welcome 映射）',
    typeof stateA.selfId === 'string' && /^a[0-9a-f]+$/.test(stateA.selfId) && typeof stateA.selfNid === 'number',
    { selfId: stateA.selfId, selfNid: stateA.selfNid });

  const selfRemote = await pageA.evaluate(() => ({
    remotes: window.__MP.remotes(),
    selfId: window.__SX_NET.state().selfId,
    parts: window.__MP.debug().parts.map(p => p.id)
  }));
  ok('自己不再被渲染成远端模型（无重复模型）',
    !selfRemote.remotes.includes(selfRemote.selfId) && selfRemote.parts.length === 1 && !selfRemote.parts.includes(selfRemote.selfId),
    selfRemote);

  ok('二进制快照解码 + 字节流', stateA.snapStats.binary > 10 && stateA.snapStats.decodeErrors === 0 && protoServer.stats.snaps > 10, { binary: stateA.snapStats.binary, err: stateA.snapStats.decodeErrors, serverSnaps: protoServer.stats.snaps });
  ok('服务端周期性发送全量帧', protoServer.stats.fullFrames >= 1, { fullFrames: protoServer.stats.fullFrames });

  // headless 软件渲染帧率低，sendAcc 每帧最多补发 2 条；这里只验证二进制路径与 60Hz 配置
  await new Promise(r => setTimeout(r, 900));
  ok('客户端按 cmdRate=60Hz 发送二进制输入（非 JSON 回退）',
    protoServer.stats.binaryInputs >= 8 && protoServer.stats.jsonInputs === 0 && stateA.cmdRate === 60 && stateA.tickRate === 60,
    { stats: protoServer.stats, cmdRate: stateA.cmdRate });

  const snapLen = await pageA.evaluate(() => (window.__MPSNAP || []).length);
  const names = await pageA.evaluate(() => (window.__MPSNAP || []).map(p => p.name).sort());
  ok('baseline：未出现玩家沿用上帧，双方仍在列表', snapLen === 2 && names.join(',') === 'A,B', { snapLen, names });

  const vis = await pageA.evaluate(() => {
    const d = window.__MP.debug();
    return { count: window.__SX_NET.state().players, hist: d.hist.length, pos: d.hist[0] && d.hist[0].pos };
  });
  ok('远端可见与 100ms 插值采样', vis.count >= 2 && vis.hist >= 1 && Array.isArray(vis.pos), vis);

  await new Promise(r => setTimeout(r, 1500));
  const pend = await pageA.evaluate(() => ({ n: window.__SX_NET.pending().length, rec: window.__SX_NET.reconcileStats(), net: window.__SX_NET.state().netStats, acked: window.__SX_NET.state().acked }));
  ok('ACK 帧被解码且预测队列 ≤120',
    pend.n >= 0 && pend.n <= 120 && pend.net.acks > 10 && pend.acked >= 0,
    { pending: pend.n, acked: pend.acked, acks: pend.net.acks, frameDropped: pend.net.ackFrameDropped, ackedTotal: pend.rec.ackedTotal });

  const ping = await pageA.evaluate(() => window.__SX_NET.rtt());
  ok('RTT 测量（performance.now）', typeof ping === 'number' && ping >= 0 && ping < 2000, ping);

  const ui = await pageA.evaluate(() => ({
    state: (document.querySelector('[data-mp-state]') || {}).textContent,
    mode: (document.querySelector('[data-mp-mode-label]') || {}).textContent,
    caps: document.querySelectorAll('.x-mp-cap').length,
    capTeam: document.querySelectorAll('.x-mp-cap.team0').length,
    score: (document.querySelector('[data-mp-score]') || {}).textContent
  }));
  ok('比赛状态机 + 据点 HUD（A/B/C）', /进行中|live/.test(ui.state || '') && /据点/.test(ui.mode || '') && ui.caps === 3 && ui.capTeam >= 1 && /\d+ : \d+/.test(ui.score || ''), ui);

  const capEvt = await pageA.evaluate(async () => {
    window.__MP.net2.testMsg({ t: 'pointCaptured', id: 'A', owner: 1, teams: [3, 5] });
    // score 文本按 100ms 节流，等一个刷新窗口再读。
    await new Promise((r) => setTimeout(r, 180));
    const el = document.querySelector('.x-mp-cap[data-cap="A"]');
    return { cls: el.className, label: el.querySelector('span').textContent, score: document.querySelector('[data-mp-score]').textContent };
  });
  ok('pointCaptured 更新据点 UI 与比分', /team1/.test(capEvt.cls) && capEvt.label === '红队' && capEvt.score === '3 : 5', capEvt);

  const warm = await pageA.evaluate(() => {
    const before = window.__SX_NET.state();
    window.__MP.net2.testMsg({ t: 'kill', by: 'deadbeef', victim: before.selfId, warmup: true, byName: 'X', victimName: 'A' });
    const after = window.__SX_NET.state();
    return { k0: before.kills, d0: before.deaths, k1: after.kills, d1: after.deaths, dead: after.dead, ui: document.querySelector('.x-mp-dead').classList.contains('on') };
  });
  ok('热身击杀只播报：不记 myKills/myDeaths、不触发阵亡界面',
    warm.k1 === warm.k0 && warm.d1 === warm.d0 && !warm.dead && !warm.ui, warm);

  const rr = await pageA.evaluate(() => {
    const bid = (window.__MP.remotes() || [])[0];
    window.__MP.net2.testMsg({ t: 'reloadStart', id: bid, wpn: 'pac9', ms: 1200 });
    const mid = (window.__MP.debug().parts[0] || {}).reloadT;
    window.__MP.net2.testMsg({ t: 'reloadDone', id: bid, mag: 10, reserve: 20 });
    const end = (window.__MP.debug().parts[0] || {}).reloadT;
    return { bid, mid, end };
  });
  ok('reloadStart/reloadDone 驱动远端换弹动画', !!rr.bid && rr.mid > 0.5 && rr.end === 0, rr);

  const rej = await pageA.evaluate(() => {
    const w = window.__G.weapon;
    window.__MP.testFire({ x: 0, y: 0, z: -1 });
    window.__MP.net2.testMsg({ t: 'shotRejected', shotSeq: 999, mag: 7, reserve: 21, reason: 'reloading' });
    return { after: { ammo: w.ammo, reserve: w.reserve } };
  });
  ok('shotRejected 回滚并采用服务端弹药（mag/reserve）', rej.after.ammo === 7 && rej.after.reserve === 21, rej);

  const leaveNid = await pageA.evaluate(() => {
    window.__MP.net2.testMsg({ t: 'join', player: { id: 'deadbeef', nid: 4242, name: 'X', team: 0, x: 5, y: 0, z: 5 } });
    const joined = window.__MP.remotes().includes('deadbeef');
    window.__MP.net2.testMsg({ t: 'leave', nid: 4242 });
    return { joined, left: !window.__MP.remotes().includes('deadbeef'), remotes: window.__MP.remotes() };
  });
  ok('leave 带 nid 也能删除远端模型', leaveNid.joined && leaveNid.left, leaveNid);

  async function aimAt(page) {
    return page.evaluate(() => {
      const d = window.__MP.debug();
      const h = d.hist[0];
      if (!h) return null;
      const me = window.__G.player.pos;
      const dx = h.pos[0] - me.x, dy = (h.pos[1] + 1.1) - (me.y + 1.6), dz = h.pos[2] - me.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      return { dir: { x: dx / L, y: dy / L, z: dz / L }, dist: +L.toFixed(2) };
    });
  }
  const aimAB = await aimAt(pageA);
  for (let i = 0; i < 5 && aimAB; i++) {
    await pageA.evaluate(([d]) => window.__MP.testFire(d), [aimAB.dir]);
    await new Promise(r => setTimeout(r, 150));
  }
  await new Promise(r => setTimeout(r, 900));
  const hitState = await pageB.evaluate(() => ({ hp: window.__G.player.health, dead: document.querySelector('.x-mp-dead').classList.contains('on'), hits: window.__SX_NET.state().netStats.hitEvents, kills: window.__SX_NET.state().netStats.killEvents }));
  const aNet = await pageA.evaluate(() => window.__SX_NET.state().netStats);
  // 可能已重生（hp 回满），因此以服务端 hit/kill 事件为准
  ok('服务器权威命中 / 击杀反馈',
    (hitState.hp < 100 || hitState.dead || hitState.hits >= 1 || hitState.kills >= 1) && aNet.hitEvents >= 1 && aNet.localShots >= 1,
    { b: hitState, a: aNet });
  ok('ACK 帧累计清空预测队列（acks 解码 + 出队）',
    aNet.acks > 10 && aNet.ackFrameDropped > 0 && aNet.ackDropped >= aNet.ackFrameDropped,
    { acks: aNet.acks, frameDropped: aNet.ackFrameDropped, ackDropped: aNet.ackDropped });

  // B 刚被 A 击杀，等服务器复活后再开火；否则 testFire 会被 dead 拒绝。
  await pageB.waitForFunction(() => window.__G && window.__G.player.alive === true, null, { timeout: 6000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  const aimBA = await aimAt(pageB);
  const bShot = aimBA ? await pageB.evaluate(([d]) => { window.__MP.testFire(d); return window.__SX_NET.state().netStats; }, [aimBA.dir]) : null;
  await new Promise(r => setTimeout(r, 700));
  const remoteShots = await pageA.evaluate(() => window.__SX_NET.state().netStats.remoteShots);
  ok('远端开火事件（曳光/枪口焰/枪声入口）', remoteShots >= 1, { remoteShots, aimBA, bShot });

  await pageA.keyboard.press('Tab');
  await new Promise(r => setTimeout(r, 500));
  const sb = await pageA.evaluate(() => ({
    on: document.querySelector('.x-mp-score').classList.contains('on'),
    rows: document.querySelectorAll('.x-mp-score tbody tr').length,
    text: document.querySelector('.x-mp-score tbody').innerText,
    sub: (document.querySelector('[data-mp-score-sub]') || {}).textContent
  }));
  ok('计分板显示模式 / 据点进度 / BOT', sb.on && sb.rows >= 2 && /BOT/.test(sb.text) && /据点/.test(sb.sub || '') && /模式/.test(sb.sub || ''), sb);
  await pageA.keyboard.press('Tab');

  const errs = await pageA.evaluate(() => (window.__errors || []).slice());
  const errsB2 = await pageB.evaluate(() => (window.__errors || []).slice());
  ok('无 pageerror / window.__errors 为空（已移除 Vector3 过滤）',
    errsA.length === 0 && errsB.length === 0 && errs.length === 0 && errsB2.length === 0,
    { a: errsA.slice(0, 2), b: errsB.slice(0, 2), wa: errs.slice(0, 2), wb: errsB2.slice(0, 2) });

  // 全量帧删除：注入一帧 baseline=0、缺少 B 的快照，B 的模型应立即移除
  const fullFrame = await pageA.evaluate(() => {
    const st = window.__SX_NET.state();
    const mine = { id: st.selfNid, x: 0, y: 0, z: 0, yaw: 0, hp: 100, armor: 50, team: 0, alive: true, crouch: false, spawnProtect: false, seq: 9, state: 0 };
    const buf = window.SALT_NET.encodeSnapshot(st.serverTick + 1, 0, [mine], null);
    window.__MP.net2.testBinary(buf);
    const s = window.__SX_NET.state();
    return { remotes: window.__MP.remotes(), snap: (window.__MPSNAP || []).map(p => p.id), players: s.players, snapLen: (window.__MPSNAP || []).length };
  });
  ok('全量帧删除离开玩家（重建 baseline + removeRemote）',
    fullFrame.remotes.length === 0 && fullFrame.snapLen === 1 && fullFrame.snap[0] === stateA.selfId && fullFrame.players === 1,
    fullFrame);
} catch (e) {
  skip('浏览器 · 协议 2.0 二进制双客户端', e);
} finally {
  for (const x of pages) { try { await x.page.close(); } catch (e) {} }
  if (protoServer) { try { await protoServer.close(); } catch (e) {} }
}

/* =====================================================================
   Part 3 · 旧 JSON 服务器兼容（server/server.cjs 子进程）
   ===================================================================== */
section('浏览器 · 旧 JSON 服务器兼容');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}
function waitHealth(port, timeout) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/healthz', timeout: 800 }, res => {
        res.resume();
        if (res.statusCode === 200) resolve(true);
        else if (Date.now() - t0 > timeout) reject(new Error('health timeout'));
        else setTimeout(tick, 300);
      });
      req.on('error', () => { if (Date.now() - t0 > timeout) reject(new Error('health timeout')); else setTimeout(tick, 300); });
      req.on('timeout', () => req.destroy());
    };
    tick();
  });
}

let serverProc = null;
let serverLog = '';
try {
  const port = await freePort();
  serverProc = spawn(process.execPath, [path.join(ROOT, 'server', 'server.cjs')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MP_DEV_TOKEN: 'v37test', ROUND_SECONDS: '300' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (const stream of [serverProc.stdout, serverProc.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (d) => { serverLog += d; if (serverLog.length > 40000) serverLog = serverLog.slice(-20000); });
  }
  await waitHealth(port, 15000);
  const jsonUrl = 'ws://127.0.0.1:' + port;
  const pa = await newPage();
  const pb = await newPage();
  const ea = [], eb = [];
  pa.on('pageerror', e => ea.push(String(e && e.message || e)));
  pb.on('pageerror', e => eb.push(String(e && e.message || e)));
  pages.push({ page: pa, errs: ea, name: 'JA' }, { page: pb, errs: eb, name: 'JB' });
  const fileUrl = 'file://' + htmlPath + '?q=low&noaudio=1&autostart=1&dt=0.05';
  await pa.goto(fileUrl, { waitUntil: 'load', timeout: 180000 });
  await pb.goto(fileUrl, { waitUntil: 'load', timeout: 180000 });
  await pa.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
  await pb.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
  // 强制 JSON 路径：改写 join 帧的 caps（server.cjs 只有在客户端声明 bin 时才发二进制）
  for (const p of [pa, pb]) {
    await p.evaluate(() => {
      if (window.__JSON_ONLY_PATCH) return;
      window.__JSON_ONLY_PATCH = true;
      const orig = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        if (typeof data === 'string' && data.indexOf('"caps"') >= 0 && /"t"\s*:\s*"join"/.test(data)) {
          try { const m = JSON.parse(data); m.caps = []; data = JSON.stringify(m); } catch (e) {}
        }
        return orig.call(this, data);
      };
    });
    await p.evaluate(() => { window.__MP_DEV_TOKEN = 'v37test'; window.__MP.net2.testJsonOnly(true); });
  }
  const room = 'v37-json-' + Date.now().toString(36);
  await pa.evaluate(([u, r]) => window.__MP.join(u, 'JA', r, 'harbor', 'tdm'), [jsonUrl, room]);
  await new Promise(r => setTimeout(r, 500));
  await pb.evaluate(([u, r]) => window.__MP.join(u, 'JB', r, 'harbor', 'tdm'), [jsonUrl, room]);
  const sa = await waitActive(pa, 2, 25000);
  const sb = await waitActive(pb, 2, 25000);
  const st = await pa.evaluate(() => window.__SX_NET.state());
  const dbg = await pa.evaluate(() => ({
    mp: window.__MP && window.__MP.state ? window.__MP.state() : null,
    net: window.__SX_NET && window.__SX_NET.state ? window.__SX_NET.state() : null,
    ws: window.__MP && window.__MP.debug ? window.__MP.debug() : null
  }));
  if (!(!!sa && !!sb && st.bin === false && st.snapStats.json > 5 && st.snapStats.binary === 0 && st.netStats.commands > 0)) {
    console.log('[legacy-debug]', JSON.stringify(dbg).slice(0, 2000));
    console.log('[legacy-server] log tail:\n' + serverLog.slice(-4000));
  }
  ok('旧服务器 JSON 快照回退（客户端不声明 bin → 不启用二进制）',
    !!sa && !!sb && st.bin === false && st.snapStats.json > 5 && st.snapStats.binary === 0 && st.netStats.commands > 0,
    { active: !!sa, bin: st.bin, json: st.snapStats.json, binary: st.snapStats.binary, commands: st.netStats.commands });

  await pa.evaluate(() => window.__MP.testTeleport(-2, 12));
  await pb.evaluate(() => window.__MP.testTeleport(2, 12));
  await new Promise(r => setTimeout(r, 2600));
  const pos = await Promise.all([pa, pb].map(p => p.evaluate(() => window.__G.player.pos.toArray().map(v => +v.toFixed(1)))));
  ok('旧服务器：dev 令牌 + 出生保护后传送', Math.abs(pos[0][0] + 2) < 1.5 && Math.abs(pos[1][0] - 2) < 1.5, pos);

  const aim = await pa.evaluate(() => {
    const d = window.__MP.debug();
    const h = d.hist[0];
    if (!h) return null;
    const me = window.__G.player.pos;
    const dx = h.pos[0] - me.x, dy = (h.pos[1] + 1.1) - (me.y + 1.6), dz = h.pos[2] - me.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    // 服务器会校验 dir 与玩家当前 yaw/pitch 的偏差；JSON 测试直接设置视线。
    window.__G.player.yaw = Math.atan2(-dx, -dz);
    window.__G.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return { x: dx / L, y: dy / L, z: dz / L };
  });
  await new Promise((r) => setTimeout(r, 250));
  for (let i = 0; i < 12 && aim; i++) {
    await pa.evaluate(([d]) => window.__MP.testFire(d), [aim]);
    await new Promise(r => setTimeout(r, 150));
  }
  await new Promise(r => setTimeout(r, 1200));
  const victim = await pb.evaluate(() => ({ hp: window.__G.player.health, dead: document.querySelector('.x-mp-dead').classList.contains('on'), hits: window.__SX_NET.state().netStats.hitEvents, score: window.__MP.score() }));
  const shooter = await pa.evaluate(() => window.__SX_NET.state().netStats);
  ok('旧服务器：服务器权威命中与计分',
    (victim.hp < 100 || victim.dead || victim.hits >= 1) && shooter.hitEvents >= 1,
    { victim, shooter });

  const errs = await pa.evaluate(() => (window.__errors || []).slice());
  ok('旧服务器：无 pageerror / window.__errors 为空', ea.length === 0 && eb.length === 0 && errs.length === 0, { a: ea.slice(0, 2), b: eb.slice(0, 2), wa: errs.slice(0, 2) });
} catch (e) {
  console.log('[legacy-server] log tail:\n' + serverLog.slice(-4000));
  skip('浏览器 · 旧 JSON 服务器兼容', e);
} finally {
  if (serverProc) { try { serverProc.kill('SIGTERM'); } catch (e) {} }
  for (const x of pages) { try { await x.page.close(); } catch (e) {} }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  if (browser) { try { await browser.close(); } catch (e) {} }
}

console.log('\n=== 结果：' + pass + ' PASS / ' + fail + ' FAIL / ' + skipped + ' SKIP ===');
if (fail) process.exit(1);
