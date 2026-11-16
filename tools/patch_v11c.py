
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
old='''    q(".x-br-diff").textContent = "难度 · " + ((DIFFICULTY[access.difficulty] || DIFFICULTY.normal).label);'''
new='''    q(".x-br-diff").textContent = (DIFFICULTY[access.difficulty] || DIFFICULTY.normal).label;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('diff label fixed')

p2='tools/test_suite.mjs'
s2=io.open(p2,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s2.count(marker)==1
section='''/* ---------- 6.9 V11 行动简报与节拍 ---------- */
{
  const { page, click } = await openPage(BASE + '/game.html?q=low&noaudio=1');
  await page.evaluate(() => window.__SX.unlockAll());
  await click('[data-x="campaign"]');
  await page.waitForTimeout(300);
  await click('.x-mcard[data-idx="1"]');
  await page.waitForTimeout(200);
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(400);
  const brief = await page.evaluate(() => ({
    on: document.querySelector('.x-brief').classList.contains('on'),
    title: document.querySelector('.x-br-h').textContent,
    list: document.querySelectorAll('.x-br-list li').length,
    threats: document.querySelector('.x-br-threats').textContent
  }));
  ok('V11 行动简报显示', brief.on && brief.title === '仓库区' && brief.list === 3 && brief.threats.length > 0, JSON.stringify(brief));
  await click('.x-br-actions [data-x="brief-back"]');
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({ brief: document.querySelector('.x-brief').classList.contains('on'), camp: document.querySelector('.x-camp').classList.contains('on') }));
  ok('V11 简报返回', !closed.brief && closed.camp, JSON.stringify(closed));
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(300);
  await click('.x-br-actions [data-x="brief-go"]');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__G.game.start({ skipIntro: true }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__SX.god(); window.__SX.cutAll(); });
  await page.waitForTimeout(2500);
  const hold = await page.evaluate(() => ({
    state: window.__G.game.state, evac: window.__G.game.run.evacT,
    all: window.__G.game.run.allCut, obj: document.querySelector('.h-obj-t').textContent
  }));
  ok('V11 撤离坚守节拍', hold.state === 'playing' && hold.all && hold.evac > 40 && hold.obj.indexOf('坚守') >= 0, JSON.stringify(hold));
  await page.evaluate(() => { window.__G.game.run.evacT = 0.01; });
  await page.waitForTimeout(2000);
  const opened = await page.evaluate(() => ({
    evac: window.__G.game.run.evacT,
    obj: document.querySelector('.h-obj-t').textContent,
    markers: document.querySelectorAll('.h-wm').length
  }));
  ok('V11 撤离窗口开启', opened.evac === 0 && opened.markers >= 1, JSON.stringify(opened));
  await page.evaluate(() => { const G = window.__G, e = G.level.extraction.pos; G.player.pos.set(e.x, e.y, e.z); });
  await page.waitForTimeout(4000);
  const done = await page.evaluate(() => window.__G.game.state);
  ok('V11 坚守后撤离完成', done === 'complete', done);
  await page.close();
}

/* ---------- 6.95 V11 BOSS 后登船窗口 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  await page.evaluate(() => window.__SX.launchFast(2));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__SX.god(); window.__SX.cutAll(); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const G = window.__G, b = G.enemies.list.find(e => e.boss);
    if (b) b.damage(99999, b.pos, new G.THREE.Vector3(0, 0, 1), 'weak');
  });
  await page.waitForTimeout(2500);
  const esc = await page.evaluate(() => ({
    state: window.__G.game.state,
    bossAlive: window.__G.game.run.bossAlive,
    evac: window.__G.game.run.evacT,
    obj: document.querySelector('.h-obj-t').textContent
  }));
  ok('V11 BOSS 后登船窗口', esc.bossAlive === false && esc.evac > 20 && esc.state === 'playing', JSON.stringify(esc));
  await page.close();
}

'''
s2=s2.replace(marker, section+marker,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('suite extended with V11')
