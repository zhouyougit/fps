/* =====================================================================
   tests/unit/ext_arch_v53.test.mjs
   V53 · PERF-4（ext.js 槽位复用与脏检查）
        ARCH-2（空 catch → SXErrors.soft("ext:<tag>")）
        ARCH-1（G.game.update / G.hud.radio 宿主对象防重包标记）

   纯 Node / vm：不启动浏览器，不依赖 DOM。
   - 源码级断言：不再 map 造槽位、soft 覆盖、宿主标记与包覆顺序
   - vm 行为断言：buildSlotsHtml 输出与旧实现逐字节一致；脏检查只比值
   ===================================================================== */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXT_SRC = fs.readFileSync(path.join(ROOT, "src/ext.js"), "utf8");

const fnBody = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  assert.ok(a >= 0, "找不到 " + startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  assert.ok(b > a, "找不到 " + endMarker);
  return src.slice(a, b);
};

/* ------------------------------------------------------------ vm 工具 */

function loadContext(extra) {
  const ctx = Object.assign({ console: { log() {}, warn() {}, error() {} } }, extra);
  vm.createContext(ctx);
  vm.runInContext(fnBody(EXT_SRC, "function soft(tag, e) {", "  function gameAfter("), ctx);
  vm.runInContext(fnBody(EXT_SRC, "function buildSlotsHtml(list, active, grenades) {", "  // 槽位脏检查"), ctx);
  vm.runInContext(fnBody(EXT_SRC, "function slotsChanged(cache, list, active, grenades) {", "  function buildHUD() {"), ctx);
  return ctx;
}

// 旧实现（V52）逐字节对照：用来证明“数据不变”。
function legacySlotsHtml(list, active, grenades) {
  let html = "";
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    html += '<div class="x-slot' + (i === active ? " on" : "") + '"><b>' + (i + 1) + "</b><span>" + w.short + "</span><em>" + (w.ammo | 0) + "</em></div>";
  }
  html += '<div class="x-gren' + (grenades > 0 ? "" : " empty") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 8.5a5.5 5.5 0 1 0 6 0V6H9v2.5Z"/><path d="M11 6V4h2v2M13 3.2l2.6-1.1"/></svg><b>' + grenades + '</b><span class="k">G</span></div>';
  return html;
}

const sixWeapons = () => [
  { short: "九式", ammo: 30 },
  { short: "MK4", ammo: 12 },
  { short: "PAC9", ammo: 0 },
  { short: "SG12", ammo: 7 },
  { short: "DMR", ammo: 45 },
  { short: "SMG", ammo: 8 }
];

const freshCache = () => ({ n: -1, active: -1, gren: -1, shorts: [], ammos: [] });

/* ------------------------------------------------------------ PERF-4 */

