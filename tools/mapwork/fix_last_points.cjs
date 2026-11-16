
const fs=require('fs');
function near(a,b){return Math.abs(a[0]-b[0])<0.05&&Math.abs(a[2]-b[2])<0.05;}
function repJSON(p,from,to){const a=JSON.parse(fs.readFileSync(p,'utf8'));let n=0;function walk(o){if(!o||typeof o!=='object')return;if(Array.isArray(o)){for(const it of o)walk(it);return;}if(o.pos&&near(o.pos,from)){o.pos=to.slice();n++;}for(const k in o)walk(o[k]);}walk(a);fs.writeFileSync(p,JSON.stringify(a,null,2)+'\n');return n;}
console.log('harbor',repJSON('packages/data/maps/harbor.authored.json',[27.7,0,-24.2],[28.74,0,-18.29]));
console.log('ship1',repJSON('packages/data/maps/ship.authored.json',[18.14,0.3,-8.44],[6,0.3,-4]));
console.log('ship2',repJSON('packages/data/maps/ship.authored.json',[18.35,0.3,-8.85],[6,0.3,3]));
console.log('ship3',repJSON('packages/data/maps/ship.authored.json',[18.29,0.3,-8.5],[4,0.3,-6]));
let g=fs.readFileSync('src/game/20_world.js','utf8');
const old='g(27.7, -24.2, "quay"),', nw='g(28.74, -18.29, "quay"),';
if(g.split(old).length-1!==1) throw new Error('harbor spawn pattern count '+(g.split(old).length-1));
g=g.replace(old,nw); fs.writeFileSync('src/game/20_world.js',g);
let s=fs.readFileSync('src/map_ship.js','utf8');
const pairs=[['[18.14, -8.44]','[6, -4]'],['[18.35, -8.85]','[6, 3]'],['[18.29, -8.5]','[4, -6]']];
for(const [a,b] of pairs){const n=s.split(a).length-1; if(n!==1) console.log('ship source pattern',a,'x',n); else s=s.replace(a,b);}
fs.writeFileSync('src/map_ship.js',s);
console.log('done');