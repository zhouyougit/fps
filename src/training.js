
  /* =====================================================================
     V7 训练场：90 秒靶场挑战、无限弹药、三武器自由试用
     ===================================================================== */
  var TRAINING = {
    id: "train",
    code: "TR",
    name: "训练场",
    sub: "靶场 · 限时挑战",
    desc: "90 秒内击中尽可能多的悬浮靶机。无限弹药，三把武器自由试用。",
    duration: 90,
    start: { x: 23, z: 12, pitch: 0.12 },
    targets: 6,
    spawnPoints: [
      [22, 3.2, 6], [26, 3.6, 2], [19, 4.0, 1], [29, 4.4, 8],
      [15, 3.4, 4], [23, 5.0, -3], [27, 5.4, 14], [12, 4.2, 10],
      [31, 3.8, 15], [20, 6.0, 18]
    ]
  };

  var trainUI = null;
  var trainHud = null;
  var trainResult = null;

  function buildTrainingUI() {
    var hud = el("div", "x-train-hud",
      '<div class="k">训练 · 靶场</div>' +
      '<div class="row"><b class="t">90.0</b><span>剩余</span><i class="s">0</i><span>得分</span></div>');
    G.hud.root.appendChild(hud);
    trainHud = {
      el: hud,
      time: hud.querySelector(".t"),
      score: hud.querySelector(".s"),
      lastT: -1,
      lastS: -1
    };

    var res = el("div", "x-train-result");
    res.innerHTML =
      '<div class="x-tr-veil"></div>' +
      '<div class="x-tr-panel">' +
        '<div class="m-k">训练结束 · 靶场成绩</div>' +
        '<h2>射击评估</h2>' +
        '<div class="x-tr-score"><b>0</b><span>得分</span></div>' +
        '<dl class="x-tr-stats">' +
          '<div><dt>命中率</dt><dd data-f="acc">—</dd></div>' +
          '<div><dt>击中靶机</dt><dd data-f="kills">0</dd></div>' +
          '<div><dt>爆头</dt><dd data-f="head">0</dd></div>' +
          '<div><dt>最佳成绩</dt><dd data-f="best">0</dd></div>' +
        '</dl>' +
        '<div class="x-tr-actions">' +
          '<button class="btn primary" data-x="again">再来一次</button>' +
          '<button class="btn" data-x="back">返回标题</button>' +
        '</div>' +
      '</div>';
    document.getElementById("ui").appendChild(res);
    trainResult = {
      el: res,
      score: res.querySelector(".x-tr-score b"),
      acc: res.querySelector('[data-f="acc"]'),
      kills: res.querySelector('[data-f="kills"]'),
      head: res.querySelector('[data-f="head"]'),
      best: res.querySelector('[data-f="best"]')
    };
    res.querySelector('[data-x="again"]').addEventListener("click", function (e) {
      e.preventDefault();
      hideTrainingResult();
      launchTraining();
    });
    res.querySelector('[data-x="back"]').addEventListener("click", function (e) {
      e.preventDefault();
      hideTrainingResult();
      returnToTitleFromTraining();
    });
  }

  function hideTrainingResult() {
    if (trainResult) trainResult.el.classList.remove("on");
  }

  function ensureTargetRing(e) {
    if (e.__trainRing) return e.__trainRing;
    var T = G.THREE;
    var g = new T.Group();
    var mat = new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide });
    var ring = new T.Mesh(new T.TorusGeometry(0.72, 0.028, 6, 28), mat);
    var ring2 = new T.Mesh(new T.TorusGeometry(0.5, 0.016, 6, 24), mat.clone());
    ring2.material.opacity = 0.5;
    var dot = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), new T.MeshBasicMaterial({ color: 0xff5a40 }));
    g.add(ring, ring2, dot);
    e.rig.group.add(g);
    e.__trainRing = g;
    return g;
  }

  function spawnTrainingTarget() {
    var T = G.THREE;
    var pts = TRAINING.spawnPoints;
    var p = pts[(Math.random() * pts.length) | 0];
    var pos = new T.Vector3(p[0], p[1], p[2]);
    var e = null;
    try {
      e = G.enemies.spawn("gull", pos, { passive: true, hover: true, patrolRadius: 1.2 });
    } catch (err) {}
    if (!e) return null;
    e.trainTarget = true;
    e.variant = "target";
    e.trainPhase = Math.random() * 6.283;
    if (e.lens && e.lens.color) e.lens.color.setRGB(0.3, 1.5, 1.9);
    var ring = ensureTargetRing(e);
    ring.visible = true;
    e.hp = 1;
    e.maxHp = 1;
    e.alt = p[1];
    e.home.set(p[0], p[1], p[2]);
    return e;
  }

  function countTrainingTargets() {
    var n = 0, list = G.enemies.list;
    for (var i = 0; i < list.length; i++) if (list[i].alive && list[i].trainTarget) n++;
    return n;
  }

  function launchTraining() {
    try { if (typeof MapKit !== "undefined" && MapKit.current() !== "harbor") MapKit.load("harbor"); } catch (e) {}
    if (!G || !G.game) return;
    closeMissionScreen();
    camp.trainSel = true;
    // 关卡配置：无中继、无波次、撤离点移出地图
    setRelays([]);
    G.level.objectives = [];
    try {
      G.level.extraction.pos.set(0, 0, -400);
      G.level.extraction.radius = 0.1;
    } catch (e) {}
    G.game.flow.waves = [];
    G.game.flow.patrol = { gull: 0, hound: 0 };
    G.game.flow.maxAlive = 0;
    G.game.currentMission = {
      id: "train", code: "TR", name: "训练场", goal: "训练 · 击中靶机", extractText: "训练结束",
      evac: 0, waves: [], patrol: { gull: 0, hound: 0 }, maxAlive: 0
    };
    S.missionDamage = 1;
    S.missionHp = 1;
    if (typeof recomputeScales === "function") recomputeScales();
    try {
      applyEnvironment({ sun: [0.92, 0.23, 0.33], zen: [0.055, 0.085, 0.13], hor: [0.95, 0.55, 0.28], away: [0.16, 0.22, 0.3], col: [1, 0.72, 0.42], light: 0xffddad, intensity: 8, exposure: 1.02, envIntensity: 2, rain: 0.35 });
    } catch (e) {}
    G.player.invulnerable = true;
    G.input.exitLock && G.input.exitLock();
    G.game.start({ skipIntro: true });
    try {
      G.player.reset({ pos: new G.THREE.Vector3(TRAINING.start.x, 0, TRAINING.start.z), yaw: 0 });
      G.player.pitch = TRAINING.start.pitch || 0;
      G.player.invulnerable = true;
    } catch (e) {}
    G.hud.show(true);
    G.hud.setObjective("训练 · 击中靶机");
    var relays = document.querySelector(".h-relays");
    if (relays) relays.style.display = "none";
    if (trainHud) {
      trainHud.el.classList.add("on");
      trainHud.lastT = -1;
      trainHud.lastS = -1;
    }
    S.training = {
      active: true, t: TRAINING.duration, score: 0, kills: 0, head: 0,
      spawnT: 0, refillT: 0, startShots: (G.combat && G.combat.stats.shots) || 0
    };
    try { G.events.emit("sx:training-start", {}); } catch (e) {}
    for (var i = 0; i < TRAINING.targets; i++) spawnTrainingTarget();
    G.hud.message("训练开始 · 90 秒内击中悬浮靶机", 3);
    try { G.input.requestLock && G.input.requestLock(); } catch (e) {}
  }

  function updateTraining(dt) {
    var tr = S.training;
    if (!tr || !tr.active) return;
    if (G.game.state !== "playing") return;
    tr.t = Math.max(0, tr.t - dt);
    var w = G.weapon;
    if (w && w.list) {
      for (var wi = 0; wi < w.list.length; wi++) {
        if (w.list[wi].reserve < 200) w.list[wi].reserve = 300;
      }
    }
    if (S.grenades < 4) S.grenades = 4;
    tr.spawnT -= dt;
    if (tr.spawnT <= 0 && countTrainingTargets() < TRAINING.targets) {
      tr.spawnT = 0.7;
      spawnTrainingTarget();
    }
    var tlist = G.enemies.list;
    for (var ti = 0; ti < tlist.length; ti++) {
      var te = tlist[ti];
      if (te.alive && te.trainTarget && te.__trainRing) {
        te.__trainRing.rotation.z += dt * 0.9;
        var pulse = 1 + Math.sin(G.time.t * 3 + (te.trainPhase || 0)) * 0.05;
        te.__trainRing.scale.setScalar(pulse);
      }
    }
    if (trainHud) {
      var tSec = Math.ceil(tr.t * 10) / 10;
      if (tSec !== trainHud.lastT) {
        trainHud.lastT = tSec;
        trainHud.time.textContent = tr.t.toFixed(1);
      }
      if (tr.score !== trainHud.lastS) {
        trainHud.lastS = tr.score;
        trainHud.score.textContent = tr.score;
      }
    }
    if (tr.t <= 0) finishTraining();
  }

  function finishTraining() {
    try { G.events.emit("sx:training-end", {}); } catch (e) {}
    var tr = S.training;
    if (!tr || !tr.active) return;
    tr.active = false;
    G.input.setGameplay && G.input.setGameplay(false);
    try { G.input.exitLock && G.input.exitLock(); } catch (e) {}
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    G.player.invulnerable = false;
    if (trainHud) trainHud.el.classList.remove("on");
    var relays = document.querySelector(".h-relays");
    if (relays) relays.style.display = "";
    var stats = (G.combat && G.combat.stats) || { shots: 0, hits: 0, kills: 0 };
    var shots = Math.max(0, stats.shots - tr.startShots);
    var acc = shots > 0 ? Math.round((stats.hits / shots) * 100) + "%" : "—";
    var best = (camp.best && camp.best.train && camp.best.train.score) || 0;
    if (tr.score > best) {
      best = tr.score;
      if (!camp.best) camp.best = {};
      camp.best.train = { score: tr.score, kills: tr.kills, head: tr.head, acc: acc };
      saveCamp();
    }
    if (trainResult) {
      trainResult.score.textContent = String(tr.score);
      trainResult.acc.textContent = acc;
      trainResult.kills.textContent = String(tr.kills);
      trainResult.head.textContent = String(tr.head);
      trainResult.best.textContent = String(best);
      trainResult.el.classList.add("on");
    }
    G.game.state = "paused";
    G.hud.show(false);
    G.render.post.fade = 0.25;
    try { G.audio.play("ui:click", { gain: 0.8 }); } catch (e) {}
  }

  function returnToTitleFromTraining() {
    hideTrainingResult();
    S.training = null;
    if (trainHud) trainHud.el.classList.remove("on");
    var relays = document.querySelector(".h-relays");
    if (relays) relays.style.display = "";
    G.player.invulnerable = false;
    G.player.enabled = false;
    try { applyMission(camp.current); } catch (e) {}
    G.hud.show(false);
    G.input.setGameplay && G.input.setGameplay(false);
    G.game.state = "title";
    G.game.menus.show("title");
    G.render.post.fade = 1;
    G.events.emit("game:state", { state: "title", prev: "paused" });
    camp.trainSel = false;
  }

  function initTraining() {
    buildTrainingUI();
    G.events.on("enemy:spawn", function (ev) {
      var e = ev && ev.enemy;
      if (e && e.__trainRing && !e.trainTarget) e.__trainRing.visible = false;
    });
    G.events.on("enemy:killed", function (ev) {
      var tr = S.training;
      if (!tr || !tr.active) return;
      var e = ev && ev.enemy;
      if (!e || !e.trainTarget || e._trainScored) return;
      e._trainScored = true;
      tr.kills++;
      tr.score += 100;
    });
    G.events.on("player:hitEnemy", function (ev) {
      var tr = S.training;
      if (!tr || !tr.active) return;
      if (!ev || !ev.killed) return;
      var e = ev.enemy;
      if (!e || !e.trainTarget || e._trainHead) return;
      if (ev.weak) {
        e._trainHead = true;
        tr.head++;
        tr.score += 50;
      }
    });
  }
