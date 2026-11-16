
import io
p='src/game.js'
s=io.open(p,encoding='utf-8').read()
old='''        baseAdsFov: cfg.adsFov || 0,
        scope: !!cfg.scope,'''
new='''        baseAdsFov: cfg.adsFov || 0,
        reloadT: W_,
        reloadEmptyT: G_,
        scope: !!cfg.scope,'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)

p2='src/armory.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''      w.mods.alert = m.alert;
      w.magSize = (w.baseMag || w.magSize) + m.magAdd;'''
new2='''      w.mods.alert = m.alert;
      w.mods.magAdd = m.magAdd;
      w.magSize = (w.baseMag || w.magSize) + m.magAdd;'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
old3='''      mag: (w.baseMag || w.magSize) + (mods.magAdd || 0),
      reload: (base.reloadT || 0) * (mods.reload || 1),'''
new3='''      mag: w.magSize,
      reload: (w.reloadT || base.reloadT || 0) * (mods.reload || 1),'''
assert s2.count(old3)==1
s2=s2.replace(old3,new3,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('armory stats fixed')
