
import io
p='src/ext.js'
s=io.open(p,encoding='utf-8').read()
old='''          var m = G.game.currentMission;
          G.hud.message((m ? "行动 " + m.code + " · " + m.name : "") + "  |  1/2 切换武器 · G 手雷 · V 近战", 5);'''
new='''          var m = G.game.currentMission;
          var label = m && m.id === "train" ? "训练 · 靶场" : m ? "行动 " + (m.code || "") + " · " + (m.name || "") : "";
          G.hud.message((label ? label + "  |  " : "") + "1/2 切换武器 · G 手雷 · V 近战", 5);'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/training.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''    e.trainTarget = true;
    e.hp = 1;'''
new2='''    e.trainTarget = true;
    e.variant = "target";
    e.hp = 1;'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
s2=s2.replace('''      id: "train", goal: "训练 · 击中靶机", extractText: "训练结束",''','''      id: "train", code: "TR", name: "训练场", goal: "训练 · 击中靶机", extractText: "训练结束",''',1)
io.open(p2,'w',encoding='utf-8').write(s2)

p3='src/game.js'
s3=io.open(p3,encoding='utf-8').read()
old3='          drone: "自爆无人机", elite: "精英猎犬", boss: "港区主控",'
new3='          drone: "自爆无人机", elite: "精英猎犬", boss: "港区主控", target: "训练靶机",'
assert s3.count(old3)==1
s3=s3.replace(old3,new3,1)
io.open(p3,'w',encoding='utf-8').write(s3)
print('training labels patched')
