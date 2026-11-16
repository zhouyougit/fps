
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('note.textContent = MISSIONS.length + " 个行动全部完成 · 港区行动结束";','note.textContent = "全部 " + MISSIONS.length + " 个行动完成 · 港区行动结束";',1)
io.open(p,'w',encoding='utf-8').write(s)
print('final text patched')

p2='tools/test_current.mjs'
s2=io.open(p2,encoding='utf-8').read()
old="ok('V15 地图注册与切换', mapCheck.maps.includes('depot') && mapCheck.depot.map==='depot' && mapCheck.depot.obj===3 && mapCheck.depot.valid && mapCheck.harbor.map==='harbor' && mapCheck.harbor.boxes>500 && mapCheck.harbor.valid, mapCheck);"
new="""ok('V15 地图注册与切换', mapCheck.maps.includes('depot') && mapCheck.depot.map==='depot' && mapCheck.depot.obj===3 && mapCheck.depot.valid && mapCheck.harbor.map==='harbor' && mapCheck.harbor.boxes>500 && mapCheck.harbor.valid, mapCheck);

const ship = await page.evaluate(()=>{
  const G=window.__G; window.__SX.applyMission(4); G.game.start({skipIntro:true});
  const apron=G.ground.root.getObjectByName('apron');
  return {map:window.__SX.mapId(), obj:G.level.objectives.length, valid:window.__SX.validateObjectives().every(x=>x.ok), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), sea:G.ground.root.getObjectByName('sea').visible, apron:apron&&apron.visible, boxes:G.physics.boxes.length};
});
ok('V18 货轮甲板可达', ship.map==='ship' && ship.obj===3 && ship.valid && ship.sea && !ship.apron && ship.boxes<120, ship);"""
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('current ship test added')

p3='tools/test_suite.mjs'
s3=io.open(p3,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s3.count(marker)==1
section='''/* ---------- 6.997 V18 货轮甲板与行动 5 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const ship = await page.evaluate(() => {
    const G = window.__G;
    const maps = window.__SX.maps();
    window.__SX.applyMission(4);
    G.game.start({ skipIntro: true });
    const apron = G.ground.root.getObjectByName('apron');
    const s = {
      map: window.__SX.mapId(),
      obj: G.level.objectives.length,
      start: G.player.pos.toArray().map(v => +v.toFixed(2)),
      extract: G.level.extraction.pos.toArray().map(v => +v.toFixed(2)),
      boxes: G.physics.boxes.length,
      valid: window.__SX.validateObjectives().every(x => x.ok),
      sea: G.ground.root.getObjectByName('sea').visible,
      apron: apron && apron.visible
    };
    return { maps, s };
  });
  ok('V18 货轮地图注册', ship.maps.includes('ship'), ship.maps);
  ok('V18 行动 5 可进入且可达', ship.s.map === 'ship' && ship.s.obj === 3 && ship.s.valid && Math.abs(ship.s.start[2] - 5.2) < 1, JSON.stringify(ship.s));
  ok('V18 海面/甲板正确', ship.s.sea === true && ship.s.apron === false && ship.s.boxes < 120, JSON.stringify({ sea: ship.s.sea, apron: ship.s.apron, boxes: ship.s.boxes, extract: ship.s.extract }));
  await page.close();
}

'''
s3=s3.replace(marker, section+marker,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('suite V18 added')
