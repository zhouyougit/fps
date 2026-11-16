
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
// briefing/cards
await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
await page.waitForTimeout(400);
const cards = await page.evaluate(()=>({count:document.querySelectorAll('.x-mcard').length, hotel:document.querySelectorAll('.x-mcard[data-idx]').length}));
ok('V15 行动卡数量', cards.hotel===4 && cards.count===5, cards);
await page.screenshot({path:'tools/v15_cards.png',timeout:120000});
async function click(sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }
await click('.x-mcard[data-idx="3"]'); await page.waitForTimeout(200);
await click('.x-camp-actions [data-x="go"]'); await page.waitForTimeout(400);
const brief = await page.evaluate(()=>({on:document.querySelector('.x-brief').classList.contains('on'), title:document.querySelector('.x-br-h').textContent, rows:document.querySelectorAll('.x-br-chal li').length}));
ok('V15 行动4 简报', brief.on && brief.title==='冷链仓库' && brief.rows===3, brief);
await click('.x-br-actions [data-x="brief-go"]'); await page.waitForTimeout(1200);
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
await page.waitForTimeout(4000);
const live = await page.evaluate(()=>({map:window.__SX.mapId(), state:window.__G.game.state, enemies:window.__G.enemies.list.filter(e=>e.alive).map(e=>e.type), obj:window.__G.level.objectives.length, hud:document.querySelector('.h-obj-t').textContent}));
ok('V15 行动4 已进入', live.map==='depot' && live.state==='playing' && live.obj===3, live);
// cut first relay
await page.evaluate(()=>{ const G=window.__G; window.__SX.god(); G.enemies.clear(); G.player.pos.set(-18,0.03,-13.7); G.player.yaw=Math.PI; });
await page.waitForTimeout(2500);
await page.keyboard.down('e'); await page.waitForTimeout(14000); await page.keyboard.up('e');
const cut1 = await page.evaluate(()=>({cut:window.__G.game.run.cut, prompt:(document.querySelector('.h-prompt')||{}).textContent}));
ok('V15 冷库中继可切断', cut1.cut>=1, cut1);
// finish: cut all, window, extract
await page.evaluate(()=>{ window.__SX.cutAll(); window.__G.game.run.evacT=0.01; });
await page.waitForTimeout(1500);
await page.evaluate(()=>{ const G=window.__G,e=G.level.extraction.pos; G.player.pos.set(e.x,e.y,e.z); });
let st='';
for(let i=0;i<12;i++){ await page.waitForTimeout(2000); st=await page.evaluate(()=>window.__G.game.state); if(st==='complete') break; }
await page.waitForTimeout(2500);
const done = await page.evaluate(()=>({state:window.__G.game.state, best:JSON.parse(localStorage.getItem('saltline.campaign.v1')||'{}').best, map:window.__SX.mapId()}));
ok('V15 行动4 可完成', done.state==='complete' && !!done.best.m4, done);
ok('V15 无运行时错误', errs.length===0, errs.slice(0,3));
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
