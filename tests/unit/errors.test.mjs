import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const errors = require("../../src/core_errors.js");

test("SXErrors.soft: 同一标签只记一条诊断，但计数累加", () => {
  global.window = { __errors: [] };
  errors.clear();
  errors.soft("empty-catch", new Error("first"));
  errors.soft("empty-catch", new Error("second"));
  errors.soft("other", new Error("third"));
  const c = errors.counts();
  assert.equal(c.bySoft["empty-catch"], 2);
  assert.equal(c.bySoft.other, 1);
  const logged = errors.recentErrors().filter((e) => e.system === "soft");
  assert.equal(logged.length, 2);
  assert.equal(logged.filter((e) => e.phase === "empty-catch").length, 1);
  delete global.window;
});
