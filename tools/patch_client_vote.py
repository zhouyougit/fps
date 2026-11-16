
import io
p='src/mp.js'
s=io.open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1, (s.count(old), old[:80])
    s=s.replace(old,new,1)

# CSS vote
rep('''        ".x-mp-round .s{margin-top:8px;font:500 12px/1.5 var(--f-mono);color:var(--bone-dim);letter-spacing:.1em;}";''','''        ".x-mp-round .s{margin-top:8px;font:500 12px/1.5 var(--f-mono);color:var(--bone-dim);letter-spacing:.1em;}" +
        ".x-mp-vote{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);z-index:81;display:none;pointer-events:auto;padding:16px 20px;background:rgba(6,8,10,.88);border:1px solid rgba(232,228,218,.2);text-align:center;}" +
        ".x-mp-vote.on{display:block;}" +
        ".x-mp-vote .t{font:600 11px/1.4 var(--f-mono);letter-spacing:.14em;color:var(--signal);margin-bottom:10px;}" +
        ".x-mp-vote .opts{display:flex;gap:8px;}" +
        ".x-mp-vote button{min-width:110px;}" +
        ".x-mp-vote button.sel{border-color:var(--signal);color:var(--signal);}"''')

# build vote UI after roundUi
rep('''      var roundUi = el("div", "x-mp-round", '<div class="t" data-mp-round-t></div><div class="s">下一回合即将开始</div>');
      document.getElementById("ui").appendChild(roundUi);
      scoreUi._round = roundUi;''','''      var roundUi = el("div", "x-mp-round", '<div class="t" data-mp-round-t></div><div class="s">下一回合即将开始</div>');
      document.getElementById("ui").appendChild(roundUi);
      scoreUi._round = roundUi;
      var voteUi = el("div", "x-mp-vote", '<div class="t">下一张地图</div><div class="opts"><button class="btn" data-vote="harbor">港区</button><button class="btn" data-vote="depot">冷库</button><button class="btn" data-vote="ship">货轮</button></div>');
      document.getElementById("ui").appendChild(voteUi);
      scoreUi._vote = voteUi;
      voteUi.querySelectorAll("[data-vote]").forEach(function (b) {
        b.onclick = function () {
          voteUi.querySelectorAll("[data-vote]").forEach(function (x) { x.classList.remove("sel"); });
          b.classList.add("sel");
          send({ t: "vote", map: b.dataset.vote });
        };
      });''')

# map label helper + enter uses
rep('''    function enter(welcome) {''','''    function mapLabel() {
      return mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : "港区";
    }
    function refreshMapHud() {
      var elr = hud && hud.querySelector("[data-mp-room]");
      if (elr) elr.textContent = (room || "room") + " · " + mapLabel();
    }

    function enter(welcome) {''')
rep('''        hud.querySelector("[data-mp-room]").textContent = (welcome.room || room) + " · " + (mapId === "depot" ? "冷库" : mapId === "ship" ? "货轮" : "港区");''','''        room = welcome.room || room;
        refreshMapHud();''')

# voteStart/mapChange handlers
rep('''      if (m.t === "roundStart") {
        var ru2 = scoreUi && scoreUi._round;
        if (ru2) ru2.classList.remove("on");
        scoreData = null;
        try { G.hud.message("新回合开始", 3); } catch (e) {}
      }''','''      if (m.t === "roundStart") {
        var ru2 = scoreUi && scoreUi._round;
        if (ru2) ru2.classList.remove("on");
        var vu2 = scoreUi && scoreUi._vote;
        if (vu2) vu2.classList.remove("on");
        scoreData = null;
        if (m.mapId && m.mapId !== mapId) applyMap(m.mapId);
        try { G.hud.message("新回合开始", 3); } catch (e) {}
      }
      if (m.t === "voteStart") {
        var vu = scoreUi && scoreUi._vote;
        if (vu) {
          vu.classList.add("on");
          vu.querySelectorAll("[data-vote]").forEach(function (b) { b.classList.toggle("sel", b.dataset.vote === m.current); });
        }
      }
      if (m.t === "mapChange") {
        applyMap(m.mapId);
      }''')

# applyMap function before send
rep('''    function send(obj) {''','''    function applyMap(id) {
      if (id !== "depot" && id !== "ship") id = "harbor";
      if (mapId === id) return;
      mapId = id;
      try { MapKit.load(mapId); } catch (e) {}
      try { G.enemies.clear(); G.hud.setMarkers([]); } catch (e) {}
      refreshMapHud();
    }

    function send(obj) {''')

# HUD/state map
rep('''        map: mapId, url: url, team: myTeam,''','''        map: mapId, url: url, team: myTeam,''')
# public vote
rep('''      testRound: function () { if (active) send({ t: "dev", cmd: "round" }); },''','''      testRound: function () { if (active) send({ t: "dev", cmd: "round" }); },
      vote: function (m) { if (active) send({ t: "vote", map: m }); },''')
io.open(p,'w',encoding='utf-8').write(s)
print('client vote/mapchange patched')
