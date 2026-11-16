
import io
p='tools/test_current.mjs'
s=io.open(p,encoding='utf-8').read()
old="ok('V18 货轮甲板可达', ship.map==='ship' && ship.obj===3 && ship.valid && ship.sea && !ship.apron && ship.boxes<120, ship);"
new="""ok('V18 货轮甲板可达', ship.map==='ship' && ship.obj===3 && ship.valid && ship.sea && !ship.apron && ship.boxes<120, ship);

const finale = await page.evaluate(()=>{
  const G=window.__G; window.__SX.applyMission(5); G.game.start({skipIntro:true});
  return {map:window.__SX.mapId(), start:G.level.playerStart.pos.toArray().map(v=>+v.toFixed(1)), obj:G.level.objectives.length, extract:G.level.extraction.pos.toArray().map(v=>+v.toFixed(1))};
});
ok('V19 归途终章', finale.map==='harbor' && finale.obj===2 && Math.abs(finale.start[0]-29)<2 && Math.abs(finale.extract[0]+32)<1, finale);"""
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('current v19 check added')
