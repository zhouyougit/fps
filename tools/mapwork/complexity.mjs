#!/usr/bin/env node
/* Complexity report: live boxes vs authored area, density and targets. */
import fs from 'node:fs';
const TARGETS = {
  harbor: { boxes: 750, area: 4800 },
  depot:  { boxes: 650, area: 4500 },
  ship:   { boxes: 500, area: 2950 },
  core:   { boxes: 650, area: 4200 }
};
const rows = [];
for (const id of Object.keys(TARGETS)) {
  let boxes = 0, errors = [];
  try {
    const live = JSON.parse(fs.readFileSync('tools/mapwork/' + id + '/live.json', 'utf8'));
    boxes = (live.boxes || []).length; errors = live.pageErrors || [];
  } catch (e) {}
  let area = 0;
  try {
    const a = JSON.parse(fs.readFileSync('packages/data/maps/' + id + '.authored.json', 'utf8'));
    area = (a.bounds.max[0] - a.bounds.min[0]) * (a.bounds.max[2] - a.bounds.min[2]);
  } catch (e) {}
  const t = TARGETS[id];
  rows.push({ id, boxes, area, density: area ? boxes / area : 0, t, pct: t.boxes ? boxes / t.boxes : 0, errors: errors.length });
}
console.log('map      boxes  target  %      area     target   density  err');
for (const r of rows) console.log(
  r.id.padEnd(9) + String(r.boxes).padEnd(7) + String(r.t.boxes).padEnd(8) +
  (r.pct * 100).toFixed(0).padStart(3) + '%   ' + String(Math.round(r.area)).padEnd(9) +
  String(r.t.area).padEnd(9) + r.density.toFixed(3).padEnd(9) + r.errors
);
const missing = rows.filter((r) => r.boxes < r.t.boxes || r.area < r.t.area);
console.log(missing.length ? '[complexity] ' + missing.map((r) => r.id).join(',') + ' below target' : '[complexity] all targets met');