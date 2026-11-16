
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''      if (m.mode === "patrol") {'''
new='''      if (m.fixed) {
        if (D && D.alive && m.los) {
          (m.mode = "engage"), (m.noSeeT = 0), (m.seeT = 3);
        }
        if (m.es === "move" || m.es === "patrol" || m.es === "investigate") {
          (m.es = "aim"), (m.esT = 0), (m.moveT = 0);
        }
        (m.hasGoal = !1), (m.maxSpeed = 0);
      }
      if (m.mode === "patrol") {'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('turret force engage patched')
