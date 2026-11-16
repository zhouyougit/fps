import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

function loadConfig(rel) {
  const file = path.join(SRC, rel);
  delete require.cache[require.resolve(file)];
  require(file);
}

test("V42 配置层：画质档位完整且 high 用 MSAA 2", () => {
  delete globalThis.SX_QUALITY_PRESETS;
  delete globalThis.SX_QUALITY_PIXEL_BUDGET;
  loadConfig("config/quality.js");
  const P = globalThis.SX_QUALITY_PRESETS;
  assert.ok(P && P.low && P.medium && P.high && P.ultra && P.test);
  assert.equal(P.high.msaa, 2, "high 已有 TAA，不应再开 4x MSAA");
  assert.equal(P.ultra.msaa, 4);
  for (const name of ["low", "medium", "high", "ultra"]) {
    for (const key of ["scale", "msaa", "shadow", "tex", "volSteps", "ao", "bloom", "motionBlur", "rain"]) {
      assert.ok(key in P[name], name + " 缺字段 " + key);
    }
  }
  assert.deepEqual(globalThis.SX_QUALITY_PIXEL_BUDGET, { low: 1000000, medium: 1500000, high: 2300000, ultra: 3700000 });
});

test("V47 配置层：联机角色外观/比例可调", () => {
  delete globalThis.SX_AVATAR_CONFIG;
  loadConfig("config/avatar.js");
  const A = globalThis.SX_AVATAR_CONFIG;
  assert.ok(A && A.version);
  assert.equal(A.team[0].accent, 0x4fa8ff);
  assert.equal(A.team[1].accent, 0xff6a55);
  assert.equal(A.materials.kit, 0x4a555c);
  assert.equal(A.proportions.headScale, 0.88);
  assert.equal(A.proportions.crouchHip, 0.70);
  assert.ok(A.blob && A.blob.size > 0);
});

test("V42 配置层：平衡参数覆盖玩家/任务/敌人/移动/灯光", () => {
  delete globalThis.SX_BALANCE;
  loadConfig("config/balance.js");
  const B = globalThis.SX_BALANCE;
  assert.ok(B && B.version);
  assert.equal(B.player.eye, 1.68);
  assert.equal(B.player.height, 1.8);
  assert.equal(B.mission.maxAlive, 9);
  assert.equal(B.mission.waves.length, 3);
  assert.equal(B.mission.waves[2].hound, 3);
  for (const id of ["scout", "siege", "emp", "warden"]) {
    assert.ok(B.enemies.variants[id], "缺敌人变体 " + id);
    assert.ok(B.enemies.variants[id].hp > 0);
  }
  assert.equal(B.enemies.suicideDrone.explodeDamage, 36);
  assert.equal(B.enemies.suicideDrone.explodeRadius, 4.0);
  assert.equal(B.movement.slide.startSpeed, 7.6);
  assert.equal(B.movement.vault.maxRise, 1.3);
  assert.equal(B.lights.pool, 8);
  assert.equal(B.lights.flash, 2);
  assert.equal(B.lights.fill, 1);
  assert.equal(B.render.pixelBudget.medium, 1500000);
});

test("V42 武器数据：packages/data/weapons/*.json 是唯一源且六把齐全", () => {
  const ids = ["pac9", "breaker12", "dmr", "smg", "lmg", "sidearm"];
  const seen = [];
  for (const id of ids) {
    const file = path.join(ROOT, "packages/data/weapons", id + ".json");
    assert.ok(fs.existsSync(file), "缺武器 JSON " + id);
    const w = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(w.id, id);
    assert.ok(w.damage > 0 && w.mag > 0 && w.reserve >= 0);
    assert.ok(w.fire && w.fire.rpm > 0);
    assert.ok(w.reload && w.reload.tactical && w.reload.tactical.time > 0);
    seen.push(w.id);
  }
  assert.deepEqual(seen, ids);
});

test("V42 大文件拆分：manifest 覆盖全部行且无空洞", () => {
  const manifestFile = path.join(SRC, "game/manifest.json");
  assert.ok(fs.existsSync(manifestFile));
  const m = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  assert.equal(m.parts.length, 6);
  let expect = 1;
  let bytes = 0;
  for (const p of m.parts) {
    assert.equal(p.lines[0], expect, p.file + " 与上一片不连续");
    assert.ok(p.lines[1] >= p.lines[0]);
    const f = path.join(ROOT, p.file);
    assert.ok(fs.existsSync(f), "缺片段 " + p.file);
    bytes += fs.statSync(f).size;
    expect = p.lines[1] + 1;
  }
  assert.equal(expect, m.lineCount + 1, "manifest 未覆盖到最后一行");
  assert.ok(bytes > 2000000, "拆分后总字节数异常");
});

test("V42 构建顺序：build.cjs 从 manifest 读取片段且配置先于引擎", () => {
  const build = fs.readFileSync(path.join(ROOT, "tools/build.cjs"), "utf8");
  assert.ok(/gameManifest\.parts/.test(build));
  const cfg = build.indexOf("src/config/quality.js");
  const game = build.indexOf("gameManifest");
  assert.ok(cfg >= 0 && game > cfg, "配置层必须先于 game 片段");
  assert.ok(build.indexOf("weaponDataTag + weaponExt") > 0, "武器 JSON 应在构建时注入");
});
