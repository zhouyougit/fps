
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(700);
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(5); G.game.start({skipIntro:true}); window.__SX.god(); window.__SX.cutAll(); });
await page.waitForTimeout(3500);
await page.evaluate(()=>{ const G=window.__G,b=G.enemies.list.find(e=>e.boss); if(b) b.damage(99999,b.pos,new G.THREE.Vector3(0,0,1),'weak'); });
await page.waitForTimeout(2200);
await page.evaluate(()=>{ window.__G.game.run.evacT=0.01; });
await page.waitForTimeout(1200);
await page.evaluate(()=>{ const G=window.__G,e=G.level.extraction.pos; G.player.pos.set(e.x,e.y,e.z); });
for(let i=0;i<10;i++){ await page.waitForTimeout(2000); const st=await page.evaluate(()=>window.__G.game.state); if(st==='complete') break; }
await page.waitForTimeout(2200);
await page.evaluate(()=>{ try{ window.__G.game.menus.show('complete'); }catch(e){} });
await page.waitForTimeout(1000);
const ui=await page.evaluate(()=>({screen:window.__G.game.menus.screen, buttons:document.querySelectorAll('.x-end-choice [data-end]').length, note:(document.querySelector('.x-final')||{}).textContent}));
console.log('ui', JSON.stringify(ui));
if(ui.buttons) await page.evaluate(()=>document.querySelector('[data-end="silent"]').click());
await page.waitForTimeout(800);
await page.screenshot({path:'tools/v19_ending2.png',timeout:120000});
console.log('after', JSON.stringify(await page.evaluate(()=>({text:(document.querySelector('.x-ending')||{}).innerText, ending:JSON.parse(localStorage.getItem('saltline.campaign.v1')||'{}').ending, dim:(document.querySelector('.m-title .m-eyebrow .m-dim')||{}).textContent}))));
await browser.close();
