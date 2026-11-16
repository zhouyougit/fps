
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/versions/几猫_V33.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:240000});
await page.waitForFunction(()=>window.__ready===true&&window.__SX,null,{timeout:420000});
await page.waitForTimeout(1200);
await page.evaluate(()=>{ const G=window.__G; window.__SX.applyMission(0); G.game.start({skipIntro:true}); G.player.pos.set(-19,0,9); G.player.yaw=0.3; G.weapon.select(3); });
await page.waitForTimeout(1800);
await page.screenshot({path:'versions/screens/v33_smg.png',timeout:120000});
await page.evaluate(()=>{ window.__SX_MOVE && window.__SX_MOVE.slide(); });
await page.waitForTimeout(400);
await page.screenshot({path:'versions/screens/v33_slide.png',timeout:120000});
await page.evaluate(()=>{ const G=window.__G; G.weapon.select(4); G.player.pos.set(-19,0,9); });
await page.waitForTimeout(1200);
await page.screenshot({path:'versions/screens/v33_lmg.png',timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>({w:window.__G.weapon.list.map(x=>x.id), move:!!window.__SX_MOVE, fb:!!window.__SX_FEEDBACK, input:!!window.__SX_INPUT2, err:(window.__errors||[]).slice(0,3)}))));
try{ await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]); }catch(e){}
process.exit(0);
