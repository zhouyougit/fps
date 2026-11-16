/* tests/unit/protocol.test.mjs — 二进制协议 2.0 单元测试（NET-4）
 * 只覆盖 packages/net/protocol.js 的纯逻辑；不启动浏览器 / 网络 / 计时器。
 * 期望行为按 AGENTS.md 的协议不变量：首字节分发（SNAP=1/ACK=5）、version=2、
 * 输入按钮位、u32 序号、yaw/pitch 量化、数值 nid、全量帧 baseline=0、截断帧不抛崩。
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NET = require("../../packages/net/protocol.js");
const NET2 = require("../../src/ext_net2.js");
const COMMAND = require("../../packages/sim/command.js").command;

const TAU = Math.PI * 2;
const BASE_BITS = {
  FIRE: 1, ADS: 2, JUMP: 4, SPRINT: 8, CROUCH: 16,
  RELOAD: 32, MELEE: 64, GRENADE: 128, INTERACT: 256, SCAN: 512,
};

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return Math.abs(d);
}
function withByte(buf, offset, value) {
  const copy = new Uint8Array(buf.slice(0));
  copy[offset] = value;
  return copy.buffer;
}
function snapPlayer(over) {
  return Object.assign({
    id: 1, x: 0, y: 0, z: 0, yaw: 0, hp: 100, armor: 50,
    team: 0, alive: true, crouch: false, spawnProtect: false, seq: 0, state: 0,
  }, over || {});
}
function decodePlayers(buf) {
  const dec = NET.decodeSnapshot(buf);
  assert.ok(dec, "decodeSnapshot 应成功");
  return dec.players;
}

describe("协议常量与首字节分发", () => {
  test("VERSION=2，OP 首字节固定，帧长固定（input 18 / snap 头 11 / ack 10）", () => {
    assert.equal(NET.VERSION, 2);
    assert.deepEqual(NET.OP, { SNAP: 1, INPUT: 2, WELCOME: 3, PONG: 4, ACK: 5 });
    assert.equal(NET.encodeInput({}).byteLength, 18);
    assert.equal(NET.encodeSnapshot(1, 0, [], null).byteLength, 11);
    assert.equal(NET.encodeAck(1, 1).byteLength, 10);
  });

  test("首字节：SNAP=1 / INPUT=2 / ACK=5，且 version 字节为 2", () => {
    const snap = NET.encodeSnapshot(7, 0, [snapPlayer({ id: 1 })], null);
    const input = NET.encodeInput({ seq: 1 });
    const ack = NET.encodeAck(7, 3);
    assert.equal(new Uint8Array(snap)[0], NET.OP.SNAP);
    assert.equal(new Uint8Array(input)[0], NET.OP.INPUT);
    assert.equal(new Uint8Array(ack)[0], NET.OP.ACK);
    assert.equal(new Uint8Array(snap)[1], 2);
    assert.equal(new Uint8Array(ack)[1], 2);
  });

  test("解码器由首字节决定：跨类型帧返回 null，未知类型也不抛", () => {
    const snap = NET.encodeSnapshot(7, 0, [snapPlayer({ id: 1 })], null);
    const input = NET.encodeInput({ seq: 1 });
    const ack = NET.encodeAck(7, 3);
    assert.equal(NET.decodeSnapshot(ack), null);
    assert.equal(NET.decodeSnapshot(input), null);
    assert.equal(NET.decodeAck(snap), null);
    assert.equal(NET.decodeAck(input), null);
    assert.equal(NET.decodeInput(snap), null);
    assert.equal(NET.decodeInput(ack), null);

    assert.equal(NET.decodeSnapshot(withByte(snap, 0, 9)), null);
    assert.equal(NET.decodeAck(withByte(ack, 0, 9)), null);
    assert.equal(NET.decodeInput(withByte(input, 0, 9)), null);
  });
});

describe("输入命令：18 字节布局与按钮位", () => {
  test("字段偏移：type u8 / seq u32 / tick u32 / buttons u16 / mx,my i8 / yaw u16 / pitch i16 / slot u8", () => {
    const buf = NET.encodeInput({
      seq: 0x01020304, tick: 0x05060708, buttons: 0x090a,
      mx: 1, my: -1, yaw: Math.PI, pitch: 0.25, slot: 3,
    });
    const dv = new DataView(buf);
    assert.equal(dv.byteLength, 18);
    assert.equal(dv.getUint8(0), NET.OP.INPUT);
    assert.equal(dv.getUint32(1, true), 0x01020304);
    assert.equal(dv.getUint32(5, true), 0x05060708);
    assert.equal(dv.getUint16(9, true), 0x090a);
    assert.equal(dv.getInt8(11), 127);
    assert.equal(dv.getInt8(12), -127);
    assert.equal(dv.getUint16(13, true), 32768);
    assert.equal(dv.getInt16(15, true), 2500);
    assert.equal(dv.getUint8(17), 3);
  });

  test("10 个基础按钮位逐一往返，且 protocol / ext_net2 / sim 三张表一致", () => {
    for (const [name, bit] of Object.entries(BASE_BITS)) {
      assert.equal(NET.BTN[name], bit, "protocol.BTN." + name);
      assert.equal(NET2.BTN[name], bit, "ext_net2.BTN." + name);
      assert.equal(COMMAND.BTN[name], bit, "sim.command.BTN." + name);
      const dec = NET.decodeInput(NET.encodeInput({ buttons: bit }));
      assert.equal(dec.buttons, bit, "往返 " + name);
    }
    const all = Object.values(BASE_BITS).reduce((a, b) => a | b, 0);
    assert.equal(all, 1023);
    assert.equal(NET.decodeInput(NET.encodeInput({ buttons: all })).buttons, all);
    // 表内每个值都能在共享 sim 表里找到同义项（新增位时防止单边改表）
    for (const [name, bit] of Object.entries(NET.BTN)) {
      assert.equal(COMMAND.BTN[name], bit, "共享表缺 " + name);
    }
    for (const [name, bit] of Object.entries(NET2.BTN)) {
      assert.equal(COMMAND.BTN[name], bit, "ext_net2 表与 sim 不一致 " + name);
    }
  });

  test("侧身位 1024/2048 在 u16 传输层可原样承载（NET-5 缺口在 BTN 表，不在编码）", () => {
    assert.equal(COMMAND.BTN.LEAN_L, 1024);
    assert.equal(COMMAND.BTN.LEAN_R, 2048);
    for (const bit of [COMMAND.BTN.LEAN_L, COMMAND.BTN.LEAN_R]) {
      assert.equal(NET.decodeInput(NET.encodeInput({ buttons: bit })).buttons, bit);
    }
    assert.equal(NET.decodeInput(NET.encodeInput({ buttons: 1024 | 2048 })).buttons, 3072);
  });

  test("NET-5：protocol/ext_net2 的 BTN 导出侧身位 LEAN_L/LEAN_R", () => {
    assert.equal(NET.BTN.LEAN_L, 1024);
    assert.equal(NET.BTN.LEAN_R, 2048);
    assert.equal(NET2.BTN.LEAN_L, 1024);
    assert.equal(NET2.BTN.LEAN_R, 2048);
  });

  test("buttons 是 u16：0xffff 往返，超出/负数按 16 位截断", () => {
    for (const [raw, expected] of [
      [0, 0], [0xffff, 0xffff], [-1, 0xffff], [0x10000, 0],
      [0x10001, 1], [0x1ffff, 0xffff],
    ]) {
      assert.equal(NET.decodeInput(NET.encodeInput({ buttons: raw })).buttons, expected, "buttons=" + raw);
    }
    assert.equal(NET.decodeInput(NET.encodeInput({})).buttons, 0);
    assert.equal(NET.decodeInput(NET.encodeInput({ buttons: NaN })).buttons, 0);
    assert.equal(NET.decodeInput(NET.encodeInput({ buttons: undefined })).buttons, 0);
  });
});

describe("输入命令：seq/tick/yaw/pitch/mx/my/slot 边界", () => {
  test("seq/tick 是 u32 小端：0、0x7fffffff、0xffffffff、-1、2^32 回绕", () => {
    const cases = [
      [0, 0], [1, 1], [0x7fffffff, 0x7fffffff], [0x80000000, 0x80000000],
      [0xffffffff, 0xffffffff], [-1, 0xffffffff], [0x100000000, 0], [0x100000007, 7],
    ];
    for (const [raw, expected] of cases) {
      const dec = NET.decodeInput(NET.encodeInput({ seq: raw, tick: raw }));
      assert.equal(dec.seq, expected, "seq=" + raw);
      assert.equal(dec.tick, expected, "tick=" + raw);
    }
    const dec = NET.decodeInput(NET.encodeInput({ seq: 123456, tick: 8888 }));
    assert.equal(dec.seq, 123456);
    assert.equal(dec.tick, 8888);
  });

  test("yaw 归一化到 [0,2π) 并量化为 u16", () => {
    const cases = [0, Math.PI / 2, Math.PI, -Math.PI / 2, TAU, -TAU, TAU - 1e-4, -1e-4, 1e9];
    for (const raw of cases) {
      const expected = ((raw % TAU) + TAU) % TAU;
      const dec = NET.decodeInput(NET.encodeInput({ yaw: raw }));
      assert.ok(dec.yaw >= 0 && dec.yaw <= TAU, "yaw 越界 " + raw);
      assert.ok(angleDiff(dec.yaw, expected) < 2e-4, "yaw=" + raw + " -> " + dec.yaw);
    }
    assert.equal(NET.decodeInput(NET.encodeInput({ yaw: NaN })).yaw, 0);
  });

  test("pitch 为 i16（/10000），钳制在 ±1.55", () => {
    const cases = [[0, 0], [0.4, 0.4], [0.1234, 0.1234], [1.55, 1.55], [-1.55, -1.55],
      [10, 1.55], [-10, -1.55], [Infinity, 1.55], [-Infinity, -1.55], [NaN, 0]];
    for (const [raw, expected] of cases) {
      const dec = NET.decodeInput(NET.encodeInput({ pitch: raw }));
      assert.ok(Math.abs(dec.pitch - expected) < 1e-4, "pitch=" + raw + " -> " + dec.pitch);
    }
  });

  test("mx/my 钳制到 [-1,1] 并量化为 i8（/127）", () => {
    const cases = [[0, 0], [0.5, 0.5], [1, 1], [-1, -1], [2, 1], [-2, -1],
      [Infinity, 1], [-Infinity, -1], [NaN, 0]];
    for (const [raw, expected] of cases) {
      const dec = NET.decodeInput(NET.encodeInput({ mx: raw, my: raw }));
      assert.ok(Math.abs(dec.mx - expected) <= 1 / 127 + 1e-9, "mx=" + raw + " -> " + dec.mx);
      assert.ok(Math.abs(dec.my - expected) <= 1 / 127 + 1e-9, "my=" + raw + " -> " + dec.my);
    }
  });

  test("slot 是低 4 位：0..15 往返，16/-1/255 按掩码处理", () => {
    for (let i = 0; i <= 15; i++) {
      assert.equal(NET.decodeInput(NET.encodeInput({ slot: i })).slot, i);
    }
    assert.equal(NET.decodeInput(NET.encodeInput({ slot: 16 })).slot, 0);
    assert.equal(NET.decodeInput(NET.encodeInput({ slot: -1 })).slot, 15);
    assert.equal(NET.decodeInput(NET.encodeInput({ slot: 255 })).slot, 15);
    assert.equal(NET.decodeInput(NET.encodeInput({ slot: NaN })).slot, 0);
  });
});

describe("快照编码/解码：字段、量化、nid", () => {
  test("头部：type/version/tick/baseline/count 与 16 字节玩家 stride", () => {
    const p = snapPlayer({
      id: 7, x: 1.23, z: -4.56, y: 0.78, yaw: 1.234,
      hp: 90, armor: 25, team: 1, alive: false, crouch: true, spawnProtect: true, seq: 200, state: 3,
    });
    const buf = NET.encodeSnapshot(123, 0, [p], null);
    assert.equal(buf.byteLength, 11 + 16);
    const dv = new DataView(buf);
    assert.equal(dv.getUint8(0), NET.OP.SNAP);
    assert.equal(dv.getUint8(1), NET.VERSION);
    assert.equal(dv.getUint32(2, true), 123);
    assert.equal(dv.getUint32(6, true), 0);
    assert.equal(dv.getUint8(10), 1);
    assert.equal(dv.getUint16(11, true), 7);
    assert.equal(dv.getUint8(26), 0, "保留字节");

    const dec = NET.decodeSnapshot(buf);
    assert.equal(dec.tick, 123);
    assert.equal(dec.baseline, 0);
    assert.equal(dec.players.length, 1);
    const q = dec.players[0];
    assert.equal(q.id, 7);
    assert.ok(Math.abs(q.x - 1.23) < 0.011);
    assert.equal(q.z, -4.56);
    assert.ok(Math.abs(q.y - 0.78) < 0.006);
    assert.ok(angleDiff(q.yaw, 1.234) < 1e-4);
    assert.equal(q.hp, 90);
    assert.equal(q.armor, 25);
    assert.equal(q.team, 1);
    assert.equal(q.alive, false);
    assert.equal(q.crouch, true);
    assert.equal(q.spawnProtect, true);
    assert.equal(q.seq, 200);
    assert.equal(q.state, 3);
  });

  test("位置/HP/护甲/队伍/序号按协议钳制（id 0 与 65535 均可）", () => {
    const q = snapPlayer({
      id: 65535, x: 10000, z: -10000, y: 1000, hp: -5, armor: 999,
      team: 2, alive: undefined, crouch: undefined, spawnProtect: undefined, seq: 999, state: 999,
    });
    const dec = decodePlayers(NET.encodeSnapshot(1, 0, [q], null))[0];
    assert.equal(dec.id, 65535);
    assert.equal(dec.x, 655);
    assert.equal(dec.z, -655);
    assert.equal(dec.y, 327.6);
    assert.equal(dec.hp, 0);
    assert.equal(dec.armor, 255);
    assert.equal(dec.team, 0, "team 只保留最低位");
    assert.equal(dec.alive, true, "alive 缺省视为存活");
    assert.equal(dec.crouch, false);
    assert.equal(dec.spawnProtect, false);
    assert.equal(dec.seq, 231);
    assert.equal(dec.state, 231);

    const ids = decodePlayers(NET.encodeSnapshot(1, 0, [snapPlayer({ id: 0 }), snapPlayer({ id: 65535 })], null)).map((p) => p.id);
    assert.deepEqual(ids, [0, 65535]);
    const opposite = decodePlayers(NET.encodeSnapshot(1, 0, [snapPlayer({ id: 1, x: -10000, z: 10000, y: -1000, team: 3 })], null))[0];
    assert.equal(opposite.x, -655);
    assert.equal(opposite.z, 655);
    assert.equal(opposite.y, -327.6);
    assert.equal(opposite.team, 1);
  });

  test("队伍/存活/蹲伏/出生保护组合位按 flags 编码", () => {
    const players = [
      snapPlayer({ id: 1, team: 0, alive: true, crouch: false, spawnProtect: false }),
      snapPlayer({ id: 2, team: 1, alive: false, crouch: false, spawnProtect: false }),
      snapPlayer({ id: 3, team: 0, alive: true, crouch: true, spawnProtect: false }),
      snapPlayer({ id: 4, team: 1, alive: true, crouch: false, spawnProtect: true }),
      snapPlayer({ id: 5, team: 1, alive: false, crouch: true, spawnProtect: true }),
    ];
    const dec = decodePlayers(NET.encodeSnapshot(2, 0, players, null));
    assert.deepEqual(dec.map((p) => [p.team, p.alive, p.crouch, p.spawnProtect]), [
      [0, true, false, false],
      [1, false, false, false],
      [0, true, true, false],
      [1, true, false, true],
      [1, false, true, true],
    ]);
  });

  test("全量帧 baseline=0 必须包含所有玩家（prev=null）", () => {
    const all = [snapPlayer({ id: 1, x: 1 }), snapPlayer({ id: 2, x: 2 })];
    const dec = NET.decodeSnapshot(NET.encodeSnapshot(42, 0, all, null));
    assert.equal(dec.tick, 42);
    assert.equal(dec.baseline, 0);
    assert.equal(dec.players.length, 2);
    const empty = NET.decodeSnapshot(NET.encodeSnapshot(43, 0, [], null));
    assert.equal(empty.baseline, 0);
    assert.equal(empty.players.length, 0);
  });

  test("增量帧按 sameSnapshot 阈值过滤：位置 0.01/0.005、yaw 0.002、离散字段变化", () => {
    const base = snapPlayer({ id: 2, x: 4, y: 0, z: 1, yaw: 0.4, hp: 80, armor: 20, team: 1, seq: 9 });
    const prev = { 2: base };
    const count = (changed) => decodePlayers(NET.encodeSnapshot(1, 0, [changed], prev)).length;

    assert.equal(NET.encodeSnapshot(1, 0, [base], prev).byteLength, 11);
    for (const [field, delta, expected] of [
      ["x", 0.009, 0], ["x", 0.012, 1],
      ["y", 0.004, 0], ["y", 0.006, 1],
      ["z", 0.009, 0], ["z", 0.012, 1],
      ["yaw", 0.001, 0], ["yaw", 0.003, 1],
    ]) {
      assert.equal(count(Object.assign({}, base, { [field]: base[field] + delta })), expected, field + "+" + delta);
    }
    for (const [field, value] of [
      ["hp", 79], ["armor", 19], ["team", 0], ["alive", false],
      ["crouch", true], ["spawnProtect", true], ["state", 1],
    ]) {
      assert.equal(count(Object.assign({}, base, { [field]: value })), 1, field + "=" + value);
    }
    // seq 单独变化不触发增量：ACK 走每帧独立小帧，不占快照带宽。
    assert.equal(count(Object.assign({}, base, { seq: 10 })), 0);
  });

  test("增量帧保留调用方给的 baseline tick", () => {
    const base = snapPlayer({ id: 2, x: 4 });
    const changed = Object.assign({}, base, { x: 9 });
    const dec = NET.decodeSnapshot(NET.encodeSnapshot(9, 7, [changed], { 2: base }));
    assert.equal(dec.baseline, 7);
    assert.equal(dec.tick, 9);
    assert.equal(dec.players.length, 1);
  });

  test("快照 id 是数值 nid：经 ext_net2.IdMap 映射为字符串 id（含自己）", () => {
    const dec = NET.decodeSnapshot(NET.encodeSnapshot(5, 0, [
      snapPlayer({ id: 7, x: 1 }), snapPlayer({ id: 3, x: 2 }),
    ], null));
    const map = new NET2.IdMap();
    map.setSelf("a1b2c3d4", 7);
    map.registerPlayer({ id: "ff00aa11", nid: 3 });
    const resolved = dec.players.map((p) => map.resolve(p.id));
    assert.deepEqual(resolved.slice().sort(), ["a1b2c3d4", "ff00aa11"]);
    assert.ok(!resolved.includes(7), "数值 nid 不应泄漏到逻辑层");
    assert.equal(map.nidOf("a1b2c3d4"), 7);
    assert.equal(map.nidOf("ff00aa11"), 3);
    assert.equal(map.resolve(7), "a1b2c3d4");
    assert.equal(map.resolve("ff00aa11"), "ff00aa11");
    assert.equal(NET.decodeSnapshot(NET.encodeSnapshot(6, 0, [snapPlayer({ id: 7 })], null)).players[0].id, 7);
  });

  test("tick/baseline 是 u32：0xffffffff 往返", () => {
    const dec = NET.decodeSnapshot(NET.encodeSnapshot(0xffffffff, 0xffffffff, [], null));
    assert.equal(dec.tick, 0xffffffff);
    assert.equal(dec.baseline, 0xffffffff);
  });
});

describe("帧截断 / 非法类型 / 非法版本不抛崩", () => {
  test("快照：0..26 字节截断一律返回 null", () => {
    const full = NET.encodeSnapshot(1, 0, [snapPlayer({ id: 1 })], null);
    for (let len = 0; len < 27; len++) {
      assert.equal(NET.decodeSnapshot(full.slice(0, len)), null, "snapshot len=" + len);
    }
  });

  test("快照：错误 type/version、count 超出实际负载都返回 null", () => {
    const full = NET.encodeSnapshot(1, 0, [snapPlayer({ id: 1 })], null);
    assert.equal(NET.decodeSnapshot(withByte(full, 0, NET.OP.ACK)), null);
    assert.equal(NET.decodeSnapshot(withByte(full, 0, NET.OP.INPUT)), null);
    assert.equal(NET.decodeSnapshot(withByte(full, 0, 0)), null);
    assert.equal(NET.decodeSnapshot(withByte(full, 1, 1)), null);
    assert.equal(NET.decodeSnapshot(withByte(full, 1, 3)), null);
    assert.equal(NET.decodeSnapshot(withByte(full, 1, 255)), null);
    assert.equal(NET.decodeSnapshot(withByte(full, 10, 2)), null, "count=2 但只有 1 条");
    assert.equal(NET.decodeSnapshot(withByte(full, 10, 255)), null);
    assert.equal(decodePlayers(withByte(full, 10, 0)).length, 0, "count=0 时尾部被忽略");
  });

  test("快照：多余尾部字节被忽略（向前兼容），全零缓冲区不抛", () => {
    const full = NET.encodeSnapshot(1, 0, [snapPlayer({ id: 1 })], null);
    const tail = new Uint8Array(full.byteLength + 8);
    tail.set(new Uint8Array(full));
    const dec = NET.decodeSnapshot(tail.buffer);
    assert.equal(dec.players.length, 1);
    for (let len = 0; len <= 40; len++) {
      assert.doesNotThrow(() => NET.decodeSnapshot(new ArrayBuffer(len)), "len=" + len);
      assert.equal(NET.decodeSnapshot(new ArrayBuffer(len)), null, "len=" + len);
    }
  });

  test("ACK：0..9 字节截断返回 null，错误 type 返回 null，tick/seq 是 u32", () => {
    const ack = NET.encodeAck(1, 1);
    for (let len = 0; len < 10; len++) {
      assert.equal(NET.decodeAck(ack.slice(0, len)), null, "ack len=" + len);
    }
    assert.equal(NET.decodeAck(withByte(ack, 0, NET.OP.SNAP)), null);
    assert.equal(NET.decodeAck(withByte(ack, 0, NET.OP.INPUT)), null);
    assert.equal(NET.decodeAck(new ArrayBuffer(10)), null);

    const max = NET.decodeAck(NET.encodeAck(0xffffffff, 0xffffffff));
    assert.equal(max.tick, 0xffffffff);
    assert.equal(max.seq, 0xffffffff);
    const tail = new Uint8Array(ack.byteLength + 3);
    tail.set(new Uint8Array(ack));
    assert.deepEqual(NET.decodeAck(tail.buffer), { tick: 1, seq: 1 });
  });

  test("输入：0..17 字节截断返回 null，错误 type 返回 null", () => {
    const input = NET.encodeInput({ seq: 1 });
    for (let len = 0; len < 18; len++) {
      assert.equal(NET.decodeInput(input.slice(0, len)), null, "input len=" + len);
    }
    assert.equal(NET.decodeInput(withByte(input, 0, NET.OP.SNAP)), null);
    assert.equal(NET.decodeInput(withByte(input, 0, NET.OP.ACK)), null);
    const tail = new Uint8Array(input.byteLength + 5);
    tail.set(new Uint8Array(input));
    assert.equal(NET.decodeInput(tail.buffer).seq, 1);
  });
});
