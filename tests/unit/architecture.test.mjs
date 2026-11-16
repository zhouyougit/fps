import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("V53 架构：game 片段 manifest 完整且不再有单文件 game.js", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "src/game.js")), false);
  const m = JSON.parse(read("src/game/manifest.json"));
  assert.equal(m.parts.length, 6);
  let expect = 1;
  for (const p of m.parts) {
    assert.equal(p.lines[0], expect, p.file + " 不连续");
    assert.ok(fs.existsSync(path.join(ROOT, p.file)), "缺片段 " + p.file);
    expect = p.lines[1] + 1;
  }
  assert.equal(expect, m.lineCount + 1);
});

test("V53 架构：config 先于 game，武器数据只保留 JSON 源", () => {
  const build = read("tools/build.cjs");
  const q = build.indexOf("src/config/quality.js");
  const b = build.indexOf("src/config/balance.js");
  const a = build.indexOf("src/config/avatar.js");
  const g = build.indexOf("gameManifest");
  assert.ok(q > 0 && b > q && a > b && g > a, "config 顺序错误");
  assert.ok(build.indexOf("weaponDataTag + weaponExt") > 0);
  const weapon = read("src/weapon_ext.js");
  assert.ok(!/var SX_WEAPON_DATA = \{/.test(weapon), "weapon_ext 不应再有完整武器表");
  assert.ok(weapon.indexOf("__SX_WEAPON_DATA_SOURCE") > 0);
});

test("V53 架构：关键运行时约定存在", () => {
  const mapkit = read("src/mapkit.js");
  assert.ok(/MAP_CACHE_LIMIT = 2/.test(mapkit));
  assert.ok(/sxMapOwned/.test(mapkit));
  const lights = read("src/ext_lights.js");
  assert.ok(/POOL = LB\.pool \|\| 8/.test(lights));
  const mp = read("src/mp.js");
  assert.ok(/MAX_PENDING_SEND = 90/.test(mp));
  assert.ok(/updateRemoteLod/.test(mp));
  const avatar = read("src/mp_avatar.js");
  for (const field of ["handL:", "handR:", "magBase:", "muzzleLocal:", "far:", "blob:"]) {
    assert.ok(avatar.indexOf(field) > 0, "avatar 缺字段 " + field);
  }
  const cfg = read("src/config/avatar.js");
  for (const key of ["team:", "materials:", "proportions:", "blob:", "lod:"]) {
    assert.ok(cfg.indexOf(key) > 0, "avatar config 缺 " + key);
  }
});

test("V53 架构：历史快照保护与 V53 profile", () => {
  const build = read("tools/build.cjs");
  assert.ok(build.indexOf("'v53'") > 0, "build 缺 v53 profile");
  assert.ok(build.indexOf("'v54'") > 0, "build 缺 v54 profile");
  assert.ok(build.indexOf("'v55'") > 0, "build 缺 v55 profile");
  assert.ok(build.indexOf("--minify") > 0, "build 缺 --minify");
  assert.ok(build.indexOf("拒绝覆盖历史快照") > 0, "build 缺 versions 快照保护");
  assert.ok(build.indexOf("--force") > 0, "build 缺 --force 逃生口");
  assert.ok(build.indexOf("three: 'r180'") > 0, "build 缺 three 版本记录");
});

test("V53 架构：服务器共享移动/模拟时钟/协议侧身位", () => {
  const server = read("server/server.cjs");
  assert.ok(server.indexOf("sim.movement.stepPlayer") > 0, "服务器未调用共享 stepPlayer");
  assert.ok(server.indexOf("function simNowMs") > 0, "服务器缺模拟时钟");
  assert.ok(!/const MOVE = Object\.freeze\(/.test(server), "服务器不应再保留 MOVE 副本");
  const proto = read("packages/net/protocol.js");
  assert.ok(/LEAN_L:\s*1024/.test(proto) && /LEAN_R:\s*2048/.test(proto), "协议缺侧身位");
  const runner = read("tools/run_tests.mjs");
  assert.ok(runner.indexOf("const okRes = !killed && code === 0") > 0, "runner 不应再用绿色正则兜底");
  assert.ok(runner.indexOf("test_v55_acceptance.mjs") > 0, "full 套件缺 V55 专项");
});

test("V53 架构：SXErrors.soft 诊断限频接口存在", () => {
  const errors = read("src/core_errors.js");
  assert.ok(/function soft\(tag, e\)/.test(errors));
  assert.ok(/bySoft: Object\.assign/.test(errors));
  assert.ok(errors.indexOf("soft: soft") > 0);
});
