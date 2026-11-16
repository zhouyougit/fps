
(function () {
function build(K) {
var T = K.T;
var H = 8, WH = 5.7, SH = 6.4, FLOOR = 0.4;
var X = 28, Z = 20;
var deck = K.mat("floor_epoxy", 0x3f4446);
var wall = K.mat("corrugated_roof", 0x2a2f33);
var steel = K.mat("steel_dark", 0x3c4246);
var galv = K.mat("steel_galv", 0x6b7276);
var greyp = K.mat("paint_grey", 0x5d6366);
var yellow = K.mat("paint_yellow", 0xc9a13b);
var hazard = K.mat("hazard_stripes", 0xb08a20);
var diamond = K.mat("diamond_plate", 0x5a6266);
var conc = K.mat("concrete_painted", 0x64696b);
var rust = K.mat("steel_rust", 0x7a4a30);
var glass = K.mat("glass", 0x24404a);
var red = new T.MeshStandardMaterial({ color: 0x8a2018, emissive: 0xff2a14, emissiveIntensity: 2.2, roughness: 0.4 });
var redSoft = new T.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0x8a1a10, emissiveIntensity: 0.8, roughness: 0.6 });
var white = new T.MeshStandardMaterial({ color: 0xe8e2d2, emissive: 0xffd9a6, emissiveIntensity: 2.4, roughness: 0.5 });
var cold = new T.MeshStandardMaterial({ color: 0xd9ecf4, emissive: 0xbfe4ff, emissiveIntensity: 2.8, roughness: 0.4 });
var blue = new T.MeshStandardMaterial({ color: 0x0d2b40, emissive: 0x2f92d8, emissiveIntensity: 2.6, roughness: 0.35 });
var green = new T.MeshStandardMaterial({ color: 0x0d3320, emissive: 0x35c26a, emissiveIntensity: 2.0, roughness: 0.4 });
var conduit = new T.MeshStandardMaterial({ color: 0x3d4549, roughness: 0.55, metalness: 0.7 });
var warn = new T.MeshStandardMaterial({ color: 0x4a3a10, emissive: 0xc9a13b, emissiveIntensity: 0.5, roughness: 0.65 });
var holo = new T.MeshStandardMaterial({ color: 0x0a2f36, emissive: 0x33c6d8, emissiveIntensity: 2.4, roughness: 0.25 });
var cabMat = new T.MeshStandardMaterial({ color: 0x3f4548, roughness: 0.7, metalness: 0.25 });
var screenMat = new T.MeshStandardMaterial({ color: 0x0b2a32, emissive: 0x48b6c8, emissiveIntensity: 2.2, roughness: 0.3 });
var lampMat = new T.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc777, emissiveIntensity: 3.6, roughness: 0.35 });
function deco(x, y, z, w, h, d, m, ry) {
var o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
o.position.set(x, y, z); o.rotation.y = ry || 0;
o.castShadow = true; o.receiveShadow = true; K.root.add(o); return o;
}
function tube(x, y, z, r, len, m, axis, seg) {
var o = new T.Mesh(new T.CylinderGeometry(r, r, len, seg || 10), m);
if (axis === "x") o.rotation.z = Math.PI / 2;
else if (axis === "z") o.rotation.x = Math.PI / 2;
o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; K.root.add(o); return o;
}
function wheel(x, y, z, r, m, axis) {
var o = new T.Mesh(new T.TorusGeometry(r, r * 0.16, 5, 12), m);
if (axis === "x") o.rotation.y = Math.PI / 2;
o.position.set(x, y, z); o.castShadow = true; K.root.add(o);
for (var s = 0; s < 3; s++) {
var a = s * Math.PI / 3;
deco(x, y, z, axis === "x" ? 0.06 : r * 2, 0.05, axis === "x" ? r * 2 : 0.06, m, axis === "x" ? 0 : a);
}
return o;
}
function wallRun(axis, fixed, from, to, h, thick, holes, m) {
holes = (holes || []).slice().sort(function (a, b) { return a.c - b.c; });
var cur = from;
function seg(a, b, y0, y1) {
if (b - a < 0.04 || y1 - y0 < 0.04) return;
var len = b - a, mid = (a + b) / 2, yy = (y0 + y1) / 2, hh = y1 - y0;
if (axis === "z") K.box(fixed, yy, mid, thick, hh, len, m, { surface: "metal" });
else K.box(mid, yy, fixed, len, hh, thick, m, { surface: "metal" });
}
for (var i = 0; i < holes.length; i++) {
var ho = holes[i], a = ho.c - ho.w / 2, b = ho.c + ho.w / 2;
seg(cur, a, 0, h);
seg(a, b, 0, ho.y0 || 0);
seg(a, b, ho.y1 == null ? h : ho.y1, h);
cur = b;
}
seg(cur, to, 0, h);
}
function doorTrim(axis, fixed, c, w, h) {
var d = 0.9;
if (axis === "z") {
K.box(fixed, h / 2, c - w / 2 - 0.12, d, h, 0.24, galv, { surface: "metal" });
K.box(fixed, h / 2, c + w / 2 + 0.12, d, h, 0.24, galv, { surface: "metal" });
K.box(fixed, h + 0.16, c, d, 0.32, w + 0.72, galv, { surface: "metal" });
deco(fixed, FLOOR + 0.018, c, d + 0.26, 0.02, w, hazard);
} else {
K.box(c - w / 2 - 0.12, h / 2, fixed, 0.24, h, d, galv, { surface: "metal" });
K.box(c + w / 2 + 0.12, h / 2, fixed, 0.24, h, d, galv, { surface: "metal" });
K.box(c, h + 0.16, fixed, w + 0.72, 0.32, d, galv, { surface: "metal" });
deco(c, FLOOR + 0.018, fixed, w, 0.02, d + 0.26, hazard);
}
}
function pilaster(x, z, w, d) {
K.box(x, 4, z, w, 7.9, d, steel, { surface: "metal" });
deco(x, 0.52, z, w + 0.22, 0.24, d + 0.22, yellow);
deco(x, 7.55, z, w + 0.16, 0.2, d + 0.16, galv);
}
function lamp(x, y, z, len, axis) {
deco(x, y, z, axis === "x" ? len : 0.28, 0.09, axis === "x" ? 0.28 : len, cold);
deco(x, y + 0.1, z, axis === "x" ? len + 0.18 : 0.4, 0.13, axis === "x" ? 0.4 : len + 0.18, steel);
}
function lane(x, z, w, d, m) {
deco(x, FLOOR + 0.017, z, w, 0.022, d, m);
}
function pipeRun(x, y, z, r, len, m, axis, seg) {
return tube(x, y, z, r, len, m, axis, seg || 8);
}
function flange(x, y, z, axis, r) {
tube(x, y, z, r || 0.22, 0.1, galv, axis, 10);
}
K.box(0, 0.15, 0, 38, 0.5, 26, deck, { surface: "metal" });
K.box(-23.5, 0.15, 0, 9, 0.5, 26, deck, { surface: "metal" });
K.box(23.5, 0.15, 0, 9, 0.5, 26, deck, { surface: "metal" });
K.box(0, 0.15, 16.5, 56, 0.5, 7, deck, { surface: "metal" });
K.box(0, 0.15, -16.5, 56, 0.5, 7, deck, { surface: "metal" });
K.box(0, H, 0, 38, 0.3, 26, wall, { surface: "metal" });
K.box(-23.5, WH, 0, 9.4, 0.3, 26.4, wall, { surface: "metal" });
K.box(23.5, WH, 0, 9.4, 0.3, 26.4, wall, { surface: "metal" });
K.box(0, H, 16.5, 56, 0.3, 7.4, wall, { surface: "metal" });
K.box(0, SH, -16.5, 56, 0.3, 7.4, wall, { surface: "metal" });
wallRun("z", -27.7, -20, 20, H, 0.6, [{ c: -6, w: 3.0, y1: 3.4 }, { c: 0, w: 3.0, y1: 3.4 }, { c: 6, w: 3.0, y1: 3.4 }], conc);
wallRun("z", 27.7, -20, 20, H, 0.6, [{ c: -6, w: 3.0, y1: 3.4 }, { c: 0, w: 3.0, y1: 3.4 }, { c: 6, w: 3.0, y1: 3.4 }], conc);
wallRun("x", -19.7, -28, 28, H, 0.6, [{ c: -12, w: 3.0, y1: 3.4 }, { c: 0, w: 3.0, y1: 3.4 }, { c: 12, w: 3.0, y1: 3.4 }], wall);
wallRun("x", 19.7, -28, 28, H, 0.6, [{ c: -12, w: 3.0, y1: 3.4 }, { c: 0, w: 3.0, y1: 3.4 }, { c: 12, w: 3.0, y1: 3.4 }], wall);
for (var dz2 = -6; dz2 <= 6; dz2 += 6) { doorTrim("z", -27.7, dz2, 3.0, 3.4); doorTrim("z", 27.7, dz2, 3.0, 3.4); }
for (var dx2 = -12; dx2 <= 12; dx2 += 12) { doorTrim("x", -19.7, dx2, 3.0, 3.4); doorTrim("x", 19.7, dx2, 3.0, 3.4); }
deco(0, 0.75, 12.62, 54.6, 0.7, 0.16, greyp);
deco(0, 0.75, -12.62, 54.6, 0.7, 0.16, greyp);
deco(18.62, 0.75, 0, 0.16, 0.7, 25.4, greyp);
deco(-18.62, 0.75, 0, 0.16, 0.7, 25.4, greyp);
var wseg = [[-13.4, 11.8], [-3, 3], [3, 3], [13.4, 11.8]];
for (var wi3 = 0; wi3 < 4; wi3++) {
deco(-27.34, 1.55, wseg[wi3][0], 0.1, 2.3, wseg[wi3][1], greyp);
deco(27.34, 1.55, wseg[wi3][0], 0.1, 2.3, wseg[wi3][1], greyp);
deco(wseg[wi3][0], 1.55, 19.34, wseg[wi3][1], 2.3, 0.1, greyp);
deco(wseg[wi3][0], 1.55, -19.34, wseg[wi3][1], 2.3, 0.1, greyp);
}
deco(-19.36, 1.55, 0, 0.1, 2.3, 25.4, greyp);
deco(19.36, 1.55, 0, 0.1, 2.3, 25.4, greyp);
for (var ws = -21; ws <= 21; ws += 6) {
deco(-27.27, 1.55, ws, 0.05, 2.3, 0.12, steel);
deco(27.27, 1.55, ws, 0.05, 2.3, 0.12, steel);
}
for (var wn = -21; wn <= 21; wn += 6) {
deco(wn, 1.55, -19.27, 0.12, 2.3, 0.05, steel);
deco(wn, 1.55, 19.27, 0.12, 2.3, 0.05, steel);
}
wallRun("z", -19, -13, 13, H, 0.6, [{ c: 0, w: 4.0, y1: 3.6 }, { c: -8.6, w: 2.6, y1: 3.2 }], conc);
wallRun("z", 19, -13, 13, H, 0.6, [{ c: 0, w: 4.0, y1: 3.6 }, { c: 8.6, w: 2.6, y1: 3.2 }], conc);
wallRun("x", 13, -28, 28, 4.55, 0.6, [{ c: 0, w: 6.0, y1: 3.8 }, { c: -23.5, w: 2.6, y1: 3.2 }, { c: 23.5, w: 2.6, y1: 3.2 }], wall);
K.box(-19.25, 5.55, 13, 17.5, 2.1, 0.62, wall, { surface: "metal" });
K.box(19.25, 5.55, 13, 17.5, 2.1, 0.62, wall, { surface: "metal" });
for (var wm = 0; wm < 5; wm++) K.box(-10.5 + wm * 5.25, 5.55, 13, 0.22, 2.2, 0.72, galv, { surface: "metal" });
for (var wp = 0; wp < 4; wp++) {
deco(-7.875 + wp * 5.25, 5.55, 13, 5.0, 1.95, 0.08, glass);
deco(-7.875 + wp * 5.25, 4.58, 13.02, 5.1, 0.16, 0.86, galv);
}
K.box(0, 7.3, 13, 56, 1.4, 0.62, wall, { surface: "metal" });
wallRun("x", -13, -28, 28, H, 0.6, [{ c: 0, w: 6.0, y1: 3.8 }, { c: -23.5, w: 2.6, y1: 3.2 }, { c: 23.5, w: 2.6, y1: 3.2 }], wall);
doorTrim("z", -19, 0, 4.0, 3.6);
doorTrim("z", -19, -8.6, 2.6, 3.2);
doorTrim("z", 19, 0, 4.0, 3.6);
doorTrim("z", 19, 8.6, 2.6, 3.2);
doorTrim("x", 13, 0, 6.0, 3.8);
doorTrim("x", 13, -23.5, 2.6, 3.2);
doorTrim("x", 13, 23.5, 2.6, 3.2);
doorTrim("x", -13, 0, 6.0, 3.8);
doorTrim("x", -13, -23.5, 2.6, 3.2);
doorTrim("x", -13, 23.5, 2.6, 3.2);
for (var pz = -18; pz <= 18; pz += 4.5) {
deco(-27.16, 4, pz, 0.36, 7.8, 0.5, steel);
deco(27.16, 4, pz, 0.36, 7.8, 0.5, steel);
}
for (var px = -26; px <= 26; px += 4.4) {
deco(px, 4, -19.16, 0.5, 7.8, 0.36, steel);
deco(px, 4, 19.16, 0.5, 7.8, 0.36, steel);
}
for (var cz = -12.4; cz <= 12.4; cz += 6.2) {
K.box(-18.4, 4, cz, 0.46, 7.9, 0.46, steel, { surface: "metal" });
K.box(18.4, 4, cz, 0.46, 7.9, 0.46, steel, { surface: "metal" });
}
K.box(-13.6, 4, 15.4, 0.44, 7.9, 0.44, steel, { surface: "metal" });
K.box(13.6, 4, 15.4, 0.44, 7.9, 0.44, steel, { surface: "metal" });
K.box(-13.6, 4, -15.4, 0.44, 7.9, 0.44, steel, { surface: "metal" });
K.box(13.6, 4, -15.4, 0.44, 7.9, 0.44, steel, { surface: "metal" });
for (var bx = -15; bx <= 15; bx += 7.5) K.box(bx, H - 0.35, 0, 0.3, 0.5, 26, steel, { surface: "metal", noNav: true });
for (var wz = -12; wz <= 12; wz += 4) {
deco(-23.5, WH - 0.28, wz, 9.4, 0.32, 0.26, steel);
deco(23.5, WH - 0.28, wz, 9.4, 0.32, 0.26, steel);
}
for (var nx = -26; nx <= 26; nx += 6.5) deco(nx, H - 0.3, 16.5, 0.28, 0.34, 7.2, steel);
for (var sx2 = -26; sx2 <= 26; sx2 += 6.5) deco(sx2, SH - 0.28, -16.5, 0.28, 0.32, 7.2, steel);
pipeRun(0, 7.15, 5.6, 0.12, 24, galv, "x", 10);
pipeRun(0, 7.15, -5.6, 0.12, 24, galv, "x", 10);
pipeRun(5.6, 7.15, 0, 0.12, 10.6, galv, "z", 10);
pipeRun(-5.6, 7.15, 0, 0.12, 10.6, galv, "z", 10);
for (var fz = -8; fz <= 8; fz += 4) {
flange(-8, 7.15, fz, "z", 0.17);
flange(8, 7.15, fz, "z", 0.17);
}
deco(-18.55, 5.5, 0, 0.5, 0.1, 24.4, galv);
deco(18.55, 5.5, 0, 0.5, 0.1, 24.4, galv);
deco(-18.55, 5.62, -11.9, 0.5, 0.16, 0.16, galv);
deco(18.55, 5.62, 11.9, 0.5, 0.16, 0.16, galv);
for (var tz = -10; tz <= 10; tz += 5) {
deco(-18.52, 5.72, tz, 0.12, 0.34, 0.12, steel);
deco(18.52, 5.72, tz, 0.12, 0.34, 0.12, steel);
}
for (var wi = 0; wi < 3; wi++) {
pipeRun(-27.1, 1.35 + wi * 0.78, 0, 0.13 + wi * 0.02, 24.6, wi === 1 ? rust : galv, "z", 9);
}
for (var wf = -10; wf <= 10; wf += 3.4) {
flange(-27.1, 1.35, wf, "z", 0.2);
flange(-27.1, 2.13, wf, "z", 0.22);
flange(-27.1, 2.91, wf, "z", 0.24);
}
deco(-25.9, 4.6, 0, 1.15, 0.7, 22, galv);
for (var wd = -9; wd <= 9; wd += 3) deco(-25.9, 4.6, wd, 1.28, 0.78, 0.16, steel);
deco(26.0, 4.55, 0, 1.2, 0.72, 22, galv);
for (var ed = -9; ed <= 9; ed += 3) deco(26.0, 4.55, ed, 1.32, 0.8, 0.16, steel);
for (var bb = 0; bb < 3; bb++) pipeRun(24.0 + bb * 0.55, 3.55, 0, 0.09, 23, conduit, "z", 8);
deco(0, 7.05, 18.7, 50, 0.8, 1.15, galv);
for (var nd = -22; nd <= 22; nd += 5.5) deco(nd, 7.05, 18.7, 0.18, 0.9, 1.28, steel);
deco(0, 6.62, 17.3, 52, 0.12, 0.42, galv);
deco(0, 5.5, -18.6, 42, 0.62, 0.9, galv);
pipeRun(0, 4.55, -14.0, 0.13, 50, conduit, "x", 9);
for (var sf = -20; sf <= 20; sf += 5) flange(sf, 4.55, -14.0, "x", 0.2);
function wallBoxes(axis, fixed, list, face) {
for (var i = 0; i < list.length; i++) {
var c = list[i];
if (axis === "z") {
deco(fixed + face * 0.14, 2.6, c, 0.14, 0.9, 1.5, greyp);
deco(fixed + face * 0.22, 2.45, c, 0.06, 0.42, 0.42, blue);
deco(fixed + face * 0.2, 1.9, c, 0.12, 0.1, 1.4, steel);
} else {
deco(c, 2.6, fixed + face * 0.14, 1.5, 0.9, 0.14, greyp);
deco(c, 2.45, fixed + face * 0.22, 0.42, 0.42, 0.06, blue);
deco(c, 1.9, fixed + face * 0.2, 1.4, 0.1, 0.12, steel);
}
}
}
wallBoxes("z", -18.7, [-11.4, 6.2, 10.2], 1);
wallBoxes("z", 18.7, [11.4, -6.2, -10.2], -1);
wallBoxes("x", 12.7, [-11, 11], -1);
wallBoxes("x", -12.7, [-11, 11], 1);
lane(-2.7, 0, 0.16, 24.6, yellow);
lane(2.7, 0, 0.16, 24.6, yellow);
deco(-16.2, FLOOR + 0.009, 0, 0.42, 0.018, 24.4, conduit);
deco(16.2, FLOOR + 0.009, 0, 0.42, 0.018, 24.4, conduit);
deco(0, FLOOR + 0.009, 11.9, 36, 0.018, 0.36, conduit);
deco(0, FLOOR + 0.009, -11.9, 36, 0.018, 0.36, conduit);
for (var gz = -11; gz <= 11; gz += 1.1) {
deco(-16.2, FLOOR + 0.02, gz, 0.42, 0.014, 0.12, galv);
deco(16.2, FLOOR + 0.02, gz, 0.42, 0.014, 0.12, galv);
}
deco(-23.5, FLOOR + 0.012, 0, 1.9, 0.02, 24, steel);
deco(23.5, FLOOR + 0.012, 0, 1.9, 0.02, 24, steel);
for (var grz = -11.4; grz <= 11.4; grz += 1.2) {
deco(-23.5, FLOOR + 0.024, grz, 1.94, 0.014, 0.1, galv);
deco(23.5, FLOOR + 0.024, grz, 1.94, 0.014, 0.1, galv);
}
lane(-23.5, 0, 0.14, 24, yellow);
lane(23.5, 0, 0.14, 24, yellow);
lane(0, 16.5, 54, 0.14, yellow);
lane(0, -16.5, 54, 0.14, yellow);
deco(0, FLOOR + 0.012, -15.0, 12, 0.02, 2.4, diamond);
deco(0, FLOOR + 0.012, -18.4, 26, 0.02, 1.2, diamond);
deco(-27.18, 3.45, 0, 0.08, 0.14, 20, cold);
deco(27.18, 3.45, 0, 0.08, 0.14, 20, cold);
deco(0, 3.45, 19.18, 40, 0.14, 0.08, cold);
deco(0, 3.2, -19.18, 40, 0.14, 0.08, cold);
var coreMat = new T.MeshStandardMaterial({ color: 0x2a2f33, metalness: 0.8, roughness: 0.3, emissive: 0x220806, emissiveIntensity: 0.8 });
var cyl = new T.Mesh(new T.CylinderGeometry(2.6, 3.1, 6.4, 24), coreMat);
cyl.position.set(0, 3.5, 0); cyl.castShadow = true; K.root.add(cyl);
K.box(0, 3.5, 0, 6.2, 6.4, 6.2, "steel_worn", { surface: "metal" });
for (var ring = 0; ring < 3; ring++) {
var tor = new T.Mesh(new T.TorusGeometry(3.15, 0.1, 8, 32), red);
tor.rotation.x = Math.PI / 2; tor.position.y = 1.3 + ring * 1.8; K.root.add(tor);
}
var glow = new T.Mesh(new T.CylinderGeometry(0.5, 0.7, 6.0, 16), new T.MeshStandardMaterial({ color: 0xff5030, emissive: 0xff3a1c, emissiveIntensity: 5, transparent: true, opacity: 0.8 }));
glow.position.set(0, 3.5, 0); K.root.add(glow);
for (var ci = 0; ci < 4; ci++) {
var ca = ci * Math.PI / 2 + Math.PI / 4;
deco(Math.cos(ca) * 3.05, 3.2, Math.sin(ca) * 3.05, 0.62, 6.4, 0.62, steel);
deco(Math.cos(ca) * 3.1, 6.62, Math.sin(ca) * 3.1, 0.8, 0.22, 0.8, galv);
}
deco(0, 6.78, 0, 6.5, 0.26, 6.5, steel);
deco(0, 6.95, 0, 4.4, 0.3, 4.4, galv);
for (var vp = 0; vp < 4; vp++) {
var va = vp * Math.PI / 2 + 0.4;
tube(Math.cos(va) * 2.3, 7.3, Math.sin(va) * 2.3, 0.16, 1.3, galv, "y", 8);
}
// R4 · 反应堆本体：基座 / 外骨骼 / 冷却立管 / 仪表 / 检修梯 / 泵组
K.box(0, 0.52, 0, 7.6, 0.24, 7.6, conc, { surface: "metal" });
deco(0, 0.655, 3.55, 7.2, 0.02, 0.4, hazard);
deco(0, 0.655, -3.55, 7.2, 0.02, 0.4, hazard);
deco(3.55, 0.655, 0, 0.4, 0.02, 7.2, hazard);
deco(-3.55, 0.655, 0, 0.4, 0.02, 7.2, hazard);
for (var fs = 0; fs < 4; fs++) {
var fa = fs * Math.PI / 2, nx = Math.sin(fa), nz = Math.cos(fa), tx = Math.cos(fa), tz = -Math.sin(fa);
for (var vr = -1; vr <= 1; vr += 2) deco(nx * 3.16 + tx * 1.9 * vr, 3.45, nz * 3.16 + tz * 1.9 * vr, 0.34, 6.2, 0.34, steel, fa);
for (var hb = 0; hb < 4; hb++) deco(nx * 3.2, 1.15 + hb * 1.4, nz * 3.2, 5.9, 0.18, 0.14, galv, fa);
deco(nx * 3.26, 6.35, nz * 3.26, 6.1, 0.22, 0.2, steel, fa);
}
for (var cr = 0; cr < 4; cr++) {
var crx = (cr < 2 ? 1 : -1) * 3.35, crz = (cr % 2 ? 1 : -1) * 3.35;
tube(crx, 3.65, crz, 0.19, 6.1, galv, "y", 10);
for (var cf = 0; cf < 3; cf++) tube(crx, 1.35 + cf * 1.95, crz, 0.27, 0.12, steel, "y", 10);
wheel(crx + (crx > 0 ? 0.34 : -0.34), 2.55, crz + (crz > 0 ? 0.34 : -0.34), 0.3, yellow, "y");
tube(crx * 0.8, 6.55, crz * 0.8, 0.15, 1.15, rust, cr % 2 ? "x" : "z", 8);
}
// 南面检修门 + 仪表盘
deco(0, 1.75, 3.24, 1.7, 2.2, 0.1, greyp);
deco(0, 1.75, 3.3, 1.5, 2.0, 0.06, steel);
deco(0, 2.9, 3.34, 1.9, 0.16, 0.1, hazard);
wheel(0, 1.55, 3.42, 0.32, yellow, "z");
for (var gp = 0; gp < 2; gp++) {
var gpx = gp ? 2.25 : -2.25;
deco(gpx, 2.45, 3.26, 1.2, 1.35, 0.12, cabMat);
for (var gg = 0; gg < 3; gg++) {
tube(gpx - 0.34 + gg * 0.34, 2.75, 3.34, 0.11, 0.1, greyp, "z", 8);
deco(gpx - 0.34 + gg * 0.34, 2.75, 3.4, 0.12, 0.12, 0.02, gg === 1 ? green : cold);
}
deco(gpx, 2.12, 3.34, 0.4, 0.3, 0.04, screenMat);
}
// 检修梯 + 顶部桥架
for (var lr = 0; lr < 14; lr++) deco(-3.3, 0.95 + lr * 0.4, 0, 0.06, 0.06, 0.9, galv);
deco(-3.3, 3.6, 0.47, 0.08, 6.0, 0.08, galv);
deco(-3.3, 3.6, -0.47, 0.08, 6.0, 0.08, galv);
deco(0, 6.62, 3.28, 5.6, 0.12, 0.9, galv);
for (var ct = -2; ct <= 2; ct += 2) deco(ct, 6.52, 3.28, 0.1, 0.34, 0.9, steel);
// 基座泵组
for (var rp = -1; rp <= 1; rp += 2) {
K.box(rp * 4.6, 0.91, rp * 4.3, 1.2, 1.02, 0.95, greyp, { surface: "metal" });
tube(rp * 4.6, 1.7, rp * 4.3, 0.13, 1.1, rust, "y", 8);
wheel(rp * 4.6 + (rp > 0 ? 0.7 : -0.7), 1.2, rp * 4.3, 0.26, yellow, "y");
deco(rp * 4.6, 0.46, rp * 4.3, 1.3, 0.14, 1.05, steel);
}
K.label("核心舱 · B4-0271", 0, 6.6, -12.4, 0, 7, 1.1);
function pumpSkid(x, z, seed) {
K.box(x, FLOOR + 0.13, z, 2.7, 0.26, 1.75, steel, { surface: "metal" });
K.box(x - 0.5, FLOOR + 0.92, z, 1.35, 1.3, 1.35, greyp, { surface: "metal" });
deco(x - 0.5, FLOOR + 1.62, z, 1.1, 0.16, 1.1, galv);
K.box(x + 0.78, FLOOR + 0.72, z, 1.05, 0.95, 1.05, galv, { surface: "metal" });
for (var fi = -2; fi <= 2; fi++) deco(x + 0.78, FLOOR + 0.72 + fi * 0.18, z + 0.55, 0.95, 0.07, 0.06, galv);
tube(x - 0.5, FLOOR + 1.95, z, 0.17, 1.5, rust, "y", 9);
pipeRun(x - 0.5, FLOOR + 2.7, z, 0.15, 4.2, galv, "z", 9);
wheel(x - 0.5, FLOOR + 2.25, z + 0.62, 0.34, yellow, "z");
pipeRun(x + 0.78, FLOOR + 1.5, z + 0.1, 0.13, 3.6, galv, "x", 8);
deco(x, FLOOR + 0.42, z, 2.3, 0.1, 0.5, hazard);
tube(x - 1.16, FLOOR + 1.45, z + 0.4, 0.13, 0.12, greyp, "x", 10);
deco(x - 1.23, FLOOR + 1.45, z + 0.4, 0.03, 0.18, 0.18, cold);
}
pumpSkid(-24.8, -5.0, 0);
pumpSkid(-24.8, 5.0, 1);
pumpSkid(-24.8, -11.0, 2);
function coolantTank(x, z) {
K.box(x, FLOOR + 1.9, z, 2.3, 3.8, 2.3, greyp, { surface: "metal" });
deco(x, FLOOR + 3.95, z, 2.0, 0.3, 2.0, galv);
deco(x, FLOOR + 0.35, z, 2.5, 0.34, 2.5, steel);
for (var lv = 0; lv < 4; lv++) deco(x + 1.16, FLOOR + 0.9 + lv * 0.66, z + 1.16, 0.5, 0.06, 0.5, steel);
deco(x - 1.16, FLOOR + 2.6, z, 0.06, 1.5, 0.34, blue);
tube(x, FLOOR + 3.2, z + 1.25, 0.13, 2.2, galv, "z", 8);
wheel(x, FLOOR + 2.2, z + 1.42, 0.3, yellow, "z");
K.label("COOLANT", x - 1.2, FLOOR + 3.1, z + 1.17, 1.57, 1.7, 0.42);
}
coolantTank(-26.4, 11.2);
coolantTank(-26.4, -11.2);
deco(-27.2, FLOOR + 1.75, 8.4, 0.5, 2.0, 1.7, cabMat);
deco(-26.93, FLOOR + 2.1, 8.4, 0.06, 0.7, 1.2, screenMat);
for (var gi = 0; gi < 4; gi++) deco(-26.93, FLOOR + 1.35, 7.85 + gi * 0.34, 0.05, 0.12, 0.12, gi % 2 ? blue : green);
tube(-27.2, FLOOR + 2.95, 8.4, 0.09, 2.2, galv, "y", 8);
deco(-27.2, FLOOR + 1.65, -2.4, 0.5, 1.9, 1.6, cabMat);
deco(-26.92, FLOOR + 1.95, -2.4, 0.06, 0.7, 1.15, screenMat);
for (var gi2 = 0; gi2 < 3; gi2++) deco(-26.92, FLOOR + 1.25, -2.9 + gi2 * 0.5, 0.05, 0.12, 0.12, gi2 === 1 ? green : blue);
deco(-27.24, FLOOR + 1.35, -6.2, 0.42, 0.9, 0.6, redSoft);
deco(-27.22, FLOOR + 1.42, -6.2, 0.06, 0.5, 0.4, red);
tube(-26.98, FLOOR + 2.75, -2.4, 0.07, 2.1, conduit, "y", 8);
tube(-26.98, FLOOR + 3.2, -3.4, 0.07, 2.0, conduit, "z", 8);
K.prop("barrel", -20.4, -3.1, 0, FLOOR);
K.prop("barrel", -20.4, -2.2, 0, FLOOR);
K.prop("gas_cylinders", -26.6, 2.6, 0.3, FLOOR);
K.prop("crate_stack", -20.4, 3.2, 0.4, FLOOR);
K.prop("cable_reel", -21.0, 10.0, 0.3, FLOOR);
K.prop("pipe_stack", -26.2, 5.9, 0.1, FLOOR);
lamp(-23.5, WH - 0.42, -8.4, 3.0, "z");
lamp(-23.5, WH - 0.42, 0.6, 3.0, "z");
lamp(-23.5, WH - 0.42, 9.0, 3.0, "z");
K.light(-24.0, 4.2, -6.5, 0x9fd8ff, 115, 18);
K.light(-24.0, 4.2, 5.5, 0xffd9a6, 95, 17);
K.box(24.6, FLOOR + 1.5, -8.6, 3.2, 2.8, 2.4, greyp, { surface: "metal" });
deco(24.6, FLOOR + 3.05, -8.6, 3.5, 0.22, 2.7, steel);
for (var rf = 0; rf < 7; rf++) {
deco(23.3 + rf * 0.42, FLOOR + 1.5, -7.15, 0.07, 2.3, 0.85, galv);
deco(23.3 + rf * 0.42, FLOOR + 1.5, -10.05, 0.07, 2.3, 0.85, galv);
}
for (var bu = 0; bu < 3; bu++) {
tube(23.9 + bu * 0.7, FLOOR + 3.5, -8.6, 0.15, 1.0, rust, "y", 9);
tube(23.9 + bu * 0.7, FLOOR + 4.0, -8.6, 0.09, 0.3, galv, "y", 8);
}
deco(24.6, FLOOR + 0.55, -8.6, 3.3, 0.3, 2.5, hazard);
for (var sg = 0; sg < 5; sg++) {
var sz = -3.6 + sg * 1.5;
K.box(26.9, FLOOR + 1.15, sz, 0.95, 2.3, 1.4, greyp, { surface: "metal" });
deco(26.36, FLOOR + 1.9, sz, 0.06, 0.16, 1.1, screenMat);
deco(26.36, FLOOR + 1.55, sz - 0.42, 0.05, 0.1, 0.1, green);
deco(26.36, FLOOR + 1.55, sz + 0.42, 0.05, 0.1, 0.1, red);
deco(26.36, FLOOR + 0.5, sz, 0.06, 0.3, 1.1, steel);
}
for (var up = 0; up < 3; up++) {
var uz = 7.2 + up * 1.6;
K.box(26.9, FLOOR + 0.95, uz, 0.95, 1.9, 1.4, cabMat, { surface: "metal" });
deco(26.36, FLOOR + 1.45, uz, 0.06, 0.5, 1.0, screenMat);
deco(26.36, FLOOR + 1.0, uz + 0.4, 0.05, 0.12, 0.12, blue);
}
for (var b2 = 0; b2 < 3; b2++) {
pipeRun(24.0, FLOOR + 3.6, -6.5 + b2 * 0.55, 0.085, 6.0, conduit, "z", 8);
flange(24.0, FLOOR + 3.6, -3.4, "z", 0.16);
}
K.box(20.2, FLOOR + 0.9, -6.4, 1.0, 1.8, 1.5, cabMat, { surface: "metal" });
deco(20.2, FLOOR + 1.55, -5.62, 0.7, 0.36, 0.06, holo);
K.prop("generator", 21.0, 10.6, 1.57, FLOOR);
K.prop("cable_reel", 20.4, 3.6, 0.6, FLOOR);
K.prop("jerry_can", 22.0, -2.4, 0, FLOOR);
K.prop("crate_stack", 20.6, 6.4, 0.3, FLOOR);
lamp(23.5, WH - 0.42, -8.4, 3.0, "z");
lamp(23.5, WH - 0.42, 0.6, 3.0, "z");
lamp(23.5, WH - 0.42, 9.0, 3.0, "z");
K.light(24.0, 4.2, -6.5, 0x8fb8ff, 115, 18);
K.light(24.0, 4.2, 5.5, 0xffd9a6, 95, 17);
for (var lk = 0; lk < 8; lk++) {
var lx = -5.0 + lk * 1.25;
K.box(lx, FLOOR + 1.0, 19.05, 1.05, 2.0, 0.55, greyp, { surface: "metal" });
deco(lx, FLOOR + 1.45, 18.75, 0.9, 0.06, 0.04, steel);
deco(lx - 0.36, FLOOR + 1.2, 18.74, 0.12, 0.12, 0.05, blue);
}
deco(0, FLOOR + 0.05, 18.4, 0.9, 0.04, 1.8, diamond);
K.box(-8.4, FLOOR + 0.26, 18.6, 2.6, 0.16, 0.7, steel, { surface: "metal" });
K.box(-8.4, FLOOR + 0.64, 18.95, 2.6, 0.62, 0.12, steel, { surface: "metal" });
K.box(-8.4, FLOOR + 0.62, 18.2, 0.12, 0.62, 0.6, steel, { surface: "metal" });
deco(-12.2, FLOOR + 1.8, 19.15, 2.8, 1.4, 0.08, cabMat);
deco(-12.2, FLOOR + 1.8, 19.08, 2.5, 1.15, 0.04, holo);
lane(0, 14.4, 26, 0.16, yellow);
lamp(-8.0, FLOOR + 0.6, 18.9, 2.4, "x");
lamp(8.0, FLOOR + 0.6, 18.9, 2.4, "x");
K.prop("crate_stack", 13.2, 17.6, 0.2, FLOOR);
K.prop("pallet_stack", -14.0, 16.9, 0.3, FLOOR);
K.prop("barrel", 15.0, 15.4, 0, FLOOR);
K.light(0, 6.6, 16.8, 0xffe0b8, 100, 20);
K.light(-16, 5.6, 15.5, 0xffd9a6, 85, 15);
K.light(16, 5.6, 15.5, 0xffd9a6, 85, 15);
K.box(-3.35, FLOOR + 2.6, -19.35, 0.55, 5.2, 0.8, steel, { surface: "metal" });
K.box(3.35, FLOOR + 2.6, -19.35, 0.55, 5.2, 0.8, steel, { surface: "metal" });
K.box(0, FLOOR + 5.0, -19.35, 7.3, 0.65, 0.8, steel, { surface: "metal" });
K.box(0, FLOOR + 4.75, -19.3, 7.0, 0.16, 0.5, hazard, { surface: "metal", noNav: true });
K.box(-1.68, FLOOR + 2.3, -19.15, 3.2, 4.6, 0.28, greyp, { surface: "metal" });
K.box(1.68, FLOOR + 2.3, -19.15, 3.2, 4.6, 0.28, greyp, { surface: "metal" });
for (var dr = 0; dr < 5; dr++) {
deco(-1.68, FLOOR + 0.7 + dr * 0.85, -18.99, 2.9, 0.12, 0.08, steel);
deco(1.68, FLOOR + 0.7 + dr * 0.85, -18.99, 2.9, 0.12, 0.08, steel);
}
deco(0, FLOOR + 0.55, -18.96, 6.5, 0.5, 0.06, hazard);
deco(-0.35, FLOOR + 2.4, -18.95, 0.7, 0.16, 0.1, galv);
deco(0.35, FLOOR + 2.4, -18.95, 0.7, 0.16, 0.1, galv);
K.box(5.3, FLOOR + 0.75, -18.4, 0.8, 1.5, 0.7, cabMat, { surface: "metal" });
deco(5.3, FLOOR + 1.32, -18.02, 0.62, 0.4, 0.06, holo, -0.35);
deco(5.3, FLOOR + 0.95, -18.02, 0.24, 0.1, 0.05, red);
K.light(3.0, 1.8, -18.6, 0xff5a30, 14, 6);
deco(0, FLOOR + 5.45, -19.2, 0.42, 0.34, 0.42, red);
tube(0, FLOOR + 5.26, -19.2, 0.06, 0.3, steel, "y", 6);
K.box(-11.0, FLOOR + 0.9, -18.2, 3.0, 1.7, 1.8, greyp, { surface: "metal" });
deco(-11.0, FLOOR + 1.85, -18.2, 2.6, 0.22, 1.5, galv);
tube(-11.0, FLOOR + 2.6, -18.2, 0.14, 2.0, rust, "y", 8);
pipeRun(-11.0, FLOOR + 3.4, -17.0, 0.14, 9.0, galv, "z", 9);
for (var af = 0; af < 4; af++) deco(-11.9 + af * 0.6, FLOOR + 0.85, -17.28, 0.1, 1.2, 0.04, steel);
deco(-9.6, FLOOR + 1.15, -18.05, 0.5, 0.5, 0.06, blue);
K.prop("crate_stack", 14.0, -17.0, 0.2, FLOOR);
K.prop("pallet_stack", -16.2, -16.6, 0.4, FLOOR);
K.prop("barrel", 8.6, -17.4, 0, FLOOR);
K.prop("barrel", 9.4, -17.0, 0, FLOOR);
K.prop("toolbox", -6.4, -15.4, 0.2, FLOOR);
K.prop("cable_reel", 17.2, -14.6, 0.3, FLOOR);
lamp(0, SH - 0.4, -16.2, 3.4, "x");
lamp(-15, SH - 0.4, -16.2, 3.4, "x");
lamp(15, SH - 0.4, -16.2, 3.4, "x");
K.light(0, 4.6, -15.8, 0xffb070, 190, 22);
K.light(-14, 4.4, -16.8, 0xffd9a6, 110, 16);
K.light(14, 4.4, -16.8, 0xffd9a6, 100, 16);
lamp(0, FLOOR + 0.35, -19.0, 3.4, "x");
lamp(0, SH - 0.45, -14.9, 6.0, "x");
K.light(0, 3.5, -14.8, 0xbfe0ff, 120, 14);
// ===== R3 · 控制室 / 设备锚点 / 冷白与蓝色光 =====
// 二层控制室：三组控制台 + 座椅 + 大屏 + 服务器柜 + UPS
for (var cp = 0; cp < 3; cp++) {
var px = -5.6 + cp * 5.6;
K.box(px, 5.18, 14.5, 2.6, 0.12, 0.95, greyp, { surface: "metal" });
K.box(px, 4.8, 14.5, 2.6, 0.68, 0.16, cabMat, { surface: "metal" });
deco(px, 4.66, 14.5, 2.4, 0.16, 0.8, steel);
for (var cs = -1; cs <= 1; cs += 2) {
deco(px + cs * 0.74, 5.56, 14.28, 1.06, 0.66, 0.07, screenMat);
deco(px + cs * 0.74, 5.24, 14.36, 0.9, 0.06, 0.5, steel);
}
deco(px, 5.22, 15.05, 1.7, 0.06, 0.24, cabMat);
deco(px - 0.55, 5.44, 14.42, 0.16, 0.3, 0.16, holo);
deco(px + 0.5, 5.26, 14.72, 0.36, 0.03, 0.26, white);
deco(px, 5.0, 15.6, 0.62, 0.12, 0.62, cabMat);
deco(px, 5.36, 15.92, 0.62, 0.72, 0.12, cabMat);
deco(px, 4.72, 15.6, 0.1, 0.54, 0.1, steel);
deco(px, 4.6, 15.6, 0.52, 0.06, 0.52, steel);
}
deco(-3.6, 6.35, 19.31, 6.2, 1.6, 0.08, screenMat, Math.PI);
deco(3.9, 6.35, 19.31, 4.2, 1.5, 0.08, holo, Math.PI);
deco(0, 7.38, 19.3, 12.0, 0.08, 0.06, cold);
for (var sc = 0; sc < 4; sc++) {
var scz = 15.2 + sc * 1.15;
K.box(-13.5, 5.38, scz, 0.9, 1.7, 1.0, cabMat, { surface: "metal" });
deco(-13.02, 5.55, scz, 0.05, 0.42, 0.7, screenMat);
deco(-13.02, 5.15, scz, 0.05, 0.1, 0.6, blue);
}
for (var uc = 0; uc < 3; uc++) {
K.box(9.5, 5.3, 16.1 + uc * 1.15, 0.85, 1.55, 0.95, greyp, { surface: "metal" });
deco(9.06, 5.45, 16.1 + uc * 1.15, 0.05, 0.4, 0.6, screenMat);
deco(9.06, 5.1, 16.1 + uc * 1.15, 0.05, 0.1, 0.5, blue);
}
for (var cl = 0; cl < 3; cl++) deco(-6 + cl * 6, 7.6, 16.3, 3.2, 0.1, 0.65, cold);
K.light(-4.5, 6.5, 16.3, 0xbfe0ff, 85, 11);
K.light(4.5, 6.5, 16.3, 0xdff0ff, 75, 11);

