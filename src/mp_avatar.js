/* =====================================================================
   SALTLINE · src/mp_avatar.js — V43 联机士兵模型（程序化）
   ---------------------------------------------------------------------
   目标：把 V36 的“方盒人”升级成参考 CS / 使命召唤 的战术士兵：
     · 1.8m 人体比例，头盔 + 护目镜 + 面罩 + 降噪耳机 + 麦克风；
     · 防弹衣、肩甲、弹匣袋、医疗包、电台、天线、水袋、腰带、腿挂枪套；
     · 战斗靴（鞋底/鞋头/鞋带）、护膝、护肘、战术手套、压缩袖；
     · 带枪管/护木/枪托/握把/弹匣/瞄具/消焰器的步枪与枪带；
     · 团队识别改成低饱和队服 + 臂章/胸章/头盔条（不再整身发光）；
     · 布料使用一次性生成的程序化迷彩贴图，装甲用粗糙度/金属度区分。
   几何按“关节 × 材质”合批：浏览器里每个关节 1–3 个 draw call，
   8 人房不会因为细节翻倍而爆 draw call；在缺少 BufferGeometry 的
   VM 测试桩里自动退回逐件 Mesh，保证逻辑测试可跑。
   调试：window.SX_MP_AVATAR = { build, version, teamColors }
   ===================================================================== */
