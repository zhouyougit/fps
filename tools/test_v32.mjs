
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1000,height:560} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:420000});
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(3); G.game.start({skipIntro:true}); });
await page.waitForTimeout(1500);
const a=await page.evaluate(()=>({map:window.__SX.mapId(), boxes:window.__G.physics.boxes.length, valid:window.__SX.validateObjectives().every(x=>x.ok), start:window.__G.level.playerStart.pos.toArray().map(v=>+v.toFixed(1)), extract:window.__G.level.extraction.pos.toArray().map(v=>+v.toFixed(1))}));
ok('V32 冷库扩建碰撞', a.map==='depot' && a.boxes>=220 && a.valid, a);
ok('V32 行动 04 可达', Math.abs(a.start[2]-13.6)<1 && Math.abs(a.extract[2]+14.2)<1, a);
ok('V32 无错误', errs.length===0, errs.slice(0,2));
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
