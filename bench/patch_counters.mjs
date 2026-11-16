import fs from 'node:fs';

function patch(src, dst, reps) {
  let h = fs.readFileSync(src, 'utf8');
  for (let i = 0; i < reps.length; i++) {
    const a = reps[i][0], b = reps[i][1];
    if (h.indexOf(a) < 0) throw new Error('missing in ' + src + ': ' + a.slice(0, 70));
    h = h.replace(a, b);
  }
  fs.writeFileSync(dst, h);
  console.log('wrote', dst, fs.statSync(dst).size);
}

patch('bench/v34_before.html', 'bench/v34_before_cnt.html', [
  ['    if (!ai.hasCover && state.covers.length) {',
   '    window.__CNT=window.__CNT||{coverScan:0,hasCoverCalls:0,hotBuild:0};\n    if (!ai.hasCover && state.covers.length) {\n      window.__CNT.hasCoverCalls++;'],
  ['        if (c.protectedNow && c.walkable && distXZ(e.pos, c.pos) < 24) { ai.hasCover = true; break; }',
   '        window.__CNT.coverScan++; if (c.protectedNow && c.walkable && distXZ(e.pos, c.pos) < 24) { ai.hasCover = true; break; }']
]);

patch('bench/v34_after.html', 'bench/v34_after_cnt.html', [
  ['  function updateCoverHot() {',
   '  function updateCoverHot() {\n    window.__CNT=window.__CNT||{coverScan:0,hasCoverCalls:0,hotBuild:0};'],
  ['      hot.push(c);',
   '      window.__CNT.hotBuild++; hot.push(c);'],
  ['    if (ai.hasCoverT <= 0) {',
   '    window.__CNT=window.__CNT||{coverScan:0,hasCoverCalls:0,hotBuild:0};\n    if (ai.hasCoverT <= 0) {\n      window.__CNT.hasCoverCalls++;'],
  ['        if (distXZ(e.pos, hot[i].pos) < 24) { ai.hasCover = true; break; }',
   '        window.__CNT.coverScan++; if (distXZ(e.pos, hot[i].pos) < 24) { ai.hasCover = true; break; }']
]);