(function () {
  "use strict";
  if (window.SX_MP_AVATAR) return;

  var VERSION = "V47.1";
  var AV = (window.SX_AVATAR_CONFIG || {});
  var camoCache = null, blobCache = null;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function teamColors(team) {
    var t = (AV.team && (AV.team[team === 1 ? 1 : 0])) || null;
    if (t) return t;
    return team === 1
      ? { fabric: 0x8c7452, accent: 0xff6a55 }
      : { fabric: 0x5f7480, accent: 0x4fa8ff };
  }

  /* ---------------- 程序化迷彩（所有远端共享一张） ---------------- */
  var normalCache = null;
  function normalTexture(T) {
    if (normalCache !== null) return normalCache;
    normalCache = null;
    try {
      var c = document.createElement("canvas");
      c.width = 64; c.height = 64;
      var g = c.getContext && c.getContext("2d");
      if (!g) return null;
      var img = g.createImageData(64, 64);
      for (var i = 0; i < 64 * 64; i++) {
        var nx = (Math.random() - 0.5) * 0.35;
        var ny = (Math.random() - 0.5) * 0.35;
        var nz = Math.sqrt(Math.max(0.01, 1 - nx * nx - ny * ny));
        img.data[i * 4] = (nx * 0.5 + 0.5) * 255;
        img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
        img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      var tex = new T.CanvasTexture(c);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      if (tex.repeat && tex.repeat.set) tex.repeat.set(3.0, 3.0);
      tex.colorSpace = T.NoColorSpace || tex.colorSpace;
      tex.needsUpdate = true;
      normalCache = tex;
      return tex;
    } catch (e) { return null; }
  }

  function blobTexture(T) {
    if (blobCache !== null) return blobCache;
    blobCache = null;
    try {
      var c = document.createElement("canvas");
      c.width = c.height = 64;
      var g = c.getContext && c.getContext("2d");
      if (!g) return null;
      var grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grd.addColorStop(0, "rgba(0,0,0,0.62)");
      grd.addColorStop(0.55, "rgba(0,0,0,0.28)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      var tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      tex.needsUpdate = true;
      blobCache = tex;
      return tex;
    } catch (e) { return null; }
  }

  function camoTexture(T) {
    if (camoCache !== null) return camoCache;
    camoCache = null;
    try {
      var c = document.createElement("canvas");
      c.width = 128; c.height = 128;
      var g = c.getContext && c.getContext("2d");
      if (!g) return null;
      g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, 128, 128);
      var tones = ["#c0c0c0", "#ededed", "#cfcfcf", "#ababab", "#f4f4f4"];
      for (var i = 0; i < 90; i++) {
        g.fillStyle = tones[i % tones.length];
        var x = Math.random() * 128, y = Math.random() * 128;
        var w = 8 + Math.random() * 30, h = 5 + Math.random() * 20;
        g.beginPath();
        g.ellipse(x, y, w * 0.5, h * 0.5, Math.random() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      for (var n = 0; n < 260; n++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(40,40,40,.16)" : "rgba(220,220,220,.12)";
        g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      }
      var tex = new T.CanvasTexture(c);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      if (tex.repeat && tex.repeat.set) tex.repeat.set(2.4, 2.4);
      tex.colorSpace = T.SRGBColorSpace;
      if (T.LinearFilter) { tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearMipmapLinearFilter || T.LinearFilter; }
      tex.needsUpdate = true;
      camoCache = tex;
      return tex;
    } catch (e) { return null; }
  }

  /* ---------------- 几何合批 ---------------- */
  function part(geo, x, y, z, rx, ry, rz, sx, sy, sz) {
    return { g: geo, p: [x || 0, y || 0, z || 0], r: [rx || 0, ry || 0, rz || 0], s: [sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz] };
  }
  function add(list, geo, x, y, z, rx, ry, rz, sx, sy, sz) {
    list.push(part(geo, x, y, z, rx, ry, rz, sx, sy, sz));
    return list;
  }
  function transformGeo(geo, p) {
    var g = geo.clone();
    if (g.scale) g.scale(p.s[0], p.s[1], p.s[2]);
    if (p.r[0] && g.rotateX) g.rotateX(p.r[0]);
    if (p.r[1] && g.rotateY) g.rotateY(p.r[1]);
    if (p.r[2] && g.rotateZ) g.rotateZ(p.r[2]);
    if (p.p[0] || p.p[1] || p.p[2]) g.translate(p.p[0], p.p[1], p.p[2]);
    return g;
  }
  function mergeParts(T, parts) {
    if (!T.BufferGeometry || !T.Float32BufferAttribute || !parts.length) return null;
    var geos = [], total = 0;
    for (var i = 0; i < parts.length; i++) {
      var g = transformGeo(parts[i].g, parts[i]);
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes || !g.attributes.position) return null;
      geos.push(g);
      total += g.attributes.position.count;
    }
    if (!total) return null;
    var pos = new Float32Array(total * 3);
    var nor = new Float32Array(total * 3);
    var uv = new Float32Array(total * 2);
    var o = 0;
    for (var k = 0; k < geos.length; k++) {
      var ge = geos[k];
      var pa = ge.attributes.position, na = ge.attributes.normal, ua = ge.attributes.uv;
      var n = pa.count;
      pos.set(pa.array.subarray(0, n * 3), o * 3);
      if (na && na.array) nor.set(na.array.subarray(0, n * 3), o * 3);
      if (ua && ua.array) uv.set(ua.array.subarray(0, n * 2), o * 2);
      o += n;
    }
    var out = new T.BufferGeometry();
    out.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    out.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    if (out.computeBoundingSphere) out.computeBoundingSphere();
    return out;
  }
  function addBatch(T, group, mat, parts, cast, recv) {
    if (!parts.length) return null;
    var merged = mergeParts(T, parts);
    if (merged) {
      var mesh = new T.Mesh(merged, mat);
      mesh.castShadow = cast !== false;
      mesh.receiveShadow = recv !== false;
      mesh.name = "mp-" + (mat.name || "part");
      group.add(mesh);
      return mesh;
    }
    var last = null;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var m = new T.Mesh(p.g, mat);
      m.position.set(p.p[0], p.p[1], p.p[2]);
      m.rotation.set ? m.rotation.set(p.r[0], p.r[1], p.r[2]) : (m.rotation.x = p.r[0], m.rotation.y = p.r[1], m.rotation.z = p.r[2]);
      m.scale.set(p.s[0], p.s[1], p.s[2]);
      m.castShadow = cast !== false;
      m.receiveShadow = recv !== false;
      m.name = "mp-" + (mat.name || "part");
      group.add(m);
      last = m;
    }
    return last;
  }

  function capsule(T, r, len, cs, rs) {
    if (T.CapsuleGeometry) return new T.CapsuleGeometry(r, len, cs || 4, rs || 8);
    return new T.CylinderGeometry(r, r, len + r * 2, rs || 8);
  }
  function box(T, w, h, d) { return new T.BoxGeometry(w, h, d); }
  function cyl(T, rt, rb, h, seg) { return new T.CylinderGeometry(rt, rb, h, seg || 10); }
  function sph(T, r, ws, hs) { return new T.SphereGeometry(r, ws || 12, hs || 8); }
  function torus(T, r, tube, rs, ts) { return T.TorusGeometry ? new T.TorusGeometry(r, tube, rs || 6, ts || 12) : new T.CylinderGeometry(r, r, tube * 2, 10); }

  /* ---------------- 模型 ---------------- */
  function build(T, team, opts) {
    opts = opts || {};
    var col = teamColors(team);
    var camo = camoTexture(T);
    var nrm = normalTexture(T);
    var M = function (o) { return new T.MeshStandardMaterial(o); };
    var matCfg = AV.materials || {};
    var nsVal = matCfg.normalScale == null ? 0.55 : matCfg.normalScale;
    var ns = T.Vector2 ? new T.Vector2(nsVal, nsVal) : null;
    var fabric = M({ name: "fabric", color: col.fabric, roughness: 0.88, metalness: 0.05, map: camo || null, normalMap: nrm || null, normalScale: ns });
    // 5 种材质：布料 / 装甲 / 装具 / 队标 / 镜片。装具同时承担旧 metal/rubber/face，
    // 减少 8 人同屏的批次数量（V43 性能预算见 bench_mp_avatar）。
    // V45：装甲与装具合并为“战术装具”材质，减少 8 人同屏的材质批次。
    var kit = M({ name: "kit", color: matCfg.kit == null ? 0x4a555c : matCfg.kit, roughness: 0.72, metalness: 0.14, normalMap: nrm || null, normalScale: ns });
    var accent = M({ name: "accent", color: col.accent, emissive: col.accent, emissiveIntensity: 0.18, roughness: 0.42, metalness: 0.25 });
    var glass = M({ name: "glass", color: matCfg.glass == null ? 0x1a1d20 : matCfg.glass, emissive: col.accent, emissiveIntensity: matCfg.glassEmissive == null ? 0.02 : matCfg.glassEmissive, roughness: 0.15, metalness: 0.6 });

    var grp = new T.Group();
    grp.name = "mp-player";
    var propCfg = AV.proportions || {};
    var hips = new T.Group(); hips.position.y = propCfg.standHip == null ? 0.92 : propCfg.standHip; grp.add(hips);
    var torso = new T.Group(); hips.add(torso);
    var head = new T.Group(); head.position.y = 0.66; head.position.z = -0.01;
    var hs = propCfg.headScale == null ? 0.88 : propCfg.headScale;
    head.scale.set(hs, hs, hs); // V47：头部比例来自 config/avatar.js
    hips.add(head);

    /* --- 骨盆 / 腰带 / 腿挂 --- */
    var hf = [], hg = [], ha = [], hm = [];
    add(hf, capsule(T, 0.17, 0.06, 4, 10), 0, 0.01, 0.01, 0, 0, 0, 1.06, 1, 0.78);
    add(hf, capsule(T, 0.165, 0.10, 4, 10), 0, 0.11, 0.01, 0, 0, 0, 1.02, 0.95, 0.76);
    add(hg, cyl(T, 0.205, 0.21, 0.10, 14), 0, 0.10, 0.01, 0, 0, 0, 1, 1, 0.80);
    add(hg, box(T, 0.13, 0.055, 0.035), 0, 0.10, -0.162);
    add(hg, box(T, 0.09, 0.10, 0.06), 0.20, 0.03, -0.02);
    add(hg, box(T, 0.075, 0.09, 0.05), -0.20, 0.03, -0.02);
    add(ha, box(T, 0.15, 0.16, 0.035), 0.18, 0.015, -0.10, 0.05, 0, 0.12);
    add(ha, box(T, 0.13, 0.13, 0.03), -0.18, 0.015, -0.10, 0.05, 0, -0.12);
    addBatch(T, hips, fabric, hf, true, true);
    addBatch(T, hips, kit, hg.concat(ha), true, true);

    /* --- 胸/背：防弹衣 + 弹匣袋 + 电台 + 水袋 --- */
    var tf = [], ta = [], tg = [], tc = [], tm = [];
    add(tf, capsule(T, 0.20, 0.18, 4, 12), 0, 0.31, 0.01, 0, 0, 0, 1.14, 1, 0.78);
    add(tf, capsule(T, 0.17, 0.07, 4, 10), 0, 0.13, 0.01, 0, 0, 0, 1.0, 0.9, 0.76);
    add(tf, cyl(T, 0.115, 0.125, 0.11, 12), 0, 0.56, 0.0, 0, 0, 0, 1, 1, 0.9);
    add(ta, box(T, 0.45, 0.36, 0.065), 0, 0.33, -0.174, -0.08, 0, 0);
    add(ta, box(T, 0.41, 0.33, 0.055), 0, 0.32, 0.162, 0.06, 0, 0);
    add(ta, box(T, 0.075, 0.25, 0.10), 0.235, 0.28, 0, 0, 0, 0.06);
    add(ta, box(T, 0.075, 0.25, 0.10), -0.235, 0.28, 0, 0, 0, -0.06);
    add(ta, box(T, 0.18, 0.12, 0.055), -0.02, 0.465, -0.17, -0.10, 0, 0);
    add(tg, box(T, 0.065, 0.30, 0.05), -0.15, 0.49, -0.10, 0, 0, 0.10);
    add(tg, box(T, 0.065, 0.30, 0.05), 0.15, 0.49, -0.10, 0, 0, -0.10);
    add(tg, box(T, 0.44, 0.09, 0.13), 0, 0.16, 0.0);
    add(tg, box(T, 0.105, 0.13, 0.06), -0.145, 0.275, -0.222);
    add(tg, box(T, 0.105, 0.13, 0.06), 0, 0.275, -0.222);
    add(tg, box(T, 0.105, 0.13, 0.06), 0.145, 0.275, -0.222);
    for (var pi = 0; pi < 3; pi++) add(tg, box(T, 0.012, 0.10, 0.012), -0.145 + pi * 0.145, 0.275, -0.254);
    add(tg, box(T, 0.15, 0.10, 0.045), 0.12, 0.43, -0.205);
    add(tg, box(T, 0.09, 0.11, 0.05), -0.18, 0.445, -0.205);
    add(tg, box(T, 0.12, 0.05, 0.03), 0.19, 0.28, -0.24);
    add(tm, box(T, 0.035, 0.045, 0.025), -0.15, 0.49, -0.216);
    add(tm, box(T, 0.035, 0.045, 0.025), 0.15, 0.49, -0.216);
    add(tc, box(T, 0.10, 0.055, 0.012), 0.15, 0.445, -0.214);
    add(tc, box(T, 0.055, 0.032, 0.012), -0.15, 0.505, -0.214);
    // 背包 / 电台 / 天线 / 水袋
    add(tf, box(T, 0.33, 0.39, 0.17), 0, 0.33, 0.245);
    add(tf, box(T, 0.27, 0.16, 0.07), 0, 0.18, 0.34);
    add(tg, box(T, 0.07, 0.31, 0.06), -0.115, 0.41, 0.285, 0.05, 0, 0.05);
    add(tg, box(T, 0.07, 0.31, 0.06), 0.115, 0.41, 0.285, 0.05, 0, -0.05);
    add(tg, box(T, 0.11, 0.16, 0.055), 0.13, 0.45, 0.355);
    add(tm, cyl(T, 0.008, 0.008, 0.30, 6), 0.13, 0.65, 0.355);
    add(tm, sph(T, 0.016, 6, 5), 0.13, 0.80, 0.355);
    add(tg, box(T, 0.045, 0.22, 0.035), -0.14, 0.36, 0.34, 0, 0, 0.35);
    add(tg, box(T, 0.03, 0.03, 0.16), 0.05, 0.23, 0.33);
    addBatch(T, torso, fabric, tf, true, true);
    addBatch(T, torso, accent, tc, false, false);
    addBatch(T, torso, kit, tg.concat(ta, tm), true, true);

    /* --- 头：头盔 / 护目镜 / 面罩 / 耳机 --- */
    var hf2 = [], ff2 = [], ha2 = [], hg2 = [], hc2 = [], hm2 = [];
    add(hf2, cyl(T, 0.058, 0.066, 0.12, 10), 0, -0.03, 0);
    add(hf2, sph(T, 0.118, 16, 12), 0, 0.10, 0, 0, 0, 0, 1, 1.10, 0.95);
    add(hf2, box(T, 0.135, 0.065, 0.05), 0, 0.015, -0.118);
    add(hf2, box(T, 0.18, 0.05, 0.055), 0, 0.032, -0.095, -0.08, 0, 0);
    add(ff2, box(T, 0.155, 0.07, 0.055), 0, 0.005, -0.115, -0.06, 0, 0);
    add(ff2, cyl(T, 0.058, 0.064, 0.055, 10), 0, 0.055, -0.005, 0, 0, 0, 1, 1, 0.95);
    add(ha2, sph(T, 0.148, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.64), 0, 0.155, 0, 0, 0, 0, 1.04, 1.03, 1.0);
    // 头盔布罩与盔带：打断纯黑球体，接近现代战术头盔
    var hcf = [
      part(sph(T, 0.153, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), 0, 0.152, 0, 0, 0, 0, 1.03, 1.02, 1.0),
      part(cyl(T, 0.15, 0.153, 0.04, 16), 0, 0.14, 0, 0, 0, 0, 1, 1, 1.02)
    ];
    add(ha2, box(T, 0.27, 0.045, 0.08), 0, 0.138, -0.132, -0.12, 0, 0);
    add(hm2, box(T, 0.07, 0.035, 0.04), 0, 0.185, -0.148, -0.08, 0, 0);
    add(ha2, box(T, 0.04, 0.06, 0.14), 0.135, 0.17, -0.01, 0, 0, 0.05);
    add(ha2, box(T, 0.04, 0.06, 0.14), -0.135, 0.17, -0.01, 0, 0, -0.05);
    add(hg2, box(T, 0.185, 0.06, 0.04), 0, 0.105, -0.128);
    add(hg2, box(T, 0.145, 0.032, 0.028), 0, 0.132, -0.148);
    add(hg2, box(T, 0.09, 0.022, 0.018), 0, 0.082, -0.142);
    add(hg2, cyl(T, 0.045, 0.048, 0.04, 10), 0.128, 0.10, 0.02, 0, 0, Math.PI / 2);
    add(hg2, cyl(T, 0.045, 0.048, 0.04, 10), -0.128, 0.10, 0.02, 0, 0, Math.PI / 2);
    add(hg2, box(T, 0.032, 0.022, 0.09), 0.09, 0.055, -0.08);
    add(hg2, cyl(T, 0.006, 0.006, 0.09, 6), 0.086, 0.042, -0.112, 0.62, 0, 0);
    add(hg2, box(T, 0.02, 0.018, 0.15), 0.14, 0.17, -0.02);
    add(hg2, box(T, 0.02, 0.018, 0.15), -0.14, 0.17, -0.02);
    add(hc2, box(T, 0.065, 0.042, 0.01), 0.047, 0.105, -0.15);
    add(hc2, box(T, 0.065, 0.042, 0.01), -0.047, 0.105, -0.15);
    add(hc2, box(T, 0.09, 0.01, 0.007), 0, 0.172, -0.148);
    add(hm2, box(T, 0.055, 0.04, 0.03), 0, 0.205, -0.138);
    add(hm2, box(T, 0.014, 0.014, 0.026), 0.027, 0.19, -0.158);
    add(hm2, box(T, 0.014, 0.014, 0.026), -0.027, 0.19, -0.158);
    addBatch(T, head, fabric, hcf, true, true);
    addBatch(T, head, kit, ha2.concat(hm2, hf2, ff2, hg2), true, true);
    addBatch(T, head, glass, hc2, false, false);

    /* --- 手臂（左右各一组，肩/肘两级） --- */
    var arms = [], elbows = [], hands = [];
    for (var ai = 0; ai < 2; ai++) {
      var side = ai === 0 ? 1 : -1;
      var arm = new T.Group(); arm.position.set(side * 0.25, 0.55, 0); hips.add(arm);
      var uf = [], ua = [], uc = [], ug = [];
      add(uf, capsule(T, 0.070, 0.155, 4, 10), 0, -0.145, 0, 0, 0, 0, 1, 1, 0.95);
      add(ua, box(T, 0.105, 0.055, 0.12), 0, -0.015, -0.012, -0.10, 0, side * 0.12);
      add(ua, box(T, 0.105, 0.095, 0.035), 0, -0.115, -0.072, -0.15, 0, 0);
      add(uc, box(T, 0.03, 0.065, 0.018), side * 0.078, -0.105, -0.018);
      add(ug, box(T, 0.065, 0.04, 0.02), 0, -0.115, 0.072);
      addBatch(T, arm, fabric, uf, true, true);
      addBatch(T, arm, accent, uc, false, false);
      addBatch(T, arm, kit, ua.concat(ug), true, true);

      var elbow = new T.Group(); elbow.position.y = -0.285; arm.add(elbow);
      var lf = [], la = [], lg = [], lm = [];
      var hand = new T.Group(); hand.position.y = -0.325; elbow.add(hand);
      add(la, box(T, 0.075, 0.05, 0.075), 0, -0.005, -0.018, -0.20, 0, 0, 1, 1, 1);
      add(lf, capsule(T, 0.055, 0.155, 4, 10), 0, -0.15, 0, 0, 0, 0, 1, 1, 0.95);
      add(lg, cyl(T, 0.055, 0.058, 0.04, 10), 0, -0.275, 0);
      add(lg, capsule(T, 0.042, 0.04, 4, 8), 0, -0.325, -0.01, 0, 0, 0, 1.0, 1.0, 1.12);
      add(lg, box(T, 0.05, 0.045, 0.06), 0, -0.335, -0.045);
      for (var fi = 0; fi < 4; fi++) add(lg, box(T, 0.011, 0.032, 0.04), -0.018 + fi * 0.012, -0.372, -0.055);
      add(lg, box(T, 0.014, 0.032, 0.03), side * 0.028, -0.35, -0.03);
      add(lm, box(T, 0.022, 0.02, 0.012), side * 0.055, -0.275, 0.0);
      addBatch(T, elbow, kit, la.concat(lm, lg), true, true);
      addBatch(T, elbow, fabric, lf, true, true);
      arms.push(arm); elbows.push(elbow); hands.push(hand);
    }

    /* --- 腿（髋/膝两级） + 战术靴 --- */
    var legs = [], knees = [];
    for (var li = 0; li < 2; li++) {
      var s = li === 0 ? 1 : -1;
      var leg = new T.Group(); leg.position.set(s * 0.13, 0.92, 0); leg.rotation.z = s * -0.035; grp.add(leg);
      var tf2 = [], ta2 = [], tg2 = [], tc2 = [];
      add(tf2, capsule(T, 0.088, 0.19, 4, 10), 0, -0.20, 0, 0, 0, 0, 1, 1, 0.98);
      add(tg2, box(T, 0.105, 0.17, 0.09), s * 0.075, -0.14, -0.015);
      add(tg2, cyl(T, 0.102, 0.102, 0.035, 10), 0, -0.075, 0, 0, 0, 0, 1, 1, 0.92);
      add(ta2, box(T, 0.09, 0.10, 0.04), s * 0.07, -0.31, -0.045, -0.10, 0, 0);
      add(tc2, box(T, 0.022, 0.04, 0.01), s * 0.095, -0.12, -0.055);
      add(tg2, box(T, 0.035, 0.12, 0.025), s * 0.095, -0.23, 0.03);
      addBatch(T, leg, fabric, tf2, true, true);
      addBatch(T, leg, accent, tc2, false, false);
      addBatch(T, leg, kit, tg2.concat(ta2), true, true);

      var knee = new T.Group(); knee.position.y = -0.40; leg.add(knee);
      var sf = [], sa = [], sg = [], sr = [];
      add(sa, box(T, 0.09, 0.06, 0.085), 0, -0.01, -0.045, -0.22, 0, 0, 1, 1, 1);
      add(sf, capsule(T, 0.072, 0.17, 4, 10), 0, -0.18, 0, 0, 0, 0, 1, 1, 0.98);
      add(sg, box(T, 0.115, 0.17, 0.19), 0, -0.375, -0.02);
      add(sg, box(T, 0.105, 0.085, 0.11), 0, -0.405, -0.135);
      add(sg, box(T, 0.03, 0.13, 0.03), 0, -0.40, 0.085);
      add(sg, box(T, 0.085, 0.02, 0.13), 0, -0.30, -0.07);
      for (var bi = 0; bi < 3; bi++) add(sg, box(T, 0.065, 0.008, 0.012), 0, -0.355 + bi * 0.022, -0.105);
      add(sr, box(T, 0.115, 0.042, 0.265), 0, -0.475, -0.045);
      add(sr, box(T, 0.098, 0.028, 0.10), 0, -0.452, -0.13);
      add(sr, box(T, 0.10, 0.032, 0.09), 0, -0.455, 0.06);
      addBatch(T, knee, fabric, sf, true, true);
      addBatch(T, knee, kit, sa.concat(sg, sr), true, true);
      legs.push(leg); knees.push(knee);
    }

    /* --- 步枪（挂在胸前，双臂持枪） --- */
    var weapon = new T.Group(); weapon.position.set(0.06, 1.18, -0.34); grp.add(weapon);
    var rifle = new T.Group(); rifle.rotation.x = -0.06; weapon.add(rifle);
    var wm = [], wg = [], wc = [];
    add(wm, box(T, 0.075, 0.105, 0.33), 0, 0, -0.04);
    add(wm, box(T, 0.062, 0.075, 0.22), 0, 0.005, -0.255);
    add(wm, cyl(T, 0.018, 0.018, 0.31, 8), 0, 0.012, -0.445, Math.PI / 2, 0, 0);
    add(wm, cyl(T, 0.03, 0.03, 0.10, 8), 0, 0.012, -0.575, Math.PI / 2, 0, 0);
    add(wm, box(T, 0.05, 0.022, 0.18), 0, 0.065, -0.09);
    add(wm, box(T, 0.055, 0.02, 0.14), 0, 0.055, -0.25);
    add(wg, box(T, 0.062, 0.095, 0.17), 0, -0.005, 0.225);
    add(wg, box(T, 0.05, 0.095, 0.055), 0, -0.095, 0.12, -0.30, 0, 0);
    add(wg, box(T, 0.05, 0.05, 0.105), 0, 0.095, -0.015);
    add(wg, cyl(T, 0.036, 0.036, 0.105, 10), 0, 0.128, -0.015, Math.PI / 2, 0, 0);
    add(wc, cyl(T, 0.029, 0.029, 0.006, 10), 0, 0.128, -0.073, Math.PI / 2, 0, 0);
    add(wg, box(T, 0.035, 0.075, 0.045), 0, -0.085, -0.215);
    addBatch(T, rifle, kit, wg.concat(wm), true, true);
    addBatch(T, rifle, glass, wc, false, false);
    var mag = new T.Mesh(box(T, 0.047, 0.135, 0.075), kit);
    mag.position.set(0, -0.135, 0.015); mag.castShadow = true; rifle.add(mag);
    var muzzle = new T.Group(); muzzle.position.set(0, 0.012, -0.63); rifle.add(muzzle);

    var shield = new T.Mesh(sph(T, 1.10, 16, 10), new T.MeshBasicMaterial({
      color: col.accent, transparent: true, opacity: 0.10, side: T.DoubleSide, depthWrite: false
    }));
    shield.position.y = 1.02; shield.visible = false; grp.add(shield);

    // V47：落地接触阴影，暗图/水面甲板上更容易判断脚部位置
    var blob = null;
    if (T.PlaneGeometry) {
      var blobCfg = AV.blob || {};
      var bsize = blobCfg.size == null ? 1.15 : blobCfg.size;
      var btex = blobTexture(T);
      var bmat = new T.MeshBasicMaterial({ map: btex || null, color: 0x000000, transparent: true, opacity: blobCfg.opacity == null ? 0.34 : blobCfg.opacity, depthWrite: false });
      blob = new T.Mesh(new T.PlaneGeometry(bsize, bsize), bmat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.012;
      blob.renderOrder = 1;
      blob.castShadow = false;
      blob.receiveShadow = false;
      blob.name = "mp-blob";
      grp.add(blob);
    }

    var tagAnchor = new T.Group(); tagAnchor.position.y = 2.1; grp.add(tagAnchor);
    // 兼容旧调试约定（grp.children >= 8）与后续挂点：两个零成本锚点组
    var rigMeta = new T.Group(); rigMeta.name = "mp-rig-meta"; grp.add(rigMeta);
    var poseMeta = new T.Group(); poseMeta.name = "mp-pose-meta"; grp.add(poseMeta);

    // V49：远距离低模替身（> lod.far）；近处隐藏，远处只保留 3 个轮廓 mesh。
    var far = new T.Group();
    far.name = "mp-far";
    far.visible = false;
    var farBody = [
      part(capsule(T, 0.19, 0.38, 4, 10), 0, 1.06, 0, 0, 0, 0, 1.15, 1.0, 0.8)
    ];
    var farKit = [
      part(sph(T, 0.145, 12, 9), 0, 1.62, 0, 0, 0, 0, 1, 1.08, 1),
      part(box(T, 0.055, 0.08, 0.42), 0.10, 1.24, -0.28, -0.06, 0, 0)
    ];
    addBatch(T, far, fabric, farBody, false, false);
    addBatch(T, far, kit, farKit, false, false);
    grp.add(far);

    // 直接子节点：hips / legL / legR / weapon / shield / tagAnchor / rigMeta / poseMeta / far
    return {
      grp: grp, hips: hips, torso: torso, head: head, legL: legs[0], legR: legs[1],
      kneeL: knees[0], kneeR: knees[1], armL: arms[1], armR: arms[0],
      elbowL: elbows[1], elbowR: elbows[0], handL: hands[1], handR: hands[0], weapon: weapon, rifle: rifle, mag: mag,
      muzzle: muzzle, shield: shield, tagAnchor: tagAnchor, blob: blob, far: far,
      fabric: fabric, accent: accent, glass: glass,
      teamMats: [{ m: fabric, kind: "fabric" }, { m: accent, kind: "accent" }, { m: glass, kind: "accent" }],
      mats: [fabric, accent],
      magBase: { y: -0.135, z: 0.015 },
      muzzleLocal: { x: 0.06, y: 1.192, z: -0.97 },
      parts: 8
    };
  }

  window.SX_MP_AVATAR = { build: build, version: VERSION, teamColors: teamColors, camoTexture: camoTexture };
})();
