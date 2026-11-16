
import io
p='src/boss.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

rep('''    bossBar = {
      el: bar,
      fill: bar.querySelector(".x-boss-track i"),''','''    bossBar = {
      el: bar,
      title: bar.querySelector(".x-boss-k"),
      fill: bar.querySelector(".x-boss-track i"),''')
rep('''    bossRef = e;
    G.game.run.bossAlive = true;''','''    bossRef = e;
    if (m.bossHp) { e.hp = m.bossHp; e.maxHp = m.bossHp; }
    if (m.bossName && bossBar && bossBar.title) bossBar.title.textContent = m.bossName;
    else if (bossBar && bossBar.title) bossBar.title.textContent = "港区主控 · 蜃";
    if (m.bossName) e.variant = m.bossName;
    G.game.run.bossAlive = true;''')
rep('''    G.hud.warn("港区主控 · 蜃  已启动", 4);
    G.hud.radio("检测到大型机械单位！那是港区主控，打掉它的核心！", 5);''','''    G.hud.warn((m.bossName || "港区主控 · 蜃") + "  已启动", 4);
    G.hud.radio(m.bossName ? "终形展开。它把整个港区的防线接进了自己身体——打掉核心！" : "检测到大型机械单位！那是港区主控，打掉它的核心！", 5);''')
rep('''    G.hud.warn("主控核心已摧毁 · 登船窗口 25 秒", 4);
    try { G.game.run.evacT = 25; } catch (e) {}
    G.hud.radio("主控核心下线！接驳艇 25 秒后离港，立刻撤到撤离点！", 5);
    G.hud.setObjective("登船窗口 · 25 秒");''','''    var evac = m.bossEvac || 25;
    G.hud.warn("主控核心已摧毁 · 登船窗口 " + evac + " 秒", 4);
    try { G.game.run.evacT = evac; } catch (e) {}
    G.hud.radio((m.bossName ? "蜃·终形瓦解！最后 " : "主控核心下线！接驳艇 ") + evac + " 秒，撤离！", 5);
    G.hud.setObjective("登船窗口 · " + evac + " 秒");''')
# m variable in endBossEncounter? not defined; add
rep('''  function endBossEncounter() {
    if (!bossRef) return;''','''  function endBossEncounter() {
    if (!bossRef) return;
    var m = MISSIONS[camp.current] || {};''')
io.open(p,'w',encoding='utf-8').write(s)
print('boss variants patched')
