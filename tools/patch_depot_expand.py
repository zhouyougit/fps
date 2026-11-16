
import io
p='src/map_depot.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# shell expand
rep('''      K.box(0, -0.2, 0, 52, 0.4, 34, "concrete_dirty", { surface: "concrete" });
      K.box(0, H, 0, 52, 0.3, 34, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, -17, 52, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, 17, 52, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(-26, H / 2, 0, 0.6, H, 34, "corrugated_roof", { surface: "metal" });
      K.box(26, H / 2, 0, 0.6, H, 34, "corrugated_roof", { surface: "metal" });''','''      K.box(0, -0.2, 0, 64, 0.4, 44, "concrete_dirty", { surface: "concrete" });
      K.box(0, H, 0, 64, 0.3, 44, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, -22, 64, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, 22, 64, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(-32, H / 2, 0, 0.6, H, 44, "corrugated_roof", { surface: "metal" });
      K.box(32, H / 2, 0, 0.6, H, 44, "corrugated_roof", { surface: "metal" });''')
rep('''      for (var x = -24; x <= 24; x += 6) K.box(x, H - 0.35, 0, 0.28, 0.5, 34, "steel_beam", { surface: "metal", noNav: true });
      for (var z = -14; z <= 14; z += 7) K.box(0, H - 0.62, z, 52, 0.24, 0.28, "steel_beam", { surface: "metal", noNav: true });''','''      for (var x = -30; x <= 30; x += 6) K.box(x, H - 0.35, 0, 0.28, 0.5, 44, "steel_beam", { surface: "metal", noNav: true });
      for (var z = -19; z <= 19; z += 7) K.box(0, H - 0.62, z, 64, 0.24, 0.28, "steel_beam", { surface: "metal", noNav: true });''')
rep('''      for (var ax = -21; ax <= 21; ax += 12) {
        var line = new T.Mesh(new T.BoxGeometry(0.14, 0.02, 30), paint);''','''      for (var ax = -27; ax <= 27; ax += 12) {
        var line = new T.Mesh(new T.BoxGeometry(0.14, 0.02, 40), paint);''')
rep('''      for (var sx = -18; sx <= 18; sx += 12) {
        for (var sz = -11; sz <= 11; sz += 5.5) {''','''      for (var sx = -24; sx <= 24; sx += 12) {
        for (var sz = -16; sz <= 16; sz += 5.5) {''')
# containers
rep('''      K.prop("container20", -20, -14.9, 0, 0);
      K.prop("container20", -8, -15.1, 0.38, 0);
      K.prop("container20", 20, -14.9, -0.1, 0);
      K.prop("container40", -21.5, 15.2, -0.35, 0, { noCover: true });''','''      K.prop("container20", -26, -20.1, 0, 0);
      K.prop("container20", -14, -20.3, 0.38, 0);
      K.prop("container20", 14, -20.1, 0.1, 0);
      K.prop("container20", 26, -20.2, -0.1, 0);
      K.prop("container40", -27.5, 20.1, -0.35, 0, { noCover: true });
      K.prop("container40", 27.5, 20.1, 0.35, 0, { noCover: true });''')
# catwalk/stair positions
rep('''      for (var cz = -8; cz <= 8; cz += 3.1) {
        K.prop("catwalk", -23.2, cz, 1.57, 3.3, { noNav: true, noCover: true });
        K.box(-22.2, 3.55, cz, 0.08, 0.08, 3.1, "steel_beam", { surface: "metal", noNav: true });
      }
      K.prop("stairs_metal", -21.4, 11.6, 0, 0, { noNav: true, noCover: true });
      K.box(-23.2, 3.3, -8, 0.16, 0.9, 0.16, "steel_beam", { surface: "metal", noNav: true });''','''      for (var cz = -12; cz <= 12; cz += 3.1) {
        K.prop("catwalk", -29.2, cz, 1.57, 3.3, { noNav: true, noCover: true });
        K.box(-28.2, 3.55, cz, 0.08, 0.08, 3.1, "steel_beam", { surface: "metal", noNav: true });
      }
      K.prop("stairs_metal", -27.4, 16.6, 0, 0, { noNav: true, noCover: true });
      K.box(-29.2, 3.3, -12, 0.16, 0.9, 0.16, "steel_beam", { surface: "metal", noNav: true });''')
# ducts
rep('''      for (var dz = -10; dz <= 10; dz += 5) K.box(0, 6.55, dz, 50, 0.35, 0.55, "steel_beam", { surface: "metal", noNav: true });
      K.box(-25.5, 5.0, 0, 0.28, 0.28, 32, "steel_beam", { surface: "metal", noNav: true });
      K.box(25.5, 5.0, 0, 0.28, 0.28, 32, "steel_beam", { surface: "metal", noNav: true });
      K.box(-25.5, 5.3, -8, 0.5, 0.5, 4, "steel_beam", { surface: "metal", noNav: true });
      K.label("B4-0271", -25.2, 4.3, 4, 1.57, 3.4, 0.8);
      K.label("保持干燥", 25.2, 4.3, -4, -1.57, 3.4, 0.8);''','''      for (var dz = -16; dz <= 16; dz += 5) K.box(0, 6.55, dz, 62, 0.35, 0.55, "steel_beam", { surface: "metal", noNav: true });
      K.box(-31.5, 5.0, 0, 0.28, 0.28, 42, "steel_beam", { surface: "metal", noNav: true });
      K.box(31.5, 5.0, 0, 0.28, 0.28, 42, "steel_beam", { surface: "metal", noNav: true });
      K.box(-31.5, 5.3, -10, 0.5, 0.5, 6, "steel_beam", { surface: "metal", noNav: true });
      K.label("B4-0271", -31.2, 4.3, 6, 1.57, 3.4, 0.8);
      K.label("保持干燥", 31.2, 4.3, -6, -1.57, 3.4, 0.8);''')
