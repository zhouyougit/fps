#!/usr/bin/env node
/* 顺序跑服务器回归；锁文件冲突时先清理本测试专用 profiles */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
for (const f of ['test_round.cjs', 'test_net2.cjs']) {
  const r = spawnSync(process.execPath, [f], { cwd: path.join(ROOT, 'server'), env, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
process.exit(0);
