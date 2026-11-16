
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1500);
async function env(name, data) {
  await page.evaluate((d)=>{
    const G=window.__G,r=G.render,u=r.sky.material.uniforms;
    u.uSunDir.value.set(d.sun[0],d.sun[1],d.sun[2]).normalize();
    u.uZen.value.set(d.zen[0],d.zen[1],d.zen[2]);
    u.uHor.value.set(d.hor[0],d.hor[1],d.hor[2]);
    u.uHorAway.value.set(d.away[0],d.away[1],d.away[2]);
    u.uSunCol.value.set(d.col[0],d.col[1],d.col[2]);
    r.sun.position.set(d.sun[0]*200,d.sun[1]*200,d.sun[2]*200);
    r.sun.color.set(d.light);
    r.sun.intensity=d.intensity;
    r.exposure=d.exposure;
    G.scene.environmentIntensity=d.env;
    G.ground.setRain(d.rain);
  }, data);
  await page.waitForTimeout(2500);
  await page.screenshot({path:'tools/v12_'+name+'.png',timeout:120000});
  console.log('shot', name);
}
await page.screenshot({path:'tools/v12_dusk.png',timeout:120000});
await env('storm',{sun:[0.4,0.12,0.9],zen:[0.02,0.03,0.045],hor:[0.16,0.2,0.26],away:[0.06,0.075,0.1],col:[0.35,0.42,0.55],light:0xaab7c9,intensity:3.2,exposure:0.82,env:1.2,rain:1});
await env('dawn',{sun:[0.75,0.1,-0.65],zen:[0.05,0.07,0.15],hor:[1.0,0.5,0.36],away:[0.13,0.15,0.24],col:[1,0.55,0.36],light:0xffc9a8,intensity:6.5,exposure:1.06,env:2.1,rain:0.2});
await browser.close();
