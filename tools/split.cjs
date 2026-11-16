
const fs = require('fs');
const path = require('path');
const root = __dirname + '/..';
const html = fs.readFileSync(path.join(root,'baseline','几猫_V1.html'),'utf8');
const a = html.indexOf('<script>');
const b = html.lastIndexOf('</script>');
const head = html.slice(0, a+8);
const js = html.slice(a+8, b);
const tail = html.slice(b);
fs.mkdirSync(path.join(root,'src'),{recursive:true});
fs.writeFileSync(path.join(root,'src','template.head.html'), head);
fs.writeFileSync(path.join(root,'src','template.tail.html'), tail);
fs.writeFileSync(path.join(root,'src','game.js'), fs.readFileSync(path.join(root,'proto.pretty.js'),'utf8'));
console.log('head bytes', head.length, 'tail bytes', tail.length, 'js bytes', js.length);
console.log('tail start', JSON.stringify(tail.slice(0,50)));
