
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''    var dim = document.querySelector(".m-title .m-eyebrow .m-dim");
    if (dim) dim.textContent = "几猫港区 · 已解锁 " + camp.unlocked + "/" + MISSIONS.length;'''
new='''    var dim = document.querySelector(".m-title .m-eyebrow .m-dim");
    if (dim) dim.textContent = camp.ending ? "几猫港区 · 档案 B4-0271 已封存" : "几猫港区 · 已解锁 " + camp.unlocked + "/" + MISSIONS.length;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('ending title dim patched')

p2='tools/test_suite.mjs'
s2=io.open(p2,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s2.count(marker)==1
section='''/* ---------- 6.998 V19 终章与结局 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const finale = await page.evaluate(async () => {
    const G = window.__G;
    window.__SX.applyMission(5);
    G.game.start({ skipIntro: true });
    const start = {
      map: window.__SX.mapId(),
      start: G.player.pos.toArray().map(v => +v.toFixed(1)),
      obj: G.level.objectives.length,
      extract: G.level.extraction.pos.toArray().map(v => +v.toFixed(1))
    };
    window.__SX.god();
    window.__SX.cutAll();
    await new Promise(r => setTimeout(r, 3200));
    const b = G.enemies.list.find(e => e.boss);
    return {
      start,
      boss: b ? { hp: b.hp, max: b.maxHp, name: b.variant, bar: (document.querySelector('.x-boss-k') || {}).textContent } : null
    };
  });
  ok('V19 归途反向开局', finale.start.map === 'harbor' && finale.start.obj === 2 && Math.abs(finale.start.start[0] - 29) < 2 && Math.abs(finale.start.extract[0] + 32) < 1, JSON.stringify(finale.start));
  ok('V19 蜃·终形', !!finale.boss && finale.boss.hp === 2600 && /终形/.test(finale.boss.name || '') && /终形/.test(finale.boss.bar || ''), JSON.stringify(finale.boss));
  const cards = await page.evaluate(() => ({ missions: document.querySelectorAll('.x-mcard[data-idx]').length }));
  await page.evaluate(() => window.__SX.openMissions());
  await page.waitForTimeout(300);
  const c2 = await page.evaluate(() => document.querySelectorAll('.x-mcard[data-idx]').length);
  ok('V19 六关行动档案', c2 === 6, { before: cards.missions, after: c2 });
  await page.close();
}

'''
s2=s2.replace(marker, section+marker,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('suite V19 added')