// R7 · 外环扩建：汽轮机厅 / 冷却塔廊 / 热交换院 / 蓄电池库（bounds ±38 / ±28）
K.box(-33, 0.15, 0, 10, 0.5, 56, deck, { surface: "metal" });
K.box(33, 0.15, 0, 10, 0.5, 56, deck, { surface: "metal" });
K.box(0, 0.15, 24, 56, 0.5, 8, deck, { surface: "metal" });
K.box(0, 0.15, -24, 56, 0.5, 8, deck, { surface: "metal" });
K.box(-33, 6.2, 0, 10.4, 0.3, 56.4, wall, { surface: "metal" });
K.box(33, 6.2, 0, 10.4, 0.3, 56.4, wall, { surface: "metal" });
K.box(0, 6.2, 24, 56, 0.3, 8.4, wall, { surface: "metal" });
K.box(0, 6.2, -24, 56, 0.3, 8.4, wall, { surface: "metal" });
K.box(-37.7, 3.35, 0, 0.6, 6.5, 56, greyp, { surface: "metal" });
K.box(37.7, 3.35, 0, 0.6, 6.5, 56, greyp, { surface: "metal" });
K.box(0, 3.35, -27.7, 76, 6.5, 0.6, greyp, { surface: "metal" });
K.box(0, 3.35, 27.7, 76, 6.5, 0.6, greyp, { surface: "metal" });
for (var wbz = -24; wbz <= 24; wbz += 6) {
K.box(-33, 5.9, wbz, 9.8, 0.3, 0.4, steel, { surface: "metal", noNav: true });
K.box(33, 5.9, wbz, 9.8, 0.3, 0.4, steel, { surface: "metal", noNav: true });
}
for (var wbx = -28; wbx <= 28; wbx += 7) {
K.box(wbx, 5.9, 24, 0.4, 0.3, 8.0, steel, { surface: "metal", noNav: true });
K.box(wbx, 5.9, -24, 0.4, 0.3, 8.0, steel, { surface: "metal", noNav: true });
}
for (var wpz = -24; wpz <= 24; wpz += 2.5) {
K.box(-37.1, 2.6, wpz, 0.14, 4.4, 0.14, steel, { surface: "metal" });
K.box(37.1, 2.6, wpz, 0.14, 4.4, 0.14, steel, { surface: "metal" });
}
for (var wpx = -36; wpx <= 36; wpx += 3) {
K.box(wpx, 2.6, -27.1, 0.14, 4.4, 0.14, steel, { surface: "metal" });
K.box(wpx, 2.6, 27.1, 0.14, 4.4, 0.14, steel, { surface: "metal" });
}
// 西：汽轮机厅
for (var tb = -1; tb <= 1; tb += 2) {
var tz = tb * 8;
K.box(-33, 0.62, tz, 6.6, 0.36, 3.6, steel, { surface: "metal" });
K.box(-31.6, 1.6, tz, 3.6, 1.9, 2.4, greyp, { surface: "metal" });
tube(-33.6, 1.7, tz, 1.15, 2.2, rust, "x", 12);
K.box(-35.6, 1.5, tz, 2.2, 2.2, 2.6, cabMat, { surface: "metal" });
deco(-35.6, 2.7, tz, 2.0, 0.3, 2.4, galv);
deco(-31.6, 2.65, tz, 3.0, 0.3, 2.0, galv);
tube(-33, 3.4, tz, 0.3, 3.0, galv, "y", 10);
wheel(-32.4, 3.2, tz, 0.3, yellow, "y");
K.box(-33, 1.2, tz + 2.6, 1.0, 2.0, 1.0, cabMat, { surface: "metal" });
deco(-33, 1.7, tz + 2.0, 0.06, 0.5, 0.5, screenMat);
}
for (var tk = 0; tk < 4; tk++) {
var tkx = tk < 2 ? -36.2 : -30.2, tkz = (tk % 2 ? 1 : -1) * (tk < 2 ? 21 : 24);
K.box(tkx, 1.7, tkz, 2.6, 3.4, 2.6, greyp, { surface: "metal" });
deco(tkx, 3.55, tkz, 2.3, 0.24, 2.3, galv);
tube(tkx, 4.1, tkz, 0.16, 1.2, galv, "y", 8);
}
for (var sg2 = 0; sg2 < 5; sg2++) {
var sgz = -12 + sg2 * 6;
K.box(-37.2, 1.2, sgz, 0.9, 2.0, 2.4, cabMat, { surface: "metal" });
deco(-36.68, 1.55, sgz, 0.06, 0.5, 1.4, screenMat);
deco(-36.68, 1.0, sgz, 0.06, 0.12, 1.0, blue);
}
for (var pr = -3; pr <= 3; pr++) {
K.box(-33, 2.9, pr * 7, 0.26, 5.0, 0.26, steel, { surface: "metal" });
K.box(-33, 4.6, pr * 7, 0.36, 0.3, 8.8, galv, { surface: "metal", noNav: true });
deco(-33, 4.1, pr * 7, 0.22, 0.22, 8.8, conduit);
}
K.box(-33, 3.1, 18, 0.5, 6.2, 0.5, steel, { surface: "metal" });
K.box(-33, 3.1, -18, 0.5, 6.2, 0.5, steel, { surface: "metal" });
// 东：冷却塔廊
for (var cw = -1; cw <= 1; cw++) {
var cz2 = cw * 10;
K.box(33, 0.55, cz2, 7.0, 0.3, 7.0, conc, { surface: "metal" });
for (var lg = 0; lg < 4; lg++) K.box(33 + (lg % 2 ? 3 : -3), 2.6, cz2 + (lg < 2 ? -3 : 3), 0.36, 4.2, 0.36, steel, { surface: "metal" });
K.box(33, 4.8, cz2, 7.2, 0.3, 7.2, galv, { surface: "metal" });
deco(33, 4.6, cz2, 5.0, 0.1, 5.0, cold);
tube(33, 4.3, cz2, 1.2, 0.5, steel, "y", 12);
}
for (var eg = 0; eg < 4; eg++) {
K.box(37.15, 1.2, -15 + eg * 3.6, 0.9, 2.0, 2.0, cabMat, { surface: "metal" });
deco(36.62, 1.55, -15 + eg * 3.6, 0.06, 0.5, 1.2, screenMat);
}
// 北：热交换器院
for (var hx = -1; hx <= 1; hx += 2) for (var hz = 0; hz < 2; hz++) {
var hxx = hx * (hz ? 20 : 8), hzz = 24;
K.box(hxx, 1.45, hzz, 3.4, 2.0, 2.2, greyp, { surface: "metal" });
K.box(hxx, 0.62, hzz, 3.8, 0.42, 2.6, steel, { surface: "metal" });
tube(hxx, 3.1, hzz, 0.18, 2.0, galv, "y", 8);
deco(hxx, 2.55, hzz, 3.6, 0.16, 2.4, galv);
}
for (var yr = -2; yr <= 2; yr++) K.box(yr * 11, 2.7, 26.4, 0.24, 4.6, 0.24, steel, { surface: "metal" });
for (var yp = -1; yp <= 1; yp += 2) K.box(yp * 14, 0.95, 21.8, 1.8, 1.1, 1.2, greyp, { surface: "metal" });
// 南：蓄电池库 / 仓储
for (var bt = 0; bt < 8; bt++) {
var btx = -24 + (bt % 4) * 7, btz = bt < 4 ? -26.3 : -23.0;
K.box(btx, 1.35, btz, 2.6, 2.1, 0.9, greyp, { surface: "metal" });
deco(btx, 1.5, btz + (bt < 4 ? 0.5 : -0.5), 2.2, 0.12, 0.05, blue);
}
for (var bs2 = 0; bs2 < 8; bs2++) {
K.box(-32 + bs2 * 9, 1.5, -21.4, 2.8, 2.4, 1.0, steel, { surface: "metal" });
deco(-32 + bs2 * 9, 2.3, -20.85, 2.4, 0.1, 0.05, hazard);
}
K.prop("crate_stack", -20, -22.2, 0.3, FLOOR);
K.prop("crate_stack", 16.5, -24.2, 0.2, FLOOR);
K.prop("barrel", 20.4, -21.6, 0, FLOOR);
// 外环照明与标牌
for (var rl = -1; rl <= 1; rl += 2) {
lamp(rl * 33, 6.0, -14, 4.0, "z");
lamp(rl * 33, 6.0, 0, 4.0, "z");
lamp(rl * 33, 6.0, 14, 4.0, "z");
lamp(rl * 14, 6.0, 24, 4.0, "x");
lamp(rl * 14, 6.0, -24, 4.0, "x");
}
K.light(-33, 5.2, -10, 0x9fd8ff, 120, 20);
K.light(-33, 5.2, 12, 0xffd9a6, 100, 18);
K.light(33, 5.2, 0, 0x8fb8ff, 110, 20);
K.light(0, 5.2, 24, 0xffd9a6, 120, 22);
K.light(0, 5.2, -24, 0xbfe0ff, 110, 20);
K.label("汽轮机厅", -37.2, 4.6, -6, 1.57, 3.6, 0.8);
K.label("冷却塔廊", 37.2, 4.6, 6, -1.57, 3.6, 0.8);
K.label("热交换器院", 0, 4.6, 27.2, Math.PI, 4.0, 0.85);
K.label("蓄电池库", 0, 4.6, -27.2, 0, 4.0, 0.85);
// R12 · 蓄电池库设备可读性（电芯 / 线缆 / 标签 / 通风格栅）
for (var bb = 0; bb < 8; bb++) {
var bbx = -24 + (bb % 4) * 7, bbz = bb < 4 ? -26.3 : -23.0;
for (var bc = 0; bc < 3; bc++) {
deco(bbx - 0.8 + bc * 0.8, 1.0, bbz + (bb < 4 ? 0.52 : -0.52), 0.66, 0.78, 0.1, cabMat);
deco(bbx - 0.8 + bc * 0.8, 1.55, bbz + (bb < 4 ? 0.58 : -0.58), 0.5, 0.16, 0.04, blue);
tube(bbx - 0.8 + bc * 0.8, 1.42, bbz + (bb < 4 ? 0.58 : -0.58), 0.05, 0.12, red, "z", 6);
}
deco(bbx, 2.32, bbz, 2.5, 0.08, 0.34, galv);
for (var cc = -1; cc <= 1; cc++) deco(bbx + cc * 0.8, 2.38, bbz, 0.1, 0.06, 0.3, steel);
deco(bbx, 2.05, bbz, 1.7, 0.16, 0.04, hazard);
deco(bbx, 0.75, bbz, 2.2, 0.24, 0.04, cabMat);
for (var vg = 0; vg < 4; vg++) deco(bbx, 0.75, bbz, 1.6, 0.16, 0.05 + vg * 0.0, steel);
}
for (var cd = 0; cd < 4; cd++) {
tube(-24 + cd * 7, 2.6, -24.65, 0.13, 5.6, conduit, "x", 8);
deco(-24 + cd * 7, 2.6, -24.65, 0.5, 0.4, 0.3, cabMat);
}
deco(0, 5.1, -25.4, 34, 0.5, 0.9, galv);
for (var vd = 0; vd < 9; vd++) deco(-16 + vd * 4, 5.1, -25.4, 0.3, 0.6, 0.95, steel);
for (var ts = 0; ts < 5; ts++) deco(-18 + ts * 9, 0.415, -24.8, 0.4, 0.02, 4.6, conduit);
// R8 · 新四厅设备加密 + 翼区货架/工具箱 + 贴墙清理
for (var v8 = 0; v8 < 4; v8++) {
var v8z = v8 < 2 ? -16 + v8 * 5 : 11 + (v8 - 2) * 5;
K.box(-32.0, 1.1, v8z, 0.9, 1.2, 0.9, cabMat, { surface: "metal" });
deco(-31.5, 1.25, v8z, 0.06, 0.4, 0.5, screenMat);
wheel(-31.48, 0.95, v8z, 0.22, yellow, "x");
}
for (var p8 = 0; p8 < 3; p8++) {
var p8z = p8 < 2 ? -25 + p8 * 10 : 15;
K.box(-34.0, 1.0, p8z, 1.6, 1.2, 1.6, greyp, { surface: "metal" });
K.box(-34.0, 1.75, p8z, 1.2, 0.4, 1.2, galv, { surface: "metal" });
tube(-34.0, 2.3, p8z, 0.13, 1.4, galv, "y", 8);
}
for (var c8 = 0; c8 < 2; c8++) K.box(-36.9, 1.3, -26 + c8 * 1.6, 0.9, 1.8, 1.2, cabMat, { surface: "metal" });
for (var e8 = 0; e8 < 6; e8++) K.box(36.9, 1.3, 8 + e8 * 2.0, 0.9, 1.8, 1.4, cabMat, { surface: "metal" });
for (var ep8 = 0; ep8 < 4; ep8++) {
var ep8z = ep8 < 2 ? -18 + ep8 * 4 : 14 + (ep8 - 2) * 4;
K.box(35.4, 1.0, ep8z, 1.4, 1.2, 1.4, greyp, { surface: "metal" });
tube(35.4, 2.2, ep8z, 0.12, 1.3, rust, "y", 8);
}
for (var f8 = 0; f8 < 4; f8++) {
var f8x = f8 < 2 ? -26 + f8 * 10 : 16 + (f8 - 2) * 10;
K.box(f8x, 0.95, 23.4, 1.3, 1.1, 1.3, greyp, { surface: "metal" });
tube(f8x, 1.9, 23.4, 0.42, 1.4, cabMat, "y", 10);
deco(f8x, 2.6, 23.4, 0.7, 0.12, 0.7, galv);
}
for (var nv8 = 0; nv8 < 2; nv8++) for (var nv9 = 0; nv9 < 2; nv9++) {
K.box(nv8 ? 26 : 16, 1.0, 20.9, 0.9, 1.2, 0.9, cabMat, { surface: "metal" });
wheel(nv8 ? 25.5 : 16.5, 1.35, 20.9, 0.24, yellow, "x");
}
for (var nw8 = -1; nw8 <= 1; nw8 += 2) K.box(nw8 * 3, 1.25, 22.0, 1.0, 1.7, 1.0, cabMat, { surface: "metal" });
for (var s8 = 0; s8 < 4; s8++) K.prop("crate_stack", 10 + s8 * 8, -26, s8 * 0.3, FLOOR);
for (var sw8 = 0; sw8 < 2; sw8++) K.box(34 - sw8 * 2.2, 1.3, -22.6, 1.0, 1.8, 1.2, cabMat, { surface: "metal" });
K.prop("toolbox", -20.6, -10.6, 0.2, FLOOR);
K.prop("toolbox", 20.6, 10.6, -0.2, FLOOR);
K.prop("shelf_rack", -20.4, 11.6, 1.57, FLOOR);
K.prop("shelf_rack", 20.4, -11.6, -1.57, FLOOR);
K.prop("crate_stack", -30.2, -18.5, 0.4, FLOOR);
K.prop("barrel", -34.0, 6.0, 0, FLOOR);
K.prop("crate_stack", 30.5, 4.0, 0.2, FLOOR);
K.prop("barrel", 35.0, 3.0, 0, FLOOR);
K.prop("crate_stack", 0, -26.8, 0.5, FLOOR);
K.prop("crate_stack", -26.5, 26.0, 0.3, FLOOR);
// R7c · 密度补足（目标 0.15 boxes/m²）
for (var dw = 0; dw < 6; dw++) K.box(-28.55, 4.4, 13 + dw * 1.6, 0.8, 1.6, 1.3, cabMat, { surface: "metal" });
for (var de = 0; de < 6; de++) K.box(36.9, 1.4, -25 + de * 2.2, 0.9, 2.0, 1.5, cabMat, { surface: "metal" });
for (var de2 = 0; de2 < 4; de2++) K.box(36.9, 1.4, -5.5 + de2 * 3.6, 0.9, 2.0, 1.5, cabMat, { surface: "metal" });
for (var dn = 0; dn < 5; dn++) K.box(-16.5 + dn * 8.25, 0.9, 26.2, 1.4, 1.0, 1.2, greyp, { surface: "metal" });
for (var dc = 0; dc < 12; dc++) K.box(-30 + dc * 5.4, 1.2, 26.85, 0.9, 1.6, 0.8, cabMat, { surface: "metal" });
// R7b · 新区域设备填充
for (var fw = 0; fw < 4; fw++) {
var fwz = -22 + fw * 11;
K.box(-34.6, 1.0, fwz, 1.6, 1.2, 1.6, greyp, { surface: "metal" });
K.box(-34.6, 1.75, fwz, 1.2, 0.4, 1.2, galv, { surface: "metal" });
tube(-34.6, 2.3, fwz, 0.14, 1.5, galv, "y", 8);
}
for (var fwc = 0; fwc < 6; fwc++) {
K.box(-36.9, 1.4, 14 + fwc * 1.7, 0.8, 2.0, 1.3, cabMat, { surface: "metal" });
deco(-36.45, 1.6, 14 + fwc * 1.7, 0.06, 0.5, 0.7, screenMat);
}
for (var fy = 0; fy < 6; fy++) {
var fyx = fy < 3 ? -27 + fy * 9 : 9 + (fy - 3) * 9;
K.box(fyx, 1.6, 21.2, 2.2, 2.0, 1.4, cabMat, { surface: "metal" });
deco(fyx, 2.0, 20.46, 1.7, 0.5, 0.06, screenMat);
K.box(fyx + 1.5, 0.85, 21.2, 0.9, 0.7, 1.0, greyp, { surface: "metal" });
}
for (var fe = 0; fe < 5; fe++) K.box(36.9, 1.4, 14 + fe * 2.2, 0.9, 2.0, 1.5, cabMat, { surface: "metal" });
for (var fp = 0; fp < 8; fp++) {
var fpx = fp === 4 ? 34.0 : -30 + fp * 8.5;
var fpz = fp === 4 ? -25.6 : -24.2;
K.prop(fp % 2 ? "crate_stack" : "pallet_stack", fpx, fpz, fp * 0.4, FLOOR);
}
// R13 · 分板以上墙面细节（桥架 / 接线箱 / 警示条 / 标牌）
for (var ud = -22; ud <= 22; ud += 4) {
deco(-37.3, 4.9, ud, 0.34, 0.1, 46, galv);
deco(37.3, 4.9, ud, 0.34, 0.1, 46, galv);
deco(-37.24, 4.62, ud - 2, 0.12, 0.5, 0.12, steel);
deco(37.24, 4.62, ud - 2, 0.12, 0.5, 0.12, steel);
}
for (var ux = -32; ux <= 32; ux += 8) {
deco(ux, 4.9, -27.3, 60, 0.1, 0.34, galv);
deco(ux, 4.9, 27.3, 60, 0.1, 0.34, galv);
deco(ux + 2, 4.62, -27.24, 0.12, 0.5, 0.12, steel);
deco(ux + 2, 4.62, 27.24, 0.12, 0.5, 0.12, steel);
}
for (var ub = 0; ub < 4; ub++) {
var ubx = ub < 2 ? -37.28 : 37.28;
deco(ubx, 5.35, -12 + ub * 8, 0.16, 0.7, 0.9, cabMat);
deco(ubx + (ub < 2 ? 0.1 : -0.1), 5.35, -12 + ub * 8, 0.04, 0.25, 0.5, blue);
}
for (var uz = 0; uz < 4; uz++) {
var uzz = uz < 2 ? -27.28 : 27.28;
deco(-16 + uz * 9, 5.35, uzz, 0.9, 0.7, 0.16, cabMat);
deco(-16 + uz * 9, 5.35, uzz + (uz < 2 ? 0.1 : -0.1), 0.5, 0.25, 0.04, blue);
}
deco(-37.29, 4.36, 0, 0.1, 0.1, 46, hazard);
deco(37.29, 4.36, 0, 0.1, 0.1, 46, hazard);
deco(0, 4.36, -27.29, 60, 0.1, 0.1, hazard);
deco(0, 4.36, 27.29, 60, 0.1, 0.1, hazard);
K.label("TURBINE HALL · B4-02", -37.15, 5.6, -14.0, 1.57, 5.0, 0.9);
K.label("COOLING TOWER LG-3", 37.15, 5.6, 4.0, -1.57, 5.0, 0.9);
// R11 · 外环墙面分板（压住大面积 UV 拉伸）
for (var pw = -22; pw <= 22; pw += 2.5) {
deco(-37.35, 2.2, pw, 0.06, 3.6, 2.42, greyp);
deco(37.35, 2.2, pw, 0.06, 3.6, 2.42, greyp);
deco(-37.31, 2.2, pw + 1.25, 0.05, 3.7, 0.14, steel);
deco(37.31, 2.2, pw + 1.25, 0.05, 3.7, 0.14, steel);
}
for (var pq = -30; pq <= 30; pq += 2.4) {
deco(pq, 2.2, -27.35, 2.32, 3.6, 0.06, greyp);
deco(pq, 2.2, 27.35, 2.32, 3.6, 0.06, greyp);
deco(pq + 1.2, 2.2, -27.31, 0.14, 3.7, 0.05, steel);
deco(pq + 1.2, 2.2, 27.31, 0.14, 3.7, 0.05, steel);
}
deco(-37.02, 4.15, 0, 0.1, 0.3, 52, galv);
deco(37.02, 4.15, 0, 0.1, 0.3, 52, galv);
// R9 · 西厅观察平台 + 检修梯 + 新区域地面细节
K.box(-36.3, 3.45, 0, 2.2, 0.22, 20, greyp, { surface: "metal", noNav: true });
deco(-35.45, 3.57, 0, 0.26, 0.03, 19.6, diamond);
deco(-37.15, 3.57, 0, 0.26, 0.03, 19.6, diamond);
for (var pg = -9.4; pg <= 9.4; pg += 1.4) deco(-36.3, 3.565, pg, 2.05, 0.02, 0.06, steel);
for (var pc9 = -1; pc9 <= 1; pc9 += 2) for (var pc8 = -1; pc8 <= 1; pc8 += 2) K.box(-35.9, 1.75, pc9 * 3 + pc8 * 6.5, 0.24, 3.1, 0.24, steel, { surface: "metal" });
for (var rz9 = -9; rz9 <= 9; rz9 += 2.2) deco(-35.25, 4.05, rz9, 0.07, 1.1, 0.07, yellow);
deco(-35.25, 4.6, 0, 0.06, 0.06, 19, yellow);
deco(-35.25, 4.1, 0, 0.05, 0.05, 19, galv);
deco(-35.25, 3.52, 0, 0.04, 0.2, 19, steel);
for (var st9 = 0; st9 < 11; st9++) K.box(-36.3, 0.4 + (st9 + 1) * 0.31 / 2, 13.6 - st9 * 0.32, 1.6, (st9 + 1) * 0.31, 0.32, diamond, { surface: "metal", noNav: true });
deco(-35.5, 2.4, 12.3, 0.07, 1.1, 0.07, yellow);
deco(-35.5, 1.85, 12.0, 0.06, 0.06, 3.4, yellow);
deco(-36.3, 0.416, 0, 0.3, 0.02, 18, conduit);
deco(33, 0.416, 0, 0.3, 0.02, 20, conduit);
deco(-33, 0.416, -26, 8.4, 0.02, 0.28, conduit);
deco(0, 0.416, 26.6, 22, 0.02, 0.28, conduit);
deco(0, 0.416, -26.6, 22, 0.02, 0.28, conduit);
var oil9 = [[-34.4, -3.0, 1.6, 1.0], [30.6, 8.4, 1.8, 1.2], [8.0, 25.4, 1.4, 1.0], [-6.0, -25.4, 1.5, 0.9]];
for (var o9 = 0; o9 < 4; o9++) deco(oil9[o9][0], 0.418, oil9[o9][1], oil9[o9][2], 0.012, oil9[o9][3], cabMat);
for (var r9 = 0; r9 < 4; r9++) {
deco(-37.3, 2.2, -16 + r9 * 9, 0.02, 2.6, 0.4, rust);
deco(37.3, 2.2, -14 + r9 * 9, 0.02, 2.6, 0.4, rust);
}
for (var h9 = 0; h9 < 3; h9++) {
K.box(33.4, 4.4, -18 + h9 * 12, 0.24, 0.24, 3.2, steel, { surface: "metal", noNav: true });
deco(33.4, 4.6, -18 + h9 * 12, 1.4, 0.1, 0.1, galv);
}
K.label("观察平台", -35.1, 4.9, 4.0, 1.57, 3.0, 0.66);
K.label("冷却塔 1-3", 36.2, 5.2, 0, -1.57, 3.4, 0.72);
// R7 · 地面/墙面脏化 + 排水沟 + 标牌
for (var rs = 0; rs < 4; rs++) {
var rz = -9 + rs * 6;
deco(-27.28, 1.95, rz, 0.02, 2.1, 0.42, rust);
deco(27.28, 1.95, rz + 1.5, 0.02, 2.1, 0.42, rust);
}
var oil2 = [[-23.9, -6.8, 1.8, 1.2], [23.2, -10.4, 2.0, 1.4], [19.9, 1.2, 1.2, 0.9], [-13.2, -11.2, 1.4, 1.0], [-19.0, 4.6, 1.1, 0.8]];
for (var oj = 0; oj < 5; oj++) deco(oil2[oj][0], 0.414, oil2[oj][1], oil2[oj][2], 0.012, oil2[oj][3], cabMat);
for (var cn = -1; cn <= 1; cn += 2) {
deco(0, 0.412, cn * 3.2, 31, 0.014, 0.34, conduit);
for (var cb2 = -15; cb2 <= 15; cb2 += 1.5) deco(cb2, 0.42, cn * 3.2, 0.1, 0.02, 0.32, galv);
deco(0, 0.412, cn * 9.4, 31, 0.014, 0.3, conduit);
for (var cb3 = -15; cb3 <= 15; cb3 += 1.5) deco(cb3, 0.42, cn * 9.4, 0.1, 0.02, 0.28, galv);
}
deco(-18.55, 5.2, -12.4, 0.16, 0.54, 10, galv);
for (var nh = -10; nh <= 10; nh += 5) deco(-18.45, 5.62, nh, 0.1, 0.3, 0.1, steel);
for (var nh2 = -10; nh2 <= 10; nh2 += 5) deco(18.45, 5.62, nh2, 0.1, 0.3, 0.1, steel);
K.label("冷却回路 B", -18.42, 5.0, -5.2, 1.57, 3.2, 0.7);
K.label("高压危险", 18.42, 5.0, 4.6, -1.57, 2.8, 0.64);
K.label("B4 环形马道", -11.4, 5.0, 12.3, Math.PI, 3.0, 0.66);
// R6 · 南闸备用发电机组 / 油罐 / 排烟管 / 电缆桥架 / 油污
K.box(-19.8, 0.52, -17.2, 4.4, 0.24, 2.0, steel, { surface: "metal" });
deco(-19.8, 0.66, -17.2, 4.2, 0.06, 1.8, hazard);
K.box(-19.8, 1.35, -17.2, 2.9, 1.4, 1.5, greyp, { surface: "metal" });
deco(-19.8, 1.92, -17.2, 2.4, 0.3, 1.2, galv);
tube(-18.1, 1.35, -17.2, 0.5, 1.6, rust, "x", 12);
deco(-21.75, 1.4, -17.2, 0.3, 1.4, 1.5, cabMat);
for (var rf = 0; rf < 6; rf++) deco(-21.95, 0.85 + rf * 0.22, -17.2, 0.14, 0.3, 1.1, steel);
tube(-21.4, 2.15, -17.2, 0.12, 1.2, conduit, "y", 8);
K.box(-17.6, 1.45, -16.45, 0.7, 1.0, 0.4, cabMat, { surface: "metal" });
deco(-17.25, 1.65, -16.45, 0.05, 0.4, 0.28, screenMat);
deco(-17.25, 1.35, -16.45, 0.05, 0.1, 0.1, green);
K.box(-23.4, 0.98, -17.4, 1.6, 1.2, 1.2, greyp, { surface: "metal" });
deco(-23.4, 1.63, -17.4, 1.3, 0.14, 0.9, galv);
tube(-23.4, 2.2, -17.4, 0.07, 0.9, galv, "y", 8);
deco(-23.4, 1.1, -16.78, 0.3, 0.4, 0.06, blue);
pipeRun(-22.6, 1.15, -17.2, 0.09, 1.4, galv, "x", 8);
for (var cu = -1; cu <= 1; cu += 2) {
deco(-23.4, 0.42, -17.4 + cu * 0.72, 1.9, 0.12, 0.12, hazard);
deco(-23.4 + cu * 0.92, 0.42, -17.4, 0.12, 0.12, 1.7, hazard);
}
tube(-22.5, 3.4, -17.2, 0.16, 5.4, rust, "y", 10);
tube(-22.5, 6.0, -18.2, 0.16, 1.9, rust, "z", 10);
flange(-22.5, 2.2, -17.2, "y", 0.24);
flange(-22.5, 4.0, -17.2, "y", 0.24);
tube(-22.5, 6.1, -19.25, 0.2, 0.24, steel, "y", 8);
deco(-19.8, 2.95, -18.35, 4.0, 0.08, 0.5, galv);
for (var ct2 = -1; ct2 <= 1; ct2++) deco(-19.8 + ct2 * 1.4, 2.68, -18.35, 0.08, 0.45, 0.08, steel);
deco(-19.8, 3.03, -18.35, 3.6, 0.06, 0.3, conduit);
deco(-19.8, 4.55, -17.2, 1.7, 0.1, 0.3, cold);
K.light(-19.8, 4.2, -17.2, 0xffd9a6, 110, 15);
deco(-19.8, 0.416, -15.9, 5.2, 0.02, 0.16, hazard);
deco(-17.2, 0.416, -17.2, 0.16, 0.02, 2.4, hazard);
var oil = [[-18.4, -15.6, 2.2, 1.2], [-21.2, -15.9, 1.4, 0.9], [-20.6, -16.4, 0.9, 0.6]];
for (var oi = 0; oi < 3; oi++) deco(oil[oi][0], 0.414, oil[oi][1], oil[oi][2], 0.012, oil[oi][3], cabMat);
K.label("备用电源 · GEN-2", -19.8, 3.3, -19.28, 0, 4.6, 0.9);
// R5 · 控制室补全：第二排值班台 / 会议桌 / 文件柜 / 窗框百叶 / 地胶分色
for (var c2 = 0; c2 < 2; c2++) {
var qx = c2 ? 4.4 : -4.8;
K.box(qx, 5.18, 18.4, 2.4, 0.12, 0.9, greyp, { surface: "metal" });
K.box(qx, 4.8, 18.4, 2.4, 0.68, 0.16, cabMat, { surface: "metal" });
for (var qs = -1; qs <= 1; qs += 2) deco(qx + qs * 0.68, 5.56, 18.6, 1.0, 0.62, 0.07, screenMat);
deco(qx, 5.0, 17.7, 0.62, 0.12, 0.62, cabMat);
deco(qx, 5.36, 17.38, 0.62, 0.72, 0.12, cabMat);
deco(qx, 4.72, 17.7, 0.1, 0.54, 0.1, steel);
}
for (var lgx = -1; lgx <= 1; lgx += 2) for (var lgz = -1; lgz <= 1; lgz += 2) deco(-10.8 + lgx * 1.35, 4.77, 17.3 + lgz * 0.55, 0.1, 0.66, 0.1, steel);
deco(-10.8, 5.16, 17.3, 3.0, 0.1, 1.4, greyp);
deco(-10.8, 5.22, 17.3, 2.2, 0.02, 0.9, holo);
for (var st = 0; st < 4; st++) {
var stx = -10.8 + (st % 2 ? 1.7 : -1.7), stz = 17.3 + (st < 2 ? -1.0 : 1.0);
deco(stx, 5.0, stz, 0.5, 0.08, 0.5, cabMat);
deco(stx, 4.7, stz, 0.09, 0.5, 0.09, steel);
}
for (var fc2 = 0; fc2 < 3; fc2++) {
deco(-7.6 - fc2 * 1.2, 5.5, 19.13, 1.0, 1.9, 0.5, cabMat);
for (var fd = 0; fd < 3; fd++) deco(-7.6 - fc2 * 1.2, 5.1 + fd * 0.5, 18.86, 0.86, 0.05, 0.04, steel);
}
deco(0, 4.52, 13.06, 21.2, 0.12, 0.3, galv);
deco(0, 6.62, 13.06, 21.2, 0.12, 0.3, galv);
for (var bl = -1; bl <= 1; bl += 2) {
deco(bl * 7.6, 6.42, 13.12, 2.6, 0.22, 0.24, cabMat);
for (var bs = 0; bs < 4; bs++) deco(bl * 7.6, 6.28 - bs * 0.14, 13.16, 2.4, 0.03, 0.04, greyp);
}
deco(0, 4.552, 15.2, 22, 0.012, 1.8, greyp);
deco(0, 4.553, 15.2, 22, 0.008, 0.12, yellow);
deco(-2.05, 4.56, 18.9, 15.6, 0.06, 0.3, cabMat);
deco(6.8, 4.56, 18.9, 3.6, 0.06, 0.3, cabMat);
// 翼区墙面设备锚点（每 4m 一个视觉锚点）
for (var wa2 = 0; wa2 < 6; wa2++) {
var az = -10 + wa2 * 4, k = wa2 % 3;
if (k === 0) {
K.box(-26.95, 1.55, az, 0.36, 1.5, 1.15, cabMat, { surface: "metal" });
deco(-26.7, 1.7, az, 0.06, 0.5, 0.72, screenMat);
deco(-26.7, 1.22, az - 0.3, 0.05, 0.1, 0.1, green);
deco(-26.7, 1.22, az + 0.3, 0.05, 0.1, 0.1, blue);
} else if (k === 1) {
pipeRun(-26.85, 1.4, az, 0.1, 1.2, galv, "y", 8);
wheel(-26.62, 1.4, az, 0.3, yellow, "x");
tube(-26.85, 2.25, az, 0.1, 1.1, rust, "y", 8);
flange(-26.85, 2.82, az, "y", 0.16);
deco(-26.95, 1.85, az + 0.62, 0.14, 0.5, 0.14, conduit);
} else {
K.box(-26.95, 1.16, az, 0.3, 0.92, 0.72, redSoft, { surface: "metal" });
deco(-26.78, 1.2, az, 0.04, 0.52, 0.4, red);
deco(-26.85, 2.0, az, 0.05, 0.36, 0.66, cabMat);
deco(-26.8, 2.02, az, 0.04, 0.24, 0.5, blue);
}
}
for (var ea = 0; ea < 6; ea++) {
var ez = -10 + ea * 4, ek = ea % 3;
if (ek === 0) {
K.box(26.95, 1.55, ez, 0.36, 1.5, 1.15, cabMat, { surface: "metal" });
deco(26.7, 1.7, ez, 0.06, 0.5, 0.72, screenMat);
deco(26.7, 1.22, ez - 0.3, 0.05, 0.1, 0.1, red);
deco(26.7, 1.22, ez + 0.3, 0.05, 0.1, 0.1, green);
} else if (ek === 1) {
K.box(26.95, 1.16, ez, 0.3, 0.92, 0.72, redSoft, { surface: "metal" });
deco(26.78, 1.2, ez, 0.04, 0.5, 0.4, red);
deco(26.8, 2.0, ez, 0.06, 0.4, 0.8, cabMat);
deco(26.72, 2.02, ez, 0.04, 0.26, 0.6, blue);
} else {
pipeRun(26.85, 1.5, ez, 0.1, 1.3, galv, "y", 8);
wheel(26.62, 1.5, ez, 0.3, yellow, "x");
deco(26.9, 2.3, ez, 0.5, 0.5, 0.5, cabMat);
}
}
// 翼区中部设备岛（打断长廊感）
K.box(-21.4, 1.15, -4.0, 2.2, 1.5, 2.2, greyp, { surface: "metal" });
deco(-21.4, 1.98, -4.0, 1.8, 0.2, 1.8, galv);
tube(-21.4, 2.5, -4.0, 0.16, 2.0, rust, "y", 8);
pipeRun(-21.4, 2.75, -5.1, 0.12, 2.2, galv, "z", 8);
wheel(-21.0, 2.5, -4.0, 0.3, yellow, "x");
deco(-21.4, 0.55, -4.0, 2.3, 0.3, 2.3, steel);
deco(-21.4, 1.28, -2.88, 0.5, 0.4, 0.06, screenMat);
K.box(22.4, 1.1, -3.4, 2.2, 1.4, 2.2, cabMat, { surface: "metal" });
deco(22.4, 1.88, -3.4, 1.9, 0.16, 1.9, galv);
for (var cb = 0; cb < 4; cb++) deco(21.6 + cb * 0.5, 1.3, -2.26, 0.1, 0.9, 0.05, cb % 2 ? blue : green);
deco(22.4, 2.15, -3.4, 0.5, 0.5, 0.5, conduit);
// 北廊 / 南闸墙面设备
for (var na = 0; na < 4; na++) {
var nx2 = (na < 2 ? -20 + na * 4 : 16 + (na - 2) * 4);
K.box(nx2, 1.5, 19.2, 1.1, 1.4, 0.4, cabMat, { surface: "metal" });
deco(nx2, 1.65, 18.96, 0.8, 0.45, 0.05, na % 2 ? holo : screenMat);
deco(nx2, 0.55, 18.98, 0.9, 0.16, 0.08, blue);
}
for (var qa = 0; qa < 4; qa++) {
var qx = (qa < 2 ? -22 + qa * 5 : 17 + (qa - 2) * 5);
K.box(qx, 1.4, -19.2, 1.0, 1.3, 0.4, cabMat, { surface: "metal" });
deco(qx, 1.55, -18.98, 0.7, 0.4, 0.05, qa % 2 ? screenMat : holo);
deco(qx, 0.55, -18.98, 0.8, 0.14, 0.06, qa % 2 ? red : blue);
}
// 中央大厅南墙：竖向管线 / 接线箱 / 消防柜 / 警示牌
for (var sa = -1; sa <= 1; sa += 2) {
for (var sq = 0; sq < 2; sq++) {
var sxx = sa * (10.6 + sq * 5.9);
tube(sxx, 5.0, -12.55, 0.1, 4.8, conduit, "y", 8);
deco(sxx, 6.6, -12.4, 0.5, 0.7, 0.28, cabMat);
deco(sxx + 0.2, 6.6, -12.25, 0.06, 0.18, 0.18, sa > 0 ? blue : green);
}
deco(sa * 16.2, 2.7, -12.45, 0.7, 1.0, 0.3, redSoft);
deco(sa * 16.2, 2.7, -12.28, 0.5, 0.7, 0.06, red);
deco(sa * 5.2, 3.9, -12.6, 1.35, 0.78, 0.06, hazard);
deco(sa * 5.2, 3.9, -12.55, 1.5, 0.9, 0.05, steel);
deco(sa * 12.6, 6.9, -12.5, 2.4, 0.5, 0.2, galv);
}
deco(0, 7.55, -12.6, 34, 0.18, 0.3, galv);
// 南闸地面警示 / 备用气瓶
deco(0, 0.42, -14.3, 8, 0.02, 0.3, hazard);
deco(0, 0.42, -17.0, 8, 0.02, 0.3, hazard);
for (var ch = -3; ch <= 3; ch += 2) deco(ch, 0.43, -15.6, 0.9, 0.02, 0.4, warn);
K.prop("gas_cylinders", -20.2, -15.4, 0.2, FLOOR);
K.prop("toolbox", 12.4, -15.5, 0.4, FLOOR);
// 蓝色状态灯 / 冷白工作灯对比
K.light(-18.0, 3.3, 0, 0x4f9fe8, 45, 10);
K.light(18.0, 3.3, 0, 0x4f9fe8, 45, 10);
K.light(-24.0, 3.4, 10.2, 0x8fd0ff, 55, 12);
K.light(24.0, 3.4, -10.2, 0x8fd0ff, 55, 12);
K.box(-18.6, 3.2, -6, 0.35, 0.35, 10, red, { surface: "metal", noNav: true });
K.box(18.6, 3.2, 6, 0.35, 0.35, 10, red, { surface: "metal", noNav: true });
K.box(0, 7.1, -10.5, 30, 0.4, 0.5, steel, { surface: "metal", noNav: true });
for (var rx = -14; rx <= 14; rx += 7) {
if (rx === 0) continue;
K.box(rx, 1.0, -11.6, 2.6, 2.0, 0.9, "steel_painted", { surface: "metal" });
K.box(rx, 1.55, -11.1, 1.8, 0.12, 0.06, red, { surface: "metal", noNav: true });
K.box(rx, 1.85, -11.1, 1.8, 0.12, 0.06, white, { surface: "metal", noNav: true });
}
K.prop("crate_stack", -10, 7.5, 0.3, 0.3);
K.prop("crate_stack", 10, -7.5, 0.9, 0.3);
K.prop("barrel", -5, -8.5, 0, 0.3);
K.prop("barrel", -4.2, -8.9, 0, 0.3);
K.prop("generator", 12, 8.2, -1.2, 0.3);
K.prop("pallet_stack", -12, -3.5, 0.4, 0.3);
// 二层环廊（反应堆四周）+ 南北墙侧廊 + 连接桥
var CY = 5.02, DY = CY + 0.06;
function rail(x1, z1, x2, z2, y) {
var dx = x2 - x1, dz = z2 - z1, len = Math.sqrt(dx * dx + dz * dz), n = Math.max(2, Math.round(len / 1.7));
for (var i = 0; i <= n; i++) {
var t = i / n;
deco(x1 + dx * t, y + 0.55, z1 + dz * t, 0.07, 1.1, 0.07, yellow);
}
deco((x1 + x2) / 2, y + 1.09, (z1 + z2) / 2, Math.abs(dx) + 0.06, 0.06, Math.abs(dz) + 0.06, yellow);
deco((x1 + x2) / 2, y + 0.62, (z1 + z2) / 2, Math.abs(dx) + 0.05, 0.05, Math.abs(dz) + 0.05, galv);
deco((x1 + x2) / 2, y + 0.1, (z1 + z2) / 2, Math.abs(dx) + 0.05, 0.16, Math.abs(dz) + 0.05, steel);
}
K.box(-7.4, CY, 0, 1.6, 0.12, 16.4, diamond, { surface: "metal", noNav: true });
K.box(7.4, CY, 0, 1.6, 0.12, 16.4, diamond, { surface: "metal", noNav: true });
K.box(0, CY, 7.4, 14.8, 0.12, 1.6, diamond, { surface: "metal", noNav: true });
K.box(0, CY, -7.4, 14.8, 0.12, 1.6, diamond, { surface: "metal", noNav: true });
rail(-8.2, -8.2, -8.2, 8.2, DY); rail(-6.6, -8.2, -6.6, 8.2, DY);
rail(8.2, -8.2, 8.2, 8.2, DY); rail(6.6, -8.2, 6.6, 8.2, DY);
rail(-8.2, 8.2, 8.2, 8.2, DY); rail(-6.6, 6.6, 6.6, 6.6, DY);
rail(-8.2, -8.2, 8.2, -8.2, DY); rail(-6.6, -6.6, 6.6, -6.6, DY);
for (var rb = 0; rb < 4; rb++) {
var ra = rb * Math.PI / 2 + Math.PI / 4;
deco(Math.cos(ra) * 4.9, CY - 0.16, Math.sin(ra) * 4.9, 3.0, 0.2, 0.2, steel, -ra);
}
// 环廊东西两跑楼梯（实心踏步，玩家可上）
for (var sd = -1; sd <= 1; sd += 2) {
for (var st2 = 0; st2 < 15; st2++) {
var sx2 = sd * (8.2 + 0.15 + st2 * 0.3), sh2 = 0.308 * (st2 + 1);
K.box(sx2, 0.4 + sh2 / 2, sd * 5.6, 0.3, sh2, 1.5, diamond, { surface: "metal", noNav: true });
}
for (var sr2 = 0; sr2 < 8; sr2++) {
deco(sd * (8.35 + sr2 * 0.56), 5.15 - sr2 * 0.62, sd * 4.82, 0.07, 1.1, 0.07, yellow);
deco(sd * (8.35 + sr2 * 0.56), 5.58 - sr2 * 0.62, sd * 4.82, 0.6, 0.06, 0.06, yellow);
}
deco(sd * 10.2, 2.7, sd * 5.6, 0.3, 4.6, 0.3, steel);
}
// 北侧二层控制室楼板（东端留楼梯缺口）
K.box(-2.05, 4.42, 16.35, 24.9, 0.24, 6.0, diamond, { surface: "metal", noNav: true });
K.box(12.45, 4.42, 14.32, 4.1, 0.24, 1.95, diamond, { surface: "metal", noNav: true });
for (var mb = -12; mb <= 8; mb += 5) deco(mb, 4.14, 16.35, 0.3, 0.32, 6.0, steel);
K.box(-14.3, 4.7, 16.35, 0.14, 1.0, 6.0, yellow, { surface: "metal", noNav: true });
K.box(-14.3, 4.7, 16.35, 0.08, 0.08, 6.0, steel, { noNav: true });
// 东北角楼梯（12 级，可走到二层）
for (var st = 0; st < 12; st++) {
K.box(12.2, 0.4 + st * 0.34 + 0.17, 18.75 - st * 0.3, 1.6, 0.34, 0.32, diamond, { surface: "metal", noNav: true });
}
deco(12.2, 3.2, 16.6, 1.7, 0.08, 2.2, steel);
for (var sr = 0; sr < 7; sr++) {
var sz = 18.7 - sr * 0.5, sy = 0.4 + sr * 0.62;
deco(11.35, sy + 0.58, sz, 0.07, 1.15, 0.07, yellow);
deco(11.35, sy + 1.1, sz - 0.25, 0.06, 0.06, 0.6, yellow);
}
for (var wa = 0; wa < 12; wa++) {
var aa = wa * Math.PI / 6;
deco(Math.cos(aa) * 5.4, 0.42, Math.sin(aa) * 5.4, 0.42, 0.035, 1.1, warn, -aa);
}
for (var gx = -16; gx <= 16; gx += 4) deco(gx, 0.205, 11.2, 2.4, 0.02, 0.22, warn);
for (var py = 0; py < 3; py++) {
deco(-18.2, 1.4 + py * 1.15, -5.0, 0.16, 0.16, 11.0, conduit);
deco(18.2, 1.4 + py * 1.15, 5.0, 0.16, 0.16, 11.0, conduit);
}
deco(0, 6.75, 11.2, 24, 0.14, 0.14, conduit);
deco(-15.8, 2.9, -12.4, 3.0, 1.1, 0.08, holo);
deco(15.8, 2.9, -12.4, 3.0, 1.1, 0.08, holo);
deco(14.6, 5.15, 12.36, 3.4, 0.8, 0.08, holo, Math.PI);
deco(-14.5, 0.8, 10.4, 1.8, 1.2, 1.2, conduit);
deco(-14.5, 1.5, 10.4, 1.2, 0.2, 0.7, new T.MeshStandardMaterial({ color: 0x8a2018, emissive: 0xff2a14, emissiveIntensity: 1.2, roughness: 0.5 }));
deco(14.5, 0.55, -10.4, 1.4, 0.5, 0.7, new T.MeshStandardMaterial({ color: 0x5a6468, roughness: 0.6, metalness: 0.5 }));
var wetMat = new T.MeshStandardMaterial({ color: 0x1b2226, roughness: 0.23, metalness: 0.45, transparent: true, opacity: 0.19, depthWrite: false });
var wet = new T.Mesh(new T.PlaneGeometry(55, 39), wetMat);
wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.412, 0); wet.renderOrder = 2; K.dyn.add(wet);
var pulse = K.light(0, 4.4, 0, 0xff4a2a, 120, 18);
pulse.userData.sxBlink = { speed: 1.4, min: 70, max: 135, phase: 0.3 };
var strobeW = K.light(-14, 6.2, 8, 0xffd9a6, 54, 9);
strobeW.userData.sxBlink = { speed: 0.7, min: 48, max: 58 };
var strobeE = K.light(14, 6.2, -8, 0xff6a40, 48, 9);
strobeE.userData.sxBlink = { speed: 2.6, min: 22, max: 40, phase: 1.7 };
K.light(0, 6.5, 0, 0xff4a2a, 120, 18);
K.light(-12, 6.0, -6, 0xff6a40, 60, 14);
K.light(12, 6.0, 6, 0xff6a40, 60, 14);
K.light(-12, 6.0, 8, 0xffd9a6, 80, 16);
K.light(12, 6.0, -8, 0xffd9a6, 80, 16);
for (var sx = -12; sx <= 12; sx += 8) {
var strip = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 16), white);
strip.position.set(sx, 7.7, 0); K.root.add(strip);
}
K.label("冷却泵房", -27.05, 4.6, -4.4, 1.57, 3.2, 0.8);
K.label("配电间", 27.05, 4.6, 4.4, -1.57, 3.2, 0.8);
K.label("控制室", -9.0, 4.9, 19.32, Math.PI, 3.4, 0.84);
K.label("气闸 A", 0, 3.9, -19.32, 0, 3.4, 0.84);
K.label("B4-0271", -23.5, 4.85, 19.32, Math.PI, 3.0, 0.7);
K.label("西翼 · 冷却", -18.42, 4.2, 6.0, 1.57, 3.0, 0.72);
K.label("东翼 · 配电", 18.42, 4.2, -6.0, -1.57, 3.0, 0.72);
K.relay("core_r1", -21.6, 3.0, "西侧冷却中继", 0.4);
K.relay("core_r2", -2.6, 8.6, "中央环道中继", 0.4);
K.relay("core_r3", 21.6, 3.0, "东侧配电中继", 0.4);
var ex = new T.Mesh(new T.RingGeometry(1.75, 2.0, 32), new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.55, side: T.DoubleSide }));
ex.rotation.x = -Math.PI / 2; ex.position.set(0, 0.43, -10.4); K.root.add(ex);
var ex2 = new T.Mesh(new T.RingGeometry(0.5, 0.62, 24), new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.35, side: T.DoubleSide }));
ex2.rotation.x = -Math.PI / 2; ex2.position.set(0, 0.431, -10.4); K.root.add(ex2);
K.label("撤离口 · 南闸", 0, 3.0, -12.24, 0, 4.2, 0.95);
K.light(0, 2.0, -10.4, 0x6fe3ff, 26, 8);
if (!window.__SX_MAP_HINTS) window.__SX_MAP_HINTS = {};
window.__SX_MAP_HINTS.core = {
sunIntensity: 0.25, envIntensity: 1.02,
fill: { color: 0xffb08a, intensity: 2.7 },
probes: [
{ name: "core_ring", pos: [0, 4.0, 5.8], range: 17 },
{ name: "core_west", pos: [-14, 3.2, 1.0], range: 14 },
{ name: "core_west_hall", pos: [-23.5, 2.8, 0], range: 13 },
{ name: "core_east_hall", pos: [23.5, 2.8, 0], range: 13 },
{ name: "core_north", pos: [0, 3.4, 16.5], range: 14 },
{ name: "core_ring_west", pos: [-33, 2.8, 0], range: 15 },
{ name: "core_ring_north", pos: [0, 2.8, 24], range: 15 }
],
fx: { embers: 90, sparks: true }
};
return {
playerStart: { pos: new T.Vector3(0, 0.42, 9.6), yaw: 0 },
extraction: { pos: new T.Vector3(0, 0.42, -10.4), radius: 2.6 },
enemySpawns: [
[-14, 8], [14, 8], [-14, -8], [14, -8], [0, 6.0], [0, -6.0],
[-21.5, -6.0], [-21.5, 6.0], [21.5, -6.0], [22.0, 6.6], [-26.99, -16.7], [12, 24],
[-8.0, 16.0], [8.0, 16.0], [-8.0, -16.0], [8.0, -16.0]
].map(function (p) { return { pos: new T.Vector3(p[0], 0.4, p[1]), type: "ground", zone: "core" }; }),
interior: { min: new T.Vector3(-37.7, 0, -27.7), max: new T.Vector3(37.7, 9, 27.7) },
seaOnly: false,
fog: { color: 0x120608, density: 0.017 },
env: { sun: [0.2, 0.9, 0.1], zen: [0.02, 0.01, 0.01], hor: [0.08, 0.03, 0.03], away: [0.02, 0.01, 0.01], col: [0.5, 0.18, 0.12], light: 0xff7a50, intensity: 0.5, exposure: 0.9, envIntensity: 0.8, rain: 0, saturation: 0.95 }
};
}
MapKit.register("core", { id: "core", title: "核心舱", sub: "室内 · 反应堆", build: build });
})();