
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:800,height:480}});
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
const r=await p.evaluate(()=>{ const G=window.__G,S=window.__SX,T=G.THREE; S.god(); S.armorySet('pac9','muzzle','supp'); G.player.pos.set(-19,0,9); G.player.yaw=0; G.player.pitch=0; G.enemies.clear(); const e=G.enemies.spawn('hound',new T.Vector3(-19,0,4),{state:'alert',passive:true}); const w=G.weapon.list[0]; const before={mods:w.mods.damage,alert:w.mods.alert,shots:G.combat.stats.shots,hp:e.hp,state:G.game.state,enabled:G.player.enabled,fire:G.input.fire}; G.input.fire=true; window.__SX_LOOP.step(60); G.input.fire=false; window.__SX_LOOP.step(5); return {before,after:{shots:G.combat.stats.shots,hp:e.hp,ammo:G.weapon.ammo}}; });
console.log(JSON.stringify(r));
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]);}catch(e){}
process.exit(0);
