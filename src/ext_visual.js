/* =====================================================================
   SALTLINE — V35 · WP35-1/2/3/4/5/6/7 画面层（独立 IIFE）
   只通过 window.__G 工作；不修改 ext.js / game.js / build.cjs。
   内容：
     · 两级阴影级联（近 22m / 远 55m，按玩家位置逐帧更新近级）
     · TAA-lite（访问 render target / 深度：Halton 抖动 + 历史混合；
       低画质自动切回增强 FXAA/锐化）
     · 环境探针（CubeCamera + PMREM，室内三图 + 货轮甲板）
     · 第一人称冲刺/换弹/落地附加摆动、暗场跟随补光
     · 敌人受击闪白、受击弹簧位移、死亡碎块（InstancedMesh 限量）
     · 护盾破碎火花/碎片/冲击环
     · 冷库霜雾/滴水、货轮浪花/桥楼灯、货舱雾
     · F3 性能/探针/级联面板
   调试：window.__SX_VISUAL = { quality, stats, setQuality, probes, ... }
   ===================================================================== */
(function () {
  "use strict";
  // V54 ARCH-2：空 catch 不再静默吞错。软错误统一走 window.SXErrors.soft("visual:<tag>")：
  // 按标签计数、每个标签只记一条诊断，热路径不会刷屏；缺少诊断接口时退回 window.__errors。
  function soft(tag, e) {
    if (typeof window === "undefined" || !window) return;
    var forwarded = false;
    try {
      if (window.SXErrors && typeof window.SXErrors.soft === "function") { window.SXErrors.soft("visual:" + tag, e); forwarded = true; }
    } catch (_) { forwarded = false; }
    if (forwarded) return;
    try {
      if (window.__errors) {
        window.__errors.push("[visual:" + tag + "] " + ((e && e.stack) || e));
        while (window.__errors.length > 200) window.__errors.shift();
      }
    } catch (_) { return; }
  }

  var G = null, T = null, booted = false, disabled = false;
  var params = {};
  var qualityName = "low";
  var frameNo = 0;
  var errors = [];

  // V42：统一从 src/config/quality.js 读取，避免和 game.js 的 Pr 漂移
  var QP = window.SX_QUALITY_PRESETS || {};

  var DEFAULT_HINTS = {
    depot: {
      envIntensity: 1.15, fill: { color: 0xcfe4ff, intensity: 2.2 },
      probes: [
        { name: "depot_aisle", pos: [0, 3.2, 5.0], range: 22 },
        { name: "depot_mezz", pos: [22.5, 4.9, 4.0], range: 14 },
        { name: "depot_dock", pos: [0, 2.6, -14.0], range: 14 }
      ],
      fx: { frost: 170, drip: 26, coldMist: true }
    },
    ship: {
      envIntensity: 1.05, fill: { color: 0xbfd4ff, intensity: 0.9 },
      probes: [
        { name: "ship_deck", pos: [0, 4.2, 1.0], range: 24 },
        { name: "ship_bridge", pos: [0, 5.0, 7.4], range: 11 }
      ],
      fx: { spray: 150, mist: true }, roll: 1.2
    },
    core: {
      envIntensity: 1.0, fill: { color: 0xffb08a, intensity: 2.6 },
      probes: [
        { name: "core_ring", pos: [0, 4.0, 5.8], range: 17 },
        { name: "core_west", pos: [-12, 3.2, 1.0], range: 12 }
      ],
      fx: { embers: 90, sparks: true }
    }
  };

  var S = {
    enabled: true,
    frameMs: 0,
    frameMsAvg: 0,
    frameMs300: 0,
    frames: 0,
    calls: 0,
    tris: 0,
    windows: 300,
    ring: [],
    quality: "low",
    aa: "fxaa",
    reduced: false,
    map: "harbor",
    shadow: { cascades: 2, near: 22, far: 55, nearSize: 1024, farSize: 512, nearUpdates: 0, farUpdates: 0, farInterval: 4, farRadius: 0.55, farMode: "pcf-lite" },
    probes: { map: "harbor", count: 0, ready: 0, active: -1, updated: 0, failed: 0, pending: 0 },
    effects: { hitFlash: 0, debris: 0, shards: 0, rings: 0 },
    fill: { intensity: 0 },
    fp: { sprint: 0, reload: 0, land: 0, roll: 0 },
    shipRoll: 0
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); }
  function vec3(x, y, z) { return new T.Vector3(x, y, z); }
  function safe(fn, arg) { try { return fn(arg); } catch (e) { if (errors.length < 12) errors.push(String((e && e.message) || e)); return null; } }
  function reduceMotion() {
    try {
      if (document.body && document.body.classList.contains("reduce-motion")) return true;
      var raw = JSON.parse(localStorage.getItem("saltline.access.v1") || "null");
      return !!(raw && raw.reduceMotion);
    } catch (e) { return false; }
  }
  function mapId() {
    try { if (window.__SX && window.__SX.mapId) return window.__SX.mapId(); } catch (e) { soft("map-id", e); }
    return S.map;
  }
  function hintsFor(id) {
    var H = (window.__SX_MAP_HINTS && window.__SX_MAP_HINTS[id]) || null;
    if (H) return H;
    return DEFAULT_HINTS[id] || null;
  }

  /* =====================================================================
     0. boot
     ===================================================================== */
  function wait() {
    var tries = 0;
    var iv = setInterval(function () {
      var g = window.__G;
      if (g && g.render && g.render.renderer && g.render.post !== undefined && g.scene && g.camera &&
          g.enemies && g.enemies.list && g.weapon && g.level && g.game && g.physics) {
        clearInterval(iv);
        boot(g);
      } else if (++tries > 1200) {
        clearInterval(iv);
        console.error("[sx-visual] engine not ready");
      }
    }, 100);
  }

  function boot(g) {
    if (booted) return;
    G = g; T = g.THREE; params = g.params || {};
    // 顶层不能在引擎 boot 前构造 THREE 对象；在这里统一补上
    sh.sunDir = new T.Vector3(0, -1, 0);
    sh.lastCenter = new T.Vector3(1e9, 0, 0);
    sh.lastPos = new T.Vector3(1e9, 0, 0);
    sh.lastFwd = new T.Vector3(0, 0, -1);
    sh.scratch = new T.Vector3(); sh.target = new T.Vector3();
    sh.farTarget = new T.Vector3();
    sh.farLastPos = new T.Vector3(1e9, 0, 0);
    sh.farLastFwd = new T.Vector3(0, 0, -1);
    aa.size = new T.Vector2(4, 4);
    aa.prevVP = new T.Matrix4(); aa.curVP = new T.Matrix4(); aa.invVP = new T.Matrix4();
    pr.tmp = new T.Vector3();
    camBasePos = new T.Vector3(); camBaseQuat = new T.Quaternion();
    chunkDummy = new T.Object3D(); chunkColor = new T.Color();
    sxWhite = new T.Color(1.0, 0.93, 0.82);
    booted = true;
    S.reduced = reduceMotion();
    qualityName = (g.quality && g.quality.name) || "low";
    S.quality = qualityName;
    disabled = params.novisual === "1" || !!g.level.stub;
    expose();
    if (disabled) {
      G.events.on("map:loaded", function (e) { S.map = e.id; S.probes.map = e.id; });
      return;
    }
    try { initShadows(); } catch (e) { fail("shadows", e); }
    try { initFill(); } catch (e) { fail("fill", e); }
    try { initProbes(); } catch (e) { fail("probes", e); }
    try { initFX(); } catch (e) { fail("fx", e); }
    try { initDebris(); } catch (e) { fail("debris", e); }
    try { initFirstPerson(); } catch (e) { fail("firstperson", e); }
    try { initAA(); } catch (e) { fail("aa", e); }
    try { initF3(); } catch (e) { fail("f3", e); }
    try { installEvents(); } catch (e) { fail("events", e); }
    wrapRender();
    configureQuality(qualityName, true);
    // 首图：低画质/test 在 boot 阶段就同步吃掉整图探针，不等第一帧
    try { flushProbes(); } catch (e) { fail("probe boot", e); }
    G.events.on("map:loaded", function (e) { onMap(e && e.id); });
    G.events.on("map:loaded", function (e) { S.map = e.id; S.probes.map = e.id; });
    console.log("[sx-visual] V35 画面层已加载 · " + qualityName + " · aa=" + S.aa);
  }

  function fail(where, e) {
    var s = "[" + where + "] " + ((e && e.stack) || e);
    if (errors.length < 12) errors.push(s);
    console.error("[sx-visual] " + s);
  }

  /* =====================================================================
     1. WP35-1 · 两级阴影级联
     ===================================================================== */
  var sh = {
    sun: null, far: null, sunDir: null,
    sunBase: 1, texNear: 1024, texFar: 512, farInterval: 4,
    lastCenter: null, scratch: null, target: null,
    // 脏标记：只有玩家位移/转向超过阈值或强制刷新时才重绘 shadow map
    lastPos: null, lastFwd: null, force: true, farDirty: true, lastFar: -999, lastNear: -999,
    moveEpsSq: 0.043 * 0.043,
    // V41 P3-1：近级只按水平位移判脏，不再跟随鼠标转向重绘。
    // 转视角 0.003rad 就重绘会让港区 85% 的帧都在跑 shadow pass。
    nearInterval: 2,
    // V39：远级独立调度 —— 自己的位移阈值/朝向阈值/锚点，绝不读写近级的
    // lastPos/lastFwd/target，避免远级更新把近级的脏标记与贴图锚点带偏。
    farTarget: null, farLastPos: null, farLastFwd: null,
    farMoveEpsSq: 1.2 * 1.2, farYawEps: 0.02, farRadius: 0.55
  };

  function initShadows() {
    var sun = G.render.sun;
    sh.sun = sun;
    sh.sunDir.copy(G.render.sunDir || new T.Vector3(0.35, 0.8, 0.5)).normalize();
    sh.sunBase = sun.intensity || 1;
    sun.castShadow = true;
    sh.harborSun = sun.intensity || 1;
    sun.shadow.autoUpdate = false;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 1.8;
    sh.far = new T.DirectionalLight(sun.color.getHex(), Math.max(0.001, sun.intensity * 0.3));
    sh.far.name = "sx-sun-far";
    sh.far.castShadow = true;
    sh.far.shadow.autoUpdate = false;
    sh.far.shadow.bias = -0.00035;
    sh.far.shadow.normalBias = 0.09;
    // V39：远级不再复用近级 PCSS 的半影尺度。
    // 引擎的 PCSS chunk（SL_FRUSTUM）是全局 ShaderChunk，无法按光源分支，
    // 但 shadowRadius 是逐光源 uniform：远级把 radius 压到 0.55，blocker 搜索半径
    // ≈0.3m、半影上限 ≈0.33m（约 1.25~2.4 texel），等价退化成「简单 PCF」，
    // 同时避开近级 44m 视锥常量被当成远级 110m 视锥使用时的 2.5x 半影放大。
    sh.far.shadow.radius = sh.farRadius;
    sh.far.shadow.mapSize.set(512, 512);
    sh.far.shadow.camera.left = -55;
    sh.far.shadow.camera.right = 55;
    sh.far.shadow.camera.top = 55;
    sh.far.shadow.camera.bottom = -55;
    sh.far.shadow.camera.near = 1;
    sh.far.shadow.camera.far = 300;
    sh.far.shadow.camera.updateProjectionMatrix();
    G.scene.add(sh.far, sh.far.target);
    G.scene.add(sun.target);
    // 让近级使用固定 44m 视野，避免 PCSS chunk 里的 SL_FRUSTUM 常数频繁变化
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 280;
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
    sh.far.shadow.needsUpdate = true;
    sh.force = true; sh.farDirty = true; sh.lastFar = -999;
  }

  function fitLight(light, center, radius) {
    light.target.position.copy(center);
    light.target.updateMatrixWorld(true);
    light.position.copy(center).addScaledVector(sh.sunDir, 180);
    light.updateMatrixWorld(true);
    var c = light.shadow.camera;
    c.left = -radius; c.right = radius; c.top = radius; c.bottom = -radius;
    c.near = 1; c.far = 330;
    c.updateProjectionMatrix();
  }

  function updateShadows(dt) {
    if (!sh.sun || !sh.far || !S.enabled) return;
    var p = G.player && G.player.pos ? G.player.pos : G.camera.position;
    var fwd = sh.scratch.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-5) fwd.set(0, 0, -1); else fwd.normalize();
    // 脏标记：静止/微动时不再每帧重绘两级 shadow map。
    // 近级：强制刷新，或玩家水平位移 > 0.043m；转向不参与（P3-1）。
    var dx = p.x - sh.lastPos.x, dz = p.z - sh.lastPos.z;
    var movedSq = dx * dx + dz * dz;
    // sh.force 是一次性的：以前从不清零，导致近级 shadow map 每帧重绘，
    // nearUpdates 静止也一直涨（既费 GPU 又让「静止不增长」无法成立）。
    var force = sh.force;
    sh.force = false;
    // V41 P3-1：转向不再触发近级重绘；阴影中心只跟位置（22m 半径足够覆盖
    // 前方 3.5m 的偏移），移动时最多 30Hz 更新（nearInterval=2）。
    var dirty = force || movedSq > sh.moveEpsSq;
    if (dirty && (force || frameNo - sh.lastNear >= sh.nearInterval)) {
      var texel = 44 / sh.texNear;
      var nearC = sh.target.copy(p);
      nearC.x = Math.round(nearC.x / texel) * texel;
      nearC.z = Math.round(nearC.z / texel) * texel;
      nearC.y = 0;
      sh.lastNear = frameNo;
      fitLight(sh.sun, nearC, 22);
      sh.sun.shadow.mapSize.set(sh.texNear, sh.texNear);
      sh.sun.shadow.needsUpdate = true;
      S.shadow.nearUpdates++;
      sh.lastPos.copy(p);
      sh.lastFwd.copy(fwd);
      sh.farDirty = true;
    }
    // 远级：独立脏标记 + 独立锚点 + 真正的 1/farInterval 节流。
    // 位移阈值 1.2m / 转向 0.02rad（远级 110m 视锥，0.043m 的近级阈值纯属浪费），
    // 且只写自己的 farLastPos/farLastFwd，不回写近级状态。
    var fdx = p.x - sh.farLastPos.x, fdz = p.z - sh.farLastPos.z;
    var farMovedSq = fdx * fdx + fdz * fdz;
    var fdot = fwd.x * sh.farLastFwd.x + fwd.z * sh.farLastFwd.z;
    if (fdot > 1) fdot = 1; else if (fdot < -1) fdot = -1;
    var farTurned = Math.acos(fdot) > sh.farYawEps;
    var farDirty = force || farMovedSq > sh.farMoveEpsSq || farTurned;
    sh.farDirty = farDirty;
    if (farDirty && frameNo - sh.lastFar >= sh.farInterval) {
      var farC = sh.farTarget.copy(p).addScaledVector(fwd, 9);
      farC.y = 0;
      fitLight(sh.far, farC, 55);
      sh.far.shadow.mapSize.set(sh.texFar, sh.texFar);
      sh.far.shadow.needsUpdate = true;
      S.shadow.farUpdates++;
      sh.lastFar = frameNo;
      sh.farLastPos.copy(p);
      sh.farLastFwd.copy(fwd);
    }
    var inten = Math.max(0.0001, sh.sunBase);
    sh.sun.intensity = inten * 0.72;
    sh.far.intensity = inten * 0.28;
    sh.far.color.copy(sh.sun.color);
  }

  function configureShadowQuality(name) {
    var high = name === "high" || name === "ultra";
    var med = name === "medium";
    sh.texNear = high ? 2048 : med ? 1024 : 1024;
    sh.texFar = high ? 1024 : 512;
    // 远级一律 1/4 帧率（含高档）：远级 110m 视锥的位移肉眼不可辨，
    // 提到 1/3 只是白烧 shadow pass，且高档次里反而更容易抖。
    sh.farInterval = 4;
    S.shadow.nearSize = sh.texNear;
    S.shadow.farSize = sh.texFar;
    S.shadow.farInterval = sh.farInterval;
    S.shadow.farRadius = sh.farRadius = high ? 0.6 : 0.55;
    S.shadow.farMode = "pcf-lite";
    if (sh.far) sh.far.shadow.radius = sh.farRadius;
    if (sh.sun) {
      sh.sun.shadow.mapSize.set(sh.texNear, sh.texNear);
      if (sh.sun.shadow.map) { sh.sun.shadow.map.dispose(); sh.sun.shadow.map = null; }
      sh.sun.shadow.needsUpdate = true;
    }
    if (sh.far) {
      sh.far.shadow.mapSize.set(sh.texFar, sh.texFar);
      if (sh.far.shadow.map) { sh.far.shadow.map.dispose(); sh.far.shadow.map = null; }
      sh.far.shadow.needsUpdate = true;
    }
    sh.force = true; sh.farDirty = true;
  }

  /* =====================================================================
     2. WP35-2 · TAA-lite / FXAA 增强
     ===================================================================== */
  var aa = {
    mat: null, ok: false, enabled: false, valid: 0,
    tex: null, dummy: null, size: null,
    prevVP: null, curVP: null, invVP: null,
    jitter: 0, histReady: false, patched: false, mode: "fxaa", wasOn: false,
    base: { e8: 0, e9: 0, v8: 0, v9: 0 },
    // V39：TAA 真正启用与否要可观测 —— ok=注入成功，valid=历史纹理已写入，
    // failed=真实原因（disable 后 S.aa 必须回到 fxaa，而不是假装开着）
    failed: "", copyFails: 0, histFrames: 0, enabledFrames: 0
  };

  function halton(i, b) {
    var f = 1, r = 0;
    while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
    return r;
  }

  function makeDummyTex() {
    var d = new Uint8Array([255, 255, 255, 255]);
    var tx = new T.DataTexture(d, 1, 1, T.RGBAFormat);
    tx.needsUpdate = true;
    return tx;
  }

  // copyFramebufferToTexture 需要「有真实存储」的纹理：
  // 旧实现用裸 Texture + image={w,h}，three 走 else 分支拿 image 当 TexImageSource，
  // texImage2D 直接抛错 → 历史永远写不进去（valid 恒 0），TAA 静默退化成 FXAA。
  // three r180 的 FramebufferTexture 就是为这条路径准备的（texImage2D(..., null)）。
  function makeHistoryTexture(w, h) {
    var i;
    if (T.FramebufferTexture) {
      try {
        var ft = new T.FramebufferTexture(w, h);
        ft.minFilter = T.LinearFilter;
        ft.magFilter = T.LinearFilter;
        ft.generateMipmaps = false;
        ft.flipY = false;
        if (T.NoColorSpace !== undefined) ft.colorSpace = T.NoColorSpace;
        return ft;
      } catch (e) { soft("history-texture", e); }
    }
    var d = new Uint8Array(Math.max(4, w * h * 4));
    var tx = new T.DataTexture(d, Math.max(1, w), Math.max(1, h), T.RGBAFormat);
    tx.format = T.RGBAFormat;
    tx.type = T.UnsignedByteType;
    tx.minFilter = T.LinearFilter;
    tx.magFilter = T.LinearFilter;
    tx.generateMipmaps = false;
    tx.flipY = false;
    if (T.NoColorSpace !== undefined) tx.colorSpace = T.NoColorSpace;
    tx.needsUpdate = true;
    return tx;
  }

  // final pass 源码（引擎 iA）= Js(声明 vUv) + uniform tSrc/uTexel + main{…}。
  // 注入约束：
  //   · prologue 只能插在第一个 void main() 之前（tSrc / uTexel / vUv 之后才可用）
  //   · 调用点必须落在 col 的最终值上：film grain 之前，否则 grain/dither 不会被历史吸收
  //   · 任何一个锚点缺失就明确失败并回退 FXAA，绝不留半注入的 shader
  function findFinalMaterial() {
    var list = (G.render.postModule && G.render.postModule.materials) ||
               (G.render.post && Array.isArray(G.render.post.materials) ? G.render.post.materials : []) || [];
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === "post-final" && list[i].fragmentShader) found = list[i];
    }
    return found;
  }

  function taaPrologue() {
    return [
      "// SX_TAA",
      "uniform sampler2D tSxHist;",
      "uniform sampler2D tSxDepth;",
      "uniform mat4 uSxInvVP;",
      "uniform mat4 uSxPrevVP;",
      "uniform float uSxHistValid;",
      "uniform float uSxTaaAmt;",
      "vec3 sxTaa(vec3 cur){",
      "  if (uSxTaaAmt < 0.001 || uSxHistValid < 0.5) return cur;",
      "  float d = texture2D(tSxDepth, vUv).r;",
      "  if (d <= 0.0 || d >= 0.999999) return cur;",
      "  vec4 wp = uSxInvVP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);",
      "  wp /= max(wp.w, 1e-4);",
      "  vec4 pc = uSxPrevVP * wp;",
      "  vec2 puv = pc.xy / max(pc.w, 1e-4) * 0.5 + 0.5;",
      "  if (pc.w <= 0.0 || puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) return cur;",
      "  vec3 mn = cur, mx = cur;",
      "  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {",
      "    vec3 c = texture2D(tSrc, vUv + vec2(float(i), float(j)) * uTexel).rgb;",
      "    mn = min(mn, c); mx = max(mx, c);",
      "  }",
      "  vec3 ext = (mx - mn) * 1.25;",
      "  vec3 hist = clamp(texture2D(tSxHist, puv).rgb, mn - ext, mx + ext);",
      "  float vel = length(puv - vUv);",
      "  float w = mix(0.90, 0.45, smoothstep(0.003, 0.045, vel)) * uSxTaaAmt;",
      "  return mix(cur, hist, clamp(w, 0.0, 0.92));",
      "}",
      ""
    ].join("\n");
  }

  function patchFinalShader(src) {
    if (!src) return null;
    if (src.indexOf("SX_TAA") >= 0) return src;
    if (!/varying\s+vec2\s+vUv/.test(src)) return null;      // 无 vUv 无法重投影
    if (src.indexOf("uniform sampler2D tSrc") < 0 || src.indexOf("uTexel") < 0) return null;
    var m = src.search(/void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/);
    if (m < 0) return null;
    var out = src.slice(0, m) + taaPrologue() + src.slice(m);
    // 调用点 1：胶片颗粒之前（final pass 中 col 的最终值）
    var anchor = "  // animated, luminance-weighted film grain";
    if (out.indexOf(anchor) >= 0) {
      out = out.replace(anchor, "  col = sxTaa(col);\n" + anchor);
    } else {
      // 调用点 2（引擎换注释时的兜底）：最后一个 gl_FragColor 之前
      var g = out.lastIndexOf("gl_FragColor");
      if (g < 0) return null;
      out = out.slice(0, g) + "col = sxTaa(col);\n  " + out.slice(g);
    }
    if (out.indexOf("sxTaa(col)") < 0) return null;
    return out;
  }

  function initAA() {
    aa.dummy = makeDummyTex();
    if (!aa.sizeTmp) aa.sizeTmp = new T.Vector2();
    if (!aa.resizeBound) {
      aa.resizeBound = true;
      // 窗口/画布尺寸变化后重建历史纹理，避免 copyFramebufferToTexture 越界
      window.addEventListener("resize", function () { aa.resizePending = true; });
    }
    aa.mat = findFinalMaterial();
    if (!aa.mat) {
      aa.failed = "post-final material missing";
      S.aa = "fxaa";
      return;
    }
    var src = aa.mat.fragmentShader;
    var patchedSrc;
    try {
      patchedSrc = patchFinalShader(src);
    } catch (e) {
      patchedSrc = null;
      aa.failed = String((e && e.message) || e);
    }
    if (!patchedSrc) {
      aa.ok = false;
      aa.patched = false;
      aa.failed = aa.failed || "SX_TAA anchors not found in post-final";
      S.aa = "fxaa";
      console.warn("[sx-visual] TAA 注入失败，回退 FXAA: " + aa.failed);
      return;
    }
    try {
      aa.mat.fragmentShader = patchedSrc;
      aa.mat.uniforms.tSxHist = { value: aa.dummy };
      aa.mat.uniforms.tSxDepth = { value: aa.dummy };
      aa.mat.uniforms.uSxInvVP = { value: new T.Matrix4() };
      aa.mat.uniforms.uSxPrevVP = { value: new T.Matrix4() };
      aa.mat.uniforms.uSxHistValid = { value: 0 };
      aa.mat.uniforms.uSxTaaAmt = { value: 0 };
      aa.mat.needsUpdate = true;
      aa.patched = true;
      aa.ok = true;
      aa.failed = "";
      aa.tex = makeHistoryTexture(4, 4);
      onResizeAA();
    } catch (e) {
      aa.ok = false;
      aa.patched = false;
      aa.failed = String((e && e.message) || e);
      S.aa = "fxaa";
      fail("aa patch", e);
    }
  }

  function onResizeAA() {
    if (!aa.tex) return;
    if (!aa.sizeTmp) aa.sizeTmp = new T.Vector2();
    var size = G.renderer.getDrawingBufferSize(aa.sizeTmp);
    if (size.x < 2 || size.y < 2) return;
    if (aa.size.x === size.x && aa.size.y === size.y) return;
    aa.size.copy(size);
    // 尺寸变化：先换上新纹理，再释放旧历史，避免越界采样/写入
    var old = aa.tex;
    aa.tex = makeHistoryTexture(size.x, size.y);
    if (aa.mat && aa.mat.uniforms) {
      if (aa.mat.uniforms.tSxHist) aa.mat.uniforms.tSxHist.value = aa.tex;
      if (aa.mat.uniforms.uSxHistValid) aa.mat.uniforms.uSxHistValid.value = 0;
    }
    aa.valid = 0;
    aa.histReady = false;
    try { old.dispose(); } catch (e) { soft("aa-target-dispose", e); }
  }

  function aaEnabled() {
    if (!aa.ok || !aa.tex || !S.enabled) return false;
    if (params.notaa === "1" || params.shot || G.level.stub) return false;
    return qualityName === "medium" || qualityName === "high" || qualityName === "ultra";
  }

  function applyAA(dt) {
    if (aa.resizePending) { aa.resizePending = false; onResizeAA(); }
    // 历史写入连续失败（纹理格式/尺寸不对等）：明确回退 FXAA，不再假装 TAA 开着
    if (aa.ok && aa.copyFails >= 3) {
      aa.ok = false;
      aa.enabled = false;
      aa.valid = 0;
      aa.failed = aa.failed || "history copy failed";
      if (aa.mat && aa.mat.uniforms) {
        if (aa.mat.uniforms.uSxTaaAmt) aa.mat.uniforms.uSxTaaAmt.value = 0;
        if (aa.mat.uniforms.uSxHistValid) aa.mat.uniforms.uSxHistValid.value = 0;
      }
      restoreJitter();
      S.aa = "fxaa";
      return;
    }
    var on = aaEnabled();
    aa.enabled = on;
    if (on) aa.enabledFrames++;
    S.aa = on ? "taa-lite" : "fxaa";
    if (!on) {
      // 低画质 / test / 截图：直接还原抖动返回，不跑矩阵求逆、不写 uniform。
      // 仅在从 TAA 档切回来时做一次性清理，避免 shader 残留上一帧的历史混合。
      if (aa.wasOn) {
        aa.wasOn = false;
        aa.valid = 0;
        if (aa.mat && aa.mat.uniforms) {
          if (aa.mat.uniforms.uSxTaaAmt) aa.mat.uniforms.uSxTaaAmt.value = 0;
          if (aa.mat.uniforms.uSxHistValid) aa.mat.uniforms.uSxHistValid.value = 0;
        }
      }
      restoreJitter();
      return;
    }
    if (!aa.mat) { aa.enabled = false; S.aa = "fxaa"; return; }
    var depth = null;
    try { depth = G.render.depthTexture; } catch (e) { soft("depth-texture", e); }
    if (!depth) {
      aa.enabled = false;
      S.aa = "fxaa";
      aa.wasOn = false;
      restoreJitter();
      return;
    }
    aa.wasOn = true;
    aa.mat.uniforms.tSxDepth.value = depth;
    if (aa.tex) aa.mat.uniforms.tSxHist.value = aa.tex;
    aa.depthLive = true;
    // 亚像素抖动：Halton(2,3)
    var idx = (frameNo % 8) + 1;
    var jx = halton(idx, 2) - 0.5;
    var jy = halton(idx, 3) - 0.5;
    var size = aa.size;
    var e = G.camera.projectionMatrix.elements;
    aa.base.e8 = e[8]; aa.base.e9 = e[9];
    e[8] += (2 * jx) / Math.max(2, size.x);
    e[9] += (2 * jy) / Math.max(2, size.y);
    var vc = G.viewCamera;
    if (vc && vc.projectionMatrix) {
      var ve = vc.projectionMatrix.elements;
      aa.base.v8 = ve[8]; aa.base.v9 = ve[9];
      ve[8] += (2 * jx) / Math.max(2, size.x);
      ve[9] += (2 * jy) / Math.max(2, size.y);
    }
    aa.jitter = 1;

    var cam = G.camera;
    cam.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    aa.curVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    aa.invVP.copy(aa.curVP).invert();
    var u = aa.mat.uniforms;
    u.uSxInvVP.value.copy(aa.invVP);
    u.uSxPrevVP.value.copy(aa.prevVP);
    u.uSxHistValid.value = aa.valid ? 1 : 0;
    u.uSxTaaAmt.value = 1;
    u.tSxHist.value = aa.tex || aa.dummy;
    // FXAA 档增强锐化（TAA 档略降，避免双重锐化）
    try {
      if (G.render.tune) G.render.tune.sharpen = 0.22;
      if (aa.mat.uniforms.uFxaa) aa.mat.uniforms.uFxaa.value = 0;
    } catch (e) { soft("aa-tune", e); }
  }

  function restoreJitter() {
    if (!aa.jitter) return;
    var e = G.camera.projectionMatrix.elements;
    e[8] = aa.base.e8; e[9] = aa.base.e9;
    var vc = G.viewCamera;
    if (vc && vc.projectionMatrix) {
      var ve = vc.projectionMatrix.elements;
      ve[8] = aa.base.v8; ve[9] = aa.base.v9;
    }
    aa.jitter = 0;
  }

  function afterAA() {
    aa.prevVP.copy(aa.curVP);
    if (!aa.enabled || !aa.tex) { aa.valid = 0; return; }
    try {
      G.renderer.copyFramebufferToTexture(aa.tex);
      aa.valid = 1;
      aa.copyFails = 0;
      aa.histFrames++;
    } catch (e) {
      aa.valid = 0;
      aa.copyFails++;
      aa.failed = String((e && e.message) || e);
    }
  }

  /* =====================================================================
     3. WP35-3 · 环境探针 + 局部补光
     ===================================================================== */
  var pr = {
    map: "harbor", hints: null, list: [], pending: [], ready: 0, failed: 0,
    active: -1, pmrem: null, cube: null, cubeRT: null, cubeSize: 128,
    baseEnv: null, baseEnvIntensity: 1, lastCapture: 0, updates: 0, cooldown: 0,
    cap: null, capFaces: 2, tmp: null
  };
  var fill = null, fillBase = 0.6;

  function initFill() {
    fill = new T.PointLight(0xffe2c0, 0, 7, 2);
    fill.name = "sx-view-fill";
    fill.layers.enableAll();
    fill.castShadow = false;
    fill.position.set(0.18, -0.03, -0.32);
    G.camera.add(fill);
  }

  function initProbes() {
    pr.baseEnv = G.scene.environment || null;
    pr.baseEnvIntensity = G.scene.environmentIntensity == null ? 1 : G.scene.environmentIntensity;
    pr.pmrem = new T.PMREMGenerator(G.renderer);
    try { pr.pmrem.compileCubemapShader(); } catch (e) { soft("pmrem-compile", e); }
    pr.hints = hintsFor(mapId());
    pr.map = mapId();
    pr.cubeSize = qualityName === "low" || qualityName === "test" ? 64 : 128;
    if (pr.hints) queueProbes(pr.hints);
  }

  // 清空探针：释放所有 PMREM 渲染目标，避免 scene.environment 指向已释放 RT
  function dropProbes() {
    abortProbeCapture(false);
    // 先解绑场景环境，再释放 PMREM 渲染目标，避免 scene.environment 指向已释放 RT
    if (G && G.scene) {
      G.scene.environment = pr.baseEnv || null;
      G.scene.environmentIntensity = pr.baseEnvIntensity;
    }
    for (var i = 0; i < pr.list.length; i++) {
      var it = pr.list[i];
      if (!it || !it.env) continue;
      try { it.env.dispose(); } catch (e) { soft("probe-dispose", e); }
      it.env = null;
    }
    pr.pending.length = 0;
    pr.list.length = 0;
    pr.ready = 0;
    pr.failed = 0;
    pr.active = -1;
  }

  function queueProbes(hints) {
    dropProbes();
    pr.cooldown = 0.02;
    if (!hints || !hints.probes) return;
    for (var i = 0; i < hints.probes.length; i++) {
      var h = hints.probes[i];
      pr.pending.push({
        name: h.name || ("probe" + i),
        pos: new T.Vector3(h.pos[0], h.pos[1], h.pos[2]),
        range: h.range || 18,
        env: null,
        at: -1
      });
    }
  }

  function ensureCube() {
    if (!pr.pmrem) return false;
    var size = pr.cubeSize;
    if (!pr.cubeRT || pr.cubeRT.width !== size) {
      if (pr.cubeRT) pr.cubeRT.dispose();
      pr.cubeRT = new T.WebGLCubeRenderTarget(size, {
        type: T.HalfFloatType, generateMipmaps: false,
        minFilter: T.LinearFilter, magFilter: T.LinearFilter
      });
      pr.cube = new T.CubeCamera(0.1, 260, pr.cubeRT);
      pr.cube.layers.set(0);
    }
    return !!(pr.cube && pr.cubeRT);
  }

  // 捕获期间的场景/渲染器状态：每帧渲染完立即还原，避免敌人/FX 跨帧不可见
  function captureState() {
    var renderer = G.renderer;
    var enemies = G.scene.getObjectByName("enemies");
    var fxRoot = G.scene.getObjectByName("sx-visual-fx");
    var debris = G.scene.getObjectByName("sx-visual-debris");
    var sky = G.render.sky;
    var st = {
      tone: renderer.toneMapping,
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      xr: renderer.xr.enabled,
      env: G.scene.environment,
      envI: G.scene.environmentIntensity,
      enemies: enemies, enemiesOn: enemies ? enemies.visible : false,
      fx: fxRoot, fxOn: fxRoot ? fxRoot.visible : false,
      debris: debris, debrisOn: debris ? debris.visible : false,
      fillOn: fill ? fill.visible : false,
      gm: pr.cubeRT.texture.generateMipmaps,
      oldUEnv: null
    };
    try {
      renderer.toneMapping = T.NoToneMapping !== undefined ? T.NoToneMapping : st.tone;
      renderer.xr.enabled = false;
      pr.cubeRT.texture.generateMipmaps = false;
      G.scene.environment = pr.baseEnv;
      G.scene.environmentIntensity = pr.baseEnvIntensity;
      if (enemies) enemies.visible = false;
      if (fxRoot) fxRoot.visible = false;
      if (debris) debris.visible = false;
      if (fill) fill.visible = false;
      if (sky && sky.material && sky.material.uniforms && sky.material.uniforms.uEnv) {
        st.oldUEnv = sky.material.uniforms.uEnv.value;
        sky.material.uniforms.uEnv.value = 1;
      }
    } catch (e) { restoreCaptureState(st); throw e; }
    return st;
  }

  function restoreCaptureState(st) {
    if (!st) return;
    var renderer = G.renderer;
    try {
      renderer.setRenderTarget(st.target, st.face, st.mip);
      renderer.toneMapping = st.tone;
      renderer.xr.enabled = st.xr;
      G.scene.environment = st.env;
      G.scene.environmentIntensity = st.envI;
      if (st.enemies) st.enemies.visible = st.enemiesOn;
      if (st.fx) st.fx.visible = st.fxOn;
      if (st.debris) st.debris.visible = st.debrisOn;
      if (fill) fill.visible = st.fillOn;
      if (st.oldUEnv !== null) {
        var sky = G.render.sky;
        if (sky && sky.material && sky.material.uniforms && sky.material.uniforms.uEnv) {
          sky.material.uniforms.uEnv.value = st.oldUEnv;
        }
      }
      if (pr.cubeRT) pr.cubeRT.texture.generateMipmaps = st.gm;
    } catch (e) { soft("capture-restore", e); }
  }

  function beginProbeCapture(item) {
    if (!ensureCube()) return false;
    var cam = pr.cube;
    cam.position.copy(item.pos);
    var renderer = G.renderer;
    if (cam.coordinateSystem !== renderer.coordinateSystem) {
      cam.coordinateSystem = renderer.coordinateSystem;
      try { cam.updateCoordinateSystem(); } catch (e) { return false; }
    }
    cam.updateMatrixWorld(true);
    pr.cap = { item: item, face: 0 };
    return true;
  }

  function abortProbeCapture(requeue) {
    if (!pr.cap) return;
    var item = pr.cap.item;
    pr.cap = null;
    if (requeue && item) pr.pending.unshift(item);
  }

  function stepProbeCapture(forceAll) {
    var cap = pr.cap;
    if (!cap) return false;
    var renderer = G.renderer;
    var st = captureState();
    try {
      // 正常帧率下每帧最多 2 个 cube 面（6 面 / 3 帧），避免进图瞬间的百毫秒尖峰；
      // 低画质/test 档或帧时已明显偏高（SwiftShader/低端机）时整数探针一次渲染完，
      // 不再把「就绪」拖成多帧 —— 无头低帧率下多帧等待会被拉成数秒甚至超时。
      var faces = forceAll || S.frameMs > 32 || S.frameMsAvg > 32 ? 6 : pr.capFaces;
      var end = Math.min(6, cap.face + faces);
      for (var f = cap.face; f < end; f++) {
        renderer.setRenderTarget(pr.cubeRT, f, 0);
        renderer.render(G.scene, pr.cube.children[f]);
      }
      cap.face = end;
    } finally {
      restoreCaptureState(st);
    }
    if (cap.face < 6) return false;
    pr.cubeRT.texture.needsPMREMUpdate = true;
    var out = pr.pmrem.fromCubemap(pr.cubeRT.texture);
    var oldEnv = cap.item.env;
    if (oldEnv) {
      // 重捕当前 active 探针时先绑定新 env，再释放旧 env，避免环境贴图指向已释放 RT
      if (pr.active >= 0 && pr.list[pr.active] === cap.item) G.scene.environment = out.texture;
      try { oldEnv.dispose(); } catch (e) { soft("probe-env-dispose", e); }
    }
    cap.item.env = out;
    cap.item.at = G.time ? G.time.t : frameNo / 60;
    pr.ready++;
    pr.updates++;
    pr.list.push(cap.item);
    pr.cap = null;
    return true;
  }

  // 低画质 / test：整图探针在 map:loaded 内同步做完（≤1 帧）。
  // 高画质正常帧率仍按 2 面/帧分批，避免进图瞬间的 GPU 尖峰。
  function probeSyncMode() { return qualityName === "low" || qualityName === "test"; }

  function probeStats() {
    S.probes.map = pr.map;
    S.probes.count = pr.list.length;
    S.probes.ready = pr.ready;
    S.probes.pending = pr.pending.length + (pr.cap ? 1 : 0);
    S.probes.active = pr.active;
    S.probes.updated = pr.updates;
    S.probes.failed = pr.failed;
  }

  // 选出玩家所在范围的探针并把 PMREM 贴到 scene.environment（不再等下一帧）
  function selectProbe() {
    if (!pr.list.length) { pr.active = -1; return; }
    var p = G.player && G.player.pos ? G.player.pos : G.camera.position;
    var best = -1, bestD = 1e9;
    for (var i = 0; i < pr.list.length; i++) {
      if (!pr.list[i].env) continue;
      var d = p.distanceTo(pr.list[i].pos);
      if (d < pr.list[i].range && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) best = 0;
    var it = pr.list[best];
    if (!it || !it.env) { pr.active = -1; return; }
    if (best !== pr.active) {
      G.scene.environment = it.env.texture;
      var hint = pr.hints || {};
      G.scene.environmentIntensity = (hint.envIntensity == null ? 1.0 : hint.envIntensity) * (1 + 0.08 * Math.sin((G.time.t || 0) * 0.7));
      pr.active = best;
    }
  }

  function flushProbes() {
    if (!probeSyncMode() || !S.enabled) return false;
    var guard = 0;
    while (pr.pending.length && guard++ < 16) {
      var item = pr.pending.shift();
      try {
        if (!beginProbeCapture(item)) { pr.failed++; pr.list.push(item); continue; }
        stepProbeCapture(true);
      } catch (e) {
        var bad = (pr.cap && pr.cap.item) || item;
        pr.cap = null;
        pr.failed++;
        pr.list.push(bad);
        fail("probe sync", e);
        break;
      }
    }
    selectProbe();
    probeStats();
    return true;
  }

  function updateProbes(dt) {
    if (!S.enabled) return;
    // 同步档：pending 一律在当帧清空（含 refreshProbes / 二进图重排）
    if (probeSyncMode() && pr.pending.length && !pr.cap) flushProbes();
    if (!pr.cap && pr.pending.length) {
      pr.cooldown -= dt;
      if (pr.cooldown <= 0) {
        pr.cooldown = 0.02;
        var item = pr.pending.shift();
        try {
          if (!beginProbeCapture(item)) { pr.failed++; pr.list.push(item); }
        } catch (e) { fail("probe capture", e); pr.failed++; pr.list.push(item); }
      }
    }
    if (pr.cap) {
      try { stepProbeCapture(); }
      catch (e) {
        var failedItem = pr.cap && pr.cap.item;
        pr.cap = null;
        if (failedItem) { pr.failed++; pr.list.push(failedItem); }
        fail("probe capture", e);
      }
    }
    // 探针只在 map:loaded 捕获一次（不做 25s 重捕）
    if (!pr.list.length) {
      S.probes.count = 0; S.probes.ready = 0; S.probes.pending = pr.pending.length + (pr.cap ? 1 : 0); S.probes.active = -1;
      return;
    }
    selectProbe();
    probeStats();
  }

  /* =====================================================================
     4. WP35-4 · 第一人称摆动 + 暗场补光
     ===================================================================== */
  var fp = {
    landX: 0, landV: 0, reloadT: 0, reloadDur: 0, reloadPhase: "", sprintAmt: 0,
    lastYaw: 0, turn: 0, lastReload: "", shake: 0, stepT: 0
  };
  var camBasePos = null, camBaseQuat = null;

  function initFirstPerson() {
    G.events.on("player:land", function (ev) {
      var v = clamp(((ev && ev.speed) || 4) / 13, 0, 1);
      fp.landV -= 0.12 + v * 0.28;
      fp.shake = Math.max(fp.shake, v * 0.35);
    });
    G.events.on("player:step", function (ev) {
      fp.stepT = 0.001;
    });
    G.events.on("weapon:reload", function (ev) {
      if (!ev) return;
      if (ev.phase === "start") {
        fp.reloadT = 0;
        fp.reloadDur = 2.5;
        fp.reloadPhase = "start";
      } else if (ev.phase === "magout") {
        fp.reloadT = Math.max(fp.reloadT, 0.7);
      } else if (ev.phase === "magin") {
        fp.reloadT = Math.max(fp.reloadT, 1.45);
      } else if (ev.phase === "done") {
        fp.reloadT = fp.reloadDur;
        fp.reloadPhase = "done";
      }
    });
    G.events.on("sx:shield-break", function (ev) { fp.shake = Math.max(fp.shake, 0.22); });
    G.events.on("explosion", function (ev) {
      if (!ev || !ev.pos) return;
      var d = ev.pos.distanceTo(G.player.pos);
      fp.shake = Math.max(fp.shake, clamp(1 - d / 30, 0, 1) * 0.28);
    });
  }

  function updateFirstPerson(dt) {
    var p = G.player;
    var reduce = S.reduced; // 只读缓存值：由 64 帧刷新 + 设置点击事件更新，避免每帧 JSON.parse
    var amp = reduce ? 0.25 : 1;
    fp.sprintAmt += (((p && p.sprinting) ? 1 : 0) - fp.sprintAmt) * Math.min(1, dt * 6);
    if (fp.reloadT < fp.reloadDur) fp.reloadT += dt;
    // 落地弹簧
    var k = 90, c = 12;
    fp.landV += (-k * fp.landX - c * fp.landV) * dt;
    fp.landX += fp.landV * dt;
    fp.landX = clamp(fp.landX, -0.28, 0.08);
    fp.shake = Math.max(0, fp.shake - dt * 2.2);
    fp.turn += (((G.camera.rotation.y || 0) - fp.lastYaw) - fp.turn) * 0.3;
    fp.lastYaw = G.camera.rotation.y || 0;
    var speed = p ? (p.speed || 0) : 0;
    var sprint = fp.sprintAmt;
    var t = (G.time && G.time.t) || 0;
    var swayX = Math.sin(t * 9.2) * 0.0035 * sprint * amp + clamp(fp.turn, -0.05, 0.05) * 0.35 * amp;
    var swayY = Math.cos(t * 18.4) * 0.0025 * sprint * amp;
    var roll = Math.sin(t * 9.2) * 0.006 * sprint * amp + clamp(fp.turn, -0.04, 0.04) * 0.55 * amp;
    // 换弹：下沉 + 侧倾
    var rp = fp.reloadDur > 0 ? clamp(fp.reloadT / fp.reloadDur, 0, 1) : 0;
    var ra = fp.reloadDur > 0 && fp.reloadT < fp.reloadDur ? Math.sin(Math.PI * rp) : 0;
    var reloadY = -0.045 * ra * amp;
    var reloadRoll = -0.035 * ra * amp;
    var reloadPitch = 0.018 * ra * amp;
    // 落地下沉
    var landY = fp.landX * 0.35;
    var landPitch = -fp.landX * 0.55;
    // 货轮缓慢横摇
    var shipRoll = 0;
    var hint = pr.hints || {};
    if (S.map === "ship" && hint.roll && !reduce) shipRoll = Math.sin(t * Math.PI * 2 / 9) * (hint.roll * Math.PI / 180);
    S.shipRoll = shipRoll;
    var shake = fp.shake;
    var sx = (Math.sin(t * 57.1) + 0.5 * Math.sin(t * 93.7)) * shake * 0.004;
    var sy = (Math.sin(t * 49.3 + 1.0)) * shake * 0.004;
    if (!amp) { swayX = swayY = roll = reloadY = reloadRoll = reloadPitch = landY = landPitch = sx = sy = 0; }
    camBasePos.copy(G.camera.position);
    camBaseQuat.copy(G.camera.quaternion);
    G.camera.translateX(swayX + sx);
    G.camera.translateY(swayY + reloadY + landY + sy);
    G.camera.rotateZ(roll + reloadRoll + shipRoll);
    G.camera.rotateX(reloadPitch + landPitch);
    S.fp.sprint = +sprint.toFixed(3);
    S.fp.reload = +ra.toFixed(3);
    S.fp.land = +fp.landX.toFixed(3);
    S.fp.roll = +(roll + reloadRoll + shipRoll).toFixed(4);
    // 跟随补光：室内更亮、暗色枪模不再成黑块
    if (fill) {
      var interior = 0;
      try {
        var boxes = G.level && G.level.interiorBoxes;
        if (boxes && boxes[0]) {
          var b = boxes[0], cp = G.camera.position;
          interior = (cp.x > b.min.x && cp.x < b.max.x && cp.z > b.min.z && cp.z < b.max.z && cp.y < b.max.y) ? 1 : 0;
        }
      } catch (e) { soft("interior-probe", e); }
      var hintFill = hint.fill || {};
      var base = hintFill.intensity == null ? (interior ? 2.4 : 0.55) : hintFill.intensity;
      var target = base * (interior ? 1 : 0.55) * (1 + 0.3 * (p && p.ads || 0));
      fill.intensity += (target - fill.intensity) * Math.min(1, dt * 6);
      if (hintFill.color != null) fill.color.setHex(hintFill.color);
      S.fill.intensity = +fill.intensity.toFixed(3);
    }
  }

  function restoreCamera() {
    G.camera.position.copy(camBasePos);
    G.camera.quaternion.copy(camBaseQuat);
  }

  /* =====================================================================
     5. WP35-5 · 受击闪白 / 碎块 / 护盾破碎
     ===================================================================== */
  var mat = null;
  var flashEnemies = [];
  var chunks = [], chunkMesh = null, chunkDummy = null, chunkColor = null;
  var MAX_CHUNKS = 80, chunkSeq = 0;
  var rings = [], ringPool = null, ringIdx = 0;
  var hitT = 0;
  var sxWhite = null;

  function initDebris() {
    var geo = new T.BoxGeometry(1, 1, 1);
    var m = new T.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.52, metalness: 0.62 });
    chunkMesh = new T.InstancedMesh(geo, m, MAX_CHUNKS);
    chunkMesh.name = "sx-visual-debris";
    chunkMesh.frustumCulled = false;
    chunkMesh.castShadow = false;
    chunkMesh.receiveShadow = true;
    chunkMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var colors = new Float32Array(MAX_CHUNKS * 3);
    for (var i = 0; i < MAX_CHUNKS; i++) colors[i * 3] = 1;
    chunkMesh.instanceColor = new T.InstancedBufferAttribute(colors, 3);
    chunkMesh.instanceColor.setUsage(T.DynamicDrawUsage);
    chunkMesh.count = 0;
    G.scene.add(chunkMesh);

    ringPool = [];
    for (var j = 0; j < 4; j++) {
      var rg = new T.Mesh(
        new T.RingGeometry(0.4, 0.55, 28),
        new T.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })
      );
      rg.rotation.x = -Math.PI / 2;
      rg.visible = false;
      rg.frustumCulled = false;
      rg.name = "sx-shield-ring" + j;
      G.scene.add(rg);
      ringPool.push({ mesh: rg, t: 0, life: 0, scale: 1, color: 0x9fe6ff });
    }
  }

  function spawnDebris(pos, dir, count, color, speed, size) {
    if (!chunkMesh) return;
    for (var i = 0; i < count; i++) {
      var c = chunks.length >= MAX_CHUNKS ? chunks[chunkSeq % MAX_CHUNKS] : { id: 0 };
      if (chunks.length < MAX_CHUNKS && !c.active) { c.id = chunks.length; chunks.push(c); }
      else { chunkSeq++; }
      c.active = true;
      c.pos = c.pos || new T.Vector3();
      c.vel = c.vel || new T.Vector3();
      c.rot = c.rot || new T.Euler();
      c.ang = c.ang || new T.Vector3();
      c.scale = c.scale || new T.Vector3();
      c.pos.copy(pos);
      var a = Math.random() * Math.PI * 2, b = Math.random();
      c.pos.x += (Math.random() - 0.5) * 0.45;
      c.pos.y += Math.random() * 0.7;
      c.pos.z += (Math.random() - 0.5) * 0.45;
      c.vel.set(Math.cos(a) * (1 + b * 2), 1.2 + Math.random() * 2.2, Math.sin(a) * (1 + b * 2));
      if (dir) c.vel.addScaledVector(dir, speed || 1.2);
      c.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      c.ang.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      var s = size || (0.07 + Math.random() * 0.13);
      c.scale.set(s, s * (0.5 + Math.random() * 0.7), s * (0.7 + Math.random()));
      c.life = 20; c.maxLife = 20;
      c.bounce = 0;
      c.gy = null; c.gx = 1e9; c.gz = 1e9; c.rest = false;
      c.color = color == null ? 0x9aa0a4 : color;
    }
  }

  function updateDebris(dt) {
    if (!chunkMesh) return;
    var active = 0;
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i];
      if (!c.active) continue;
      c.life -= dt;
      if (!c.rest) {
        c.vel.y -= 18 * dt;
        c.pos.addScaledVector(c.vel, dt);
        // gy 按块缓存：仅水平位移超过 0.35m 时重查；落地静止后不再查 groundHeight
        var gdx = c.pos.x - c.gx, gdz = c.pos.z - c.gz;
        if (c.gy == null || gdx * gdx + gdz * gdz > 0.1225) {
          c.gy = 0;
          try { c.gy = G.physics.groundHeight(c.pos.x, c.pos.z, c.pos.y + 1) || 0; } catch (e) { soft("ground-height", e); }
          c.gx = c.pos.x; c.gz = c.pos.z;
        }
        var gy = c.gy || 0;
        if (c.pos.y < gy + 0.03) {
          c.pos.y = gy + 0.03;
          if (c.bounce < 3) {
            c.vel.y = -c.vel.y * 0.38;
            c.vel.x *= 0.65; c.vel.z *= 0.65;
            c.ang.multiplyScalar(0.7);
            c.bounce++;
          } else { c.vel.set(0, 0, 0); c.ang.set(0, 0, 0); c.rest = true; }
        }
        c.rot.x += c.ang.x * dt; c.rot.y += c.ang.y * dt; c.rot.z += c.ang.z * dt;
      }
      if (c.life <= 0) { c.active = false; continue; }
      var fade = clamp(c.life / 1.0, 0, 1);
      chunkDummy.position.copy(c.pos);
      chunkDummy.rotation.copy(c.rot);
      chunkDummy.scale.copy(c.scale).multiplyScalar(fade);
      chunkDummy.updateMatrix();
      chunkMesh.setMatrixAt(active, chunkDummy.matrix);
      chunkColor.setHex(c.color);
      chunkMesh.setColorAt(active, chunkColor);
      active++;
    }
    chunkMesh.count = active;
    chunkMesh.instanceMatrix.needsUpdate = true;
    if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
    S.effects.debris = active;
  }

  function spawnRing(pos, color, size) {
    if (!ringPool) return;
    for (var i = 0; i < ringPool.length; i++) {
      var r = ringPool[(ringIdx + i) % ringPool.length];
      if (r.life <= 0) {
        ringIdx = (ringIdx + i + 1) % ringPool.length;
        r.mesh.position.copy(pos); r.mesh.position.y += 0.05;
        r.mesh.scale.setScalar(size || 1);
        r.mesh.material.color.setHex(color || 0x9fe6ff);
        r.mesh.material.opacity = 0.85;
        r.mesh.visible = true;
        r.t = 0; r.life = 0.55; r.scale = size || 1;
        return;
      }
    }
  }

  function updateRings(dt) {
    if (!ringPool) return;
    var n = 0;
    for (var i = 0; i < ringPool.length; i++) {
      var r = ringPool[i];
      if (r.life <= 0) continue;
      r.t += dt; r.life -= dt;
      var k = clamp(1 - r.life / 0.55, 0, 1);
      r.mesh.scale.setScalar(r.scale * (1 + k * 4.5));
      r.mesh.material.opacity = 0.85 * (1 - k) * (1 - k);
      if (r.life <= 0) r.mesh.visible = false; else n++;
    }
    S.effects.rings = n;
  }

  function flashMaterials(e) {
    if (!e || !e.rig || !e.rig.group) return;
    if (!e.__sxFlashMats) {
      var list = [];
      e.rig.group.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var arr = Array.isArray(o.material);
        var src = arr ? o.material : [o.material];
        var out = [];
        for (var i = 0; i < src.length; i++) {
          var m = src[i];
          if (!m || !m.emissive) { out.push(m); continue; }
          if (m.__sxFlashOwned) { out.push(m); continue; }
          var clone = m.clone();
          clone.__sxFlashOwned = true;
          out.push(clone);
          // 记录原材质与宿主，移除时还原引用并 dispose，避免对象池复用时丢闪白
          list.push({ m: clone, base: clone.emissive.clone(), bi: clone.emissiveIntensity || 0, mesh: o, src: m, idx: arr ? i : -1 });
        }
        o.material = arr ? out : out[0];
      });
      e.__sxFlashMats = list;
    }
    e.__sxFlashT = 0.11;
    for (var i = 0; i < e.__sxFlashMats.length; i++) {
      var f = e.__sxFlashMats[i];
      f.m.emissive.setRGB(1.0, 0.93, 0.82);
      f.m.emissiveIntensity = f.bi + 1.7;
    }
    hitT = 0.12;
  }

  function updateHitFlashes(dt) {
    if ((frameNo % 120) === 0) sweepFlashes();
    var active = 0;
    for (var i = 0; i < flashEnemies.length; i++) {
      var e = flashEnemies[i];
      if (!e || !e.__sxFlashT) continue;
      e.__sxFlashT -= dt;
      var k = Math.max(0, e.__sxFlashT / 0.11);
      if (e.__sxFlashMats) {
        for (var j = 0; j < e.__sxFlashMats.length; j++) {
          var f = e.__sxFlashMats[j];
          f.m.emissive.copy(f.base).lerp(sxWhite, k);
          f.m.emissiveIntensity = f.bi + 1.7 * k;
        }
      }
      if (e.__sxFlashT <= 0) {
        e.__sxFlashT = 0;
        if (e.__sxFlashMats) for (var q = 0; q < e.__sxFlashMats.length; q++) {
          var g = e.__sxFlashMats[q]; g.m.emissive.copy(g.base); g.m.emissiveIntensity = g.bi;
        }
      } else active++;
    }
    S.effects.hitFlash = active;
    hitT = Math.max(0, hitT - dt);
  }

  function releaseFlashMats(e) {
    if (!e) return;
    var list = e.__sxFlashMats;
    e.__sxFlashMats = null;
    e.__sxFlashT = 0;
    var k = e.__sxKick;
    if (k && k.bone) {
      try { k.bone.position.x = k.bx; k.bone.position.y = k.by; k.bone.position.z = k.bz; } catch (err) { soft("kick-restore", err); }
    }
    e.__sxKick = null;
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      try {
        var mesh = f.mesh, mat = mesh && mesh.material;
        if (mesh) {
          if (f.idx >= 0 && mat && mat[f.idx] === f.m) mat[f.idx] = f.src;
          else if (mat === f.m) mesh.material = f.src;
        }
        f.m.dispose();
      } catch (err) { soft("flash-mat-restore", err); }
    }
    list.length = 0;
  }

  function untrackFlash(e) {
    if (!e) return;
    var i = flashEnemies.indexOf(e);
    if (i >= 0) flashEnemies.splice(i, 1);
    releaseFlashMats(e);
  }

  function untrackAllFlashes() {
    for (var i = 0; i < flashEnemies.length; i++) releaseFlashMats(flashEnemies[i]);
    flashEnemies.length = 0;
  }

  // 每 2s 清理：死亡/已移除的敌人释放 clone 材质；存活的空闲敌人只移出跟踪表，保留 clone 供复用
  function sweepFlashes() {
    for (var i = flashEnemies.length - 1; i >= 0; i--) {
      var e = flashEnemies[i];
      if (!e) { flashEnemies.splice(i, 1); continue; }
      if (e.alive) {
        if (!e.__sxFlashT && !e.__sxKick) flashEnemies.splice(i, 1);
        continue;
      }
      var inList = false;
      try { inList = !!(G.enemies && G.enemies.list && G.enemies.list.indexOf(e) >= 0); } catch (err) { soft("enemy-list-probe", err); }
      if (!inList || (!e.__sxFlashT && !e.__sxKick)) untrackFlash(e);
    }
  }

  function onEnemyHit(ev) {
    var e = ev && ev.enemy;
    if (!e) return;
    if (flashEnemies.indexOf(e) < 0) flashEnemies.push(e);
    safe(function () { flashMaterials(e); });
    // 视觉后坐：只改骨骼局部偏移，下一帧被敌人自身动画覆盖，不进入 sim
    try {
      if (e.rig && e.rig.bones) {
        var b = e.rig.bones.body || e.rig.bones.neck || e.rig.bones.spine;
        if (b) {
          e.__sxKick = { bone: b, t: 0.16, x: (Math.random() - 0.5) * 0.035, z: -0.05, bx: b.position.x, by: b.position.y, bz: b.position.z };
        }
      }
    } catch (err) { soft("rig-bones", err); }
  }

  function updateEnemyKicks(dt) {
    for (var i = 0; i < flashEnemies.length; i++) {
      var e = flashEnemies[i];
      var k = e && e.__sxKick;
      if (!k) continue;
      k.t -= dt;
      var b = k.bone;
      if (k.t <= 0) {
        if (b) { b.position.x = k.bx; b.position.y = k.by; b.position.z = k.bz; }
        e.__sxKick = null;
        continue;
      }
      if (b) {
        var f = k.t / 0.16;
        b.position.x = k.bx + k.x * f;
        b.position.z = k.bz + k.z * f;
      }
    }
  }

  function onEnemyKilled(ev) {
    untrackFlash(ev && ev.enemy);
    var pos = ev && (ev.pos || (ev.enemy && ev.enemy.pos));
    if (!pos) return;
    var col = 0x9aa0a4;
    safe(function () { spawnDebris(pos, null, ev && ev.enemy && ev.enemy.boss ? 14 : 8, col, 1.1, 0.11); });
    safe(function () { spawnRing(pos, 0xffb36a, 1.0); });
  }

  function onShieldBreak(ev) {
    var e = ev && ev.enemy;
    var pos = e && e.pos ? e.pos : (ev && ev.pos);
    if (!pos) return;
    safe(function () {
      spawnDebris(pos, null, 12, 0x9fe6ff, 1.8, 0.085);
      spawnRing(pos, 0x9fe6ff, 1.4);
      G.render.lightPool.flash(pos, 0x9fe6ff, 30, 8, 0.12);
    });
    fp.shake = Math.max(fp.shake, 0.25);
  }

  /* =====================================================================
     6. WP35-6 · 霜雾 / 水滴 / 浪花 / 货舱雾
     ===================================================================== */
  var fx = { root: null, systems: {}, active: [], t: 0, sprite: null, blink: [] };

  function makeSprite() {
    var c = document.createElement("canvas");
    c.width = c.height = 32;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.35, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    var t = new T.CanvasTexture(c);
    if (T.SRGBColorSpace !== undefined) t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function makeParticles(name, count, color, size, opacity, additive) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var vel = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      vel[i * 3] = (Math.random() - 0.5) * 0.2;
      vel[i * 3 + 1] = -0.15 - Math.random() * 0.35;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({
      color: color, size: size, map: fx.sprite, transparent: true, opacity: opacity,
      depthWrite: false, sizeAttenuation: true,
      blending: additive ? T.AdditiveBlending : T.NormalBlending
    });
    var points = new T.Points(geo, m);
    points.name = "sx-fx-" + name;
    points.frustumCulled = false;
    points.visible = false;
    points.userData.vel = vel;
    points.userData.kind = name;
    fx.root.add(points);
    fx.systems[name] = points;
    return points;
  }

  function initFX() {
    fx.sprite = makeSprite();
    fx.root = new T.Group();
    fx.root.name = "sx-visual-fx";
    G.scene.add(fx.root);
    makeParticles("frost", 170, 0xd8efff, 0.045, 0.55, false);
    makeParticles("drip", 26, 0xbfe4ff, 0.035, 0.75, true);
    makeParticles("spray", 150, 0xcfe6ff, 0.085, 0.42, true);
    makeParticles("embers", 90, 0xff8a44, 0.05, 0.75, true);
    // 场景中标记过的闪烁灯 / 吊灯
    scanMapObjects();
  }

  function activateFX(id) {
    for (var k in fx.systems) fx.systems[k].visible = false;
    fx.active.length = 0;
    var hint = hintsFor(id);
    var f = hint && hint.fx;
    if (!f) return;
    if (f.frost) { fx.systems.frost.visible = true; fx.active.push(fx.systems.frost); }
    if (f.drip) { fx.systems.drip.visible = true; fx.active.push(fx.systems.drip); }
    if (f.spray) { fx.systems.spray.visible = true; fx.active.push(fx.systems.spray); }
    if (f.embers) { fx.systems.embers.visible = true; fx.active.push(fx.systems.embers); }
  }

  function updateFX(dt) {
    if (!S.enabled) return;
    fx.t += dt;
    var cp = G.camera.position;
    for (var a = 0; a < fx.active.length; a++) {
      var pts = fx.active[a];
      var arr = pts.geometry.attributes.position.array;
      var vel = pts.userData.vel;
      var kind = pts.userData.kind;
      var n = arr.length / 3;
      for (var i = 0; i < n; i++) {
        var ix = i * 3;
        arr[ix] += vel[ix] * dt;
        arr[ix + 1] += vel[ix + 1] * dt;
        arr[ix + 2] += vel[ix + 2] * dt;
        if (kind === "spray") {
          arr[ix + 1] += Math.sin(fx.t * 2 + i) * dt * 0.25;
          vel[ix + 1] += -0.4 * dt;
        }
        if (kind === "embers") {
          vel[ix + 1] += 0.12 * dt;
          arr[ix] += Math.sin(fx.t + i) * dt * 0.1;
        }
        var dx = arr[ix] - cp.x, dz = arr[ix + 2] - cp.z;
        var dy = arr[ix + 1] - cp.y;
        if (kind === "spray") {
          // 沿舷边生成
          if (arr[ix + 1] < 0.15 || Math.abs(dx) > 26 || Math.abs(dz) > 12) {
            var side = Math.random() < 0.5 ? -1 : 1;
            arr[ix] = cp.x + side * (22 + Math.random() * 5);
            arr[ix + 1] = 0.15 + Math.random() * 1.2;
            arr[ix + 2] = cp.z + (Math.random() - 0.5) * 20;
            vel[ix] = -side * (0.4 + Math.random() * 0.8);
            vel[ix + 1] = 0.6 + Math.random() * 1.4;
            vel[ix + 2] = (Math.random() - 0.5) * 0.6;
          }
        } else if (dy < -1.2 || Math.abs(dx) > 26 || Math.abs(dz) > 24) {
          arr[ix] = cp.x + (Math.random() - 0.5) * 34;
          arr[ix + 1] = cp.y + 1 + Math.random() * 6;
          arr[ix + 2] = cp.z + (Math.random() - 0.5) * 34;
          if (kind === "embers") { arr[ix + 1] = cp.y - 0.5 + Math.random() * 2; vel[ix + 1] = 0.3 + Math.random() * 0.8; }
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }
    // 闪灯
    for (var b = 0; b < fx.blink.length; b++) {
      var it = fx.blink[b];
      if (!it.light) continue;
      var s = Math.sin(fx.t * it.speed + it.phase);
      it.light.intensity = it.min + (it.max - it.min) * (0.5 + 0.5 * s);
    }
    // 场景标记的吊灯摇摆
    for (var c = 0; c < fx.swings.length; c++) {
      var sw = fx.swings[c];
      if (!sw.obj) continue;
      sw.obj.rotation.z = Math.sin(fx.t * sw.speed + sw.phase) * sw.amp;
      sw.obj.rotation.x = Math.cos(fx.t * sw.speed * 0.77 + sw.phase) * sw.amp * 0.6;
    }
  }

  function scanMapObjects() {
    fx.blink.length = 0;
    fx.swings = [];
    G.scene.traverse(function (o) {
      if (o.isLight && o.userData && o.userData.sxBlink) {
        var b = o.userData.sxBlink;
        fx.blink.push({ light: o, speed: b.speed || 2.2, min: b.min == null ? 0.1 : b.min, max: b.max == null ? (o.intensity || 1) : b.max, phase: b.phase || 0 });
      }
      if (o.userData && o.userData.sxSwing) {
        var s = o.userData.sxSwing;
        fx.swings.push({ obj: o, speed: s.speed || 1.1, amp: s.amp || 0.05, phase: s.phase || 0 });
      }
    });
  }

  /* =====================================================================
     7. 质量 / 开关 / API / F3
     ===================================================================== */
  function configureQuality(name, initial) {
    var q = QP[name];
    if (!q) return;
    if (!initial && G.render && G.render.setQuality) {
      try { G.render.setQuality(Object.assign({}, q)); } catch (e) { fail("setQuality", e); }
    }
    qualityName = name;
    S.quality = name;
    configureShadowQuality(name);
    if (aa.mat) { aa.valid = 0; if (aa.mat.uniforms.uSxHistValid) aa.mat.uniforms.uSxHistValid.value = 0; }
    onResizeAA();
    if (pr.pmrem) pr.cubeSize = (name === "low" || name === "test") ? 64 : 128;
    // 低画质：增强锐化 + 关 TAA；中高：TAA
    try {
      if (G.render.tune) G.render.tune.sharpen = (name === "low" || name === "test") ? 0.36 : 0.22;
      if (aa.mat && aa.mat.uniforms.uFxaa) aa.mat.uniforms.uFxaa.value = 1;
    } catch (e) { soft("quality-tune", e); }
    if (sh.sun) sh.sun.shadow.needsUpdate = true;
    if (sh.far) sh.far.shadow.needsUpdate = true;
    sh.force = true; sh.farDirty = true;
    // 切到低画质/test 后残留的分帧探针当帧收尾
    try { flushProbes(); } catch (e) { fail("probe quality", e); }
  }

  function setQuality(v) {
    var name = typeof v === "string" ? v : (v && v.name);
    if (!name || !QP[name]) return { ok: false, reason: "unknown quality", quality: qualityName };
    configureQuality(name, false);
    try { G.events.emit("sx:visual-quality", { name: name }); } catch (e) { soft("emit-quality", e); }
    return { ok: true, quality: name, aa: S.aa, shadow: S.shadow };
  }

  function setEnabled(on) {
    S.enabled = !!on;
    disabled = !S.enabled;
    if (!booted) return S.enabled;
    if (sh.far) { sh.far.visible = S.enabled; sh.far.castShadow = S.enabled; sh.far.shadow.needsUpdate = true; }
    if (S.enabled) { sh.force = true; sh.farDirty = true; }
    if (fill) fill.visible = S.enabled && !disabled;
    if (fx.root) fx.root.visible = S.enabled;
    if (chunkMesh) chunkMesh.visible = S.enabled;
    if (!S.enabled) {
      abortProbeCapture(true);
      if (pr.baseEnv) G.scene.environment = pr.baseEnv;
      G.scene.environmentIntensity = pr.baseEnvIntensity;
    } else {
      pr.active = -1;
    }
    return S.enabled;
  }

  function probeInfo() {
    return {
      map: pr.map, count: pr.list.length, ready: pr.ready, failed: pr.failed,
      pending: pr.pending.length + (pr.cap ? 1 : 0), active: pr.active,
      activeName: pr.list[pr.active] ? pr.list[pr.active].name : null,
      updated: pr.updates, size: pr.cubeSize,
      items: pr.list.map(function (p) { return { name: p.name, pos: [p.pos.x, p.pos.y, p.pos.z], range: p.range, ready: !!p.env }; })
    };
  }

  function expose() {
    window.__SX_VISUAL = {
      version: "V35.1",
      get quality() { return qualityName; },
      stats: S,
      setQuality: setQuality,
      probes: probeInfo,
      setEnabled: setEnabled,
      get enabled() { return S.enabled; },
      get errors() { return errors.slice(); },
      refreshProbes: function () {
        if (!pr.hints) pr.hints = hintsFor(mapId());
        queueProbes(pr.hints);
        try { flushProbes(); } catch (e) { fail("probe refresh", e); }
        return probeInfo();
      },
      debug: {
        shadow: sh,
        probe: pr,
        aa: aa,
        fp: fp,
        fill: fill,
        flashList: function () { return flashEnemies.length; }
      }
    };
  }

  function initF3() {
    var el = document.createElement("div");
    el.id = "sx-visual-f3";
    el.style.cssText = "position:absolute;left:12px;top:12px;z-index:95;display:none;padding:8px 10px;background:rgba(4,7,10,.82);border-left:2px solid #ffb347;color:#d8f0d0;font:11px/1.5 'PingFang SC',ui-monospace,monospace;white-space:pre;pointer-events:none;text-shadow:0 1px 2px #000";
    document.getElementById("app").appendChild(el);
    window.addEventListener("keydown", function (e) {
      if (e.key === "F3" || e.code === "F3") {
        e.preventDefault();
        el.style.display = el.style.display === "none" ? "block" : "none";
        updateF3();
      }
    });
    fx.f3 = el;
  }

  function updateF3() {
    var el = fx.f3;
    if (!el || el.style.display === "none") return;
    var p = window.__SX && window.__SX.cameraState ? "" : "";
    el.textContent =
      "V35 VISUAL  q=" + qualityName + "  aa=" + S.aa + (S.enabled ? "" : "  [OFF]") + "\n" +
      "DC " + S.calls + "  TRI " + (S.tris / 1000).toFixed(0) + "k  frame " + S.frameMs.toFixed(1) + "ms  avg300 " + S.frameMs300.toFixed(1) + "ms\n" +
      "SHADOW x" + S.shadow.cascades + "  near " + S.shadow.near + "m/" + S.shadow.nearSize + "  far " + S.shadow.far + "m/" + S.shadow.farSize + " (1/" + S.shadow.farInterval + ")\n" +
      "PROBE " + S.probes.map + "  " + S.probes.ready + "/" + S.probes.count + "  active " + S.probes.active + "  pending " + S.probes.pending + "\n" +
      "FX hit " + S.effects.hitFlash + "  debris " + S.effects.debris + "  rings " + S.effects.rings + "  fill " + S.fill.intensity + "\n" +
      "FP sprint " + S.fp.sprint + "  reload " + S.fp.reload + "  land " + S.fp.land + "  roll " + S.fp.roll;
  }

  /* =====================================================================
     8. 事件 + 渲染包装 + 统计
     ===================================================================== */
  function installEvents() {
    G.events.on("enemy:hit", function (ev) { safe(function () { onEnemyHit(ev); }); });
    G.events.on("enemy:killed", function (ev) { safe(function () { onEnemyKilled(ev); }); });
    G.events.on("sx:shield-break", function (ev) { safe(function () { onShieldBreak(ev); }); });
    G.events.on("sx:warden-shield", function (ev) { if (ev && (ev.broken || ev.shield <= 0)) safe(function () { onShieldBreak(ev); }); });
    G.events.on("game:state", function (ev) {
      if (!ev) return;
      if (ev.state === "title" || ev.state === "intro") {
        if (chunkMesh) { for (var i = 0; i < chunks.length; i++) chunks[i].active = false; chunkMesh.count = 0; }
        for (var j = 0; j < ringPool.length; j++) { ringPool[j].life = 0; ringPool[j].mesh.visible = false; }
        untrackAllFlashes();
      }
    });
    G.events.on("quality:auto", function (ev) {
      if (ev && ev.name && QP[ev.name]) configureQuality(ev.name, true);
    });
    // 设置面板点击后立即刷新（不再让 updateFirstPerson 每帧读 localStorage）
    G.events.on("ui:click", function () { S.reduced = reduceMotion(); });
  }

  function onMap(id) {
    if (!id) return;
    S.map = id;
    pr.map = id;
    pr.hints = hintsFor(id);
    dropProbes();
    pr.lastCapture = 0;
    untrackAllFlashes();
    // MapKit 切图会调整太阳强度；用 hints 中的值作为级联基准
    if (id === "harbor") sh.sunBase = sh.harborSun || 1;
    else sh.sunBase = (pr.hints && pr.hints.sunIntensity) || 0.25;
    sh.force = true; sh.farDirty = true;
    if (pr.hints) queueProbes(pr.hints);
    // V39：低画质/test 在 map:loaded 事件内同步跑完整个探针（≤1 帧），
    // 不再依赖 2 面/帧的分帧预算 —— 无头低帧率下分帧会把就绪拖到数秒/超时。
    try { flushProbes(); } catch (e) { fail("probe sync", e); }
    activateFX(id);
    scanMapObjects();
    if (G.scene.environment && id === "harbor") G.scene.environment = pr.baseEnv;
    if (id !== "harbor" && pr.baseEnv) G.scene.environment = pr.baseEnv;
    if (chunkMesh) { for (var i = 0; i < chunks.length; i++) chunks[i].active = false; chunkMesh.count = 0; }
    S.probes.map = id;
    S.probes.count = 0; S.probes.ready = 0; S.probes.pending = pr.pending.length; S.probes.active = -1;
  }

  var lastFrameT = 0;
  var ringSum = 0; // PERF-4：300 帧滚动和，避免每帧对环形缓冲做 O(n) 求和
  // V54 ARCH-1：防重入标记挂在宿主对象（G.render）上，先写标记再包覆；
  // 别人之后再包一层也不会让标记失效。重复 init 直接返回，包覆顺序不变。
  function wrapRender() {
    if (!G.render || G.render.__sxVisualFrame) return;
    var base = G.render.frame;
    if (!base) return;
    G.render.__sxVisualFrame = true;
    var wrapped = function (dt) {
      var start = performance.now();
      frameNo++;
      if ((frameNo & 63) === 0) { S.reduced = reduceMotion(); onResizeAA(); }
      // copy 到预分配对象，避免每帧 clone 产生垃圾
      camBasePos.copy(G.camera.position);
      camBaseQuat.copy(G.camera.quaternion);
      try {
        updateShadows(dt);
        updateProbes(dt);
        updateFX(dt);
        updateDebris(dt);
        updateHitFlashes(dt);
        updateEnemyKicks(dt);
        updateRings(dt);
        updateFirstPerson(dt);
        applyAA(dt);
        if (frameNo === 2) activateFX(mapId());
      } catch (e) { fail("pre", e); }
      try {
        return base.call(G.render, dt);
      } finally {
        try { afterAA(); } catch (e) { fail("aa-after", e); }
        try { restoreCamera(); } catch (e) { soft("restore-camera", e); }
        try { restoreJitter(); } catch (e) { soft("restore-jitter", e); }
        var now = performance.now();
        if (lastFrameT) {
          var ms = now - lastFrameT;
          if (S.frames > 3) {
            S.ring.push(ms);
            ringSum += ms;
            if (S.ring.length > 300) ringSum -= S.ring.shift();
            S.frameMs300 = ringSum / S.ring.length;
            S.frameMsAvg += (ms - S.frameMsAvg) * 0.08;
          }
        }
        lastFrameT = now;
        S.frames++;
        S.frameMs = now - start;
        S.calls = G.renderer.info.render.calls;
        S.tris = G.renderer.info.render.triangles;
        if ((frameNo & 7) === 0) updateF3();
      }
    };
    G.render.frame = wrapped;
  }

  wait();
})();
