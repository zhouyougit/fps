
import io

p='tools/test_suite.mjs'
s=io.open(p,encoding='utf-8').read()
marker='/* ---------- 7. BOSS 流程 ---------- */'
assert s.count(marker)==1
section='''/* ---------- 6.98 V13 挑战与解锁 ---------- */
{
  const { page } = await openPage(BASE + '/game.html?q=low&noaudio=1&autostart=1&dt=0.1');
  const init = await page.evaluate(() => ({
    count: window.__SX.challenges().count,
    lime: document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled,
    gold: document.querySelector('[data-x-seg="cross"] button[data-v="gold"]').disabled,
    colors: document.querySelectorAll('[data-x-seg="cross"] button').length
  }));
  ok('V13 挑战初始锁定', init.count === 0 && init.lime && init.gold && init.colors === 6, JSON.stringify(init));
  const grant = await page.evaluate(() => {
    window.__SX.challengeGrant('m1', { time: true, head: true, clean: true });
    return {
      count: window.__SX.challenges().count,
      lime: document.querySelector('[data-x-seg="cross"] button[data-v="lime"]').disabled,
      crimson: document.querySelector('[data-x-seg="cross"] button[data-v="crimson"]').disabled,
      saved: JSON.parse(localStorage.getItem('saltline.campaign.v1') || '{}').challenges
    };
  });
  ok('V13 三挑战解锁绿色准星', grant.count === 3 && grant.lime === false && grant.crimson === true, JSON.stringify(grant));
  ok('V13 挑战进度持久化', !!(grant.saved && grant.saved.m1 && grant.saved.m1.time && grant.saved.m1.head && grant.saved.m1.clean), JSON.stringify(grant.saved));
  await page.close();
}

'''
s=s.replace(marker, section+marker,1)
io.open(p,'w',encoding='utf-8').write(s)
print('suite v13 added')

p2='CHANGELOG.md'
c=io.open(p2,encoding='utf-8').read()
v13='''# 更新日志

## V13 · 挑战与解锁（当前）
- **每关三项挑战**：限时、爆头击杀数、无死亡通关；结算时即时判定并写入存档。
- **进度可见**：行动卡片右下角显示「挑战 x/3」，行动简报列出三项挑战及完成状态，结算页展示本次完成项与解锁提示。
- **准星解锁**：完成 3 / 6 / 9 个挑战分别解锁绿色 / 红色 / 金色准星；未解锁项在设置中置灰并提示所需数量，解锁后即时可用。
- **严格统计**：爆头仅统计「弱点击杀」，无死亡读取本局重试次数，限时读取本局用时；挑战只会从「未完成」变为「已完成」，不会回退。
- **存档**：挑战与最佳记录一起写入 saltline.campaign.v1。
- **测试**：自动化验收扩展到 67 项，新增挑战初始锁定、三挑战解锁准星、挑战进度持久化；另有 V13 专项 7 项端到端检查。

'''
assert c.startswith('# 更新日志\n')
c=c.replace('# 更新日志\n', v13, 1)
io.open(p2,'w',encoding='utf-8').write(c)

p3='README.md'
r=io.open(p3,encoding='utf-8').read()
r=r.replace('- **最新版**：[`几猫_V12.html`](versions/几猫_V12.html)','- **最新版**：[`几猫_V13.html`](versions/几猫_V13.html)')
r=r.replace('| **V12** | 时段与室内 | 黄昏/暴雨/黎明三套天空与光照、行动 2 仓库内开局、像素级环境验收、64 项自动化验收 |',
'''| **V12** | 时段与室内 | 黄昏/暴雨/黎明三套天空与光照、行动 2 仓库内开局、像素级环境验收、64 项自动化验收 |
| **V13** | 挑战与解锁 | 每关限时/爆头/无死亡挑战、行动卡与简报进度、准星解锁、67 项自动化验收 |''')
r=r.replace('node tools/test_suite.mjs      # 64 项完整验收（推荐）','node tools/test_suite.mjs      # 67 项完整验收（推荐）')
r=r.replace('- **三关三景**：','- **挑战与解锁**：每关 3 项挑战（限时/爆头/无死亡），完成 3/6/9 个挑战解锁绿/红/金准星。\n- **三关三景**：')
io.open(p3,'w',encoding='utf-8').write(r)
print('docs v13 updated')
