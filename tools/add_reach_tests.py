
import io
p='tools/test_current.mjs'
s=io.open(p,encoding='utf-8').read()
old="ok('V6 战术扫描', scan.marks===3 && scan.cd>13, scan);"
new="""ok('V6 战术扫描', scan.marks===3 && scan.cd>13, scan);

const reach = await page.evaluate(()=>{
  const G=window.__G, out=[];
  for(let i=0;i<3;i++){
    window.__SX.applyMission(i); G.game.start({skipIntro:true});
    const v=window.__SX.validateObjectives();
    out.push({i, ok:v.every(x=>x.ok), bad:v.filter(x=>!x.ok), relays:G.level.objectives.map(o=>({id:o.id,y:+o.pos.y.toFixed(2)}))});
  }
  return out;
});
ok('任务标志物可达', reach.every(x=>x.ok) && reach[1].relays.every(r=>r.y<2), reach);"""
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('current test reachability added')

p2='tools/test_suite.mjs'
s2=io.open(p2,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s2.count(marker)==1
section='''/* ---------- 6.995 任务标志物可达性 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const reach = await page.evaluate(() => {
    const G = window.__G, out = [];
    for (let i = 0; i < 3; i++) {
      window.__SX.applyMission(i);
      G.game.start({ skipIntro: true });
      const v = window.__SX.validateObjectives();
      out.push({
        i, ok: v.every(x => x.ok), bad: v.filter(x => !x.ok),
        relays: G.level.objectives.map(o => ({ id: o.id, y: +o.pos.y.toFixed(2) }))
      });
    }
    return out;
  });
  ok('V14 全任务标志物可达', reach.every(x => x.ok), JSON.stringify(reach));
  ok('V14 行动 2 中继不再在屋顶', reach[1].relays.every(r => r.y < 2), JSON.stringify(reach[1].relays));
  await page.close();
}

'''
s2=s2.replace(marker, section+marker,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('suite reachability added')
