
import io
p='src/onboarding.js'
s=io.open(p,encoding='utf-8').read()
old='''        var tr = !!(S.training && S.training.active);'''
new='''        var tr = !!(S.training && S.training.active) || !!(camp && camp.trainSel && G.game.currentMission && G.game.currentMission.id === "train");'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('training detection patched')
