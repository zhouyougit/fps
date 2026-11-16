
import fs from 'node:fs';
function strip(s) {
  let o = '', i = 0, n = s.length, mode = 0, q = '';
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (mode === 0) {
      if (c === '/' && d === '*') { mode = 1; i += 2; continue; }
      if (c === '/' && d === '/') { mode = 2; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') {
        q = c; o += c; i++;
        while (i < n) {
          o += s[i];
          if (s[i] === '\\') { o += s[i + 1] || ''; i += 2; continue; }
          if (s[i] === q) { i++; break; }
          i++;
        }
        continue;
      }
      o += c; i++; continue;
    }
    if (mode === 1) { if (c === '*' && d === '/') { mode = 0; i += 2; } else i++; continue; }
    if (mode === 2) { if (c === '\n') { mode = 0; o += '\n'; i++; continue; } i++; continue; }
  }
  return o;
}
let t = 0, u = 0;
for (const f of ['src/map_depot.js','src/map_ship.js','src/map_core.js','src/map_harbor_ext.js']) {
  const s = fs.readFileSync(f, 'utf8'); const z = strip(s);
  t += s.length; u += z.length;
  fs.writeFileSync('/tmp/' + f.split('/').pop(), z);
  console.log(f, s.length, '->', z.length, 'save', s.length - z.length);
}
console.log('total save', t - u);
