/* =====================================================================
   tests/unit/catches_v54.test.mjs
   V54 · ARCH-2（高频模块空 catch → SXErrors.soft("<module>:<tag>")）
        ARCH-1（短期：防重入标记迁到宿主对象，先写标记再包覆）

   纯 Node / vm：不启动浏览器，不依赖 DOM。
   - 源码级：空 catch 归零（仅 6 处纯日志白名单）、soft 标签、宿主标记与包覆顺序
   - vm 行为：soft 转发/兜底/去重，可选 API 探测失败仍走原回退路径
   ===================================================================== */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const quietConsole = { log() {}, warn() {}, error() {} };

/* 10 个高频模块：soft 标签清单 + 纯日志白名单数量（V54 归档） */
const MODULES = [
  {
    file: "src/ext_visual.js",
    mod: "visual",
    silent: 0,
    soft: ["map-id", "history-texture", "aa-target-dispose", "depth-texture", "aa-tune", "pmrem-compile", "probe-dispose", "capture-restore", "probe-env-dispose", "interior-probe", "ground-height", "kick-restore", "flash-mat-restore", "enemy-list-probe", "rig-bones", "quality-tune", "emit-quality", "restore-camera", "restore-jitter"]
  },
  {
    file: "src/ext_ui2.js",
    mod: "ui2",
    silent: 3,
    soft: ["access-merge", "storage-patch", "save-state", "i18n-extra", "apply-state", "menu-progress", "reduce-motion", "observer-stop", "camp-missions", "camp-index", "observer-drain", "lang-radio", "lang-objective", "lang-prompt", "lang-emit", "refresh-colorblind", "refresh-access", "refresh-api", "expose-api-early", "i18n-mount", "doc-lang", "expose-api"]
  },
  {
    file: "src/ext_ai.js",
    mod: "ai",
    silent: 0,
    soft: ["map-id", "mapkit-current", "nav-clear-line", "fire-player", "squad-token-hound", "squad-token-gull", "eval-covers", "cover-hot", "update-squads", "emp-shake", "debug-toggle-hud", "expose-enabled"]
  },
  {
    file: "src/ext_enemies2.js",
    mod: "enemies2",
    silent: 0,
    soft: ["progress-add", "emit-kill-reward", "detach-mesh", "detach-geo", "detach-mat", "emit-variant", "emit-shield-hit", "emit-shield-break", "fx-shield-break", "warden-mesh", "emit-scout-mark", "scout-rally", "emit-shield-tick", "emit-emp-telegraph", "raycast", "shell-mesh", "emit-siege-warn", "clear-shells", "shell-remove", "fx-impact", "player-damage", "player-shake", "emit-emp", "burst-damage", "burst-shake", "emit-emp-burst", "burst-fx", "burst-sparks", "emp-retire"]
  },
  {
    file: "src/ext_weapons2.js",
    mod: "weapons2",
    silent: 1,
    soft: ["seed-parse", "emit-hit-enemy", "emit-impact", "expose-tune"]
  },
  {
    file: "src/ext_missions2.js",
    mod: "missions2",
    silent: 1,
    soft: ["activate-graph", "radio", "warn", "objective-text", "hud-objective", "ground-height", "add-box", "physics-build", "checkpoint-hydrate", "save-flush", "clear-checkpoint", "clear-memory", "save-flush-clear", "hud-relays", "relay-state", "hud-markers", "boss-warn", "boss-start", "hud-message", "checkpoint-hydrate", "extraction-ground", "start-relays", "sync-screen", "pending-unlock", "graph-init", "test-emit", "screen-poll", "poll-install", "boot-restore"]
  },
  {
    file: "src/ext_music2.js",
    mod: "music2",
    silent: 0,
    soft: ["stem-gain", "stem-pitch", "stem-target", "stem-filter", "bed-gain", "bed-pitch", "bed-evict", "amb-gain", "amb-event", "ending-pitch", "ending-foghorn", "reset-pitch", "map-id", "mission-map", "pulse-disconnect", "pulse-fire", "hiss-start", "radio-sfx", "radio-syllable", "hiss-stop", "suppress-check", "resume"]
  },
  {
    file: "src/ext_audio2.js",
    mod: "audio2",
    silent: 1,
    soft: ["storage-write", "panner-track", "panner-create", "panner-hrtf", "master-volume", "master-mirror", "loop-gain", "loop-stop", "shot-body", "shot-crack", "debug-check", "ui-click", "init-hrtf", "audio-debug"]
  },
  {
    file: "src/ext_feedback.js",
    mod: "feedback",
    silent: 0,
    soft: ["load-settings", "save-settings", "weapon-name", "hit-ring-anim", "dmg-num-anim", "sfx-objective", "low-health-read", "probe-install", "take-damage", "hud-message", "emit-settings", "public-player", "hook-dead", "hook-armor", "hook-streak", "low-health-tick"]
  },
  {
    file: "src/ext_lights.js",
    mod: "lights",
    silent: 0,
    soft: ["dispose-harvest"]
  }
];

