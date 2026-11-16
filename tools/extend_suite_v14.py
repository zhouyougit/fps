
import io
p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 6.99 V14 可访问性与最终打磨 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const ui = await page.evaluate(() => ({
    heads: [...document.querySelectorAll('.panel-b h3')].map(x => x.textContent),
    reduce: !!document.querySelector('[data-x-reduce]'),
    toTitle: !!document.querySelector('.m-screen[data-s="paused"] [data-x="to-title"]'),
    locPE: (() => { const l = document.querySelector('.loc-card'); return l ? getComputedStyle(l).pointerEvents : null; })(),
    premise: (document.querySelector('.m-title .m-premise') || {}).textContent
  }));
  ok('V14 设置分组与辅助项', ui.heads.includes('画面与音频') && ui.heads.includes('操控') && ui.heads.includes('游戏性') && ui.reduce, JSON.stringify(ui.heads));
  const red = await page.evaluate(() => {
    document.querySelector('[data-x-reduce]').click();
    return { on: document.body.classList.contains('reduce-motion'), shake: window.__SX.S.shakeScale };
  });
  ok('V14 减少动态', red.on && red.shake <= 0.2, JSON.stringify(red));
  ok('V14 装饰层不挡点击', ui.locPE === 'none', ui.locPE);
  ok('V14 暂停返回标题与当前行动', ui.toTitle && (ui.premise || '').includes('当前行动'), JSON.stringify({ toTitle: ui.toTitle, premise: ui.premise }));
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite v14 added')
