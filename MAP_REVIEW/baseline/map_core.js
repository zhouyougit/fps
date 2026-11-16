
  /* =====================================================================
     Map: 核心舱（core）· 联机专用室内图
     ===================================================================== */
  (function () {
    function build(K) {
      var T = K.T;
      var H = 8;
      var deck = K.mat("floor_epoxy", 0x3f4446);
      var wall = K.mat("corrugated_roof", 0x2a2f33);
      var steel = K.mat("steel_beam", 0x4a5052);
      var red = new T.MeshStandardMaterial({ color: 0x8a2018, emissive: 0xff2a14, emissiveIntensity: 2.2, roughness: 0.4 });
      var redSoft = new T.MeshStandardMaterial({ color: 0x5a1a14, emissive: 0x8a1a10, emissiveIntensity: 0.8, roughness: 0.6 });
      var white = new T.MeshStandardMaterial({ color: 0xe8e2d2, emissive: 0xffd9a6, emissiveIntensity: 2.4, roughness: 0.5 });

      // shell
      K.box(0, 0.15, 0, 38, 0.5, 26, deck, { surface: "metal" });
      K.box(0, H, 0, 38, 0.3, 26, wall, { surface: "metal" });
      K.box(0, H / 2, -13, 38, H, 0.6, wall, { surface: "metal" });
      K.box(0, H / 2, 13, 38, H, 0.6, wall, { surface: "metal" });
      K.box(-19, H / 2, 0, 0.6, H, 26, wall, { surface: "metal" });
      K.box(19, H / 2, 0, 0.6, H, 26, wall, { surface: "metal" });
      for (var bx = -15; bx <= 15; bx += 7.5) K.box(bx, H - 0.35, 0, 0.3, 0.5, 26, steel, { surface: "metal", noNav: true });

      // reactor core
      var coreMat = new T.MeshStandardMaterial({ color: 0x2a2f33, metalness: 0.8, roughness: 0.3, emissive: 0x220806, emissiveIntensity: 0.8 });
      var cyl = new T.Mesh(new T.CylinderGeometry(2.6, 3.1, 6.4, 24), coreMat);
      cyl.position.set(0, 3.5, 0); cyl.castShadow = true; K.root.add(cyl);
      K.box(0, 3.5, 0, 6.2, 6.4, 6.2, "steel_painted", { surface: "metal" });
      for (var ring = 0; ring < 3; ring++) {
        var tor = new T.Mesh(new T.TorusGeometry(3.15, 0.1, 8, 32), red);
        tor.rotation.x = Math.PI / 2; tor.position.y = 1.3 + ring * 1.8; K.root.add(tor);
      }
      var glow = new T.Mesh(new T.CylinderGeometry(0.5, 0.7, 6.0, 16), new T.MeshStandardMaterial({ color: 0xff5030, emissive: 0xff3a1c, emissiveIntensity: 5, transparent: true, opacity: 0.8 }));
      glow.position.set(0, 3.5, 0); K.root.add(glow);
      K.label("核心舱 · B4-0271", 0, 6.6, -12.4, 0, 7, 1.1);
      K.label("冷却回路", -18.4, 4.2, 0, 1.57, 3.6, 0.8);

      // coolant tanks + pipes
      for (var i = 0; i < 4; i++) {
        var ang = i * Math.PI / 2 + 0.78;
        var tx = Math.cos(ang) * 9, tz = Math.sin(ang) * 7;
        K.box(tx, 2.2, tz, 2.4, 4.4, 2.4, "steel_painted", { surface: "metal" });
        K.box(tx, 4.6, tz, 1.2, 0.3, 1.2, redSoft, { surface: "metal", noNav: true });
      }
      K.box(-18.6, 3.2, -6, 0.35, 0.35, 10, red, { surface: "metal", noNav: true });
      K.box(18.6, 3.2, 6, 0.35, 0.35, 10, red, { surface: "metal", noNav: true });
      K.box(0, 7.1, -10.5, 30, 0.4, 0.5, steel, { surface: "metal", noNav: true });

      // server racks
      for (var rx = -14; rx <= 14; rx += 7) {
        K.box(rx, 1.0, -11.6, 2.6, 2.0, 0.9, "steel_painted", { surface: "metal" });
        K.box(rx, 1.55, -11.1, 1.8, 0.12, 0.06, red, { surface: "metal", noNav: true });
        K.box(rx, 1.85, -11.1, 1.8, 0.12, 0.06, white, { surface: "metal", noNav: true });
      }
      // crates/cover
      K.prop("crate_stack", -10, 7.5, 0.3, 0.3);
      K.prop("crate_stack", 10, -7.5, 0.9, 0.3);
      K.prop("barrel", -5, -8.5, 0, 0.3);
      K.prop("barrel", -4.2, -8.9, 0, 0.3);
      K.prop("generator", 12, 8.2, -1.2, 0.3);
      K.prop("pallet_stack", -12, -3.5, 0.4, 0.3);

      // catwalk around core (player-only)
      for (var cz = -6; cz <= 6; cz += 3) {
        K.prop("catwalk", -7.2, cz, 1.57, 3.4, { noNav: true, noCover: true });
        K.prop("catwalk", 7.2, cz, 1.57, 3.4, { noNav: true, noCover: true });
      }
      K.prop("stairs_metal", -9.4, 9.2, 0, 0, { noNav: true, noCover: true });
      K.prop("stairs_metal", 9.4, -9.2, Math.PI, 0, { noNav: true, noCover: true });

      /* ---------------- V35 · WP35-6 核心舱美术补强 ---------------- */
      var deco = function (x, y, z, w, h, d, m, ry) {
        var o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
        o.position.set(x, y, z); o.rotation.y = ry || 0;
        o.castShadow = true; o.receiveShadow = true; K.root.add(o); return o;
      };
      var conduit = new T.MeshStandardMaterial({ color: 0x3d4549, roughness: 0.55, metalness: 0.7 });
      var warn = new T.MeshStandardMaterial({ color: 0x4a3a10, emissive: 0xc9a13b, emissiveIntensity: 0.5, roughness: 0.65 });
      var holo = new T.MeshStandardMaterial({ color: 0x0a2f36, emissive: 0x33c6d8, emissiveIntensity: 2.4, roughness: 0.25 });
      // 环形警示带 + 地面导流槽
      for (var wa = 0; wa < 12; wa++) {
        var aa = wa * Math.PI / 6;
        deco(Math.cos(aa) * 5.4, 0.42, Math.sin(aa) * 5.4, 0.42, 0.035, 1.1, warn, -aa);
      }
      for (var gx = -16; gx <= 16; gx += 4) deco(gx, 0.205, 11.2, 2.4, 0.02, 0.22, warn);
      // 冷却管路
      for (var py = 0; py < 3; py++) {
        deco(-18.2, 1.4 + py * 1.15, -5.0, 0.16, 0.16, 11.0, conduit);
        deco(18.2, 1.4 + py * 1.15, 5.0, 0.16, 0.16, 11.0, conduit);
      }
      deco(0, 6.75, 11.2, 24, 0.14, 0.14, conduit);
      // 全息监控屏
      deco(-15.8, 2.9, -12.4, 3.0, 1.1, 0.08, holo);
      deco(15.8, 2.9, -12.4, 3.0, 1.1, 0.08, holo);
      deco(0, 5.4, 12.4, 4.4, 0.9, 0.08, holo);
      // 应急泵组 / 工具箱 / 额外掩体装饰（无碰撞）
      deco(-14.5, 0.8, 10.4, 1.8, 1.2, 1.2, conduit);
      deco(-14.5, 1.5, 10.4, 1.2, 0.2, 0.7, new T.MeshStandardMaterial({ color: 0x8a2018, emissive: 0xff2a14, emissiveIntensity: 1.2, roughness: 0.5 }));
      deco(14.5, 0.55, -10.4, 1.4, 0.5, 0.7, new T.MeshStandardMaterial({ color: 0x5a6468, roughness: 0.6, metalness: 0.5 }));
      // 地面湿膜，给探针反射一点层次
      var wetMat = new T.MeshStandardMaterial({ color: 0x1b2226, roughness: 0.08, metalness: 0.55, transparent: true, opacity: 0.32, depthWrite: false });
      var wet = new T.Mesh(new T.PlaneGeometry(36, 24), wetMat);
      wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.412, 0); wet.renderOrder = 2; K.dyn.add(wet);
      // 反应堆脉冲灯（闪烁）
      var pulse = K.light(0, 4.4, 0, 0xff4a2a, 120, 18);
      pulse.userData.sxBlink = { speed: 1.4, min: 70, max: 135, phase: 0.3 };
      var strobeW = K.light(-14, 6.2, 8, 0xffd9a6, 54, 9);
      strobeW.userData.sxBlink = { speed: 0.7, min: 48, max: 58 };
      var strobeE = K.light(14, 6.2, -8, 0xff6a40, 48, 9);
      strobeE.userData.sxBlink = { speed: 2.6, min: 22, max: 40, phase: 1.7 };

      // lights
      K.light(0, 6.5, 0, 0xff4a2a, 120, 18);
      K.light(-12, 6.0, -6, 0xff6a40, 60, 14);
      K.light(12, 6.0, 6, 0xff6a40, 60, 14);
      K.light(-12, 6.0, 8, 0xffd9a6, 80, 16);
      K.light(12, 6.0, -8, 0xffd9a6, 80, 16);
      // emissive ceiling strips
      for (var sx = -12; sx <= 12; sx += 8) {
        var strip = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 16), white);
        strip.position.set(sx, 7.7, 0); K.root.add(strip);
      }

      if (!window.__SX_MAP_HINTS) window.__SX_MAP_HINTS = {};
      window.__SX_MAP_HINTS.core = {
        sunIntensity: 0.25, envIntensity: 1.02,
        fill: { color: 0xffb08a, intensity: 2.7 },
        probes: [
          { name: "core_ring", pos: [0, 4.0, 5.8], range: 17 },
          { name: "core_west", pos: [-12, 3.2, 1.0], range: 12 }
        ],
        fx: { embers: 90, sparks: true }
      };

      return {
        playerStart: { pos: new T.Vector3(0, 0.42, 9.6), yaw: 0 },
        extraction: { pos: new T.Vector3(0, 0.42, 9.6), radius: 2.6 },
        enemySpawns: [
          [-14, -8], [14, -8], [-14, 8], [14, 8], [-8, 0], [8, 0], [0, -8], [0, 8], [-16, 4], [16, 4]
        ].map(function (p) { return { pos: new T.Vector3(p[0], 0.42, p[1]), type: "ground", zone: "core" }; }),
        interior: { min: new T.Vector3(-18.7, 0, -12.7), max: new T.Vector3(18.7, H, 12.7) },
        seaOnly: false,
        fog: { color: 0x120608, density: 0.028 },
        env: { sun: [0.2, 0.9, 0.1], zen: [0.02, 0.01, 0.01], hor: [0.08, 0.03, 0.03], away: [0.02, 0.01, 0.01], col: [0.5, 0.18, 0.12], light: 0xff7a50, intensity: 0.5, exposure: 0.9, envIntensity: 0.8, rain: 0, saturation: 0.95 }
      };
    }
    MapKit.register("core", { id: "core", title: "核心舱", sub: "室内 · 反应堆", build: build });
  })();