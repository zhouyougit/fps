
import io
p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 6.999 V24 叙事包装 ---------- */
{
  const { page, click } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  await page.evaluate(() => { window.__SX.unlockAll(); window.__SX.openMissions(); });
  await page.waitForTimeout(400);
  const chapters = await page.evaluate(() => [...document.querySelectorAll('.x-mcard .code')].map(x => x.textContent));
  ok('V24 章节化行动卡', chapters.some(x => x.includes('第一幕')) && chapters.some(x => x.includes('第三幕')), chapters);
  await click('[data-x="archive"]');
  await page.waitForTimeout(300);
  const arch = await page.evaluate(() => ({ on: document.querySelector('.x-archive').classList.contains('on'), rows: document.querySelectorAll('.x-ar-row').length }));
  ok('V24 剧情档案', arch.on && arch.rows === 6, JSON.stringify(arch));
  await page.evaluate(() => { document.querySelector('.x-ar-actions [data-ar-back]').click(); window.__SX.interlude(0, 1); });
  await page.waitForTimeout(300);
  const int = await page.evaluate(() => ({ on: document.querySelector('.x-interlude').classList.contains('on'), title: document.querySelector('[data-int-h]').textContent, lines: document.querySelectorAll('.x-int-lines p').length }));
  ok('V24 关间过场', int.on && int.title === '仓库区' && int.lines === 2, JSON.stringify(int));
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite v24 added')
