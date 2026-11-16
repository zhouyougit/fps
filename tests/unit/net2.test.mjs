/* tests/unit/net2.test.mjs — 客户端网络层纯逻辑（NET-4）
 * ext_net2.js 在 Node 下可 require（UMD），不触碰 DOM；mp.js 是浏览器 IIFE，
 * 对无法加载的部分（插值 / RTT / 未知消息 / 背压）做源码级断言 + 可安全提取的
 * onMsg 行为测试。全部确定性：无网络、无浏览器、无真实计时器。
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const NET2 = require("../../src/ext_net2.js");
const PROTO = require("../../packages/net/protocol.js");
const SIM = require("../../packages/sim");
const COMMAND = require("../../packages/sim/command.js").command;

const MP_SRC = readFileSync(new URL("../../src/mp.js", import.meta.url), "utf8");
const COMMAND_SRC = readFileSync(new URL("../../packages/sim/command.js", import.meta.url), "utf8");
const SERVER_SRC = readFileSync(new URL("../../server/server.cjs", import.meta.url), "utf8");

function extractFunction(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert.ok(start >= 0, "找不到函数 " + name);
  const open = src.indexOf("{", start);
  assert.ok(open > start, "找不到函数体 " + name);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail("函数体未闭合 " + name);
}

function makeWorld() {
  return SIM.world.createWorld({
    boxes: [{ min: [-30, -1, -30], max: [30, 0, 30] }],
    bounds: { min: [-30, 0, -30], max: [30, 20, 30] },
    groundY: 0, seaY: -999, quayX: 999,
  });
}
function baseState() {
  return {
    pos: { x: 0, y: 0.02, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0, onGround: true, crouching: false, crouch01: 0,
    ads: 0, adsLin: 0, sprinting: false, height: 1.8, radius: 0.4,
    alive: true, health: 100, maxHealth: 100, prevButtons: 0, tick: 0,
    jumpBuf: 0, coyote: 0.12, slideT: 0, vaultT: 0, lean: 0,
    sinceDamage: 0, spawnProtect: false,
  };
}
function snapPlayer(over) {
  return Object.assign({
    id: 1, x: 0, y: 0, z: 0, yaw: 0, hp: 100, armor: 50,
    team: 0, alive: true, crouch: false, spawnProtect: false, seq: 0, state: 0,
  }, over || {});
}

describe("Node 加载与纯函数入口", () => {
  test("版本/CAPS/队列上限/DEFAULT_STEP 与浏览器侧一致", () => {
    assert.equal(NET2.VERSION, 2);
    assert.equal(PROTO.VERSION, 2);
    assert.ok(NET2.CAPS.includes("bin"));
    assert.ok(Object.isFrozen(NET2.CAPS));
    assert.equal(NET2.MAX_PENDING, 120);
    assert.equal(NET2.DEFAULT_STEP, 1 / 30);
    assert.equal(NET2.BTN.FIRE, 1);
    assert.equal(NET2.BTN.SCAN, 512);
  });

  test("protocol()/sim() 在 Node 下能解析到真实共享模块", () => {
    const p = NET2.protocol();
    assert.ok(p && typeof p.decodeSnapshot === "function");
    assert.ok(typeof p.encodeInput === "function");
    assert.equal(p, PROTO);
    const s = NET2.sim();
    assert.ok(s && typeof s.stepPlayer === "function");
    assert.ok(s === SIM || typeof s.createPlayerState === "function");
  });

  test("root.SALT_NET / root.SALT_SIM 优先于 require（浏览器共享命名空间路径）", () => {
    const hadNet = Object.prototype.hasOwnProperty.call(globalThis, "SALT_NET");
    const prevNet = globalThis.SALT_NET;
    const hadSim = Object.prototype.hasOwnProperty.call(globalThis, "SALT_SIM");
    const prevSim = globalThis.SALT_SIM;
    const fakeNet = { decodeSnapshot() { return null; } };
    const fakeSim = { stepPlayer() {} };
    globalThis.SALT_NET = fakeNet;
    globalThis.SALT_SIM = fakeSim;
    try {
      assert.equal(NET2.protocol(), fakeNet);
      assert.equal(NET2.sim(), fakeSim);
    } finally {
      if (hadNet) globalThis.SALT_NET = prevNet; else delete globalThis.SALT_NET;
      if (hadSim) globalThis.SALT_SIM = prevSim; else delete globalThis.SALT_SIM;
    }
    assert.equal(NET2.protocol(), PROTO);
  });

  test("无 DOM 时 install/addLobbyMode 安全失败，不抛", () => {
    assert.equal(typeof globalThis.window, "undefined");
    assert.equal(typeof globalThis.document, "undefined");
    assert.equal(NET2.install(), false);
    assert.equal(NET2.install({ net2: {} }), false);
    assert.equal(NET2.addLobbyMode(), false);
  });
});

describe("IdMap：nid <-> 字符串 id", () => {
  test("setSelf/registerPlayer/nidOf/resolve 双向且幂等", () => {
    const map = new NET2.IdMap();
    assert.equal(map.setSelf("self-hex", 7), "self-hex");
    assert.equal(map.registerPlayer({ id: "a-hex", nid: 3 }), "a-hex");
    assert.equal(map.registerPlayer({ id: "b-hex", netId: 4 }), "b-hex");
    assert.equal(map.resolve(7), "self-hex");
    assert.equal(map.resolve(3), "a-hex");
    assert.equal(map.resolve(4), "b-hex");
    assert.equal(map.resolve("a-hex"), "a-hex");
    assert.equal(map.resolve("unknown"), "unknown");
    assert.equal(map.resolve(null), null);
    assert.equal(map.nidOf("a-hex"), 3);
    assert.equal(map.nidOf("self-hex"), 7);
    assert.equal(map.nidOf("unknown"), undefined);
    assert.equal(map.register(), null);
    assert.equal(map.register(null, null), null);
  });

  test("旧 JSON 服务器：缺 nid 时回退原 id；数值 id 也能被字符串化", () => {
    const map = new NET2.IdMap();
    assert.equal(map.setSelf("ABC123", null), "ABC123");
    assert.equal(map.resolve("ABC123"), "ABC123");
    assert.equal(map.nidOf("ABC123"), "ABC123");
    assert.equal(map.register(5), "5");
    assert.equal(map.resolve(5), "5");
    assert.equal(map.resolve("5"), "5");
    assert.equal(map.nidOf("5"), 5);
    const legacy = new NET2.IdMap();
    assert.equal(legacy.setSelf(1), "1");
    assert.equal(legacy.resolve(1), "1");
  });

  test("clear 后映射重置但 resolve 未知 id 仍原样返回", () => {
    const map = new NET2.IdMap();
    map.setSelf("self", 7);
    assert.equal(map.clear(), map);
    assert.equal(map.resolve(7), "7");
    assert.equal(map.resolve("self"), "self");
    assert.equal(map.nidOf("self"), undefined);
  });

  test("registerPlayer 接受只有 nid 的条目", () => {
    const map = new NET2.IdMap();
    assert.equal(map.registerPlayer({ nid: 9 }), "9");
    assert.equal(map.resolve(9), "9");
    assert.equal(map.nidOf("9"), 9);
    assert.equal(map.registerPlayer(null), null);
  });
});

describe("快照帧合并 / 基线（ext_net2 纯逻辑）", () => {
  test("全量帧（baseline=0）：按本帧集合重建并返回离开玩家", () => {
    const prev = new Map([
      ["a", { id: "a", x: 1, name: "A" }],
      ["b", { id: "b", x: 2, name: "B" }],
    ]);
    const full = NET2.mergeFrame(prev, [{ id: "a", x: 9 }, { id: "c", x: 3 }], true);
    assert.equal(full.list.length, 2);
    assert.deepEqual(full.removed, ["b"]);
    const a = full.list.find((p) => p.id === "a");
    assert.equal(a.x, 9);
    assert.equal(a.name, undefined, "全量帧不应继承旧字段");
    assert.equal(full.list.find((p) => p.id === "c").x, 3);
  });

  test("增量帧：未出现玩家沿用 baseline，且不产生 removed", () => {
    const prev = new Map([
      ["a", { id: "a", x: 1, name: "A" }],
      ["b", { id: "b", x: 2, name: "B" }],
    ]);
    const partial = NET2.mergeFrame(prev, [{ id: "a", x: 9 }], false);
    assert.equal(partial.list.length, 2);
    assert.deepEqual(partial.removed, []);
    const a = partial.list.find((p) => p.id === "a");
    assert.equal(a.x, 9);
    assert.equal(a.name, "A", "增量帧保留旧字段");
    assert.equal(partial.list.find((p) => p.id === "b").name, "B");
  });

  test("全量空帧删除所有旧玩家；无 prev 时按传入列表重建", () => {
    const prev = new Map([["a", { id: "a" }], ["b", { id: "b" }]]);
    const empty = NET2.mergeFrame(prev, [], true);
    assert.equal(empty.list.length, 0);
    assert.deepEqual(empty.removed.sort(), ["a", "b"]);
    const noPrev = NET2.mergeFrame(null, [{ id: "x", x: 1 }], false);
    assert.deepEqual(noPrev.list.map((p) => p.id), ["x"]);
    assert.deepEqual(noPrev.removed, []);
  });

  test("prev 支持普通对象；null/无 id 条目被跳过；重复 id 后者覆盖", () => {
    const prev = { a: { id: "a", x: 1, name: "A" }, b: { id: "b", x: 2 } };
    const full = NET2.mergeFrame(prev, [{ id: "a", x: 9 }], true);
    assert.equal(full.list.length, 1);
    assert.deepEqual(full.removed, ["b"]);
    const partial = NET2.mergeFrame(prev, [{ id: "a", x: 9 }], false);
    assert.equal(partial.list.length, 2);
    assert.equal(partial.list.find((p) => p.id === "b").x, 2);

    const withNulls = NET2.mergeFrame(prev, [null, {}, { id: null }, { id: "a", x: 5 }], false);
    assert.equal(withNulls.list.length, 2);
    assert.equal(withNulls.list.find((p) => p.id === "a").x, 5);

    const dup = NET2.mergeFrame(new Map(), [{ id: "a", x: 1 }, { id: "a", x: 2 }], true);
    assert.equal(dup.list.length, 1);
    assert.equal(dup.list[0].x, 2);
  });

  test("mergeFrame 不修改输入 prev / list（无共享可变状态）", () => {
    const prevPlayer = { id: "a", x: 1, y: 1 };
    const prev = new Map([["a", prevPlayer]]);
    const incoming = { id: "a", x: 2 };
    const merged = NET2.mergeFrame(prev, [incoming], false);
    assert.deepEqual(prevPlayer, { id: "a", x: 1, y: 1 });
    assert.deepEqual(incoming, { id: "a", x: 2 });
    assert.equal(merged.list[0].y, 1);
    assert.notEqual(merged.list[0], prevPlayer);
  });

  test("mergeBaseline：Map/普通对象都支持，缺省玩家沿用上帧", () => {
    const fromMap = NET2.mergeBaseline(
      new Map([["1", { id: 1, x: 1, name: "A" }], ["2", { id: 2, x: 2, name: "B" }]]),
      [{ id: 1, x: 9 }],
    );
    assert.ok(fromMap instanceof Map);
    assert.equal(fromMap.size, 2);
    assert.equal(fromMap.get("1").x, 9);
    assert.equal(fromMap.get("1").name, "A");
    assert.equal(fromMap.get("2").name, "B");

    const fromObj = NET2.mergeBaseline({ a: { id: "a", x: 1 } }, [{ id: "a", x: 2 }, { id: "b", x: 3 }]);
    assert.equal(fromObj.size, 2);
    assert.equal(fromObj.get("a").x, 2);
    assert.equal(fromObj.get("b").x, 3);
    assert.equal(NET2.mergeBaseline(null, [{ id: "x" }]).size, 1);
  });

  test("全量帧 baseline=0 与 IdMap 联调：数值 nid -> 字符串 id -> 删除离开玩家", () => {
    const map = new NET2.IdMap();
    map.setSelf("self-hex", 7);
    map.registerPlayer({ id: "other-hex", nid: 3 });
    const raw = PROTO.decodeSnapshot(PROTO.encodeSnapshot(10, 0, [
      snapPlayer({ id: 7, x: 1 }), snapPlayer({ id: 3, x: 2 }),
    ], null));
    assert.equal(raw.baseline, 0);
    const resolved = raw.players.map((p) => Object.assign({}, p, { id: map.resolve(p.id) }));
    const prev = new Map([
      ["self-hex", { id: "self-hex", x: 0 }],
      ["left-hex", { id: "left-hex", x: 9 }],
    ]);
    const frame = NET2.mergeFrame(prev, resolved, true);
    assert.deepEqual(frame.list.map((p) => p.id).sort(), ["other-hex", "self-hex"]);
    assert.deepEqual(frame.removed, ["left-hex"]);

    const inc = NET2.mergeFrame(new Map([
      ["self-hex", { id: "self-hex", x: 0 }],
      ["other-hex", { id: "other-hex", x: 2 }],
    ]), [{ id: "self-hex", x: 5 }], false);
    assert.equal(inc.list.length, 2);
    assert.equal(inc.list.find((p) => p.id === "self-hex").x, 5);
    assert.equal(inc.list.find((p) => p.id === "other-hex").x, 2);
    assert.deepEqual(inc.removed, []);
  });
});

describe("预测队列与 ACK", () => {
  test("PredictionQueue：上限、最旧丢弃、pending 快照、clear", () => {
    const q = new NET2.PredictionQueue(3);
    assert.equal(q.max, 3);
    assert.equal(q.size(), 0);
    assert.equal(q.push({ seq: 1 }), 0);
    assert.equal(q.push({ seq: 2 }), 0);
    assert.equal(q.push({ seq: 3 }), 0);
    assert.equal(q.push({ seq: 4 }), 1);
    assert.equal(q.size(), 3);
    assert.deepEqual(q.pending().map((p) => p.seq), [2, 3, 4]);
    const copy = q.pending();
    copy.length = 0;
    assert.equal(q.size(), 3, "pending 必须返回副本");
    assert.equal(q.dropAcked(3), 2);
    assert.deepEqual(q.pending().map((p) => p.seq), [4]);
    assert.equal(q.dropAcked(3), 0);
    q.clear();
    assert.equal(q.size(), 0);
    assert.equal(q.dropAcked(99), 0);
  });

  test("PredictionQueue 默认 120；max=0 回退默认、负值钳到 1", () => {
    assert.equal(new NET2.PredictionQueue().max, NET2.MAX_PENDING);
    assert.equal(new NET2.PredictionQueue(0).max, 120);
    assert.equal(new NET2.PredictionQueue(-5).max, 1);
    const q = new NET2.PredictionQueue(1);
    assert.equal(q.push({ seq: 1 }), 0);
    assert.equal(q.push({ seq: 2 }), 1);
    assert.deepEqual(q.pending().map((p) => p.seq), [2]);
  });

  test("dropAcked：只移除 seq<=ack，返回数量，ack 小于队首时不动", () => {
    const items = [{ seq: 1 }, { seq: 2 }, { seq: 3 }, { seq: 4 }];
    assert.equal(NET2.dropAcked(items, 0), 0);
    assert.equal(items.length, 4);
    assert.equal(NET2.dropAcked(items, 2), 2);
    assert.deepEqual(items.map((p) => p.seq), [3, 4]);
    assert.equal(NET2.dropAcked(items, 10), 2);
    assert.equal(items.length, 0);
    assert.equal(NET2.dropAcked(null, 1), 0);
  });

  test("nextAck 单调前进，非法/回退值保持原值；兼容字符串数字", () => {
    assert.equal(NET2.nextAck(0, 6), 6);
    assert.equal(NET2.nextAck(6, 4), 6);
    assert.equal(NET2.nextAck(6, 6), 6);
    assert.equal(NET2.nextAck(6, 8), 8);
    assert.equal(NET2.nextAck(8, 0), 8);
    assert.equal(NET2.nextAck(8, -1), 8);
    assert.equal(NET2.nextAck(8, NaN), 8);
    assert.equal(NET2.nextAck(8, Infinity), 8);
    assert.equal(NET2.nextAck(8, "9"), 9);
    assert.equal(NET2.nextAck(0, 3008), 3008);
    assert.equal(NET2.nextAck(3005, 4), 3005, "ACK 小帧是 u32，不能用 u8 回绕");
  });

  test("clampAck 不回退（resetPrediction 路径）", () => {
    assert.equal(NET2.clampAck(0, 3005), 3005);
    assert.equal(NET2.clampAck(3005, 4), 3005);
    assert.equal(NET2.clampAck(3005, 3008), 3008);
    assert.equal(NET2.clampAck(0, -1), 0);
    assert.equal(NET2.clampAck(7, "9"), 9);
  });

  test("resolveAck：>1024 完整序号、u8 回绕、非法值", () => {
    assert.equal(NET2.resolveAck(3008, 0), 3008);
    assert.equal(NET2.resolveAck(3050, 3048), 3050);
    assert.equal(NET2.resolveAck(4, 3005), 3076);
    assert.equal(NET2.resolveAck(255, 256), 255);
    assert.equal(NET2.resolveAck(256, 256), 256);
    assert.equal(NET2.resolveAck(257, 256), 257);
    assert.equal(NET2.resolveAck(undefined, 100), null);
    assert.equal(NET2.resolveAck(NaN, 100), null);
    assert.equal(NET2.resolveAck(-1, 100), null);
    assert.equal(NET2.resolveAck(Infinity, 100), null);
  });

  test("ACK 帧到 pending 出队：3001..3010 收到 3008 清 8 条", () => {
    const pending = [];
    for (let i = 3001; i <= 3010; i++) pending.push({ seq: i });
    const ack = PROTO.decodeAck(PROTO.encodeAck(100, 3008));
    const last = NET2.nextAck(3005, ack.seq);
    assert.equal(last, 3008);
    assert.equal(NET2.dropAcked(pending, last), 8);
    assert.deepEqual(pending.map((p) => p.seq), [3009, 3010]);
  });

  test("乱序 ACK 不会让 lastAcked 回退", () => {
    let last = 0;
    for (const raw of [6, 4, 8, 8, 7, 9]) last = NET2.nextAck(last, raw);
    assert.equal(last, 9);
    const pending = [{ seq: 7 }, { seq: 8 }, { seq: 9 }, { seq: 10 }];
    assert.equal(NET2.dropAcked(pending, last), 3);
    assert.deepEqual(pending.map((p) => p.seq), [10]);
  });
});

describe("预测回放 replay / copyState / dist", () => {
  test("空命令回放保留 base 位姿与角度", () => {
    const world = makeWorld();
    const base = baseState();
    const out = NET2.replay(world, base, [], 1 / 60, {});
    assert.ok(out);
    assert.deepEqual(out.pos, base.pos);
    assert.equal(out.yaw, base.yaw);
    assert.equal(out.pitch, base.pitch);
  });

  test("replay 与手工 stepPlayer 完全一致（固定步、确定性）", () => {
    const world = makeWorld();
    const base = baseState();
    const cmds = Array.from({ length: 40 }, (_, i) => ({
      mx: Math.sin(i * 0.3) * 0.6, my: 0.7, yaw: i * 0.02, pitch: 0.03,
      buttons: i < 10 ? COMMAND.BTN.LEAN_L : 0, tick: i,
    }));
    const out = NET2.replay(world, base, cmds, 1 / 60, {});
    const ref = SIM.createPlayerState(world, { x: 0, y: 0.02, z: 0 }, {});
    NET2.copyState(ref, base);
    for (const c of cmds) SIM.stepPlayer(ref, c, world, 1 / 60, {});
    assert.equal(NET2.dist(out.pos, ref.pos), 0);
    assert.equal(out.lean, ref.lean);
    assert.equal(out.tick, ref.tick);
    assert.equal(out.yaw, ref.yaw);
    assert.equal(out.pitch, ref.pitch);
  });

  test("replay 使用 LEAN 侧身位：LEAN_L 为正、LEAN_R 为负", () => {
    const world = makeWorld();
    const base = baseState();
    const run = (bit) => NET2.replay(world, base, Array.from({ length: 10 }, (_, i) => ({
      mx: 0, my: 0, yaw: 0, pitch: 0, buttons: bit, tick: i,
    })), 1 / 60, {});
    assert.ok(run(COMMAND.BTN.LEAN_L).lean > 0.5);
    assert.ok(run(COMMAND.BTN.LEAN_R).lean < -0.5);
  });

  test("base 直接给位置（无 pos）也能回放；null world 返回 null", () => {
    const world = makeWorld();
    const out = NET2.replay(world, { x: 1, y: 0.02, z: 2, yaw: 0.5 }, [{ mx: 0, my: 0, yaw: 0.5, tick: 0 }], 1 / 60, {});
    assert.equal(out.pos.x, 1);
    assert.equal(out.pos.z, 2);
    assert.equal(NET2.replay(null, baseState(), []), null);
    assert.equal(NET2.replay(undefined, baseState(), []), null);
  });

  test("copyState 拷贝位姿/速度/移动字段，返回同一 state；dist 欧氏距离", () => {
    const st = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } };
    const base = {
      pos: { x: 1, y: 2, z: 3 }, vel: { x: 4, y: 5, z: 6 },
      yaw: 0.5, pitch: 0.2, onGround: false, crouching: true, lean: 0.3,
      spawnProtect: true, tick: 7,
    };
    assert.equal(NET2.copyState(st, base), st);
    assert.deepEqual(st.pos, { x: 1, y: 2, z: 3 });
    assert.deepEqual(st.vel, { x: 4, y: 5, z: 6 });
    assert.equal(st.yaw, 0.5);
    assert.equal(st.pitch, 0.2);
    assert.equal(st.onGround, false);
    assert.equal(st.crouching, true);
    assert.equal(st.lean, 0.3);
    assert.equal(st.spawnProtect, true);
    assert.equal(st.tick, 7);
    assert.equal(st.health, undefined, "base 没有的字段不写");
    assert.equal(NET2.copyState(st, null), st);
    assert.equal(NET2.copyState(null, base), null);
    assert.equal(NET2.dist({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 }), 13);
    assert.equal(NET2.dist(null, { x: 0, y: 0, z: 0 }), Infinity);
  });
});

describe("射击拒绝 / 弹药回滚 / 回合比分", () => {
  test("takeShotForReject 按 shotSeq 精确取条目并删除；缺失时回退最后一条", () => {
    const shots = [{ seq: 3 }, { seq: 4 }, { seq: 5 }];
    const got = NET2.takeShotForReject(shots, 4);
    assert.equal(got.index, 1);
    assert.equal(got.shot.seq, 4);
    assert.deepEqual(shots.map((s) => s.seq), [3, 5]);
    const byString = NET2.takeShotForReject([{ seq: 9 }, { seq: 10 }], "9");
    assert.equal(byString.shot.seq, 9);
    const fallback = NET2.takeShotForReject([{ seq: 1 }, { seq: 2 }], 99);
    assert.equal(fallback.index, 1);
    assert.equal(fallback.shot.seq, 2);
    const empty = NET2.takeShotForReject([], 1);
    assert.deepEqual(empty, { shot: null, index: -1 });
    assert.deepEqual(NET2.takeShotForReject(null, 1), { shot: null, index: -1 });
  });

  test("rollbackAmmo 采用服务端 mag/reserve，clamp 到 magSize/0", () => {
    const weapon = { ammo: 5, reserve: 80, magSize: 30 };
    let out = NET2.rollbackAmmo(weapon, { mag: 6, reserve: 84 }, { ammoBefore: 5, reserveBefore: 80 });
    assert.deepEqual(out, { ammo: 6, reserve: 84, applied: true });
    assert.equal(weapon.ammo, 6);
    assert.equal(weapon.reserve, 84);
    out = NET2.rollbackAmmo(weapon, { mag: 99 });
    assert.equal(weapon.ammo, 30);
    out = NET2.rollbackAmmo(weapon, { mag: -3 });
    assert.equal(weapon.ammo, 0);
    out = NET2.rollbackAmmo(weapon, { ammo: 7 });
    assert.equal(weapon.ammo, 7);
    out = NET2.rollbackAmmo(weapon, {}, { ammoBefore: 4, reserveBefore: 70 });
    assert.deepEqual(out, { ammo: 4, reserve: 70, applied: true });
    out = NET2.rollbackAmmo(weapon, {}, {});
    assert.deepEqual(out, { ammo: null, reserve: null, applied: false });
    assert.equal(NET2.rollbackAmmo(null, { mag: 1 }), null);
  });

  test("roundTeams 优先 teams，其次 score，最后 fallback", () => {
    assert.deepEqual(NET2.roundTeams({ teams: [12, 9], score: [40, 33] }, [0, 0]), [12, 9]);
    assert.deepEqual(NET2.roundTeams({ score: [5, 4] }, [7, 7]), [5, 4]);
    assert.deepEqual(NET2.roundTeams({}, [2, 3]), [2, 3]);
    assert.deepEqual(NET2.roundTeams({}, []), [0, 0]);
  });
});

describe("URL / 名字 / 错误码 / 模式纯函数", () => {
  test("escapeText 转义 HTML 实体并处理 null", () => {
    assert.equal(NET2.escapeText(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    assert.equal(NET2.escapeText(null), "");
    assert.equal(NET2.escapeText(0), "0");
  });

  test("sanitizeName 去控制符/标签字符、折叠空白、截断 16 字符、回退", () => {
    const name = NET2.sanitizeName(`  <b>猫</b>&"x"  `);
    assert.ok(!/[<>"&\\]/.test(name));
    assert.ok(name.length > 0 && name.length <= 16);
    assert.equal(name, name.trim());
    assert.equal(NET2.sanitizeName("a\u0000b"), "ab");
    assert.equal(NET2.sanitizeName("a   b"), "a b");
    assert.equal(NET2.sanitizeName("x".repeat(30)), "x".repeat(16));
    assert.equal(NET2.sanitizeName(""), "猫");
    assert.equal(NET2.sanitizeName("   "), "猫");
    assert.equal(NET2.sanitizeName("", "X"), "X");
    assert.equal(NET2.sanitizeName(null), "猫");
  });

  test("validateUrl 只接受 ws/wss 且要求主机名", () => {
    const goodWs = NET2.validateUrl("ws://127.0.0.1:9100");
    assert.equal(goodWs.ok, true);
    assert.ok(goodWs.url.startsWith("ws://127.0.0.1:9100"));
    const goodWss = NET2.validateUrl("wss://example.com/mp");
    assert.equal(goodWss.ok, true);
    assert.equal(NET2.validateUrl("WS://Example.com").ok, true);

    assert.equal(NET2.validateUrl("").error, "empty_url");
    assert.equal(NET2.validateUrl("   ").error, "empty_url");
    assert.equal(NET2.validateUrl("not a url").error, "bad_url");
    assert.equal(NET2.validateUrl("ws://").error, "bad_url");
    assert.equal(NET2.validateUrl("http://example.com").error, "bad_scheme");
    assert.equal(NET2.validateUrl("javascript:alert(1)").error, "bad_scheme");
    assert.equal(NET2.validateUrl("ftp://example.com").error, "bad_scheme");
  });

  test("friendlyError：已知码/数字码/未知码回退/消息截断", () => {
    assert.ok(NET2.friendlyError("room_full").includes("房间已满"));
    assert.equal(NET2.friendlyError("4001"), NET2.friendlyError("room_full"));
    assert.equal(NET2.friendlyError("4008"), NET2.friendlyError("rate_limit"));
    assert.equal(NET2.friendlyError("unknown_code", "boom"), "boom");
    assert.equal(NET2.friendlyError("weird"), "服务器错误（weird）");
    assert.equal(NET2.friendlyError(null), "服务器错误");
    assert.equal(NET2.friendlyError("weird", "   "), "服务器错误（weird）");
    assert.equal(NET2.friendlyError("weird", "x".repeat(200)).length, 160);
    assert.equal(NET2.friendlyError("room_full", "ignored"), NET2.friendlyError("room_full"));
  });

  test("模式键/显示名：只认 tdm/chaos/domination（及其别名）", () => {
    assert.equal(NET2.modeKey("tdm"), "tdm");
    assert.equal(NET2.modeKey("CHAOS"), "chaos");
    assert.equal(NET2.modeKey("dom"), "domination");
    assert.equal(NET2.modeKey("control"), "domination");
    assert.equal(NET2.modeKey("capture"), "domination");
    assert.equal(NET2.modeKey("pve"), "coop");
    assert.equal(NET2.modeKey("survival"), "coop");
    assert.equal(NET2.modeKey("bomb"), "bomb");
    assert.equal(NET2.modeKey("ffa"), "");
    assert.equal(NET2.modeKey(""), "");
    assert.equal(NET2.modeName("tdm"), "团队死斗");
    assert.equal(NET2.modeName("dom"), "据点争夺");
    assert.equal(NET2.modeName("ffa"), "未知模式");
    assert.equal("ffa" in NET2.modes, false);
  });

  test("friendlyError 任意 code 都返回字符串，不泄漏原型链", () => {
    for (const code of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
      const text = NET2.friendlyError(code);
      assert.equal(typeof text, "string", "code=" + code + " -> " + typeof text);
    }
    assert.equal(typeof NET2.friendlyError("__proto__", "boom"), "string");
  });
});

describe("mp.js 源码契约（浏览器专属，Node 不可 require）", () => {
  test("背压：MAX_PENDING_SEND=90 时暂停发命令，队列硬上限 120 条", () => {
    assert.match(MP_SRC, /var MAX_PENDING_SEND = 90;/);
    assert.match(MP_SRC, /if \(pending\.length >= MAX_PENDING_SEND\) \{ net\.cmdBackoff\+\+; return; \}/);
    assert.match(MP_SRC, /while \(pending\.length > 120\) pending\.shift\(\);/);
    assert.equal(NET2.MAX_PENDING, 120, "ext_net2 预测队列上限与 mp.js 2 秒队列一致");
  });

  test("快照缓冲/插值：updateRemoteEach 以 interpMs 回溯并在样本间 lerp", () => {
    assert.match(MP_SRC, /var interpMs = 67, snapTick = 0;/);
    assert.match(MP_SRC, /var INTERP_TICKS = 2, INTERP_MIN_MS = 60, INTERP_MAX_MS = 120;/);
    assert.match(MP_SRC, /function recomputeInterp\(\)/);
    assert.match(MP_SRC, /interpMs = clamp\(Math\.round\(INTERP_TICKS \* 1000 \/ Math\.max\(1, snapRate\)\), INTERP_MIN_MS, INTERP_MAX_MS\)/);
    assert.match(MP_SRC, /snapRate = Math\.max\(1, num\(m\.snapRate, 30\)\)/);
    assert.match(MP_SRC, /function updateRemoteEach\(r\)/);
    assert.match(MP_SRC, /var target = now - interpMs;/);
    assert.match(MP_SRC, /k = span > 0 \? clamp\(\(target - ta\) \/ span, 0, 1\) : 0;/);
    assert.match(MP_SRC, /px = a\.x \+ \(b\.x - a\.x\) \* k;/);
    assert.match(MP_SRC, /interpPos\.x = px;/);
    assert.match(MP_SRC, /mpPerf\.interpUses\+\+;/);
    assert.match(MP_SRC, /function mergeSnapshotFrame\(players, full\)/);
    assert.match(MP_SRC, /var full = !s\.baseline \|\| s\.baseline === 0;/);
    assert.match(MP_SRC, /mergeSnapshotFrame\(raws, full\)/);
    assert.match(MP_SRC, /baseline\.clear\(\);/);
    assert.match(MP_SRC, /applyPlayers\(list, full\);/);
  });

  test("RTT：pong 时间戳只接受 0..8000ms，rtt() 读 pingMs", () => {
    assert.match(MP_SRC, /var rtt = nowMs\(\) - ts;/);
    assert.match(MP_SRC, /if \(rtt >= 0 && rtt < 8000\) pingMs = rtt;/);
    assert.match(MP_SRC, /rtt: function \(\) \{ return pingMs; \}/);
  });

  test("二进制首字节分发：ACK(5) 先走 decodeAck 并 return，SNAP 才进 decodeSnapshot", () => {
    const bin = extractFunction(MP_SRC, "onBinary");
    assert.ok(bin.indexOf("getUint8(0)") >= 0);
    assert.ok(bin.indexOf("decodeAck") >= 0);
    assert.ok(bin.indexOf("decodeAck") < bin.indexOf("decodeSnapshot"), "ACK 必须先于 SNAP 解码");
    assert.match(bin, /op === 5/);
    assert.match(bin, /ackMsg/);
    assert.match(bin, /net\.decodeErrors\+\+/);
  });

  test("未知 JSON 消息被静默忽略（onMsg 无 default 抛错）", () => {
    const source = extractFunction(MP_SRC, "onMsg");
    const sandbox = { rx: { msg: 0 } };
    const onMsg = vm.runInNewContext("(" + source + "\n)", sandbox);
    assert.equal(onMsg({ t: "future_message_type" }), undefined);
    assert.equal(onMsg({ t: "" }), undefined);
    assert.equal(onMsg({ t: 42 }), undefined);
    assert.equal(onMsg({}), undefined);
    assert.equal(onMsg(null), undefined);
    assert.equal(onMsg("not-an-object"), undefined);
    assert.equal(sandbox.rx.msg, 6, "只累计计数，不产生其他副作用");
  });

  test("NET-5 证据：sim/server 支持 1024/2048，二进制输入可承载侧身位", () => {
    assert.match(COMMAND_SRC, /LEAN_L\s*:\s*1024/);
    assert.match(COMMAND_SRC, /LEAN_R\s*:\s*2048/);
    assert.match(SERVER_SRC, /LEAN_L\s*:\s*1024/);
    assert.match(SERVER_SRC, /LEAN_R\s*:\s*2048/);
    const buttonsFor = extractFunction(MP_SRC, "buttonsFor");
    assert.match(buttonsFor, /SALT_NET\.BTN/);
    assert.match(buttonsFor, /B\.CROUCH/);
    // NET-5：buttonsFor 现在按 __SX_MOVE.state().lean 发送 LEAN_L/R。
    assert.match(buttonsFor, /LEAN_L|LEAN_R/);
    assert.equal(PROTO.decodeInput(PROTO.encodeInput({ buttons: 1024 })).buttons, 1024);
    assert.equal(PROTO.decodeInput(PROTO.encodeInput({ buttons: 2048 })).buttons, 2048);
  });
});
