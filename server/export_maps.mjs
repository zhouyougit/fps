
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { launchOptions, GPU_MODE } from '../tools/pwargs.mjs';
const EXE = process.env.CHROME_EXE;
const browser = await chromium.launch(launchOptions({ headless: true }));
const page = await browser.newPage({ viewport:{width:800,height:450} });
await page.goto('file:///Users/zhouyou/codex_workspace/fps/game.html?q=low&noaudio=1&autostart=1&dt=0.1&novisual=1',{waitUntil:'load',timeout:180000});
console.log('[export_maps] gpu=' + GPU_MODE);
await page.waitForFunction(()=>window.__ready===true,null,{timeout:240000});
await page.waitForTimeout(800);
const maps = [
  {id:'harbor', idx:0, bases:[{x:-32,z:6,yaw:-1.57},{x:24,z:12,yaw:1.57}]},
  {id:'depot', idx:3, bases:[{x:0,z:13.6,yaw:0},{x:0,z:-14.2,yaw:Math.PI}]},
  {id:'ship', idx:4, bases:[{x:0,z:5.2,yaw:0},{x:0,z:-8.4,yaw:Math.PI}]},
  {id:'core', mode:'map', bases:[{x:0,z:9.6,yaw:0},{x:0,z:-9.6,yaw:Math.PI}]}
];
const out = {version:1, maps:{}};
for (const m of maps) {
  const data = await page.evaluate(({idx, id, mode})=>{
    const G=window.__G;
    if (mode === 'map') { window.__SX.switchMap(id); G.game.start({skipIntro:true}); }
    else { window.__SX.applyMission(idx); G.game.start({skipIntro:true}); }
    const P=G.physics;
    return {
      boxes: P.boxes.map(b=>({min:b.min.toArray(),max:b.max.toArray(),surface:b.surface,tag:b.tag,bulletOnly:!!b.bulletOnly,playerOnly:!!b.playerOnly})),
      bounds: {min:P.bounds.min.toArray(),max:P.bounds.max.toArray()},
      groundY: P.groundY, seaY: P.seaY, quayX: P.quayX,
      playerStart: G.level.playerStart.pos.toArray(),
      spawns: (G.level.enemySpawns||[]).map(s=>({x:s.pos.x,y:s.pos.y,z:s.pos.z,type:s.type}))
    };
  }, {idx:m.idx, id:m.id, mode:m.mode});
  try {
    const auth = JSON.parse(fs.readFileSync(path.resolve('packages/data/maps/' + m.id + '.authored.json'), 'utf8'));
    if (auth.bounds) data.bounds = auth.bounds;
    if (auth.ground) {
      data.groundY = auth.ground.y;
      data.seaY = auth.ground.seaY == null ? -1.6 : auth.ground.seaY;
      data.quayX = auth.ground.quayX == null ? 30 : auth.ground.quayX;
    }
  } catch (err) { console.warn('[export_maps] authored missing for ' + m.id + ': ' + err.message); }
  data.teamBases = m.bases;
  out.maps[m.id] = data;
  console.log(m.id, 'boxes', data.boxes.length, 'spawns', data.spawns.length);
}
fs.writeFileSync('server/maps.json', JSON.stringify(out));
console.log('wrote server/maps.json', fs.statSync('server/maps.json').size);
await browser.close();