
  /* =====================================================================
     MapKit · 运行期地图注册与切换（V15）
     保持 G.level 对象身份不变，只替换可视根、碰撞盒、nav 与关卡字段。
     ===================================================================== */
  var MapKit = (function () {
    var G, T, P;
    var maps = {};
    var initHooks = [];
    var current = "harbor";
    var harbor = null;
    var sceneExtras = null;
    var depotLights = null;
    var depotProbeDone = false;

    function vec(x, y, z) { return new T.Vector3(x, y, z); }

    function cloneStart(s) {
      return { pos: s.pos.clone(), yaw: s.yaw };
    }

    function materialKey(m) {
      return [
        m.map ? m.map.uuid : "",
        m.normalMap ? m.normalMap.uuid : "",
        m.color ? m.color.getHexString() : "",
        m.roughness != null ? m.roughness.toFixed(2) : "",
        m.metalness != null ? m.metalness.toFixed(2) : "",
        m.emissive ? m.emissive.getHexString() : "",
        m.emissiveIntensity != null ? m.emissiveIntensity.toFixed(2) : "",
        m.transparent ? "t" : "",
        m.opacity != null ? m.opacity.toFixed(2) : "",
        m.side,
        m.vertexColors ? "v" : "",
        m.alphaTest || 0
      ].join("|");
    }

    function mergeRoot(root) {
      root.updateMatrixWorld(true);
      var groups = new Map();
      root.traverse(function (o) {
        if (!o.isMesh || o.isSkinnedMesh || o.userData && o.userData.noMerge) return;
        var geo = o.geometry;
        if (!geo || !geo.attributes || !geo.attributes.position) return;
        var m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m) return;
        var g2 = geo.index ? geo.toNonIndexed() : geo.clone();
        g2.applyMatrix4(o.matrixWorld);
        var key = materialKey(m);
        var g = groups.get(key);
        if (!g) { g = { mat: m, pos: [], nor: [], uv: [], col: [] }; groups.set(key, g); }
        var p = g2.attributes.position, n = g2.attributes.normal, uv = g2.attributes.uv, c = g2.attributes.color;
        for (var i = 0; i < p.count; i++) {
          g.pos.push(p.getX(i), p.getY(i), p.getZ(i));
          if (n) g.nor.push(n.getX(i), n.getY(i), n.getZ(i));
          if (uv) g.uv.push(uv.getX(i), uv.getY(i));
          if (c) g.col.push(c.getX(i), c.getY(i), c.getZ(i));
        }
        g2.dispose();
      });
      var out = new T.Group();
      groups.forEach(function (g) {
        var geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.Float32BufferAttribute(g.pos, 3));
        if (g.nor.length) geo.setAttribute("normal", new T.Float32BufferAttribute(g.nor, 3));
        if (g.uv.length) geo.setAttribute("uv", new T.Float32BufferAttribute(g.uv, 2));
        if (g.col.length && g.mat.vertexColors) geo.setAttribute("color", new T.Float32BufferAttribute(g.col, 3));
        geo.userData = geo.userData || {};
        geo.userData.sxMapOwned = true; // V46：切图 LRU 只释放地图自有几何
        var mesh = new T.Mesh(geo, g.mat);
        // V39：贴花/透明/半透材质不参与阴影 pass（原本也几乎无可见投影），
        // 直接减少一整轮 shadow draw call。
        mesh.castShadow = !(g.mat.transparent || g.mat.alphaTest > 0 || g.mat.depthWrite === false);
        mesh.receiveShadow = true;
        // V54 PERF-7：合并后的静态地图网格位置已烘焙，关闭每帧 matrix 更新。
        // 动态物件（K.dyn / 门 / 钩/灯）不在这里，保持默认更新。
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.userData.sxStatic = true;
        out.add(mesh);
      });
      return out;
    }

    /* V39：把一个道具组内部按材质合并成少量 mesh（局部坐标，保留组变换/可见性/碰撞）。
       用于 relay_node 这类"玩法对象但几何重复"的组：不隐藏、不改碰撞，只降 draw call。 */
    function mergeStaticGroup(group) {
      if (!group || !T) return group;
      group.updateMatrixWorld(true);
      var inv = new T.Matrix4().copy(group.matrixWorld).invert();
      var tmp = new T.Matrix4();
      var buckets = new Map(), victims = [];
      group.traverse(function (o) {
        if (!o.isMesh || o.isSkinnedMesh || o === group) return;
        if (o.userData && o.userData.noMerge) return;
        var geo = o.geometry;
        if (!geo || !geo.attributes || !geo.attributes.position) return;
        var m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m) return;
        var g2 = geo.index ? geo.toNonIndexed() : geo.clone();
        tmp.multiplyMatrices(inv, o.matrixWorld);
        g2.applyMatrix4(tmp);
        var key = materialKey(m);
        var b = buckets.get(key);
        if (!b) { b = { mat: m, pos: [], nor: [], uv: [] }; buckets.set(key, b); }
        var p = g2.attributes.position, n = g2.attributes.normal, uv = g2.attributes.uv;
        for (var i = 0; i < p.count; i++) {
          b.pos.push(p.getX(i), p.getY(i), p.getZ(i));
          if (n) b.nor.push(n.getX(i), n.getY(i), n.getZ(i));
          if (uv) b.uv.push(uv.getX(i), uv.getY(i));
        }
        g2.dispose();
        victims.push(o);
      });
      if (!buckets.size) return group;
      var out = new T.Group();
      out.name = "sx_merged_static";
      buckets.forEach(function (b) {
        var geo = new T.BufferGeometry();
        geo.userData = geo.userData || {};
        geo.userData.sxMapOwned = true; // V46：地图自有几何
        geo.setAttribute("position", new T.Float32BufferAttribute(b.pos, 3));
        if (b.nor.length) geo.setAttribute("normal", new T.Float32BufferAttribute(b.nor, 3));
        if (b.uv.length) geo.setAttribute("uv", new T.Float32BufferAttribute(b.uv, 2));
        var mesh = new T.Mesh(geo, b.mat);
        mesh.castShadow = !(b.mat.transparent || b.mat.alphaTest > 0 || b.mat.depthWrite === false);
        mesh.receiveShadow = true;
        out.add(mesh);
      });
      for (var v = 0; v < victims.length; v++) if (victims[v].parent) victims[v].parent.remove(victims[v]);
      group.add(out);
      return group;
    }

    function init(g) {
      G = g; T = g.THREE; P = g.physics;
      var L = g.level;
      harbor = {
        root: L.root,
        rootVisible: L.root.visible,
        boxes: P.boxes.slice(),
        playerStart: cloneStart(L.playerStart),
        objectives: L.objectives.slice(),
        extraction: { pos: L.extraction.pos.clone(), radius: L.extraction.radius },
        enemySpawns: L.enemySpawns.slice(),
        coverPoints: L.coverPoints.slice(),
        interiorBoxes: L.interiorBoxes.slice(),
        sunIntensity: g.render.sun.intensity,
        sunColor: g.render.sun.color.clone(),
        skyVisible: g.render.sky.visible,
        groundVisible: g.ground.root.visible,
        apron: g.ground.root.getObjectByName("apron"),
        quaySkirt: g.ground.root.getObjectByName("quaySkirt"),
        backdropVisible: G.backdrop ? G.backdrop.root.visible : true,
        fog: g.scene.fog,
        pointLights: g.scene.children.filter(function (o) { return o.isPointLight; }).map(function (o) { return { l: o, i: o.intensity }; })
      };
      maps.harbor = { id: "harbor", title: "四号泊位", built: true };
      for (var h = 0; h < initHooks.length; h++) {
        try { initHooks[h](g); } catch (e) { console.error("[mapkit] init hook", e); }
      }
    }

    function register(id, def) {
      maps[id] = def;
    }

    /* V53 ARCH-5：两个 builder 的 label() 逐字重复，抽成共享实现。
       返回的 mesh 由调用方决定挂到 labels 组还是 root。 */
    function makeLabelMesh(text, x, y, z, yaw, w, h) {
      var c = document.createElement("canvas");
      c.width = 512; c.height = 128;
      var g = c.getContext("2d");
      g.fillStyle = "rgba(8,10,12,.72)"; g.fillRect(0, 0, 512, 128);
      g.strokeStyle = "rgba(255,179,71,.8)"; g.lineWidth = 4; g.strokeRect(2, 2, 508, 124);
      g.fillStyle = "#ffd27a"; g.font = "bold 58px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, 256, 68);
      var tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      var m = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false });
      var lgeo = new T.PlaneGeometry(w || 4.2, h || 1.05);
      lgeo.userData = lgeo.userData || {};
      lgeo.userData.sxMapOwned = true;
      m.userData = m.userData || {};
      m.userData.sxMapOwned = true;
      var mesh = new T.Mesh(lgeo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.y = yaw || 0;
      mesh.userData = mesh.userData || {};
      mesh.userData.sxLabel = true;
      mesh.userData.labelText = text;
      return mesh;
    }

    /* V54 PERF-3：把同一张地图的标签烘焙成 1–2 张图集/网格。
       原实现每个标签 = 1 个 512×128 CanvasTexture + 1 个 material + 1 个 mesh；
       V53 四图 372 个标签占 397 个透明 mesh 的 93%。这里按 6×25 格（320×80/格）
       画进 2048×2048 图集，再按图集合并为一个 PlaneGeometry，保留位置/朝向/宽高。 */
    var LABEL_ATLAS = 2048, LABEL_CELL_W = 512, LABEL_CELL_H = 128, LABEL_COLS = 4, LABEL_ROWS = 16;
    function bakeLabels(group) {
      if (!group || !group.children || !group.children.length) return group;
      var list = [];
      for (var i = 0; i < group.children.length; i++) {
        var m = group.children[i];
        if (m && m.isMesh && m.userData && m.userData.sxLabel) list.push(m);
      }
      if (list.length < 2) return group;
      var perAtlas = LABEL_COLS * LABEL_ROWS;
      for (var base = 0; base < list.length; base += perAtlas) {
        var slice = list.slice(base, base + perAtlas);
        var canvas = document.createElement("canvas");
        var atlasRows = Math.max(1, Math.ceil(slice.length / LABEL_COLS));
        var atlasH = Math.min(LABEL_ATLAS, atlasRows * LABEL_CELL_H);
        canvas.width = LABEL_ATLAS; canvas.height = atlasH;
        var ctx = canvas.getContext("2d");
        var pos = [], nor = [], uv = [];
        for (var j = 0; j < slice.length; j++) {
          var mesh = slice[j];
          var col = j % LABEL_COLS, row = Math.floor(j / LABEL_COLS);
          var ox = col * LABEL_CELL_W, oy = row * LABEL_CELL_H;
          var text = mesh.userData.labelText || "";
          ctx.fillStyle = "rgba(8,10,12,.72)"; ctx.fillRect(ox, oy, LABEL_CELL_W, LABEL_CELL_H);
          ctx.strokeStyle = "rgba(255,179,71,.8)"; ctx.lineWidth = 4; ctx.strokeRect(ox + 2, oy + 2, LABEL_CELL_W - 4, LABEL_CELL_H - 4);
          ctx.fillStyle = "#ffd27a"; ctx.font = "bold 58px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(text, ox + LABEL_CELL_W / 2, oy + LABEL_CELL_H / 2 + 2);
          mesh.updateMatrix();
          var g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
          g.applyMatrix4(mesh.matrix);
          var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
          var u0 = (col * LABEL_CELL_W) / LABEL_ATLAS;
          var v0 = 1 - ((row + 1) * LABEL_CELL_H) / atlasH;
          for (var k = 0; k < p.count; k++) {
            pos.push(p.getX(k), p.getY(k), p.getZ(k));
            if (n) nor.push(n.getX(k), n.getY(k), n.getZ(k));
            if (u) uv.push(u0 + u.getX(k) * (LABEL_CELL_W / LABEL_ATLAS), v0 + u.getY(k) * (LABEL_CELL_H / atlasH));
          }
          g.dispose();
          group.remove(mesh);
          try { mesh.geometry.dispose(); mesh.material.map.dispose(); mesh.material.dispose(); } catch (e) {}
        }
        if (!pos.length) continue;
        var geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        if (nor.length) geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
        if (uv.length) geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        geo.userData = geo.userData || {};
        geo.userData.sxMapOwned = true;
        var tex = new T.CanvasTexture(canvas);
        tex.colorSpace = T.SRGBColorSpace;
        tex.needsUpdate = true;
        var mat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false });
        mat.userData = mat.userData || {};
        mat.userData.sxMapOwned = true;
        var atlas = new T.Mesh(geo, mat);
        atlas.name = "sx-label-atlas-" + (base / perAtlas);
        atlas.userData = atlas.userData || {};
        atlas.userData.sxLabelAtlas = true;
        group.add(atlas);
      }
      return group;
    }

    function makeBuilder() {
      var root = new T.Group();
      var dyn = new T.Group();
      var labels = new T.Group();
      var lights = new T.Group();
      var boxes = [];
      var relays = {};
      var cover = [];
      var props = [];
      var def = {
        G: G, T: T, root: root, dyn: dyn, labels: labels, lights: lights,
        boxes: boxes, relays: relays, cover: cover, props: props, records: [],
        mat: function (name, color) {
          var m = null;
          try { m = G.mats.get(name); } catch (e) {}
          if (!m) m = new T.MeshStandardMaterial({ color: color || 0x6a6e70, roughness: 0.9, metalness: 0.1 });
          return m;
        },
        box: function (x, y, z, w, h, d, matName, opts) {
          opts = opts || {};
          var m = typeof matName === "string" ? def.mat(matName, opts.color) : matName;
          var mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
          mesh.position.set(x, y, z);
          mesh.castShadow = opts.castShadow !== false;
          mesh.receiveShadow = true;
          root.add(mesh);
          boxes.push({ min: [x - w / 2, y - h / 2, z - d / 2], max: [x + w / 2, y + h / 2, z + d / 2], opts: { surface: opts.surface || "metal", noNav: !!opts.noNav, bulletOnly: !!opts.bulletOnly, playerOnly: !!opts.playerOnly } });
          return mesh;
        },
        prop: function (name, x, z, yaw, y, opts) {
          opts = opts || {};
          var o = G.props.build(name);
          o.position.set(x, y || 0, z);
          o.rotation.y = yaw || 0;
          root.add(o);
          o.updateMatrixWorld(true);
          var cols = (o.userData && o.userData.colliders) || [];
          for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            boxes.push({ min: [c.min[0] + x, c.min[1] + (y || 0), c.min[2] + z], max: [c.max[0] + x, c.max[1] + (y || 0), c.max[2] + z], opts: { surface: c.surface || "metal", noNav: !!opts.noNav, bulletOnly: !!c.bulletOnly } });
          }
          props.push({ name: name, x: x, z: z });
          if (!opts.noCover) cover.push(vec(x, 0, z));
          return o;
        },
        relay: function (id, x, z, label, y) {
          var yy = y == null ? 0.03 : y;
          var o = G.props.build("relay_node");
          o.position.set(x, yy, z);
          dyn.add(o);
          o.updateMatrixWorld(true);
          try { mergeStaticGroup(o); } catch (e) {}
          o.updateMatrixWorld(true);
          var cols = (o.userData && o.userData.colliders) || [];
          for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            boxes.push({ min: [c.min[0] + x, c.min[1] + yy, c.min[2] + z], max: [c.max[0] + x, c.max[1] + yy, c.max[2] + z], opts: { surface: c.surface || "metal" } });
          }
          relays[id] = { id: id, label: label || id, object: o, pos: vec(x, yy, z) };
          cover.push(vec(x, 0, z + 1.4));
          o.visible = false;
          return relays[id];
        },
        // V41：地图灯不再直接创建 PointLight（会无限增加逐像素光照成本），
        // 改为登记灯光记录，由 ext_lights.js 的固定灯池统一调度。
        light: function (x, y, z, color, intensity, dist) {
          var rec = window.__SX_LIGHTS && window.__SX_LIGHTS.createRecord
            ? window.__SX_LIGHTS.createRecord(x, y, z, color, intensity, dist)
            : (function () {
                var r = {
                  isSxLightRecord: true, map: "",
                  position: new T.Vector3(x, y, z),
                  color: new T.Color(color == null ? 0xffd2a0 : color),
                  intensity: intensity == null ? 20 : intensity,
                  distance: dist == null ? 18 : dist,
                  decay: 2, visible: true, userData: {}
                };
                r.baseIntensity = r.intensity;
                return r;
              })();
          def.records.push(rec);
          return rec;
        },
        label: function (text, x, y, z, yaw, w, h) {
          var mesh = makeLabelMesh(text, x, y, z, yaw, w, h);
          def.labels.add(mesh);
          return mesh;
        }
      };
      return def;
    }


    /* V40 · 地图追加层（MapKit.extend）
       给已经烘焙进 game.js 的港区（harbor）补细节：只追加视觉/碰撞，不改原场景。
       其余地图直接改各自 map_*.js；此接口主要为港区准备。 */
    function makeAppendBuilder(root, boxes, cover, lights, records) {
      var def = {
        G: G, T: T, root: root, boxes: boxes, cover: cover, lights: lights, records: records,
        mat: function (name, color) {
          var m = null;
          try { m = G.mats.get(name); } catch (e) {}
          if (!m) m = new T.MeshStandardMaterial({ color: color || 0x6a6e70, roughness: 0.9, metalness: 0.1 });
          return m;
        },
        box: function (x, y, z, w, h, d, matName, opts) {
          opts = opts || {};
          var m = typeof matName === "string" ? def.mat(matName, opts.color) : matName;
          var mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
          mesh.position.set(x, y, z);
          mesh.castShadow = opts.castShadow !== false;
          mesh.receiveShadow = true;
          root.add(mesh);
          var b = P.addBox(
            new T.Vector3(x - w / 2, y - h / 2, z - d / 2),
            new T.Vector3(x + w / 2, y + h / 2, z + d / 2),
            { surface: opts.surface || "metal", noNav: !!opts.noNav, bulletOnly: !!opts.bulletOnly, playerOnly: !!opts.playerOnly }
          );
          boxes.push(b);
          return mesh;
        },
        prop: function (name, x, z, yaw, y, opts) {
          opts = opts || {};
          var o = G.props.build(name);
          o.position.set(x, y || 0, z);
          o.rotation.y = yaw || 0;
          root.add(o);
          o.updateMatrixWorld(true);
          var cols = (o.userData && o.userData.colliders) || [];
          for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            var b = P.addBox(
              new T.Vector3(c.min[0] + x, c.min[1] + (y || 0), c.min[2] + z),
              new T.Vector3(c.max[0] + x, c.max[1] + (y || 0), c.max[2] + z),
              { surface: c.surface || "metal", noNav: !!opts.noNav, bulletOnly: !!c.bulletOnly }
            );
            boxes.push(b);
          }
          if (!opts.noCover) cover.push(vec(x, 0, z));
          return o;
        },
        light: function (x, y, z, color, intensity, dist) {
          var rec = window.__SX_LIGHTS && window.__SX_LIGHTS.createRecord
            ? window.__SX_LIGHTS.createRecord(x, y, z, color, intensity, dist, "harbor")
            : (function () {
                var r = {
                  isSxLightRecord: true, map: "harbor",
                  position: new T.Vector3(x, y, z),
                  color: new T.Color(color == null ? 0xffd2a0 : color),
                  intensity: intensity == null ? 20 : intensity,
                  distance: dist == null ? 18 : dist,
                  decay: 2, visible: true, userData: {}
                };
                r.baseIntensity = r.intensity;
                return r;
              })();
          records.push(rec);
          return rec;
        },
        label: function (text, x, y, z, yaw, w, h) {
          var mesh = makeLabelMesh(text, x, y, z, yaw, w, h);
          root.add(mesh);
          return mesh;
        }
      };
      return def;
    }

    function extend(id, fn) {
      // V53 ARCH-5：追加层会直接 P.addBox 到当前碰撞集；非港区激活时调用会污染
      // 当前地图的碰撞（箱子留在 P.boxes 里，玩家撞到不存在的墙）。直接拒绝并告警。
      if (current !== "harbor") {
        try { console.warn("[mapkit] extend('" + id + "') ignored while map='" + current + "' is active"); } catch (e) {}
        return false;
      }
      if (id === "harbor") {
        if (!harbor) return false;
        if (!harbor.extraGroup) {
          harbor.extraGroup = new T.Group();
          harbor.extraGroup.name = "sx_harbor_extras";
          harbor.root.add(harbor.extraGroup);
        }
        if (!harbor.extraLights) {
          harbor.extraLights = new T.Group();
          harbor.extraLights.name = "sx_harbor_extra_lights";
          G.scene.add(harbor.extraLights);
        }
        var tmp = new T.Group();
        if (!harbor.lightRecords) harbor.lightRecords = [];
        var b = makeAppendBuilder(tmp, harbor.boxes, harbor.coverPoints, harbor.extraLights, harbor.lightRecords);
        fn(b);
        var merged = mergeRoot(tmp);
        merged.name = "sx_harbor_extras_batch";
        harbor.extraGroup.add(merged);
        if (current === "harbor") {
          P.boxes.length = 0;
          for (var i = 0; i < harbor.boxes.length; i++) P.boxes.push(harbor.boxes[i]);
          P.build();
          G.level.coverPoints = harbor.coverPoints.slice();
        }
        return true;
      }
      return false;
    }

    function build(id) {
      var def = maps[id];
      if (!def || def.built) return def;
      var b = makeBuilder();
      var meta = def.build(b) || {};
      def.playerStart = meta.playerStart || { pos: new T.Vector3(0, 0, 0), yaw: 0 };
      def.extraction = meta.extraction || { pos: new T.Vector3(0, 0, 0), radius: 2.6 };
      def.enemySpawns = meta.enemySpawns || [];
      def.interior = meta.interior || { min: new T.Vector3(-30, 0, -20), max: new T.Vector3(30, 8, 20) };
      def.env = meta.env || null;
      def.seaOnly = !!meta.seaOnly;
      def.fog = meta.fog || null;
      // V53 ARCH-5：每张地图只创建一个 FogExp2，load 时复用
      def.fogObject = new T.FogExp2(def.fog ? def.fog.color : 0x090c10, def.fog ? def.fog.density : 0.026);
      def.merged = mergeRoot(b.root);
      def.merged.add(b.dyn);
      def.merged.add(bakeLabels(b.labels));
      // V46：地图组内所有几何均为本次 build 新建（材质共享 G.mats），
      // 标记为地图自有，切图 LRU 可安全 dispose；不要标记共享材质。
      def.merged.traverse(function (o) {
        if (o.isMesh && o.geometry && !o.geometry.userData) o.geometry.userData = {};
        if (o.isMesh && o.geometry && !o.geometry.__mpShared) o.geometry.userData.sxMapOwned = true;
      });
      def.merged.visible = false;
      G.scene.add(def.merged);
      G.scene.add(b.lights);
      b.lights.visible = false;
      def.lights = b.lights;
      def.records = (b.records || []).slice();
      for (var ri = 0; ri < def.records.length; ri++) {
        def.records[ri].map = id;
        def.records[ri].__mapRecord = true; // V46：释放后不被 ext_lights 误索引
      }
      def.boxes = b.boxes;
      def.relays = b.relays;
      def.cover = b.cover;
      def.props = b.props;
      def.built = true;
      def.lastUsed = Date.now();
      maps[id] = def;
      return def;
    }

    /* V53 CLI-3：海面/天空/太阳强度只由“目标地图是否 seaOnly”决定。
       每次加载非港区地图都调用，避免 depot/core(false) ↔ ship(true) 互相切图时
       残留上一张图的可见性与太阳强度。 */
    function applySeaMode(seaOnly) {
      seaOnly = !!seaOnly;
      if (G.ground && G.ground.root) G.ground.root.visible = seaOnly;
      if (harbor && harbor.apron) harbor.apron.visible = !seaOnly;
      if (harbor && harbor.quaySkirt) harbor.quaySkirt.visible = !seaOnly;
      if (G.render && G.render.sky) G.render.sky.visible = seaOnly;
      if (G.render && G.render.sun) G.render.sun.intensity = seaOnly ? 1.2 : 0.25;
      if (G.backdrop) G.backdrop.root.visible = false;
    }

    function hideHarbor(seaOnly) {
      harbor.root.visible = false;
      if (harbor.extraGroup) harbor.extraGroup.visible = false;
      if (harbor.extraLights) harbor.extraLights.visible = false;
      applySeaMode(seaOnly);
      for (var i = 0; i < harbor.pointLights.length; i++) harbor.pointLights[i].l.intensity = 0;
    }

    function showHarbor() {
      harbor.root.visible = harbor.rootVisible;
      if (harbor.extraGroup) harbor.extraGroup.visible = true;
      if (harbor.extraLights) harbor.extraLights.visible = true;
      if (G.backdrop) G.backdrop.root.visible = harbor.backdropVisible;
      G.ground.root.visible = harbor.groundVisible;
      if (harbor.apron) harbor.apron.visible = true;
      if (harbor.quaySkirt) harbor.quaySkirt.visible = true;
      G.render.sky.visible = harbor.skyVisible;
      G.render.sun.intensity = harbor.sunIntensity;
      G.render.sun.color.copy(harbor.sunColor);
      for (var i = 0; i < harbor.pointLights.length; i++) harbor.pointLights[i].l.intensity = harbor.pointLights[i].i;
      G.scene.fog = harbor.fog;
    }


    /* V40：切图后把玩家物理边界切到该图的 authored bounds。
       此前四图都沿用港区 80x60 的 bounds，扩建区会被错误地夹住/放行。 */
    function applyMapBounds(id) {
      var d = null;
      try { d = window.__SX_MAPS_DATA && window.__SX_MAPS_DATA.maps && window.__SX_MAPS_DATA.maps[id]; } catch (e) {}
      if (!d || !d.bounds || !P || !P.bounds) return;
      P.bounds.min.set(d.bounds.min[0], d.bounds.min[1], d.bounds.min[2]);
      P.bounds.max.set(d.bounds.max[0], d.bounds.max[1], d.bounds.max[2]);
    }

    /* V46：切图 LRU。只释放地图自己 merge 出来的几何/标签贴图，
       共享的 G.mats 材质和全局纹理绝不 dispose；最多保留 2 张已构建地图。 */
    var MAP_CACHE_LIMIT = 2;
    var cacheStats = { releases: 0, geos: 0, mats: 0, total: 0, skipped: 0 };
    function disposeMap(def) {
      var geos = 0, mats = 0, total = 0, skipped = 0;
      // V53 ARCH-5：用 Set 去重（原来是 seen.indexOf => O(n²)）
      var seen = new Set();
      if (!def || !def.merged) return { geos: 0, mats: 0, total: 0, skipped: 0 };
      def.merged.traverse(function (o) {
        if (!o.isMesh) return;
        var g = o.geometry;
        if (g && !seen.has(g)) { seen.add(g); total++; }
        if (g && (!g.userData || !g.userData.sxMapOwned)) {
          if (!g.__sxCountedSkipped) { g.__sxCountedSkipped = true; skipped++; }
        }
        if (g && g.userData && g.userData.sxMapOwned && !g.__sxMapDisposed) {
          g.__sxMapDisposed = true;
          try { g.dispose(); geos++; } catch (e) {}
        }
        var list = Array.isArray(o.material) ? o.material : [o.material];
        for (var mi = 0; mi < list.length; mi++) {
          var m = list[mi];
          if (!m || !m.userData || !m.userData.sxMapOwned || m.__sxMapDisposed) continue;
          m.__sxMapDisposed = true;
          try { if (m.map) m.map.dispose(); m.dispose(); mats++; } catch (e) {}
        }
      });
      if (def.merged.parent) def.merged.parent.remove(def.merged);
      if (def.lights && def.lights.parent) def.lights.parent.remove(def.lights);
      def.merged = null;
      def.lights = null;
      def.built = false;
      cacheStats.releases++;
      cacheStats.geos += geos;
      cacheStats.mats += mats;
      cacheStats.total += total;
      cacheStats.skipped += skipped;
      return { geos: geos, mats: mats, total: total, skipped: skipped };
    }
    function release(id) {
      if (!id || id === "harbor" || id === current) return { geos: 0, mats: 0 };
      var def = maps[id];
      if (!def || !def.built) return { geos: 0, mats: 0 };
      return disposeMap(def);
    }
    function trimCache(keep) {
      var built = [];
      for (var id in maps) {
        if (!Object.prototype.hasOwnProperty.call(maps, id)) continue;
        var d = maps[id];
        if (!d || !d.built || id === "harbor") continue;
        built.push({ id: id, at: d.lastUsed || 0 });
      }
      built.sort(function (a, b) { return a.at - b.at; });
      while (built.length > MAP_CACHE_LIMIT) {
        var old = built.shift();
        if (old.id !== keep) release(old.id);
      }
    }

    function load(id) {
      if (id === current) return false;
      var def = build(id);
      if (!def) return false;
      if (current === "harbor") hideHarbor(!!def.seaOnly);
      else if (maps[current] && maps[current].merged) { maps[current].merged.visible = false; maps[current].lights.visible = false; }
      // V53 CLI-3：非港区 → 非港区也要重设海面/天空/太阳（hideHarbor 只在离开港区时跑）
      if (id !== "harbor") applySeaMode(!!def.seaOnly);
      if (id === "harbor") {
        showHarbor();
        G.__navQuayX = 30;
        P.boxes.length = 0;
        for (var i = 0; i < harbor.boxes.length; i++) P.boxes.push(harbor.boxes[i]);
        P.build();
        applyMapBounds(id);
        var L = G.level;
        L.playerStart = cloneStart(harbor.playerStart);
        L.objectives = harbor.objectives.slice();
        L.extraction.pos.copy(harbor.extraction.pos);
        L.extraction.radius = harbor.extraction.radius;
        L.enemySpawns = harbor.enemySpawns.slice();
        L.coverPoints = harbor.coverPoints.slice();
        L.interiorBoxes = harbor.interiorBoxes.slice();
        current = id;
        if (maps[id]) maps[id].lastUsed = Date.now();
        trimCache(id);
        return true;
      }
      def.merged.visible = true;
      def.lights.visible = true;
      // V53 ARCH-5：FogExp2 按地图复用（build 时创建一次），不再每次 load 新建对象
      G.scene.fog = def.fogObject;
      G.__navQuayX = 1e9;
      P.boxes.length = 0;
      for (var k = 0; k < def.boxes.length; k++) {
        var b = def.boxes[k];
        P.addBox(new T.Vector3(b.min[0], b.min[1], b.min[2]), new T.Vector3(b.max[0], b.max[1], b.max[2]), b.opts);
      }
      P.build();
      applyMapBounds(id);
      var L2 = G.level;
      L2.playerStart = cloneStart(def.playerStart);
      L2.objectives = [];
      L2.extraction.pos.copy(def.extraction.pos);
      L2.extraction.radius = def.extraction.radius || 2.6;
      L2.enemySpawns = def.enemySpawns.slice();
      L2.coverPoints = def.cover.slice();
      L2.interiorBoxes = def.interior ? [{ min: def.interior.min.clone(), max: def.interior.max.clone() }] : [];
      current = id;
      def.lastUsed = Date.now();
      trimCache(id);
      return true;
    }

    function setObjectiveObjects(list) {
      G.level.objectives = list;
    }

    function captureHarbor() {
      if (!harbor) return;
      harbor.boxes = P.boxes.slice();
      harbor.playerStart = cloneStart(G.level.playerStart);
      harbor.enemySpawns = (G.level.enemySpawns || []).slice();
      harbor.coverPoints = (G.level.coverPoints || []).slice();
      harbor.interiorBoxes = (G.level.interiorBoxes || []).slice();
    }

    return {
      init: init,
      captureHarbor: captureHarbor,
      register: register,
      onInit: function (fn) { initHooks.push(fn); },
      extend: extend,
      load: load,
      build: build,
      release: release,
      cache: function () {
        var out = [];
        for (var id in maps) if (maps[id] && maps[id].built) out.push({ id: id, at: maps[id].lastUsed || 0 });
        return out;
      },
      cacheLimit: function () { return MAP_CACHE_LIMIT; },
      cacheStats: function () { return { releases: cacheStats.releases, geos: cacheStats.geos, mats: cacheStats.mats, total: cacheStats.total, skipped: cacheStats.skipped }; },
      current: function () { return current; },
      maps: function () { return Object.keys(maps); },
      relays: function (id) { return maps[id] ? maps[id].relays : null; },
      def: function (id) { return maps[id]; },
      setObjectives: setObjectiveObjects,
      mergeRoot: mergeRoot
    };
  })();