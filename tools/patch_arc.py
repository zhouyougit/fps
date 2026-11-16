
import io
p='src/tactics.js'
s=io.open(p,encoding='utf-8').read()

old='''  function ensureArc() {
    if (S.arc) return S.arc;
    var T = G.THREE, N = 26;
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(new Float32Array(N * 3), 3));
    var mat = new T.PointsMaterial({
      color: 0xffb347, size: 0.055, transparent: true, opacity: 0.92,
      depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    });'''
new='''  function arcDotTexture() {
    if (S.arcDotTex) return S.arcDotTex;
    var T = G.THREE;
    var c = document.createElement("canvas");
    c.width = c.height = 48;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(24, 24, 1, 24, 24, 23);
    g.addColorStop(0, "rgba(255,244,222,1)");
    g.addColorStop(0.28, "rgba(255,196,110,0.95)");
    g.addColorStop(0.65, "rgba(255,150,60,0.45)");
    g.addColorStop(1, "rgba(255,140,50,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 48, 48);
    S.arcDotTex = new T.CanvasTexture(c);
    return S.arcDotTex;
  }

  function ensureArc() {
    if (S.arc) return S.arc;
    var T = G.THREE, N = 26;
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(new Float32Array(N * 3), 3));
    var mat = new T.PointsMaterial({
      color: 0xffc477, size: 0.052, map: arcDotTexture(), transparent: true, opacity: 0.9,
      depthWrite: false, alphaTest: 0.02, blending: T.AdditiveBlending, sizeAttenuation: true
    });'''
assert s.count(old)==1
s=s.replace(old,new,1)

old2='''  function grenadeVelocity() {
    var T = G.THREE, P = G.player;
    var fwd = new T.Vector3(P.forward.x, P.forward.y, P.forward.z).normalize();
    var origin = new T.Vector3(P.eye.x, P.eye.y, P.eye.z).addScaledVector(fwd, 0.45);'''
new2='''  function grenadeVelocity() {
    var T = G.THREE, P = G.player;
    var fwd = new T.Vector3(P.forward.x, P.forward.y, P.forward.z).normalize();
    var origin = new T.Vector3(P.eye.x, P.eye.y, P.eye.z).addScaledVector(fwd, 0.8);'''
assert s.count(old2)==1
s=s.replace(old2,new2,1)
io.open(p,'w',encoding='utf-8').write(s)
print('arc dots refined')
