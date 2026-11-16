
const fs=require('fs');
let s=fs.readFileSync('src/game/20_world.js','utf8');
const a='    Ya = -40,\n    EA = 31,\n    ol = -32,';
if(s.indexOf(a)<0) throw new Error('nav constants not found');
s=s.replace(a,'    Ya = -40,\n    EA = 41,\n    ol = -32,');
const q='(Ya + (M + 0.5) * Ls > oi.quayX - yf ||';
if(s.indexOf(q)<0) throw new Error('quay condition not found');
s=s.replace(q,'(Ya + (M + 0.5) * Ls > (i.__navQuayX != null ? i.__navQuayX : oi.quayX) - yf ||');
fs.writeFileSync('src/game/20_world.js',s);
console.log('patched EA41', (s.match(/EA = 41/g)||[]).length, 'navQuay', (s.match(/__navQuayX/g)||[]).length);