/* =====================================================================
   SALTLINE · packages/net/protocol.js — V36 联机协议 2.0（UMD）
   - 二进制量化输入 / 快照，带包类型与版本
   - 快照按“玩家变更”增量：只发与 baseline 不同的玩家
   - 与 JSON 旧协议共存：客户端可声明 caps:['bin']
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SALT_NET = factory(root.SALT_NET || {});
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';
  S = S || {};

  var VERSION = 2;
  var OP = { SNAP: 1, INPUT: 2, WELCOME: 3, PONG: 4, ACK: 5 };
  var BTN = { FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16, RELOAD: 32, MELEE: 64, GRENADE: 128, INTERACT: 256, SCAN: 512 };
  var MAX_PLAYERS = 16;

  function clampQ(v, min, max) { v = v < min ? min : v > max ? max : v; return v; }

  function writeU16(dv, off, v) { dv.setUint16(off, v & 0xffff, true); }
  function writeI16(dv, off, v) { dv.setInt16(off, v, true); }
  function writeU32(dv, off, v) { dv.setUint32(off, v >>> 0, true); }

  /* ---------------- input: C->S ---------------- */
  // 18 bytes: type u8, seq u32, tick u32, buttons u16, mx i8, my i8, yaw u16, pitch i16, slot u8, extra u8
  function encodeInput(cmd) {
    var buf = new ArrayBuffer(18);
    var dv = new DataView(buf);
    dv.setUint8(0, OP.INPUT);
    writeU32(dv, 1, cmd.seq || 0);
    writeU32(dv, 5, cmd.tick || 0);
    writeU16(dv, 9, cmd.buttons || 0);
    dv.setInt8(11, Math.round(clampQ(cmd.mx || 0, -1, 1) * 127));
    dv.setInt8(12, Math.round(clampQ(cmd.my || 0, -1, 1) * 127));
    writeU16(dv, 13, Math.round(((cmd.yaw || 0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 65535));
    writeI16(dv, 15, Math.round(clampQ(cmd.pitch || 0, -1.55, 1.55) * 10000));
    dv.setUint8(17, (cmd.slot || 0) & 15);
    return buf;
  }
  function decodeInput(buf) {
    var dv = new DataView(buf);
    if (dv.byteLength < 18 || dv.getUint8(0) !== OP.INPUT) return null;
    return {
      seq: dv.getUint32(1, true), tick: dv.getUint32(5, true), buttons: dv.getUint16(9, true),
      mx: dv.getInt8(11) / 127, my: dv.getInt8(12) / 127,
      yaw: dv.getUint16(13, true) / 65535 * Math.PI * 2,
      pitch: dv.getInt16(15, true) / 10000,
      slot: dv.getUint8(17) & 15
    };
  }

  /* ---------------- snapshot: S->C ---------------- */
  // header: type u8, version u8, tick u32, baseline u32, count u8
  // player (16B): id u16, x i16(.02), z i16(.02), y i16(.01), yaw u16, hp u8, armor u8, team/flags u8, seq u8, state u8
  var P_STRIDE = 16;
  function encodeSnapshot(tick, baselineTick, players, prev) {
    var list = [];
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var prevP = prev && prev[p.id];
      if (prevP && sameSnapshot(p, prevP)) continue;
      list.push(p);
    }
    var buf = new ArrayBuffer(11 + list.length * P_STRIDE);
    var dv = new DataView(buf);
    dv.setUint8(0, OP.SNAP);
    dv.setUint8(1, VERSION);
    writeU32(dv, 2, tick);
    writeU32(dv, 6, baselineTick || 0);
    dv.setUint8(10, list.length);
    var off = 11;
    for (var k = 0; k < list.length; k++) {
      var q = list[k];
      writeU16(dv, off, q.id);
      writeI16(dv, off + 2, Math.round(clampQ(q.x, -655, 655) * 50));
      writeI16(dv, off + 4, Math.round(clampQ(q.z, -655, 655) * 50));
      writeI16(dv, off + 6, Math.round(clampQ(q.y, -327.6, 327.6) * 100));
      writeU16(dv, off + 8, Math.round(((q.yaw || 0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 65535));
      dv.setUint8(off + 10, Math.max(0, Math.min(255, q.hp | 0)));
      dv.setUint8(off + 11, Math.max(0, Math.min(255, q.armor | 0)));
      dv.setUint8(off + 12, ((q.team & 1) | (q.alive === false ? 2 : 0) | (q.crouch ? 4 : 0) | (q.spawnProtect ? 8 : 0)));
      dv.setUint8(off + 13, (q.seq || 0) & 255);
      dv.setUint8(off + 14, (q.state || 0) & 255);
      dv.setUint8(off + 15, 0);
      off += P_STRIDE;
    }
    return buf;
  }
  function sameSnapshot(a, b) {
    return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.005 && Math.abs(a.z - b.z) < 0.01 &&
      Math.abs(a.yaw - b.yaw) < 0.002 && a.hp === b.hp && a.armor === b.armor && a.team === b.team &&
      (a.alive !== false) === (b.alive !== false) &&
      !!a.crouch === !!b.crouch && !!a.spawnProtect === !!b.spawnProtect &&
      (a.state | 0) === (b.state | 0);
  }
  // 每帧独立的 ack 小帧：不参与“玩家变更”判定，避免站定玩家 ack 停滞
  function encodeAck(tick, seq) {
    var buf = new ArrayBuffer(10);
    var dv = new DataView(buf);
    dv.setUint8(0, OP.ACK);
    dv.setUint8(1, VERSION);
    writeU32(dv, 2, tick || 0);
    writeU32(dv, 6, seq >>> 0);
    return buf;
  }
  function decodeAck(buf) {
    var dv = new DataView(buf);
    if (dv.byteLength < 10 || dv.getUint8(0) !== OP.ACK) return null;
    return { tick: dv.getUint32(2, true), seq: dv.getUint32(6, true) };
  }
  function decodeSnapshot(buf) {
    var dv = new DataView(buf);
    if (dv.byteLength < 11 || dv.getUint8(0) !== OP.SNAP) return null;
    if (dv.getUint8(1) !== VERSION) return null;
    var tick = dv.getUint32(2, true), baseline = dv.getUint32(6, true), n = dv.getUint8(10);
    if (dv.byteLength < 11 + n * P_STRIDE) return null;
    var out = [];
    var off = 11;
    for (var i = 0; i < n; i++) {
      var flags = dv.getUint8(off + 12);
      out.push({
        id: dv.getUint16(off, true),
        x: dv.getInt16(off + 2, true) / 50,
        z: dv.getInt16(off + 4, true) / 50,
        y: dv.getInt16(off + 6, true) / 100,
        yaw: dv.getUint16(off + 8, true) / 65535 * Math.PI * 2,
        hp: dv.getUint8(off + 10),
        armor: dv.getUint8(off + 11),
        team: flags & 1,
        alive: (flags & 2) === 0,
        crouch: !!(flags & 4),
        spawnProtect: !!(flags & 8),
        seq: dv.getUint8(off + 13),
        state: dv.getUint8(off + 14)
      });
      off += P_STRIDE;
    }
    return { tick: tick, baseline: baseline, players: out };
  }

  S.VERSION = VERSION;
  S.OP = OP;
  S.BTN = BTN;
  S.P_STRIDE = P_STRIDE;
  S.encodeInput = encodeInput;
  S.decodeInput = decodeInput;
  S.encodeSnapshot = encodeSnapshot;
  S.decodeSnapshot = decodeSnapshot;
  S.encodeAck = encodeAck;
  S.decodeAck = decodeAck;
  S.quantize = function (v, step) { return Math.round(v / step) * step; };
  return S;
});
