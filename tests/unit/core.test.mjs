import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
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
  return {
    writes,
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] == null ? null : Array.from(map.keys())[i]; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) {
      k = String(k);
      v = String(v);
      writes.push([k, v]);
      map.set(k, v);
    },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    dump() { return Object.fromEntries(map); }
  };
}

function installEnv(seed) {
  const storage = makeStorage(seed);
  global.localStorage = storage;
  global.window = { __errors: [] };
  return storage;
}

test.afterEach(() => {
  delete global.localStorage;
  delete global.window;
  delete globalThis.__SX_VERSION;
  delete globalThis.__SX_PROFILE;
});

/* ------------------------------------------------------------------ save */

test("save: 全新安装加载 WP32-8 默认结构，且不写任何键", () => {
  const storage = installEnv();
  const save = fresh("core_save.js");
  const s = save.load();

  assert.equal(s.v, 2);
  assert.equal(save.loadSource(), "default");
  assert.deepEqual(s.profile, { name: "几猫", createdAt: 0 });
  assert.equal(s.settings.quality, "auto");
  assert.equal(s.settings.sens, 1);
  assert.equal(s.settings.invertY, false);
  assert.equal(s.settings.fov, 74);
  assert.deepEqual(s.settings.volume, { master: 0.9, music: 0.8, sfx: 1, voice: 1 });
  assert.deepEqual(s.access, {
    difficulty: "normal", cross: "white", shake: 1, reduceMotion: false,
    hudScale: 1, subSize: "m", contrast: false,
    colorblind: "none", subBg: 0.55, safe: 16, textScale: "m", hudOpacity: 1, hud: {}
  });
  assert.equal(s.campaign.unlocked, 1);
  assert.equal(s.campaign.current, "m1");
  assert.deepEqual(s.campaign.best, {});
  // V38：军械库扩到六把枪，默认结构同步补齐（旧档缺省时 sanitize 也会补空对象）。
  assert.deepEqual(s.armory, { pac9: {}, breaker12: {}, dmr: {}, smg: {}, lmg: {}, sidearm: {} });
  assert.deepEqual(s.economy, { credits: 0, unlocked: [] });
  assert.deepEqual(s.guide, { dismissed: false });
  assert.deepEqual(s.mp, { url: "", name: "", map: "harbor", mode: "tdm" });
  assert.equal(storage.getItem(save.KEY), null);
  assert.equal(storage.getItem(save.BAK), null);
});

test("save: 旧六组键迁移，字段全部保留且旧键不删", () => {
  const seed = {
    "saltline.campaign.v1": JSON.stringify({
      unlocked: 3, current: 2, best: { m1: { time: 120, kills: 9 } },
      challenges: { m1: { time: true } }, ending: "open"
    }),
    "saltline.armory.v1": JSON.stringify({ pac9: { muzzle: "supp", mag: "ext", optic: "x2" } }),
    "saltline.access.v1": JSON.stringify({
      difficulty: "veteran", cross: "cyan", shake: "high", reduceMotion: true,
      hudScale: "115", subSize: "L", contrast: true
    }),
    "saltline.settings.v1": JSON.stringify({
      quality: "high", sens: 1.4, invertY: true, volume: 0.6, fov: 88
    }),
    "saltline.guide.v1": "1",
    "saltline.mp.url": "ws://example.test/ws",
    "saltline.mp.name": "夜猫",
    "saltline.mp.map": "ship",
    "saltline.mp.mode": "chaos"
  };
  const storage = installEnv(seed);
  const save = fresh("core_save.js");
  const s = save.load();

  assert.equal(save.loadSource(), "legacy");
  assert.equal(s.campaign.unlocked, 3);
  assert.equal(s.campaign.current, "m3"); // V31 的 index 2 -> m3
  assert.deepEqual(s.campaign.best, { m1: { time: 120, kills: 9 } });
  assert.deepEqual(s.campaign.challenges, { m1: { time: true } });
  assert.equal(s.campaign.ending, "open");
  assert.deepEqual(s.armory.pac9, { muzzle: "supp", mag: "ext", optic: "x2" });
  assert.equal(s.access.difficulty, "veteran");
  assert.equal(s.access.cross, "cyan");
  assert.equal(s.access.shake, 1.6);
  assert.equal(s.access.hudScale, 1.15);
  assert.equal(s.access.subSize, "l");
  assert.equal(s.access.reduceMotion, true);
  assert.equal(s.access.contrast, true);
  assert.equal(s.settings.quality, "high");
  assert.equal(s.settings.sens, 1.4);
  assert.equal(s.settings.invertY, true);
  assert.equal(s.settings.fov, 88);
  assert.equal(s.settings.volume.master, 0.6);
  assert.equal(s.guide.dismissed, true);
  assert.deepEqual(s.mp, {
    url: "ws://example.test/ws", name: "夜猫", map: "ship", mode: "chaos"
  });

  // 迁移后写新主档 + 备份；旧键原样保留
  assert.equal(JSON.parse(storage.getItem(save.KEY)).v, 2);
  assert.equal(JSON.parse(storage.getItem(save.KEY)).campaign.current, "m3");
  assert.ok(storage.getItem(save.BAK));
  for (const key of Object.keys(seed)) assert.equal(storage.getItem(key), seed[key]);
});

