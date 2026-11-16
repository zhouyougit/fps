
const fs=require('fs');
let s=fs.readFileSync('src/game/20_world.js','utf8');
s=s.replace('    Ya = -40,\n    EA = 41,\n    ol = -32,','    Ya = -40,\n    EA = 31,\n    ol = -32,');
s=s.replace('(Ya + (M + 0.5) * Ls > (i.__navQuayX != null ? i.__navQuayX : oi.quayX) - yf ||','(Ya + (M + 0.5) * Ls > oi.quayX - yf ||');
fs.writeFileSync('src/game/20_world.js',s);
console.log('reverted', (s.match(/EA = 31/g)||[]).length, (s.match(/__navQuayX/g)||[]).length);