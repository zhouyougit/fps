#!/usr/bin/env node
/* Integration driver for the V40 map-detail release.
 * Correct order: build -> export collisions -> regenerate map data -> REBUILD
 * (so game.html embeds the new src/data_maps.js) -> tests -> release artifact.
 * Usage: node tools/mapwork/integrate.mjs [--skip-tests] [--skip-server] [--release]
 */
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const skipTests = args.includes('--skip-tests');
const skipServer = args.includes('--skip-server');
const release = args.includes('--release');
const env = { ...process.env, CHROME_EXE: process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', SX_GPU: process.env.SX_GPU || 'metal', SX_TARGET: 'game.html' };

const steps = [
  ['build v40 (pre-export)', 'node', ['tools/build.cjs', 'game.html', 'v40'], {}],
  ['export server/maps.json', 'node', ['server/export_maps.mjs'], {}],
  ['export map data + client', 'node', ['tools/export_maps_data.mjs'], {}],
  ['rebuild v40 (embed new data_maps)', 'node', ['tools/build.cjs', 'game.html', 'v40'], {}]
];
if (!skipTests) {
  steps.push(['test map data', 'node', ['tools/test_mapdata.mjs'], {}]);
  steps.push(['test v39 visual', 'node', ['tools/test_v39_visual.mjs'], { SX_TARGET: 'game.html' }]);
  // test_v39_perf 是 V39 专用的“批处理前后 draw call 下降 + 指纹不变”回归，
  // V40 地图故意改了碰撞/点位，不适用；改用 mapwork 的 calls 预算检查。
}
if (!skipServer) steps.push(['server tests', 'node', ['tools/run_server_tests.mjs'], {}]);
if (release) steps.push(['build release artifact', 'node', ['tools/build.cjs', 'versions/几猫_V40.html', 'v40'], {}]);

const starts = Date.now();
for (const [name, cmd, argv, extraEnv] of steps) {
  console.log('\n=== ' + name + ' ===');
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd: ROOT, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status !== 0) {
    console.error('[integrate] FAILED: ' + name + ' (exit ' + r.status + ', ' + sec + 's)');
    process.exit(r.status || 1);
  }
  console.log('[integrate] ok: ' + name + ' (' + sec + 's)');
}
console.log('[integrate] all steps passed in ' + ((Date.now() - starts) / 1000).toFixed(1) + 's');