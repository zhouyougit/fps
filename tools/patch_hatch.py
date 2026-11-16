
import io
p='src/map_ship.js'
s=io.open(p,encoding='utf-8').read()
old='''      // cargo hatch
      K.box(0, 0.42, 0, 16, 0.2, 7.4, yellow, { surface: "metal" });
      K.box(0, 0.06, -3.9, 16.4, 0.1, 0.18, steel, { surface: "metal", noNav: true });
      K.box(0, 0.06, 3.9, 16.4, 0.1, 0.18, steel, { surface: "metal", noNav: true });'''
new='''      // cargo hatch (dark steel with yellow safety border)
      K.box(0, 0.42, 0, 15.6, 0.22, 7.0, K.mat("steel_painted", 0x4a5052), { surface: "metal" });
      K.box(0, 0.55, -3.55, 15.8, 0.06, 0.16, yellow, { surface: "metal", noNav: true });
      K.box(0, 0.55, 3.55, 15.8, 0.06, 0.16, yellow, { surface: "metal", noNav: true });
      K.box(-7.9, 0.55, 0, 0.16, 0.06, 7.1, yellow, { surface: "metal", noNav: true });
      K.box(7.9, 0.55, 0, 0.16, 0.06, 7.1, yellow, { surface: "metal", noNav: true });'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('hatch polish patched')
