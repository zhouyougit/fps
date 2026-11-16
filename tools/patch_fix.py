
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''    try { G.enemies.clear(); } catch (e) {}
    try { G.game.run.queue.length = 0; G.game.run.waveHot = 0; } catch (e) {}'''
new='''    try { G.enemies.clear(); } catch (e) {}
    try { G.game.run.queue.length = 0; G.game.run.waveHot = 0; } catch (e) {}
    // 检查点复活若发生在 BOSS 战：重置并重新投放 BOSS，避免目标卡死
    if (G.game.run && G.game.run.bossAlive) {
      try {
        G.game.run.bossAlive = false;
        if (typeof bossRef !== "undefined") bossRef = null;
        if (typeof bossBar !== "undefined" && bossBar) bossBar.el.classList.remove("on");
        setTimeout(function () { if (G.game.state === "playing") startBossEncounter(); }, 2500);
      } catch (e) {}
    }'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/campaign.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''  function launchMission(idx) {
    if (idx < 0 || idx >= MISSIONS.length || idx >= camp.unlocked) return;
    applyMission(idx);'''
new2='''  function launchMission(idx) {
    if (idx < 0 || idx >= MISSIONS.length || idx >= camp.unlocked) return;
    S.checkpoint = null;
    if (typeof bossRef !== "undefined") bossRef = null;
    applyMission(idx);'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('boss revive + checkpoint reset patched')
