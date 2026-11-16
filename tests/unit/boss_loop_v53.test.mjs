/* =====================================================================
   tests/unit/boss_loop_v53.test.mjs
   V53 · CLI-1（BOSS 逻辑进固定步）/ ARCH-3（hash 扩展 + 低帧率丢弃计数）
   / ARCH-2（boss2 高频错误改成 SXErrors.soft）

   纯 Node / vm：不启动浏览器。
   - 源码级断言：固定步注册、hash 字段、DOM 不进入逻辑层
   - vm 行为断言：暂停冻结、step 推进逻辑、hash 可复现且不抛错
   ===================================================================== */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readSrc = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const BOSS_SRC = readSrc("src/ext_boss2.js");
const LOOP_SRC = readSrc("src/core_loop.js");

const fnBody = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  assert.ok(a >= 0, "找不到 " + startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  assert.ok(b > a, "找不到 " + endMarker);
  return src.slice(a, b);
};

/* ------------------------------------------------------------------ 源码级 */

test("CLI-1 源码：boss2 的 fixedUpdate 调 tickLogic，update 只调 tickPresentation", () => {
  assert.match(BOSS_SRC, /function tickLogic\(h\)/);
  assert.match(BOSS_SRC, /function tickPresentation\(dt\)/);
  assert.match(BOSS_SRC, /fixedUpdate:\s*function\s*\(cmd,\s*h\)/);
  assert.match(BOSS_SRC, /try\s*\{\s*tickLogic\(h\)/);
  assert.match(BOSS_SRC, /^\s*update:\s*function\s*\(dt\)\s*\{\s*\n\s*try\s*\{\s*tickPresentation\(dt\)/m);
  // 逻辑层不能把表现层函数当成逻辑入口：tickPresentation 里必须有 tickFx/updateDebug
  const pres = fnBody(BOSS_SRC, "function tickPresentation(dt)", "/* ------------------------------------------------------- 调试面板 */");
  for (const call of ["tickFx(", "tickGlitch(", "syncBar(", "updateDebug("]) {
    assert.ok(pres.includes(call), "tickPresentation 缺 " + call);
  }
});

test("CLI-1 源码：tickLogic 内没有 DOM 查询，且覆盖扫描/冷却/阶段/移动/召唤/计时器", () => {
  const logic = fnBody(BOSS_SRC, "function tickLogic(h)", "/* ------------------------------------------------------- 表现（渲染帧） */");
  assert.ok(!/document\.|querySelector|innerHTML|style\./.test(logic), "逻辑层出现 DOM 操作");
  for (const call of ["scanBoss()", "updatePhase()", "updateMove(h)", "chooseMove()",
    "stepSummons()", "stepEchoes()", "tickTimers(h)", "S.cool[id]"]) {
    assert.ok(logic.includes(call), "tickLogic 缺 " + call);
  }
  assert.ok(/G\.game\.state !== "playing"\) return;/.test(logic), "tickLogic 缺非 playing 门控");
});

test("ARCH-3 源码：logicState 无 DOM 且字段齐全，并挂在 __SX_BOSS 上", () => {
  const fn = fnBody(BOSS_SRC, "function logicState()", "window.__SX_BOSS = {");
  assert.ok(!/document\.|querySelector/.test(fn), "logicState 不能查 DOM");
  for (const key of ["active", "phase", "final", "hp", "maxHp", "move", "stage", "cooldowns", "clock"]) {
    assert.ok(new RegExp("\\b" + key + ":").test(fn), "logicState 缺字段 " + key);
  }
  assert.match(BOSS_SRC, /window\.__SX_BOSS = \{[\s\S]*?logicState: logicState/);
});

test("ARCH-2 源码：boss2 不再有完全空的 catch（高频路径走 SXErrors.soft）", () => {
  const empty = BOSS_SRC.match(/catch\s*\([A-Za-z_$][\w$]*\)\s*\{\s*\}/g) || [];
  assert.deepEqual(empty, [], "仍有空 catch: " + empty.join(" | "));
  assert.match(BOSS_SRC, /window\.SXErrors\.soft\("boss2:" \+ tag/);
  // 至少覆盖 tick 包装、事件、召唤、渲染/表现热路径
  for (const tag of ['"emit"', '"fixedUpdate"', '"presentation"', '"summon"', '"spawn"', '"fx-tick"']) {
    assert.ok(BOSS_SRC.includes("soft(" + tag), "缺 soft 标签 " + tag);
  }
});

test("ARCH-3 源码：stateHash 并入 BOSS/移动/时钟/手雷拾取/RNG，且统计丢弃时间", () => {
  const body = fnBody(LOOP_SRC, "function stateHash()", "function boot()");
  for (const call of ["hashBoss(parts, q)", "hashMove(parts, q)", "hashClock(parts, q)", "hashItems(parts)", "hashRng(parts)"]) {
    assert.ok(body.includes(call), "stateHash 缺 " + call);
  }
  assert.ok(LOOP_SRC.includes("window.__SX_BOSS"), "hash 未读 __SX_BOSS");
  assert.ok(LOOP_SRC.includes("logicState"), "hash 未用 logicState");
  assert.ok(LOOP_SRC.includes("window.__SX_MOVE"), "hash 未读 __SX_MOVE");
  assert.ok(LOOP_SRC.includes("window.SX_CLOCK"), "hash 未读 SX_CLOCK");
  assert.ok(LOOP_SRC.includes("window.__SX"), "hash 未读 __SX.state()");
  assert.ok(LOOP_SRC.includes("droppedMs"), "缺 droppedMs 统计");
  assert.ok(LOOP_SRC.includes("dropEvents"), "缺 dropEvents 统计");
  assert.ok(/droppedMs:\s*\+stats\.droppedMs\.toFixed\(1\)/.test(LOOP_SRC), "stats() 未暴露 droppedMs");
  // 固定步契约不能变
  assert.match(LOOP_SRC, /var STEP = 1 \/ 60;/);
  assert.match(LOOP_SRC, /var MAX_STEPS = 5;/);
  assert.match(LOOP_SRC, /for \(var i = 0; i < n; i\+\+\)/);
});

/* ------------------------------------------------------------------ vm 工具 */

function makeVec() {
  function V(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
  V.prototype.clone = function () { return new V(this.x, this.y, this.z); };
  V.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
  V.prototype.setY = function (y) { this.y = y; return this; };
  V.prototype.sub = function (v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; };
  V.prototype.addScaledVector = function (v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; };
  V.prototype.length = function () { return Math.hypot(this.x, this.y, this.z); };
  V.prototype.multiplyScalar = function (s) { this.x *= s; this.y *= s; this.z *= s; return this; };
  V.prototype.normalize = function () { const l = this.length() || 1; return this.multiplyScalar(1 / l); };
  V.prototype.distanceTo = function (o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); };
  return V;
}

function makeLoopRig() {
  const state = { nowMs: 0, raf: null, intervals: [], errors: [] };
  const noop = () => {};
  const G = {
    params: {},
    game: { state: "playing", run: { cut: 0, relays: [] }, update() { return true; } },
    player: {
      pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
      health: 100, armor: 50, alive: true, crouching: false, onGround: true
    },
    enemies: { list: [] },
    weapon: {
      activeIndex: 0, ammo: 30, reserve: 90, spread: 0.01, ads: 0, state: "idle",
      list: [{ ammo: 30, reserve: 90, state: "idle" }]
    },
    renderer: { setAnimationLoop: noop },
    render: { frame: noop },
    events: { emit: noop, on: noop },
    time: { dt: 0, t: 0, frame: 0 }
  };
  const windowObj = { __errors: state.errors, __G: G, __frames: 0 };
  const ctx = {
    window: windowObj,
    console: { log: noop, warn: noop, error: noop },
    performance: { now: () => state.nowMs },
    requestAnimationFrame: (cb) => { state.raf = cb; return 1; },
    setInterval: (fn) => { state.intervals.push(fn); return 1; },
    clearInterval: noop,
    setTimeout: () => 1
  };
  vm.createContext(ctx);
  vm.runInContext(LOOP_SRC, ctx);
  assert.equal(typeof state.intervals[0], "function", "core_loop 未启动 boot 轮询");
  state.intervals[0]();
  assert.ok(windowObj.__SX_LOOP, "boot 未发布 __SX_LOOP");
  return { ctx, window: windowObj, state, G };
}

function runFrame(rig, dtMs) {
  rig.state.nowMs += dtMs;
  assert.equal(typeof rig.state.raf, "function", "rAF 未注册");
  rig.state.raf(rig.state.nowMs);
}

/* ------------------------------------------------------------------ vm 行为 */

test("ARCH-3：step(n) 精确推进 n 个 tick，低帧率丢弃进入 stats", () => {
  const rig = makeLoopRig();
  const loop = rig.window.__SX_LOOP;

  const t0 = loop.tick();
  loop.step(120);
  assert.equal(loop.tick() - t0, 120, "step(120) 未精确推进 120 tick");

  // 正常 60Hz 帧：1 个固定步，不丢时间
  const s0 = loop.stats();
  runFrame(rig, 1000 / 60);
  let s1 = loop.stats();
  assert.equal(s1.tick - s0.tick, 1);
  assert.equal(s1.dropEvents, 0);

  // 8.3fps 帧：追帧上限 5 步，剩余时间必须记账而不是静默
  runFrame(rig, 120);
  const s2 = loop.stats();
  assert.equal(s2.tick - s1.tick, 5, "追帧上限应为 MAX_STEPS=5");
  assert.ok(s2.dropEvents > s1.dropEvents, "低帧率未记录 dropEvents");
  assert.ok(s2.droppedMs > 0, "低帧率未累计 droppedMs");
  assert.ok(s2.lastDropMs > 0, "缺 lastDropMs");
  assert.ok(s2.slowFrames >= 1, "缺 slowFrames");
  s1 = s2;
});

test("ARCH-3：hash 对同状态可复现，并随 BOSS/移动/时钟/拾取/RNG 变化", () => {
  const rig = makeLoopRig();
  const loop = rig.window.__SX_LOOP;

  const base = loop.hash();
  assert.equal(typeof base, "string");
  assert.equal(loop.hash(), base, "同状态 hash 不一致");

  rig.window.__SX_BOSS = {
    logicState: () => ({
      active: true, phase: 1, final: false, hp: 1200, maxHp: 1600,
      move: "stomp", stage: "telegraph", clock: 12.5, globalCd: 0.4,
      timers: 0, summons: 1, echoes: 0, queue: "dash>emp",
      cooldowns: { stomp: 2.5, emp: 5 }
    })
  };
  const withBoss = loop.hash();
  assert.notEqual(withBoss, base, "BOSS 状态未进入 hash");
  rig.window.__SX_BOSS.logicState = () => ({
    active: true, phase: 1, final: false, hp: 1100, maxHp: 1600,
    move: "stomp", stage: "telegraph", clock: 12.5, globalCd: 0.4,
    timers: 0, summons: 1, echoes: 0, queue: "dash>emp",
    cooldowns: { stomp: 2.5, emp: 5 }
  });
  assert.notEqual(loop.hash(), withBoss, "BOSS 血量未进入 hash");

  rig.window.__SX_MOVE = {
    state: () => ({ sliding: false, vaulting: false, lean: 0, cooldown: 0, slideT: 0, vaultT: 0 })
  };
  const withMove = loop.hash();
  rig.window.__SX_MOVE.state = () => ({ sliding: true, vaulting: false, lean: 0.4, cooldown: 0.2, slideT: 0.1, vaultT: 0 });
  assert.notEqual(loop.hash(), withMove, "滑铲/侧身状态未进入 hash");

  rig.window.SX_CLOCK = { now: 42.25 };
  const withClock = loop.hash();
  rig.window.SX_CLOCK.now = 42.5;
  assert.notEqual(loop.hash(), withClock, "SX_CLOCK.now 未进入 hash");

  rig.window.__SX = { state: () => ({ grenades: 2, pickups: 5, fps: 60 }) };
  const withItems = loop.hash();
  rig.window.__SX.state = () => ({ grenades: 1, pickups: 5, fps: 60 });
  assert.notEqual(loop.hash(), withItems, "手雷数量未进入 hash");

  rig.window.__SX_RNG = { seed: 12345 };
  const withRng = loop.hash();
  rig.window.__SX_RNG.seed = 54321;
  assert.notEqual(loop.hash(), withRng, "RNG 状态未进入 hash");
});

test("ARCH-3：任一 hash 来源抛错时 hash 不抛错且退化为核心状态", () => {
  const rig = makeLoopRig();
  const loop = rig.window.__SX_LOOP;

  const core = loop.hash();
  rig.window.__SX_BOSS = { logicState: () => { throw new Error("boss boom"); } };
  rig.window.__SX_MOVE = { state: () => { throw new Error("move boom"); } };
  rig.window.__SX = { state: () => { throw new Error("items boom"); } };
  rig.window.__SX_RNG = { get seed() { throw new Error("rng boom"); } };
  rig.window.SX_CLOCK = {};
  Object.defineProperty(rig.window.SX_CLOCK, "now", { get() { throw new Error("clock boom"); } });

  let hashed;
  assert.doesNotThrow(() => { hashed = loop.hash(); });
  assert.equal(typeof hashed, "string");
  assert.equal(hashed, core, "来源全失败时应退化为核心状态哈希");
});

/* ------------------------------------------------------------------ BOSS vm */

function makeBossRig() {
  const softs = [];
  const dom = { queries: 0 };
  const V = makeVec();
  const boss = {
    id: "boss-1", type: "boss", boss: true, alive: true, active: true,
    hp: 1600, maxHp: 1600, bossPhase: 0, yaw: 0, mode: "alert", pos: new V(0, 0, 0)
  };
  const G = {
    THREE: { Vector3: V },
    game: { state: "playing", currentMission: null, run: { bossAlive: false }, update() { return true; } },
    enemies: { list: [boss], spawn() { throw new Error("no spawn in unit test"); } },
    player: null,
    physics: { groundHeight: () => 0, nav: { isWalkable: () => true } },
    scene: null,
    events: { emit() {}, on() {} },
    audio: { play() {} },
    hud: { warn() {}, radio() {}, hit() {} },
    fx: { tracer() {}, explosion() {} },
    combat: { enemyShot() { return false; } },
    time: { dt: 0, t: 0, frame: 0 }
  };
  const el = () => ({
    id: "", style: {}, textContent: "", innerHTML: "", isConnected: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}
  });
  const documentObj = {
    getElementById: () => null,
    createElement: () => el(),
    querySelector(sel) { dom.queries++; dom.sel = sel; return null; },
    querySelectorAll: () => [],
    addEventListener() {},
    head: { appendChild() {} },
    body: { appendChild() {}, classList: { add() {}, remove() {} } }
  };
  let sys = null;
  const windowObj = {
    __errors: [],
    SXErrors: { soft(tag, e) { softs.push([tag, e && e.message]); } },
    SX_SYSTEMS: { register(s) { sys = s; return this; } }
  };
  const ctx = {
    window: windowObj,
    document: documentObj,
    console: { log() {}, warn() {}, error() {} },
    setInterval: () => 1,
    clearInterval() {}
  };
  vm.createContext(ctx);
  vm.runInContext(BOSS_SRC, ctx);
  vm.runInContext("Math.random = function () { return 0.5; };", ctx);
  assert.ok(sys, "boss2 未向 SX_SYSTEMS 注册");
  assert.equal(typeof sys.fixedUpdate, "function", "boss2 缺 fixedUpdate");
  assert.equal(typeof sys.update, "function", "boss2 缺 update");
  sys.init({ G, THREE: { Vector3: V } });
  return { ctx, window: windowObj, document: documentObj, G, boss, softs, dom, sys, V };
}

const H = 1 / 60;
const logicOf = (rig) => rig.window.__SX_BOSS.logicState();

test("CLI-1 vm：非 playing 不推进逻辑/时钟；playing 时 fixedUpdate 推进 BOSS", () => {
  const rig = makeBossRig();
  const { sys, G } = rig;

  G.game.state = "paused";
  for (let i = 0; i < 30; i++) sys.fixedUpdate(null, H);
  let L = logicOf(rig);
  assert.equal(L.active, false, "暂停时不应扫描/接管 BOSS");
  assert.equal(L.clock, 0, "暂停时 BOSS 时钟不应推进");

  G.game.state = "intro";
  for (let i = 0; i < 30; i++) sys.fixedUpdate(null, H);
  assert.equal(logicOf(rig).clock, 0, "intro 不应推进 BOSS 逻辑");

  G.game.state = "playing";
  sys.fixedUpdate(null, H);
  L = logicOf(rig);
  assert.equal(L.active, true, "playing 时 fixedUpdate 应扫描并接管 BOSS");
  assert.equal(L.phase, 0);
  assert.equal(L.maxHp, 1600);
  const cdStart = L.cooldowns.stomp;
  assert.ok(cdStart > 0 && cdStart < 0.8, "初始冷却应已按固定步扣减: " + cdStart);

  for (let i = 0; i < 60; i++) sys.fixedUpdate(null, H);
  L = logicOf(rig);
  assert.ok(Math.abs(L.clock - 1) < 0.05, "60 个固定步后时钟应约 1s: " + L.clock);
  assert.ok(L.cooldowns.stomp < cdStart, "冷却未随时间下降");
  assert.equal(rig.dom.queries, 0, "fixedUpdate 不应查询 DOM");
});

test("CLI-1 vm：暂停冻结已接管的 BOSS，tickPresentation 不推进逻辑", () => {
  const rig = makeBossRig();
  const { sys, G } = rig;
  for (let i = 0; i < 10; i++) sys.fixedUpdate(null, H);
  const before = logicOf(rig);
  assert.equal(before.active, true);

  G.game.state = "paused";
  for (let i = 0; i < 30; i++) sys.fixedUpdate(null, H);
  const paused = logicOf(rig);
  assert.equal(paused.clock, before.clock, "暂停时时钟应冻结");
  assert.deepEqual(paused.cooldowns, before.cooldowns, "暂停时冷却应冻结");
  assert.equal(paused.active, true, "暂停不应清理 BOSS");

  for (let i = 0; i < 5; i++) sys.update(0.2);
  const afterPres = logicOf(rig);
  assert.equal(afterPres.clock, before.clock, "表现层不得推进时钟");
  assert.deepEqual(afterPres.cooldowns, before.cooldowns, "表现层不得推进冷却");

  // 恢复后继续推进
  G.game.state = "playing";
  sys.fixedUpdate(null, H);
  assert.ok(logicOf(rig).clock > before.clock, "恢复 playing 后应继续推进");
});

test("CLI-1 vm：onState(dead) 清理 BOSS，且逻辑层不依赖 DOM", () => {
  const rig = makeBossRig();
  const { sys, G } = rig;
  for (let i = 0; i < 10; i++) sys.fixedUpdate(null, H);
  assert.equal(logicOf(rig).active, true);

  sys.onState("dead");
  assert.equal(logicOf(rig).active, false, "onState(dead) 应清理 BOSS");

  // 表现层负责清血条/清故障（逻辑层只置标记）
  rig.document.querySelector = () => { throw new Error("dom unavailable"); };
  sys.update(0.1); // 不得抛错
  G.game.state = "playing";
  sys.fixedUpdate(null, H);
});

test("CLI-1/ARCH-3 vm：logicState 字段齐全且完全不查 DOM", () => {
  const rig = makeBossRig();
  const { sys } = rig;
  for (let i = 0; i < 20; i++) sys.fixedUpdate(null, H);

  rig.document.querySelector = () => { throw new Error("logicState 不应查 DOM"); };
  const L = logicOf(rig);
  for (const key of ["active", "phase", "final", "hp", "maxHp", "move", "stage", "cooldowns", "clock"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(L, key), "logicState 缺字段 " + key);
  }
  assert.equal(typeof L.active, "boolean");
  assert.equal(typeof L.phase, "number");
  assert.equal(typeof L.cooldowns, "object");
});

test("ARCH-2 vm：事件/召唤/计时器错误被 soft('boss2:*') 记录", () => {
  const rig = makeBossRig();
  const { sys, G } = rig;
  for (let i = 0; i < 10; i++) sys.fixedUpdate(null, H);

  G.events.emit = () => { throw new Error("emit boom"); };
  rig.window.__SX_BOSS.forcePhase(1); // applyPhase → emit
  assert.ok(rig.softs.some(([tag]) => tag === "boss2:emit"), "事件错误未走 soft: " + JSON.stringify(rig.softs));

  G.events.emit = () => {};
  rig.softs.length = 0;
  G.game.state = "playing";
  sys.fixedUpdate(null, H); // 召唤路径会尝试 spawn（本测试里 spaw抛错）
  assert.ok(rig.softs.every(([tag]) => tag.startsWith("boss2:")), "soft 标签前缀错误");
});
