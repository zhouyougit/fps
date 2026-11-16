
import { chromium } from 'playwright';
import { PW_ARGS } from './pwargs.mjs';
import { existsSync } from 'node:fs';
const BASE=new URL('../game.html?q=low&noaudio=1&autostart=1&dt=0.1', import.meta.url).href;
const CHROME=[process.env.CHROME_EXE,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p=>p&&existsSync(p));
const browser = await chromium.launch({ headless:true, executablePath: CHROME, args: PW_ARGS });
const page = await browser.newPage({ viewport:{width:1000,height:560} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let fails=0;
const ok=(n,c,d)=>{ if(!c) fails++; console.log((c?'PASS':'FAIL')+' · '+n+(d?' — '+JSON.stringify(d):'')); };
await page.goto(BASE,{waitUntil:'load',timeout:180000});
await page.waitForFunction(()=>window.__ready===true||window.__fatal,null,{timeout:240000});
await page.waitForTimeout(800);
const boot = await page.evaluate(()=>({ready:window.__ready,fatal:window.__fatal,weapons:(window.__G.weapon.list||[]).map(w=>w.id),err:(window.__errors||[]).slice(0,3)}));
const WANT_WEAPONS = ['pac9','breaker12','dmr','smg','lmg','sidearm'];
const weaponSetOk = boot.weapons.length===6 && new Set(boot.weapons).size===6 &&
  WANT_WEAPONS.every(id=>boot.weapons.indexOf(id)>=0) && boot.weapons.every(id=>WANT_WEAPONS.indexOf(id)>=0);
ok('当前版本启动', boot.ready && !boot.fatal && boot.err.length===0 && weaponSetOk, boot);

async function mission(i){
  return await page.evaluate((idx)=>{
    const G=window.__G; window.__SX.applyMission(idx); G.game.start({skipIntro:true});
    return {env:window.__SX.environment(), pos:G.player.pos.toArray().map(v=>+v.toFixed(2))};
  }, i);
}
const m0=await mission(0);
const m1=await mission(1);
const m2=await mission(2);
ok('V12 环境差异', m0.env.intensity>8 && m1.env.intensity<4 && m1.env.sun[2]>0.5 && m1.env.exposure<0.9 && m2.env.sun[2]<0 && m2.env.intensity>6, {m0:m0.env,m1:m1.env,m2:m2.env});
ok('V12 行动2 室内出生', Math.abs(m1.pos[0]+10)<1 && Math.abs(m1.pos[2]+20)<1 && m1.pos[1]<1, m1.pos);
ok('V12 行动1/3 大门出生', Math.abs(m0.pos[0]+32)<1 && Math.abs(m2.pos[0]+32)<1, [m0.pos,m2.pos]);

const variants=await page.evaluate(()=>{
  const G=window.__G,T=G.THREE; window.__SX.S.hpScale=1; window.__SX.S.damageScale=1; G.enemies.clear();
  const m=G.enemies.spawn('marksman',new T.Vector3(-30,0,6),{yaw:0,passive:true});
  const h=G.enemies.spawn('heavy',new T.Vector3(-2,0,12),{yaw:0});
  const t=G.enemies.spawn('turret',new T.Vector3(-6,0,12),{yaw:0});
  const hp0=h.hp;
  const front=new T.Vector3(-2,1.6,18), dirF=new T.Vector3(0,-1.1,-6).normalize();
  G.combat.playerShot(front,dirF,{damage:20,range:50});
  const frontLoss=hp0-h.hp;
  for(let i=0;i<20;i++) G.combat.playerShot(front,dirF,{damage:20,range:50});
  return {pool:G.enemies.TUNE.poolHounds,m:{hp:m.hp,laser:m.laser,rMax:m.rangeMax},h:{shield:240,mesh:h.shieldMesh&&h.shieldMesh.visible},t:{fixed:t.fixed,leg:+t.rig.bones.abdFL.scale.x.toFixed(2)},frontLoss,shieldNow:h.shieldHp};
});
ok('V10 新敌人', variants.pool>=12 && variants.m.hp===95 && variants.m.laser && variants.t.fixed && variants.t.leg<0.05 && variants.h.shield===240, variants);
ok('V10 护盾减伤/击破', variants.frontLoss>0 && variants.frontLoss<=6 && variants.shieldNow===0 && variants.h.mesh===false, {frontLoss:variants.frontLoss,shieldNow:variants.shieldNow});

const arm=await page.evaluate(()=>{
  const S=window.__SX; S.armorySet('pac9','muzzle','supp');
  const w=window.__G.weapon.list.find(x=>x.id==='pac9');
  const out={damage:w.mods.damage,alert:w.mods.alert};
  S.armorySet('pac9','muzzle','std');
  return out;
});
ok('V8 消音器', Math.abs(arm.damage-0.92)<0.001 && arm.alert===14, arm);

const scan=await page.evaluate(()=>{
  const G=window.__G,T=G.THREE,S=window.__SX;
  S.applyMission(0); G.game.start({skipIntro:true});
  G.enemies.clear();
  G.player.pos.set(-19,0,9); G.player.yaw=0;
  [['hound',-19,0,4],['hound',-16,0,5],['gull',-19,6,3]].forEach(([ty,x,y,z])=>G.enemies.spawn(ty,new T.Vector3(x,y,z),{state:'alert',passive:true}));
  S.scan();
  return {marks:S.marks(),cd:S.scanCd()};
});
ok('V6 战术扫描', scan.marks===3 && scan.cd>13, scan);

const reach = await page.evaluate(()=>{
  const G=window.__G, out=[];
  for(let i=0;i<3;i++){
    window.__SX.applyMission(i); G.game.start({skipIntro:true});
    const v=window.__SX.validateObjectives();
    out.push({i, ok:v.every(x=>x.ok), bad:v.filter(x=>!x.ok), relays:G.level.objectives.map(o=>({id:o.id,y:+o.pos.y.toFixed(2)}))});
  }
  return out;
});
ok('任务标志物可达', reach.every(x=>x.ok) && reach[1].relays.every(r=>r.y<2), reach);

const hold=await page.evaluate(async ()=>{
  const G=window.__G; window.__SX.applyMission(1); G.game.start({skipIntro:true});
  window.__SX.god(); window.__SX.cutAll();
  return {evac:G.game.run.evacT, all:G.game.run.allCut};
});
await page.waitForTimeout(1200);
const hold2=await page.evaluate(()=>({evac:window.__G.game.run.evacT,obj:document.querySelector('.h-obj-t').textContent}));
ok('V11 坚守节拍', hold.all && hold.evac>40 && hold2.obj.indexOf('坚守')>=0, {hold,hold2});

await page.evaluate(()=>{ window.__G.game.run.evacT=0.01; });
await page.waitForTimeout(1500);
const opened=await page.evaluate(()=>({evac:window.__G.game.run.evacT,markers:document.querySelectorAll('.h-wm').length,obj:document.querySelector('.h-obj-t').textContent}));
ok('V11 撤离窗口', opened.evac===0 && opened.markers>=1, opened);

const boss=await page.evaluate(async ()=>{
  const G=window.__G; window.__SX.applyMission(2); G.game.start({skipIntro:true});
  window.__SX.god(); window.__SX.cutAll();
  await new Promise(r=>setTimeout(r,3500));
  const b=G.enemies.list.find(e=>e.boss);
  if(b) b.damage(99999,b.pos,new G.THREE.Vector3(0,0,1),'weak');
  await new Promise(r=>setTimeout(r,1500));
  return {hadBoss:!!b,bossAlive:G.game.run.bossAlive,evac:G.game.run.evacT};
});
ok('V11 BOSS 后登船窗口', boss.hadBoss && boss.bossAlive===false && boss.evac>20, boss);

const mapCheck = await page.evaluate(()=>{
  const G=window.__G, out={};
  out.maps=window.__SX.maps();
  window.__SX.applyMission(3); G.game.start({skipIntro:true});
  out.depot={map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), obj:G.level.objectives.length, boxes:G.physics.boxes.length, valid:window.__SX.validateObjectives().every(x=>x.ok)};
  window.__SX.applyMission(0); G.game.start({skipIntro:true});
  out.harbor={map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), boxes:G.physics.boxes.length, valid:window.__SX.validateObjectives().every(x=>x.ok)};
  return out;
});
ok('V15 地图注册与切换', mapCheck.maps.includes('depot') && mapCheck.depot.map==='depot' && mapCheck.depot.obj===3 && mapCheck.depot.valid && mapCheck.harbor.map==='harbor' && mapCheck.harbor.boxes>500 && mapCheck.harbor.valid, mapCheck);

