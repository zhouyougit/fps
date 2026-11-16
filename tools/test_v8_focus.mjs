
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:900,height:520}});
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForFunction(()=>window.__G.game.state==='playing',null,{timeout:30000});
const setup=await p.evaluate(()=>{const G=window.__G,S=window.__SX,T=G.THREE;S.god();S.armorySet('pac9','muzzle','supp');G.player.pos.set(-19,0,9);G.player.yaw=0;G.player.pitch=0;G.enemies.clear();const e=G.enemies.spawn('hound',new T.Vector3(-19,0,4),{state:'alert',passive:true});window.__FIRED=[];G.events.on('weapon:fire',ev=>window.__FIRED.push(ev.radius));return {hp:e.hp,mods:G.weapon.list[0].mods.damage,state:G.game.state};});
await p.waitForTimeout(300);
await p.keyboard.down('Enter'); await p.waitForTimeout(1400); await p.keyboard.up('Enter'); await p.waitForTimeout(400);
const out=await p.evaluate(()=>({radii:window.__FIRED.slice(0,4),shots:window.__G.combat.stats.shots,hp:window.__G.enemies.list.filter(e=>e.alive).map(e=>e.hp),mods:window.__G.weapon.list[0].mods.damage}));
console.log(JSON.stringify({setup,out}));
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]);}catch(e){}
process.exit(0);
