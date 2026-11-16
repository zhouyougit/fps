#!/usr/bin/env node
/* Compare baseline and new map screenshots: draw stats + pixel detail metrics.
 * Usage: node tools/mapwork/compare.mjs --map ship [--base base] [--new r1]
 * Reads tools/mapwork/shots/<map>/stats*.json if present; falls back to file globbing.
 * Pixel metrics: mean luma, contrast (stddev), edge density (Sobel), colorfulness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const A = process.argv.slice(2);
const arg = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
const map = arg('map', 'ship');
const baseTag = arg('base', 'base');
const newTag = arg('new', 'r1');
const dir = path.resolve('tools/mapwork/shots/' + map);

function metrics(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = png;
  const luma = new Float32Array(w * h);
  let sum = 0, sum2 = 0, rs = 0, gs = 0, bs = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l; sum += l; sum2 += l * l;
    rs += r; gs += g; bs += b;
  }
  const n = w * h, mean = sum / n, sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  let edges = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const gx = -luma[i - w - 1] - 2 * luma[i - 1] - luma[i + w - 1] + luma[i - w + 1] + 2 * luma[i + 1] + luma[i + w + 1];
      const gy = -luma[i - w - 1] - 2 * luma[i - w] - luma[i - w + 1] + luma[i + w - 1] + 2 * luma[i + w] + luma[i + w + 1];
      if (Math.hypot(gx, gy) > 48) edges++;
    }
  }
  const colorfulness = Math.sqrt((rs / n - bs / n) ** 2 + (0.5 * (rs / n + gs / n) - bs / n) ** 2) / 255;
  return { file: path.basename(file), w, h, mean: +mean.toFixed(1), contrast: +sd.toFixed(1), edgeDensity: +(edges / (n / 4) * 100).toFixed(2), colorfulness: +colorfulness.toFixed(3) };
}

function viewsFromStats() {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^stats/.test(f) || !f.endsWith('.json')) continue;
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const v of s.views || []) out.push({ tag: v.file.includes('_') ? path.basename(v.file).split('_')[0] : 'base', name: v.name, file: v.file, calls: v.calls, triangles: v.triangles });
    } catch (e) {}
  }
  return out;
}

const statByFile = {};
for (const f of fs.readdirSync(dir)) {
  if (!/^stats/.test(f) || !f.endsWith('.json')) continue;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const v of s.views || []) statByFile[path.basename(v.file)] = v;
  } catch (e) {}
}
let rows = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.png')) continue;
  const tag = f.split('_')[0];
  const name = f.replace(/^[^_]+_/, '').replace(/\.png$/, '');
  const st = statByFile[f] || {};
  rows.push({ tag, name, file: path.join(dir, f), calls: st.calls, triangles: st.triangles });
}
const pick = (tag) => rows.filter((r) => r.tag === tag || (tag === 'base' && r.tag === 'base'));
const bases = pick(baseTag), news = pick(newTag);
if (!bases.length || !news.length) { console.error('missing screenshots: base=' + bases.length + ' new=' + news.length); process.exit(2); }
console.log('[compare] ' + map + '  ' + baseTag + ' vs ' + newTag);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('view', 14) + pad('calls', 16) + pad('tris', 22) + pad('luma', 14) + pad('contrast', 16) + 'edges');
for (const b of bases) {
  const n = news.find((x) => x.name === b.name);
  if (!n) continue;
  const mb = metrics(path.isAbsolute(b.file) ? b.file : path.join(dir, b.file));
  const mn = metrics(path.isAbsolute(n.file) ? n.file : path.join(dir, n.file));
  const callTxt = b.calls != null ? (b.calls + '→' + n.calls) : '-';
  const triTxt = b.triangles != null ? ((b.triangles / 1000).toFixed(0) + 'k→' + (n.triangles / 1000).toFixed(0) + 'k') : '-';
  console.log(pad(n.name, 14) + pad(callTxt, 16) + pad(triTxt, 22) + pad(mb.mean + '→' + mn.mean, 14) + pad(mb.contrast + '→' + mn.contrast, 16) + mb.edgeDensity + '→' + mn.edgeDensity);
}