test("save: 主档损坏时读备份档", () => {
  const defaults = fresh("core_save.js").DEFAULTS();
  defaults.settings.fov = 90;
  defaults.campaign.unlocked = 4;
  const storage = installEnv({
    "saltline.save": "{ not valid json",
    "saltline.save.bak": JSON.stringify(defaults)
  });
  const save = fresh("core_save.js");
  const s = save.load();

  assert.equal(save.loadSource(), "backup");
  assert.equal(s.settings.fov, 90);
  assert.equal(s.campaign.unlocked, 4);
  // 从备份恢复后立即修复主档；坏文本不能写进备份
  assert.ok(JSON.parse(storage.getItem("saltline.save")));
  assert.ok(JSON.parse(storage.getItem("saltline.save.bak")));
});

test("save: 非法字段逐字段回退默认，合法字段保留", () => {
  const save = fresh("core_save.js");
  const raw = save.DEFAULTS();
  raw.settings.quality = "nonsense";
  raw.settings.sens = 99;
  raw.settings.fov = "wide";
  raw.settings.volume.master = 5;
  raw.access.difficulty = "god";
  raw.access.shake = "violent";
  raw.access.hudScale = 5;
  raw.access.subSize = "XL";
  raw.access.cross = "cyan"; // 合法
  raw.campaign.unlocked = -2;
  raw.campaign.current = "m99";
  raw.campaign.ending = "bad";
  raw.campaign.checkpoint = "not-an-object";
  raw.campaign.best = { m3: { time: 200 } }; // 合法
  raw.armory.pac9 = { muzzle: 42, mag: "ext" };
  raw.mp.map = "moon";
  raw.mp.mode = "duel";
  raw.guide.dismissed = "yes";
  raw.economy.credits = -4;
  raw.economy.unlocked = ["a", 2, "b"];
  raw.profile.name = "   ";

  const storage = installEnv({ "saltline.save": JSON.stringify(raw) });
  const loaded = fresh("core_save.js").load();

  assert.equal(loaded.settings.quality, "auto");
  assert.equal(loaded.settings.sens, 1);
  assert.equal(loaded.settings.fov, 74);
  assert.equal(loaded.settings.volume.master, 0.9);
  assert.equal(loaded.access.difficulty, "normal");
  assert.equal(loaded.access.shake, 1);
  assert.equal(loaded.access.hudScale, 1);
  assert.equal(loaded.access.subSize, "m");
  assert.equal(loaded.access.cross, "cyan");
  assert.equal(loaded.campaign.unlocked, 1);
  assert.equal(loaded.campaign.current, "m1");
  assert.equal(loaded.campaign.ending, null);
  assert.equal(loaded.campaign.checkpoint, null);
  assert.deepEqual(loaded.campaign.best, { m3: { time: 200 } });
  assert.deepEqual(loaded.armory.pac9, { mag: "ext" });
  assert.equal(loaded.mp.map, "harbor");
  assert.equal(loaded.mp.mode, "tdm");
  assert.equal(loaded.guide.dismissed, false);
  assert.equal(loaded.economy.credits, 0);
  assert.deepEqual(loaded.economy.unlocked, ["a", "b"]);
  assert.equal(loaded.profile.name, "几猫");
  assert.equal(JSON.parse(storage.getItem("saltline.save")).settings.quality, "nonsense");
});

