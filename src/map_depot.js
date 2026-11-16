
  /* =====================================================================
     Map: 冷链仓库（depot）· 室内 CQB
     ===================================================================== */
  (function () {
    function build(K) {
      var T = K.T, G = K.G;
      var H = 7.1;
      // shell (R1 east bay + R2 west cold annex, x -38..38 / z -22..22)
      K.box(0, -0.2, 0, 78, 0.4, 58, "concrete_dirty", { surface: "concrete" });
      K.box(0, H, 0, 78, 0.3, 58, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, -29, 78, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, 29, 78, H, 0.6, "corrugated_roof", { surface: "metal" });
      // R9: outer service walls x=±39 (1m equipment galleries behind the old walls)
      K.box(-39, H / 2, 0, 0.6, H, 58, "corrugated_roof", { surface: "metal" });
      K.box(39, H / 2, 0, 0.6, H, 58, "corrugated_roof", { surface: "metal" });
      // old south wall becomes deep-freeze partition (2 x 4m doors at x=±12)
      K.box(-23, H / 2, -22, 30, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, -22, 8, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(23, H / 2, -22, 30, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(-6, 5.15, -22, 4, 3.9, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(6, 5.15, -22, 4, 3.9, 0.6, "corrugated_roof", { surface: "metal" });
      // old north wall becomes dock partition (2 x 5m truck openings)
      K.box(-25, H / 2, 22, 26, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, 22, 12, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(25, H / 2, 22, 26, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(-9, 5.75, 22, 6, 2.7, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(9, 5.75, 22, 6, 2.7, 0.6, "corrugated_roof", { surface: "metal" });
      // inner walls become partitions with 2m service doors at z=±16
      for (var iw = 0; iw < 2; iw++) {
        var iwx = iw ? 38 : -38;
        K.box(iwx, H / 2, -23, 0.6, H, 12, "corrugated_roof", { surface: "metal" });
        K.box(iwx, H / 2, 0, 0.6, H, 30, "corrugated_roof", { surface: "metal" });
        K.box(iwx, H / 2, 23, 0.6, H, 12, "corrugated_roof", { surface: "metal" });
        K.box(iwx, 4.85, -16, 0.6, 4.5, 2, "corrugated_roof", { surface: "metal" });
        K.box(iwx, 4.85, 16, 0.6, 4.5, 2, "corrugated_roof", { surface: "metal" });
      }
      // old east/west walls become partitions with two 4.2m openings each
      K.box(32, 2.275, -14.0, 0.4, 4.55, 3.2, "corrugated_roof", { surface: "metal" });
      K.box(32, 6.425, -14.0, 0.4, 1.35, 3.2, "corrugated_roof", { surface: "metal" });
      K.box(32, H / 2, -18.8, 0.4, H, 6.4, "corrugated_roof", { surface: "metal" });
      K.box(32, H / 2, -11.25, 0.4, H, 2.3, "corrugated_roof", { surface: "metal" });
      K.box(32, H / 2, 2.0, 0.4, H, 15.8, "corrugated_roof", { surface: "metal" });
      K.box(32, H / 2, 18.05, 0.4, H, 7.9, "corrugated_roof", { surface: "metal" });
      K.box(32, (H + 3.4) / 2, -8.0, 0.4, H - 3.4, 4.2, "corrugated_roof", { surface: "metal" });
      K.box(32, (H + 3.4) / 2, 12.0, 0.4, H - 3.4, 4.2, "corrugated_roof", { surface: "metal" });
      K.box(-32, H / 2, -16.05, 0.4, H, 11.9, "corrugated_roof", { surface: "metal" });
      K.box(-32, H / 2, 2.0, 0.4, H, 15.8, "corrugated_roof", { surface: "metal" });
      K.box(-32, H / 2, 18.05, 0.4, H, 7.9, "corrugated_roof", { surface: "metal" });
      K.box(-32, (H + 3.4) / 2, -8.0, 0.4, H - 3.4, 4.2, "corrugated_roof", { surface: "metal" });
      K.box(-32, (H + 3.4) / 2, 12.0, 0.4, H - 3.4, 4.2, "corrugated_roof", { surface: "metal" });
      // structural beams
      for (var x = -36; x <= 36; x += 6) K.box(x, H - 0.35, 0, 0.28, 0.5, 58, "steel_beam", { surface: "metal", noNav: true });
      for (var z = -19; z <= 19; z += 7) K.box(0, H - 0.62, z, 74, 0.24, 0.28, "steel_beam", { surface: "metal", noNav: true });
      for (var yz = 24.5; yz <= 28.5; yz += 4) K.box(0, H - 0.62, yz, 74, 0.24, 0.28, "steel_beam", { surface: "metal", noNav: true });
      for (var sz2 = -27; sz2 <= -23.5; sz2 += 3.5) K.box(0, H - 0.62, sz2, 74, 0.24, 0.28, "steel_beam", { surface: "metal", noNav: true });
      // painted aisles
      var paint = new T.MeshStandardMaterial({ color: 0xd8a13a, roughness: 0.7, metalness: 0.1, emissive: 0x2a1a05, emissiveIntensity: 0.3 });
      for (var ax = -27; ax <= 27; ax += 12) {
        var line = new T.Mesh(new T.BoxGeometry(0.14, 0.02, 40), paint);
        line.position.set(ax, 0.012, 0); line.receiveShadow = true; K.root.add(line);
      }
      var dock = new T.Mesh(new T.BoxGeometry(11, 0.02, 2.6), paint);
      dock.position.set(0, 0.014, -14.8); K.root.add(dock);

      // shelving rows (double-sided, varied cargo)
      var kMix = ["crate_stack", "pallet_stack", "cardboard_boxes", "ibc_tote", "crate_wood", "barrel"];
      for (var sx = -24; sx <= 24; sx += 12) {
        for (var sz = -16; sz <= 16; sz += 5.5) {
          K.prop("shelf_rack", sx, sz, 0, 0);
          K.prop(kMix[Math.abs(Math.round(sx / 12) * 7 + Math.round((sz + 16) / 5.5)) % 6], sx + 0.2, sz + 1.35, 0.2, 0);
          if (sz % 11 === 0) K.prop("crate_wood", sx - 1.6, sz, 0.7, 0);
        }
      }
      // containers as bulkheads
      K.prop("container20", -26, -20.1, 0, 0);
      K.prop("container20", -14, -20.3, 0.38, 0);
      K.prop("container20", 14, -20.1, 0.1, 0);
      K.prop("container20", 26, -20.2, -0.1, 0);
      K.prop("container40", -27.5, 20.1, -0.35, 0, { noCover: true });
      K.prop("container40", 27.5, 20.1, 0.35, 0, { noCover: true });
      K.prop("reefer_unit", 22.5, -10, 0.4, 0);
      // work floor clutter
      K.prop("forklift", -10, 12.6, 0.4, 0);
      K.prop("forklift", 13, -5.5, -1.2, 0);
      K.prop("pallet_stack", -2, 8.5, 0.2, 0);
      K.prop("pallet_stack", 4, 5.8, -0.4, 0);
      K.prop("barrel", 8.5, 11.2, 0, 0);
      K.prop("barrel", 9.2, 10.3, 0, 0);
      K.prop("ibc_tote", 22, 6, 0.5, 0);
      K.prop("dumpster", -22.8, 7, 1.57, 0);
      K.prop("generator", 23, 13.2, -1.57, 0);
      K.prop("cable_reel", -7, -13, 0.3, 0);
      K.prop("pipe_stack", 16, 9.4, 0.2, 0);
      K.prop("cardboard_boxes", 2.5, 11.5, 0.6, 0);
      K.prop("tarp_cargo", -14, 2.5, 0.4, 0);

      // west catwalk (player-only)
      for (var cz = -12; cz <= 12; cz += 3.1) {
        K.prop("catwalk", -29.2, cz, 1.57, 3.3, { noNav: true, noCover: true });
        K.box(-28.2, 3.55, cz, 0.08, 0.08, 3.1, "steel_beam", { surface: "metal", noNav: true });
      }
      K.prop("stairs_metal", -27.4, 16.6, 0, 0, { noNav: true, noCover: true });
      K.box(-29.2, 3.3, -12, 0.16, 0.9, 0.16, "steel_beam", { surface: "metal", noNav: true });

      // ceiling ducts and wall pipes
      for (var dz = -16; dz <= 16; dz += 5) K.box(0, 6.55, dz, 74, 0.35, 0.55, "steel_beam", { surface: "metal", noNav: true });
      K.box(-37.5, 5.0, 0, 0.28, 0.28, 42, "steel_beam", { surface: "metal", noNav: true });
      K.box(37.5, 5.0, 0, 0.28, 0.28, 42, "steel_beam", { surface: "metal", noNav: true });
      K.box(-37.5, 5.3, -10, 0.5, 0.5, 6, "steel_beam", { surface: "metal", noNav: true });
      K.label("B4-0271", -31.72, 4.3, 6, 1.57, 3.4, 0.8);
      K.label("保持干燥", 31.72, 4.3, -6, -1.57, 3.4, 0.8);

      // ceiling lamps (emissive) + lights
      var lampMat = new T.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc777, emissiveIntensity: 4.5, roughness: 0.35 });
      var lampPos = [[-22, -12], [-8, -12], [8, -12], [22, -12], [-18, 8], [-2, 8], [14, 8], [26, 4], [-6, 18], [18, 18], [-18, -2], [-6, 1], [6, -2], [18, 4]];
      for (var i = 0; i < lampPos.length; i++) {
        var lx = lampPos[i][0], lz = lampPos[i][1];
        var bar = new T.Mesh(new T.BoxGeometry(2.6, 0.16, 0.5), lampMat);
        bar.position.set(lx, H - 0.95, lz); K.root.add(bar);
        K.light(lx, H - 1.25, lz, 0xffd9a6, 110, 24);
      }
      // emergency red at relays
      K.light(-18, 3.6, -12, 0xff2e1c, 26, 10);
      K.light(18, 3.6, -11, 0xff2e1c, 26, 10);
      K.light(2, 3.6, -1, 0xff2e1c, 18, 8);

      // signage
      K.label("B4-0271 · 冷链仓库", 0, 4.2, -21.2, 0, 8.4, 1.35);
      K.label("冷库 A", -31.77, 4.35, -8.0, 1.57, 3.4, 0.85);
      K.label("冷库 B", 31.77, 4.35, 12.0, -1.57, 3.4, 0.85);
      K.label("7 号货位", 0, 3.2, 21.4, 3.14, 4.6, 1.05);

      // east mezzanine / office
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

      /* ---------------- V35 · WP35-6 冷库美术补强 ---------------- */
      var deco = function (x, y, z, w, h, d, m, ry) {
        var o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
        o.position.set(x, y, z); o.rotation.y = ry || 0;
        o.castShadow = true; o.receiveShadow = true; K.root.add(o); return o;
      };
      function blotchTex(seed, col, alpha) {
        var c = document.createElement("canvas"); c.width = c.height = 256;
        var g = c.getContext("2d"); g.clearRect(0, 0, 256, 256);
        var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (var i = 0; i < 170; i++) {
          var x = rnd() * 256, y = rnd() * 256, r = 4 + rnd() * 34;
          var gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, "rgba(" + col + "," + (alpha * (0.35 + rnd() * 0.65)).toFixed(3) + ")");
          gr.addColorStop(0.65, "rgba(" + col + "," + (alpha * 0.35).toFixed(3) + ")");
          gr.addColorStop(1, "rgba(" + col + ",0)");
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
        }
        var tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; return tx;
      }
      var puddleTex = blotchTex(1207, "255,255,255", 0.95);
      puddleTex.repeat.set(20, 16);
      var frostTex = blotchTex(7401, "225,244,255", 0.8);
      frostTex.repeat.set(5, 5);
      var puddleMat = new T.MeshStandardMaterial({
        color: 0x17242b, roughness: 0.22, metalness: 0.55, transparent: true,
        opacity: 0.6, depthWrite: false, alphaMap: puddleTex, envMapIntensity: 1.6
      });
      var puddle = new T.Mesh(new T.PlaneGeometry(74, 58), puddleMat);
      puddle.rotation.x = -Math.PI / 2; puddle.position.set(0, 0.022, 0);
      puddle.renderOrder = 2; puddle.receiveShadow = true; K.dyn.add(puddle);
      var frostMat = new T.MeshStandardMaterial({
        color: 0xd8ecf7, roughness: 0.92, metalness: 0.02, transparent: true,
        opacity: 0.24, depthWrite: false, alphaMap: frostTex
      });
      var frost = new T.Mesh(new T.PlaneGeometry(24, 9), frostMat);
      frost.rotation.x = -Math.PI / 2; frost.position.set(0, 0.025, 17.2);
      frost.renderOrder = 3; K.dyn.add(frost);
      var fogMat = new T.MeshBasicMaterial({
        color: 0xbdd9e8, transparent: true, opacity: 0.055, depthWrite: false,
        side: T.DoubleSide, blending: T.AdditiveBlending
      });
      var fog = new T.Mesh(new T.PlaneGeometry(34, 15), fogMat);
      fog.position.set(0, 1.15, 12.0); fog.rotation.y = 0.2; fog.name = "sx_fog_depot"; fog.userData.sxLod = true;
      K.dyn.add(fog);

      var stripMat = new T.MeshStandardMaterial({ color: 0xbfe9ff, emissive: 0x59b7d6, emissiveIntensity: 3.2, roughness: 0.4 });
      deco(-31.9, 5.85, 0, 0.12, 0.1, 39, stripMat);
      deco(31.9, 5.85, 0, 0.12, 0.1, 39, stripMat);
      deco(-31.9, 5.2, -11.0, 0.1, 0.08, 9.0, stripMat);
      deco(31.9, 5.2, 11.0, 0.1, 0.08, 9.0, stripMat);
      var coldA = K.light(-26, 5.2, 2, 0x9fd4e3, 52, 18);
      var coldB = K.light(26, 5.2, -2, 0x9fd4e3, 52, 18);
      coldA.userData.sxBlink = { speed: 1.7, min: 47, max: 52 };
      coldB.userData.sxBlink = { speed: 1.3, min: 48, max: 52, phase: 2.1 };

      // 二层调度室：控制台 / 监视器 / 墙面图板 / 文件柜 / 线缆槽
      var deskMat = new T.MeshStandardMaterial({ color: 0x2f353a, roughness: 0.62, metalness: 0.35 });
      var screenMat = new T.MeshStandardMaterial({ color: 0x0b2a32, emissive: 0x48b6c8, emissiveIntensity: 2.2, roughness: 0.3 });
      var boardMat = new T.MeshStandardMaterial({ color: 0x16232c, emissive: 0x246a86, emissiveIntensity: 0.9, roughness: 0.7 });
      var cabMat = new T.MeshStandardMaterial({ color: 0x3f4548, roughness: 0.7, metalness: 0.25 });
      deco(28.2, 4.05, 3.6, 2.8, 0.16, 1.0, deskMat);
      deco(28.2, 3.83, 3.6, 2.6, 0.42, 0.84, cabMat);
      deco(27.55, 4.45, 3.55, 0.78, 0.56, 0.12, screenMat, -0.12);
      deco(28.55, 4.45, 3.55, 0.78, 0.56, 0.12, screenMat, 0.08);
      deco(29.35, 4.32, 3.55, 0.42, 0.3, 0.1, screenMat);
      deco(28.2, 4.12, 4.15, 0.62, 0.06, 0.24, cabMat);
      deco(28.2, 3.78, 4.55, 0.48, 0.78, 0.48, cabMat);
      deco(28.2, 3.72, 4.55, 0.42, 0.12, 0.42, new T.MeshStandardMaterial({ color: 0x20262a, roughness: 0.8 }));
      deco(31.0, 5.0, 4.2, 0.18, 1.2, 2.4, boardMat);
      deco(30.2, 4.05, 6.8, 0.7, 1.9, 0.7, cabMat);
      deco(25.1, 5.55, 3.4, 0.18, 0.14, 6.2, cabMat);
      K.light(27.2, 5.35, 3.4, 0xffd9a6, 46, 9);
      K.light(29.4, 4.85, 7.2, 0x6fd4ef, 22, 7);

      // 北侧红色装卸口 + 制冷机组地标
      var portalMat = new T.MeshStandardMaterial({ color: 0x5a1712, emissive: 0xd42a16, emissiveIntensity: 2.0, roughness: 0.5 });
      deco(-7.2, 1.45, 19.55, 0.24, 2.9, 0.26, portalMat);
      deco(7.2, 1.45, 19.55, 0.24, 2.9, 0.26, portalMat);
      deco(0, 2.92, 19.55, 14.6, 0.22, 0.26, portalMat);
      deco(0, 0.74, 19.55, 14.6, 0.12, 0.26, portalMat);
      var danger = K.light(0, 2.4, 18.9, 0xff2e1c, 26, 8);
      danger.userData.sxBlink = { speed: 3.6, min: 3, max: 30, phase: 0.7 };
      // 制冷机组
      var unitMat = new T.MeshStandardMaterial({ color: 0x5a6468, roughness: 0.55, metalness: 0.55 });
      deco(29.0, 2.4, -17.8, 4.4, 4.6, 3.2, unitMat);
      deco(29.0, 4.85, -17.8, 4.6, 0.24, 3.4, cabMat);
      for (var gy = 0; gy < 3; gy++) deco(26.75, 1.2 + gy * 1.25, -17.8, 0.08, 0.64, 1.6, stripMat);
      deco(29.0, 1.6, -17.8, 0.5, 0.5, 3.4, new T.MeshStandardMaterial({ color: 0x8a9498, roughness: 0.4, metalness: 0.7 }));
      K.light(27.0, 3.2, -16.2, 0x8fd8ff, 34, 10);
      K.prop("barrel", 24.0, -15.8, 0, 0);
      K.prop("crate_stack", 24.4, -13.6, 0.4, 0);

      /* ---------------- R1 · 东侧装卸月台（x 32 → 38） ---------------- */
      var eGv = K.mat("steel_galv"), eDm = K.mat("diamond_plate"), eHz = K.mat("hazard_stripes");
      var eRb = K.mat("rubber"), eDk = K.mat("steel_dark"), eCb = K.mat("cardboard");
      var ePr = K.mat("paint_red"), ePy = K.mat("paint_yellow");
      var DOCKY = 1.05, DOORZ = [-8.0, 12.0];
      // 月台台体（混凝土 + 花纹钢板台面，可上人）
      K.box(36.68, DOCKY / 2, 0, 2.05, DOCKY, 40, "concrete_dirty", { surface: "concrete" });
      deco(36.68, DOCKY + 0.015, 0, 1.94, 0.03, 39.7, eDm);
      deco(35.66, DOCKY - 0.07, 0, 0.07, 0.18, 39.7, eHz);
      // 台阶（三级，服务上下月台）
      function eDockSteps(zc) {
        var sw = [0.42, 0.42, 0.64], sx = [34.39, 34.81, 35.34], sy = [0.35, 0.7, 1.05];
        for (var s = 0; s < 3; s++) {
          K.box(sx[s], sy[s] / 2, zc, sw[s], sy[s], 2.5, "concrete_dirty", { surface: "concrete" });
          deco(sx[s] + sw[s] / 2 - 0.035, sy[s] + 0.008, zc, 0.07, 0.016, 2.5, ePy);
        }
        deco(35.65, DOCKY + 0.035, zc, 0.06, 0.05, 2.5, eHz);
        deco(34.32, 1.02, zc + 1.5, 0.14, 0.3, 0.14, eDk);
        deco(34.32, 1.12, zc + 1.5, 0.1, 0.1, 0.1, eLampMat);
        K.light(34.35, 1.35, zc, 0xffd7a0, 24, 7);
        deco(34.45, 1.15, zc - 1.3, 0.07, 0.9, 0.07, eGv, 0);
        deco(34.45, 1.15, zc + 1.3, 0.07, 0.9, 0.07, eGv, 0);
        deco(35.55, 1.62, zc - 1.3, 0.07, 1.1, 0.07, eGv, 0);
        deco(35.55, 1.62, zc + 1.3, 0.07, 1.1, 0.07, eGv, 0);
        deco(35.0, 1.62, zc - 1.3, 1.15, 0.06, 0.06, eGv, 0);
        deco(35.0, 1.62, zc + 1.3, 1.15, 0.06, 0.06, eGv, 0);
      }
      eDockSteps(-15.5);
      eDockSteps(17.0);
      // 月台西侧护栏（台阶处留口）
      var eRail = [[-19.9, -16.8], [-14.2, 15.9], [18.2, 19.9]];
      for (var er = 0; er < eRail.length; er++) {
        var ez0 = eRail[er][0], ez1 = eRail[er][1], elen = ez1 - ez0, ezc = (ez0 + ez1) / 2;
        K.box(35.66, DOCKY + 1.03, ezc, 0.06, 0.07, elen, "steel_galv", { surface: "metal", noNav: true });
        K.box(35.66, DOCKY + 0.53, ezc, 0.05, 0.05, elen, "steel_galv", { surface: "metal", noNav: true });
        for (var ep = ez0 + 0.6; ep < ez1; ep += 2.7) deco(35.66, DOCKY + 0.54, ep, 0.07, 1.05, 0.07, eGv, 0);
      }
      // 卷帘门 + 升降平台 + 门封 / 缓冲 / 指示灯
      var eLampMat = new T.MeshStandardMaterial({ color: 0x0c1a12, emissive: 0x33dd74, emissiveIntensity: 2.4, roughness: 0.4 });
      var eWinMat = new T.MeshStandardMaterial({ color: 0x1c2a31, emissive: 0x7aa9c4, emissiveIntensity: 0.62, roughness: 0.55 });
      var eDoorName = ["DOCK 01", "DOCK 02"];
      for (var ed = 0; ed < 2; ed++) {
        var edz = DOORZ[ed];
        // 门框
        deco(37.63, 2.68, edz - 2.03, 0.16, 3.3, 0.32, eGv, 0);
        deco(37.63, 2.68, edz + 2.03, 0.16, 3.3, 0.32, eGv, 0);
        deco(37.63, 4.32, edz, 0.16, 0.34, 4.38, eGv, 0);
        // 关闭的卷帘叶片
        for (var es = 0; es < 11; es++) deco(37.6, 1.235 + es * 0.29, edz, 0.05, 0.255, 3.72, eGv, 0);
        // 门底冷光缝（室外冷光漏入）
        deco(37.58, 1.105, edz, 0.04, 0.045, 3.6, stripMat, 0);
        // 三面密封帘
        deco(37.5, 2.62, edz - 1.98, 0.24, 3.0, 0.26, eRb, 0);
        deco(37.5, 2.62, edz + 1.98, 0.24, 3.0, 0.26, eRb, 0);
        deco(37.5, 4.14, edz, 0.24, 0.26, 3.92, eRb, 0);
        // 缓冲橡胶块
        deco(37.52, 1.4, edz - 1.46, 0.36, 0.34, 0.3, eRb, 0);
        deco(37.52, 1.4, edz + 1.46, 0.36, 0.34, 0.3, eRb, 0);
        // 卷帘控制箱 / 状态灯
        deco(37.4, 1.55, edz - 2.5, 0.2, 0.55, 0.4, eDk, 0);
        deco(37.28, 1.63, edz - 2.5, 0.04, 0.16, 0.24, eLampMat, 0);
        deco(37.45, 4.62, edz, 0.18, 0.18, 0.55, eDk, 0);
        deco(37.34, 4.62, edz, 0.03, 0.12, 0.4, eLampMat, 0);
        // 门楣标牌
        K.label(eDoorName[ed], 37.54, 5.04, edz, -1.57, 3.4, 0.8);
        // dock leveler：花纹钢板 + 黄黑边
        deco(36.78, DOCKY + 0.04, edz, 1.5, 0.06, 3.0, eDm, 0);
        deco(36.02, DOCKY + 0.07, edz, 0.1, 0.05, 3.0, eHz, 0);
        deco(36.78, DOCKY + 0.03, edz - 1.33, 1.3, 0.04, 0.16, eHz, 0);
        deco(36.78, DOCKY + 0.03, edz + 1.33, 1.3, 0.04, 0.16, eHz, 0);
        deco(36.4, DOCKY + 0.16, edz - 1.52, 0.26, 0.28, 0.34, eDk, 0);
        // 卡车挡块（成对，黄漆）
        deco(34.72, 0.15, edz - 1.72, 0.62, 0.3, 0.34, ePy, 0.3);
        deco(34.72, 0.15, edz + 1.72, 0.62, 0.3, 0.34, ePy, -0.3);
      }
      // 高窗（东墙冷光）
      for (var ewz = -16; ewz <= 16; ewz += 8) {
        deco(37.64, 5.85, ewz, 0.05, 0.95, 5.4, eWinMat, 0);
        deco(37.6, 5.35, ewz, 0.08, 0.1, 5.44, eGv, 0);
        deco(37.6, 6.35, ewz, 0.08, 0.1, 5.44, eGv, 0);
        deco(37.6, 5.85, ewz - 2.72, 0.08, 1.06, 0.14, eGv, 0);
        deco(37.6, 5.85, ewz + 2.72, 0.08, 1.06, 0.14, eGv, 0);
        deco(37.6, 5.85, ewz, 0.08, 1.06, 0.12, eGv, 0);
      }
      // 月台顶灯 + 管线
      for (var ebz = -18; ebz <= 18; ebz += 6) {
        deco(34.25, 6.62, ebz, 0.62, 0.16, 2.5, eDk, 0);
        deco(34.25, 6.53, ebz, 0.44, 0.05, 2.3, lampMat, 0);
      }
      deco(37.48, 5.18, 0, 0.16, 0.16, 39.6, eDk, 0);
      deco(37.3, 5.46, 0, 0.1, 0.1, 39.6, eGv, 0);
      for (var epz = -19; epz <= 19; epz += 4.75) deco(37.5, 5.3, epz, 0.24, 0.3, 0.1, eGv, 0);
      // 月台台面杂物
      K.prop("pallet_stack", 36.7, -2.6, 0.1, DOCKY, { noCover: true });
      K.prop("barrel", 36.85, 8.7, 0, DOCKY, { noCover: true });
      K.prop("crate_stack", 36.6, 17.6, 0.3, DOCKY, { noCover: true });
      K.prop("cardboard_boxes", 36.9, -13.3, 0.2, DOCKY, { noCover: true });
      // 地面黄线 / 车位数 / 禁停斜纹
      function eFloor(x, z, w, d, mat, y) {
        var em = new T.Mesh(new T.PlaneGeometry(w, d), mat);
        em.rotation.x = -Math.PI / 2; em.position.set(x, y || 0.028, z);
        em.receiveShadow = true; K.root.add(em); return em;
      }
      eFloor(32.42, 0, 0.13, 39.5, paint, 0.028);
      eFloor(35.47, 0, 0.13, 39.5, paint, 0.028);
      for (var elz = -18; elz <= 18; elz += 3) eFloor(33.95, elz, 0.1, 1.5, paint, 0.028);
      for (var ebay = 0; ebay < 2; ebay++) {
        var ezb = DOORZ[ebay];
        eFloor(33.95, ezb - 2.05, 2.95, 0.13, paint, 0.028);
        eFloor(33.95, ezb + 2.05, 2.95, 0.13, paint, 0.028);
        eFloor(32.55, ezb, 0.13, 4.2, paint, 0.028);
        eFloor(35.38, ezb, 0.13, 4.2, paint, 0.028);
        for (var ek = 0; ek < 5; ek++) {
          var eStripe = new T.Mesh(new T.PlaneGeometry(0.16, 1.15), eHz);
          eStripe.rotation.x = -Math.PI / 2; eStripe.rotation.z = 0.72;
          eStripe.position.set(32.95 + ek * 0.44, 0.029, ezb);
          K.root.add(eStripe);
        }
      }
      // 地面车位号（canvas 贴花）
      function eFloorText(txt, x, z, sz) {
        var ec = document.createElement("canvas"); ec.width = ec.height = 256;
        var eg = ec.getContext("2d"); eg.clearRect(0, 0, 256, 256);
        eg.fillStyle = "rgba(226,178,66,0.82)"; eg.font = "bold 190px sans-serif";
        eg.textAlign = "center"; eg.textBaseline = "middle"; eg.fillText(txt, 128, 134);
        var etx = new T.CanvasTexture(ec); etx.colorSpace = T.SRGBColorSpace;
        var eem = new T.MeshBasicMaterial({ map: etx, transparent: true, opacity: 0.9, depthWrite: false });
        var epl = new T.Mesh(new T.PlaneGeometry(sz, sz), eem);
        epl.rotation.x = -Math.PI / 2; epl.rotation.z = Math.PI;
        epl.position.set(x, 0.032, z); epl.renderOrder = 4;
        K.root.add(epl);
      }
      eFloorText("01", 33.3, -8.0, 1.35);
      eFloorText("02", 33.3, 12.0, 1.35);
      // 隔墙东面：警示带 / 门洞钢框 / 标牌 / 消防柜
      var eGr = K.mat("paint_grey"), eJam = [-10.1, -5.9, 9.9, 14.1];
      deco(32.24, 0.45, -16.05, 0.05, 0.9, 11.88, eGr, 0);
      deco(32.24, 0.45, 2.0, 0.05, 0.9, 15.78, eGr, 0);
      deco(32.24, 0.45, 18.05, 0.05, 0.9, 7.88, eGr, 0);
      for (var eh = 0; eh < 4; eh++) deco(32.24, 0.42, eJam[eh] + (eh % 2 ? -0.22 : 0.22), 0.07, 0.84, 0.42, eHz, 0);
      for (var ej = 0; ej < eJam.length; ej++) {
        K.box(32.0, 1.7, eJam[ej], 0.5, 3.4, 0.3, "paint_yellow", { surface: "metal" });
        deco(32.0, 3.34, eJam[ej], 0.56, 0.22, 0.34, eHz, 0);
      }
      deco(32.0, 3.44, -8.0, 0.56, 0.2, 4.4, eHz, 0);
      deco(32.0, 3.44, 12.0, 0.56, 0.2, 4.4, eHz, 0);
      K.label("装卸区 B · EAST DOCK", 32.27, 4.95, 2.0, 1.57, 6.4, 1.0);
      K.label("作业中 注意叉车", 32.27, 3.85, -16.0, 1.57, 4.0, 0.78);
      deco(32.24, 1.32, -3.0, 0.16, 0.68, 0.52, ePr, 0);
      deco(32.3, 1.32, -3.0, 0.03, 0.5, 0.38, eDk, 0);
      // 月台区设备与生活痕迹
      K.prop("ibc_tote", 32.78, 9.4, 0.15, 0);
      K.prop("pallet_stack", 33.3, 18.4, 0.25, 0);
      K.prop("pallet", 33.15, 19.7, 0.1, 0);
      K.prop("cardboard_boxes", 33.4, -19.5, 0.4, 0);
      K.prop("barrel", 32.9, -20.2, 0, 0);
      K.prop("toolbox_cart", 32.72, -2.2, 1.57, 0);
      K.prop("traffic_cone", 34.95, -5.55, 0, 0);
      K.prop("traffic_cone", 34.95, 9.55, 0, 0);
      // 手动液压托盘车
      deco(33.55, 0.17, 2.3, 0.1, 0.1, 1.2, ePy, 0);
      deco(33.75, 0.17, 2.3, 0.1, 0.1, 1.2, ePy, 0);
      deco(33.55, 0.28, 1.75, 0.32, 0.24, 0.3, eDk, 0);
      deco(33.55, 0.68, 1.5, 0.06, 0.9, 0.06, eDk, 0.25);
      deco(33.55, 1.1, 1.4, 0.3, 0.08, 0.08, eDk, 0);
      // 月台照明
      K.light(34.2, 6.15, -13, 0xffcf9a, 58, 18);
      K.light(34.2, 6.15, 1, 0xffcf9a, 52, 18);
      K.light(34.2, 6.15, 15, 0xffc98c, 60, 17);
      for (var ed2 = 0; ed2 < 2; ed2++) {
        deco(37.35, 4.55, DOORZ[ed2], 0.16, 0.2, 0.6, eDk, 0);
        deco(37.24, 4.55, DOORZ[ed2], 0.04, 0.13, 0.46, lampMat, 0);
        K.light(37.05, 4.35, DOORZ[ed2], 0xffb066, 34, 8);
      }

      /* R2 · 西侧冷库附属间 + 制冷机房 x -38..-32 */
      var wGv = K.mat("steel_galv"), wWt = K.mat("paint_white"), wBl = K.mat("paint_blue");
      var wDk = K.mat("steel_dark"), wRd = K.mat("paint_red"), wHz = K.mat("hazard_stripes"), wTl = K.mat("paint_teal"), wGr = K.mat("paint_grey");
      var CTOP = 4.6;
      var wPl = new T.MeshStandardMaterial({ color: 0xd6e6ee, transparent: true, opacity: 0.4, roughness: 0.35, depthWrite: false });
      // 冷库顶板 + 隔断（2.4m 门洞） + 内衬板缝
      K.box(-35, CTOP + 0.12, -11, 6, 0.24, 22, "paint_white", { surface: "metal", noNav: true });
      K.box(-37.2, CTOP / 2, 0, 1.6, CTOP, 0.24, "paint_white", { surface: "metal", noNav: true });
      K.box(-33.0, CTOP / 2, 0, 2.0, CTOP, 0.24, "paint_white", { surface: "metal", noNav: true });
      K.box(-35.2, (CTOP + 2.9) / 2, 0, 2.4, CTOP - 2.9, 0.24, "paint_white", { surface: "metal", noNav: true });
      deco(-37.61, 2.28, -11, 0.07, 4.56, 21.7, wWt);
      deco(-35, 2.28, -21.62, 5.9, 4.56, 0.07, wWt);
      for (var ws = -21.2; ws < 0; ws += 1.2) deco(-37.56, 2.28, ws, 0.03, 4.5, 0.045, wDk);
      for (var wx = -37.6; wx < -32.2; wx += 1.2) deco(wx, 2.28, -21.58, 0.045, 4.5, 0.03, wDk);
      // 冷库灯 + 照明
      for (var wz2 = -18; wz2 <= -3; wz2 += 5) {
        deco(-35, CTOP - 0.1, wz2, 2.4, 0.1, 0.28, wDk);
        deco(-35, CTOP - 0.17, wz2, 2.25, 0.05, 0.2, stripMat);
      }
      K.light(-35, 4.1, -14, 0xbfe6ff, 56, 13);
      K.light(-35, 4.1, -5, 0xbfe6ff, 50, 13);
      // 霜冻地面 / 排水沟 / 货架
      deco(-35, 0.033, -11, 5.7, 0.02, 21.5, frostMat);
      deco(-33.4, 0.034, -12, 0.55, 0.02, 17, wDk);
      for (var dg = -20.3; dg < -3.3; dg += 0.9) deco(-33.4, 0.04, dg, 0.5, 0.03, 0.06, wGv);
      for (var rz = -18; rz <= -6; rz += 6) {
        K.prop("shelf_rack", -36.6, rz, 1.57, 0);
        K.prop("pallet_stack", -36.3, rz + 1.15, 1.57, 0);
        K.prop("cardboard_boxes", -36.2, rz - 1.05, 0.2, 0);
      }
      K.prop("ibc_tote", -33.0, -18.6, 0.2, 0);
      K.prop("barrel", -33.1, -20.4, 0, 0);
      // 保温滑门 + 条帘 + 门框 + 温度计
      deco(-35.2, 1.45, 0.16, 2.4, 2.9, 0.14, wWt);
      deco(-35.2, 1.45, 0.245, 2.4, 0.16, 0.03, wBl);
      deco(-36.5, 1.45, 0.16, 0.14, 2.9, 0.3, wGv);
      deco(-33.9, 1.45, 0.16, 0.14, 2.9, 0.3, wGv);
      deco(-35.2, 3.0, 0.16, 2.6, 0.18, 0.3, wGv);
      deco(-35.2, 0.09, 0.16, 2.4, 0.18, 0.2, frostMat);
      for (var ps = 0; ps < 8; ps++) deco(-36.3 + ps * 0.29, 1.5, -0.08, 0.26, 2.4, 0.02, wPl);
      K.label("-18℃ 冷库 A", -35.2, 2.55, 0.16, 0, 2.2, 0.55);
      deco(-33.6, 2.5, -0.4, 0.3, 0.4, 0.16, wDk);
      deco(-33.55, 2.52, -0.49, 0.16, 0.18, 0.02, screenMat);
      // 制冷机组 x2（底座/机头/散热片/立管/阀门/表盘）
      function wUnit(uz) {
        deco(-36.1, 0.16, uz, 2.6, 0.32, 2.7, wDk);
        deco(-36.1, 1.15, uz, 2.0, 1.7, 2.1, wTl);
        deco(-36.9, 1.2, uz, 0.5, 1.0, 0.8, wDk);
        deco(-35.02, 1.2, uz + 0.12, 0.05, 1.15, 0.95, wDk);
        deco(-34.99, 1.2, uz + 0.12, 0.03, 0.95, 0.03, wGv);
        for (var wf = 0; wf < 5; wf++) deco(-35.06, 0.82 + wf * 0.13, uz - 0.62 + wf * 0.3, 0.04, 0.1, 0.22, wDk);
        deco(-36.1, 2.06, uz, 1.7, 0.18, 1.7, wDk);
        deco(-36.1, 2.22, uz, 0.8, 0.14, 0.8, wGv);
        deco(-36.5, 2.45, uz - 0.5, 0.26, 0.28, 0.26, wRd);
        deco(-36.7, 2.55, uz, 1.3, 0.18, 0.18, wGv);
        deco(-37.25, 3.05, uz, 0.22, 2.8, 0.22, wGv);
        deco(-37.25, 4.3, uz, 0.22, 0.22, 2.2, wGv);
        var wh = new T.Mesh(new T.TorusGeometry(0.19, 0.032, 5, 9), wRd);
        wh.position.set(-35.0, 1.95, uz + 0.62); wh.rotation.y = Math.PI / 2; K.root.add(wh);
        deco(-35.05, 1.78, uz + 0.74, 0.05, 0.14, 0.14, wGv);
        deco(-35.05, 1.78, uz + 0.94, 0.05, 0.12, 0.12, wGv);
        eFloor(-36.1, uz, 2.9, 3.0, wHz, 0.031);
      }
      wUnit(5.2); wUnit(15.6);
      // 机房白墙裙 + 顶灯 + 冷库门帘
      deco(-37.6, 1.2, 10.5, 0.06, 2.4, 21, wGr);
      deco(-37.6, 2.45, 10.5, 0.1, 0.1, 21, wDk);
      for (var wl = 2; wl <= 20; wl += 6) {
        deco(-35, 6.55, wl, 2.4, 0.12, 0.3, wDk);
        deco(-35, 6.47, wl, 2.2, 0.05, 0.22, stripMat);
      }
      for (var cs = 0; cs < 11; cs++) deco(-32.0, 1.55, -9.95 + cs * 0.38, 0.02, 2.7, 0.36, wPl);
      deco(-32.0, 2.98, -8, 0.14, 0.16, 4.3, wDk);
      // 墙脚结霜
      deco(-37.54, 0.34, -14, 0.05, 0.68, 5.2, frostMat);
      deco(-37.54, 0.3, -3.4, 0.05, 0.6, 3.4, frostMat);
      deco(-35.2, 0.6, 0.05, 2.6, 1.1, 0.03, frostMat);
      // 屋顶管排 + 支架
      deco(-37.3, 4.45, 10.5, 0.18, 0.18, 21, wGv);
      deco(-37.05, 4.72, 10.5, 0.13, 0.13, 21, wWt);
      for (var pb = 1; pb < 21; pb += 3) deco(-37.3, 4.6, pb, 0.45, 0.45, 0.1, wDk);
      // 风冷冷凝器组（北墙）
      for (var cb = -37; cb <= -33.8; cb += 1.6) {
        deco(cb, 3.3, 20.55, 1.4, 2.6, 0.65, wGv);
        for (var cf = 0; cf < 5; cf++) deco(cb, 2.25 + cf * 0.45, 20.2, 1.2, 0.08, 0.06, wDk);
        var wRing = new T.Mesh(new T.TorusGeometry(0.4, 0.05, 5, 12), wDk);
        wRing.position.set(cb, 3.55, 20.17); K.root.add(wRing);
      }
      // 储液罐
      var wTank = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 2.4, 12), wGv);
      wTank.position.set(-36.9, 1.25, 18.6); wTank.castShadow = wTank.receiveShadow = true; K.root.add(wTank);
      deco(-36.9, 0.1, 18.6, 1.3, 0.2, 1.3, wDk);
      deco(-36.9, 2.62, 18.6, 0.55, 0.16, 0.55, wDk);
      deco(-36.9, 2.82, 18.6, 0.18, 0.5, 0.18, wGv);
      var wBand = new T.Mesh(new T.CylinderGeometry(0.57, 0.57, 0.18, 12, 1, true), wRd);
      wBand.position.set(-36.9, 1.9, 18.6); K.root.add(wBand);
      // 配电柜 x3 + 指示灯
      for (var q = 0; q < 3; q++) {
        var qz = 5.5 + q * 1.35;
        deco(-32.55, 1.1, qz, 0.55, 2.2, 1.1, wDk);
        for (var lv = 0; lv < 5; lv++) deco(-32.26, 1.55 + lv * 0.12, qz, 0.03, 0.05, 0.8, wGv);
        deco(-32.26, 1.92, qz + 0.38, 0.03, 0.06, 0.06, screenMat);
      }
      // 洗眼器 / 消防柜 / 工具车 / 落地杂物
      deco(-37.2, 0.85, 20.4, 0.5, 0.16, 0.42, wGv);
      deco(-37.2, 1.3, 20.62, 0.1, 0.8, 0.1, wGv);
      deco(-37.2, 1.45, 20.4, 0.34, 0.08, 0.3, wBl);
      deco(-32.6, 1.32, -4.4, 0.16, 0.68, 0.52, wRd);
      K.prop("toolbox_cart", -33.1, 3.2, 1.57, 0);
      K.prop("barrel", -33.0, 19.7, 0, 0);
      K.prop("gas_cylinders", -36.7, 2.0, 0.2, 0);
      K.prop("traffic_cone", -34.9, 11.2, 0, 0);
      // 地面标线 / 斑马线 / 标牌
      eFloor(-33.3, 10.6, 0.12, 21.4, paint, 0.031);
      for (var cw = 0; cw < 4; cw++) eFloor(-34.0, 11.4 + cw * 0.5, 3.1, 0.16, paint, 0.031);
      K.label("制冷机房", -32.27, 4.05, 12.0, -1.57, 3.4, 0.8);
      K.label("高压危险 · R404A", -37.58, 3.9, 8.0, 1.57, 4.4, 0.8);
      // 西侧马道吊杆加固
      for (var hz2 = -12; hz2 <= 12; hz2 += 6.2) {
        deco(-29.2, 5.2, hz2, 0.07, 3.75, 0.07, wGv);
        deco(-29.2, 3.38, hz2, 0.9, 0.07, 0.07, wGv);
      }
      // 机房照明 + 报警
      K.light(-35.0, 6.0, 5.5, 0xffe0b8, 95, 19);
      K.light(-35.0, 6.0, 15.5, 0xdfefff, 78, 17);
      var wAlarm = K.light(-36.6, 3.6, 20.0, 0xff2e1c, 22, 9);
      wAlarm.userData.sxBlink = { speed: 2.2, min: 5, max: 24, phase: 1.1 };

      /* R3 · 仓库设备 / 月台锚点 / 顶棚 */
      // 东月台：叉车 + 地磅 + 托盘 + leveler 侧框 + 端墙标牌
      K.prop("forklift", 33.45, 15.2, 1.57, 0);
      K.box(34.55, 0.09, -12.6, 1.8, 0.18, 1.9, "diamond_plate", { surface: "metal" });
      deco(34.55, 0.2, -12.6, 1.7, 0.03, 1.8, eDm);
      deco(34.55, 0.23, -13.52, 1.7, 0.06, 0.08, eHz);
      K.box(32.38, 1.05, -14.9, 0.3, 2.1, 0.34, "steel_galv", { surface: "metal" });
      deco(32.56, 1.8, -14.9, 0.2, 0.5, 0.7, eDk);
      deco(32.68, 1.86, -14.9, 0.03, 0.3, 0.5, screenMat);
      K.prop("pallet_stack", 32.62, -16.9, 0.2, 0);
      K.label("EAST DOCK B · 冷链月台", 34.6, 3.9, 21.62, 3.14, 7.0, 1.1);
      // 笼车（链网围栏 + 轮子）
      function eCage(cx2, cz2) {
        deco(cx2, 0.12, cz2, 1.25, 0.16, 1.0, eDk);
        for (var cc = 0; cc < 4; cc++) deco(cx2 + (cc % 2 ? 0.58 : -0.58), 0.86, cz2 + (cc < 2 ? 0.48 : -0.48), 0.05, 1.6, 0.05, eGv);
        deco(cx2, 1.62, cz2, 1.2, 0.06, 1.0, eGv);
        for (var cb2 = 0; cb2 < 3; cb2++) {
          var by = 0.5 + cb2 * 0.42;
          deco(cx2, by, cz2 - 0.49, 1.16, 0.035, 0.035, eGv);
          deco(cx2, by, cz2 + 0.49, 1.16, 0.035, 0.035, eGv);
          deco(cx2 - 0.59, by, cz2, 0.035, 0.035, 0.96, eGv);
          deco(cx2 + 0.59, by, cz2, 0.035, 0.035, 0.96, eGv);
        }
        deco(cx2, 0.06, cz2 - 0.42, 0.32, 0.12, 0.16, eDk);
        deco(cx2, 0.06, cz2 + 0.42, 0.32, 0.12, 0.16, eDk);
      }
      eCage(32.7, 20.4);
      eCage(32.86, -3.6);
      eCage(32.86, 6.4);
      // 中段打包台 + 吊挂指示牌
      K.box(32.72, 0.55, 3.8, 0.9, 0.1, 1.9, "steel_bare", { surface: "metal" });
      for (var bt = 0; bt < 4; bt++) deco(32.4 + (bt % 2) * 0.64, 0.27, 3.05 + (bt > 1 ? 1.5 : 0), 0.06, 0.54, 0.06, eDk);
      deco(32.72, 1.05, 3.8, 0.6, 0.6, 0.7, eDk);
      deco(32.72, 1.3, 3.45, 0.44, 0.16, 0.05, ePr);
      K.prop("cardboard_boxes", 33.15, 5.0, 0.2, 0);
      var eHang = K.label("分拣 · 打包", 34.1, 4.35, 2.0, 0, 2.6, 0.65);
      eHang.material.side = T.DoubleSide;
      deco(33.1, 5.05, 2.0, 0.05, 1.95, 0.05, eDk);
      deco(35.1, 5.05, 2.0, 0.05, 1.95, 0.05, eDk);
      deco(34.1, 5.05, 2.0, 2.2, 0.06, 0.06, eDk);
      // 卷帘门真实液压坑（坑沿 / 油缸 / 侧板 / 控制柱）
      for (var lp2 = 0; lp2 < 2; lp2++) {
        var lz2 = DOORZ[lp2];
        deco(36.78, DOCKY + 0.075, lz2 - 1.56, 1.56, 0.03, 0.1, eDk);
        deco(36.78, DOCKY + 0.075, lz2 + 1.56, 1.56, 0.03, 0.1, eDk);
        deco(35.99, DOCKY + 0.075, lz2, 0.1, 0.03, 3.0, eDk);
        deco(37.57, DOCKY + 0.075, lz2, 0.1, 0.03, 3.0, eDk);
        for (var cy = 0; cy < 2; cy++) {
          var cyl = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.5, 8), eGv);
          cyl.position.set(36.14, DOCKY + 0.2, lz2 + (cy ? 0.85 : -0.85));
          K.root.add(cyl);
          deco(36.14, DOCKY + 0.02, lz2 + (cy ? 0.85 : -0.85), 0.2, 0.1, 0.2, eDk);
        }
        deco(36.02, DOCKY + 0.13, lz2, 0.14, 0.12, 2.9, eDk);
        deco(36.02, DOCKY + 0.44, lz2, 0.14, 0.08, 2.9, eHz);
        deco(35.92, DOCKY + 0.42, lz2 + 1.72, 0.22, 0.7, 0.34, eDk);
        deco(35.8, DOCKY + 0.52, lz2 + 1.72, 0.03, 0.12, 0.2, lampMat);
      }
      for (var lp = 0; lp < 2; lp++) {
        var lz = DOORZ[lp];
        deco(36.79, DOCKY + 0.07, lz, 1.52, 0.02, 0.06, eDk);
        deco(36.02, DOCKY + 0.08, lz, 0.05, 0.06, 3.0, eDk);
        deco(37.52, DOCKY + 0.08, lz, 0.05, 0.06, 3.0, eDk);
        deco(36.76, DOCKY + 0.06, lz - 1.52, 1.5, 0.04, 0.08, eHz);
        deco(36.76, DOCKY + 0.06, lz + 1.52, 1.5, 0.04, 0.08, eHz);
      }
      // 主仓：打包台 / 地磅旁托盘 / 充电站 / 饮水机 / 消防柜
      K.box(17.5, 0.9, 13.0, 2.0, 0.12, 1.1, "steel_bare", { surface: "metal" });
      for (var tl = 0; tl < 4; tl++) deco(16.6 + (tl % 2) * 1.8, 0.44, 12.55 + (tl > 1 ? 0.9 : 0), 0.08, 0.88, 0.08, eDk);
      deco(17.9, 1.3, 13.0, 0.8, 0.78, 0.7, eDk);
      deco(17.9, 1.56, 12.62, 0.6, 0.2, 0.05, ePr);
      deco(17.9, 1.02, 13.45, 0.5, 0.1, 0.3, ePr);
      K.prop("cardboard_boxes", 15.9, 11.6, 0.3, 0);
      K.prop("cardboard_boxes", 19.2, 14.2, 0.8, 0);
      K.prop("pallet", 17.4, 11.4, 0.1, 0);
      eFloor(17.5, 13.0, 3.0, 2.6, paint, 0.031);
      K.light(17.5, 2.7, 13.0, 0xffd0a0, 30, 7);
      // 充电站（西隔墙）
      deco(-31.55, 1.3, -4.2, 0.3, 0.95, 0.62, eDk);
      deco(-31.55, 1.3, -2.7, 0.3, 0.95, 0.62, eDk);
      deco(-31.4, 1.48, -4.2, 0.03, 0.14, 0.34, screenMat);
      deco(-31.4, 1.48, -2.7, 0.03, 0.14, 0.34, screenMat);
      deco(-31.2, 1.75, -4.2, 0.05, 0.06, 0.5, ePy);
      deco(-31.2, 1.75, -2.7, 0.05, 0.06, 0.5, ePy);
      K.prop("pallet_stack", -30.7, -3.4, 0.15, 0);
      eFloor(-30.8, -3.45, 2.4, 2.7, paint, 0.031);
      // 饮水机 + 消防柜 + 电缆盘
      deco(21.3, 0.55, 9.8, 0.42, 1.1, 0.42, wWt);
      var wBot = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.5, 8), wBl);
      wBot.position.set(21.3, 1.36, 9.8); K.root.add(wBot);
      deco(21.3, 1.0, 9.62, 0.16, 0.14, 0.06, eDk);
      deco(31.68, 1.32, -18.0, 0.16, 0.68, 0.52, ePr);
      deco(-31.66, 1.32, 18.2, 0.16, 0.68, 0.52, ePr);
      // 顶棚喷淋主管 + 下垂管
      deco(0, 6.3, -7, 68, 0.1, 0.1, ePr);
      deco(0, 6.3, 7, 68, 0.1, 0.1, ePr);
      for (var sd = -30; sd <= 30; sd += 6) {
        deco(sd, 6.18, -7, 0.06, 0.26, 0.06, ePr);
        deco(sd, 6.18, 7, 0.06, 0.26, 0.06, ePr);
      }
      // 吊灯增加暖光锚点（4 盏已加入 lampPos）
      // 调度室：椅子 / 打印机 / 台灯 / 储物柜
      deco(27.4, 4.15, 5.0, 0.55, 0.12, 0.55, cabMat);
      deco(27.4, 4.5, 5.03, 0.55, 0.6, 0.1, cabMat);
      deco(27.4, 3.93, 5.0, 0.06, 0.36, 0.06, eDk);
      deco(25.5, 4.0, 5.8, 0.6, 0.45, 0.5, eDk);
      deco(25.5, 4.27, 5.55, 0.5, 0.05, 0.3, eDk);
      deco(28.9, 4.38, 3.15, 0.08, 0.55, 0.08, eDk);
      deco(28.9, 4.68, 3.15, 0.3, 0.08, 0.3, lampMat);
      deco(26.0, 4.6, 7.9, 0.5, 1.8, 0.6, cabMat);

      /* R5 · 二层调度室向南扩平台 + 休息区 */
      K.box(28, 3.7, -13.1, 7.2, 0.3, 6.2, "steel_beam", { surface: "metal" });
      deco(28, 3.87, -13.1, 6.9, 0.03, 5.9, eDm);
      for (var mb = -15.4; mb <= -10.6; mb += 1.6) deco(28, 3.42, mb, 7.0, 0.22, 0.16, eDk);
      var mCol = [[24.8, -15.7], [24.8, -10.5], [31.2, -15.7], [31.2, -10.5]];
      for (var mc = 0; mc < 4; mc++) K.box(mCol[mc][0], 1.8, mCol[mc][1], 0.18, 3.6, 0.18, "steel_beam", { surface: "metal" });
      // 栏杆（西 + 南）
      function mRail(x0, z0, x1, z1) {
        var len = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
        var cx3 = (x0 + x1) / 2, cz3 = (z0 + z1) / 2;
        var w3 = Math.abs(x1 - x0) + 0.06, d3 = Math.abs(z1 - z0) + 0.06;
        K.box(cx3, 4.82, cz3, w3, 0.07, d3, "steel_galv", { surface: "metal", noNav: true });
        K.box(cx3, 4.32, cz3, w3, 0.05, d3, "steel_galv", { surface: "metal", noNav: true });
        for (var rp = 0; rp <= len; rp += 1.4) {
          var px3 = x0 + (x1 - x0) * (rp / len), pz3 = z0 + (z1 - z0) * (rp / len);
          deco(px3, 4.34, pz3, 0.06, 1.05, 0.06, eGv);
        }
      }
      mRail(24.45, -16.1, 24.45, -10.0);
      mRail(24.45, -16.1, 31.55, -16.1);
      // 休息区：地毯 / 桌椅 / 储物柜 / 饮料柜 / 公告板 / 水机
      deco(28.5, 3.89, -13.3, 4.6, 0.02, 4.8, K.mat("tarp"));
      K.box(28.6, 4.28, -13.5, 1.5, 0.08, 0.95, "steel_bare", { surface: "metal" });
      for (var ml = 0; ml < 4; ml++) deco(27.95 + (ml % 2) * 1.3, 3.99, -13.95 + (ml > 1 ? 0.9 : 0), 0.06, 0.58, 0.06, eDk);
      deco(27.7, 4.22, -14.25, 0.5, 0.1, 0.5, cabMat);
      deco(27.7, 4.58, -14.48, 0.5, 0.55, 0.08, cabMat);
      deco(29.5, 4.22, -14.25, 0.5, 0.1, 0.5, cabMat);
      deco(29.5, 4.58, -14.48, 0.5, 0.55, 0.08, cabMat);
      deco(31.25, 4.65, -12.2, 0.5, 1.9, 1.1, wTl);
      deco(31.0, 4.65, -12.2, 0.03, 1.7, 0.9, eDk);
      for (var lk = 0; lk < 4; lk++) deco(31.0, 4.2 + lk * 0.36, -12.2, 0.04, 0.05, 0.7, eGv);
      deco(31.15, 4.35, -10.9, 0.55, 1.3, 0.55, cabMat);
      deco(31.15, 5.02, -10.9, 0.35, 0.12, 0.35, eDk);
      deco(31.15, 4.95, -10.86, 0.14, 0.16, 0.05, eLampMat);
      deco(31.7, 5.45, -11.5, 0.08, 0.9, 2.2, boardMat);
      deco(31.65, 5.45, -11.9, 0.02, 0.5, 0.4, wWt);
      deco(31.65, 5.45, -11.1, 0.02, 0.4, 0.3, wWt);
      deco(24.95, 4.0, -15.35, 0.4, 0.6, 0.4, wWt);
      var mBot = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.45, 8), wPl);
      mBot.position.set(24.95, 4.55, -15.35); K.root.add(mBot);
      // 东隔墙真窗（望向月台）
      deco(32, 5.15, -14.0, 0.05, 1.2, 3.2, K.mat("glass_dirty"));
      deco(32, 4.55, -14.0, 0.16, 0.1, 3.35, eGv);
      deco(32, 5.75, -14.0, 0.16, 0.1, 3.35, eGv);
      deco(32, 5.15, -15.62, 0.16, 1.3, 0.1, eGv);
      deco(32, 5.15, -12.38, 0.16, 1.3, 0.1, eGv);
      for (var mw = 0; mw < 2; mw++) deco(32, 5.15, -14.75 + mw * 1.5, 0.1, 1.2, 0.08, eGv);
      deco(31.72, 4.52, -14.0, 0.34, 0.08, 3.4, eDk);
      // 桌面生活痕迹
      deco(28.5, 4.36, -13.3, 0.32, 0.02, 0.24, wWt);
      var mCup = new T.Mesh(new T.CylinderGeometry(0.07, 0.06, 0.14, 8), wWt);
      mCup.position.set(28.2, 4.4, -13.7); K.root.add(mCup);
      deco(29.1, 4.36, -13.75, 0.18, 0.12, 0.18, ePr);
      // 照明 + 标牌
      K.light(27.4, 6.05, -14.2, 0xffd9a6, 44, 10);
      K.light(30.4, 6.05, -11.6, 0xffe3bd, 36, 9);
      for (var mpl = 0; mpl < 2; mpl++) {
        var mpz = mpl ? -11.6 : -14.2;
        deco(mpl ? 30.4 : 27.4, 6.35, mpz, 0.45, 0.08, 0.45, eDk);
        deco(mpl ? 30.4 : 27.4, 6.28, mpz, 0.3, 0.04, 0.3, lampMat);
      }
      K.label("调度休息区", 31.7, 6.15, -14.3, -1.57, 2.6, 0.6);

      /* R6 · 缠膜货 / 冷雾 / 结霜挂件 */
      for (var wx2 = -24; wx2 <= 24; wx2 += 12) {
        for (var wz2 = -16; wz2 <= 16; wz2 += 5.5) {
          var wi = Math.round(wx2 / 12) * 7 + Math.round((wz2 + 16) / 5.5);
          if (wi % 6 === 0) {
            K.prop("pallet_stack", wx2 - 1.9, wz2 - 1.45, 0.1, 0);
            deco(wx2 - 1.9, 0.72, wz2 - 1.45, 1.14, 1.24, 0.96, wPl);
          }
          if (wi % 9 === 4) K.prop("tire_stack", wx2 - 1.75, wz2 + 1.35, 0, 0);
        }
      }
      // 冷库冷雾（2 片薄雾 + 顶部冰挂）
      var mFog = fogMat;
      for (var wf2 = 0; wf2 < 2; wf2++) {
        var wfp = new T.Mesh(new T.PlaneGeometry(5.4, 2.2), mFog);
        wfp.position.set(-35, 1.05, -7.5 - wf2 * 7.5);
        wfp.rotation.y = wf2 ? 0.22 : -0.18;
        wfp.userData.sxLod = true;
        K.dyn.add(wfp);
      }
      for (var ic = 0; ic < 12; ic++) {
        var icx = ic % 2 ? -37.25 : -32.75, icz = -20.2 + ic * 1.55;
        var ice = new T.Mesh(new T.ConeGeometry(0.055, 0.34, 5), wPl);
        ice.position.set(icx, 4.42, icz); ice.rotation.x = Math.PI; K.root.add(ice);
      }
      /* R7 · 地面导视 / 出口标志 / 生活痕迹 */
      var arrowShape = new T.Shape();
      arrowShape.moveTo(-0.15, -1.1); arrowShape.lineTo(0.15, -1.1); arrowShape.lineTo(0.15, 0.05);
      arrowShape.lineTo(0.48, 0.05); arrowShape.lineTo(0, 0.85); arrowShape.lineTo(-0.48, 0.05);
      arrowShape.lineTo(-0.15, 0.05); arrowShape.closePath();
      var arrowGeo = new T.ShapeGeometry(arrowShape);
      function fArrow(ax, az, ry) {
        var am = new T.Mesh(arrowGeo, paint);
        am.rotation.x = -Math.PI / 2; am.rotation.z = ry;
        am.position.set(ax, 0.034, az); am.receiveShadow = true; K.root.add(am);
      }
      fArrow(-18, 12.5, Math.PI); fArrow(6, 12.5, Math.PI);
      fArrow(-6, -12.5, 0); fArrow(18, -12.5, 0);
      fArrow(34.2, 2.0, Math.PI); fArrow(34.2, -4.0, 0);
      // 悬挂导视（双面）
      function hSign(txt, sx4, sz4, ry, w4) {
        var sm = K.label(txt, sx4, 4.42, sz4, ry, w4, 0.55);
        sm.material.side = T.DoubleSide;
        deco(sx4 - w4 / 2 + 0.2, 5.55, sz4, 0.05, 2.35, 0.05, eDk);
        deco(sx4 + w4 / 2 - 0.2, 5.55, sz4, 0.05, 2.35, 0.05, eDk);
        deco(sx4, 4.71, sz4, w4, 0.05, 0.06, eDk);
        deco(sx4, 4.13, sz4, w4, 0.05, 0.06, eDk);
      }
      hSign("冷库 A ←", -22, 2.0, 0, 2.8);
      hSign("装卸区 →", 18, -1.0, 0, 2.8);
      // 安全出口（绿色发光条 + 标牌）
      for (var ex2 = 0; ex2 < 2; ex2++) {
        var ez2 = ex2 ? 21.4 : -21.4, ey2 = ex2 ? 3.55 : 3.55;
        deco(0, ey2, ez2, 1.5, 0.42, 0.16, eDk);
        deco(0, ey2, ez2 + (ex2 ? -0.1 : 0.1), 1.3, 0.3, 0.05, eLampMat);
        deco(-7.0, ey2, ez2, 1.5, 0.42, 0.16, eDk);
        deco(-7.0, ey2, ez2 + (ex2 ? -0.1 : 0.1), 1.3, 0.3, 0.05, eLampMat);
      }
      // 防溢漏箱 + 湿滑警示 + 叉车停车框
      deco(32.62, 0.55, -10.5, 0.6, 1.1, 0.5, ePy);
      deco(32.62, 1.12, -10.5, 0.64, 0.06, 0.54, eHz);
      deco(32.35, 0.26, -10.5, 0.12, 0.5, 0.62, wWt);
      K.prop("traffic_cone", 33.35, 1.2, 0, 0);
      deco(33.55, 0.55, 1.3, 0.5, 1.0, 0.06, ePy, 0.15);
      deco(33.55, 0.55, 1.3, 0.5, 1.0, 0.06, ePy, -0.15);
      eFloor(34.2, 14.9, 2.2, 0.12, paint, 0.032);
      eFloor(34.2, 16.7, 2.2, 0.12, paint, 0.032);
      eFloor(33.2, 15.8, 0.12, 1.9, paint, 0.032);
      eFloor(35.2, 15.8, 0.12, 1.9, paint, 0.032);

      /* R7 · 北侧卡车场（z 22..29） */
      var yWt = K.mat("paint_white"), yTl = K.mat("paint_teal"), yGr = K.mat("paint_grey");
      // 雨棚 + 支柱
      K.box(0, 4.62, 23.9, 24, 0.18, 3.8, "corrugated_roof", { surface: "metal", noNav: true });
      for (var yc = -11.5; yc <= 11.5; yc += 23) K.box(yc, 2.31, 25.6, 0.3, 4.62, 0.3, "steel_beam", { surface: "metal" });
      // 两个月台门（卷起状态）+ 门柱/缓冲/指示灯/标牌
      for (var yd = 0; yd < 2; yd++) {
        var ydx = yd ? 9 : -9;
        deco(ydx, 4.44, 22.08, 5.6, 0.5, 0.42, eDk);
        deco(ydx, 4.44, 22.32, 5.3, 0.42, 0.12, eGv);
        deco(ydx - 3.04, 2.2, 22.08, 0.18, 4.4, 0.25, eGv);
        deco(ydx + 3.04, 2.2, 22.08, 0.18, 4.4, 0.25, eGv);
        deco(ydx - 2.1, 1.3, 22.42, 0.4, 0.32, 0.3, eRb);
        deco(ydx + 2.1, 1.3, 22.42, 0.4, 0.32, 0.3, eRb);
        deco(ydx, 4.86, 22.06, 0.2, 0.2, 0.5, eDk);
        deco(ydx, 4.86, 22.26, 0.05, 0.14, 0.3, eLampMat);
        K.label(yd ? "TRUCK 02" : "TRUCK 01", ydx, 5.32, 22.34, 0, 3.2, 0.7);
        for (var yl = 0; yl < 4; yl++) deco(ydx - 3.2, 0.4 + yl * 0.42, 22.36, 0.06, 0.06, 0.5, ePy);
      }
      // 拖车 x2（背靠月台）：底盘 / 轮 / 支腿 / 防钻杠
      for (var yt = 0; yt < 2; yt++) {
        var ytx = yt ? 9 : -9;
        K.prop("container20", ytx, 25.4, 1.57, 0.95, { noCover: true });
        deco(ytx, 0.9, 25.4, 2.4, 0.16, 6.1, eDk);
        for (var yax = 0; yax < 2; yax++) for (var ysd = 0; ysd < 2; ysd++) {
          var ywh = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.34, 10), eRb);
          ywh.rotation.z = Math.PI / 2;
          ywh.position.set(ytx + (ysd ? 1.22 : -1.22), 0.5, 23.9 + yax * 1.6);
          K.root.add(ywh);
        }
        deco(ytx - 0.7, 0.45, 28.0, 0.1, 0.9, 0.1, eDk);
        deco(ytx + 0.7, 0.45, 28.0, 0.1, 0.9, 0.1, eDk);
        deco(ytx, 0.55, 28.45, 2.3, 0.1, 0.12, eDk);
        deco(ytx, 1.1, 28.5, 2.5, 2.6, 0.08, eGv);
      }
      // 停放集装箱 / 地磅 / 门卫亭 / 围栏
      K.prop("container40", -20, 27.4, 0, 0, { noCover: true });
      K.prop("container20", 16.2, 27.2, 0, 0, { noCover: true });
      K.box(25, 0.12, 25.1, 7.0, 0.2, 3.0, "diamond_plate", { surface: "metal" });
      deco(25, 0.23, 25.1, 6.9, 0.03, 2.9, eDm);
      deco(25, 0.25, 23.64, 6.9, 0.05, 0.1, eHz);
      deco(25, 0.25, 26.56, 6.9, 0.05, 0.1, eHz);
      deco(21.5, 0.04, 25.1, 0.8, 0.08, 3.0, eDk);
      deco(28.5, 0.04, 25.1, 0.8, 0.08, 3.0, eDk);
      K.box(20.8, 1.1, 23.4, 0.26, 2.2, 0.26, "steel_galv", { surface: "metal" });
      deco(20.8, 1.9, 23.4, 0.3, 0.5, 0.7, eDk);
      deco(20.8, 1.96, 23.4, 0.03, 0.3, 0.5, screenMat);
      K.prop("guard_booth", 31.6, 27.2, 0, 0);
      deco(31.6, 3.2, 27.2, 2.8, 0.12, 2.4, eDk);
      K.light(31.6, 2.6, 26.6, 0xffd7a0, 26, 7);
      for (var yf = 0; yf < 2; yf++) {
        K.prop("fence_panel", 36.6, 23.4 + yf * 3, 1.57, 0, { noCover: true });
        K.prop("fence_panel", -36.6, 23.4 + yf * 3, 1.57, 0, { noCover: true });
      }
      var yBx = [-18, -12.5, -5.5, 5.5, 12.5, 18];
      for (var yb = 0; yb < yBx.length; yb++) K.prop("bollard_post", yBx[yb], 22.7, 0, 0);
      K.prop("jersey_barrier", 14, 23.2, 0, 0);
      K.prop("jersey_barrier", 0, 23.4, 0, 0);
      K.prop("jersey_barrier", -15, 23.2, 0, 0);
      // 堆场杂物（循环批量）
      var yPl = [[-30.5, 24.4], [-30.5, 27.4], [30.5, 23.4], [34.2, 24.6], [-34, 26.6]];
      for (var yp = 0; yp < yPl.length; yp++) K.prop("pallet_stack", yPl[yp][0], yPl[yp][1], 0.2, 0);
      var yBr = [[-32.5, 28], [33.2, 27.9], [12, 28.2], [-12, 28.2]];
      for (var ybr = 0; ybr < yBr.length; ybr++) K.prop("barrel", yBr[ybr][0], yBr[ybr][1], 0, 0);
      K.prop("tire_stack", 32.5, 22.7, 0, 0);
      K.prop("tire_stack", -32.2, 22.8, 0, 0);
      K.prop("cable_reel", 34.2, 26.4, 0.4, 0);
      K.prop("dumpster", 35.0, 26.0, 1.57, 0);
      K.prop("pipe_stack", 18.5, 28.2, 0, 0);
      K.prop("cardboard_boxes", 28.8, 27.8, 0.3, 0);
      K.prop("traffic_cone", 22.5, 24.0, 0, 0);
      K.prop("traffic_cone", 27.5, 24.0, 0, 0);
      K.prop("traffic_cone", 0, 24.6, 0, 0);
      // 堆场标线 / 箭头 / 标牌 / 照明
      eFloor(-9, 25.4, 3.2, 0.14, paint, 0.032);
      eFloor(9, 25.4, 3.2, 0.14, paint, 0.032);
      eFloor(-9, 28.4, 3.2, 0.14, paint, 0.032);
      eFloor(9, 28.4, 3.2, 0.14, paint, 0.032);
      eFloor(0, 23.1, 3.4, 0.14, paint, 0.032);
      eFloor(0, 28.6, 3.4, 0.14, paint, 0.032);
      fArrow(0, 26.4, Math.PI);
      fArrow(14, 26.2, Math.PI);
      K.label("北侧卡车场 · NORTH YARD", 0, 3.9, 28.62, 3.14, 7.4, 1.0);
      for (var yg = -18; yg <= 18; yg += 12) {
        deco(yg, 6.55, 28.3, 2.4, 0.14, 0.5, eDk);
        deco(yg, 6.46, 28.3, 2.2, 0.05, 0.4, lampMat);
      }
      K.light(0, 6.1, 25.6, 0xffd9a6, 105, 27);
      K.light(-22, 5.6, 25.0, 0xcfe4ff, 58, 18);
      K.light(22, 5.6, 25.5, 0xffe3bd, 52, 17);

      /* R8 · 南侧深冷库 / 制冰间（z -29..-22） */
      var dC = K.mat("paint_white"), dPl = K.mat("paint_blue");
      // 保温顶板与内衬
      K.box(0, 4.5, -25.5, 76, 0.22, 7, "paint_white", { surface: "metal", noNav: true });
      deco(0, 2.25, -28.62, 75.6, 4.46, 0.07, dC);
      deco(0, 2.25, -22.42, 75.6, 4.46, 0.07, dC);
      deco(-37.62, 2.25, -25.5, 0.07, 4.46, 6.9, dC);
      deco(37.62, 2.25, -25.5, 0.07, 4.46, 6.9, dC);
      for (var ds = -28.2; ds < -22.4; ds += 1.2) {
        deco(-37.55, 2.25, ds, 0.03, 4.4, 0.05, eDk);
        deco(37.55, 2.25, ds, 0.03, 4.4, 0.05, eDk);
      }
      for (var dx = -37.5; dx < 37.5; dx += 1.2) deco(dx, 2.25, -28.55, 0.05, 4.4, 0.03, eDk);
      // 门洞：卷起门帘/塑料条帘/防撞柱
      for (var dd = 0; dd < 2; dd++) {
        var ddx = dd ? 6 : -6;
        deco(ddx, 3.28, -22.0, 4.2, 0.5, 0.4, eDk);
        deco(ddx, 3.28, -21.75, 3.9, 0.42, 0.12, eGv);
        for (var dp2 = 0; dp2 < 9; dp2++) deco(ddx - 1.9 + dp2 * 0.47, 1.55, -22.0, 0.42, 2.8, 0.02, wPl);
        deco(ddx - 2.15, 1.4, -22.25, 0.16, 2.8, 0.16, ePy);
        deco(ddx + 2.15, 1.4, -22.25, 0.16, 2.8, 0.16, ePy);
        deco(ddx, 4.5, -21.85, 2.8, 0.5, 0.1, eHz);
        K.label(dd ? "DEEP FREEZE 02" : "DEEP FREEZE 01", ddx, 5.05, -21.7, Math.PI, 3.6, 0.7);
      }
      // 货架与冻货（两排）
      var dRx = [-33, -25.7, -18.3, -11, -3.7, 3.7, 11, 18.3, 25.7, 33];
      for (var dr = 0; dr < dRx.length; dr++) {
        K.prop("shelf_rack", dRx[dr], -26.6, 0, 0);
        K.prop(dr % 2 ? "crate_stack" : "pallet_stack", dRx[dr] + 0.3, -25.2, 0.2, 0);
        K.prop(dr % 3 ? "cardboard_boxes" : "ibc_tote", dRx[dr] - 1.5, -24.1, 0.1, 0);
        for (var dsh = 0; dsh < 2; dsh++) K.box(dRx[dr] + (dsh ? 0.7 : -0.7), 2.5 + dsh * 0.6, -26.6, 0.8, 0.4, 0.75, "cardboard", { surface: "wood", noNav: true });
      }
      // 速冻机 4 台 / 制冰机 / 压缩机组
      var dBy = [-22, -7, 7, 22];
      for (var db2 = 0; db2 < 4; db2++) {
        var dbx = dBy[db2];
        K.box(dbx, 1.2, -24.2, 2.2, 2.3, 1.4, "steel_galv", { surface: "metal" });
        deco(dbx, 2.42, -24.2, 2.3, 0.14, 1.5, eDk);
        deco(dbx - 0.6, 1.3, -23.48, 0.6, 1.3, 0.06, screenMat);
        deco(dbx + 0.6, 1.3, -23.48, 0.5, 0.9, 0.06, eDk);
      }
      K.box(0, 0.8, -26.6, 1.8, 1.6, 1.4, "steel_galv", { surface: "metal" });
      deco(0, 1.64, -26.6, 1.9, 0.12, 1.5, eDk);
      deco(0, 1.2, -25.87, 0.7, 0.5, 0.05, screenMat);
      K.box(-28, 0.9, -28.1, 2.4, 1.8, 1.3, "steel_galv", { surface: "metal" });
      K.box(28, 0.9, -28.1, 2.4, 1.8, 1.3, "steel_galv", { surface: "metal" });
      for (var dcp = 0; dcp < 2; dcp++) {
        var dcx = dcp ? 28 : -28;
        deco(dcx, 1.95, -28.1, 2.2, 0.2, 1.2, eDk);
        deco(dcx, 2.1, -28.6, 0.3, 2.6, 0.3, eGv);
        deco(dcx - 0.8, 1.4, -27.42, 0.6, 0.6, 0.05, screenMat);
      }
      // 地沟 / 地脚冰 / 冰挂 / 冷雾
      K.box(0, 0.011, -23.0, 64, 0.022, 0.5, "steel_dark", { surface: "metal" });
      for (var dg2 = -31; dg2 <= 31; dg2 += 1.0) deco(dg2, 0.06, -23.0, 0.06, 0.03, 0.44, eGv);
      deco(0, 0.033, -25.5, 73, 0.02, 6.4, frostMat);
      for (var dic = 0; dic < 18; dic++) {
        var dicx = -36 + dic * 4.2;
        var dice = new T.Mesh(new T.ConeGeometry(0.06, 0.4, 5), wPl);
        dice.position.set(dicx, 4.28, -22.6 - (dic % 3) * 1.4); dice.rotation.x = Math.PI; K.root.add(dice);
      }
      for (var dmf = 0; dmf < 3; dmf++) {
        var dmfp = new T.Mesh(new T.PlaneGeometry(20, 2.4), fogMat);
        dmfp.position.set(-24 + dmf * 24, 1.1, -24.2); dmfp.rotation.y = dmf ? 0.18 : -0.16;
        dmfp.userData.sxLod = true; K.dyn.add(dmfp);
      }
      // 灯光与标牌
      for (var dl2 = 0; dl2 < 6; dl2++) {
        deco(-30 + dl2 * 12, 4.4, -25.2, 2.6, 0.1, 0.3, eDk);
        deco(-30 + dl2 * 12, 4.33, -25.2, 2.4, 0.05, 0.22, stripMat);
      }
      K.light(-24, 4.0, -25.5, 0xbfe6ff, 58, 14);
      K.light(0, 4.0, -25.5, 0xbfe6ff, 58, 14);
      K.light(24, 4.0, -25.5, 0xbfe6ff, 58, 14);
      K.label("深冷库 · DEEP FREEZE -25℃", 0, 3.75, -28.58, 0, 8.4, 1.0);
      K.label("制冰间", -16, 3.2, -28.58, 0, 3.4, 0.7);

      /* R9 · 东西 1m 设备夹层（x -39..-38 / 38..39） */
      for (var gw = 0; gw < 2; gw++) {
        var gx = gw ? 38.5 : -38.5;
        K.box(gx, 5.15, 0, 0.12, 0.12, 56, "steel_galv", { surface: "metal", noNav: true });
        K.box(gx + (gw ? -0.15 : 0.15), 4.85, 0, 0.1, 0.1, 56, "steel_galv", { surface: "metal", noNav: true });
        K.box(gx + (gw ? 0.2 : -0.2), 4.5, 0, 0.14, 0.14, 56, "steel_rust", { surface: "metal", noNav: true });
        for (var gz = -27; gz <= 27; gz += 2.8) K.box(gx, 4.55, gz, 0.28, 0.28, 0.1, "steel_beam", { surface: "metal", noNav: true });
        for (var gv2 = 0; gv2 < 5; gv2++) K.box(gx + (gw ? -0.1 : 0.1), 2.55, -24 + gv2 * 12, 0.14, 5.1, 0.14, "steel_galv", { surface: "metal", noNav: true });
      }
      // 西夹层：冷凝器/储罐/管束/阀门
      for (var gc = 0; gc < 4; gc++) {
        var gcz = -22 + gc * 14;
        K.box(-38.72, 2.7, gcz, 0.5, 1.3, 1.8, "steel_galv", { surface: "metal", noNav: true });
        deco(-38.45, 2.7, gcz, 0.06, 1.1, 1.6, eDk);
        deco(-38.42, 2.7, gcz, 0.04, 0.5, 0.5, screenMat);
      }
      K.box(-38.7, 1.15, 12.5, 0.55, 2.3, 1.5, "steel_galv", { surface: "metal", noNav: true });
      K.box(-38.7, 1.15, 10.0, 0.55, 2.3, 1.5, "steel_galv", { surface: "metal", noNav: true });
      for (var gb = 0; gb < 6; gb++) K.prop("barrel", -38.6, -26 + gb * 10.4, 0, 0);
      // 东夹层：轮胎/备件/货架
      for (var gt = 0; gt < 4; gt++) K.prop("tire_stack", 38.55, -24 + gt * 15, 0, 0);
      for (var gp = 0; gp < 4; gp++) K.prop("pallet_stack", 38.6, -18 + gp * 15.5, 0.2, 0);
      K.prop("shelf_rack", 38.6, 8.0, 1.57, 0);
      K.prop("shelf_rack", 38.6, -8.0, 1.57, 0);
      K.prop("barrel", 38.6, 22.5, 0, 0);
      K.prop("barrel", 38.6, -27.0, 0, 0);
      // 夹层灯带
      for (var gl = -24; gl <= 24; gl += 8) {
        deco(-38.7, 6.3, gl, 0.1, 0.06, 2.2, stripMat);
        deco(38.7, 6.3, gl, 0.1, 0.06, 2.2, stripMat);
      }

      /* R10 · 跨厅马道 + 维修间/更衣柜 */
      K.box(-1.3, 5.0, -18, 51.4, 0.2, 2.4, "diamond_plate", { surface: "metal" });
      K.box(-1.3, 4.86, -19.2, 51.4, 0.16, 0.12, "steel_beam", { surface: "metal", noNav: true });
      K.box(-1.3, 4.86, -16.8, 51.4, 0.16, 0.12, "steel_beam", { surface: "metal", noNav: true });
      K.box(-1.3, 6.08, -19.2, 51.4, 0.07, 0.06, "steel_galv", { surface: "metal", noNav: true });
      K.box(-1.3, 6.08, -16.8, 51.4, 0.07, 0.06, "steel_galv", { surface: "metal", noNav: true });
      for (var cx4 = -27; cx4 <= 24; cx4 += 3) {
        K.box(cx4, 5.55, -19.2, 0.06, 1.1, 0.06, "steel_galv", { surface: "metal", noNav: true });
        K.box(cx4, 5.55, -16.8, 0.06, 1.1, 0.06, "steel_galv", { surface: "metal", noNav: true });
        K.box(cx4, 6.45, -18, 0.05, 0.9, 0.05, "steel_galv", { surface: "metal", noNav: true });
      }
      for (var cc4 = -24; cc4 <= 21; cc4 += 9) K.box(cc4, 2.45, -18, 0.2, 4.9, 0.2, "steel_beam", { surface: "metal" });
      for (var st4 = 0; st4 < 4; st4++) K.box(25.0, 3.86 + st4 * 0.32, -16.95 - st4 * 0.3, 1.4, 0.32, 0.3, "steel_beam", { surface: "metal" });
      // 维修间（x -10..-4 / z -21..-17）
      K.box(-7, 1.4, -17, 6, 2.8, 0.24, "corrugated_roof", { surface: "metal" });
      K.box(-7, 1.4, -21, 6, 2.8, 0.24, "corrugated_roof", { surface: "metal" });
      K.box(-10, 1.4, -19, 0.24, 2.8, 4, "corrugated_roof", { surface: "metal" });
      K.box(-4, 0.8, -20.2, 0.24, 1.6, 1.6, "corrugated_roof", { surface: "metal" });
      K.box(-4, 0.8, -17.8, 0.24, 1.6, 1.6, "corrugated_roof", { surface: "metal" });
      K.box(-4, 2.3, -19, 0.24, 1.0, 4, "corrugated_roof", { surface: "metal" });
      K.box(-7, 0.45, -20.3, 2.2, 0.1, 0.7, "steel_bare", { surface: "metal" });
      K.prop("toolbox_cart", -8.6, -19.2, 0, 0);
      K.prop("shelf_rack", -5.2, -18.2, 1.57, 0);
      K.prop("barrel", -9.3, -17.6, 0, 0);
      K.label("维修间", -7, 2.55, -16.85, 0, 2.2, 0.55);
      // 更衣柜（东侧平台下）
      for (var lk4 = 0; lk4 < 8; lk4++) {
        K.box(24.55, 0.95, -8.4 + lk4 * 0.68, 0.62, 1.9, 0.64, "paint_teal", { surface: "metal" });
        deco(24.24, 1.15, -8.4 + lk4 * 0.68, 0.02, 0.5, 0.5, eDk);
      }
      K.label("更衣室", 24.0, 2.6, -5.8, -1.57, 2.2, 0.55);

      /* R11 · 管线/桥架/消防设备系统 */
      // 主仓两条电缆桥架 + 吊杆
      K.box(0, 6.18, -2, 74, 0.12, 0.5, "steel_galv", { surface: "metal", noNav: true });
      K.box(0, 6.18, 10, 74, 0.12, 0.5, "steel_galv", { surface: "metal", noNav: true });
      for (var hb = -36; hb <= 36; hb += 6) {
        K.box(hb, 6.42, -2, 0.08, 0.42, 0.4, "steel_beam", { surface: "metal", noNav: true });
        K.box(hb, 6.42, 10, 0.08, 0.42, 0.4, "steel_beam", { surface: "metal", noNav: true });
      }
      // 南墙工艺管 + 支架
      K.box(0, 5.25, -21.3, 72, 0.16, 0.16, "paint_red", { surface: "metal", noNav: true });
      K.box(0, 5.55, -21.3, 72, 0.1, 0.1, "steel_galv", { surface: "metal", noNav: true });
      for (var pb2 = -33; pb2 <= 33; pb2 += 6) K.box(pb2, 5.4, -21.3, 0.14, 0.6, 0.3, "steel_beam", { surface: "metal", noNav: true });
      // 深冷库顶管 + 吊架
      for (var fpp = 0; fpp < 2; fpp++) {
        K.box(0, 4.15, -28.3 + fpp * 0.35, 72, 0.12, 0.12, "steel_galv", { surface: "metal", noNav: true });
        for (var fpb = -33; fpb <= 33; fpb += 8.25) K.box(fpb, 4.28, -28.3 + fpp * 0.35, 0.1, 0.26, 0.3, "steel_beam", { surface: "metal", noNav: true });
      }
      // 机房垂直管束/阀门
      for (var vp = 0; vp < 6; vp++) {
        K.box(-36.2 + vp * 0.35, 2.8, 3.0, 0.12, 4.6, 0.12, "steel_galv", { surface: "metal", noNav: true });
        K.box(-36.2 + vp * 0.35, 1.9, 3.15, 0.26, 0.18, 0.18, "paint_red", { surface: "metal", noNav: true });
      }
      // 北场管廊（高位）
      for (var yp2 = 0; yp2 < 4; yp2++) K.box(-30 + yp2 * 8, 4.0, 27.6, 0.18, 2.8, 0.18, "steel_beam", { surface: "metal", noNav: true });
      K.box(-18, 5.4, 27.6, 32, 0.14, 0.14, "steel_galv", { surface: "metal", noNav: true });
      K.box(-18, 5.1, 27.6, 32, 0.1, 0.1, "paint_red", { surface: "metal", noNav: true });
      // 壁挂消防箱
      var fx4 = [[-31.6, 1.35, 12], [31.6, 1.35, 24], [-31.6, 1.35, -18], [31.6, 1.35, 6], [24.2, 1.35, -28.6], [-20, 1.35, -28.6]];
      for (var fi4 = 0; fi4 < fx4.length; fi4++) K.box(fx4[fi4][0], fx4[fi4][1], fx4[fi4][2], 0.34, 0.66, 0.5, "paint_red", { surface: "metal" });

      /* R12 · 标牌与生活痕迹收尾 */
      K.label("设备马道 · 限高 5m", 10, 6.55, -18, 0, 3.2, 0.6);
      K.label("限速 5 · 注意叉车", 0, 3.2, 23.6, Math.PI, 4.2, 0.7);
      var r12p = [[-34, 23.8], [34, 23.8], [22, 28.2], [-22, 28.2]];
      for (var q4 = 0; q4 < r12p.length; q4++) K.prop("barrel", r12p[q4][0], r12p[q4][1], 0, 0);
      var r12q = [[-14, -27.9], [14, -27.9], [6, -27.9], [-6, -27.9]];
      for (var q5 = 0; q5 < r12q.length; q5++) K.prop("pallet_stack", r12q[q5][0], r12q[q5][1], 0.2, 0);

      // relays + extraction
      K.relay("depot_r1", -18, -12.4, "西侧冷却中继");
      K.relay("depot_r2", 2, -1.2, "中央控制中继");
      K.relay("depot_r3", 18, -11.6, "东侧货舱中继");
      // extraction zone (dock)
      var ex = new T.Mesh(new T.RingGeometry(1.8, 2.05, 32), new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.55, side: T.DoubleSide }));
      ex.rotation.x = -Math.PI / 2; ex.position.set(0, 0.03, -14.2); K.root.add(ex);

      // dust/smoke volume markers (visual only)
      K.cover.push(new T.Vector3(-22, 0, 0));
      if (!window.__SX_MAP_HINTS) window.__SX_MAP_HINTS = {};
      window.__SX_MAP_HINTS.depot = {
        sunIntensity: 0.25, envIntensity: 1.18,
        fill: { color: 0xcfe4ff, intensity: 2.35 },
        probes: [
          { name: "depot_aisle", pos: [0, 3.2, 5.0], range: 22 },
          { name: "depot_mezz", pos: [22.5, 4.9, 4.0], range: 14 },
          { name: "depot_dock", pos: [0, 2.6, -14.0], range: 14 },
          { name: "depot_bay", pos: [34.5, 3.4, 0], range: 20 }
        ],
        fx: { frost: 170, drip: 26, coldMist: true }
      };

      return {
        playerStart: { pos: new T.Vector3(0, 0.03, 13.6), yaw: 0 },
        extraction: { pos: new T.Vector3(0, 0.03, -14.2), radius: 2.6 },
        enemySpawns: [
          [-22, -7], [-8, -10], [8, -10], [22, -7], [-22, 3], [-8, 4], [8, 2], [22, 6], [-16, -16], [16, -16], [-27, 17], [27, 18], [0, 12], [0, 25], [0, -21.3]
        ].map(function (p) { return { pos: new T.Vector3(p[0], 0.03, p[1]), type: "ground", zone: "depot" }; }),
        interior: { min: new T.Vector3(-37.7, 0, -21.7), max: new T.Vector3(37.7, H, 28.7) },
        env: { sun: [0.35, 0.8, 0.5], zen: [0.02, 0.025, 0.03], hor: [0.05, 0.055, 0.06], away: [0.02, 0.025, 0.03], col: [0.22, 0.2, 0.18], light: 0x9fb4c8, intensity: 0.6, exposure: 0.92, envIntensity: 0.7, rain: 0, saturation: 0.9 }
      };
    }
    MapKit.register("depot", {
      id: "depot", title: "冷链仓库", sub: "室内 · 冷库", build: build
    });
  })();