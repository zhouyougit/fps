
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# state vars
rep('''    var sendAcc = 0, seq = 0, lastPing = 0, pingMs = 0;
    var ui = null, hud = null, pause = null;''','''    var sendAcc = 0, seq = 0, lastPing = 0, pingMs = 0;
    var ui = null, hud = null, pause = null, deadUi = null, scoreUi = null;
    var mpDead = false, scoreData = null, scoreVisible = false, myKills = 0, myDeaths = 0;
    var fireHandler = null;''')

# CSS
rep('''        ".x-mp-tag{position:absolute;pointer-events:none;font:600 10px/1 var(--f-mono);color:#fff;text-shadow:0 1px 3px #000;background:rgba(0,0,0,.4);padding:2px 5px;white-space:nowrap;}";''','''        ".x-mp-tag{position:absolute;pointer-events:none;font:600 10px/1 var(--f-mono);color:#fff;text-shadow:0 1px 3px #000;background:rgba(0,0,0,.4);padding:2px 5px;white-space:nowrap;}" +
        ".x-mp-dead{position:absolute;inset:0;z-index:78;display:none;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(80,0,0,.15),rgba(0,0,0,.55));}" +
        ".x-mp-dead.on{display:block;}" +
        ".x-mp-dead .t{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center;font:900 38px/1.1 var(--f-display);letter-spacing:.14em;color:#ff8a6a;text-shadow:0 2px 18px #000;}" +
        ".x-mp-dead .s{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);font:500 12px/1.5 var(--f-mono);letter-spacing:.12em;color:var(--bone-dim);}" +
        ".x-mp-score{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:79;display:none;min-width:440px;padding:20px 24px;background:rgba(7,9,11,.92);border:1px solid rgba(232,228,218,.2);pointer-events:none;}" +
        ".x-mp-score.on{display:block;}" +
        ".x-mp-score h3{margin:0 0 12px;font:900 22px/1 var(--f-display);letter-spacing:.16em;color:var(--signal);}" +
        ".x-mp-score table{width:100%;border-collapse:collapse;font:500 12px/1.6 var(--f-mono);}" +
        ".x-mp-score th{color:var(--steel);text-align:left;font-weight:500;letter-spacing:.12em;padding-bottom:6px;}" +
        ".x-mp-score td{padding:4px 0;border-top:1px solid rgba(232,228,218,.08);}" +
        ".x-mp-score td.k{color:var(--signal);}" +
        ".x-mp-hud .kd{color:var(--bone);}"''')

# build UI extras
rep('''      pause.querySelector("[data-mp-resume]").onclick = function () { pause.classList.remove("on"); try { G.input.requestLock(); } catch (e) {} };''','''      deadUi = el("div", "x-mp-dead", '<div class="t">阵亡</div><div class="s">3 秒后重生</div>');
      document.getElementById("ui").appendChild(deadUi);
      scoreUi = el("div", "x-mp-score", '<h3>计分板</h3><table><thead><tr><th>呼号</th><th>击杀</th><th>死亡</th></tr></thead><tbody></tbody></table>');
      document.getElementById("ui").appendChild(scoreUi);
      addEventListener("keydown", function (e) {
        if (e.code !== "Tab" || !active) return;
        e.preventDefault(); e.stopImmediatePropagation();
        scoreVisible = !scoreVisible;
        scoreUi.classList.toggle("on", scoreVisible);
        if (scoreVisible) renderScore();
      }, true);
      pause.querySelector("[data-mp-resume]").onclick = function () { pause.classList.remove("on"); try { G.input.requestLock(); } catch (e) {} };''')

# hud content add kd
rep('''      hud = el("div", "x-mp-hud", '<b data-mp-room>harbor-1</b><span data-mp-count>0 在线</span><span data-mp-ping>-- ms</span>');''','''      hud = el("div", "x-mp-hud", '<b data-mp-room>harbor-1</b><span data-mp-count>0 在线</span><span class="kd" data-mp-kd>0K / 0D</span><span data-mp-ping>-- ms</span>');''')

# enter attach fire + reset
rep('''        hud.classList.add("on");
        hud.querySelector("[data-mp-room]").textContent = welcome.room || room;''','''        mpDead = false; myKills = 0; myDeaths = 0;
        deadUi.classList.remove("on"); scoreUi.classList.remove("on");
        if (!fireHandler) {
          fireHandler = function (ev) {
            if (!active || mpDead || !ev || !ev.dir) return;
            send({ t: "fire", dir: { x: ev.dir.x, y: ev.dir.y, z: ev.dir.z }, wpn: ev.weapon });
          };
          G.events.on("weapon:fire", fireHandler);
        }
        hud.classList.add("on");
        hud.querySelector("[data-mp-room]").textContent = welcome.room || room;''')