test("save: commit 先写 .bak 再写主档；set/get/subscribe/debounce 工作", () => {
  const storage = installEnv();
  const save = fresh("core_save.js");
  let events = 0;
  const off = save.subscribe(() => { events++; });
  const s = save.load();
  s.settings.fov = 82;

  assert.equal(save.commit(s), true);
  assert.deepEqual(storage.writes.map((w) => w[0]), ["saltline.save.bak", "saltline.save"]);
  const first = storage.getItem(save.KEY);
  assert.equal(storage.getItem(save.BAK), first);
  assert.equal(JSON.parse(first).settings.fov, 82);

  s.settings.fov = 90;
  assert.equal(save.commit(s), true);
  const tail = storage.writes.slice(-2).map((w) => w[0]);
  assert.deepEqual(tail, ["saltline.save.bak", "saltline.save"]);
  assert.equal(storage.getItem(save.BAK), first);
  assert.equal(JSON.parse(storage.getItem(save.KEY)).settings.fov, 90);

  save.setDebounce(0); // 单测里立即落盘，避免等待计时器
  const next = save.set("settings", { fov: 85 });
  assert.equal(next.fov, 85);
  assert.equal(save.get("settings").fov, 85);
  assert.equal(save.get().settings.fov, 85);
  assert.equal(JSON.parse(storage.getItem(save.KEY)).settings.fov, 85);
  assert.ok(events > 0);
  assert.equal(save.flush(), true);
  assert.equal(save.set("access", { subSize: "XL" }).subSize, "m");
  off();
});

test("save: 导出/导入 JSON，mirrorLegacy 默认不写、显式调用才写旧键", () => {
  const storage = installEnv();
  const save = fresh("core_save.js");
  save.load();

  const text = save.exportFile();
  assert.equal(typeof text, "string");
  assert.equal(JSON.parse(text).v, 2);

  const edited = save.DEFAULTS();
  edited.settings.fov = 70;
  edited.campaign.unlocked = 2;
  edited.campaign.current = "m2";
  const result = save.importFile(JSON.stringify(edited));
  assert.equal(result.ok, true);
  assert.equal(save.get("settings").fov, 70);
  assert.equal(JSON.parse(storage.getItem(save.KEY)).settings.fov, 70);

  const bad = save.importFile("{broken");
  assert.equal(bad.ok, false);
  assert.match(bad.error, /JSON/);

  assert.equal(storage.getItem("saltline.campaign.v1"), null);
  assert.equal(storage.getItem("saltline.access.v1"), null);
  const mirrored = save.mirrorLegacy();
  assert.ok(mirrored["saltline.campaign.v1"]);
  const camp = JSON.parse(storage.getItem("saltline.campaign.v1"));
  assert.equal(camp.unlocked, 2);
  assert.equal(camp.current, 1); // m2 -> index 1
  const access = JSON.parse(storage.getItem("saltline.access.v1"));
  assert.equal(access.cross, "bone"); // 新档默认 white 折回 V31 认得的 bone
  assert.equal(access.shake, "std");
  assert.equal(access.subSize, "M");
  assert.equal(access.hudScale, "100");
  assert.equal(storage.getItem("saltline.guide.v1"), "0");
  const settings = JSON.parse(storage.getItem("saltline.settings.v1"));
  assert.equal(settings.volume, 0.9);
});

/* ----------------------------------------------------------------- clock */

test("clock: 按 at/seq 排序，after/every/cancel/cancelGroup/timeScale 正确", () => {
  const K = fresh("core_clock.js");
  const clock = K.createClock();
  const out = [];

  clock.after(2, () => out.push("two"));
  clock.after(1, () => out.push("one-a"));
  clock.after(1, () => out.push("one-b"));
  const cancelled = clock.after(0.5, () => out.push("cancelled"));
  cancelled();
  clock.every(1, () => out.push("every"), "group-a");
  clock.after(1.5, () => out.push("group-task"), "group-a");
  clock.after(1.5, () => out.push("default-1.5"));

  clock.tick(1);
  assert.equal(clock.now, 1);
  assert.deepEqual(out, ["one-a", "one-b", "every"]);

  assert.equal(clock.cancelGroup("group-a"), "group-a");
  clock.tick(0.5);
  assert.equal(clock.now, 1.5);
  assert.deepEqual(out, ["one-a", "one-b", "every", "default-1.5"]);

  clock.tick(1);
  assert.equal(clock.now, 2.5);
  assert.deepEqual(out, ["one-a", "one-b", "every", "default-1.5", "two"]);

  const p = K.createClock();
  let hits = 0;
  p.after(1, () => { hits++; });
  p.timeScale = 0;
  p.tick(5);
  assert.equal(p.now, 0);
  assert.equal(hits, 0);
  p.timeScale = 2;
  p.tick(0.5);
  assert.equal(p.now, 1);
  assert.equal(hits, 1);

  const e = K.createClock();
  let ticks = 0;
  e.every(0.25, () => { ticks++; });
  e.tick(1);
  assert.equal(ticks, 4);
  e.cancelAll();
  e.tick(5);
  assert.equal(ticks, 4);

  const z = K.createClock();
  let zero = 0;
  z.after(0, () => { zero++; });
  z.tick(0);
  assert.equal(zero, 1); // tick(0) 仍处理“当前时刻已到期”的任务
  z.tick(-1);
  assert.equal(z.now, 0);
});

