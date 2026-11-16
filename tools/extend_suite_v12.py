
import io
p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 6.97 V12 时段与天气 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const read = async (idx) => await page.evaluate((i) => {
    const G = window.__G;
    window.__SX.applyMission(i);
    G.game.start({ skipIntro: true });
    return {
      env: window.__SX.environment(),
      pos: G.player.pos.toArray().map(v => +v.toFixed(2)),
      yaw: +G.player.yaw.toFixed(2)
    };
  }, idx);
  const m0 = await read(0);
  const m1 = await read(1);
  const m2 = await read(2);
  ok('V12 三关时段环境不同',
    m1.env.sun[2] > 0.5 && m1.env.intensity < 4 && m1.env.exposure < 0.9 &&
    m2.env.sun[2] < 0 && m2.env.intensity > 6 && m0.env.intensity > 8,
    JSON.stringify({ m0: m0.env, m1: m1.env, m2: m2.env }));
  ok('V12 行动 2 从仓库内部出生',
    Math.abs(m1.pos[0] + 10) < 1 && Math.abs(m1.pos[2] + 20) < 1 && m1.pos[1] < 1,
    JSON.stringify(m1.pos));
  ok('V12 行动 1/3 从大门出生',
    Math.abs(m0.pos[0] + 32) < 1 && Math.abs(m2.pos[0] + 32) < 1,
    JSON.stringify([m0.pos, m2.pos]));
  await page.evaluate(() => { window.__SX.applyMission(0); window.__G.game.start({ skipIntro: true }); });
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite extended with V12')
