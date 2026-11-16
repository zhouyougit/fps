
import io
p='src/map_ship.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace('K.box(-26.6, 1.7, 0, 0.9, 3.4, 20, hull, { surface: "metal" });','K.box(-26.6, 0.9, 0, 0.9, 1.2, 20, hull, { surface: "metal" });',1)
s=s.replace('K.box(26.6, 1.7, 0, 0.9, 3.4, 20, hull, { surface: "metal" });','K.box(26.6, 0.9, 0, 0.9, 1.2, 20, hull, { surface: "metal" });',1)
s=s.replace('K.box(0, 1.7, 9.6, 54, 3.4, 0.9, hull, { surface: "metal" });','K.box(0, 0.9, 9.6, 54, 1.2, 0.9, hull, { surface: "metal" });',1)
s=s.replace('K.box(0, 1.7, -9.6, 46, 3.4, 0.9, hull, { surface: "metal" });','K.box(0, 0.9, -9.6, 46, 1.2, 0.9, hull, { surface: "metal" });',1)
s=s.replace('K.box(0, 0.9, -10.4, 44, 1.8, 0.8, hull, { surface: "metal" });','K.box(0, 0.45, -10.4, 44, 0.9, 0.8, hull, { surface: "metal" });',1)
io.open(p,'w',encoding='utf-8').write(s)
print('ship hull lowered')