const ship = await page.evaluate(()=>{
  const G=window.__G; window.__SX.applyMission(4); G.game.start({skipIntro:true});
  const apron=G.ground.root.getObjectByName('apron');
  return {map:window.__SX.mapId(), obj:G.level.objectives.length, valid:window.__SX.validateObjectives().every(x=>x.ok), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), sea:G.ground.root.getObjectByName('sea').visible, apron:apron&&apron.visible, boxes:G.physics.boxes.length};
});
ok('V18 货轮甲板可达', ship.map==='ship' && ship.obj===3 && ship.valid && ship.sea && !ship.apron && ship.boxes<120, ship);

const finale = await page.evaluate(()=>{
  const G=window.__G; window.__SX.applyMission(5); G.game.start({skipIntro:true});
  return {map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(1)), obj:G.level.objectives.length, extract:G.level.extraction.pos.toArray().map(v=>+v.toFixed(1))};
});
ok('V19 归途终章', finale.map==='harbor' && finale.obj===2 && Math.abs(finale.start[0]-29)<2 && Math.abs(finale.extract[0]+32)<1, finale);

ok('无运行时错误', errs.length===0 && boot.err.length===0, errs.slice(0,3));
await browser.close();
console.log(fails? fails+' 项失败':'全部通过');
process.exit(fails?1:0);
