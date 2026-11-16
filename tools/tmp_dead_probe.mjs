
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:800,height:480}});
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game_v37.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await p.waitForTimeout(800);
const r=await p.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(0); G.game.start({skipIntro:true}); const before={hp:G.player.health,alive:G.player.alive,inv:G.player.invulnerable,state:G.game.state}; let dead=0; G.events.on('player:dead',()=>dead++); G.player.health=5; G.player.damage(999,G.player.pos); return {before,after:{hp:G.player.health,alive:G.player.alive,state:G.game.state,dead}}; });
console.log(JSON.stringify(r));
await p.waitForTimeout(1000);
console.log(JSON.stringify(await p.evaluate(()=>({state:window.__G.game.state,screen:!!document.querySelector('.m-screen[data-s="dead"]'),hp:window.__G.player.health,alive:window.__G.player.alive}))));
try{await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]);}catch(e){}
process.exit(0);
