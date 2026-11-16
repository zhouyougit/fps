
import io
p='src/campaign.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('locTitle: "几猫港区 · 北码头 · 黎明", locSub: "几猫突击小队 · 撤离窗口 40 秒",','locTitle: "几猫港区 · 北码头 · 黎明", locSub: "几猫突击小队 · 主控核心仍在活动",',1)
io.open(p,'w',encoding='utf-8').write(s)
p2='src/ext.js'
s2=io.open(p2,encoding='utf-8').read()
old='      launch: function (i) { camp.unlocked = Math.max(camp.unlocked, i + 1); launchMission(i); },'
new='      launch: function (i) { camp.unlocked = Math.max(camp.unlocked, i + 1); launchMission(i); },\n      launchFast: function (i) { camp.unlocked = Math.max(camp.unlocked, i + 1); applyMission(i); G.game.start({ skipIntro: true }); },'
assert s2.count(old)==1
s2=s2.replace(old,new,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('launchFast added')
