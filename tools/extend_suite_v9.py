
import io
p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()

old='''const versions = [
  ['V2', 'v2', 2], ['V3', 'v3', 2], ['V4', 'v4', 2], ['V5', 'v5', 3], ['V6', 'v6', 3], ['V7', 'v7', 3], ['V8', 'v8', 3]
];
for (const [name, prof, weapons] of versions) {
  const file = prof === 'v8' ? 'game.html' : 'versions/' + encodeURIComponent('几猫_' + name) + '.html';'''
new='''const versions = [
  ['V2', 'v2', 2], ['V3', 'v3', 2], ['V4', 'v4', 2], ['V5', 'v5', 3], ['V6', 'v6', 3], ['V7', 'v7', 3], ['V8', 'v8', 3], ['V9', 'v9', 3]
];
for (const [name, prof, weapons] of versions) {
  const file = prof === 'v9' ? 'game.html' : 'versions/' + encodeURIComponent('几猫_' + name) + '.html';'''
assert s.count(old)==1
s=s.replace(old,new,1)

old2="""/* ---------- 5. V8 军械库 ---------- */
{
  const { page, click } = await openPage(BASE + '/game.html?q=low&noaudio=1');"""
new2="""/* ---------- 5. V8 军械库 ---------- */
{
  const { page, click } = await openPage(BASE + '/versions/' + encodeURIComponent('几猫_V8') + '.html?q=low&noaudio=1');"""
assert s.count(old2)==1
s=s.replace(old2,new2,1)

marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 6.5 V9 难度 / 准星 / 晃动 / 性能面板 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const hasRows = await page.evaluate(() => document.querySelectorAll('[data-x-seg]').length);
  ok('V9 设置项扩展', hasRows === 3, 'segs=' + hasRows);
  const changed = await page.evaluate(() => {
    const S = window.__SX, G = S.G;
    document.querySelector('[data-x-seg="difficulty"] button[data-v="nightmare"]').click();
    document.querySelector('[data-x-seg="cross"] button[data-v="cyan"]').click();
    document.querySelector('[data-x-seg="shake"] button[data-v="high"]').click();
    G.player.armor = 0; G.player.health = 100;
    G.player.damage(10, null);
    return {
      diff: S.S.diffDamage, dmgScale: S.S.damageScale, shake: S.S.shakeScale,
      hp: G.player.health, cross: getComputedStyle(document.documentElement).getPropertyValue('--cross-col').trim(),
      saved: JSON.parse(localStorage.getItem('saltline.access.v1') || '{}')
    };
  });
  ok('V9 难度影响受伤', changed.diff === 1.6 && changed.hp === 84, JSON.stringify(changed));
  ok('V9 准星颜色', changed.cross.toLowerCase() === '#8fd8ff', changed.cross);
  ok('V9 镜头晃动', changed.shake === 1.6, String(changed.shake));
  ok('V9 设置持久化写入', changed.saved && changed.saved.difficulty === 'nightmare', JSON.stringify(changed.saved));
  await page.keyboard.press('F3');
  await page.waitForTimeout(1200);
  const perf = await page.evaluate(() => ({
    on: document.querySelector('.x-perf').classList.contains('on'),
    text: document.querySelector('.x-perf pre').textContent
  }));
  ok('V9 性能面板 F3', perf.on && /FPS/.test(perf.text) && /calls/.test(perf.text), perf.text.replace(/\\n/g, ' | '));
  await page.reload({ waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(900);
  const persisted = await page.evaluate(() => ({
    diff: window.__SX.S.diffDamage, shake: window.__SX.S.shakeScale,
    cross: getComputedStyle(document.documentElement).getPropertyValue('--cross-col').trim()
  }));
  ok('V9 设置刷新后保留', persisted.diff === 1.6 && persisted.shake === 1.6 && persisted.cross.toLowerCase() === '#8fd8ff', JSON.stringify(persisted));
  await page.evaluate(() => {
    document.querySelector('[data-x-seg="difficulty"] button[data-v="normal"]').click();
    document.querySelector('[data-x-seg="cross"] button[data-v="bone"]').click();
    document.querySelector('[data-x-seg="shake"] button[data-v="std"]').click();
  });
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite extended to V9')
