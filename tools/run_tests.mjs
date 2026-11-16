#!/usr/bin/env node
/* 测试编排：fast / full / domain；顺序执行、独立日志、超时、耗时表 */
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GPU_MODE } from './pwargs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, 'tools', 'logs');
mkdirSync(LOG_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const args = process.argv.slice(2);
const mode = args.find(a => !a.startsWith('-')) || 'fast';
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7);

const LINT = { name: 'lint', cmd: process.execPath, argv: ['tools/lint_tests.mjs'], timeout: 30000 };
const UNIT = { name: 'unit', cmd: process.execPath, argv: ['--test', 'tests/unit/*.test.mjs'], timeout: 120000 };
const FAST = { name: 'fast', cmd: process.execPath, argv: ['tools/test_fast.mjs'], timeout: 180000 };
const SUITE = { name: 'suite85', cmd: process.execPath, argv: ['tools/test_suite.mjs'], timeout: 2400000 };
const CHECK = { name: 'versions', cmd: process.execPath, argv: ['tools/check_versions.mjs', '--all'], timeout: 900000 };
const E2E = { name: 'mp-e2e', cmd: process.execPath, argv: ['tools/test_v39_mp_e2e2.mjs'], timeout: 600000 };
const SERVER = { name: 'server', cmd: process.execPath, argv: ['tools/run_server_tests.mjs'], timeout: 600000 };

const DOMAINS = {
  ui: ['test_v35_ui_smoke.mjs', 'test_v38_ui_polish.mjs', 'test_v39_i18n.mjs', 'test_v50_quality_auto.mjs'],
  gameplay: ['test_v37_dead_complete.mjs', 'test_v37_gameplay.mjs', 'test_v34_missions.mjs', 'test_v44_drone.mjs', 'test_v51_enemy_shadow.mjs'],
  map: ['test_mapdata.mjs', 'test_v32_ground.mjs', 'test_v46_map_release.mjs'],
  net: ['test_v39_mp_e2e2.mjs', 'test_v36_net.mjs'],
  visual: ['test_v35_visual.mjs', 'test_v39_visual.mjs', 'test_v43_avatar.mjs'],
  audio: ['test_v38_audio_perf.mjs', 'test_v35_audio.mjs'],
  save: ['test_save_migration.mjs', 'test_v38_armory_sim.mjs'],
  perf: ['test_v41_perf.mjs', 'test_v38_mp_perf.mjs', 'test_v39_perf.mjs']
};

let plan = [];
if (only) {
  plan = [{ name: path.basename(only), cmd: process.execPath, argv: [only], timeout: 600000 }];
} else if (mode === 'fast') {
  plan = [LINT, UNIT, FAST];
} else if (mode === 'full') {
  plan = [LINT, UNIT, SUITE, CHECK, E2E, SERVER];
} else if (DOMAINS[mode]) {
  plan = [UNIT, ...DOMAINS[mode].map(f => ({ name: f.replace(/\.mjs$/, ''), cmd: process.execPath, argv: ['tools/' + f], timeout: 600000 }))];
} else {
  console.error('用法: node tools/run_tests.mjs [fast|full|ui|gameplay|map|net|visual|audio|save|perf|--only=tools/xxx.mjs]');
  process.exit(2);
}

function runOne(item) {
  return new Promise((resolve) => {
    const logPath = path.join(LOG_DIR, stamp + '-' + item.name + '.log');
    const out = createWriteStream(logPath);
    const t0 = Date.now();
    let killed = false;
    const child = spawn(item.cmd, item.argv, { cwd: ROOT, env: { ...process.env, CHROME_EXE: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(out); child.stderr.pipe(out);
    const timer = setTimeout(() => { killed = true; try { child.kill('SIGKILL'); } catch (e) {} }, item.timeout);
    child.on('error', (e) => { out.write('\n[runner] spawn error: ' + e.message + '\n'); });
    child.on('close', (code) => {
      clearTimeout(timer); out.end();
      const ms = Date.now() - t0;
      let text = '';
      try { text = readFileSync(logPath, 'utf8'); } catch (e) {}
      const tail = text.split('\n').filter(Boolean).slice(-3).join(' | ');
      const green = /全部通过|ALL PASS|PASS \d+ · FAIL 0|PASS \d+ PASS \/ 0 FAIL|0 FAIL|pass \d+[\s\S]*fail 0/.test(text);
      const okRes = !killed && (code === 0 || green);
      console.log((okRes ? 'PASS' : 'FAIL') + ' · ' + item.name + ' · ' + (ms / 1000).toFixed(1) + 's' + (killed ? ' (超时)' : '') + ' · ' + tail.slice(0, 180));
      if (!okRes) console.log('  log: ' + logPath);
      resolve({ name: item.name, ms, ok: okRes, log: logPath });
    });
  });
}

console.log('[runner] GPU=' + GPU_MODE + ' plan=' + plan.map(p => p.name).join(','));
const results = [];
for (const item of plan) results.push(await runOne(item));
const total = results.reduce((a, b) => a + b.ms, 0);
console.log('\n== 汇总 ==');
for (const r of results) console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + (r.ms / 1000).toFixed(1).padStart(7) + 's  ' + r.name);
console.log('total ' + (total / 1000).toFixed(1) + 's  logs=' + LOG_DIR);
process.exit(results.every(r => r.ok) ? 0 : 1);
