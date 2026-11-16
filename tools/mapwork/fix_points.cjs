
const fs=require('fs');
const ROOT='.';
function readJSON(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function writeJSON(p,o){fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');}
const near=(a,b)=>Math.abs(a[0]-b[0])<0.05&&Math.abs(a[2]-b[2])<0.05;
function replacePos(list,from,to){let n=0;for(const it of list){if(it.pos&&near(it.pos,from)){it.pos=to.slice();n++;}}return n;}
let log=[];
// depot
{
 const p='packages/data/maps/depot.authored.json'; const a=readJSON(p);
 const map=[[ [0,0,-23.8],[0,0,-21.3] ],[ [27.8,0,27.8],[21.08,0,21.08] ],[ [-27.5,0,24.6],[-25.82,0,18.32] ],[ [-36,0,-24.4],[-34.32,0,-18.12] ],[ [28.5,0,-23.8],[29.41,0,-20.42] ]];
 for(const [f,t] of map){ let n=replacePos(a.spawns.enemy,f,t)+replacePos(a.pickups,f,t); log.push('depot '+JSON.stringify(f)+' -> '+JSON.stringify(t)+' x'+n); }
 writeJSON(p,a);
}
// ship
{
 const p='packages/data/maps/ship.authored.json'; const a=readJSON(p);
 const map=[[ [-30,0.3,-5.5],[-24.2,0.3,-7.05] ],[ [22,0.3,-7.4],[18.14,0.3,-8.44] ],[ [-33,0.3,3.4],[-24,0.3,-7.32] ],[ [-30.4,0.3,8.6],[-21.65,0.3,-6.56] ],[ [28.6,0.3,8.9],[18.35,0.3,-8.85] ],[ [12,0.3,21],[12,0.3,8] ],[ [16.8,0.3,21],[13.31,0.3,7.96] ],[ [19.2,0.32,-7.2],[17.9,0.32,-7.95] ],[ [-26.5,0.3,-6.3],[-24.33,0.3,-7.55] ],[ [26.5,0.3,-6.3],[18.29,0.3,-8.5] ],[ [-26,0.3,2],[-23.67,0.3,-6.69] ],[ [26,0.3,2],[17.16,0.3,-6.84] ],[ [-22,0.3,13.8],[-5.56,0.3,7.81] ],[ [22,0.3,13.8],[14.93,0.3,6.73] ],[ [-13.5,0.3,10.2],[-7.87,0.3,6.95] ],[ [13.5,0.3,10.2],[13.5,0.3,8.2] ],[ [12,0.3,17.2],[12,0.3,8.2] ],[ [16,0.3,18.5],[13.15,0.3,7.87] ]];
 for(const [f,t] of map){ let n=replacePos(a.spawns.enemy,f,t)+replacePos(a.pickups,f,t)+replacePos(a.relays,f,t); log.push('ship '+JSON.stringify(f)+' -> '+JSON.stringify(t)+' x'+n); }
 writeJSON(p,a);
}
// core
{
 const p='packages/data/maps/core.authored.json'; const a=readJSON(p);
 const map=[[ [-35.2,0.4,16.5],[-26.99,0.4,14.3] ],[ [-35.2,0.4,-14.5],[-26.99,0.4,-16.7] ]];
 for(const [f,t] of map){ let n=replacePos(a.spawns.enemy,f,t)+replacePos(a.pickups,f,t); log.push('core '+JSON.stringify(f)+' -> '+JSON.stringify(t)+' x'+n); }
 writeJSON(p,a);
}
// JS sources: enemy arrays + ship relay
function patchJS(file, pairs){
 let s=fs.readFileSync(file,'utf8');
 for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(file+' pattern count '+n+' for '+a); s=s.replace(a,b); }
 fs.writeFileSync(file,s); log.push('patched '+file+' x'+pairs.length);
}
patchJS('src/map_depot.js',[['[0, -23.8]','[0, -21.3]']]);
patchJS('src/map_ship.js',[
 ['[-26.5, -6.3]','[-24.33, -7.55]'],['[26.5, -6.3]','[18.29, -8.5]'],
 ['[-26, 2]','[-23.67, -6.69]'],['[26, 2]','[17.16, -6.84]'],
 ['[-22, 13.8]','[-5.56, 7.81]'],['[22, 13.8]','[14.93, 6.73]'],
 ['[-13.5, 10.2]','[-7.87, 6.95]'],['[13.5, 10.2]','[13.5, 8.2]'],
 ['K.relay("ship_r3", 19.2, -7.2','K.relay("ship_r3", 17.9, -7.95']
]);
patchJS('src/map_core.js',[['[-35.2, -14.5]','[-26.99, -16.7]']]);
console.log(log.join('\n'));
