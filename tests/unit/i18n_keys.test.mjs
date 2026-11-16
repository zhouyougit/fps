import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/* V53 · I18N-1：词典中英同键 + 新增 progress./input./ui2.* 抽查。
   不启动浏览器：只把 core_i18n.js / i18n_extra.js 当普通脚本加载，
   i18n_extra 通过 window.SXI18n 挂载（与浏览器里的加载顺序一致）。 */

const require = createRequire(import.meta.url);
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

function loadI18n() {
  global.window = globalThis;
  delete globalThis.SXI18n;
  delete globalThis.__SX_I18N_EXTRA;
  delete globalThis.__SX_I18N_MISSIONS;
  for (const name of ["core_i18n.js", "i18n_extra.js"]) {
    const file = path.join(SRC, name);
    delete require.cache[require.resolve(file)];
    require(file);
  }
  const I = global.window.SXI18n;
  const extra = global.window.__SX_I18N_EXTRA;
  assert.ok(I && typeof I.t === "function", "core_i18n 未挂到 window.SXI18n");
  assert.ok(extra && typeof extra.mount === "function", "i18n_extra 未挂到 window.__SX_I18N_EXTRA");
  return { I, extra };
}

const { I, extra } = loadI18n();
const ZH = I.dict["zh-CN"];
const EN = I.dict.en;

/* 英文词典里允许保留中文的值：
   - 语言名“中文”在两种语言下都显示原文；
   - 切到中文时的提示语本身描述“已切换为中文”。 */
const EN_CJK_ALLOWED = new Set(["ui.settings.lang.zh", "ui2.settings.lang.zh", "ui2.lang.applied"]);

test("V53 i18n：zh-CN 与 en 键集合完全一致", () => {
  const zhKeys = Object.keys(ZH).sort();
  const enKeys = Object.keys(EN).sort();
  assert.deepEqual(enKeys, zhKeys, "中英键集合不一致");
  const missing = zhKeys.filter((k) => EN[k] == null || EN[k] === "");
  assert.deepEqual(missing, [], "en 缺失或为空：" + missing.join(", "));
  assert.ok(zhKeys.length > 800, "词典规模异常：" + zhKeys.length);
  assert.ok(extra.keys.length > 100, "i18n_extra 导出键数异常：" + extra.keys.length);
  const notMounted = extra.keys.filter((k) => ZH[k] !== extra.zh[k] || EN[k] !== extra.en[k]);
  assert.deepEqual(notMounted, [], "i18n_extra 的键未挂载到 SXI18n：" + notMounted.join(", "));
});

test("V53 i18n：en 不残留中文（语言名 / 切换提示除外）", () => {
  const stale = Object.keys(EN).filter((k) => /[\u4e00-\u9fff]/.test(String(EN[k])) && !EN_CJK_ALLOWED.has(k));
  assert.deepEqual(stale, [], "en 仍有中文：" + stale.map((k) => k + "=" + EN[k]).join(", "));
});

test("V53 i18n：progress.* / input.* 每个键中英齐全", () => {
  for (const ns of ["progress.", "input."]) {
    const keys = Object.keys(ZH).filter((k) => k.indexOf(ns) === 0);
    assert.ok(keys.length >= 20, ns + " 键数异常：" + keys.length);
    for (const k of keys) {
      assert.ok(EN[k] != null && EN[k] !== "", "en 缺少 " + k);
      assert.notEqual(String(ZH[k]).trim(), "", "zh 为空 " + k);
    }
  }
});

test("V53 i18n：新增文案抽查（中英不同且占位符一致）", () => {
  const pairs = [
    ["progress.diff.recruit", "新兵", "Recruit"],
    ["progress.diff.nightmare", "噩梦", "Nightmare"],
    ["progress.cross.3", "绿色准星", "Green crosshair"],
    ["progress.debrief.time", "用时", "Time"],
    ["progress.credit.run", "<b>+{n}</b> 信用点 · 本局收益", "<b>+{n}</b> credits · this run"],
    ["progress.hint.max", "已达最高评级 S", "Already at the top rating: S"],
    ["progress.chal.notify", "挑战 {count}/{total} · {names} · +{sum} 信用点", "Challenges {count}/{total} · {names} · +{sum} credits"],
    ["input.bind.title", "按键重绑", "Rebind Keys"],
    ["input.action.reload", "换弹", "Reload"],
    ["input.action.leanL", "左探身", "Lean Left"],
    ["input.group.combat", "战斗", "Combat"],
    ["input.key.mouse0", "鼠标左键", "Left Mouse"],
    ["input.key.numpad", "小键盘 {key}", "Numpad {key}"],
    ["ui2.brief.opCode", "行动 {code}", "Op {code}"],
    ["ui2.hud.touchKey", "交互", "Interact"]
  ];
  for (const [key, zh, en] of pairs) {
    assert.equal(ZH[key], zh, key + " zh 文案不符");
    assert.equal(EN[key], en, key + " en 文案不符");
  }
  for (const key of ["progress.credit.run", "progress.chal.notify", "input.key.numpad", "ui2.brief.opCode"]) {
    const fields = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort();
    assert.deepEqual(fields(EN[key]), fields(ZH[key]), key + " 占位符不一致");
  }
});

