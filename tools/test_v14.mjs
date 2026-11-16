
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:240000});
await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
await page.waitForTimeout(1200);
const ui = await page.evaluate(()=>({
  heads: [...document.querySelectorAll('.panel-b h3')].map(x=>x.textContent),
  premise: (document.querySelector('.m-title .m-premise')||{}).textContent,
  reduce: !!document.querySelector('[data-x-reduce]'),
  toTitle: !!document.querySelector('.m-screen[data-s="paused"] [data-x="to-title"]')
}));
ok('V14 设置分组', ui.heads.includes('画面与音频') && ui.heads.includes('操控') && ui.heads.includes('游戏性'), ui.heads);
ok('V14 减少动态选项', ui.reduce, ui.reduce);
ok('V14 暂停返回标题按钮', ui.toTitle, ui.toTitle);
ok('V14 标题当前行动', (ui.premise||'').includes('当前行动'), ui.premise);
const red = await page.evaluate(()=>{
  document.querySelector('[data-x-reduce]').click();
  return {on:document.body.classList.contains('reduce-motion'), shake:window.__SX.S.shakeScale, saved:JSON.parse(localStorage.getItem('saltline.access.v1')||'{}').reduceMotion};
});
ok('V14 减少动态生效', red.on && red.shake<=0.2 && red.saved===true, red);

// die during normal gameplay
await page.waitForTimeout(6000);
console.log('hit', JSON.stringify(await page.evaluate(()=>{ const b=document.querySelector('[data-act="retry"]'); const r=b.getBoundingClientRect(); const at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); const l=document.querySelector('.loc-card'); return {at:at&&at.outerHTML.slice(0,110), loc:l&&getComputedStyle(l).display}; })));
await page.evaluate(()=>window.__G.player.damage(999,null));
for(let i=0;i<15;i++){ await page.waitForTimeout(1500); const vis=await page.evaluate(()=>getComputedStyle(document.querySelector('.m-screen[data-s="dead"]')).display!=='none'); if(vis) break; }
await page.waitForTimeout(300);
const rb=await page.locator('[data-act="retry"]').boundingBox();
if(rb) await page.mouse.click(rb.x+rb.width/2, rb.y+rb.height/2);
await page.waitForTimeout(300);
const r1=await page.evaluate(()=>({state:window.__G.game.state, text:document.querySelector('[data-act="retry"]').textContent, confirm:document.querySelector('[data-act="retry"]').dataset.confirm}));
if(rb) await page.mouse.click(rb.x+rb.width/2, rb.y+rb.height/2);
await page.waitForTimeout(1500);
const r2=await page.evaluate(()=>({state:window.__G.game.state}));
ok('V14 重试二次确认', r1.text.includes('确认') && r1.confirm==='1' && r2.state!=='dead', {r1,r2});

// pause return to title
await page.evaluate(()=>{ const G=window.__G; G.game.menus.show('none'); G.game.start({skipIntro:true}); });
await page.waitForTimeout(800);
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);
const pb=await page.locator('.m-screen[data-s="paused"] [data-x="to-title"]').boundingBox();
if(pb) await page.mouse.click(pb.x+pb.width/2, pb.y+pb.height/2);
await page.waitForTimeout(1200);
const back = await page.evaluate(()=>({state:window.__G.game.state, screen:window.__G.game.menus.screen}));
ok('V14 返回标题', back.state==='title' && back.screen==='title', back);
ok('V14 无运行时错误', errs.length===0, errs.slice(0,2));
await browser.close();
console.log(fails? fails+' 项失败':'全部通过');
process.exit(fails?1:0);
