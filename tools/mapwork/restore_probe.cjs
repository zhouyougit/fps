
const fs=require('fs');
const html=fs.readFileSync('game.html','utf8');
const s=html.indexOf('<script>');
const e=html.indexOf('</script>', s);
console.log('script tag', s, e, 'len', e-s);
const js=html.slice(s+8,e);
console.log('first 400:', JSON.stringify(js.slice(0,400)));
const we=fs.readFileSync('src/weapon_ext.js','utf8');
console.log('weapon len', we.length, 'found at', js.indexOf(we));
console.log('marker count', (js.match(/\/\*__WEAPON_EXT__\*\//g)||[]).length);
console.log('oi.quayX count', (js.match(/oi\.quayX/g)||[]).length);
console.log('EA = 31 count', (js.match(/EA = 31/g)||[]).length);
console.log('tail:', JSON.stringify(js.slice(-120)));
