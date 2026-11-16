
import io
p='src/training.js'
s=io.open(p,encoding='utf-8').read()
old='''    tr.refillT -= dt;
    if (tr.refillT <= 0) {
      tr.refillT = 0.5;
      var w = G.weapon;
      if (w && w.list) {
        for (var i = 0; i < w.list.length; i++) {
          if (w.list[i].reserve < 200) w.list[i].reserve = 300;
        }
      }
      if (S.grenades < 4) S.grenades = 4;
    }'''
new='''    var w = G.weapon;
    if (w && w.list) {
      for (var wi = 0; wi < w.list.length; wi++) {
        if (w.list[wi].reserve < 200) w.list[wi].reserve = 300;
      }
    }
    if (S.grenades < 4) S.grenades = 4;'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('infinite ammo per-frame')