test("V53 i18n：中英占位符一致（{var} 不丢不增）", () => {
  const bad = [];
  for (const key of Object.keys(ZH)) {
    const fields = (v) => (String(v).match(/\{(\w+)\}/g) || []).sort().join(",");
    if (fields(ZH[key]) !== fields(EN[key])) bad.push(key + " zh=[" + fields(ZH[key]) + "] en=[" + fields(EN[key]) + "]");
  }
  assert.deepEqual(bad, [], "占位符不一致：" + bad.join("; "));
});

test("V53 i18n：SXI18n.t 按语言取词并替换变量", () => {
  I.setLang("zh-CN", { apply: false });
  assert.equal(I.t("input.bind.bound", { key: "E" }), "已绑定 E");
  assert.equal(
    I.t("progress.badge", { credits: 120, got: 3, total: 12, chal: 5, chalTotal: 24 }),
    "信用点 <b>120</b> · 成就 <b>3/12</b> · 挑战 <b>5/24</b>"
  );
  I.setLang("en", { apply: false });
  assert.equal(I.t("input.bind.swapped", { key: "E", action: "Reload" }), 'Bound to E; swapped with "Reload"');
  assert.equal(
    I.t("progress.badge", { credits: 120, got: 3, total: 12, chal: 5, chalTotal: 24 }),
    "Credits <b>120</b> · Achievements <b>3/12</b> · Challenges <b>5/24</b>"
  );
  assert.equal(I.t("progress.diff.veteran"), "Veteran");
  I.setLang("zh-CN", { apply: false });
});

test("V53 i18n：ext_progress / ext_input 的数据表只存 key", () => {
  const progress = fs.readFileSync(path.join(SRC, "ext_progress.js"), "utf8");
  const input = fs.readFileSync(path.join(SRC, "ext_input.js"), "utf8");
  // 成就名不再写死在数据表里
  assert.ok(!/name:\s*"首杀"/.test(progress), "ext_progress 成就表仍有中文 name");
  assert.ok(progress.indexOf('t("ui2.ach." + def.id + ".name")') > 0, "成就名未走词典");
  // 难度 / 准星 / 评级 / 动作 / 键位标签只存 key
  assert.ok(/DIFF_LABEL = \{[\s\S]*?"progress\.diff\.recruit"/.test(progress), "难度表未改用 key");
  assert.ok(/CROSS_AT = \{ 3: "progress\.cross\.3"/.test(progress), "准星表未改用 key");
  assert.ok(/GRADE_LABEL = \{[\s\S]*?"ui2\.rating\.perfect"/.test(progress), "评级表未改用 key");
  assert.ok(/ACTION_LABEL = \{[\s\S]*?"input\.action\.forward"/.test(input), "动作表未改用 key");
  assert.ok(/ACTION_GROUP = \{[\s\S]*?"input\.group\.move"/.test(input), "动作分组未改用 key");
  assert.ok(/KEY_LABEL = \{[\s\S]*?"input\.key\.space"/.test(input), "键名表未改用 key");
});

test("V53 i18n：ext_progress / ext_input 引用的字面量 key 都在词典里", () => {
  const files = ["ext_progress.js", "ext_input.js"];
  const seen = new Set();
  const missing = [];
  for (const name of files) {
    const src = fs.readFileSync(path.join(SRC, name), "utf8");
    const re = /["']((?:progress|input|ui2)\.[A-Za-z0-9_.]+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const key = m[1];
      if (key.slice(-1) === ".") continue; // 动态前缀
      seen.add(key);
      if (!I.has(key)) missing.push(name + " → " + key);
    }
  }
  assert.deepEqual(missing, [], "引用了不存在的键：" + missing.join(", "));
  assert.ok(seen.size > 30, "抽取到的键数异常：" + seen.size);
});
