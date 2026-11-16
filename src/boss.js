
  /* ---- BOSS：港区主控 · 蜃 ---- */
  var bossRef = null;
  var bossBar = null;

  /* V54 · BOSS 文案：词典缺键（旧构建）时回退中文。 */
  function bossT(key, zh, vars) {
    try {
      var I = typeof window !== "undefined" ? window.SXI18n : null;
      if (I && typeof I.t === "function" && typeof I.has === "function" && I.has(key)) return I.t(key, vars);
    } catch (e) { /* 取词失败回退中文 */ }
    var s = zh == null ? key : String(zh);
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, name) { return vars[name] == null ? "" : String(vars[name]); });
    return s;
  }


  function buildBossBar() {
    var bar = el("div", "x-boss",
      '<div class="x-boss-k">' + bossT("boss.core.kicker", "港区主控 · 蜃") + '</div>' +
      '<div class="x-boss-track"><i></i></div>' +
      '<div class="x-boss-pips"><em class="on"></em><em class="on"></em><em class="on"></em></div>');
    G.hud.root.appendChild(bar);
    bossBar = {
      el: bar,
      title: bar.querySelector(".x-boss-k"),
      fill: bar.querySelector(".x-boss-track i"),
      pips: [].slice.call(bar.querySelectorAll(".x-boss-pips em")),
      lastPct: -1,
      lastPhase: -1
    };
  }

  function findBossSpot() {
    // V32：BOSS 点位来自地图玩法数据；每张图都有自己的候选点
    var cand = [];
    try {
      var id = typeof MapKit !== "undefined" ? MapKit.current() : "harbor";
      var data = window.__SX_MAPS_DATA;
      var m = data && data.maps && data.maps[id];
      if (m && m.spawns && m.spawns.boss) {
        for (var k = 0; k < m.spawns.boss.length; k++) {
          var bp = m.spawns.boss[k];
          cand.push([bp.pos[0], bp.pos[2], bp.pos[1]]);
        }
      }
    } catch (e) {}
    if (!cand.length) cand = [[6, 20], [10, 16], [14, 22], [21, 22], [24, 12], [-2, 16]];
    for (var i = 0; i < cand.length; i++) {
      var x = cand[i][0], z = cand[i][1], y0 = cand[i][2], ok = false;
      try { ok = G.physics.nav.isWalkable(x, z); } catch (e) { ok = false; }
      if (ok) {
        var y = 0;
        try { y = G.physics.groundHeight(x, z, 12); } catch (e) {}
        if (y0 != null && Math.abs(y - y0) > 0.8) y = y0;
        return new G.THREE.Vector3(x, y, z);
      }
    }
    return new G.THREE.Vector3(6, 0, 20);
  }

  function startBossEncounter() {
    if (bossRef) return;
    var m = MISSIONS[camp.current];
    if (!m || !m.boss) return;
    var pos = findBossSpot();
    var e = null;
    try { e = G.enemies.spawn("boss", pos, { state: "alert", target: G.player.pos }); } catch (err) {}
    if (!e) {
      console.warn("[boss] spawn failed");
      G.hud.warn(bossT("boss.signalLost", "主控核心信号丢失"), 3);
      return;
    }
    bossRef = e;
    if (m.bossHp) { e.hp = m.bossHp; e.maxHp = m.bossHp; }
    if (m.bossName && bossBar && bossBar.title) bossBar.title.textContent = m.bossName;
    else if (bossBar && bossBar.title) bossBar.title.textContent = bossT("boss.core.kicker", "港区主控 · 蜃");
    if (m.bossName) e.variant = m.bossName;
    G.game.run.bossAlive = true;
    G.game.run.evacT = 0;
    try { if (typeof setSpeaker === "function") setSpeaker(bossT("boss.core.speaker", "港区主控")); } catch (e) { /* 说话人可选 */ }
    G.hud.warn(bossT("boss.started", "{name}  已启动", { name: m.bossName || bossT("boss.core.kicker", "港区主控 · 蜃") }), 4);
    G.hud.radio(m.bossName
      ? bossT("boss.radio.final", "终形展开。它把整个港区的防线接进了自己身体——打掉核心！")
      : bossT("boss.radio.start", "检测到大型机械单位！那是港区主控，打掉它的核心！"), 5);
    G.hud.setObjective(bossT("boss.objective.core", "摧毁港区主控核心"));
    G.hud.setMarkers([
      { id: "boss", short: bossT("boss.core.markerShort", "主控"), label: bossT("boss.core.markerLabel", "港区主控"), pos: pos.clone(), kind: "relay" }
    ]);
    if (bossBar) { bossBar.el.classList.add("on"); bossBar.lastPct = -1; }
    var rel = document.querySelector(".h-relays");
    if (rel) rel.style.display = "none";
    try { G.audio.play("alert", { gain: 1, pitch: 0.6 }); } catch (err) {}
    try { AudioExt.setBoss(true); } catch (err) {}
    G.events.emit("sx:boss-start", { enemy: e });
  }

  function endBossEncounter() {
    if (!bossRef) return;
    var m = MISSIONS[camp.current] || {};
    G.game.run.bossAlive = false;
    var p = bossRef.pos.clone();
    bossRef = null;
    if (bossBar) bossBar.el.classList.remove("on");
    var rel = document.querySelector(".h-relays");
    if (rel) rel.style.display = "";
    try { G.fx.explosion(p, 2.4); } catch (e) {}
    try { G.combat.explode(p, 6, 40, "enemy"); } catch (e) {}
    var evac = m.bossEvac || 25;
    G.hud.warn(bossT("boss.destroyed", "主控核心已摧毁 · 登船窗口 {n} 秒", { n: evac }), 4);
    try { G.game.run.evacT = evac; } catch (e) {}
    G.hud.radio(m.bossName
      ? bossT("boss.radio.deadFinal", "蜃·终形瓦解！最后 {n} 秒，撤离！", { n: evac })
      : bossT("boss.radio.deadCore", "主控核心下线！接驳艇 {n} 秒，撤离！", { n: evac }), 5);
    G.hud.setObjective(bossT("boss.objective.window", "登船窗口 · {n} 秒", { n: evac }));
    try { if (typeof setSpeaker === "function") setSpeaker(bossT("radio.command", "指挥中心")); } catch (e) { /* 说话人可选 */ }
    try { AudioExt.setBoss(false); } catch (e) {}
    G.events.emit("sx:boss-dead", { pos: p });
  }

  function updateBoss(dt) {
    if (!bossRef) return;
    if (!bossRef.alive) { endBossEncounter(); return; }
    if (!bossBar) return;
    var pct = Math.max(0, Math.min(1, bossRef.hp / (bossRef.maxHp || 1600)));
    if (Math.abs(pct - bossBar.lastPct) > 0.0015) {
      bossBar.lastPct = pct;
      bossBar.fill.style.transform = "scaleX(" + pct.toFixed(4) + ")";
    }
    var phase = bossRef.bossPhase || 0;
    if (phase !== bossBar.lastPhase) {
      bossBar.lastPhase = phase;
      for (var i = 0; i < bossBar.pips.length; i++)
        bossBar.pips[i].classList.toggle("on", i >= phase);
      if (phase > 0) {
        G.hud.warn(phase === 1
          ? bossT("boss.phase1.warn", "主控装甲剥落 · 释放无人机")
          : bossT("boss.phase2.warn", "主控过载 · 全力攻击"), 3);
        G.player.addShake(0.35);
      }
    }
  }

  function initBoss() {
    buildBossBar();
    G.events.on("objective:all", function () {
      var m = MISSIONS[camp.current];
      if (m && m.boss) gameAfter(1.2, startBossEncounter, "mission");
    });
    G.events.on("enemy:killed", function (e) {
      if (bossRef && e && e.enemy === bossRef) gameAfter(0.9, endBossEncounter, "mission");
    });
    G.events.on("game:state", function (e) {
      if (!e) return;
      if (e.state === "intro") {
        if (bossBar) { bossBar.el.classList.remove("on"); bossBar.lastPct = -1; bossBar.lastPhase = -1; }
        bossRef = null;
      }
    });
  }
