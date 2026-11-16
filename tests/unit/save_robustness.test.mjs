import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

function fresh(name) {
  const file = path.join(SRC, name);
  delete require.cache[require.resolve(file)];
  return require(file);
}

function makeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  const writes = [];
  const failKeys = new Set();
  const store = {
    writes,
    failKeys,
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] == null ? null : Array.from(map.keys())[i]; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) {
      k = String(k);
      if (failKeys.has(k)) throw new Error("QuotaExceededError");
      v = String(v);
      writes.push([k, v]);
      map.set(k, v);
    },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    dump() { return Object.fromEntries(map); }
  };
  return store;
}

function installEnv(seed) {
  const storage = makeStorage(seed);
  global.localStorage = storage;
  global.window = { __errors: [] };
  return storage;
}

function installDomEnv(seed) {
  const listeners = { doc: {}, win: {} };
  const storage = makeStorage(seed);
  global.localStorage = storage;
  global.window = {
    __errors: [],
    addEventListener(type, fn) { (listeners.win[type] || (listeners.win[type] = [])).push(fn); }
  };
  global.document = {
    hidden: false,
    addEventListener(type, fn) { (listeners.doc[type] || (listeners.doc[type] = [])).push(fn); }
  };
  return { storage, listeners };
}

function freshBridge(save) {
  const file = path.join(SRC, "core_bridge.js");
  delete require.cache[require.resolve(file)];
  globalThis.SXSave = save;
  return require(file);
}

/* 载入 build 期片段 src/campaign.js：它没有 module.exports，这里在源码尾部追加
   测试用的导出表达式，其余代码原样执行（顶层只做数据/函数声明）。 */
function loadCampaignSnippet(windowObj, storage) {
  let code = fs.readFileSync(path.join(SRC, "campaign.js"), "utf8");
  code += "\n;globalThis.__CAMP_TEST__ = { loadCamp: loadCamp, saveCamp: saveCamp, reloadCamp: reloadCamp," +
    " bindSaveSync: bindSaveSync, camp: camp, MISSIONS: MISSIONS, CAMP_KEY: CAMP_KEY };";
  const sandbox = { window: windowObj, localStorage: storage, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "campaign.js" });
  return sandbox.__CAMP_TEST__;
}

test.afterEach(() => {
  delete global.localStorage;
  delete global.window;
  delete global.document;
  delete globalThis.SXSave;
  delete globalThis.SXBridge;
});

/* --------------------------------------------------------------- SAVE-1 */

test("save V53 SAVE-1：导入后旧键立即镜像，战役 saveCamp 不把旧进度推回", () => {
  const storage = installEnv({
    "saltline.campaign.v1": JSON.stringify({
      unlocked: 1, current: 0, best: {}, challenges: {}
    }),
    "saltline.armory.v1": JSON.stringify({ pac9: { muzzle: "supp" } }),
    "saltline.access.v1": JSON.stringify({ difficulty: "normal", cross: "bone", shake: "std" })
  });
  const save = fresh("core_save.js");
  save.setDebounce(0);
  save.load();
  const bridge = freshBridge(save);

  const campMod = loadCampaignSnippet(
    { __SX_PROFILE: "v52", SXSave: save, SXBridge: bridge },
    storage
  );
  campMod.loadCamp();
  assert.equal(campMod.camp.unlocked, 1, "战役先读到导入前的旧进度");
  assert.equal(campMod.camp.current, 0);
  campMod.bindSaveSync();

  const imported = save.DEFAULTS();
  imported.campaign.unlocked = 5;
  imported.campaign.current = "m5";
  imported.campaign.best = { m5: { time: 120, kills: 9, rating: "A" } };
  imported.campaign.challenges = { m5: { time: true } };
  const res = save.importJSON(JSON.stringify(imported));
  assert.equal(res.ok, true, res.error);

  // 导入成功写盘 → mirrorLegacy → 订阅把战役内存态刷新到导入值
  const leg = JSON.parse(storage.getItem("saltline.campaign.v1"));
  assert.equal(leg.unlocked, 5);
  assert.equal(leg.current, 4); // m5 -> index 4
  assert.equal(campMod.camp.unlocked, 5, "订阅后战役内存态必须同步");
  assert.equal(campMod.camp.current, 4);

  // 关键回归：战役再保存一次，不能把导入前的进度推回统一档
  campMod.saveCamp();
  const unified = save.get("campaign");
  assert.equal(unified.unlocked, 5);
  assert.equal(unified.current, "m5");
  assert.deepEqual(unified.best, { m5: { time: 120, kills: 9, rating: "A" } });
  assert.deepEqual(unified.challenges, { m5: { time: true } });
  const leg2 = JSON.parse(storage.getItem("saltline.campaign.v1"));
  assert.equal(leg2.unlocked, 5);
  assert.equal(leg2.current, 4);
  assert.deepEqual(JSON.parse(storage.getItem(save.KEY)).campaign, unified);
});