const SOFT_TOTAL = MODULES.reduce((n, m) => n + m.soft.length, 0);
const SILENT_TOTAL = MODULES.reduce((n, m) => n + m.silent, 0);

/* ------------------------------------------------------------- 源码扫描 */

const stripComments = (s) => s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** 列出所有 catch 块（含空块 / 仅注释块），body 为去掉注释后的代码 */
function catchSites(src) {
  const sites = [];
  const re = /\bcatch\s*(?:\(([^)]*)\))?\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const bodyStart = re.lastIndex;
    let i = bodyStart;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const raw = src.slice(bodyStart, i - 1);
    sites.push({
      line: src.slice(0, m.index).split("\n").length,
      raw,
      body: stripComments(raw).trim(),
      param: m[1] || "e"
    });
  }
  return sites;
}

/** 按头部文本抽取一个函数（大括号配对；这些函数内没有带括号的字符串） */
function extractFn(src, header) {
  const at = src.indexOf(header);
  assert.ok(at >= 0, "找不到 " + header);
  let depth = 0;
  let j = src.indexOf("{", at);
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  assert.ok(j > start, "大括号不配对：" + header);
  return src.slice(at, j);
}

function softContext(mod, windowObj) {
  const ctx = { console: quietConsole };
  if (windowObj !== undefined) ctx.window = windowObj;
  vm.createContext(ctx);
  vm.runInContext(extractFn(read(mod.file), "function soft(tag, e) {"), ctx);
  return ctx;
}

/* ------------------------------------------------------------- ARCH-2 */

test("ARCH-2 源码：10 个高频模块空 catch 归零，只剩 6 处纯日志白名单", () => {
  let softs = 0;
  let silent = 0;
  for (const mod of MODULES) {
    const src = read(mod.file);
    const sites = catchSites(src);
    const isQuiet = (s) => s.body === "" && s.raw.trim() === "/* 纯日志输出：诊断通道自身不可用，保持静默（ARCH-2 白名单） */";
    const quiet = sites.filter(isQuiet);
    assert.equal(quiet.length, mod.silent, mod.file + " 纯日志白名单数量不符");
    for (const s of quiet) {
      assert.equal(s.body, "", mod.file + ":" + s.line + " 白名单 catch 仍带语句");
      assert.match(s.raw.trim(), /^\/\* 纯日志输出：诊断通道自身不可用，保持静默（ARCH-2 白名单） \*\/$/);
    }
    const stillEmpty = sites.filter((s) => s.body === "" && !isQuiet(s));
    assert.deepEqual(stillEmpty.map((s) => s.line), [], mod.file + " 仍有空 catch");

    const converted = sites.filter((s) => /^soft\("[a-z0-9-]+", (e|err)\);$/.test(s.body));
    assert.equal(converted.length, mod.soft.length, mod.file + " 软错误化数量不符");
    for (const s of converted) {
      const mm = s.body.match(/^soft\("([a-z0-9-]+)", (e|err)\);$/);
      assert.equal(mm[2], s.param, mod.file + ":" + s.line + " soft 参数与 catch 参数不一致");
      assert.ok(mod.soft.includes(mm[1]), mod.file + ":" + s.line + " 未登记标签 " + mm[1]);
    }
    // soft 自身的两个兜底 catch 必须带语句（不能再退回空 catch）
    assert.equal((src.match(/catch \(_\) \{ forwarded = false; \}/g) || []).length, 1, mod.file + " 缺 SXErrors 转发兜底");
    assert.equal((src.match(/catch \(_\) \{ return; \}/g) || []).length, 1, mod.file + " 缺 __errors 兜底");
    softs += converted.length;
    silent += quiet.length;
  }
  assert.equal(softs, SOFT_TOTAL);
  assert.equal(SOFT_TOTAL, 168, "V54 soft 化总数应为 168（V53 基线的 174 处空 catch 去掉 6 处纯日志）");
  assert.equal(silent, SILENT_TOTAL);
  assert.equal(SILENT_TOTAL, 6);
});

