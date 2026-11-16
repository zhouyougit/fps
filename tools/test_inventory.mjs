#!/usr/bin/env node
/* 测试清单：扫描 tools/test_*.mjs，读取 run_tests.mjs / test_suite.mjs 的引用，输出被引用与孤儿。
   用法：node tools/test_inventory.mjs [--json]
   只读取源码，不启动浏览器；统计口径：
   - 测试脚本 = tools/test_*.mjs 去掉本清单工具自身；
   - 被引用 = 在 run_tests.mjs（fast/full/domain）或 test_suite.mjs 中被字符串引用。 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = path.join(ROOT, 'tools');
const SELF = 'test_inventory.mjs';
const RUNNER = path.join(TOOLS, 'run_tests.mjs');
const SUITE = path.join(TOOLS, 'test_suite.mjs');
const JSON_OUT = process.argv.slice(2).includes('--json');
const TEST_RE = /^test_.*\.mjs$/;
const REF_RE = /['"]([^'"]*\.mjs)['"]/g;
const DOMAIN_RE = /^\s*(ui|gameplay|map|net|visual|audio|save|perf)\s*:\s*\[/;

function listTestFiles() {
  return readdirSync(TOOLS).filter((f) => TEST_RE.test(f)).sort();
}

function addRef(refs, name, mode) {
  if (!refs.has(name)) refs.set(name, new Set());
  refs.get(name).add(mode || 'referenced');
}

function refsFromRunner() {
  const refs = new Map();
  if (!existsSync(RUNNER)) return { refs, source: null };
  const src = readFileSync(RUNNER, 'utf8');
  let mode = 'referenced';
  for (const line of src.split(/\r?\n/)) {
    if (/\bconst\s+FAST\b/.test(line)) mode = 'fast';
    else if (/\bconst\s+SUITE\b/.test(line)) mode = 'full';
    else if (/\bconst\s+E2E\b/.test(line)) mode = 'full';
    else if (/\bconst\s+(LINT|UNIT|CHECK|SERVER)\b/.test(line)) mode = 'infra';
    else {
      const dm = line.match(DOMAIN_RE);
      if (dm) mode = 'domain:' + dm[1];
    }
    for (const m of line.matchAll(REF_RE)) {
      const name = path.basename(m[1]);
      if (TEST_RE.test(name)) addRef(refs, name, mode === 'infra' ? 'runner' : mode);
    }
  }
  return { refs, source: 'run_tests.mjs' };
}

function refsFromSuite() {
  const refs = new Map();
  if (!existsSync(SUITE)) return refs;
  const src = readFileSync(SUITE, 'utf8');
  for (const m of src.matchAll(REF_RE)) {
    const name = path.basename(m[1]);
    if (TEST_RE.test(name)) addRef(refs, name, 'suite');
  }
  return refs;
}

function build() {
  const all = listTestFiles();
  const meta = all.filter((f) => f === SELF);
  const tests = all.filter((f) => f !== SELF);

  const refs = refsFromRunner().refs;
  for (const [name, modes] of refsFromSuite()) {
    for (const mode of modes) addRef(refs, name, mode);
  }

  const files = tests.map((file) => {
    const modes = refs.has(file) ? [...refs.get(file)].sort() : [];
    return { file, status: modes.length ? 'referenced' : 'orphan', modes };
  });
  for (const file of meta) files.push({ file, status: 'meta', modes: [] });

  const referencedFiles = files.filter((f) => f.status === 'referenced');
  const orphanFiles = files.filter((f) => f.status === 'orphan');
  const missingReferences = [...refs.keys()].filter((f) => !all.includes(f)).sort();

  return {
    generatedBy: 'tools/test_inventory.mjs',
    toolsDir: 'tools',
    scanned: all.length,
    total: tests.length,
    referenced: referencedFiles.length,
    orphans: orphanFiles.length,
    meta: meta.length,
    files,
    missingReferences
  };
}

const inv = build();

if (JSON_OUT) {
  console.log(JSON.stringify(inv, null, 2));
} else {
  console.log('测试清单（tools/test_*.mjs）');
  console.log('  扫描 ' + inv.scanned + ' 个 · 测试脚本 ' + inv.total + ' · 被引用 ' + inv.referenced +
    ' · 孤儿 ' + inv.orphans + (inv.meta ? ' · 工具自身 ' + inv.meta : ''));
  if (inv.missingReferences.length) console.log('  ⚠ 引用但缺失：' + inv.missingReferences.join(', '));
  console.log('\n被引用（' + inv.referenced + '）：');
  for (const f of inv.files.filter((x) => x.status === 'referenced')) {
    console.log('  ' + f.file + ' [' + f.modes.join(', ') + ']');
  }
  console.log('\n孤儿（' + inv.orphans + '）：');
  for (const f of inv.files.filter((x) => x.status === 'orphan')) console.log('  ' + f.file);
  if (inv.meta) console.log('\n工具自身（不计入测试）：' + inv.files.filter((x) => x.status === 'meta').map((x) => x.file).join(', '));
  console.log('\n口径：被引用 = run_tests.mjs（fast/full/domain）或 test_suite.mjs 中的字符串引用；--json 输出机器可读清单。');
}