test("save V53 SAVE-1：reset 后旧键回到默认，旧模块不会推回重置前进度", () => {
  const storage = installEnv({
    "saltline.campaign.v1": JSON.stringify({
      unlocked: 6, current: 4, best: { m5: { time: 100 } }, challenges: { m5: { time: true } }
    }),
    "saltline.access.v1": JSON.stringify({ difficulty: "veteran", cross: "cyan", shake: "high" })
  });
  const save = fresh("core_save.js");
  save.setDebounce(0);
  save.load();
  assert.equal(save.get("campaign").unlocked, 6);

  save.reset();

  const leg = JSON.parse(storage.getItem("saltline.campaign.v1"));
  assert.equal(leg.unlocked, 1);
  assert.equal(leg.current, 0);
  assert.deepEqual(leg.best, {});
  assert.deepEqual(leg.challenges, {});
  const access = JSON.parse(storage.getItem("saltline.access.v1"));
  assert.equal(access.difficulty, "normal");
  assert.equal(access.cross, "bone");
  assert.equal(access.shake, "std");
  assert.deepEqual(save.get("campaign"), {
    unlocked: 1, current: "m1", best: {}, challenges: {}, ending: null, checkpoint: null
  });
});

/* --------------------------------------------------------------- SAVE-2 */

test("save V53 SAVE-2：高版本存档保留未知字段，写回不降级", () => {
  const future = {
    v: 3,
    profile: { name: "未来猫", futureProfileField: "x" },
    settings: { fov: 80, quality: "high", futureSetting: { a: 1 } },
    campaign: { unlocked: 4, current: "m4", futureCampaign: [1, 2] },
    achievements: { "future-ach": true },
    futureTop: { nested: true }
  };
  const storage = installEnv({ "saltline.save": JSON.stringify(future) });
  const save = fresh("core_save.js");
  save.setDebounce(0);
  const loaded = save.load();
  assert.equal(save.loadSource(), "main");
  assert.equal(loaded.settings.fov, 80);
  assert.equal(loaded.campaign.unlocked, 4);

  save.set("settings", { fov: 82 });

  const out = JSON.parse(storage.getItem(save.KEY));
  assert.equal(out.v, 3, "不能把高版本号降级为 CURRENT");
  assert.equal(out.settings.fov, 82, "已知字段照常更新");
  assert.deepEqual(out.settings.futureSetting, { a: 1 }, "已知段里的未知字段要保留");
  assert.deepEqual(out.campaign.futureCampaign, [1, 2]);
  assert.deepEqual(out.futureTop, { nested: true }, "未知顶层字段要保留");
  assert.equal(out.profile.futureProfileField, "x");
  assert.deepEqual(out.achievements, { "future-ach": true });

  // 导出同样不能裁字段（否则“读入 → 导出”会丢未来版本数据）
  const exported = JSON.parse(save.exportJSON());
  assert.equal(exported.v, 3);
  assert.deepEqual(exported.settings.futureSetting, { a: 1 });
  assert.deepEqual(exported.futureTop, { nested: true });

  // 重新加载仍然可读，且未知字段没有丢
  const reload = fresh("core_save.js");
  const again = reload.load();
  assert.equal(again.settings.fov, 82);
  assert.equal(JSON.parse(storage.getItem("saltline.save")).futureTop.nested, true);
});