test("ARCH-2 源码：soft 统一加模块前缀，标签 kebab-case 且全部被引用", () => {
  for (const mod of MODULES) {
    const src = read(mod.file);
    assert.ok(
      src.includes('window.SXErrors.soft("' + mod.mod + ':" + tag, e)'),
      mod.file + " 未走 SXErrors.soft('" + mod.mod + ":<tag>')"
    );
    assert.ok(
      src.includes('window.__errors.push("[' + mod.mod + ':" + tag + "] "'),
      mod.file + " __errors 兜底缺模块前缀"
    );
    for (const tag of mod.soft) {
      assert.match(tag, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, mod.file + " 标签不是 kebab-case：" + tag);
      assert.ok(src.includes('soft("' + tag + '", '), mod.file + " 缺标签 " + tag);
    }
    const softFn = extractFn(src, "function soft(tag, e) {");
    assert.ok(!/console\./.test(softFn), mod.file + " soft 不得写 console（日志路径自指）");
    assert.match(softFn, /while \(window\.__errors\.length > 200\) window\.__errors\.shift\(\);/);
  }
});

test("ARCH-2 行为：soft 转发 SXErrors.soft('<module>:<tag>')，缺接口/抛错时退回 __errors", () => {
  for (const mod of MODULES) {
    const err = new Error("boom");

    // 1) 正常路径：带模块前缀转发一次
    const calls = [];
    const ctx1 = softContext(mod, { SXErrors: { soft: (tag, e) => calls.push([tag, e && e.message]) } });
    ctx1.__err = err;
    vm.runInContext('soft("probe", __err)', ctx1);
    assert.deepEqual(calls, [[mod.mod + ":probe", "boom"]], mod.file + " 转发标签错误");

    // 2) 没有 SXErrors：退回 window.__errors，并带模块前缀
    const ctx2 = softContext(mod, { __errors: [] });
    ctx2.__err = err;
    vm.runInContext('soft("probe", __err)', ctx2);
    assert.equal(ctx2.window.__errors.length, 1, mod.file + " 未退回 __errors");
    assert.match(ctx2.window.__errors[0], new RegExp("^\\[" + mod.mod + ":probe\\] Error: boom"));

    // 3) SXErrors.soft 自己抛错：不能影响调用方，仍退回 __errors
    const ctx3 = softContext(mod, { SXErrors: { soft() { throw new Error("diag down"); } }, __errors: [] });
    ctx3.__err = err;
    assert.doesNotThrow(() => vm.runInContext('soft("probe", __err)', ctx3));
    assert.match(ctx3.window.__errors[0], new RegExp("^\\[" + mod.mod + ":probe\\]"));

    // 4) 完全没有 window：静默返回，不抛错
    const ctx4 = softContext(mod, undefined);
    ctx4.__err = err;
    assert.doesNotThrow(() => vm.runInContext('soft("probe", __err)', ctx4));
  }
});

test("ARCH-2 行为：接入真实 SXErrors 后每个标签只记首条诊断，bySoft 可观测", () => {
  const errorsSrc = read("src/core_errors.js");
  for (const mod of MODULES) {
    const ctx = { console: quietConsole };
    vm.createContext(ctx);
    vm.runInContext(errorsSrc, ctx);
    assert.equal(typeof ctx.SXErrors.soft, "function", "core_errors 未暴露 soft");
    ctx.window = ctx;
    vm.runInContext(extractFn(read(mod.file), "function soft(tag, e) {"), ctx);
    vm.runInContext('soft("probe", new Error("one")); soft("probe", new Error("two"));', ctx);

    const counts = ctx.SXErrors.counts();
    assert.equal(counts.bySoft[mod.mod + ":probe"], 2, mod.file + " bySoft 未计数");
    const labeled = ctx.SXErrors.recentErrors(10).filter((x) => x.phase === mod.mod + ":probe");
    assert.equal(labeled.length, 1, mod.file + " 同一标签只应记首条诊断");
  }
});

