
const fs=require('fs');
let s=fs.readFileSync('src/map_harbor_ext.js','utf8');
const a=s.indexOf('      /* ── R6');
const b=s.indexOf('      /* ── R7');
const c=s.indexOf('      /* ── R11');
const keep=s.indexOf('      lt(26.2, 4.6, -28.2');
if(a<0||b<0||c<0||keep<0||!(a<b&&b<c&&c<keep)) throw new Error('markers '+[a,b,c,keep]);
const removed=s.slice(a,keep);
s=s.slice(0,a)+s.slice(keep);
fs.writeFileSync('src/map_harbor_ext.js',s);
console.log('removed chars',removed.length,'remaining',s.length);
console.log('remaining markers', (s.match(/R1[0-9]|R[0-9]/g)||[]).slice(-8));