test("save V53 SAVE-2：写入失败保留内存态，恢复后 flush 能补写", () => {
  const storage = installEnv();
  const save = fresh("core_save.js");
  save.setDebounce(0);
  save.load();

  storage.failKeys.add(save.KEY);
  const next = save.set("settings", { fov: 88 });
  assert.equal(next.fov, 88);
  assert.equal(save.get("settings").fov, 88, "写失败不能把内存态回滚");
  assert.equal(save.flush(), false);
  assert.equal(storage.getItem(save.KEY), null);
  assert.match(String(save.writeError()), /Quota/);

  // commit 写失败同样不能丢状态（否则下一次 reload 会回退）
  const draft = JSON.parse(JSON.stringify(save.state()));
  draft.settings.fov = 91;
  assert.equal(save.commit(draft), false);
  assert.equal(save.get("settings").fov, 91);

  storage.failKeys.clear();
  assert.equal(save.flush(), true, "恢复后重试必须把最新状态写盘");
  assert.equal(save.writeError(), null);
  assert.equal(JSON.parse(storage.getItem(save.KEY)).settings.fov, 91);
});

test("save V53 SAVE-2：越界数值钳制到区间，而不是重置默认", () => {
  const save = fresh("core_save.js");
  const raw = save.DEFAULTS();
  raw.settings.sens = 99;
  raw.settings.fov = 10;
  raw.settings.volume.master = 5;
  raw.access.hudScale = 5;
  raw.access.shake = 3;
  raw.campaign.unlocked = 99;
  raw.economy.credits = 3.5; // 非整数仍然拒绝
  const storage = installEnv({ "saltline.save": JSON.stringify(raw) });
  const loaded = fresh("core_save.js").load();

  assert.equal(loaded.settings.sens, 3);
  assert.equal(loaded.settings.fov, 60);
  assert.equal(loaded.settings.volume.master, 1);
  assert.equal(loaded.access.hudScale, 1.5);
  assert.equal(loaded.access.shake, 2);
  assert.equal(loaded.campaign.unlocked, 8);
  assert.equal(loaded.economy.credits, 0);
  assert.equal(storage.getItem("saltline.save") != null, true);
});

test("save V53 SAVE-2：visibilitychange/pagehide 落盘", () => {
  const { storage, listeners } = installDomEnv();
  const save = fresh("core_save.js");
  save.setDebounce(100000); // 不靠 debounce 计时器
  save.load();
  save.set("settings", { fov: 81 });
  assert.equal(storage.getItem(save.KEY), null, "正常路径仍在 debounce 中");

  global.document.hidden = true;
  for (const fn of listeners.doc.visibilitychange || []) fn();
  assert.equal(JSON.parse(storage.getItem(save.KEY)).settings.fov, 81);

  save.set("settings", { fov: 82 });
  for (const fn of listeners.win.pagehide || []) fn();
  assert.equal(JSON.parse(storage.getItem(save.KEY)).settings.fov, 82);
});

/* ---------------------------------------------------------------- CLI-2 */

