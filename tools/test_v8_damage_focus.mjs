
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport:{width:800,height:480} });
await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
const r=await p.evaluate(()=>{ window.__SX.armorySet('pac9','muzzle','supp'); const w=window.__G.weapon.list[0]; const out={mods:w.mods.damage, base:w.cfg.damage, effective:+(w.cfg.damage*w.mods.damage).toFixed(2), alert:w.mods.alert}; window.__SX.armorySet('pac9','muzzle','std'); return out; });
console.log(JSON.stringify(r)); console.log((Math.abs(r.mods-0.92)<1e-6)?'PASS · V8 伤害修正（mods.damage=0.92）':'FAIL');
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,2000))]); }catch(e){}
process.exit(Math.abs(r.mods-0.92)<1e-6?0:1);
