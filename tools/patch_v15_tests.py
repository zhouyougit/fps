
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('note.textContent = "三个行动全部完成 · 港区行动结束";','note.textContent = MISSIONS.length + " 个行动全部完成 · 港区行动结束";',1)
io.open(p,'w',encoding='utf-8').write(s)
print('final text patched')

# test_current add map checks
p2='tools/test_current.mjs'
s2=io.open(p2,encoding='utf-8').read()
old="ok('V11 BOSS 后登船窗口', boss.hadBoss && boss.bossAlive===false && boss.evac>20, boss);"
new="""ok('V11 BOSS 后登船窗口', boss.hadBoss && boss.bossAlive===false && boss.evac>20, boss);

const mapCheck = await page.evaluate(()=>{
  const G=window.__G, out={};
  out.maps=window.__SX.maps();
  window.__SX.applyMission(3); G.game.start({skipIntro:true});
  out.depot={map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), obj:G.level.objectives.length, boxes:G.physics.boxes.length, valid:window.__SX.validateObjectives().every(x=>x.ok)};
  window.__SX.applyMission(0); G.game.start({skipIntro:true});
  out.harbor={map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(2)), boxes:G.physics.boxes.length, valid:window.__SX.validateObjectives().every(x=>x.ok)};
  return out;
});
ok('V15 地图注册与切换', mapCheck.maps.includes('depot') && mapCheck.depot.map==='depot' && mapCheck.depot.obj===3 && mapCheck.depot.valid && mapCheck.harbor.map==='harbor' && mapCheck.harbor.boxes>500 && mapCheck.harbor.valid, mapCheck);"""
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('current test map check added')

# suite V15
p3='tools/test_suite.mjs'
s3=io.open(p3,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s3.count(marker)==1
section='''/* ---------- 6.996 V15 新地图与行动 4 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const map = await page.evaluate(() => {
    const G = window.__G;
    const maps = window.__SX.maps();
    window.__SX.applyMission(3);
    G.game.start({ skipIntro: true });
    const depot = {
      map: window.__SX.mapId(),
      start: G.player.pos.toArray().map(v => +v.toFixed(2)),
      obj: G.level.objectives.length,
      boxes: G.physics.boxes.length,
      valid: window.__SX.validateObjectives().every(x => x.ok),
      extract: G.level.extraction.pos.toArray().map(v => +v.toFixed(2))
    };
    window.__SX.applyMission(0);
    G.game.start({ skipIntro: true });
    const harbor = {
      map: window.__SX.mapId(),
      boxes: G.physics.boxes.length,
      valid: window.__SX.validateObjectives().every(x => x.ok)
    };
    return { maps, depot, harbor };
  });
  ok('V15 地图注册与切换', map.maps.includes('depot') && map.depot.map === 'depot' && map.harbor.map === 'harbor', JSON.stringify(map));
  ok('V15 冷库关可进入且可达', map.depot.obj === 3 && map.depot.valid && Math.abs(map.depot.start[0]) < 1 && Math.abs(map.depot.start[2] - 13.6) < 1, JSON.stringify(map.depot));
  ok('V15 返回港区恢复碰撞', map.harbor.boxes > 500 && map.harbor.valid, JSON.stringify(map.harbor));
  await page.close();
}

'''
s3=s3.replace(marker, section+marker,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('suite V15 added')
