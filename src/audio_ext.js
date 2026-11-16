
  /* =====================================================================
     V26 · 动态音乐与环境声（V35 · WP35-8 起交给 ext_music2.js 接管）
     ---------------------------------------------------------------------
     对外仍暴露 AudioExt：init / begin / update / setMode / setBoss / state。
     若 window.__SX_MUSIC 存在（V35 构建），所有音乐/环境/强度请求转发给
     分层音乐引擎；否则回退到 V26 的简单循环实现，单独跑旧构建时仍有声。
     ===================================================================== */
  var AudioExt = (function () {
    var G, started = false, mode = "title", combatT = 0, bossT = 0, bossOn = false;
    var loops = {};
    var mapT = 0, currentMap = "";
    var legacy = false, legacyTimer = 0;

    function music() { return window.__SX_MUSIC || null; }

    /* ------------------------------------------------------ V26 回退实现 */
    function ensure(name, opts) {
      if (loops[name]) return loops[name];
      try { loops[name] = G.audio.loop(name, opts || { gain: 0 }); } catch (e) { loops[name] = null; }
      return loops[name];
    }
    function set(name, gain, pitch) {
      var h = ensure(name, { gain: 0 });
      if (!h) return;
      try { h.setGain(gain); } catch (e) {}
      if (pitch != null) { try { h.setPitch(pitch); } catch (e) {} }
    }
    function legacyBegin() {
      if (legacy) return;
      legacy = true;
      try { G.audio.resume(); } catch (e) {}
      ensure("sea", { gain: 0 });
      ensure("wind", { gain: 0 });
      ensure("relay_hum", { gain: 0 });
      ensure("music_drone", { gain: 0 });
      ensure("music_ost", { gain: 0 });
      ensure("music_perc", { gain: 0 });
      ensure("music_brass", { gain: 0 });
      legacyApply();
    }
    function legacyApply() {
      if (!legacy) return;
      var mp = false;
      try { mp = !!(window.__MP && window.__MP.state().active); } catch (e) {}
      if (bossOn && !mp) mode = "boss";
      var m = mp ? "mp" : mode;
      if (m === "title") {
        set("music_drone", 0.09); set("music_ost", 0.025); set("music_perc", 0); set("music_brass", 0);
      } else if (m === "boss") {
        set("music_drone", 0.10); set("music_ost", 0.04); set("music_perc", 0.22); set("music_brass", 0.14);
      } else if (m === "combat") {
        set("music_drone", 0.08); set("music_ost", 0.09); set("music_perc", 0.16); set("music_brass", 0);
      } else if (m === "mp") {
        set("music_drone", 0.04); set("music_ost", 0.07); set("music_perc", 0.12); set("music_brass", 0);
      } else {
        set("music_drone", 0.07); set("music_ost", 0.045); set("music_perc", 0); set("music_brass", 0);
      }
      legacyAmbience();
    }
    function legacyAmbience() {
      var id = "harbor";
      try { id = typeof MapKit !== "undefined" ? MapKit.current() : "harbor"; } catch (e) {}
      currentMap = id;
      var sea = id === "harbor" || id === "ship" ? 0.12 : 0;
      var wind = id === "ship" ? 0.07 : 0;
      var hum = id === "depot" ? 0.045 : id === "core" ? 0.06 : 0;
      set("sea", sea); set("wind", wind); set("relay_hum", hum, id === "core" ? 0.7 : 1);
    }

    /* ------------------------------------------------------ 对外接口 */
    function begin() {
      if (started) return;
      started = true;
      var M = music();
      if (M) { try { M.begin(); } catch (e) {} return; }
      /* features 脚本比 ext 晚一点加载：给 __SX_MUSIC 一点时间，避免双份音乐 */
      clearTimeout(legacyTimer);
      legacyTimer = setTimeout(function () {
        var M2 = music();
        if (M2) { try { M2.begin(); } catch (e) {} return; }
        legacyBegin();
      }, 1500);
    }
    function setMode(m) {
      mode = m;
      if (mode !== "boss" && bossOn) bossOn = false;
      var M = music();
      if (M) {
        var map = { title: "title", ambient: "ambient", combat: "combat", boss: "boss", mp: "mp", ending: "ending" };
        try { M.request(map[m] || "ambient", { reason: "audio_ext" }); } catch (e) {}
        return;
      }
      legacyApply();
    }
    function setBoss(on) {
      bossOn = !!on;
      var M = music();
      if (M) { try { M.setBoss(bossOn); } catch (e) {} return; }
      setMode(bossOn ? "boss" : combatT > 0 ? "combat" : "ambient");
    }
    function update(dt) {
      if (!started || legacy) {
        if (!legacy) return;
      } else {
        return;
      }
      var mpOn = false;
      try { mpOn = !!(window.__MP && window.__MP.state().active); } catch (e) {}
      if (mpOn && mode !== "mp") setMode("mp");
      else if (!mpOn && mode === "mp") setMode(bossOn ? "boss" : combatT > 0 ? "combat" : "ambient");
      if (combatT > 0) combatT -= dt;
      if (bossOn && mode !== "boss" && !mpOn) setMode("boss");
      else if (!bossOn && mode === "boss" && !mpOn) setMode(combatT > 0 ? "combat" : "ambient");
      if (combatT <= 0 && mode === "combat") setMode("ambient");
      mapT -= dt;
      if (mapT <= 0) {
        mapT = 0.5;
        var id = "harbor";
        try { id = typeof MapKit !== "undefined" ? MapKit.current() : "harbor"; } catch (e) {}
        if (id !== currentMap) legacyAmbience();
      }
    }
    function state() {
      var M = music();
      if (M) {
        var snap = null;
        try { snap = M.snapshot(); } catch (e) {}
        return {
          started: true, engine: "v35", mode: snap ? snap.state : mode, bpm: snap ? snap.bpm : 0,
          beat: snap ? snap.beat : 0, intensity: snap ? snap.intensity : 0,
          boss: snap ? snap.boss : bossOn, map: snap ? snap.map : currentMap,
          combatT: +combatT.toFixed(1), loops: []
        };
      }
      return {
        started: started, engine: "v26", mode: mode, boss: bossOn, map: currentMap,
        combatT: +combatT.toFixed(1),
        loops: Object.keys(loops).filter(function (k) { return !!loops[k]; })
      };
    }
    function init(g) {
      G = g;
      addEventListener("pointerdown", begin, { once: true });
      addEventListener("keydown", begin, { once: true });
      G.events.on("weapon:fire", function () { combatT = 8; if (!music() && mode !== "boss") setMode("combat"); });
      G.events.on("enemy:alert", function () { combatT = 10; if (!music() && mode !== "boss") setMode("combat"); });
      G.events.on("player:hit", function () { combatT = 8; if (!music() && mode !== "boss") setMode("combat"); });
      G.events.on("sx:boss-start", function () { bossOn = true; if (!music()) setMode("boss"); });
      G.events.on("sx:boss-phase", function () { bossOn = true; if (!music()) setMode("boss"); });
      G.events.on("sx:boss-dead", function () { bossOn = false; if (!music()) setMode(combatT > 0 ? "combat" : "ambient"); });
      G.events.on("game:state", function (e) {
        if (!e) return;
        if (e.state === "title" || e.state === "intro") { bossT = 0; combatT = 0; bossOn = false; if (!music()) setMode("title"); }
        else if (e.state === "playing") { if (!music() && !bossOn) setMode(combatT > 0 ? "combat" : "ambient"); }
      });
    }
    return {
      init: init, update: update, begin: begin, setMode: setMode, setBoss: setBoss, state: state
    };
  })();
