
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page=await browser.newPage({ viewport:{width:1000,height:560} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0; const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(700);
const a=await page.evaluate(()=>{
  document.querySelector('[data-x-seg="hudScale"] button[data-v="115"]').click();
  document.querySelector('[data-x-seg="subSize"] button[data-v="L"]').click();
  document.querySelector('[data-x-contrast]').click();
  return {
    hud:getComputedStyle(document.documentElement).getPropertyValue('--hud-scale').trim(),
    sub:getComputedStyle(document.documentElement).getPropertyValue('--sub-scale').trim(),
    hc:document.body.classList.contains('hc'),
    saved:JSON.parse(localStorage.getItem('saltline.access.v1')||'{}')
  };
});
ok('HUD 缩放', a.hud==='1.15', a);
ok('字幕大小', a.sub==='1.22', a);
ok('高对比模式', a.hc && a.saved.contrast===true, a);
await page.screenshot({path:'tools/v27_settings.png',timeout:120000});
await page.reload({waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(700);
const b=await page.evaluate(()=>({hud:getComputedStyle(document.documentElement).getPropertyValue('--hud-scale').trim(), sub:getComputedStyle(document.documentElement).getPropertyValue('--sub-scale').trim(), hc:document.body.classList.contains('hc')}));
ok('设置持久化', b.hud==='1.15' && b.sub==='1.22' && b.hc, b);
ok('无错误', errs.length===0, errs.slice(0,2));
await browser.close();
console.log(fails?fails+' 项失败':'全部通过');
process.exit(fails?1:0);
