
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const out = {};
async function click(page, sel){ const b=await page.locator(sel).first().boundingBox(); if(!b) return false; await page.mouse.click(b.x+b.width/2,b.y+b.height/2); return true; }

/* V13 packaged runtime */
{
  const page = await browser.newPage({ viewport:{width:1280,height:720} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V13.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:240000});
  await page.waitForTimeout(1000);
  out.v13profile = await page.evaluate(()=>window.__SX_PROFILE);
  await page.evaluate(()=>{ window.__SX.unlockAll(); window.__SX.openMissions(); });
  await page.waitForTimeout(400);
  await click(page,'.x-mcard[data-idx="0"]'); await page.waitForTimeout(200);
  await click(page,'.x-camp-actions [data-x="go"]'); await page.waitForTimeout(400);
  out.v13brief = await page.evaluate(()=>({
    on:document.querySelector('.x-brief').classList.contains('on'),
    rows:[...document.querySelectorAll('.x-br-chal li')].map(x=>x.textContent),
    card:document.querySelector('.x-mcard[data-idx="0"] .x-mchal')?.textContent
  }));
  out.v13grant = await page.evaluate(()=>{
    window.__SX.challengeGrant('m1',{time:true,head:true,clean:true});
    return {count:window.__SX.challenges().count, lime:document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled};
  });
  out.v13err = errs.slice(0,2);
  await page.screenshot({path:'tools/evidence_v13.png',timeout:120000});
  await page.close();
}

/* V14 packaged runtime */
{
  const page = await browser.newPage({ viewport:{width:1280,height:720} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/%E5%87%A0%E7%8C%AB_V14.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:240000});
  await page.evaluate(()=>window.__G.game.start({skipIntro:true}));
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1000);
  await click(page,'.m-screen[data-s="paused"] .m-actions button:has-text("设置")'); await page.waitForTimeout(500);
  out.v14profile = await page.evaluate(()=>window.__SX_PROFILE);
  out.v14settings = await page.evaluate(()=>({
    heads:[...document.querySelectorAll('.panel-b h3')].map(x=>x.textContent),
    reduce:!!document.querySelector('[data-x-reduce]'),
    toTitle:!!document.querySelector('.m-screen[data-s="paused"] [data-x="to-title"]'),
    locPE:getComputedStyle(document.querySelector('.loc-card')).pointerEvents
  }));
  out.v14reduce = await page.evaluate(()=>{
    document.querySelector('[data-x-reduce]').click();
    return {on:document.body.classList.contains('reduce-motion'), shake:window.__SX.S.shakeScale};
  });
  out.v14err = errs.slice(0,2);
  await page.screenshot({path:'tools/evidence_v14.png',timeout:120000});
  await page.close();
}
console.log(JSON.stringify(out,null,1));
await browser.close();
