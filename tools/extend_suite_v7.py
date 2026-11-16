
import io
p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()
marker='/* ---------- 4. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 3.5 V7 训练场 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1');
  await page.evaluate(() => window.__SX.unlockAll());
  const click = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) return false;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    return true;
  };
  await click('[data-x="campaign"]');
  await page.waitForTimeout(300);
  const cards = await page.locator('.x-mcard').count();
  ok('V7 行动档案含训练卡', cards === 4, 'cards=' + cards);
  await click('.x-train-card');
  await page.waitForTimeout(200);
  await click('.x-camp-actions [data-x="go"]');
  await page.waitForTimeout(2000);
  const launched = await page.evaluate(() => ({
    state: window.__G.game.state,
    active: !!(window.__SX.S.training && window.__SX.S.training.active),
    targets: window.__G.enemies.list.filter(e => e.alive && e.trainTarget).length,
    inv: window.__G.player.invulnerable,
    relays: window.__G.level.objectives.length,
    hud: document.querySelector('.x-train-hud').classList.contains('on')
  }));
  ok('V7 训练场启动', launched.state === 'playing' && launched.active && launched.targets >= 5 && launched.inv && launched.relays === 0 && launched.hud, JSON.stringify(launched));

  await page.evaluate(() => { window.__G.weapon.list.forEach(w => { w.reserve = 0; }); });
  await page.waitForTimeout(1200);
  const reserves = await page.evaluate(() => window.__G.weapon.list.map(w => w.reserve));
  ok('V7 训练场无限弹药', reserves.every(r => r >= 200), JSON.stringify(reserves));

  await page.evaluate(() => { window.__SX.S.training.t = 0.01; });
  await page.waitForTimeout(1500);
  const ended = await page.evaluate(() => ({
    state: window.__G.game.state,
    result: document.querySelector('.x-train-result').classList.contains('on'),
    score: document.querySelector('.x-tr-score b').textContent
  }));
  ok('V7 训练结算面板', ended.state === 'paused' && ended.result, JSON.stringify(ended));

  await click('.x-tr-actions [data-x="again"]');
  await page.waitForTimeout(2000);
  const retried = await page.evaluate(() => ({
    state: window.__G.game.state,
    active: !!(window.__SX.S.training && window.__SX.S.training.active),
    t: window.__SX.S.training && window.__SX.S.training.t,
    result: document.querySelector('.x-train-result').classList.contains('on')
  }));
  ok('V7 训练场重开', retried.state === 'playing' && retried.active && retried.t > 80 && !retried.result, JSON.stringify(retried));

  await page.evaluate(() => { window.__SX.S.training.t = 0.01; });
  await page.waitForTimeout(1500);
  await click('.x-tr-actions [data-x="back"]');
  await page.waitForTimeout(1200);
  const backed = await page.evaluate(() => ({ state: window.__G.game.state, screen: window.__G.game.menus.screen }));
  ok('V7 训练结束返回标题', backed.state === 'title' && backed.screen === 'title', JSON.stringify(backed));

  await click('.m-title [data-act="deploy"]');
  await page.waitForTimeout(2500);
  const deploy = await page.evaluate(() => ({
    state: window.__G.game.state,
    mission: window.__G.game.currentMission && window.__G.game.currentMission.id,
    relays: window.__G.level.objectives.length,
    training: !!window.__SX.S.training
  }));
  ok('V7 训练后标题可正常开战役', deploy.mission === 'm1' && deploy.relays >= 3 && !deploy.training && deploy.state !== 'title', JSON.stringify(deploy));
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite extended with training')
