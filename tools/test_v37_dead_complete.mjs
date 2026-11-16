#!/usr/bin/env node
/* V37 回归：死亡/结算界面必须出现（固定步状态机） */
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
const CHROME = process.env.CHROME_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SX_URL || 'file:///Users/zhouyou/codex_workspace/fps/game_v37.html?q=low&noaudio=1&autostart=1&dt=0.1';
const b = await chromium.launch({ headless:true, executablePath:CHROME, args: PW_ARGS });
const p = await b.newPage({ viewport:{width:1000,height:560} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c)fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d!==undefined?' — '+JSON.stringify(d):'')); };
await p.goto(URL,{waitUntil:'load',timeout:240000});
await p.waitForFunction(()=>window.__ready===true&&window.__SX_LOOP,null,{timeout:420000});
await p.waitForTimeout(800);

// 死亡：真实 rAF 2.5 秒内出现死亡页
await p.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(0); G.game.start({skipIntro:true}); G.player.health=5; G.player.damage(999, G.player.pos); });
await p.evaluate(()=>window.__SX_LOOP.step(240));
await p.waitForTimeout(300);
const dead=await p.evaluate(()=>({state:window.__G.game.state,screen:!!document.querySelector('.m-screen[data-s="dead"]')&&getComputedStyle(document.querySelector('.m-screen[data-s="dead"]')).display!=='none',btn:!!document.querySelector('.m-screen[data-s="dead"] [data-act="retry"]')}));
ok('死亡状态机推进', dead.state==='dead', dead.state);
ok('死亡界面显示', dead.screen && dead.btn, dead);

// 结算：撤离后 complete + 结算页
await p.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(0); G.game.start({skipIntro:true}); window.__SX.god(); window.__SX.cutAll(); G.game.run.evacT=0.01; const ex=G.level.extraction.pos; G.player.pos.set(ex.x,ex.y,ex.z); });
await p.evaluate(()=>window.__SX_LOOP.step(600));
await p.waitForTimeout(300);
const comp=await p.evaluate(()=>({state:window.__G.game.state,screen:!!document.querySelector('.m-screen[data-s="complete"]')&&getComputedStyle(document.querySelector('.m-screen[data-s="complete"]')).display!=='none'}));
ok('结算状态机推进', comp.state==='complete', comp.state);
ok('结算界面显示', comp.screen, comp);
ok('无 pageerror', errs.length===0, errs.slice(0,3));
console.log(fails?fails+' 项失败':'全部通过');
try{ await Promise.race([b.close(),new Promise(r=>setTimeout(r,3000))]); }catch(e){}
process.exit(fails?1:0);
