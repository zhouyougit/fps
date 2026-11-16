
import { chromium } from 'playwright';
const URL = process.env.MP_URL || 'ws://172.16.17.189:9100';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const room='tdm-'+Date.now().toString(36);
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
const states=await Promise.all(pages.map(x=>x.p.evaluate(()=>window.__MP.state())));
ok('自动分队', states[0].team===0 && states[1].team===1, states);
await pages[0].p.evaluate(()=>window.__MP.testTeleport(-2,12));
await pages[1].p.evaluate(()=>window.__MP.testTeleport(2,12));
await new Promise(r=>setTimeout(r,1500));
const pos=await Promise.all(pages.map(x=>x.p.evaluate(()=>({pos:window.__G.player.pos.toArray().map(v=>+v.toFixed(1)), team:window.__MP.state().team, hud:(document.querySelector('[data-mp-team]')||{}).textContent}))));
ok('分队出生/传送', Math.abs(pos[0].pos[0]+2)<2 && Math.abs(pos[1].pos[0]-2)<2, pos);
const aim=await pages[0].p.evaluate(()=>{
  const d=window.__MP.debug(); const h=d.hist[0]&&d.hist[0].h[d.hist[0].h.length-1]; if(!h) return null;
  const me=window.__G.player.pos, ox=me.x, oy=me.y+1.68, oz=me.z;
  const dx=h.x-ox, dy=(h.y+1.0)-oy, dz=h.z-oz, L=Math.hypot(dx,dy,dz);
  return {dir:{x:dx/L,y:dy/L,z:dz/L}, dist:+L.toFixed(2)};
});
ok('对端可见', !!aim && aim.dist<8, aim);
for(let i=0;i<10;i++){ await pages[0].p.evaluate(([d])=>window.__MP.testFire(d),[aim.dir]); await new Promise(r=>setTimeout(r,180)); }
await new Promise(r=>setTimeout(r,1500));
const b=await pages[1].p.evaluate(()=>({hp:window.__G.player.health, dead:document.querySelector('.x-mp-dead').classList.contains('on')}));
const a=await pages[0].p.evaluate(()=>({kd:(document.querySelector('[data-mp-kd]')||{}).textContent, score:(document.querySelector('[data-mp-score]')||{}).textContent, data:window.__MP.score()}));
ok('团队击杀', a.data.teams[0]===1 && a.data.players.some(p=>p.team===1&&p.deaths===1) && /1K/.test(a.kd||''), {b,a});
ok('团队比分', a.score==='1 : 0' && a.data.teams[0]===1 && a.data.teams[1]===0, a);
await pages[0].p.evaluate(()=>window.__MP.testRound());
await new Promise(r=>setTimeout(r,900));
const roundOn=await pages[0].p.evaluate(()=>({on:document.querySelector('.x-mp-round').classList.contains('on'), text:document.querySelector('.x-mp-round .t').textContent}));
ok('回合结束提示', roundOn.on || /蓝队胜利|红队胜利/.test(roundOn.text || ''), roundOn);
await new Promise(r=>setTimeout(r,3200));
const reset=await pages[0].p.evaluate(()=>({kd:(document.querySelector('[data-mp-kd]')||{}).textContent, overlay:document.querySelector('.x-mp-round').classList.contains('on'), score:window.__MP.score()}));
ok('回合重置', !reset.overlay && /0K/.test(reset.kd||''), reset);
await pages[1].p.keyboard.press('Tab'); await new Promise(r=>setTimeout(r,300));
await pages[0].p.keyboard.press('Tab'); await new Promise(r=>setTimeout(r,400));
const sb=await pages[0].p.evaluate(()=>({rows:document.querySelectorAll('.x-mp-score tbody tr').length, text:document.querySelector('.x-mp-score tbody').innerText}));
ok('计分板队伍列', sb.rows===2 && /蓝/.test(sb.text) && /红/.test(sb.text), sb);
await pages[0].p.screenshot({path:'tools/v20_tdm.png',timeout:120000});
ok('无错误', pages[0].errs.length===0 && pages[1].errs.length===0, {a:pages[0].errs.slice(0,2),b:pages[1].errs.slice(0,2)});
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
