#!/usr/bin/env node
/* 权威测试静态检查：
   1. 统一 GPU 参数（swiftshader 必须来自 pwargs，不能各写一份）；
   2. 快速套件禁止裸 sleep；
   3. 新增：测试不得硬编码用户主目录绝对路径或 macOS 专属 Chrome 路径；
   4. 新增：测试必须显式 process.exit 或使用 testkit 的 closeBrowser 收尾。
   检查 3/4 只对“套件/测试（run_tests 引用）+ V41–V52”生效；历史文件的本机路径登记为基线，
   只允许减少不允许新增，遗留数量见输出与 tools/TEST_INVENTORY.md。 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = path.join(ROOT, 'tools');
const TEST_RE = /^test_.*\.mjs$/;
const V41_PLUS_RE = /^test_v(?:4[1-9]|5[0-2])_.*\.mjs$/;

const BASE_FILES = [
  'test_suite.mjs', 'test_current.mjs', 'check_versions.mjs', 'test_fast.mjs',
  'test_v32_ground.mjs', 'test_save_migration.mjs', 'test_mapdata.mjs',
  'test_v33_weapons.mjs', 'test_v33_movement.mjs', 'test_v33_feedback.mjs', 'test_v33_input_audio.mjs',
  'test_v34_ai.mjs', 'test_v34_boss.mjs', 'test_v34_missions.mjs', 'test_v34_progress.mjs',
  'test_v35_visual.mjs', 'test_v35_audio.mjs', 'test_v35_ui.mjs', 'test_v35_ui_smoke.mjs',
  'test_v36_net.mjs', 'test_v36_smoke.mjs', 'test_v37_dead_complete.mjs', 'test_v37_gameplay.mjs',
  'test_v38_audio_perf.mjs', 'test_v38_mp_perf.mjs', 'test_v38_ui_polish.mjs', 'test_v38_armory_sim.mjs',
  'test_v39_i18n.mjs', 'test_v39_mp_e2e2.mjs', 'test_v39_perf.mjs', 'test_v39_visual.mjs'
];

/** 从 run_tests.mjs 读取它引用的 test_*.mjs，避免 lint 清单与 runner 脱节 */
function runnerTestFiles() {
  const src = readFileSync(path.join(TOOLS, 'run_tests.mjs'), 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/['"]([^'"]*\.mjs)['"]/g)) {
    const base = path.basename(m[1]);
    if (TEST_RE.test(base)) names.add(base);
  }
  return [...names];
}

const SUITE_FILES = runnerTestFiles();
const V41_PLUS = readdirSync(TOOLS).filter((f) => V41_PLUS_RE.test(f));
const STRICT = new Set([...SUITE_FILES, ...V41_PLUS, 'check_versions.mjs']);
const FILES = [...new Set([...BASE_FILES, ...SUITE_FILES, ...V41_PLUS])];

/* 历史债务基线：值为“本机路径匹配数”，线上不允许新增（可以变少）。 */
const LOCAL_PATH_BASELINE = {
  'test_mapdata.mjs': 1,
  'test_save_migration.mjs': 2,
  'test_v32_ground.mjs': 2,
  'test_v34_missions.mjs': 4,
  'test_v35_audio.mjs': 3,
  'test_v35_ui_smoke.mjs': 2,
  'test_v35_visual.mjs': 2,
  'test_v36_net.mjs': 1,
  'test_v37_dead_complete.mjs': 2,
  'test_v37_gameplay.mjs': 2,
  'test_v38_armory_sim.mjs': 2,
  'test_v38_audio_perf.mjs': 2,
  'test_v38_ui_polish.mjs': 1,
  'test_v39_i18n.mjs': 1,
  'test_v39_visual.mjs': 1
};