# onMsg cases
rep('''      if (m.t === "leave") {
        removeRemote(m.id);
      }''','''      if (m.t === "leave") {
        removeRemote(m.id);
      }
      if (m.t === "hit") {
        if (m.victim === selfId) {
          var fp = m.point ? { x: m.point[0], y: m.point[1], z: m.point[2] } : null;
          try { G.events.emit("player:hit", { amount: m.dmg, fromPos: fp }); } catch (e) {}
        }
        if (m.by === selfId) {
          try { G.hud.hitmarker(m.hs ? "kill" : "hit"); } catch (e) {}
        }
      }
      if (m.t === "kill") {
        var by = m.byName || "几猫", vic = m.victimName || "几猫";
        try { G.hud.feed("<b>" + by + "</b> ▸ <b>" + vic + "</b>" + (m.hs ? " · 爆头" : "")); } catch (e) {}
        if (m.by === selfId) { myKills++; }
        if (m.victim === selfId) { myDeaths++; die(m.byName || "对手"); }
      }
      if (m.t === "respawn" && m.id === selfId) {
        revive(m);
      }
      if (m.t === "score") {
        scoreData = m;
        var me = m.players.find(function (q) { return q.id === selfId; });
        if (me) { myKills = me.kills; myDeaths = me.deaths; }
        if (scoreVisible) renderScore();
        var kd = hud.querySelector("[data-mp-kd]");
        if (kd) kd.textContent = myKills + "K / " + myDeaths + "D";
      }
      if (m.t === "roundEnd") {
        try { G.hud.message("回合结束 · " + (m.winner ? m.winner.name : "无胜者"), 6); } catch (e) {}
      }''')

# snap self hp/alive + remote visible
rep('''          serverSelf = p;
          if (!G.player.pos || G.player.pos.lengthSq() === 0) G.player.pos.set(p.x, p.y, p.z);''','''          serverSelf = p;
          if (!mpDead) {
            if (p.alive === false) die("对手");
            else if (p.alive !== false) {
              if (typeof p.hp === "number") G.player.health = p.hp;
              if (typeof p.armor === "number") G.player.armor = p.armor;
            }
          }
          if (!G.player.pos || G.player.pos.lengthSq() === 0) G.player.pos.set(p.x, p.y, p.z);''')
rep('''      r.hist.push({ t: performance.now(), x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, pitch: p.pitch || 0 });''','''      if (r.grp) r.grp.visible = p.alive !== false;
      r.hist.push({ t: performance.now(), x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, pitch: p.pitch || 0 });''')

# helper functions before leave
rep('''    function leave(silent) {''','''    function die(killer) {
      if (mpDead) return;
      mpDead = true;
      deadUi.classList.add("on");
      deadUi.querySelector(".s").textContent = (killer ? "被 " + killer + " 击倒 · " : "") + "3 秒后重生";
      try { G.player.health = 0; } catch (e) {}
      try { G.input.setGameplay(false); G.input.exitLock(); } catch (e) {}
    }

    function revive(m) {
      mpDead = false;
      deadUi.classList.remove("on");
      try {
        G.player.pos.set(m.x, m.y, m.z);
        G.player.vel.set(0, 0, 0);
        G.player.yaw = m.yaw || 0;
        G.player.health = m.hp || 100;
        G.player.armor = m.armor || 50;
        G.input.setGameplay(true);
        G.input.requestLock();
      } catch (e) {}
    }

    function renderScore() {
      if (!scoreData) return;
      var tb = scoreUi.querySelector("tbody");
      var rows = scoreData.players.slice().sort(function (a, b) { return b.kills - a.kills; });
      tb.innerHTML = rows.map(function (p) {
        return "<tr><td>" + (p.id === selfId ? "▶ " : "") + p.name + "</td><td class='k'>" + p.kills + "</td><td>" + p.deaths + "</td></tr>";
      }).join("");
    }

    function leave(silent) {''')

# leave cleanup dead/score + input
rep('''      hud.classList.remove("on");
      pause.classList.remove("on");''','''      hud.classList.remove("on");
      pause.classList.remove("on");
      deadUi.classList.remove("on");
      scoreUi.classList.remove("on");
      mpDead = false;
      try { G.player.health = 100; G.player.armor = 50; G.input.setGameplay(false); } catch (e) {}''')

# debug fire
rep('''      remotes: function () { return Array.from(remotes.keys()); },''','''      remotes: function () { return Array.from(remotes.keys()); },
      testFire: function (dir) { if (active && dir) send({ t: "fire", dir: dir, wpn: "pac9" }); },
      score: function () { return scoreData; },''')
io.open(p,'w',encoding='utf-8').write(s)
print('mp combat client patched')