test("ARCH-2 行为：可选 API 探测失败仍走原回退路径，只多一条 soft 诊断", () => {
  const loadFn = (mod, header, windowObj, globals) => {
    const ctx = softContext(mod, windowObj);
    Object.assign(ctx, globals || {});
    vm.runInContext(extractFn(read(mod.file), header), ctx);
    return ctx;
  };
  const throwing = (calls) => ({ __SX: { mapId() { throw new Error("no map"); } }, SXErrors: { soft: (t) => calls.push(t) } });

  // ext_ai.currentMapId：__SX.mapId 抛错 → 回退 G.level → "harbor"
  const aiCalls = [];
  const ai = loadFn(MODULES[2], "function currentMapId() {", throwing(aiCalls), { G: null });
  assert.equal(vm.runInContext("currentMapId()", ai), "harbor");
  assert.deepEqual(aiCalls, ["ai:map-id"]);

  // 正常路径：__SX.mapId 返回时直接使用，不产生诊断
  const aiCalls2 = [];
  const ai2 = loadFn(MODULES[2], "function currentMapId() {", { __SX: { mapId: () => "ship" }, SXErrors: { soft: (t) => aiCalls2.push(t) } }, { G: null });
  assert.equal(vm.runInContext("currentMapId()", ai2), "ship");
  assert.deepEqual(aiCalls2, []);

  // ext_visual.mapId：__SX.mapId 抛错 → 回退 S.map
  const visCalls = [];
  const vis = loadFn(MODULES[0], "function mapId() {", throwing(visCalls), { S: { map: "depot" } });
  assert.equal(vm.runInContext("mapId()", vis), "depot");
  assert.deepEqual(visCalls, ["visual:map-id"]);

  // ext_feedback.weaponName：读 G.weapon 抛错 → 回退 "几式"
  const fbCalls = [];
  const fb = loadFn(MODULES[8], "function weaponName() {", { SXErrors: { soft: (t) => fbCalls.push(t) } }, { G: { get weapon() { throw new Error("no weapon"); } } });
  assert.equal(vm.runInContext("weaponName()", fb), "几式");
  assert.deepEqual(fbCalls, ["feedback:weapon-name"]);

  // 正常路径：仍返回武器短名，不产生诊断
  const fbCalls2 = [];
  const fb2 = loadFn(MODULES[8], "function weaponName() {", { SXErrors: { soft: (t) => fbCalls2.push(t) } }, { G: { weapon: { activeIndex: 0, list: [{ short: "SG12" }] } } });
  assert.equal(vm.runInContext("weaponName()", fb2), "SG12");
  assert.deepEqual(fbCalls2, []);
});

/* ------------------------------------------------------------- ARCH-1 */

