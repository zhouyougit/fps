
  /* =====================================================================
     V28 · 首次出击引导与训练阶段目标
     ===================================================================== */
  var Onboarding = (function () {
    var G, guide = null, tracker = null, seen = false;
    var killN = 0, killGoal = 2, scanned = false, naded = false, trainingOn = false;
    var KEY = "saltline.guide.v1";

    function load() { try { seen = localStorage.getItem(KEY) === "1"; } catch (e) { seen = false; } }
    function dismiss(save) {
      if (guide) guide.classList.remove("on");
      if (save) { seen = true; try { localStorage.setItem(KEY, "1"); } catch (e) {} }
    }
    function build() {
      guide = el("div", "x-guide",
        '<b>首次出击 · 几猫队员</b>' +
        '<div class="x-guide-row"><kbd>WASD</kbd> 移动 <kbd>Shift</kbd> 冲刺 <kbd>右键</kbd> 瞄准</div>' +
        '<div class="x-guide-row"><kbd>E</kbd> 按住切断中继 <kbd>Q</kbd> 战术扫描</div>' +
        '<div class="x-guide-row"><kbd>G</kbd> 按住预览手雷弹道 <kbd>V</kbd> 近战</div>' +
        '<div class="x-guide-actions"><button class="btn small" data-guide-ok>知道了</button><button class="btn small" data-guide-skip>不再显示</button></div>');
      document.getElementById("ui").appendChild(guide);
      guide.querySelector("[data-guide-ok]").onclick = function () { dismiss(false); };
      guide.querySelector("[data-guide-skip]").onclick = function () { dismiss(true); };
      tracker = el("div", "x-train-step",
        '<b>训练目标</b>' +
        '<i data-step="kill">击倒 2 个靶机 <em>0/2</em></i>' +
        '<i data-step="scan">使用战术扫描 Q</i>' +
        '<i data-step="nade">投掷 1 枚手雷 G</i>');
      document.getElementById("ui").appendChild(tracker);
    }
    function resetTraining() {
      killN = 0; scanned = false; naded = false;
      tracker.classList.remove("done");
      tracker.querySelector('[data-step="kill"]').className = "";
      tracker.querySelector('[data-step="kill"] em').textContent = "0/2";
      tracker.querySelector('[data-step="scan"]').className = "";
      tracker.querySelector('[data-step="nade"]').className = "";
      checkTraining();
    }
    function checkTraining() {
      if (!tracker || !trainingOn) return;
      if (killN >= killGoal) tracker.querySelector('[data-step="kill"]').className = "done";
      if (scanned) tracker.querySelector('[data-step="scan"]').className = "done";
      if (naded) tracker.querySelector('[data-step="nade"]').className = "done";
      if (killN >= killGoal && scanned && naded) {
        tracker.classList.add("done");
        try { G.hud.message("训练目标完成 · 继续打靶", 3); } catch (e) {}
      }
    }
    function init(g) {
      G = g;
      load();
      build();
      G.events.on("enemy:killed", function (ev) {
        if (!trainingOn || !ev || !ev.enemy || !ev.enemy.trainTarget) return;
        killN++;
        tracker.querySelector('[data-step="kill"] em').textContent = Math.min(killN, killGoal) + "/" + killGoal;
        checkTraining();
      });
      G.events.on("sx:scan", function () {
        if (!trainingOn) return;
        scanned = true; checkTraining();
      });
      G.events.on("sx:grenade", function () {
        if (!trainingOn) return;
        naded = true; checkTraining();
      });
      setTimeout(function () {
        try {
          if (G.game.state === "playing" && !seen && !(S.training && S.training.active)) guide.classList.add("on");
        } catch (e) {}
      }, 1800);
      G.events.on("sx:training-start", function () {
        trainingOn = true;
        guide.classList.remove("on");
        tracker.classList.add("on");
        resetTraining();
      });
      G.events.on("sx:training-end", function () {
        trainingOn = false;
        tracker.classList.remove("on");
      });
      G.events.on("game:state", function (e) {
        if (!e) return;
        var tr = !!(S.training && S.training.active) || !!(camp && camp.trainSel && G.game.currentMission && G.game.currentMission.id === "train");
        var mp = false;
        try { mp = !!(window.__MP && window.__MP.state().active); } catch (err) {}
        if (e.state === "playing" && tr) {
          trainingOn = true;
          guide.classList.remove("on");
          tracker.classList.add("on");
          resetTraining();
        } else {
          trainingOn = false;
          tracker.classList.remove("on");
          if (e.state === "playing" && !mp && !seen) {
            setTimeout(function () {
              var mpNow = false;
              try { mpNow = !!(window.__MP && window.__MP.state().active); } catch (err) {}
              if (G.game.state === "playing" && !seen && !mpNow) guide.classList.add("on");
            }, 1400);
          } else {
            guide.classList.remove("on");
          }
        }
      });
    }
    return { init: init, seen: function () { return seen; } };
  })();
