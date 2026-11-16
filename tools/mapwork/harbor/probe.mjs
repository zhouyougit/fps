#!/usr/bin/env node
/* Harbor occupancy probe: dumps an ASCII occupancy grid + prop list from the live preview. */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const A = process.argv.slice(2);
const arg = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const ROOT = process.cwd();
const target = path.resolve(ROOT, arg('target', 'tools/mapwork/harbor/preview.html'));
const CELL = Number(arg('cell', '4'));
const exe = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(pathToFileURL(target).href + '?q=low&noaudio=1&autostart=1&dt=0.1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__ready === true || !!window.__fatal, null, { timeout: 300000 });
await page.evaluate(() => { window.__SX.applyMission(0); window.__G.game.start({ skipIntro: true }); window.__G.game.pause(); });
const data = await page.evaluate(() => {
  const G = window.__G;
  const boxes = G.physics.boxes.map((b) => ({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], s: b.surface }));
  const props = [];
  G.level.root.traverse((o) => {
    if (o.userData && o.userData.prop) { const p = o.getWorldPosition(new G.THREE.Vector3()); props.push({ n: o.userData.prop, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), c: o.userData.colliders ? o.userData.colliders.length : 0 }); }
  });
  return { boxes, props };
});
await browser.close();
const { boxes, props } = data;
const area = (arg('area', '-40,40,-30,30')).split(',').map(Number);
const [X0, X1, Z0, Z1] = area;
const nx = Math.round((X1 - X0) / CELL), nz = Math.round((Z1 - Z0) / CELL);
const grid = Array.from({ length: nz }, () => Array.from({ length: nx }, () => ({ hi: 0, lo: 0 })));
for (const b of boxes) {
  if (b.min[1] < -30) continue;
  const h = b.max[1] - Math.max(0, b.min[1]);
  const i0 = Math.max(0, Math.floor((b.min[0] - X0) / CELL)), i1 = Math.min(nx - 1, Math.floor((b.max[0] - X0) / CELL));
  const j0 = Math.max(0, Math.floor((b.min[2] - Z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((b.max[2] - Z0) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (h >= 1.2) grid[j][i].hi++; else if (h > 0.12) grid[j][i].lo++; }
}
let out = '    ' + Array.from({ length: nx }, (_, i) => String(X0 + i * CELL).padStart(3)).join('') + '  (x, cell=' + CELL + 'm)\n';
for (let j = 0; j < nz; j++) {
  let row = String(Z0 + j * CELL).padStart(3) + ' ';
  for (let i = 0; i < nx; i++) {
    const g = grid[j][i];
    row += g.hi >= 3 ? '#' : g.hi ? (g.hi === 2 ? 'H' : 'h') : g.lo >= 2 ? 'L' : g.lo ? '.' : ' ';
  }
  out += row + '\n';
}
if (A.includes('--list')) {
  for (const b of boxes) {
    if (b.min[0] < X0 || b.max[0] > X1 || b.min[2] < Z0 || b.max[2] > Z1) continue;
    console.log('BOX [' + b.min.map((n) => n.toFixed(1)).join(',') + '] ~ [' + b.max.map((n) => n.toFixed(1)).join(',') + '] ' + b.s);
  }
}
console.log(out);
console.log('legend: # = 3+ tall boxes in cell, H = 2 tall, h = 1 tall, L = low pile, . = low, blank = empty');
const byName = {};
for (const p of props) { (byName[p.n] = byName[p.n] || []).push([p.x, p.y, p.z]); }
for (const k of Object.keys(byName).sort()) console.log(k + '(' + byName[k].length + '): ' + byName[k].map((p) => p.join(',')).join(' | '));
console.log('boxes=' + boxes.length + ' props=' + props.length + ' errs=' + JSON.stringify(errs.slice(0, 4)));