test("clock: realClock 用真实时间推进，不受玩法 timeScale 影响", () => {
  const K = fresh("core_clock.js");
  let ms = 1000;
  const real = K.createRealClock(() => ms);
  let hits = 0;
  real.after(0.5, () => { hits++; });

  ms = 1200;
  real.tick();
  assert.equal(hits, 0);
  ms = 1600;
  real.tick();
  assert.equal(hits, 1);
  assert.ok(Math.abs(real.now - 0.6) < 1e-9);

  real.timeScale = 0; // 真实时钟通常保持 1，但 API 仍遵守自己的倍率
  ms = 2600;
  real.tick();
  assert.ok(Math.abs(real.now - 0.6) < 1e-9);
  assert.equal(typeof K.realClock.after, "function");
});

/* ------------------------------------------------------------------ i18n */

test("i18n: 插值、语言切换、持久化、缺失键回退 key", () => {
  const storage = installEnv();
  const i18n = fresh("core_i18n.js");

  assert.equal(i18n.getLang(), "zh-CN");
  assert.equal(i18n.t("ui.pause.title"), "已暂停");
  assert.equal(i18n.t("hud.wave", { n: 3 }), "第 3 波");
  assert.equal(i18n.t("hud.interact", { key: "E" }), "按住 E 互动");
  assert.equal(i18n.t("missing.key"), "missing.key");
  assert.equal(i18n.t("hud.wave", { n: 3, extra: "ignored" }), "第 3 波");

  assert.equal(i18n.setLang("en-US"), "en");
  assert.equal(i18n.getLang(), "en");
  assert.equal(i18n.t("ui.pause.title"), "Paused");
  assert.equal(i18n.t("hud.wave", { n: 3 }), "Wave 3");
  assert.equal(i18n.t("hud.interact", { key: "E" }), "Hold E to interact");
  assert.equal(storage.getItem("saltline.lang"), "en");

  const i18n2 = fresh("core_i18n.js");
  assert.equal(i18n2.getLang(), "en");

  const zh = i18n2.dict["zh-CN"];
  const en = i18n2.dict.en;
  const saved = en["ui.menu.close"];
  delete en["ui.menu.close"];
  try {
    assert.equal(i18n2.setLang("en"), "en");
    assert.equal(i18n2.t("ui.menu.close"), zh["ui.menu.close"]);
  } finally {
    en["ui.menu.close"] = saved;
  }
});

test("i18n: 双语键集一致、基础文案覆盖 80 条以上、applyDom 处理 text 与 attr", () => {
  installEnv();
  const i18n = fresh("core_i18n.js");
  const zhKeys = Object.keys(i18n.dict["zh-CN"]).sort();
  const enKeys = Object.keys(i18n.dict.en).sort();

  assert.deepEqual(zhKeys, enKeys);
  assert.ok(zhKeys.length >= 80);
  assert.equal(i18n.applyDom(), 0); // Node 下无 document，守卫直接返回

  i18n.setLang("en");
  const textEl = {
    textContent: "",
    getAttribute(name) {
      if (name === "data-i18n") return "hud.wave";
      if (name === "data-i18n-vars") return '{"n":2}';
      return null;
    }
  };
  const attrs = {};
  const attrEl = {
    getAttribute(name) {
      if (name === "data-i18n-attr") return "title:ui.pause.title;aria-label=ui.pause.resume";
      return null;
    },
    setAttribute(k, v) { attrs[k] = v; }
  };
  const root = {
    querySelectorAll(sel) {
      if (sel === "[data-i18n]") return [textEl];
      if (sel === "[data-i18n-attr]") return [attrEl];
      return [];
    }
  };

  assert.equal(i18n.applyDom(root), 3);
  assert.equal(textEl.textContent, "Wave 2");
  assert.equal(attrs.title, "Paused");
  assert.equal(attrs["aria-label"], "Resume");
});