const META_FILES = new Set(['test_inventory.mjs']);
const USER_PATH_RE = /\/Users\/zhouyou\b/g;
const MAC_CHROME_RE = /\/Applications\/[^'"\n]*\.app\/Contents\/MacOS\//g;

function localPathHits(src) {
  return (src.match(USER_PATH_RE) || []).length + (src.match(MAC_CHROME_RE) || []).length;
}
function hasExitTeardown(src) {
  if (/process\.exit\s*\(/.test(src)) return true;
  return /from\s+['"]\.\/testkit\.mjs['"]/.test(src) && /closeBrowser\s*\(/.test(src);
}

let fail = 0;
const sleeps = [];
const seen = new Set();
let strictLegacyFiles = 0, strictLegacyHits = 0;

for (const f of FILES) {
  if (seen.has(f)) continue;
  seen.add(f);
  const abs = path.join(TOOLS, f);
  if (!existsSync(abs)) {
    console.log('FAIL · ' + f + ': 文件不存在（测试清单已过期）');
    fail = 1;
    continue;
  }
  const s = readFileSync(abs, 'utf8');

  // 原有检查 1：swiftshader 参数必须来自 pwargs
  if (s.indexOf('use-angle=swiftshader') >= 0 && s.indexOf("from './pwargs.mjs'") < 0) {
    console.log('FAIL · ' + f + ': 未使用 PW_ARGS');
    fail = 1;
  }
  // 原有检查 2：快速套件禁止 waitForTimeout
  if (f === 'test_fast.mjs' && /waitForTimeout\s*\(/.test(s)) {
    console.log('FAIL · ' + f + ': 快速套件禁止 waitForTimeout');
    fail = 1;
  }
  const n = (s.match(/waitForTimeout\s*\(/g) || []).length;
  if (n) sleeps.push(f + ':' + n);

  // 新增检查 1：本机绝对路径（严格范围；历史数量按基线放行）
  if (STRICT.has(f)) {
    const allowed = LOCAL_PATH_BASELINE[f] || 0;
    const hits = localPathHits(s);
    if (hits > allowed) {
      console.log('FAIL · ' + f + ': 硬编码本机路径 ' + hits + ' 处（基线 ' + allowed + '），请用 CHROME_EXE/findChrome 或相对 ROOT 的路径');
      fail = 1;
    } else if (hits > 0) {
      strictLegacyFiles++;
      strictLegacyHits += hits;
    }
  }

  // 新增检查 2：显式退出或 testkit 收尾（严格范围）
  if (STRICT.has(f) && !META_FILES.has(f) && !hasExitTeardown(s)) {
    console.log('FAIL · ' + f + ': 缺少 process.exit(...) 或 testkit closeBrowser 收尾');
    fail = 1;
  }
}

/* 全量遗留统计：只为报告，不判失败；test_inventory 是清单工具，不计入测试 */
const ALL_TESTS = readdirSync(TOOLS).filter((f) => TEST_RE.test(f) && !META_FILES.has(f)).sort();
let allPathFiles = 0, allPathHits = 0, noExitFiles = 0, sleepAllFiles = 0, sleepAllHits = 0;
for (const f of ALL_TESTS) {
  const s = readFileSync(path.join(TOOLS, f), 'utf8');
  const hits = localPathHits(s);
  if (hits) { allPathFiles++; allPathHits += hits; }
  if (!hasExitTeardown(s)) noExitFiles++;
  const n = (s.match(/waitForTimeout\s*\(/g) || []).length;
  if (n) { sleepAllFiles++; sleepAllHits += n; }
}

if (!fail) console.log('PASS · 权威测试静态检查（' + seen.size + ' 个文件；严格新增检查 ' + STRICT.size + ' 个）');
if (sleeps.length) console.log('INFO · 遗留 waitForTimeout：' + sleeps.join(', '));
console.log('INFO · 遗留本机路径：全量 ' + allPathFiles + ' 文件 / ' + allPathHits + ' 处；严格范围 ' + strictLegacyFiles + ' 文件 / ' + strictLegacyHits + ' 处（已登记基线，不允许新增）');
console.log('INFO · 遗留无 process.exit/testkit 收尾：' + noExitFiles + ' / ' + ALL_TESTS.length + ' 个测试文件（严格范围内 0）');
console.log('INFO · 遗留 waitForTimeout：' + sleepAllFiles + ' 文件 / ' + sleepAllHits + ' 处（仅 test_fast 禁止新增）');
process.exit(fail);