test("PERF-4 源码：槽位直接复用 w.list / w.slots，不再每步 map 出新数组", () => {
  assert.ok(
    !EXT_SRC.includes(".map(function (x) { return { short: x.short, ammo: x.ammo }; })"),
    "仍在用 map 构造槽位数组"
  );
  assert.ok(!/w\.list\.map\(/.test(EXT_SRC), "w.list.map 仍存在");
  const block = fnBody(EXT_SRC, "    // HUD loadout", "    var act = w && w.list");
  assert.match(EXT_SRC, /var SLOT_FALLBACK = \[\{ short: .*?, ammo: 0 \}\];/); // 模块级缓存回退数组
  assert.match(block, /var slots = SLOT_FALLBACK;/);
  assert.match(block, /if \(w && w\.list\) slots = w\.list;/);
  assert.match(block, /else if \(w && w\.slots && w\.slots\.length\) slots = w\.slots;/);
  assert.match(block, /SLOT_FALLBACK\[0\]\.ammo = \(w && w\.ammo\) \| 0;/);
  assert.match(block, /HUD\.setSlots\(slots, w && w\.activeIndex \|\| 0, S\.grenades\);/);
});

test("PERF-4 源码：setSlots 有脏检查，值不变时不建 HTML / 不写 DOM", () => {
  const setSlots = fnBody(EXT_SRC, "      setSlots: function (list, active, grenades) {", "    };\n    return HUD;");
  assert.match(setSlots, /if \(!slotsChanged\(this\._slotCache, list, active, grenades\)\) return;/);
  assert.match(setSlots, /var html = buildSlotsHtml\(list, active, grenades\);/);
  assert.match(setSlots, /if \(html !== this\._slotHtml\)/);
  assert.match(setSlots, /rememberSlots\(this\._slotCache, list, active, grenades\);/);
  // 槽位缓存是固定字段，不在每步产生新对象
  assert.match(EXT_SRC, /_slotCache: \{ n: -1, active: -1, gren: -1, shorts: \[\], ammos: \[\] \}/);
});

test("PERF-4 行为：buildSlotsHtml 与旧实现逐字节一致（6 格 / 当前格 / 弹药 / 手雷）", () => {
  const ctx = loadContext({ window: {} });
  const list = sixWeapons();
  for (const [active, gren] of [[0, 2], [2, 0], [5, 1], [9, 4]]) {
    assert.equal(ctx.buildSlotsHtml(list, active, gren), legacySlotsHtml(list, active, gren), "active=" + active + " gren=" + gren);
  }
  const html = ctx.buildSlotsHtml(list, 2, 2);
  assert.equal((html.match(/class="x-slot/g) || []).length, 6, "HUD 必须是 6 格");
  assert.equal((html.match(/x-slot on/g) || []).length, 1, "只能有一格高亮");
  assert.match(html, /x-slot on"><b>3<\/b><span>PAC9<\/span><em>0<\/em>/);
  for (const ammo of [30, 12, 0, 7, 45, 8]) assert.ok(html.includes("<em>" + ammo + "</em>"), "缺弹药 " + ammo);
  assert.ok(html.includes('<b>2</b><span class="k">G</span>'), "手雷数字未更新");
  assert.ok(!/x-gren empty/.test(html), "有手雷时不应是 empty 态");
  assert.match(ctx.buildSlotsHtml(list, 0, 0), /x-gren empty/);
  // 弹药为负/非数字时保持 (ammo|0) 的旧语义
  assert.ok(ctx.buildSlotsHtml([{ short: "X", ammo: -3.9 }], 0, 0).includes("<em>-3</em>"));
  assert.ok(ctx.buildSlotsHtml([{ short: "X", ammo: undefined }], 0, 0).includes("<em>0</em>"));
});

test("PERF-4 行为：setSlots 相同值第二次不写 DOM，只有值变化才重建", () => {
  const ctx = loadContext({ window: {} });
  vm.runInContext(fnBody(EXT_SRC, "  var SLOT_FALLBACK =", "  // 槽位 HTML"), ctx);
  const method = fnBody(EXT_SRC, '      _slotHtml: "",', "    };\n    return HUD;");
  vm.runInContext("var __hud = {\n" + method + "};", ctx);
  vm.runInContext(
    "__hud.loadoutEl = { _html: \"\", _writes: 0, set innerHTML(v) { this._html = v; this._writes++; }, get innerHTML() { return this._html; } };",
    ctx
  );

  const list = sixWeapons();
  const hud = ctx.__hud;
  hud.setSlots(list, 2, 2);
  assert.equal(hud.loadoutEl._writes, 1, "首帧必须渲染");
  assert.equal(hud.loadoutEl._html, legacySlotsHtml(list, 2, 2));

  hud.setSlots(list, 2, 2);
  assert.equal(hud.loadoutEl._writes, 1, "同值不应重写 DOM");

  // 换一个“值相同、引用不同”的数组：仍按值比较，不重写
  hud.setSlots(list.map((x) => ({ short: x.short, ammo: x.ammo })), 2, 2);
  assert.equal(hud.loadoutEl._writes, 1, "按值比较，不应因新数组而重写");

  list[3].ammo = 99;
  hud.setSlots(list, 2, 2);
  assert.equal(hud.loadoutEl._writes, 2, "弹药变化必须重写");
  assert.ok(hud.loadoutEl._html.includes("<em>99</em>"));

  hud.setSlots(list, 0, 2);
  assert.equal(hud.loadoutEl._writes, 3, "当前槽变化必须重写");
  assert.match(hud.loadoutEl._html, /x-slot on"><b>1<\/b>/);

  hud.setSlots(list, 0, 0);
  assert.equal(hud.loadoutEl._writes, 4, "手雷数变化必须重写");
  assert.match(hud.loadoutEl._html, /x-gren empty/);

  hud.setSlots([], 0, 1);
  assert.equal((hud.loadoutEl._html.match(/class="x-slot/g) || []).length, 0, "空列表只留手雷格");
  assert.ok(hud.loadoutEl._html.includes('<b>1</b><span class="k">G</span>'));

  hud.setSlots(null, 0, 1);
  assert.ok(hud.loadoutEl._html.includes("九式"), "无武器时用缓存回退数组");
});

test("PERF-4 行为：slotsChanged 只在 ammo/short/active/grenades/长度变化时返回 true", () => {
  const ctx = loadContext({ window: {} });
  const list = sixWeapons();
  const cache = freshCache();

  assert.equal(ctx.slotsChanged(cache, list, 1, 2), true, "空缓存必须先渲染");
  ctx.rememberSlots(cache, list, 1, 2);
  assert.equal(ctx.slotsChanged(cache, list, 1, 2), false, "值未变不应重建");

  list[2].ammo -= 1;
  assert.equal(ctx.slotsChanged(cache, list, 1, 2), true, "弹药变化要重建");
  ctx.rememberSlots(cache, list, 1, 2);
  assert.equal(ctx.slotsChanged(cache, list, 1, 2), false);

  list[0].short = "九式·改";
  assert.equal(ctx.slotsChanged(cache, list, 1, 2), true, "枪名变化要重建");
  ctx.rememberSlots(cache, list, 1, 2);

  assert.equal(ctx.slotsChanged(cache, list, 2, 2), true, "当前槽变化要重建");
  assert.equal(ctx.slotsChanged(cache, list, 1, 3), true, "手雷数变化要重建");
  assert.equal(ctx.slotsChanged(cache, list.concat([{ short: "NEW", ammo: 1 }]), 1, 2), true, "槽数变化要重建");

  // 脏检查本身不分配：没有 map/slice/new Array/JSON
  const body = fnBody(EXT_SRC, "function slotsChanged(cache", "  function rememberSlots(");
  assert.ok(!/\.map\(|\.slice\(|new Array|JSON\.stringify/.test(body), "脏检查里出现了分配操作");
});

/* ------------------------------------------------------------ ARCH-2 */

test("ARCH-2 源码：空 catch 已清零，唯一静默项是已注明的可选全局探测", () => {
  const trulyEmpty = EXT_SRC.match(/catch \([A-Za-z_$][\w$]*\) \{\s*\}/g) || [];
  assert.deepEqual(trulyEmpty, [], "仍有空 catch: " + trulyEmpty.join(" | "));

  const silentE = [...EXT_SRC.matchAll(/catch \(e\) \{\s*(?:\/\*[\s\S]*?\*\/)?\s*\}/g)];
  assert.equal(silentE.length, 1, "除 MapKit 可选探测外不应再有静默 catch (e)");
  assert.match(EXT_SRC, /catch \(e\) \{ \/\* 可选全局未就绪 \*\/ \}/);
  // soft 自身的两个兜底 catch 用 _，不影响统计
  assert.match(EXT_SRC, /catch \(_\) \{ \/\* 诊断失败不能影响调用方 \*\/ \}/);
});

test("ARCH-2 源码：35 处高频 catch 走 soft，标签按职责区分", () => {
  const softCatches = EXT_SRC.match(/catch \((?:e|err)\) \{ soft\("[a-z-]+", (?:e|err)\); \}/g) || [];
  assert.ok(softCatches.length >= 30, "soft 化的 catch 太少：" + softCatches.length);
  assert.match(EXT_SRC, /window\.SXErrors\.soft\("ext:" \+ tag, e\)/);

  for (const tag of [
    "timer", "clock", "clock-tick", "systems-tick", "systems-state",
    "perf", "audio-update", "pickup-sfx", "grenade-emit", "grenade-sfx", "grenade-bounce-sfx",
    "explode-fx", "explode-emit", "explode-light", "melee-shot", "melee-emit",
    "revive-clear", "revive-run", "revive-boss", "revive-input", "map-probe",
    "shield-sparks", "shield-sfx", "shield-break-sparks", "shield-break-sfx",
    "switch-sfx", "boss-phase-sfx", "state-sfx", "heartbeat-sfx",
    "map-loaded-emit", "touch-ui", "save-flush", "debug-cut", "progress-unlock"
  ]) {
    assert.ok(EXT_SRC.includes('soft("' + tag + '"'), "缺 soft 标签 " + tag);
  }
});

test("ARCH-2 行为：soft 优先走 SXErrors.soft('ext:<tag>')，缺接口/抛错时退回 __errors", () => {
  // 1) 正常路径：标签加前缀，只转发一次
  const calls = [];
  const ctx1 = loadContext({ window: { SXErrors: { soft: (tag, e) => calls.push([tag, e && e.message]) } } });
  const err = new Error("boom");
  ctx1.soft("perf", err);
  assert.deepEqual(calls, [["ext:perf", "boom"]]);

  // 2) 没有 SXErrors：退回 window.__errors，并带标签
  const ctx2 = loadContext({ window: { __errors: [] } });
  ctx2.soft("map-probe", new Error("late"));
  assert.equal(ctx2.window.__errors.length, 1);
  assert.match(ctx2.window.__errors[0], /^\[ext:map-probe\] Error: late/);

  // 3) SXErrors.soft 自己抛错：不能影响调用方，仍退回 __errors
  const ctx3 = loadContext({ window: { SXErrors: { soft() { throw new Error("diag down"); } }, __errors: [] } });
  assert.doesNotThrow(() => ctx3.soft("timer", new Error("timer fail")));
  assert.equal(ctx3.window.__errors.length, 1);
  assert.match(ctx3.window.__errors[0], /^\[ext:timer\]/);

  // 4) 完全没有 window（防御）：不抛错
  const ctx4 = loadContext({});
  assert.doesNotThrow(() => ctx4.soft("timer", new Error("no window")));
});

/* ------------------------------------------------------------ ARCH-1 */

test("ARCH-1 源码：G.game.update 用宿主标记防二次包覆，调用顺序不变", () => {
  const wrap = fnBody(EXT_SRC, "if (!G.game.__sxExtUpdate) {", '    G.events.on("game:state"');
  assert.match(wrap, /G\.game\.__sxExtUpdate = true;/);
  assert.match(wrap, /var baseUpdate = G\.game\.update;/);
  // 标记先于包覆，保证重复 init 直接跳过
  assert.ok(
    wrap.indexOf("G.game.__sxExtUpdate = true;") < wrap.indexOf("G.game.update = function (dt)"),
    "标记必须写在包覆之前"
  );
  // 先原 update，再 ext update（顺序不变）
  assert.ok(
    wrap.indexOf("baseUpdate.call(G.game, dt)") < wrap.indexOf("try { update(dt); }"),
    "必须先调用原 update，再调用 ext update"
  );
  assert.ok(!/G\.game\.__sxExtUpdate\s*\|\|/.test(wrap), "标记不能退化成只写在函数上");
});

test("ARCH-1 源码：G.hud.radio 用宿主标记防二次包覆，任务电台走稳定事件", () => {
  const wrap = fnBody(EXT_SRC, "if (!G.hud.__sxExtRadio) {", "    // 首次进入战斗的操作提示");
  assert.match(wrap, /G\.hud\.__sxExtRadio = true;/);
  assert.ok(
    wrap.indexOf("G.hud.__sxExtRadio = true;") < wrap.indexOf("G.hud.radio = function (text, secs)"),
    "标记必须写在包覆之前"
  );
  // V54：不再用中文前缀匹配；intro 由 sx:mission-radio 预置，下一条 radio 消费一次，其余透传。
  assert.equal((wrap.match(/baseRadio\.call\(G\.hud/g) || []).length, 2);
  assert.match(EXT_SRC, /sx:mission-radio/);
  assert.match(wrap, /arm\.kind === "intro"/);
  assert.match(wrap, /m\.intro/);
  assert.ok(!/text\.indexOf\(/.test(wrap), "不应再用 text.indexOf 匹配中文");
  assert.ok(
    wrap.indexOf("var arm = radioArm") < wrap.indexOf("return baseRadio.call(G.hud, text, secs);"),
    "默认透传必须在事件消费之后"
  );
});

test("ARCH-1 源码：两个包覆都只在 boot 内、且保留 booted 早退", () => {
  assert.match(EXT_SRC, /function boot\(\) \{\s*\n\s*if \(booted\) return;/);
  assert.ok(EXT_SRC.indexOf("if (!G.game.__sxExtUpdate)") > EXT_SRC.indexOf("function boot()"));
  assert.ok(EXT_SRC.indexOf("if (!G.hud.__sxExtRadio)") > EXT_SRC.indexOf("function boot()"));
});