test("ARCH-1 源码：防重入标记挂在宿主对象上，且先写标记再包覆", () => {
  const cases = [
    { file: "src/ext_ai.js", guard: "if (ctx.__sxAIThink) return;", marker: "ctx.__sxAIThink = true;", wrap: "ctx.think = wrapped;" },
    { file: "src/ext_ai.js", guard: "if (G.enemies.__sxAIUpdate) return;", marker: "G.enemies.__sxAIUpdate = true;", wrap: "G.enemies.update = wrapped;" },
    { file: "src/ext_enemies2.js", guard: "if (g.enemies.__sxE2Spawn) return;", marker: "g.enemies.__sxE2Spawn = true;", wrap: "g.enemies.spawn = wrapped;" },
    { file: "src/ext_enemies2.js", guard: "if (!g.enemies.__sxE2Update) {", marker: "g.enemies.__sxE2Update = true;", wrap: "g.enemies.update = upd;" },
    { file: "src/ext_missions2.js", guard: "if (!G.game || G.game.__sxM2Start) return;", marker: "G.game.__sxM2Start = true;", wrap: "G.game.start = function (opts) {" },
    { file: "src/ext_missions2.js", guard: "if (!G.game || G.game.__sxM2Update) return;", marker: "G.game.__sxM2Update = true;", wrap: "G.game.update = function (dt) {" },
    { file: "src/ext_visual.js", guard: "if (!G.render || G.render.__sxVisualFrame) return;", marker: "G.render.__sxVisualFrame = true;", wrap: "G.render.frame = wrapped;" },
    { file: "src/ext_lights.js", guard: "if (baseFrame && !G.render.__sxLightsFrame) {", marker: "G.render.__sxLightsFrame = true;", wrap: "G.render.frame = wrapped;" },
    { file: "src/ext_weapons2.js", guard: "if (!combat || combat.__sxW2) return;", marker: "combat.__sxW2 = true;", wrap: "combat.playerShot = function (origin, dir, opts) {" }
  ];
  for (const c of cases) {
    const src = read(c.file);
    assert.ok(src.includes(c.guard), c.file + " 缺宿主标记守卫：" + c.guard);
    assert.ok(src.includes(c.marker), c.file + " 缺宿主标记写入：" + c.marker);
    assert.ok(src.includes(c.wrap), c.file + " 缺包覆语句：" + c.wrap);
    assert.ok(src.indexOf(c.marker) < src.indexOf(c.wrap), c.file + " 必须先写标记再包覆：" + c.marker);
    // 标记必须是宿主对象的属性，不能写在被包覆的函数变量上
    assert.match(c.marker, /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+ = true;$/, c.file + " 标记不在宿主对象上");
  }
});

test("ARCH-1 源码：旧的函数级标记清零，宿主守卫全部带早退/跳过", () => {
  const banned = [
    /wrapped\.__sxAI\s*=/,
    /wrapped\.__sxE2\s*=/,
    /upd\.__sxE2\s*=/,
    /wrapped\.__sxVisual\s*=/,
    /wrapped\.__sxLightWrapped\s*=/,
    /baseThink\.__sxAI/,
    /baseSpawn\.__sxE2/,
    /base\.__sxVisual/,
    /baseFrame\.__sxLightWrapped/,
    /G\.game\.start\.__missions2/,
    /G\.game\.update\.__missions2/
  ];
  for (const mod of MODULES) {
    const src = read(mod.file);
    for (const re of banned) assert.ok(!re.test(src), mod.file + " 仍有函数级标记 " + re);
  }
  // 包覆函数局部变量不再被当作标记载体
  assert.ok(!/var wrapped = function[\s\S]{0,400}?wrapped\.__sx/.test(read("src/ext_ai.js")));
  assert.ok(!/var wrapped = function[\s\S]{0,400}?wrapped\.__sx/.test(read("src/ext_visual.js")));
});

test("ARCH-1 源码：既有宿主标记保持（UI / 武器 / 音乐 / 音频 / 反馈不再退回函数级）", () => {
  const pairs = [
    ["src/ext_ui2.js", "G.hud.__sxUi2"],
    ["src/ext_ui2.js", "hud.__sxUi2 = true;"],
    ["src/ext_ui2.js", "ls.__sxPatched"],
    ["src/ext_weapons2.js", "combat.__sxW2"],
    ["src/ext_music2.js", "G.audio.__sxMgate"],
    ["src/ext_music2.js", "G.hud.__sxMradio"],
    ["src/ext_music2.js", "G.game.__sxMhooked"],
    ["src/ext_audio2.js", "G.audio.__sx2play"],
    ["src/ext_audio2.js", "G.audio.__sx2loop"],
    ["src/ext_feedback.js", "G.enemies.__xfSpawnWrapped"]
  ];
  for (const [file, marker] of pairs) {
    assert.ok(read(file).includes(marker), file + " 缺宿主标记 " + marker);
  }
  // 重复 init 必须直接返回/跳过，而不是继续再包一层
  assert.equal((read("src/ext_ai.js").match(/if \(ctx\.__sxAIThink\) return;/g) || []).length, 1);
  assert.equal((read("src/ext_ai.js").match(/if \(G\.enemies\.__sxAIUpdate\) return;/g) || []).length, 1);
  assert.equal((read("src/ext_visual.js").match(/if \(!G\.render \|\| G\.render\.__sxVisualFrame\) return;/g) || []).length, 1);
});
