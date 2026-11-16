
import io
p='src/map_ship.js'
s=io.open(p,encoding='utf-8').read()
old='''      // deck lights
      K.light(-14, 6.0, 4, 0xffd9a6, 110, 20);'''
new='''      // deck detail: edge stripes, winches, pipes, vents, stacked boxes
      for (var ez = -8; ez <= 8; ez += 4) {
        K.box(-25.7, 0.34, ez, 0.5, 0.02, 2.2, yellow, { surface: "metal", noNav: true });
        K.box(25.7, 0.34, ez, 0.5, 0.02, 2.2, yellow, { surface: "metal", noNav: true });
      }
      K.box(-22, 0.75, -7.4, 1.8, 0.9, 1.4, steel, { surface: "metal" });
      K.box(-22, 1.3, -7.4, 1.2, 0.3, 0.8, yellow, { surface: "metal" });
      K.box(22, 0.75, -7.4, 1.8, 0.9, 1.4, steel, { surface: "metal" });
      K.box(-25.6, 2.6, 0, 0.22, 0.22, 18, steel, { surface: "metal", noNav: true });
      K.box(25.6, 2.6, 0, 0.22, 0.22, 18, steel, { surface: "metal", noNav: true });
      K.box(-10, 1.0, -7.6, 1.2, 1.4, 0.7, steel, { surface: "metal" });
      K.box(10, 1.0, -7.6, 1.2, 1.4, 0.7, steel, { surface: "metal" });
      K.box(0, 2.1, 6.05, 2.0, 2.4, 0.12, K.mat("steel_painted", 0x2d3336), { surface: "metal", noNav: true });
      K.prop("container20", -18, 5.6, 0, 2.94);
      K.prop("container20", 18, 5.6, 0, 2.94);
      K.prop("crate_stack", -14, -8.0, 0.3, 0.32);
      K.prop("pallet_stack", 14, -8.0, 0.5, 0.32);
      K.prop("life_ring" in {} ? "life_ring" : "barrel", 22.5, -4, 0, 0.32);
      // deck lights
      K.light(-14, 6.0, 4, 0xffd9a6, 110, 20);'''
assert s.count(old)==1
s=s.replace(old,new,1)
io.open(p,'w',encoding='utf-8').write(s)
print('ship detail patched')

p2='src/map_depot.js'
s2=io.open(p2,encoding='utf-8').read()
old2='''      // ceiling lamps (emissive) + lights'''
new2='''      // ceiling ducts and wall pipes
      for (var dz = -10; dz <= 10; dz += 5) K.box(0, 6.55, dz, 50, 0.35, 0.55, "steel_beam", { surface: "metal", noNav: true });
      K.box(-25.5, 5.0, 0, 0.28, 0.28, 32, "steel_beam", { surface: "metal", noNav: true });
      K.box(25.5, 5.0, 0, 0.28, 0.28, 32, "steel_beam", { surface: "metal", noNav: true });
      K.box(-25.5, 5.3, -8, 0.5, 0.5, 4, "steel_beam", { surface: "metal", noNav: true });
      K.label("B4-0271", -25.2, 4.3, 4, 1.57, 3.4, 0.8);
      K.label("保持干燥", 25.2, 4.3, -4, -1.57, 3.4, 0.8);

      // ceiling lamps (emissive) + lights'''
assert s2.count(old2)==1
s2=s2.replace(old2,new2,1)
io.open(p2,'w',encoding='utf-8').write(s2)
print('depot detail patched')
