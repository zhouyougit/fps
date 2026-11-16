
import { chromium } from 'playwright';
const url = process.argv[2];
const prefix = process.argv[3] || 'tools/play';
const steps = JSON.parse(process.argv[4] || '[]');
const exe = process.env.CHROME_EXE;
const browser = await chromium.launch({ headless: true, executablePath: exe,
  args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-webgl','--disable-dev-shm-usage','--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W||1280), height: +(process.env.H||720) }, deviceScaleFactor: 1 });
const logs=[]; page.on('console',m=>logs.push('['+m.type()+'] '+m.text())); page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto(url,{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:180000});
await page.waitForTimeout(2000);
let idx=0;
for (const s of steps) {
  if (s.eval) { const r = await page.evaluate(s.eval); console.log('eval ->', JSON.stringify(r)); }
  if (s.key) { await page.keyboard.press(s.key); }
  if (s.hold) { await page.keyboard.down(s.hold); await page.waitForTimeout(s.ms||1000); await page.keyboard.up(s.hold); }
  if (s.click) { await page.mouse.click(+(s.click.x||640), +(s.click.y||360)); }
  if (s.mouse) { await page.mouse.move(640,360); await page.mouse.down(); await page.waitForTimeout(s.ms||2000); await page.mouse.up(); }
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) { const p = prefix+'_'+(idx++)+'.png'; try { await page.screenshot({path:p,timeout:120000}); console.log('shot',p);} catch(e){console.log('shot fail',e.message);} }
}
const st = await page.evaluate(()=>({ s: window.__G.game.state, fps: window.__stats().fps, errors:(window.__errors||[]).slice(0,8) }));
console.log('END', JSON.stringify(st));
console.log(logs.filter(l=>!l.includes('GPU stall')).slice(-15).join('\n'));
await browser.close();