# lamps
rep('''      var lampPos = [[-16, -8], [0, -8], [16, -8], [-12, 6], [6, 6], [18, 4]];''','''      var lampPos = [[-22, -12], [-8, -12], [8, -12], [22, -12], [-18, 8], [-2, 8], [14, 8], [26, 4], [-6, 18], [18, 18]];''')
# wall labels
rep('''      K.label("B4-0271 · 冷链仓库", 0, 4.2, -16.2, 0, 7.4, 1.35);
      K.label("冷库 A", -22.6, 3.1, -5, 1.57, 3.6, 0.9);
      K.label("冷库 B", 22.6, 3.1, 2, -1.57, 3.6, 0.9);
      K.label("7 号货位", 0, 3.2, 16.4, 3.14, 4.2, 1.05);''','''      K.label("B4-0271 · 冷链仓库", 0, 4.2, -21.2, 0, 8.4, 1.35);
      K.label("冷库 A", -28.6, 3.1, -6, 1.57, 3.6, 0.9);
      K.label("冷库 B", 28.6, 3.1, 4, -1.57, 3.6, 0.9);
      K.label("7 号货位", 0, 3.2, 21.4, 3.14, 4.6, 1.05);''')
# add new annex/mezzanine/conveyor before relays
rep('''      // relays + extraction''','''      // east mezzanine / office
      K.box(28, 3.7, 0, 7.2, 0.3, 20, "steel_beam", { surface: "metal" });
      for (var mz = -8; mz <= 8; mz += 4) K.box(31.4, 4.2, mz, 0.12, 0.9, 0.12, "steel_beam", { surface: "metal", noNav: true });
      K.prop("catwalk", 24.8, 0, 1.57, 3.7, { noNav: true, noCover: true });
      K.prop("stairs_metal", 25.2, 10.2, 0, 0, { noNav: true, noCover: true });
      K.box(28, 5.2, 8.6, 7.0, 3.0, 0.3, "corrugated_roof", { surface: "metal" });
      K.box(31.5, 5.2, 4.2, 0.3, 3.0, 8.6, "corrugated_roof", { surface: "metal" });
      K.label("调度室", 27.8, 5.0, 8.2, 0, 3.0, 0.7);
      K.light(28, 5.6, 2, 0xffd9a6, 70, 14);
      // north cold dock + conveyor
      K.box(0, 0.02, 19.6, 18, 0.06, 3.0, "concrete_dirty", { surface: "concrete" });
      for (var cx = -9; cx <= 9; cx += 3) K.box(cx, 1.05, 19.6, 0.2, 0.16, 0.9, "steel_beam", { surface: "metal" });
      K.prop("conveyor", 0, 19.2, 0, 0);
      K.prop("ibc_tote", -24, 18, 0.4, 0);
      K.prop("ibc_tote", 24, 17, -0.3, 0);
      K.prop("pallet_stack", -28, -2, 0.2, 0);
      K.prop("crate_stack", -28, 2, 0.4, 0);
      K.prop("barrel", 30, -16, 0, 0);
      K.prop("barrel", 29.1, -15.2, 0, 0);
      K.prop("cardboard_boxes", 26, 16, 0.5, 0);
      K.light(-26, 4.8, 18, 0xffd9a6, 50, 14);
      K.light(26, 4.8, -18, 0xffd9a6, 50, 14);

      // relays + extraction''')
# spawns/interior
rep('''        enemySpawns: [
          [-18, -7], [-6, -10], [6, -10], [18, -7], [-18, 3], [-6, 4], [6, 2], [18, 6], [-12, -14], [12, -14]
        ].map(function (p) { return { pos: new T.Vector3(p[0], 0.03, p[1]), type: "ground", zone: "depot" }; }),
        interior: { min: new T.Vector3(-25.7, 0, -16.7), max: new T.Vector3(25.7, H, 16.7) },''','''        enemySpawns: [
          [-22, -7], [-8, -10], [8, -10], [22, -7], [-22, 3], [-8, 4], [8, 2], [22, 6], [-16, -16], [16, -16], [-27, 17], [27, 18], [0, 12], [0, 19]
        ].map(function (p) { return { pos: new T.Vector3(p[0], 0.03, p[1]), type: "ground", zone: "depot" }; }),
        interior: { min: new T.Vector3(-31.7, 0, -21.7), max: new T.Vector3(31.7, H, 21.7) },''')
io.open(p,'w',encoding='utf-8').write(s)
print('depot expanded')
