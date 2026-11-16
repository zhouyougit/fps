
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXE, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport:{width:1024,height:576} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1',{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const G=window.__G, r=G.render;
  const u=r.sky&&r.sky.material&&r.sky.material.uniforms;
  return {
    sky:!!r.sky, sun:!!r.sun, env:!!r.scene.environment,
    uniformKeys:u?Object.keys(u):null,
    sunPos:r.sun&&r.sun.position.toArray().map(v=>+v.toFixed(1)),
    sunColor:r.sun&&r.sun.color.getHexString(),
    sunIntensity:r.sun&&r.sun.intensity,
    envIntensity:r.scene.environmentIntensity,
    exposure:r.exposure,
    fog:!!r.scene.fog,
    skyType:r.sky&&r.sky.material.type,
    vals:u?{zen:u.uZen&&u.uZen.value.toArray(), hor:u.uHor&&u.uHor.value.toArray(), away:u.uHorAway&&u.uHorAway.value.toArray(), sun:u.uSunDir&&u.uSunDir.value.toArray().map(v=>+v.toFixed(2)), col:u.uSunCol&&u.uSunCol.value.toArray()}:null
  };
}),null,1).slice(0,5000));
await page.screenshot({path:'tools/v12_before.png',timeout:120000});
await browser.close();
