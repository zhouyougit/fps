
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(2600);
const guide=await page.evaluate(()=>({on:document.querySelector('.x-guide').classList.contains('on'), seen:localStorage.getItem('saltline.guide.v1')}));
ok('首次出击引导', guide.on, guide);
await page.screenshot({path:'tools/v28_guide.png',timeout:120000});
await page.evaluate(()=>document.querySelector('[data-guide-skip]').click());
await page.waitForTimeout(300);
ok('引导不再显示', await page.evaluate(()=>localStorage.getItem('saltline.guide.v1')==='1' && !document.querySelector('.x-guide').classList.contains('on')));
// training
await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
await page.waitForTimeout(300);
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await click('.x-train-card'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(2200);
const tr=await page.evaluate(()=>({on:document.querySelector('.x-train-step').classList.contains('on'), text:document.querySelector('.x-train-step').innerText}));
ok('训练目标面板', tr.on && /击倒 2/.test(tr.text), tr);
await page.evaluate(()=>{ const G=window.__G; const ts=G.enemies.list.filter(e=>e.alive&&e.trainTarget); ts.slice(0,2).forEach(e=>e.damage(999,e.pos,new G.THREE.Vector3(0,0,1),'body')); window.__SX.scan(); const S=window.__SX; S.aim(); S.release(); });
await page.waitForTimeout(1200);
const steps=await page.evaluate(()=>({kill:document.querySelector('[data-step="kill"]').className, scan:document.querySelector('[data-step="scan"]').className, nade:document.querySelector('[data-step="nade"]').className, done:document.querySelector('.x-train-step').classList.contains('done')}));
ok('训练目标完成', steps.kill==='done' && steps.scan==='done' && steps.nade==='done' && steps.done, steps);
await page.screenshot({path:'tools/v28_training.png',timeout:120000});
ok('无错误', errs.length===0, errs.slice(0,2));
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
