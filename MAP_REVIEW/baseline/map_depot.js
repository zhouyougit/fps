
  /* =====================================================================
     Map: 冷链仓库（depot）· 室内 CQB
     ===================================================================== */
  (function () {
    function build(K) {
      var T = K.T, G = K.G;
      var H = 7.1;
      // shell
      K.box(0, -0.2, 0, 64, 0.4, 44, "concrete_dirty", { surface: "concrete" });
      K.box(0, H, 0, 64, 0.3, 44, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, -22, 64, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(0, H / 2, 22, 64, H, 0.6, "corrugated_roof", { surface: "metal" });
      K.box(-32, H / 2, 0, 0.6, H, 44, "corrugated_roof", { surface: "metal" });
      K.box(32, H / 2, 0, 0.6, H, 44, "corrugated_roof", { surface: "metal" });
      // structural beams
      for (var x = -30; x <= 30; x += 6) K.box(x, H - 0.35, 0, 0.28, 0.5, 44, "steel_beam", { surface: "metal", noNav: true });
      for (var z = -19; z <= 19; z += 7) K.box(0, H - 0.62, z, 64, 0.24, 0.28, "steel_beam", { surface: "metal", noNav: true });
      // painted aisles
      var paint = new T.MeshStandardMaterial({ color: 0xd8a13a, roughness: 0.7, metalness: 0.1, emissive: 0x2a1a05, emissiveIntensity: 0.3 });
      for (var ax = -27; ax <= 27; ax += 12) {
        var line = new T.Mesh(new T.BoxGeometry(0.14, 0.02, 40), paint);
        line.position.set(ax, 0.012, 0); line.receiveShadow = true; K.root.add(line);
      }
      var dock = new T.Mesh(new T.BoxGeometry(11, 0.02, 2.6), paint);
      dock.position.set(0, 0.014, -14.8); K.root.add(dock);

      // shelving rows (double-sided)
      for (var sx = -24; sx <= 24; sx += 12) {
        for (var sz = -16; sz <= 16; sz += 5.5) {
          K.prop("shelf_rack", sx, sz, 0, 0);
          K.prop("crate_stack", sx + 0.2, sz + 1.35, 0.2, 0);
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
      for (var dz = -16; dz <= 16; dz += 5) K.box(0, 6.55, dz, 62, 0.35, 0.55, "steel_beam", { surface: "metal", noNav: true });
      K.box(-31.5, 5.0, 0, 0.28, 0.28, 42, "steel_beam", { surface: "metal", noNav: true });
      K.box(31.5, 5.0, 0, 0.28, 0.28, 42, "steel_beam", { surface: "metal", noNav: true });
      K.box(-31.5, 5.3, -10, 0.5, 0.5, 6, "steel_beam", { surface: "metal", noNav: true });
      K.label("B4-0271", -31.2, 4.3, 6, 1.57, 3.4, 0.8);
      K.label("保持干燥", 31.2, 4.3, -6, -1.57, 3.4, 0.8);

      // ceiling lamps (emissive) + lights
      var lampMat = new T.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc777, emissiveIntensity: 4.5, roughness: 0.35 });
      var lampPos = [[-22, -12], [-8, -12], [8, -12], [22, -12], [-18, 8], [-2, 8], [14, 8], [26, 4], [-6, 18], [18, 18]];
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
      K.label("冷库 A", -28.6, 3.1, -6, 1.57, 3.6, 0.9);
      K.label("冷库 B", 28.6, 3.1, 4, -1.57, 3.6, 0.9);
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
      var frostTex = blotchTex(7401, "225,244,255", 0.8);
      var puddleMat = new T.MeshStandardMaterial({
        color: 0x17242b, roughness: 0.045, metalness: 0.62, transparent: true,
        opacity: 0.72, depthWrite: false, alphaMap: puddleTex, envMapIntensity: 1.6
      });
      var puddle = new T.Mesh(new T.PlaneGeometry(60, 40), puddleMat);
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
      deco(-30.7, 5.85, 0, 0.12, 0.1, 39, stripMat);
      deco(30.7, 5.85, 0, 0.12, 0.1, 39, stripMat);
      deco(-30.7, 5.2, -11.0, 0.1, 0.08, 9.0, stripMat);
      deco(30.7, 5.2, 11.0, 0.1, 0.08, 9.0, stripMat);
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
          { name: "depot_dock", pos: [0, 2.6, -14.0], range: 14 }
        ],
        fx: { frost: 170, drip: 26, coldMist: true }
      };

      return {
        playerStart: { pos: new T.Vector3(0, 0.03, 13.6), yaw: 0 },
        extraction: { pos: new T.Vector3(0, 0.03, -14.2), radius: 2.6 },
        enemySpawns: [
          [-22, -7], [-8, -10], [8, -10], [22, -7], [-22, 3], [-8, 4], [8, 2], [22, 6], [-16, -16], [16, -16], [-27, 17], [27, 18], [0, 12], [0, 19]
        ].map(function (p) { return { pos: new T.Vector3(p[0], 0.03, p[1]), type: "ground", zone: "depot" }; }),
        interior: { min: new T.Vector3(-31.7, 0, -21.7), max: new T.Vector3(31.7, H, 21.7) },
        env: { sun: [0.35, 0.8, 0.5], zen: [0.02, 0.025, 0.03], hor: [0.05, 0.055, 0.06], away: [0.02, 0.025, 0.03], col: [0.22, 0.2, 0.18], light: 0x9fb4c8, intensity: 0.6, exposure: 0.92, envIntensity: 0.7, rain: 0, saturation: 0.9 }
      };
    }
    MapKit.register("depot", {
      id: "depot", title: "冷链仓库", sub: "室内 · 冷库", build: build
    });
  })();