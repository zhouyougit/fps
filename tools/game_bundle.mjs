#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/game_bundle.mjs — 按 manifest 还原完整 game 包
   用途：搜索/阅读/语法检查；构建本身直接读片段，不依赖这个中间文件。
   用法：node tools/game_bundle.mjs [--out build/game.bundle.js] [--check]
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/game/manifest.json'), 'utf8'));
const out = path.resolve(ROOT, arg('out', 'build/game.bundle.js'));

let text = '';
let expect = 1;
for (const part of manifest.parts) {
  if (part.lines[0] !== expect) throw new Error('manifest gap at ' + part.file + ': expected line ' + expect);
  text += fs.readFileSync(path.join(ROOT, part.file), 'utf8');
  if (!text.endsWith('\n')) text += '\n';
  expect = part.lines[1] + 1;
}
if (expect !== manifest.lineCount + 1) throw new Error('manifest does not cover all lines: ' + expect + ' vs ' + (manifest.lineCount + 1));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
console.log('bundled ' + manifest.parts.length + ' parts -> ' + path.relative(ROOT, out) + '  ' + (Buffer.byteLength(text) / 1024).toFixed(1) + ' KB');
if (argv.includes('--check')) {
  execFileSync(process.execPath, ['--check', out], { stdio: 'inherit' });
  console.log('syntax OK');
}
