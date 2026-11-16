
  /* =====================================================================
     V6 战术层：Q 战术扫描 / 手雷弹道预览 / 连杀播报
     ===================================================================== */
  function clearScanMarks() {
    for (var i = 0; i < S.scanMarks.length; i++) {
      if (S.scanMarks[i].el && S.scanMarks[i].el.parentNode) S.scanMarks[i].el.remove();
    }
    S.scanMarks.length = 0;
  }

  function addScanMark(e) {
    for (var i = 0; i < S.scanMarks.length; i++) {
      if (S.scanMarks[i].enemy === e) { S.scanMarks[i].until = G.time.t + 7; return; }
    }
    var mark = { enemy: e, until: G.time.t + 7, el: el("div", "x-sm", "<i></i><b></b>") };
    mark.dist = mark.el.querySelector("b");
    HUD.marksEl.appendChild(mark.el);
    S.scanMarks.push(mark);
  }

  function triggerScan() {
    if (S.scanCd > 0 || !G.player.alive) return false;
    S.scanCd = 14;
    var n = 0, list = G.enemies.list;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.alive || !e.pos) continue;
      if (e.pos.distanceTo(G.player.pos) > 48) continue;
      addScanMark(e); n++;
    }
    if (HUD.pulseEl) {
      HUD.pulseEl.classList.remove("on");
      void HUD.pulseEl.offsetWidth;
      HUD.pulseEl.classList.add("on");
    }
    G.hud.message(n ? "战术扫描 · 标记 " + n + " 个目标" : "战术扫描 · 未发现目标", 2.2);
    try { G.audio.play("telegraph", { gain: 0.22, pitch: 2.1 }); } catch (e) {}
    G.events.emit("sx:scan", { count: n });
    return true;
  }

  function updateScan(dt) {
    if (S.scanCd > 0) {
      S.scanCd = Math.max(0, S.scanCd - dt);
      if (HUD.scanCdEl) HUD.scanCdEl.textContent = S.scanCd > 0.05 ? Math.ceil(S.scanCd) : "";
      if (HUD.scanEl) HUD.scanEl.classList.toggle("cd", S.scanCd > 0.05);
    }
    var now = G.time.t, cam = G.camera, w = innerWidth, h = innerHeight;
    if (!S.scanTmp) S.scanTmp = new G.THREE.Vector3();
    for (var i = S.scanMarks.length - 1; i >= 0; i--) {
      var m = S.scanMarks[i], e = m.enemy;
      if (!e || !e.alive || now > m.until) {
        if (m.el && m.el.parentNode) m.el.remove();
        S.scanMarks.splice(i, 1);
        continue;
      }
      var v = S.scanTmp.copy(e.pos);
      v.y += (e.type === "hound" ? 1.25 : 0.55);
      var d = v.distanceTo(G.player.pos);
      v.project(cam);
      var x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      if (v.z > 1 || v.z < -1 || x < -30 || x > w + 30 || y < -30 || y > h + 30) {
        m.el.style.display = "none";
      } else {
        m.el.style.display = "block";
        m.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
        var ds = Math.round(d) + "米";
        if (m.lastD !== ds) { m.lastD = ds; m.dist.textContent = ds; }
        m.el.classList.toggle("near", d < 12);
        m.el.style.opacity = String(Math.min(0.95, 0.4 + (1 - Math.min(1, d / 48)) * 0.55));
      }
    }
  }

  /* ---- 手雷弹道预览 ---- */
  function grenadeVelocity() {
    var T = G.THREE, P = G.player;
    var fwd = new T.Vector3(P.forward.x, P.forward.y, P.forward.z).normalize();
    var origin = new T.Vector3(P.eye.x, P.eye.y, P.eye.z).addScaledVector(fwd, 0.8);
    var vel = fwd.clone().multiplyScalar(15.5);
    vel.y += 4.2;
    vel.x += P.vel.x * 0.5;
    vel.z += P.vel.z * 0.5;
    return { origin: origin, vel: vel, dir: fwd };
  }

  function arcDotTexture() {
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
    });
    var pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 8;
    pts.visible = false;
    G.scene.add(pts);
    var ring = new T.Mesh(
      new T.RingGeometry(0.24, 0.34, 26),
      new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    G.scene.add(ring);
    S.arc = { pts: pts, geo: geo, ring: ring, N: N };
    return S.arc;
  }

  function beginGrenadeAim() {
    if (S.grenades <= 0 || S.throwCd > 0 || !G.player.alive) return false;
    S.grenadeAim = true;
    ensureArc();
    updateGrenadeAim();
    return true;
  }

  function updateGrenadeAim() {
    if (!S.grenadeAim) return;
    var arc = ensureArc(), T = G.THREE;
    var g = grenadeVelocity();
    var pos = g.origin.clone(), vel = g.vel.clone();
    var arr = arc.geo.attributes.position.array;
    var dt = 0.055, hit = null;
    for (var i = 0; i < arc.N; i++) {
      arr[i * 3] = pos.x;
      arr[i * 3 + 1] = pos.y;
      arr[i * 3 + 2] = pos.z;
      var step = vel.clone().multiplyScalar(dt);
      var len = step.length();
      var h = null;
      if (len > 1e-5) {
        try { h = G.physics.raycast(pos, step.clone().multiplyScalar(1 / len), len + 0.05); } catch (e) {}
      }
      if (h) {
        pos.copy(h.point);
        for (var k = i; k < arc.N; k++) {
          arr[k * 3] = pos.x;
          arr[k * 3 + 1] = pos.y;
          arr[k * 3 + 2] = pos.z;
        }
        hit = h;
        break;
      }
      pos.add(step);
      vel.y -= 21 * dt;
    }
    arc.geo.attributes.position.needsUpdate = true;
    arc.pts.visible = true;
    if (hit) {
      arc.ring.position.set(hit.point.x, hit.point.y + 0.03, hit.point.z);
      arc.ring.visible = true;
    } else {
      arc.ring.visible = false;
    }
  }

  function cancelGrenadeAim() {
    S.grenadeAim = false;
    if (S.arc) {
      S.arc.pts.visible = false;
      S.arc.ring.visible = false;
    }
  }

  function releaseGrenade() {
    if (!S.grenadeAim) return;
    S.grenadeAim = false;
    if (S.arc) {
      S.arc.pts.visible = false;
      S.arc.ring.visible = false;
    }
    if (S.grenades <= 0 || S.throwCd > 0) return;
    throwGrenade();
  }

  /* ---- 连杀与首次战斗提示 ---- */
  function initCombatFeedback() {
    S.killTimes = [];
    S.lastStreak = 0;
    G.events.on("enemy:killed", function () {
      var now = performance.now() / 1000;
      S.killTimes.push(now);
      S.killTimes = S.killTimes.filter(function (t) { return now - t < 4; });
      var n = S.killTimes.length;
      if (n >= 2 && n !== S.lastStreak) {
        S.lastStreak = n;
        var names = { 2: "双杀", 3: "三杀", 4: "四杀", 5: "五杀" };
        G.hud.warn(names[Math.min(5, n)] || "极限连杀", 1.5);
      }
    });
    G.events.on("enemy:alert", function () {
      if (S.alertTipShown) return;
      S.alertTipShown = true;
      setTimeout(function () {
        if (G.game.state === "playing") G.hud.message("Q 战术扫描 · 按住 G 预览手雷弹道 · 右键瞄准", 4.5);
      }, 500);
    });
  }

  function updateCombatFeedback() {
    if (!S.killTimes || !S.killTimes.length) return;
    var now = performance.now() / 1000;
    if (now - S.killTimes[S.killTimes.length - 1] > 4) {
      S.killTimes.length = 0;
      S.lastStreak = 0;
    }
  }
