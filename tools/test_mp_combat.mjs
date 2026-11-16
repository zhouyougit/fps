
import { chromium } from 'playwright';
const URL = process.env.MP_URL || 'ws://172.16.17.189:9100';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='cbtest-'+Date.now().toString(36);
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
const pages=[];
for(let i=0;i<2;i++){
  const p=await browser.newPage({ viewport:{width:1000,height:560} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await p.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
  await p.waitForTimeout(600);
  await p.evaluate(([u,r,n])=>window.__MP.join(u,n,r),[URL,room,i===0?'A':'B']);
  pages.push({p,errs});
}
for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,1000)); const s=await pages[0].p.evaluate(()=>window.__MP.state()); if(s.players>=2&&s.active) break; }
await pages[0].p.evaluate(()=>window.__MP.testTeleport(-2,12));
await pages[1].p.evaluate(()=>window.__MP.testTeleport(2,12));
await new Promise(r=>setTimeout(r,1400));
const aim=await pages[0].p.evaluate(()=>{
  const d=window.__MP.debug(); const h=d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1]; if(!h) return null;
  const me=window.__G.player.pos, ox=me.x, oy=me.y+1.68, oz=me.z;
  const dx=h.x-ox, dy=(h.y+1.0)-oy, dz=h.z-oz, L=Math.hypot(dx,dy,dz);
  return {dir:{x:dx/L,y:dy/L,z:dz/L}, dist:+L.toFixed(2)};
});
ok('双人进入战斗', !!aim, aim);
for(let i=0;i<10;i++){ await pages[0].p.evaluate(([d])=>window.__MP.testFire(d),[aim.dir]); await new Promise(r=>setTimeout(r,180)); }
await new Promise(r=>setTimeout(r,1200));
const b=await pages[1].p.evaluate(()=>({hp:window.__G.player.health, armor:window.__G.player.armor, dead:document.querySelector('.x-mp-dead').classList.contains('on'), text:(document.querySelector('.x-mp-dead .s')||{}).textContent, err:(window.__errors||[]).slice(0,2)}));
const a=await pages[0].p.evaluate(()=>({kd:(document.querySelector('[data-mp-kd]')||{}).textContent, time:(document.querySelector('[data-mp-time]')||{}).textContent, feed:[...document.querySelectorAll('.h-fl')].map(x=>x.textContent), score:window.__MP.score()}));
ok('服务器判定击杀', a.score.players.some(p=>p.kills===1) && a.score.players.some(p=>p.deaths===1) && /击倒/.test(b.text||'') || a.score.players.some(p=>p.kills===1), {b,a});
ok('击杀播报与比分', /1K/.test(a.kd||'') && a.feed.join(' ').includes('A') && a.feed.join(' ').includes('B') && a.score.players.some(p=>p.kills===1), a);
ok('回合计时', a.time && a.time!=='0:41' && /^\d+:\d\d$/.test(a.time), a.time);
await new Promise(r=>setTimeout(r,4000));
const resp=await pages[1].p.evaluate(()=>({hp:window.__G.player.health, armor:window.__G.player.armor, dead:document.querySelector('.x-mp-dead').classList.contains('on')}));
ok('3 秒后重生', resp.hp===100 && resp.armor===50 && !resp.dead, resp);
await pages[0].p.keyboard.press('Tab'); await new Promise(r=>setTimeout(r,400));
const sc=await pages[0].p.evaluate(()=>({on:document.querySelector('.x-mp-score').classList.contains('on'), rows:document.querySelectorAll('.x-mp-score tbody tr').length}));
ok('Tab 计分板', sc.on && sc.rows===2, sc);
await pages[0].p.screenshot({path:'tools/v17_score_final.png',timeout:120000});
ok('无运行时错误', pages[0].errs.length===0 && pages[1].errs.length===0 && (!b.err || b.err.length===0), {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
