#!/usr/bin/env node
/* 权威测试静态检查：统一 GPU 参数、快速套件禁止裸 sleep */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'test_suite.mjs', 'test_current.mjs', 'check_versions.mjs', 'test_fast.mjs',
  'test_v32_ground.mjs', 'test_save_migration.mjs', 'test_mapdata.mjs',
  'test_v33_weapons.mjs', 'test_v33_movement.mjs', 'test_v33_feedback.mjs', 'test_v33_input_audio.mjs',
  'test_v34_ai.mjs', 'test_v34_boss.mjs', 'test_v34_missions.mjs', 'test_v34_progress.mjs',
  'test_v35_visual.mjs', 'test_v35_audio.mjs', 'test_v35_ui.mjs', 'test_v35_ui_smoke.mjs',
  'test_v36_net.mjs', 'test_v36_smoke.mjs', 'test_v37_dead_complete.mjs', 'test_v37_gameplay.mjs',
  'test_v38_audio_perf.mjs', 'test_v38_mp_perf.mjs', 'test_v38_ui_polish.mjs', 'test_v38_armory_sim.mjs',
  'test_v39_i18n.mjs', 'test_v39_mp_e2e2.mjs', 'test_v39_perf.mjs', 'test_v39_visual.mjs'
];
let fail = 0, sleeps = [];
for (const f of FILES) {
  const s = readFileSync(path.join(ROOT, 'tools', f), 'utf8');
  if (s.indexOf('use-angle=swiftshader') >= 0 && s.indexOf("from './pwargs.mjs'") < 0) { console.log('FAIL · ' + f + ': 未使用 PW_ARGS'); fail = 1; }
  if (f === 'test_fast.mjs' && /waitForTimeout\s*\(/.test(s)) { console.log('FAIL · ' + f + ': 快速套件禁止 waitForTimeout'); fail = 1; }
  const n = (s.match(/waitForTimeout\s*\(/g) || []).length;
  if (n) sleeps.push(f + ':' + n);
}
if (!fail) console.log('PASS · 权威测试静态检查（' + FILES.length + ' 个文件）');
console.log('INFO · 遗留 waitForTimeout：' + sleeps.join(', '));
process.exit(fail);