/* ---------------------------------------------------------------- errors */

test("errors: window.__errors 不清空既有，容量 200 环形上限", () => {
  installEnv();
  global.window = { __errors: ["legacy-a", "legacy-b"] };
  const errors = fresh("core_errors.js");

  assert.deepEqual(global.window.__errors, ["legacy-a", "legacy-b"]);
  for (let i = 0; i < 250; i++) {
    errors.report(new Error("e" + i), { system: "sim", phase: "step" });
  }

  const counts = errors.counts();
  assert.equal(counts.size, 200);
  assert.equal(counts.capacity, 200);
  assert.equal(counts.total, 252); // 2 条既有 + 250 条新报
  assert.equal(counts.bySystem.sim, 250);
  assert.equal(counts.bySystem.legacy, 2);
  assert.ok(global.window.__errors.length <= 200);
  assert.equal(typeof global.window.__errors[0], "string");
  assert.equal(errors.recentErrors(1)[0].message, "e249");
  assert.equal(errors.recentErrors(10).length, 10);
});

test("errors: guard 首次 + 每 300 次上报，连续 600 次失败停用并广播", () => {
  const events = [];
  let localDetail = null;
  installEnv();
  global.window = {
    __errors: [],
    dispatchEvent(e) { events.push(e); return true; }
  };
  const errors = fresh("core_errors.js");
  errors.onDisabled((d) => { localDetail = d; });

  let calls = 0;
  const guarded = errors.guard("boss", "update", function (v) {
    calls++;
    if (v === 1) return "ok";
    throw new Error("boom");
  });

  assert.equal(guarded(1), "ok");
  for (let i = 0; i < 600; i++) guarded(2);

  assert.equal(calls, 601);
  assert.equal(errors.counts().byPhase["boss::update"], 3); // 第 1、300、600 次失败各上报一次
  assert.equal(errors.counts().bySystem.boss, 3);
  assert.equal(errors.counts().byPhase["boss::disabled"], undefined);
  const disabled = events.filter((e) => e && e.type === "sx:system-disabled");
  assert.equal(disabled.length, 1);
  assert.equal(disabled[0].detail.system, "boss");
  assert.equal(disabled[0].detail.phase, "update");
  assert.equal(disabled[0].detail.count, 600);
  assert.match(disabled[0].detail.reason, /boom/);
  assert.equal(localDetail.system, "boss");
  assert.equal(errors.isDisabled("boss"), true);

  assert.equal(guarded(2), undefined);
  assert.equal(calls, 601); // 停用后不再调用原函数
  assert.equal(errors.enable("boss"), true);
  assert.equal(errors.isDisabled("boss"), false);
});

test("errors: 命令环形记录 600 条，dump 含版本/UA/错误/命令", () => {
  installEnv();
  globalThis.__SX_VERSION = "v32-test";
  globalThis.__SX_PROFILE = "lite";
  const errors = fresh("core_errors.js");
  for (let i = 0; i < 605; i++) errors.recordCommand({ mx: i, my: -i }, i);

  assert.equal(errors.counts().commandCount, 600);
  assert.equal(errors.recentCommands(1)[0].cmd.mx, 604);

  errors.report("plain failure", { system: "weapon", phase: "fire" });
  const report = errors.dump({ download: false });
  assert.equal(report.format, "saltline-crash-report");
  assert.equal(report.version, "v32-test");
  assert.equal(report.profile, "lite");
  assert.equal(typeof report.ua, "string");
  assert.ok(Array.isArray(report.errors));
  assert.equal(report.errors[report.errors.length - 1].system, "weapon");
  assert.equal(report.commands.length, 600);
  assert.equal(report.commands[599].cmd.mx, 604);

  const json = JSON.parse(errors.dumpJSON());
  assert.equal(json.errors.length, report.errors.length);
  assert.equal(json.commands.length, 600);
});
