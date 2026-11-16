#!/usr/bin/env node
/* =====================================================================
   SALTLINE · tools/clean_workspace.mjs — V54 ENG-8 工作区清理
   ---------------------------------------------------------------------
   清理的是 .gitignore 已经排除、可重新生成的构建/测试证据：
     · .npmcache、build/、tools/.cache、bench/*.html、bench/*.err
     · tools/mapwork/shots、tools/mapwork/<map>/preview.html
     · 根目录 game_v33..v39.html（正式留档在 versions/）
     · tools 根目录探针截图（保留 brand_*、base_title.png 设计参考）
   保留：versions/（版本留档）、versions/screens/（README 引用）、源码/测试。
   默认 dry-run；只有 --apply 才删除。
   用法：node tools/clean_workspace.mjs [--apply]
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

function sizeOf(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isDirectory()) return st.size;
    let n = 0;
    for (const name of fs.readdirSync(p)) n += sizeOf(path.join(p, name));
    return n;
  } catch (e) { return 0; }
}
function mb(n) { return (n / 1024 / 1024).toFixed(1); }
function insideRoot(p) {
  const r = path.resolve(p);
  return r === ROOT || r.startsWith(ROOT + path.sep);
}

const targets = [];
function add(rel, reason) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return;
  targets.push({ p, rel, reason, bytes: sizeOf(p) });
}
add('.npmcache', 'npm 缓存');
add('build', '构建中间物');
add('tools/.cache', '测试缓存');
add('tools/mapwork/shots', '地图评审截图');
for (const name of fs.readdirSync(path.join(ROOT, 'tools/mapwork'))) {
  if (name === 'shots') continue;
  const p = path.join(ROOT, 'tools/mapwork', name, 'preview.html');
  if (fs.existsSync(p)) targets.push({ p, rel: path.relative(ROOT, p), reason: '地图评审预览构建', bytes: sizeOf(p) });
}
for (const name of fs.readdirSync(ROOT)) {
  if (/^game_v3[3-9]\.html$/.test(name)) add(name, '根目录旧构建副本');
}
for (const name of fs.readdirSync(path.join(ROOT, 'tools'))) {
  if (!/\.png$/i.test(name)) continue;
  if (/^(brand_|base_title)/.test(name)) continue;
  add(path.join('tools', name), '探针截图');
}
for (const name of fs.readdirSync(path.join(ROOT, 'bench'))) {
  if (/\.(html|err)$/i.test(name)) add(path.join('bench', name), '基准临时输出');
}

targets.sort((a, b) => b.bytes - a.bytes);
let total = 0;
for (const t of targets) {
  total += t.bytes;
  console.log((APPLY ? 'DEL ' : 'DRY ') + mb(t.bytes).padStart(8) + ' MB  ' + t.rel + '  (' + t.reason + ')');
}
console.log('---');
console.log((APPLY ? '已删除 ' : '可释放 ') + mb(total) + ' MB / ' + targets.length + ' 个路径；versions/ 与 versions/screens/ 未触碰。');
if (!APPLY) console.log('确认后执行：node tools/clean_workspace.mjs --apply');
if (APPLY) {
  for (const t of targets) {
    if (!insideRoot(t.p)) throw new Error('拒绝删除仓库外路径: ' + t.p);
    fs.rmSync(t.p, { recursive: true, force: true });
    console.log('removed ' + t.rel);
  }
}
