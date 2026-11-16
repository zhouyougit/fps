#!/usr/bin/env node
/* Report per-map optimization round counts from MAP_REVIEW/<id>/ROUNDS.md. */
import fs from 'node:fs';
const ids = ['harbor', 'depot', 'ship', 'core'];
let bad = 0;
console.log('map      rounds  last title');
for (const id of ids) {
  const f = 'MAP_REVIEW/' + id + '/ROUNDS.md';
  let text = '';
  try { text = fs.readFileSync(f, 'utf8'); } catch (e) { console.log(id.padEnd(9) + '0       missing ' + f); bad++; continue; }
  const heads = [...text.matchAll(/^### (Round \d+)[^\n]*\n?([^\n]*)/gm)];
  const n = heads.length;
  const last = n ? (heads[n - 1][1] + ' ' + (heads[n - 1][2] || '')).slice(0, 70) : '-';
  console.log(id.padEnd(9) + String(n).padEnd(8) + last);
  if (n < 10) bad++;
}
console.log(bad ? '[rounds] ' + bad + ' map(s) still need rounds (target 10).' : '[rounds] all maps reached 10 rounds.');
process.exit(bad ? 1 : 0);