test("ext V53 CLI-2：只有 playing/intro 推进模拟时钟", () => {
  const src = fs.readFileSync(path.join(SRC, "ext.js"), "utf8");
  const m = src.match(/function simTimeActive\(state\) \{([\s\S]*?)\n  \}/);
  assert.ok(m, "ext.js 应保留可测的 simTimeActive(state) 辅助");
  const simTimeActive = new Function("state", m[1]);

  assert.equal(simTimeActive("playing"), true);
  assert.equal(simTimeActive("intro"), true);
  for (const frozen of ["paused", "title", "dead", "complete", undefined, ""]) {
    assert.equal(simTimeActive(frozen), false, "状态 " + frozen + " 不应推进模拟时钟");
  }

  // 门控必须先于 CLOCK.tick / SX_SYSTEMS.fixedUpdate
  const gate = src.indexOf("if (simActive) {");
  const tick = src.indexOf("CLOCK.tick(dt)");
  const fixed = src.indexOf("SX_SYSTEMS.fixedUpdate");
  assert.ok(gate > 0 && gate < tick && gate < fixed, "CLOCK/固定步系统必须在门控内推进");

  // complete 状态时钟冻结，结算延迟更新必须改走 UI 实时钟，否则永远不会执行
  const camp = fs.readFileSync(path.join(SRC, "campaign.js"), "utf8");
  assert.match(camp, /e\.state === "complete"[\s\S]*?UICLOCK\.after\(0\.4, onMissionComplete\)/);
});

/* ---------------------------------------------------------------- CLI-3 */

test("mapkit V53 CLI-3：applySeaMode 在 seaOnly 与非 seaOnly 之间完整切换", () => {
  const src = fs.readFileSync(path.join(SRC, "mapkit.js"), "utf8");
  const m = src.match(/function applySeaMode\(seaOnly\) \{([\s\S]*?)\n    \}/);
  assert.ok(m, "mapkit.js 应有 applySeaMode(seaOnly)");
  const applySeaMode = new Function("G", "harbor", "seaOnly", m[1]);

  function fixture() {
    return {
      G: {
        ground: { root: { visible: false } },
        render: { sky: { visible: false }, sun: { intensity: 0 } },
        backdrop: { root: { visible: true } }
      },
      harbor: { apron: { visible: false }, quaySkirt: { visible: false } }
    };
  }

  const sea = fixture();
  applySeaMode(sea.G, sea.harbor, true);
  assert.equal(sea.G.ground.root.visible, true);
  assert.equal(sea.G.render.sky.visible, true);
  assert.equal(sea.G.render.sun.intensity, 1.2);
  assert.equal(sea.harbor.apron.visible, false);
  assert.equal(sea.harbor.quaySkirt.visible, false);
  assert.equal(sea.G.backdrop.root.visible, false);

  // 从 ship(true) 切到 depot/core(false)：必须把海/天关掉、太阳压回 0.25
  applySeaMode(sea.G, sea.harbor, false);
  assert.equal(sea.G.ground.root.visible, false);
  assert.equal(sea.G.render.sky.visible, false);
  assert.equal(sea.G.render.sun.intensity, 0.25);
  assert.equal(sea.harbor.apron.visible, true);
  assert.equal(sea.harbor.quaySkirt.visible, true);

  // 再从 depot/core 切回 ship：不能残留上一张图的可见性
  applySeaMode(sea.G, sea.harbor, true);
  assert.equal(sea.G.ground.root.visible, true);
  assert.equal(sea.G.render.sky.visible, true);
  assert.equal(sea.G.render.sun.intensity, 1.2);
  assert.equal(sea.harbor.apron.visible, false);

  // 非港区加载路径必须每次调用 applySeaMode（不能只在 hideHarbor 里）
  assert.match(src, /if \(id !== "harbor"\) applySeaMode\(!!def\.seaOnly\)/);
  assert.match(src, /function hideHarbor\(seaOnly\)[\s\S]*?applySeaMode\(seaOnly\)/);
});

/* ---------------------------------------------------------------- CLI-4 */

