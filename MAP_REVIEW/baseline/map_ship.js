
  /* =====================================================================
     Map: 货轮甲板（ship）· 干船坞式外锚地
     ===================================================================== */
  (function () {
    function build(K) {
      var T = K.T;
      var deck = K.mat("floor_epoxy", 0x5a5f5c);
      var hull = K.mat("hull_red", 0x7b2b24);
      var paint = K.mat("hull_paint", 0x9aa3a4);
      var steel = K.mat("steel_beam", 0x4a5052);
      var yellow = new T.MeshStandardMaterial({ color: 0xc9a13b, roughness: 0.7, metalness: 0.25 });

      // deck
      K.box(0, 0.05, 0, 54, 0.5, 20, deck, { surface: "metal" });
      // hull sides + stern + bow
      K.box(-26.6, 0.9, 0, 0.9, 1.2, 20, hull, { surface: "metal" });
      K.box(26.6, 0.9, 0, 0.9, 1.2, 20, hull, { surface: "metal" });
      K.box(0, 0.9, 9.6, 54, 1.2, 0.9, hull, { surface: "metal" });
      K.box(0, 0.9, -9.6, 46, 1.2, 0.9, hull, { surface: "metal" });
      K.box(0, 0.45, -10.4, 44, 0.9, 0.8, hull, { surface: "metal" });

      // deck markings
      var line = new T.MeshStandardMaterial({ color: 0xd8a13a, roughness: 0.7, metalness: 0.1 });
      for (var lx = -20; lx <= 20; lx += 10) {
        var m = new T.Mesh(new T.BoxGeometry(0.12, 0.02, 16), line);
        m.position.set(lx, 0.36, 0); K.root.add(m);
      }

      // bridge / superstructure (stern)
      K.box(0, 3.1, 8, 11.5, 5.6, 3.6, paint, { surface: "metal" });
      K.box(0, 6.0, 8, 11.9, 0.3, 4.0, steel, { surface: "metal" });
      K.box(0, 3.4, 6.15, 10.5, 0.18, 0.18, steel, { surface: "metal", noNav: true });
      var win = new T.MeshStandardMaterial({ color: 0x8fc9d8, emissive: 0x2c6b7a, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2 });
      K.box(0, 4.4, 6.12, 9.8, 0.9, 0.08, win, { surface: "glass", noNav: true });
      K.box(0, 6.4, 8, 0.4, 2.2, 0.4, steel, { surface: "metal", noNav: true });
      K.label("水滴保险 · B4-0271", 0, 3.4, 6.0, Math.PI, 6.4, 1.1);

      // cargo hatch (dark steel with yellow safety border)
      K.box(0, 0.42, 0, 15.6, 0.22, 7.0, K.mat("steel_painted", 0x4a5052), { surface: "metal" });
      K.box(0, 0.55, -3.55, 15.8, 0.06, 0.16, yellow, { surface: "metal", noNav: true });
      K.box(0, 0.55, 3.55, 15.8, 0.06, 0.16, yellow, { surface: "metal", noNav: true });
      K.box(-7.9, 0.55, 0, 0.16, 0.06, 7.1, yellow, { surface: "metal", noNav: true });
      K.box(7.9, 0.55, 0, 0.16, 0.06, 7.1, yellow, { surface: "metal", noNav: true });
      K.label("7 号货舱", 0, 1.5, -3.8, 0, 3.6, 0.8);

      // containers (lashings)
      K.prop("container20", -18, 5.6, 0, 0.3);
      K.prop("container20", 18, 5.6, 0, 0.3);
      K.prop("container20", -18, -3.4, 0, 0.3);
      K.prop("container20", 18, -3.4, 0, 0.3);
      K.prop("container20", -12, 0.8, 1.57, 0.3);
      K.prop("pallet_stack", -8, 7.2, 0.3, 0.3);
      K.prop("barrel", 8, 7.0, 0, 0.3);
      K.prop("barrel", 8.7, 6.3, 0, 0.3);
      K.prop("crate_stack", 12, -7.2, 0.4, 0.3);
      K.prop("forklift", -22, -6.6, 0.5, 0.3);
      K.prop("floodlight_stand", 22, 0.5, -1.2, 0.3);

      // crane mast / boom
      K.box(-22, 4.2, -1, 1.0, 8.0, 1.0, steel, { surface: "metal" });
      K.box(-22, 8.0, -5, 0.7, 0.7, 12, steel, { surface: "metal", noNav: true });
      K.box(-22, 7.4, -10, 0.35, 1.6, 0.35, steel, { surface: "metal", noNav: true });
      K.label("驾驶台", 0, 2.4, 6.9, 3.14, 3.2, 0.8);
      K.label("外锚地", -22, 2.4, -1, 1.57, 3.2, 0.8);

      // railings (posts + top rail)
      for (var rz = -8.6; rz <= 8.6; rz += 2.4) {
        K.box(-26.0, 1.3, rz, 0.12, 1.2, 0.12, steel, { surface: "metal", noNav: true });
        K.box(26.0, 1.3, rz, 0.12, 1.2, 0.12, steel, { surface: "metal", noNav: true });
      }
      K.box(-26.0, 1.9, 0, 0.08, 0.08, 19, steel, { surface: "metal", noNav: true });
      K.box(26.0, 1.9, 0, 0.08, 0.08, 19, steel, { surface: "metal", noNav: true });

      // deck detail: edge stripes, winches, pipes, vents, stacked boxes
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
      K.light(-14, 6.0, 4, 0xffd9a6, 110, 20);
      K.light(14, 6.0, 4, 0xffd9a6, 110, 20);
      K.light(-14, 5.4, -6, 0xffd9a6, 90, 18);
      K.light(14, 5.4, -6, 0xffd9a6, 90, 18);
      K.light(0, 5.2, 0, 0xffd9a6, 120, 22);
      K.light(-18, 3.2, -6, 0xff2e1c, 20, 9);
      K.light(18, 3.2, -6, 0xff2e1c, 20, 9);

      /* ---------------- V35 · WP35-6 货轮美术补强 ---------------- */
      var deco = function (x, y, z, w, h, d, m, ry) {
        var o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
        o.position.set(x, y, z); o.rotation.y = ry || 0;
        o.castShadow = true; o.receiveShadow = true; K.root.add(o); return o;
      };
      function wetTex(seed) {
        var c = document.createElement("canvas"); c.width = c.height = 256;
        var g = c.getContext("2d"); g.clearRect(0, 0, 256, 256);
        var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (var i = 0; i < 210; i++) {
          var x = rnd() * 256, y = rnd() * 256, r = 3 + rnd() * 30;
          var gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, "rgba(255,255,255," + (0.28 + rnd() * 0.7).toFixed(3) + ")");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
        }
        var tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; return tx;
      }
      var wetMap = wetTex(3311);
      var wetMat = new T.MeshStandardMaterial({
        color: 0x1b252b, roughness: 0.035, metalness: 0.78, transparent: true,
        opacity: 0.82, depthWrite: false, alphaMap: wetMap, envMapIntensity: 2.0
      });
      var wet = new T.Mesh(new T.PlaneGeometry(52, 19), wetMat);
      wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.317, 0);
      wet.renderOrder = 2; wet.receiveShadow = true; K.dyn.add(wet);
      // 甲板积水边缘：一条更亮的薄水膜
      var filmMat = new T.MeshStandardMaterial({
        color: 0x2d3e46, roughness: 0.02, metalness: 0.9, transparent: true,
        opacity: 0.35, depthWrite: false, alphaMap: wetMap, envMapIntensity: 2.4
      });
      var film = new T.Mesh(new T.PlaneGeometry(48, 7), filmMat);
      film.rotation.x = -Math.PI / 2; film.position.set(0, 0.322, 3.2);
      film.renderOrder = 3; K.dyn.add(film);
      // 货舱雾
      var holdFogMat = new T.MeshBasicMaterial({
        color: 0x9fb6c8, transparent: true, opacity: 0.05, depthWrite: false,
        side: T.DoubleSide, blending: T.AdditiveBlending
      });
      var holdFog = new T.Mesh(new T.PlaneGeometry(17, 8), holdFogMat);
      holdFog.rotation.x = -Math.PI / 2; holdFog.position.set(0, 0.62, 0);
      holdFog.name = "sx_fog_ship"; holdFog.userData.sxLod = true; K.dyn.add(holdFog);

      var bridgeGlow = T.MeshStandardMaterial
        ? new T.MeshStandardMaterial({ color: 0xffe3b0, emissive: 0xffc777, emissiveIntensity: 4.2, roughness: 0.35 })
        : new T.MeshBasicMaterial({ color: 0xffd27a });
      deco(0, 3.05, 6.26, 10.4, 0.1, 0.12, bridgeGlow);
      deco(-5.3, 3.7, 7.9, 0.1, 1.7, 3.2, bridgeGlow);
      deco(5.3, 3.7, 7.9, 0.1, 1.7, 3.2, bridgeGlow);
      var bridgeA = K.light(-2.8, 4.1, 7.2, 0xffd9a6, 46, 10);
      var bridgeB = K.light(2.8, 4.1, 7.2, 0xffd9a6, 46, 10);
      var bridgeC = K.light(0, 2.8, 5.6, 0xffb060, 34, 8);
      bridgeC.userData.sxBlink = { speed: 1.1, min: 28, max: 36, phase: 1.2 };
      // 航行灯（红/绿）与桅灯
      var navRed = K.light(-26.4, 2.3, 7.8, 0xff3a22, 14, 7);
      navRed.userData.sxBlink = { speed: 2.8, min: 1, max: 16, phase: 0.4 };
      var navGreen = K.light(26.4, 2.3, 7.8, 0x3aff8a, 14, 7);
      navGreen.userData.sxBlink = { speed: 2.8, min: 1, max: 16, phase: 2.1 };
      var mastLamp = K.light(-22, 8.8, -5.2, 0xfff0cc, 18, 9);
      mastLamp.userData.sxBlink = { speed: 4.4, min: 2, max: 20, phase: 0.9 };
      // 绑扎桥 / 缆桩 / 舱盖锁
      var lashMat = new T.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.72, metalness: 0.25 });
      var bollardMat = new T.MeshStandardMaterial({ color: 0x3d4244, roughness: 0.55, metalness: 0.65 });
      for (var lz = -3.8; lz <= 3.8; lz += 1.9) {
        deco(-11.2, 0.72, lz, 0.6, 0.08, 0.08, lashMat);
        deco(11.2, 0.72, lz, 0.6, 0.08, 0.08, lashMat);
      }
      for (var bz = -7.4; bz <= 7.4; bz += 2.4) {
        deco(-25.4, 0.68, bz, 0.42, 0.22, 0.42, bollardMat);
        deco(25.4, 0.68, bz, 0.42, 0.22, 0.42, bollardMat);
      }
      for (var hx = -7; hx <= 7; hx += 2) {
        deco(hx, 0.56, 3.5, 0.22, 0.08, 0.22, bollardMat);
        deco(hx, 0.56, -3.5, 0.22, 0.08, 0.22, bollardMat);
      }
      // 吊机吊钩（摆动）
      var hookGroup = new T.Group(); hookGroup.name = "sx_hook"; K.dyn.add(hookGroup);
      var cable = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 5.2, 6), bollardMat);
      cable.position.set(0, -2.6, 0); hookGroup.add(cable);
      var hook = new T.Mesh(new T.TorusGeometry(0.22, 0.06, 6, 12), bollardMat);
      hook.position.set(0, -5.3, 0); hookGroup.add(hook);
      hookGroup.position.set(-22, 7.9, -9.2);
      hookGroup.userData.sxSwing = { speed: 0.72, amp: 0.055, phase: 0.4 };
      // 集装箱堆 + 桥楼内景剪影
      K.prop("container20", -12, 7.2, 0, 0.32);
      K.prop("container20", 12, 7.2, 0, 0.32);
      deco(0, 4.35, 8.9, 5.0, 0.08, 1.4, cabMat2());
      function cabMat2() { return new T.MeshStandardMaterial({ color: 0x22282b, roughness: 0.8, metalness: 0.15 }); }
      K.prop("pallet_stack", -9, -2.4, 0.2, 0.33);
      K.prop("crate_stack", 9, -2.2, 0.4, 0.33);

      // relays / extraction
      K.relay("ship_r1", -18, -6.2, "系泊绞车中继", 0.32);
      K.relay("ship_r2", 0, 3.2, "货舱门中继", 0.32);
      K.relay("ship_r3", 18, -6.2, "驾驶台中继", 0.32);
      var ex = new T.Mesh(new T.RingGeometry(1.7, 1.95, 32), new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.55, side: T.DoubleSide }));
      ex.rotation.x = -Math.PI / 2; ex.position.set(0, 0.38, -8.4); K.root.add(ex);

      if (!window.__SX_MAP_HINTS) window.__SX_MAP_HINTS = {};
      window.__SX_MAP_HINTS.ship = {
        sunIntensity: 1.2, envIntensity: 1.08,
        fill: { color: 0xbfd4ff, intensity: 0.95 },
        probes: [
          { name: "ship_deck", pos: [0, 4.2, 1.0], range: 24 },
          { name: "ship_bridge", pos: [0, 5.0, 7.4], range: 11 }
        ],
        fx: { spray: 150, mist: true }, roll: 1.2
      };

      return {
        playerStart: { pos: new T.Vector3(0, 0.32, 5.2), yaw: 0 },
        extraction: { pos: new T.Vector3(0, 0.32, -8.4), radius: 2.4 },
        enemySpawns: [
          [-20, -5], [-10, -6], [10, -6], [20, -5], [-20, 1], [20, 1], [-10, 4], [10, 4], [0, 0], [0, 6]
        ].map(function (p) { return { pos: new T.Vector3(p[0], 0.32, p[1]), type: "ground", zone: "ship" }; }),
        interior: null,
        seaOnly: true,
        fog: { color: 0x0a1018, density: 0.018 },
        env: { sun: [0.2, 0.16, 0.9], zen: [0.018, 0.025, 0.04], hor: [0.12, 0.16, 0.22], away: [0.05, 0.07, 0.1], col: [0.35, 0.4, 0.55], light: 0x9fb4c8, intensity: 2.6, exposure: 0.84, envIntensity: 1.3, rain: 1, saturation: 0.86 }
      };
    }
    MapKit.register("ship", { id: "ship", title: "外锚地", sub: "货轮甲板 · 暴雨夜", build: build });
  })();