test("ext_lod V53 CLI-4：rebuild 前恢复被隐藏的组与 farMesh", () => {
  const sceneHandlers = {};
  function makeNode(name, userData) {
    const node = {
      name, visible: true, parent: null, children: [],
      userData: userData || {},
      pos: { x: 0, y: 0, z: 0 },
      add(child) { child.parent = node; node.children.push(child); return child; },
      getWorldPosition(v) { return v.set(node.pos.x, node.pos.y, node.pos.z); },
      traverse(fn) {
        fn(node);
        for (let i = 0; i < node.children.length; i++) node.children[i].traverse(fn);
      }
    };
    return node;
  }

  class V3 {
    constructor() { this.x = 0; this.y = 0; this.z = 0; this.length = 1; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Box3 {
    setFromObject(o) { this.o = o; this.min = { x: 0, y: 0, z: 0 }; this.max = { x: 1, y: 1, z: 1 }; return this; }
    getCenter(v) { return v.set(this.o.pos.x, this.o.pos.y, this.o.pos.z); }
    getSize(v) { return v.set(2, 2, 2); }
  }

  const root = makeNode("scene");
  const farMesh = { visible: false };
  const g1 = makeNode("g1", { sxLod: true });
  g1.pos = { x: 30, y: 0, z: 0 };
  const g2 = makeNode("g2", { sxLod: true, sxLodFarMesh: farMesh });
  g2.pos = { x: 120, y: 0, z: 0 };
  root.add(g1);
  root.add(g2);
  root.updateMatrixWorld = () => {};

  const G = {
    scene: root,
    THREE: { Vector3: V3, Box3 },
    player: { pos: { x: 0, y: 0, z: 0 } },
    render: { frame() {} },
    renderer: {},
    events: { on(type, fn) { sceneHandlers[type] = fn; } }
  };

  let intervalFn = null;
  const sandbox = {
    window: null,
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => 0 },
    setInterval(fn) { intervalFn = fn; return 1; },
    clearInterval() {},
    Math, Date, Object, Array, String, Number, isFinite
  };
  sandbox.window = sandbox;
  sandbox.__G = G;
  sandbox.__SX = { mapId: () => "depot" };
  sandbox.__errors = [];

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SRC, "ext_lod.js"), "utf8"), sandbox, { filename: "ext_lod.js" });
  assert.equal(typeof intervalFn, "function");
  intervalFn(); // boot()
  const api = sandbox.__SX_LOD;
  assert.equal(api.state().groups, 2);

  // g1 在 far(60) 内；g2 在 120m 外 → 隐藏原组、显示远距替身
  assert.equal(g1.visible, true);
  assert.equal(g2.visible, false);
  assert.equal(farMesh.visible, true);

  // 切图（玩家已移动到 g2 附近）：必须先恢复再重建，否则 g2 会永久隐藏
  G.player.pos = { x: 110, y: 0, z: 0 };
  sceneHandlers["map:loaded"]({ id: "core" });
  assert.equal(api.state().groups, 2, "曾被隐藏的组要重新纳入注册表");
  assert.equal(g2.visible, true, "切图后不能永久隐藏");
  assert.equal(farMesh.visible, false, "近距时远距替身要收回");
  assert.equal(g1.visible, false, "g1 现在在 80m 外，应正常隐藏");

  // 关掉 LOD 也必须恢复原始可见性
  api.setEnabled(false);
  assert.equal(g1.visible, true);
  assert.equal(g2.visible, true);
  assert.equal(farMesh.visible, false);
  api.setEnabled(true);
});

/* --------------------------------------------------------------- ARCH-5 */

test("mapkit V53 ARCH-5：Set 去重、按图复用 FogExp2、非港区拒绝 extend、label 抽取", () => {
  const src = fs.readFileSync(path.join(SRC, "mapkit.js"), "utf8");
  assert.ok(/var seen = new Set\(\)/.test(src), "disposeMap 应用 Set 去重");
  assert.ok(src.indexOf("seen.indexOf(") < 0, "disposeMap 不应再有 O(n²) 的 indexOf 去重");
  assert.ok(/def\.fogObject = new T\.FogExp2/.test(src), "每张地图构建时创建一次 FogExp2");
  assert.equal((src.match(/new T\.FogExp2/g) || []).length, 1, "load 不应再 new FogExp2");
  assert.match(src, /if \(current !== "harbor"\) \{[\s\S]*?return false;/, "extend 在非港区激活时应拒绝");
  assert.equal((src.match(/new T\.CanvasTexture\(c\)/g) || []).length, 1, "label 画布实现应只有一份");
});
